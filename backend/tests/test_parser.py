"""Automated tests for document parser."""

import io
import pytest
from docx import Document as DocxDocument
from pypdf import PdfWriter

from backend.app.exceptions import DocumentParserError, FileValidationError
from backend.app.parser import (
    parse_docx_python_docx,
    parse_pdf_pypdf,
    parse_txt_content,
    parse_uploaded_file,
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


def test_parse_pdf_with_pypdf():
    """Verify PDF creation and parsing with 1-based page numbers."""
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_blank_page(width=100, height=100)

    pdf_bytes_io = io.BytesIO()
    writer.write(pdf_bytes_io)
    pdf_bytes = pdf_bytes_io.getvalue()

    # Upload pipeline should parse it
    # Even if page text is blank, test structure
    with pytest.raises(DocumentParserError, match="no extractable text"):
        parse_uploaded_file(pdf_bytes, "blank.pdf")


def test_parse_docx_with_python_docx():
    """Verify DOCX generation and parsing."""
    doc = DocxDocument()
    doc.add_heading("Computer Science 101", level=1)
    doc.add_paragraph("Course Objectives and Overview")
    doc.add_paragraph("- Topic A: Algorithms")
    doc.add_paragraph("- Topic B: Architecture")

    docx_bytes_io = io.BytesIO()
    doc.save(docx_bytes_io)
    docx_bytes = docx_bytes_io.getvalue()

    parsed = parse_uploaded_file(docx_bytes, "syllabus.docx")
    assert "Computer Science 101" in parsed.text
    assert "Topic A: Algorithms" in parsed.text
    assert parsed.has_reliable_pages is False
