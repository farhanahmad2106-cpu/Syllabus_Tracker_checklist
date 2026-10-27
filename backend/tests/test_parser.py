"""Automated tests for document parser."""

import io
import pytest
from unittest.mock import MagicMock
try:
    from docx import Document as DocxDocument  # type: ignore[import-not-found,import-untyped]
except ImportError:  # pragma: no cover
    DocxDocument = None  # type: ignore

try:
    from pypdf import PdfWriter  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover
    PdfWriter = None  # type: ignore

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
        validate_file_metadata("huge.pdf", settings.MAX_UPLOAD_SIZE_BYTES + 1024)


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
    """Verify PDF creation and parsing with 1-based page numbers from actual extractable text."""
    pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n"
        b"4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
        b"5 0 obj<</Length 44>>stream\n"
        b"BT /F1 12 Tf 100 700 Td (Syllabus: Computer Science 101) Tj ET\n"
        b"endstream\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f \n"
        b"0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \n0000000213 00000 n \n0000000281 00000 n \n"
        b"trailer<</Size 6/Root 1 0 R>>\nstartxref\n376\n%%EOF\n"
    )
    parsed = parse_uploaded_file(pdf_bytes, "cs101.pdf")
    assert "Syllabus: Computer Science 101" in parsed.text
    assert parsed.has_reliable_pages is True
    assert len(parsed.pages) == 1
    assert parsed.pages[0][0] == 1


def test_parse_pdf_blank_raises_error():
    """Verify blank PDF without extractable text raises DocumentParserError."""
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_blank_page(width=100, height=100)

    pdf_bytes_io = io.BytesIO()
    writer.write(pdf_bytes_io)
    pdf_bytes = pdf_bytes_io.getvalue()

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
    """Verify parse_with_docling_if_available catches WinError 1450 and returns None safely."""
    import sys
    import types
    monkeypatch.setattr(settings, "ENABLE_DOCLING_FALLBACK", True)

    class MockFailingConverter:
        def convert(self, *args, **kwargs):
            raise OSError(1450, "Insufficient system resources exist to complete the requested service")

    mock_mod = types.ModuleType("docling.document_converter")
    mock_mod.DocumentConverter = MockFailingConverter
    monkeypatch.setitem(sys.modules, "docling.document_converter", mock_mod)

    result = parse_with_docling_if_available("dummy.pdf", "scanned.pdf")
    assert result is None

    # And verify parse_uploaded_file raises DocumentParserError when docling returns None
    monkeypatch.setattr("backend.app.parser.parse_pdf_pypdf", lambda *args, **kwargs: None)
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    buf = io.BytesIO()
    writer.write(buf)

    with pytest.raises(DocumentParserError, match="no extractable text and appears to be a scanned image"):
        parse_uploaded_file(buf.getvalue(), "scanned.pdf")


def test_encrypted_pdf_raises_validation_error(monkeypatch):
    """Verify encrypted or password-protected PDF raises FileValidationError."""
    mock_reader = MagicMock()
    mock_reader.is_encrypted = True
    monkeypatch.setattr("backend.app.parser.PdfReader", lambda *a, **k: mock_reader)

    with pytest.raises(FileValidationError, match="encrypted or password-protected"):
        parse_uploaded_file(b"%PDF-1.4 dummy", "locked.pdf")


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


def test_clean_extracted_syllabus_text_boilerplate_and_page_numbers():
    """Verify clean_extracted_syllabus_text strips boilerplate and page numbers while preserving legitimate content."""
    from backend.app.parser import clean_extracted_syllabus_text

    raw = """
Department of Computer Science & Engineering
Unit syllabus detailed learning outcomes and lab exercises.
Page 1 of 24
Module 1: Advanced Algorithms
Unit 1.1: Asymptotic Analysis and Divide-and-Conquer
Page 2 of 24
Unit syllabus detailed learning outcomes and lab exercises.
Module 2: Graph Theory
- 3 -
Unit 2.1: Minimum Spanning Trees and Shortest Paths
    """

    cleaned = clean_extracted_syllabus_text(raw)
    assert "Unit syllabus detailed learning outcomes" not in cleaned
    assert "Page 1 of 24" not in cleaned
    assert "Page 2 of 24" not in cleaned
    assert "- 3 -" not in cleaned
    # Verify legitimate content is strictly preserved
    assert "Module 1: Advanced Algorithms" in cleaned
    assert "Unit 1.1: Asymptotic Analysis and Divide-and-Conquer" in cleaned
    assert "Module 2: Graph Theory" in cleaned
    assert "Unit 2.1: Minimum Spanning Trees and Shortest Paths" in cleaned


def test_remove_running_headers_and_footers_multi_page():
    """Verify repeated running headers and footers appearing across pages are pruned safely."""
    from backend.app.parser import remove_running_headers_and_footers

    pages = [
        "Jawaharlal Nehru Technological University\nB.Tech Computer Science Syllabus 2024\nSemester 1 Subjects:\nMathematics I",
        "Jawaharlal Nehru Technological University\nB.Tech Computer Science Syllabus 2024\nSemester 1 Subjects:\nPhysics",
        "Jawaharlal Nehru Technological University\nB.Tech Computer Science Syllabus 2024\nSemester 2 Subjects:\nData Structures",
    ]

    cleaned_pages = remove_running_headers_and_footers(pages)
    for p in cleaned_pages:
        assert "Jawaharlal Nehru Technological University" not in p
        assert "B.Tech Computer Science Syllabus 2024" not in p
    assert "Mathematics I" in cleaned_pages[0]
    assert "Physics" in cleaned_pages[1]
    assert "Data Structures" in cleaned_pages[2]

