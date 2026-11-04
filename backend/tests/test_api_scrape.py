"""Integration and API tests for Option-C Web Scraper endpoints and background ingestion."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from backend.app.database import get_completed_leaf_ids, get_syllabus_record, init_db
from backend.app.models import SyllabusRecord
from backend.app.schemas import (
    AcademicYear,
    ExtractedCurriculum,
    ExtractedModule,
    ExtractedSemester,
    ExtractedSubject,
    ExtractedSubtopic,
    ExtractedYear,
    HierarchicalSyllabus,
    Module,
    Semester,
    Subject,
    Subtopic,
)
from backend.app.services.ingestion import process_web_ingestion_job
from backend.app.services.job_manager import job_manager
from backend.app.services.web_scraper import DiscoveredDocument, ScrapedContent


def make_mock_curriculum():
    return ExtractedCurriculum(
        program_title="B.Tech Computer Science Engineering",
        years=[
            ExtractedYear(
                title="Year 1",
                year_number=1,
                semesters=[
                    ExtractedSemester(
                        title="Semester 1",
                        semester_number=1,
                        subjects=[
                            ExtractedSubject(
                                title="Data Structures and Algorithms",
                                code="CS101",
                                is_lab=False,
                                is_elective=False,
                                modules=[
                                    ExtractedModule(
                                        title="Module 1: Linear Structures",
                                        contact_hours=10,
                                        topics=[
                                            ExtractedSubtopic(
                                                title="Arrays and Linked Lists",
                                                source_text="Arrays and Linked Lists",
                                            ),
                                            ExtractedSubtopic(
                                                title="Stacks and Queues",
                                                source_text="Stacks and Queues",
                                            ),
                                        ],
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )


class TestScrapePreviewEndpoint:
    """Verifies POST /api/scrape/preview read-only operation and SSRF defense."""

    def test_preview_html_success(self, client: TestClient, db_session: Session):
        mock_content = ScrapedContent(
            requested_url="https://university.edu/syllabus",
            final_url="https://university.edu/syllabus",
            resolved_title="B.Tech CSE Curriculum 2024",
            content_type="text/html",
            source_kind="html",
            html_markdown="# B.Tech Curriculum\nSemester 1: Arrays and Linked Lists",
            embedded_documents=[
                DiscoveredDocument(
                    url="https://university.edu/downloads/syllabus.pdf",
                    filename="syllabus.pdf",
                    document_type="pdf",
                    relevance_score=85.0,
                    relevance_label="High",
                    display_title="Detailed B.Tech Syllabus PDF",
                )
            ],
            warnings=[],
        )

        with patch("backend.app.main.fetch_web_content", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_content

            res = client.post(
                "/api/scrape/preview",
                json={"url": "https://university.edu/syllabus", "follow_embedded_pdf": False},
            )

            assert res.status_code == 200
            data = res.json()
            assert data["resolved_title"] == "B.Tech CSE Curriculum 2024"
            assert data["source_kind"] == "html"
            assert len(data["detected_embedded_files"]) == 1
            assert data["detected_embedded_files"][0]["filename"] == "syllabus.pdf"
            assert data["preview_token"] is not None

        # Confirm read-only: no records were created in database
        count = db_session.execute(text("SELECT count(*) FROM syllabi")).scalar()
        assert count == 0

    def test_preview_ssrf_rejection(self, client: TestClient):
        res = client.post(
            "/api/scrape/preview",
            json={"url": "http://127.0.0.1/admin"},
        )
        assert res.status_code == 400
        assert "prohibited" in res.json()["detail"].lower() or "blocked" in res.json()["detail"].lower()

    def test_preview_invalid_url_syntax(self, client: TestClient):
        res = client.post(
            "/api/scrape/preview",
            json={"url": "not-a-valid-url"},
        )
        assert res.status_code == 422


class TestScrapeIngestEndpointAndJob:
    """Verifies POST /api/scrape/ingest asynchronous job registration and worker execution."""

    def test_ingest_endpoint_registers_job_and_returns_202(self, client: TestClient):
        with patch("backend.app.main.validate_safe_url") as mock_val:
            mock_val.return_value = "https://university.edu/syllabus"

            res = client.post(
                "/api/scrape/ingest",
                json={
                    "url": "https://university.edu/syllabus",
                    "follow_embedded_pdf": True,
                    "custom_title": "Custom B.Tech IT Syllabus",
                },
            )

            assert res.status_code == 202
            data = res.json()
            assert "job_id" in data
            assert data["stage"] == "queued"
            assert data["percent"] == 0

            # Job is accessible in job manager
            job = job_manager.get(data["job_id"])
            assert job is not None

    def test_ingest_ssrf_rejection(self, client: TestClient):
        res = client.post(
            "/api/scrape/ingest",
            json={"url": "http://169.254.169.254/latest/meta-data/"},
        )
        assert res.status_code == 400

    def test_web_ingestion_job_worker_execution(self, db_session: Session):
        """Test full execution of process_web_ingestion_job with mocked fetch and extraction."""
        job = job_manager.create_job(initial_message="Starting web ingestion test.")
        job_id = job.job_id

        raw_md = (
            "# B.Tech Computer Science Engineering\n"
            "## Semester 1\n"
            "### Course: Data Structures and Algorithms (CS101)\n"
            "Module 1: Linear Structures\n"
            "Arrays and Linked Lists\n"
            "Stacks and Queues\n"
        )
        mock_content = ScrapedContent(
            requested_url="https://university.edu/curriculum",
            final_url="https://university.edu/curriculum",
            resolved_title="B.Tech Computer Science Engineering",
            content_type="text/html",
            source_kind="html",
            html_markdown=raw_md,
            raw_html=f"<html><body>{raw_md}</body></html>",
            warnings=[],
        )

        with patch("backend.app.services.ingestion.get_db_context") as mock_ctx, \
             patch("backend.app.services.web_scraper.fetch_web_content", new_callable=AsyncMock) as mock_fetch, \
             patch("backend.app.services.ingestion.extract_curriculum") as mock_extract:

            mock_ctx.return_value.__enter__.return_value = db_session
            mock_fetch.return_value = mock_content
            mock_extract.return_value = make_mock_curriculum()

            process_web_ingestion_job(
                job_id=job_id,
                url="https://university.edu/curriculum",
                follow_embedded_pdf=False,
                custom_title="B.Tech Computer Science Engineering",
            )

            # Check job terminal status
            final_job = job_manager.get(job_id)
            assert final_job is not None
            assert final_job.stage in ("completed", "awaiting_enrollment")
            assert final_job.percent == 100
            assert final_job.syllabus_id is not None

            # Verify persisted record in SQLite
            syl_id = final_job.syllabus_id
            rec = get_syllabus_record(db_session, syl_id)
            assert rec is not None
            assert rec.source_type == "url"
            assert rec.source_url == "https://university.edu/curriculum"
            assert rec.title == "B.Tech Computer Science Engineering"

            # Check completion leaf calculation
            completed = get_completed_leaf_ids(db_session, syl_id)
            assert len(completed) == 0  # starts at 0 completed


class TestDatabaseMigrationCompatibility:
    """Verifies that init_db() idempotently creates source_type and source_url columns."""

    def test_init_db_adds_source_columns_idempotently(self, test_engine):
        init_db(test_engine)

        with test_engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(syllabi)"))
            columns = {row[1]: row[2] for row in result.fetchall()}
            assert "source_type" in columns
            assert "source_url" in columns

        # Run init_db second time to test idempotency
        init_db(test_engine)
        with test_engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(syllabi)"))
            columns = {row[1]: row[2] for row in result.fetchall()}
            assert "source_type" in columns
            assert "source_url" in columns

