"""Tests for Phase 14 Cycle B: Schema 2.2 Encrypted Portable Archive & Full-Fidelity Sync Snapshot."""

import json
import os
import uuid
from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.app.database import (
    add_topic_resource,
    get_syllabus_record,
    init_db,
    update_leaf_completion,
    upsert_subject_academic_plan,
    upsert_target_deadline,
    upsert_topic_note,
)
from backend.app.main import app
from backend.app.models import (
    LeafCompletionRecord,
    RevisionSchedule,
    StudyFlashcard,
    SubjectAcademicPlan,
    SyllabusRecord,
    TargetDeadline,
    TopicNote,
    TopicResource,
)
from backend.app.schemas import (
    AcademicYear,
    ExportOptions,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)
from backend.app.services.archive_crypto import (
    CIPHER_IDENTIFIER,
    CURRENT_VERSION,
    FORMAT_IDENTIFIER,
    KDF_IDENTIFIER,
    REQUIRED_ITERATIONS,
    ArchiveDecryptionError,
    decrypt_archive_payload,
    encrypt_archive_payload,
    is_encrypted_archive,
)
from backend.app.services.export_service import build_json_backup
from backend.app.services.restore_service import restore_backup


@pytest.fixture(autouse=True)
def ensure_db():
    init_db()


def create_sample_syllabus() -> HierarchicalSyllabus:
    return HierarchicalSyllabus(
        id="syl_test_p14b",
        title="Engineering System Design",
        source_filename="sys_design.pdf",
        schema_version=2,
        years=[
            AcademicYear(
                id="yr_1",
                title="Year 1",
                year_number=1,
                semesters=[
                    Semester(
                        id="sem_1",
                        title="Semester 1",
                        semester_number=1,
                        subjects=[
                            Subject(
                                id="sub_101",
                                title="Distributed Systems",
                                code="CS101",
                                is_enrolled=True,
                                credits=4.0,
                                modules=[
                                    Module(
                                        id="mod_1",
                                        title="Consensus Protocols",
                                        subtopics=[
                                            Subtopic(
                                                id="leaf_paxos",
                                                title="Paxos Algorithm",
                                                source_text="Paxos consensus notes and proof",
                                            ),
                                            Subtopic(
                                                id="leaf_raft",
                                                title="Raft Algorithm",
                                                source_text="Raft consensus paper",
                                            ),
                                        ],
                                    )
                                ],
                            ),
                            Subject(
                                id="sub_102",
                                title="Machine Learning",
                                code="CS102",
                                is_enrolled=False,
                                credits=3.0,
                                modules=[
                                    Module(
                                        id="mod_2",
                                        title="Neural Nets",
                                        subtopics=[
                                            Subtopic(
                                                id="leaf_backprop",
                                                title="Backpropagation",
                                                source_text="Backpropagation gradient descent",
                                            )
                                        ],
                                    )
                                ],
                            ),
                        ],
                    )
                ],
            )
        ],
    )


# --- 1. Cryptography Unit Tests ---

def test_crypto_roundtrip():
    payload = {"hello": "world", "count": 42, "unicode": "Café 🚀"}
    payload_str = json.dumps(payload)
    passphrase = "CorrectHorseBatteryStaple!"

    envelope = encrypt_archive_payload(payload_str, passphrase)
    assert is_encrypted_archive(envelope) is True
    assert envelope["format"] == FORMAT_IDENTIFIER
    assert envelope["version"] == CURRENT_VERSION
    assert envelope["kdf"] == KDF_IDENTIFIER
    assert envelope["iterations"] == REQUIRED_ITERATIONS
    assert envelope["cipher"] == CIPHER_IDENTIFIER

    decrypted = decrypt_archive_payload(envelope, passphrase)
    assert json.loads(decrypted) == payload


def test_crypto_fresh_salt_and_nonce():
    payload_str = json.dumps({"test": "value"})
    passphrase = "securePassphrase123"

    env1 = encrypt_archive_payload(payload_str, passphrase)
    env2 = encrypt_archive_payload(payload_str, passphrase)

    assert env1["salt_b64"] != env2["salt_b64"]
    assert env1["nonce_b64"] != env2["nonce_b64"]
    assert env1["ciphertext_b64"] != env2["ciphertext_b64"]


def test_crypto_wrong_passphrase():
    payload_str = json.dumps({"secret": "data"})
    envelope = encrypt_archive_payload(payload_str, "correct-password-1")

    with pytest.raises(ArchiveDecryptionError, match="INVALID_PASSPHRASE_OR_CORRUPT_ARCHIVE"):
        decrypt_archive_payload(envelope, "wrong-password-2")


def test_crypto_tampered_ciphertext():
    payload_str = json.dumps({"secret": "data"})
    envelope = encrypt_archive_payload(payload_str, "secretPassword42")

    # Tamper with the ciphertext
    ct_bytes = bytearray(json.loads(json.dumps(envelope))["ciphertext_b64"].encode("ascii"))
    ct_bytes[5] = ord("A") if ct_bytes[5] != ord("A") else ord("B")
    envelope["ciphertext_b64"] = ct_bytes.decode("ascii")

    with pytest.raises(ArchiveDecryptionError):
        decrypt_archive_payload(envelope, "secretPassword42")


def test_crypto_tampered_metadata_aad():
    payload_str = json.dumps({"secret": "data"})
    envelope = encrypt_archive_payload(payload_str, "secretPassword42")

    # Alter version or iterations in envelope
    envelope["version"] = "2.0"
    with pytest.raises(ArchiveDecryptionError, match="Unsupported envelope version"):
        decrypt_archive_payload(envelope, "secretPassword42")


def test_crypto_passphrase_validation():
    with pytest.raises(ValueError, match="at least 4 characters"):
        encrypt_archive_payload("{}", "123")

    with pytest.raises(ValueError, match="whitespace only"):
        encrypt_archive_payload("{}", "    ")


# --- 2. Schema 2.2 Export Tests ---

def test_export_schema_2_2_structure(db_session: Session):
    syllabus = create_sample_syllabus()
    now_dt = datetime.now(timezone.utc)

    # Insert syllabus record
    rec = SyllabusRecord(
        id=syllabus.id,
        title=syllabus.title,
        source_filename=syllabus.source_filename,
        schema_version=2,
        hierarchy_json=syllabus.model_dump_json(),
        created_at=now_dt,
        updated_at=now_dt,
    )
    db_session.add(rec)
    db_session.flush()

    # Add study entities
    update_leaf_completion(db_session, syllabus, "leaf_paxos", True)
    db_session.flush()

    # update_leaf_completion automatically initializes a RevisionSchedule for leaf_paxos
    rs = db_session.scalars(select(RevisionSchedule).where(RevisionSchedule.syllabus_id == syllabus.id, RevisionSchedule.leaf_id == "leaf_paxos")).first()
    assert rs is not None
    rs.repetition_count = 2
    rs.ease_factor = 2.6
    rs.interval_days = 6
    rs.next_review_date = date(2026, 11, 25)

    upsert_topic_note(db_session, syllabus.id, "leaf_paxos", "Note about Paxos consensus")
    add_topic_resource(
        db_session, syllabus.id, "leaf_paxos", "subtopic", "Paxos Paper", "https://lamport.azurewebsites.net/pubs/paxos-simple.pdf", "documentation"
    )
    upsert_target_deadline(db_session, syllabus.id, "sub_101", "subject", date(2026, 12, 1))

    # Add academic plan
    upsert_subject_academic_plan(db_session, syllabus.id, "sub_101", credit_override=4.5, target_grade_points=9.5, grade_scale="10.0")

    # Add flashcard
    db_session.add(
        StudyFlashcard(
            syllabus_id=syllabus.id,
            leaf_id="leaf_paxos",
            front_question="What is Phase 1 of Paxos?",
            back_answer="Prepare/Promise phase",
            citation_label="Lamport 1998",
            source_quote="Proposer sends Prepare(n)...",
            fingerprint="fp_paxos_q1",
        )
    )
    db_session.commit()

    # Query entities
    revisions = db_session.scalars(select(RevisionSchedule).where(RevisionSchedule.syllabus_id == syllabus.id)).all()
    plans = db_session.scalars(select(SubjectAcademicPlan).where(SubjectAcademicPlan.syllabus_id == syllabus.id)).all()
    flashcards = db_session.scalars(select(StudyFlashcard).where(StudyFlashcard.syllabus_id == syllabus.id)).all()
    notes = {n.leaf_id: n.content for n in db_session.scalars(select(TopicNote).where(TopicNote.syllabus_id == syllabus.id)).all()}
    resources = db_session.scalars(select(TopicResource).where(TopicResource.syllabus_id == syllabus.id)).all()
    deadlines = {d.node_id: d for d in db_session.scalars(select(TargetDeadline).where(TargetDeadline.syllabus_id == syllabus.id)).all()}

    backup = build_json_backup(
        syllabus=syllabus,
        completed_leaf_ids={"leaf_paxos"},
        notes_map=notes,
        resources_list=resources,
        deadlines_map=deadlines,
        options=ExportOptions(),
        revision_schedules=revisions,
        academic_plans=plans,
        flashcards=flashcards,
    )

    assert backup["schema_version"] == "2.2"
    assert backup["application"] == "Hierarchical Syllabus Checklist & Progress Tracker"
    assert "export_metadata" in backup
    assert backup["completed_leaves"] == ["leaf_paxos"]
    assert len(backup["revision_schedules"]) == 1
    assert backup["revision_schedules"][0]["leaf_id"] == "leaf_paxos"
    assert backup["revision_schedules"][0]["ease_factor"] == 2.6
    assert len(backup["academic_plans"]) == 1
    assert backup["academic_plans"][0]["subject_id"] == "sub_101"
    assert backup["academic_plans"][0]["target_grade_points"] == 9.5
    assert len(backup["flashcards"]) == 1
    assert backup["flashcards"][0]["front_question"] == "What is Phase 1 of Paxos?"


# --- 3. Restore Clone & Merge Tests ---

def test_restore_clone_mode(db_session: Session):
    syllabus = create_sample_syllabus()
    backup_data = {
        "schema_version": "2.2",
        "syllabus": syllabus.model_dump(),
        "completed_leaves": ["leaf_paxos"],
        "notes": {"leaf_paxos": "Cloned study notes"},
        "resources": [
            {
                "node_id": "leaf_paxos",
                "node_type": "subtopic",
                "title": "Raft Video",
                "url": "https://youtube.com/watch?v=raft",
                "resource_type": "youtube",
            }
        ],
        "deadlines": {
            "sub_101": {
                "node_id": "sub_101",
                "node_type": "subject",
                "target_date": "2026-12-15",
            }
        },
        "revision_schedules": [
            {
                "leaf_id": "leaf_paxos",
                "algorithm_version": "sm2-v1",
                "repetition_count": 3,
                "ease_factor": 2.4,
                "interval_days": 10,
                "next_review_date": "2026-11-30",
            }
        ],
        "academic_plans": [
            {
                "subject_id": "sub_101",
                "credit_override": 4.0,
                "target_grade_points": 9.0,
                "grade_scale": "10.0",
            }
        ],
        "flashcards": [
            {
                "leaf_id": "leaf_paxos",
                "front_question": "What is Raft log compaction?",
                "back_answer": "Snapshotting state machine",
                "source_quote": "Snapshots are written...",
                "fingerprint": "fp_raft_snap",
            }
        ],
    }

    result = restore_backup(
        session=db_session,
        backup_data=backup_data,
        mode="clone",
    )
    db_session.commit()

    assert result.success is True
    assert result.syllabus_id != syllabus.id
    new_id = result.syllabus_id
    assert result.restored_completed_leaves == 1
    assert result.restored_notes == 1
    assert result.restored_resources == 1
    assert result.restored_deadlines == 1
    assert result.restored_revision_schedules == 1
    assert result.restored_academic_plans == 1
    assert result.restored_flashcards == 1

    # Verify database isolation: all records point strictly to new_id
    rs = db_session.scalars(select(RevisionSchedule).where(RevisionSchedule.syllabus_id == new_id)).first()
    assert rs is not None
    assert rs.leaf_id == "leaf_paxos"
    assert rs.ease_factor == 2.4

    fc = db_session.scalars(select(StudyFlashcard).where(StudyFlashcard.syllabus_id == new_id)).first()
    assert fc is not None
    assert fc.fingerprint == "fp_raft_snap"


def test_restore_merge_mode_deduplication(db_session: Session):
    syllabus = create_sample_syllabus()
    now_dt = datetime.now(timezone.utc)
    rec = SyllabusRecord(
        id=syllabus.id,
        title=syllabus.title,
        source_filename=syllabus.source_filename,
        schema_version=2,
        hierarchy_json=syllabus.model_dump_json(),
        created_at=now_dt,
        updated_at=now_dt,
    )
    db_session.add(rec)
    db_session.flush()

    # Pre-existing records in destination
    update_leaf_completion(db_session, syllabus, "leaf_paxos", True)
    db_session.flush()
    # update_leaf_completion automatically creates RevisionSchedule for leaf_paxos with ease_factor 2.5
    db_session.add(
        StudyFlashcard(
            syllabus_id=syllabus.id,
            leaf_id="leaf_paxos",
            front_question="Existing Question",
            back_answer="Existing Answer",
            source_quote="Existing Quote",
            fingerprint="fp_duplicate_card",
        )
    )
    db_session.commit()

    # Incoming merge payload has duplicate leaf_paxos + new leaf_raft
    merge_data = {
        "schema_version": "2.2",
        "syllabus": syllabus.model_dump(),
        "completed_leaves": ["leaf_paxos", "leaf_raft"],
        "revision_schedules": [
            {
                "leaf_id": "leaf_paxos",
                "ease_factor": 2.1,
                "interval_days": 5,
                "next_review_date": "2026-11-28",
            },
            {
                "leaf_id": "leaf_raft",
                "ease_factor": 2.5,
                "interval_days": 2,
                "next_review_date": "2026-11-24",
            },
        ],
        "flashcards": [
            {
                "leaf_id": "leaf_paxos",
                "front_question": "Existing Question",
                "back_answer": "Duplicate Answer",
                "source_quote": "...",
                "fingerprint": "fp_duplicate_card",
            },
            {
                "leaf_id": "leaf_raft",
                "front_question": "New Question for Raft",
                "back_answer": "Leader Election",
                "source_quote": "Heartbeats...",
                "fingerprint": "fp_raft_new",
            },
        ],
    }

    result = restore_backup(
        session=db_session,
        backup_data=merge_data,
        mode="merge",
        target_syllabus_id=syllabus.id,
    )
    db_session.commit()

    assert result.success is True
    # Only newly added leaf_raft should be counted as restored completion
    assert result.restored_completed_leaves == 1
    # Only newly added leaf_raft schedule should be added; existing leaf_paxos preserved
    assert result.restored_revision_schedules == 1
    # Only newly added flashcard added
    assert result.restored_flashcards == 1

    # Verify destination preservation
    paxos_rs = db_session.scalars(
        select(RevisionSchedule).where(
            RevisionSchedule.syllabus_id == syllabus.id,
            RevisionSchedule.leaf_id == "leaf_paxos",
        )
    ).first()
    assert paxos_rs.ease_factor == 2.5  # Not overwritten by 2.1


def test_restore_legacy_2_0_backup(db_session: Session):
    syllabus = create_sample_syllabus()
    legacy_backup = {
        "schema_version": "2.0",
        "syllabus": syllabus.model_dump(),
        "completed_leaves": ["leaf_paxos"],
        "notes": {"leaf_paxos": "Legacy Note"},
    }

    result = restore_backup(
        session=db_session,
        backup_data=legacy_backup,
        mode="clone",
    )
    db_session.commit()

    assert result.success is True
    assert result.source_schema_version == "2.0"
    assert result.restored_completed_leaves == 1
    assert result.restored_notes == 1
    assert result.restored_revision_schedules == 0
    assert result.restored_academic_plans == 0
    assert result.restored_flashcards == 0


# --- 4. API Endpoints Tests ---

def test_api_export_and_restore_encrypted():
    client = TestClient(app)

    # 1. Create a syllabus in DB
    syllabus = create_sample_syllabus()
    now_dt = datetime.now(timezone.utc)
    syl_id = f"syl_api_{uuid.uuid4().hex[:8]}"
    syllabus.id = syl_id
    from backend.app.database import get_db
    session = next(get_db())
    rec = SyllabusRecord(
        id=syl_id,
        title="API Test Syllabus",
        source_filename="test.pdf",
        schema_version=2,
        hierarchy_json=syllabus.model_dump_json(),
        created_at=now_dt,
        updated_at=now_dt,
    )
    session.add(rec)
    session.commit()

    # 2. Export archive with passphrase
    res_enc = client.post(
        f"/api/syllabus/{syl_id}/export/archive",
        json={"passphrase": "StrongVaultPassword!123"},
    )
    assert res_enc.status_code == 200
    env = res_enc.json()
    assert is_encrypted_archive(env) is True

    # 3. Restore without passphrase -> 422 PASSPHRASE_REQUIRED
    res_no_pw = client.post(
        "/api/syllabus/restore-backup",
        json={"backup_data": env, "mode": "clone"},
    )
    assert res_no_pw.status_code == 422
    assert res_no_pw.json()["detail"]["code"] == "PASSPHRASE_REQUIRED"

    # 4. Restore with wrong passphrase -> 400 INVALID_PASSPHRASE_OR_CORRUPT_ARCHIVE
    res_wrong_pw = client.post(
        "/api/syllabus/restore-backup",
        json={"backup_data": env, "mode": "clone", "passphrase": "WrongPassword!"},
    )
    assert res_wrong_pw.status_code == 400
    assert res_wrong_pw.json()["detail"]["code"] == "INVALID_PASSPHRASE_OR_CORRUPT_ARCHIVE"

    # 5. Restore with correct passphrase -> 200 Success
    res_success = client.post(
        "/api/syllabus/restore-backup",
        json={"backup_data": env, "mode": "clone", "passphrase": "StrongVaultPassword!123"},
    )
    assert res_success.status_code == 200
    result_data = res_success.json()
    assert result_data["success"] is True
    assert result_data["syllabus_id"].startswith("syl_")
