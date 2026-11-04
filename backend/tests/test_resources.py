"""Integration tests for Learning Resources & Lecture Bookmarks API endpoints and validation."""

import pytest
from sqlalchemy import select

from backend.app.database import delete_syllabus, save_syllabus
from backend.app.models import TopicResource
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)
from backend.app.progress import calculate_syllabus_progress


@pytest.fixture
def sample_syllabus() -> HierarchicalSyllabus:
    return HierarchicalSyllabus(
        id="syl_res_test",
        title="Resources Test Syllabus",
        source_filename="resources_test.pdf",
        schema_version=2,
        years=[
            AcademicYear(
                id="yr_1",
                title="Year 1",
                order_index=0,
                semesters=[
                    Semester(
                        id="sem_1",
                        title="Semester 1",
                        order_index=0,
                        subjects=[
                            Subject(
                                id="subj_algo",
                                title="Algorithms",
                                is_enrolled=True,
                                enrollment_status="mandatory",
                                modules=[
                                    Module(
                                        id="mod_sorting",
                                        title="Sorting Algorithms",
                                        contact_hours=12,
                                        topics=[
                                            Subtopic(
                                                id="top_quicksort",
                                                title="QuickSort",
                                                source_text="Quicksort partition algorithm",
                                            )
                                        ],
                                    )
                                ],
                            )
                        ],
                    )
                ],
            )
        ],
    )


def test_resource_crud_subtopic_and_module(client, db_session, sample_syllabus):
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    # 1. Add resource to subtopic (leaf)
    res_subtopic = {
        "node_id": "top_quicksort",
        "node_type": "subtopic",
        "title": "MIT OCW QuickSort Lecture",
        "url": "https://www.youtube.com/watch?v=COk73CPpwcg",
        "resource_type": "link",  # should auto-detect to youtube
    }
    resp = client.post(f"/api/syllabus/{sample_syllabus.id}/resources", json=res_subtopic)
    assert resp.status_code == 201
    data = resp.json()
    assert data["node_id"] == "top_quicksort"
    assert data["resource_type"] == "youtube"
    assert data["id"] is not None
    res1_id = data["id"]

    # 2. Add resource to module
    res_module = {
        "node_id": "mod_sorting",
        "node_type": "module",
        "title": "Sorting Algorithms Visualizer",
        "url": "https://github.com/algorithms/visualizer",
        "resource_type": "link",  # should auto-detect to github
    }
    resp = client.post(f"/api/syllabus/{sample_syllabus.id}/resources", json=res_module)
    assert resp.status_code == 201
    data = resp.json()
    assert data["node_id"] == "mod_sorting"
    assert data["resource_type"] == "github"
    res2_id = data["id"]

    # 3. Add regular doc resource with explicit type
    res_doc = {
        "node_id": "top_quicksort",
        "node_type": "subtopic",
        "title": "GeeksforGeeks QuickSort Docs",
        "url": "https://www.geeksforgeeks.org/quick-sort-algorithm/",
        "resource_type": "documentation",
    }
    resp = client.post(f"/api/syllabus/{sample_syllabus.id}/resources", json=res_doc)
    assert resp.status_code == 201
    assert resp.json()["resource_type"] == "documentation"
    res3_id = resp.json()["id"]

    # 4. List all resources
    resp = client.get(f"/api/syllabus/{sample_syllabus.id}/resources")
    assert resp.status_code == 200
    all_res = resp.json()
    assert len(all_res) == 3

    # 5. Filter resources by node_id
    resp = client.get(f"/api/syllabus/{sample_syllabus.id}/resources?node_id=top_quicksort")
    assert resp.status_code == 200
    sub_res = resp.json()
    assert len(sub_res) == 2
    assert all(r["node_id"] == "top_quicksort" for r in sub_res)

    # 6. Filter resources by node_type
    resp = client.get(f"/api/syllabus/{sample_syllabus.id}/resources?node_type=module")
    assert resp.status_code == 200
    mod_res = resp.json()
    assert len(mod_res) == 1
    assert mod_res[0]["node_id"] == "mod_sorting"

    # 7. Delete resource
    resp = client.delete(f"/api/syllabus/{sample_syllabus.id}/resources/{res1_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"

    # Verify deletion
    resp = client.get(f"/api/syllabus/{sample_syllabus.id}/resources?node_id=top_quicksort")
    assert len(resp.json()) == 1


def test_resource_url_safety_and_validation(client, db_session, sample_syllabus):
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    # Reject javascript: pseudo-protocol (XSS prevention)
    resp = client.post(
        f"/api/syllabus/{sample_syllabus.id}/resources",
        json={
            "node_id": "top_quicksort",
            "node_type": "subtopic",
            "title": "Malicious Script",
            "url": "javascript:alert('XSS')",
        },
    )
    assert resp.status_code == 422

    # Reject data: URLs
    resp = client.post(
        f"/api/syllabus/{sample_syllabus.id}/resources",
        json={
            "node_id": "top_quicksort",
            "node_type": "subtopic",
            "title": "Data URI",
            "url": "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        },
    )
    assert resp.status_code == 422

    # Reject credentials in URL
    resp = client.post(
        f"/api/syllabus/{sample_syllabus.id}/resources",
        json={
            "node_id": "top_quicksort",
            "node_type": "subtopic",
            "title": "URL with credentials",
            "url": "https://admin:secret@malicious.com/api",
        },
    )
    assert resp.status_code == 422

    # Reject non-existent node
    resp = client.post(
        f"/api/syllabus/{sample_syllabus.id}/resources",
        json={
            "node_id": "invalid_node",
            "node_type": "subtopic",
            "title": "Valid title",
            "url": "https://example.com",
        },
    )
    assert resp.status_code == 404

    # Delete non-existent resource
    resp = client.delete(f"/api/syllabus/{sample_syllabus.id}/resources/999999")
    assert resp.status_code == 404


def test_resource_cascade_deletion(client, db_session, sample_syllabus):
    save_syllabus(db_session, sample_syllabus)
    db_session.commit()

    client.post(
        f"/api/syllabus/{sample_syllabus.id}/resources",
        json={
            "node_id": "top_quicksort",
            "node_type": "subtopic",
            "title": "Resource for cascade test",
            "url": "https://example.com/cascade",
        },
    )

    resources = db_session.scalars(
        select(TopicResource).where(TopicResource.syllabus_id == sample_syllabus.id)
    ).all()
    assert len(resources) == 1

    delete_syllabus(db_session, sample_syllabus.id)
    db_session.commit()

    resources_after = db_session.scalars(
        select(TopicResource).where(TopicResource.syllabus_id == sample_syllabus.id)
    ).all()
    assert len(resources_after) == 0
