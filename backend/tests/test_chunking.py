"""Unit tests for semantic chunking, sequential extraction with progress, and deterministic merging."""

import pytest
from backend.app.parser import ParsedDocument
from backend.app.schemas import (
    ExtractedCurriculum,
    ExtractedSemester,
    ExtractedSubtopic,
    ExtractedTopic,
    ExtractedYear,
)
from backend.app.services.chunking import (
    CHUNK_CHAR_THRESHOLD,
    detect_semantic_chunks,
    merge_extracted_curricula,
    process_chunks_with_progress,
)


def test_detect_semantic_chunks_small_document():
    """Verify small document under threshold returns 1 single chunk."""
    doc = ParsedDocument(
        text="Introduction to CS\nSemester 1\n- Algorithms",
        pages=[(1, "Introduction to CS\nSemester 1\n- Algorithms")],
        has_reliable_pages=True,
        source_filename="intro.txt",
    )
    chunks = detect_semantic_chunks(doc)
    assert len(chunks) == 1
    assert chunks[0].chunk_index == 1
    assert chunks[0].total_chunks == 1


def test_detect_semantic_chunks_multi_semester():
    """Verify multi-semester document exceeding threshold splits into semantic chunks."""
    # Build text > 15,000 chars with Semester headings
    sem1 = "SEMESTER I: Core Computing\n" + ("Introductory programming content and variables.\n" * 200)
    sem2 = "SEMESTER II: Advanced Computing\n" + ("Data structures, trees, and hash maps.\n" * 200)
    full_text = sem1 + "\n\n" + sem2

    assert len(full_text) > CHUNK_CHAR_THRESHOLD

    doc = ParsedDocument(
        text=full_text,
        pages=[(1, sem1), (2, sem2)],
        has_reliable_pages=True,
        source_filename="full_curriculum.txt",
    )
    chunks = detect_semantic_chunks(doc)
    assert len(chunks) >= 2
    assert "SEMESTER I" in chunks[0].text or "Core Computing" in chunks[0].title
    assert "SEMESTER II" in chunks[1].text or "Advanced Computing" in chunks[1].title


def test_merge_extracted_curricula():
    """Verify merging distinct chunk results into unified ExtractedCurriculum."""
    chunk1 = ExtractedCurriculum(
        program_title="Bachelor of Computer Science",
        years=[
            ExtractedYear(
                title="Year 1",
                year_number=1,
                semesters=[
                    ExtractedSemester(
                        title="Semester 1",
                        semester_number=1,
                        topics=[
                            ExtractedTopic(
                                title="Programming 101",
                                subtopics=[
                                    ExtractedSubtopic(title="Variables", source_text="Variables snippet")
                                ],
                            )
                        ],
                    )
                ],
            )
        ],
    )

    chunk2 = ExtractedCurriculum(
        program_title="Bachelor of Computer Science",
        years=[
            ExtractedYear(
                title="Year 1",
                year_number=1,
                semesters=[
                    ExtractedSemester(
                        title="Semester 2",
                        semester_number=2,
                        topics=[
                            ExtractedTopic(
                                title="Data Structures",
                                subtopics=[
                                    ExtractedSubtopic(title="Trees", source_text="Trees snippet")
                                ],
                            )
                        ],
                    )
                ],
            )
        ],
    )

    merged = merge_extracted_curricula([chunk1, chunk2])
    assert merged.program_title == "Bachelor of Computer Science"
    assert len(merged.years) == 1
    assert len(merged.years[0].semesters) == 2
    assert merged.years[0].semesters[0].title == "Semester 1"
    assert merged.years[0].semesters[1].title == "Semester 2"


def test_process_chunks_with_progress_monotonic():
    """Verify progress callbacks emit monotonic percentages from 40% to 85%."""
    doc = ParsedDocument(
        text="Introduction\nSemester 1\n- Arrays\n- Pointers",
        pages=[(1, "Introduction\nSemester 1\n- Arrays\n- Pointers")],
        has_reliable_pages=True,
        source_filename="test.txt",
    )
    chunks = detect_semantic_chunks(doc)
    recorded_progress = []

    def on_prog(pct: int, msg: str):
        recorded_progress.append(pct)

    from backend.app.extractor import extract_curriculum_rule_based

    merged = process_chunks_with_progress(
        chunks=chunks,
        source_filename="test.txt",
        on_progress=on_prog,
        allow_fallback=True,
        extract_fn=extract_curriculum_rule_based,
    )
    assert len(recorded_progress) > 0
    # Verify monotonicity
    for i in range(1, len(recorded_progress)):
        assert recorded_progress[i] >= recorded_progress[i - 1]
    assert recorded_progress[-1] >= 85
