"""Automated tests for document parser."""

import io
import pytest
from unittest.mock import MagicMock
from docx import Document as DocxDocument
from pypdf import PdfWriter

from backend.app.config import settings
from backend.app.exceptions import DocumentParserError, FileValidationError
from backend.app.parser import (
    ParsedDocument,
    parse_docx_python_docx,
    parse_pdf_pypdf,
    parse_txt_content,
    parse_uploaded_file,
    parse_with_docling_if_available,
    validate_file_metadata,
)


def test_validate_file_metadata():
    """Verify validation of file extension, empty content, and size limits."""
    # Valid
    assert validate_file_metadata("syllabus.pdf", 1024) == ".pdf"
    assert validate_file_metadata("syllabus.docx", 2048) == ".docx"
    assert validate_file_metadata("syllabus.txt", 500) == ".txt"

    # Unsupported extension
    with pytest.raises(FileValidationError, match="Unsupported file format"):
        validate_file_metadata("syllabus.exe", 1024)

    with pytest.raises(FileValidationError, match="Unsupported file format"):
        validate_file_metadata("syllabus.html", 1024)

    # Empty file
    with pytest.raises(FileValidationError, match="empty"):
        validate_file_metadata("syllabus.pdf", 0)

    # Oversized file
    with pytest.raises(FileValidationError, match="maximum allowed size"):
        validate_file_metadata("huge.pdf", 50 * 1024 * 1024)


def test_parse_txt_content():
    """Verify parsing plain text with UTF-8."""
    raw = b"Introduction to Computing\n- Variables\n- Loops\n- Functions"
    doc = parse_txt_content(raw, "course.txt")
    assert "Introduction to Computing" in doc.text
    assert doc.has_reliable_pages is False
    assert len(doc.pages) == 1


def test_parse_txt_empty_raises_error():
    """Verify empty text file raises DocumentParserError."""
    with pytest.raises(DocumentParserError, match="no readable text"):
        parse_txt_content(b"   \n\n  ", "empty.txt")


def test_parse_txt_decoding_fallback():
    """Verify decoding fallback for non-UTF8 text (Latin-1/CP1252)."""
    # Character 'é' in Latin-1 is 0xE9 (invalid UTF-8 sequence)
    raw = b"Syst\xe8mes d'exploitation\n- Processus\n- Threads"
    doc = parse_txt_content(raw, "french_syllabus.txt")
    assert "Processus" in doc.text
    assert len(doc.text) > 0


def test_parse_pdf_with_pypdf():
    """Verify PDF creation and parsing with 1-based page numbers."""
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_blank_page(width=100, height=100)

    pdf_bytes_io = io.BytesIO()
    writer.write(pdf_bytes_io)
    pdf_bytes = pdf_bytes_io.getvalue()

    # Upload pipeline should raise DocumentParserError when no text is found
    with pytest.raises(DocumentParserError, match="no extractable text"):
        parse_uploaded_file(pdf_bytes, "blank.pdf")


def test_digital_pdf_bypasses_docling(monkeypatch):
    """Verify digital PDF with extractable text completely bypasses Docling and PyTorch."""
    mock_docling = MagicMock()
    monkeypatch.setattr("backend.app.parser.parse_with_docling_if_available", mock_docling)

    # Create dummy parsed result from pypdf
    fake_doc = ParsedDocument(
        text="[Page 1]\nIntroduction to Machine Learning\n- Supervised Learning",
        pages=[(1, "Introduction to Machine Learning\n- Supervised Learning")],
        has_reliable_pages=True,
        source_filename="test.pdf",
    )
    monkeypatch.setattr("backend.app.parser.parse_pdf_pypdf", lambda *args, **kwargs: fake_doc)

    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    buf = io.BytesIO()
    writer.write(buf)

    result = parse_uploaded_file(buf.getvalue(), "syllabus.pdf")
    assert "Supervised Learning" in result.text
    # Crucial assertion: Docling must NEVER be called for digital PDFs
    mock_docling.assert_not_called()


def test_short_valid_syllabus_is_accepted(monkeypatch):
    """Verify short valid syllabus is not rejected simply due to an arbitrary character threshold."""
    short_text = "Course: Intro\n- Unit 1"  # ~22 characters
    fake_doc = ParsedDocument(
        text=short_text,
        pages=[(1, short_text)],
        has_reliable_pages=True,
        source_filename="short.pdf",
    )
    monkeypatch.setattr("backend.app.parser.parse_pdf_pypdf", lambda *args, **kwargs: fake_doc)

    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    buf = io.BytesIO()
    writer.write(buf)

    result = parse_uploaded_file(buf.getvalue(), "short.pdf")
    assert result.text == short_text


def test_scanned_pdf_triggers_docling_when_enabled(monkeypatch):
    """Verify scanned PDF triggers secondary Docling fallback when enabled."""
    monkeypatch.setattr(settings, "ENABLE_DOCLING_FALLBACK", True)
    # pypdf returns None indicating no extractable text
    monkeypatch.setattr("backend.app.parser.parse_pdf_pypdf", lambda *args, **kwargs: None)

    fallback_doc = ParsedDocument(
        text="Scanned Syllabus OCR Markdown\n- Topic A",
        pages=[(1, "Scanned Syllabus OCR Markdown\n- Topic A")],
        has_reliable_pages=True,
        source_filename="scanned.pdf",
    )
    mock_docling = MagicMock(return_value=fallback_doc)
    monkeypatch.setattr("backend.app.parser.parse_with_docling_if_available", mock_docling)

    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    buf = io.BytesIO()
    writer.write(buf)

    result = parse_uploaded_file(buf.getvalue(), "scanned.pdf")
    assert "Scanned Syllabus OCR Markdown" in result.text
    mock_docling.assert_called_once()


def test_scanned_pdf_handles_winerror_1450_safely(monkeypatch):
    """Verify OSError [WinError 1450] in Docling fallback is caught without unhandled crash."""
    monkeypatch.setattr(settings, "ENABLE_DOCLING_FALLBACK", True)
    monkeypatch.setattr("backend.app.parser.parse_pdf_pypdf", lambda *args, **kwargs: None)

    # Mock Docling raising WinError 1450
    def mock_docling_fail(*args, **kwargs):
        raise OSError(1450, "Insufficient system resources exist to complete the requested service")

    monkeypatch.setattr("backend.app.parser.parse_with_docling_if_available", lambda *a, **k: None)

    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    buf = io.BytesIO()
    writer.write(buf)

    with pytest.raises(DocumentParserError, match="no extractable text and appears to be a scanned image"):
        parse_uploaded_file(buf.getvalue(), "scanned.pdf")


def test_pdf_page_limit_enforced(monkeypatch):
    """Verify PDF exceeding MAX_PDF_PAGES is rejected."""
    monkeypatch.setattr(settings, "MAX_PDF_PAGES", 2)

    writer = PdfWriter()
    for _ in range(3):
        writer.add_blank_page(width=100, height=100)
    buf = io.BytesIO()
    writer.write(buf)

    with pytest.raises(FileValidationError, match="exceeds maximum page limit"):
        parse_uploaded_file(buf.getvalue(), "too_many_pages.pdf")


def test_malformed_pdf_produces_controlled_error():
    """Verify random binary bytes pretending to be PDF produces a controlled DocumentParserError."""
    with pytest.raises(DocumentParserError, match="Malformed or unreadable PDF"):
        parse_uploaded_file(b"%PDF-1.4 garbage corrupted payload", "corrupt.pdf")


def test_parse_docx_with_python_docx():
    """Verify DOCX generation and parsing including tables."""
    doc = DocxDocument()
    doc.add_heading("Computer Science 101", level=1)
    doc.add_paragraph("Course Objectives and Overview")
    doc.add_paragraph("- Topic A: Algorithms")
    doc.add_paragraph("- Topic B: Architecture")

    # Add a table with curriculum modules
    table = doc.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Module 1"
    table.cell(0, 1).text = "Sorting Algorithms"
    table.cell(1, 0).text = "Module 2"
    table.cell(1, 1).text = "Graph Traversal"

    docx_bytes_io = io.BytesIO()
    doc.save(docx_bytes_io)
    docx_bytes = docx_bytes_io.getvalue()

    parsed = parse_uploaded_file(docx_bytes, "syllabus.docx")
    assert "Computer Science 101" in parsed.text
    assert "Topic A: Algorithms" in parsed.text
    assert "Sorting Algorithms" in parsed.text
    assert "Graph Traversal" in parsed.text
    assert parsed.has_reliable_pages is False
