"""Automated tests for SQLite persistence layer and transactional safety."""

import pytest
from sqlalchemy import select

from backend.app.database import (
    delete_syllabus,
    get_completed_leaf_ids,
    get_syllabus_record,
    list_syllabi_summaries,
    save_syllabus,
    update_bulk_completion,
    update_leaf_completion,
    update_syllabus_title,
)
from backend.app.exceptions import InvalidLeafError, SyllabusNotFoundError
from backend.app.models import LeafCompletionRecord, SyllabusRecord


def test_save_and_retrieve_syllabus(db_session, sample_syllabus):
    """Verify persisting a syllabus and retrieving its record."""
    record = save_syllabus(db_session, sample_syllabus, warnings=["Sample warning"])
    db_session.commit()

    retrieved = get_syllabus_record(db_session, sample_syllabus.id)
    assert retrieved is not None
    assert retrieved.id == sample_syllabus.id
    assert retrieved.title == sample_syllabus.title
    assert "Sample warning" in retrieved.warnings_json


def test_list_syllabi_summaries(db_session, sample_syllabus):
    """Verify listing summaries with progress calculation."""
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    summaries = list_syllabi_summaries(db_session)
    assert len(summaries) == 1
    assert summaries[0].id == sample_syllabus.id
    assert summaries[0].leaf_count == 4
    assert summaries[0].progress.completed_leaves == 0


def test_update_leaf_completion_lifecycle(db_session, sample_syllabus):
    """Verify marking a leaf as completed and uncompleted idempotently."""
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    # Mark completed
    done = update_leaf_completion(db_session, sample_syllabus, "sub_arr", True)
    db_session.commit()
    assert "sub_arr" in done
    assert get_completed_leaf_ids(db_session, sample_syllabus.id) == {"sub_arr"}

    # Repeated mark completed (idempotent)
    done = update_leaf_completion(db_session, sample_syllabus, "sub_arr", True)
    db_session.commit()
    assert "sub_arr" in done

    # Unmark completed
    done = update_leaf_completion(db_session, sample_syllabus, "sub_arr", False)
    db_session.commit()
    assert "sub_arr" not in done
    assert get_completed_leaf_ids(db_session, sample_syllabus.id) == set()


def test_update_leaf_rejects_invalid_id(db_session, sample_syllabus):
    """Verify attempting to complete a non-existent leaf raises InvalidLeafError."""
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    with pytest.raises(InvalidLeafError):
        update_leaf_completion(db_session, sample_syllabus, "non_existent_id", True)

    # Parent node ID cannot be submitted as leaf
    with pytest.raises(InvalidLeafError):
        update_leaf_completion(db_session, sample_syllabus, "top_algo", True)


def test_update_bulk_completion(db_session, sample_syllabus):
    """Verify bulk completion of target leaves."""
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    targets = {"sub_arr", "sub_stack"}
    done = update_bulk_completion(db_session, sample_syllabus, targets, True)
    db_session.commit()
    assert targets.issubset(done)

    # Uncheck bulk
    done = update_bulk_completion(db_session, sample_syllabus, {"sub_arr"}, False)
    db_session.commit()
    assert "sub_arr" not in done
    assert "sub_stack" in done


def test_rename_and_delete_syllabus(db_session, sample_syllabus):
    """Verify renaming a syllabus and cascade deletion."""
    save_syllabus(db_session, sample_syllabus)
    update_leaf_completion(db_session, sample_syllabus, "sub_arr", True)
    db_session.commit()

    # Rename
    update_syllabus_title(db_session, sample_syllabus.id, "Updated Title")
    db_session.commit()
    rec = get_syllabus_record(db_session, sample_syllabus.id)
    assert rec.title == "Updated Title"

    # Delete
    delete_syllabus(db_session, sample_syllabus.id)
    db_session.commit()

    # Verify syllabus is gone
    assert get_syllabus_record(db_session, sample_syllabus.id) is None
    # Verify leaf completions are cascade deleted
    completions = db_session.scalars(
        select(LeafCompletionRecord).where(LeafCompletionRecord.syllabus_id == sample_syllabus.id)
    ).all()
    assert len(completions) == 0
