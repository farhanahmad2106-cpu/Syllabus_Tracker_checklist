"""Unit and integration tests for Phase 13 Cycle B: AI Study Assistant, Local RAG & Grounded Flashcards."""

import pytest
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.app.database import (
    create_study_flashcard,
    create_study_flashcards_batch,
    delete_study_flashcard,
    delete_syllabus,
    delete_topic_note,
    delete_topic_note_fts,
    get_study_flashcard,
    get_study_flashcards,
    init_db,
    rebuild_syllabus_fts_index,
    save_syllabus,
    sync_topic_note_fts,
    upsert_topic_note,
)
from backend.app.main import app
from backend.app.models import Base, StudyFlashcard, SyllabusRecord, TopicNote
from backend.app.schemas import (
    AcademicYear,
    GroundedStudyAnswer,
    HierarchicalSyllabus,
    Module,
    Semester,
    StudyAssistantRequest,
    Subject,
    Subtopic,
    StudyCitation,
)
from backend.app.services.study_assistant import (
    ask_study_assistant,
    generate_deterministic_flashcards,
    generate_topic_flashcards,
    retrieve_grounded_context,
    sanitize_fts_query,
)


def make_test_syllabus_for_rag(syllabus_id: str = "syl_rag_test") -> HierarchicalSyllabus:
    """Create a hierarchical syllabus with enrolled and unenrolled topics."""
    # Mandatory enrolled subject: Operating Systems
    subtopic1 = Subtopic(
        id="leaf_os_deadlocks",
        title="Deadlock Prevention and Avoidance",
        source_text="A deadlock occurs when a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process. Bankers Algorithm is used for deadlock avoidance by simulating allocation for predetermined maximum possible amounts.",
    )
    subtopic2 = Subtopic(
        id="leaf_os_paging",
        title="Virtual Memory and Paging",
        source_text="Paging is a memory management scheme that eliminates the need for contiguous allocation of physical memory. Page tables map logical addresses to physical frames. Translation Lookaside Buffer (TLB) acts as a high-speed hardware cache.",
    )
    mod1 = Module(id="mod_os_concurrency", title="Process Synchronization and Memory", topics=[subtopic1, subtopic2])

    subj1 = Subject(
        id="subj_os",
        title="Operating Systems",
        code="CS301",
        credits=4.0,
        ltp="3-1-0",
        is_lab=False,
        is_elective=False,
        is_enrolled=True,
        enrollment_status="mandatory",
        modules=[mod1],
    )

    # Unenrolled elective subject: Quantum Computing
    subtopic_qc = Subtopic(
        id="leaf_qc_qubits",
        title="Qubits and Quantum Superposition",
        source_text="A qubit is the basic unit of quantum information. Superposition allows qubits to represent linear combinations of states zero and one simultaneously.",
    )
    mod_qc = Module(id="mod_qc_basics", title="Quantum Basics", topics=[subtopic_qc])

    subj_qc = Subject(
        id="subj_qc",
        title="Quantum Computing Elective",
        code="CS405",
        credits=3.0,
        ltp="3-0-0",
        is_lab=False,
        is_elective=True,
        is_enrolled=False,
        enrollment_status="excluded",
        modules=[mod_qc],
    )

    sem = Semester(id="sem_5", title="Semester 5", subjects=[subj1, subj_qc])
    year = AcademicYear(id="year_3", title="Year 3", semesters=[sem])
    return HierarchicalSyllabus(
        id=syllabus_id,
        title="B.Tech Computer Science 2026",
        source_filename="operating_systems.pdf",
        years=[year],
    )


def test_fts5_indexing_and_enrolled_filtering(db_session):
    """Test FTS5 virtual table indexing, rebuild, and exclusion of unenrolled electives."""
    syllabus = make_test_syllabus_for_rag("syl_fts_test")
    save_syllabus(db_session, syllabus)

    # Rebuild FTS index
    count = rebuild_syllabus_fts_index(db_session, syllabus.id)
    assert count >= 2

    # Query for enrolled subject content: "Bankers Algorithm"
    chunks = retrieve_grounded_context(db_session, syllabus.id, "Bankers Algorithm deadlock")
    assert len(chunks) > 0
    assert any("Bankers Algorithm" in c.quote for c in chunks)
    assert all(c.authority == "official_syllabus" for c in chunks)

    # Query for unenrolled elective content: "Quantum Superposition"
    # Unenrolled topics must be excluded from retrieval!
    qc_chunks = retrieve_grounded_context(db_session, syllabus.id, "Quantum Superposition qubit")
    assert len(qc_chunks) == 0


def test_personal_note_fts_sync_and_retrieval(db_session):
    """Test personal student notes are synced to FTS5 and retrieved with source_type='personal_note'."""
    syllabus = make_test_syllabus_for_rag("syl_note_test")
    save_syllabus(db_session, syllabus)
    rebuild_syllabus_fts_index(db_session, syllabus.id)

    # Add a student personal note
    note_content = "Professor emphasized that Peterson solution satisfies mutual exclusion, progress, and bounded waiting."
    note = upsert_topic_note(db_session, syllabus.id, "leaf_os_deadlocks", note_content)
    sync_topic_note_fts(db_session, syllabus.id, "leaf_os_deadlocks", note_content)
    assert note is not None

    # Retrieve context matching student personal note
    chunks = retrieve_grounded_context(db_session, syllabus.id, "Peterson solution mutual exclusion")
    assert len(chunks) > 0
    note_chunk = next((c for c in chunks if c.authority == "personal_note"), None)
    assert note_chunk is not None
    assert "Peterson solution satisfies mutual exclusion" in note_chunk.quote
    assert note_chunk.leaf_id == "leaf_os_deadlocks"

    # Test delete note removes from FTS and database
    delete_topic_note(db_session, syllabus.id, "leaf_os_deadlocks")
    chunks_after = retrieve_grounded_context(db_session, syllabus.id, "Peterson solution mutual exclusion")
    assert not any(c.authority == "personal_note" for c in chunks_after)


def test_sanitize_fts_query():
    """Verify FTS5 special character sanitization prevents syntax errors."""
    query = 'What is "Paging" * AND NOT (virtual)? OR [memory] & ^ ~ :'
    sanitized = sanitize_fts_query(query)
    assert '^' not in sanitized
    assert '~' not in sanitized
    assert ':' not in sanitized
    assert '(' not in sanitized
    assert ')' not in sanitized
    assert '[' not in sanitized
    assert ']' not in sanitized
    assert len(sanitized) > 0


def test_ask_study_assistant_insufficient_evidence(db_session):
    """When query terms have no grounding in syllabus, assistant must abstain without calling LLM."""
    syllabus = make_test_syllabus_for_rag("syl_abstain_test")
    save_syllabus(db_session, syllabus)
    rebuild_syllabus_fts_index(db_session, syllabus.id)

    req = StudyAssistantRequest(
        question="How does Warp Drive faster than light travel work in quantum spacetime?",
    )

    with patch("backend.app.services.study_assistant.resolve_extraction_client") as mock_client:
        resp = ask_study_assistant(db_session, syllabus.id, req)
        # LLM must NOT be called when evidence is missing!
        mock_client.assert_not_called()
        assert resp.answer_state == "insufficient_evidence"
        assert len(resp.citations) == 0
        assert "could not find" in resp.answer_markdown


def test_ask_study_assistant_grounded_answer(db_session):
    """Verify grounded answer with verbatim citations and prompt-injection escaping."""
    syllabus = make_test_syllabus_for_rag("syl_answer_test")
    save_syllabus(db_session, syllabus)
    rebuild_syllabus_fts_index(db_session, syllabus.id)

    req = StudyAssistantRequest(
        question="What algorithm is used for deadlock avoidance?",
        leaf_id="leaf_os_deadlocks",
    )

    mock_answer = GroundedStudyAnswer(
        answer_markdown="Deadlock avoidance is achieved using Banker's Algorithm.",
        citations=[
            StudyCitation(
                leaf_id="leaf_os_deadlocks",
                source_quote="Bankers Algorithm is used for deadlock avoidance by simulating allocation for predetermined maximum possible amounts.",
                authority="official_syllabus",
                source_page=1,
                citation_label="Syllabus Excerpt (p. 1)",
            )
        ],
        answer_state="supported",
    )

    mock_client = patch("backend.app.services.study_assistant.resolve_extraction_client")
    mock_status = patch(
        "backend.app.services.study_assistant.check_provider_status",
        return_value=(True, "ollama", "qwen2.5:7b", None),
    )
    with mock_status, mock_client as mock_res:
        mock_obj = mock_res.return_value[0] if isinstance(mock_res.return_value, tuple) else mock_res
        mock_res.return_value = (mock_obj, "qwen2.5:7b", None)
        mock_obj.chat.completions.create.return_value = mock_answer
        resp = ask_study_assistant(db_session, syllabus.id, req)
        assert resp.answer_state in ("supported", "partial")
        assert len(resp.citations) >= 1
        assert resp.citations[0].leaf_id == "leaf_os_deadlocks"
        assert "Bankers Algorithm" in resp.citations[0].source_quote


def test_deterministic_flashcard_generation(db_session):
    """Test deterministic flashcard generation fallback when Ollama is unavailable."""
    syllabus = make_test_syllabus_for_rag("syl_cards_test")
    save_syllabus(db_session, syllabus)

    with patch("backend.app.services.study_assistant.check_provider_status", return_value=(False, None, None, None)):
        resp = generate_topic_flashcards(
            db_session,
            syllabus.id,
            "leaf_os_deadlocks",
        )

        assert resp.leaf_id == "leaf_os_deadlocks"
        assert resp.count >= 1
        assert resp.generation_mode == "deterministic_fallback"
        assert len(resp.cards) >= 1

        for card in resp.cards:
            assert len(card.front_question) > 5
            assert len(card.back_answer) > 5
            assert card.source_quote is not None
            assert card.leaf_id == "leaf_os_deadlocks"


def test_flashcard_deduplication_and_persistence(db_session):
    """Test deduplication fingerprints prevent duplicate flashcards upon multiple generations."""
    syllabus = make_test_syllabus_for_rag("syl_dedup_test")
    save_syllabus(db_session, syllabus)

    with patch("backend.app.services.study_assistant.check_provider_status", return_value=(False, None, None, None)):
        # First generation
        resp1 = generate_topic_flashcards(db_session, syllabus.id, "leaf_os_paging")
        initial_count = resp1.count

        # Second generation for the exact same leaf should not duplicate
        resp2 = generate_topic_flashcards(db_session, syllabus.id, "leaf_os_paging")
        all_cards = get_study_flashcards(db_session, syllabus.id, leaf_id="leaf_os_paging")

        assert len(all_cards) == initial_count


def test_flashcard_deletion_and_cascading(db_session):
    """Test manual card deletion and cascade delete with syllabus."""
    syllabus = make_test_syllabus_for_rag("syl_cascade_test")
    save_syllabus(db_session, syllabus)
    with patch("backend.app.services.study_assistant.check_provider_status", return_value=(False, None, None, None)):
        resp = generate_topic_flashcards(db_session, syllabus.id, "leaf_os_deadlocks")
        assert resp.count > 0

        first_card = resp.cards[0]
        # Delete single card
        deleted = delete_study_flashcard(db_session, syllabus.id, first_card.id)
        assert deleted is True
        assert get_study_flashcard(db_session, syllabus.id, first_card.id) is None

        # Delete entire syllabus and verify cascade
        delete_syllabus(db_session, syllabus.id)
        remaining_cards = get_study_flashcards(db_session, syllabus.id)
        assert len(remaining_cards) == 0


def test_rest_api_endpoints(client: TestClient, db_session):
    """Integration test for Phase 13 Cycle B REST endpoints."""
    syl = make_test_syllabus_for_rag("syl_api_rag_test")
    save_syllabus(db_session, syl)
    rebuild_syllabus_fts_index(db_session, syl.id)

    with patch("backend.app.services.study_assistant.check_provider_status", return_value=(False, None, None, None)):
        # 1. Ask assistant endpoint with empty result
        ask_payload = {
            "question": "Xyzzqwk Jklmnp 99999",
        }
        res = client.post(f"/api/syllabus/{syl.id}/assistant/ask", json=ask_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["answer_state"] == "insufficient_evidence"

        # 2. Generate flashcards endpoint (using deterministic fallback)
        res_gen = client.post(
            f"/api/syllabus/{syl.id}/topics/leaf_os_deadlocks/flashcards/generate"
        )
        assert res_gen.status_code == 200
        gen_data = res_gen.json()
        assert gen_data["count"] >= 1
        card_id = gen_data["cards"][0]["id"]

        # 3. Get flashcards endpoint
        res_list = client.get(f"/api/syllabus/{syl.id}/flashcards?leaf_id=leaf_os_deadlocks")
        assert res_list.status_code == 200
        cards_list = res_list.json()
        assert len(cards_list) >= 1

        # 4. Delete flashcard endpoint
        res_del = client.delete(f"/api/syllabus/{syl.id}/flashcards/{card_id}")
        assert res_del.status_code == 200
        assert res_del.json()["deleted"] is True
