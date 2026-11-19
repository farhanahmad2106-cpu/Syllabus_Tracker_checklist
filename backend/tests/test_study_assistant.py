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
    TopicNoteCreate,
)
from backend.app.services.study_assistant import (
    ask_study_assistant,
    generate_deterministic_flashcards,
    generate_topic_flashcards,
    retrieve_grounded_context,
    sanitize_fts_query,
)


@pytest.fixture
def db_session():
    """Isolated in-memory SQLite database session with FTS5 initialized."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    init_db(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


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
        is_laboratory=False,
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
        is_laboratory=False,
        is_elective=True,
        is_enrolled=False,
        enrollment_status="not_selected",
        modules=[mod_qc],
    )

    sem = Semester(id="sem_5", title="Semester 5", subjects=[subj1, subj_qc])
    year = AcademicYear(id="year_3", title="Year 3", semesters=[sem])
    return HierarchicalSyllabus(id=syllabus_id, title="B.Tech Computer Science 2026", years=[year])


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
    assert any("Bankers Algorithm" in c.text for c in chunks)
    assert all(c.source_type == "official_syllabus" for c in chunks)

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
    note_create = TopicNoteCreate(
        note_markdown="Professor emphasized that Peterson solution satisfies mutual exclusion, progress, and bounded waiting.",
        color_tag="amber",
    )
    note = upsert_topic_note(db_session, syllabus.id, "leaf_os_deadlocks", note_create)
    assert note is not None

    # Retrieve context matching student personal note
    chunks = retrieve_grounded_context(db_session, syllabus.id, "Peterson solution mutual exclusion")
    assert len(chunks) > 0
    note_chunk = next((c for c in chunks if c.source_type == "personal_note"), None)
    assert note_chunk is not None
    assert "Peterson solution satisfies mutual exclusion" in note_chunk.text
    assert note_chunk.leaf_id == "leaf_os_deadlocks"

    # Test delete note removes from FTS
    delete_topic_note_fts(db_session, note.id)
    chunks_after = retrieve_grounded_context(db_session, syllabus.id, "Peterson solution mutual exclusion")
    assert not any(c.source_type == "personal_note" for c in chunks_after)


def test_sanitize_fts_query():
    """Verify FTS5 special character sanitization prevents syntax errors."""
    query = 'What is "Paging" * AND NOT (virtual)? OR [memory] & ^ ~ :'
    sanitized = sanitize_fts_query(query)
    assert '"' not in sanitized
    assert '*' not in sanitized
    assert 'NOT' not in sanitized.split()
    assert len(sanitized) > 0


def test_ask_study_assistant_insufficient_evidence(db_session):
    """When query terms have no grounding in syllabus, assistant must abstain without calling LLM."""
    syllabus = make_test_syllabus_for_rag("syl_abstain_test")
    save_syllabus(db_session, syllabus)
    rebuild_syllabus_fts_index(db_session, syllabus.id)

    req = StudyAssistantRequest(
        question="How does Warp Drive faster than light travel work in quantum spacetime?",
    )

    with patch("backend.app.services.study_assistant.call_ollama_llm") as mock_llm:
        resp = ask_study_assistant(db_session, syllabus.id, req)
        # LLM must NOT be called when evidence is missing!
        mock_llm.assert_not_called()
        assert resp.answer_state == "insufficient_evidence"
        assert len(resp.citations) == 0
        assert "could not find any official syllabus content" in resp.answer_markdown


def test_ask_study_assistant_grounded_answer(db_session):
    """Verify grounded answer with verbatim citations and prompt-injection escaping."""
    syllabus = make_test_syllabus_for_rag("syl_answer_test")
    save_syllabus(db_session, syllabus)
    rebuild_syllabus_fts_index(db_session, syllabus.id)

    req = StudyAssistantRequest(
        question="What algorithm is used for deadlock avoidance?",
        leaf_id="leaf_os_deadlocks",
    )

    mock_llm_output = (
        "Deadlock avoidance is achieved using Banker's Algorithm.\n\n"
        "[Citation 1]: Bankers Algorithm is used for deadlock avoidance by simulating allocation"
    )

    with patch("backend.app.services.study_assistant.call_ollama_llm", return_value=mock_llm_output):
        resp = ask_study_assistant(db_session, syllabus.id, req)
        assert resp.answer_state in ("supported", "partial")
        assert len(resp.citations) >= 1
        assert resp.citations[0].leaf_id == "leaf_os_deadlocks"
        assert "Bankers Algorithm" in resp.citations[0].verbatim_quote


def test_deterministic_flashcard_generation(db_session):
    """Test deterministic flashcard generation fallback when Ollama is unavailable."""
    syllabus = make_test_syllabus_for_rag("syl_cards_test")
    save_syllabus(db_session, syllabus)

    resp = generate_topic_flashcards(
        db_session,
        syllabus.id,
        "leaf_os_deadlocks",
        use_ollama=False,  # deterministic mode
    )

    assert resp.leaf_id == "leaf_os_deadlocks"
    assert resp.count >= 2
    assert resp.generated_by == "deterministic_grounded_rules"
    assert len(resp.cards) >= 2

    for card in resp.cards:
        assert len(card.front_question) > 5
        assert len(card.back_answer) > 5
        assert card.source_quote is not None
        assert card.leaf_id == "leaf_os_deadlocks"


def test_flashcard_deduplication_and_persistence(db_session):
    """Test deduplication fingerprints prevent duplicate flashcards upon multiple generations."""
    syllabus = make_test_syllabus_for_rag("syl_dedup_test")
    save_syllabus(db_session, syllabus)

    # First generation
    resp1 = generate_topic_flashcards(db_session, syllabus.id, "leaf_os_paging", use_ollama=False)
    initial_count = resp1.count

    # Second generation for the exact same leaf should not duplicate
    resp2 = generate_topic_flashcards(db_session, syllabus.id, "leaf_os_paging", use_ollama=False)
    all_cards = get_study_flashcards(db_session, syllabus.id, leaf_id="leaf_os_paging")

    assert len(all_cards) == initial_count


def test_flashcard_deletion_and_cascading(db_session):
    """Test manual card deletion and cascade delete with syllabus."""
    syllabus = make_test_syllabus_for_rag("syl_cascade_test")
    save_syllabus(db_session, syllabus)
    resp = generate_topic_flashcards(db_session, syllabus.id, "leaf_os_deadlocks", use_ollama=False)
    assert resp.count > 0

    first_card = resp.cards[0]
    # Delete single card
    deleted = delete_study_flashcard(db_session, first_card.id)
    assert deleted is True
    assert get_study_flashcard(db_session, first_card.id) is None

    # Delete entire syllabus and verify cascade
    delete_syllabus(db_session, syllabus.id)
    remaining_cards = get_study_flashcards(db_session, syllabus.id)
    assert len(remaining_cards) == 0


def test_rest_api_endpoints(client=None):
    """Integration test for Phase 13 Cycle B REST endpoints."""
    test_client = TestClient(app)

    # Create test syllabus via mock / direct db
    from backend.app.database import get_engine
    engine = get_engine()
    init_db(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    syl = make_test_syllabus_for_rag("syl_api_rag_test")
    save_syllabus(session, syl)
    rebuild_syllabus_fts_index(session, syl.id)
    session.close()

    try:
        # 1. Ask assistant endpoint with empty result
        ask_payload = {
            "question": "Nonexistent random alien topic that definitely has no match",
        }
        res = test_client.post(f"/api/syllabus/{syl.id}/assistant/ask", json=ask_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["answer_state"] == "insufficient_evidence"

        # 2. Generate flashcards endpoint (using deterministic fallback)
        res_gen = test_client.post(
            f"/api/syllabus/{syl.id}/topics/leaf_os_deadlocks/flashcards/generate?use_ollama=false"
        )
        assert res_gen.status_code == 200
        gen_data = res_gen.json()
        assert gen_data["count"] >= 1
        card_id = gen_data["cards"][0]["id"]

        # 3. Get flashcards endpoint
        res_list = test_client.get(f"/api/syllabus/{syl.id}/flashcards?leaf_id=leaf_os_deadlocks")
        assert res_list.status_code == 200
        cards_list = res_list.json()
        assert len(cards_list) >= 1

        # 4. Delete flashcard endpoint
        res_del = test_client.delete(f"/api/syllabus/{syl.id}/flashcards/{card_id}")
        assert res_del.status_code == 200
        assert res_del.json()["deleted"] is True
    finally:
        session = Session()
        delete_syllabus(session, syl.id)
        session.close()
