"""Document parsing and layout extraction supporting PDF, DOCX, and TXT."""

import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

from pypdf import PdfReader
from docx import Document as DocxDocument

from backend.app.config import settings
from backend.app.exceptions import DocumentParserError, FileValidationError

# Allowed extensions
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


@dataclass
class ParsedDocument:
    """Normalized document representation containing extracted text and page mapping."""
    text: str
    pages: List[Tuple[Optional[int], str]] = field(default_factory=list)
    has_reliable_pages: bool = False
    source_filename: str = ""
    warnings: List[str] = field(default_factory=list)


def validate_file_metadata(filename: str, file_size: int) -> str:
    """Validate filename extension and enforce maximum size constraint."""
    if not filename:
        raise FileValidationError("Upload filename is missing or empty.")

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise FileValidationError(
            f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    if file_size <= 0:
        raise FileValidationError("Uploaded file is empty (0 bytes).")

    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
        raise FileValidationError(f"File exceeds maximum allowed size of {max_mb:.0f} MiB.")

    return ext


def parse_txt_content(content_bytes: bytes, filename: str) -> ParsedDocument:
    """Parse raw plain text with multiple encoding fallbacks."""
    text = ""
    for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        try:
            text = content_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if not text.strip():
        raise DocumentParserError(f"Plain text file '{filename}' contains no readable text.")

    # TXT files have no native page breaks
    return ParsedDocument(
        text=text,
        pages=[(None, text)],
        has_reliable_pages=False,
        source_filename=filename,
    )


def parse_pdf_pypdf(file_path: str, filename: str) -> ParsedDocument:
    """Fast, reliable, offline PDF parsing using pypdf preserving 1-based page numbers."""
    try:
        reader = PdfReader(file_path)
        pages: List[Tuple[Optional[int], str]] = []
        full_text_chunks: List[str] = []

        for idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            page_num = idx + 1
            pages.append((page_num, page_text))
            if page_text.strip():
                full_text_chunks.append(f"[Page {page_num}]\n{page_text}")

        full_text = "\n\n".join(full_text_chunks)
        if not full_text.strip():
            raise DocumentParserError(f"PDF '{filename}' contains no extractable text.")

        return ParsedDocument(
            text=full_text,
            pages=pages,
            has_reliable_pages=True,
            source_filename=filename,
        )
    except Exception as e:
        if isinstance(e, DocumentParserError):
            raise
        raise DocumentParserError(f"Failed to parse PDF '{filename}': {str(e)}") from e


def parse_docx_python_docx(file_path: str, filename: str) -> ParsedDocument:
    """Fast, offline DOCX parsing using python-docx extracting paragraphs and tables."""
    try:
        doc = DocxDocument(file_path)
        chunks: List[str] = []

        for para in doc.paragraphs:
            txt = para.text.strip()
            if txt:
                chunks.append(txt)

        for table in doc.tables:
            for row in table.rows:
                row_cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if row_cells:
                    chunks.append(" | ".join(row_cells))

        full_text = "\n\n".join(chunks)
        if not full_text.strip():
            raise DocumentParserError(f"DOCX '{filename}' contains no extractable text.")

        # DOCX doesn't have reliable fixed physical pages without layout engine
        return ParsedDocument(
            text=full_text,
            pages=[(None, full_text)],
            has_reliable_pages=False,
            source_filename=filename,
        )
    except Exception as e:
        if isinstance(e, DocumentParserError):
            raise
        raise DocumentParserError(f"Failed to parse DOCX '{filename}': {str(e)}") from e


def parse_with_docling_if_available(file_path: str, filename: str) -> Optional[ParsedDocument]:
    """Attempt parsing using Docling DocumentConverter if available without network models."""
    try:
        from docling.document_converter import DocumentConverter

        converter = DocumentConverter()
        result = converter.convert(file_path)
        if hasattr(result, "document"):
            md_text = result.document.export_to_markdown()
            if md_text and md_text.strip():
                is_pdf = filename.lower().endswith(".pdf")
                return ParsedDocument(
                    text=md_text,
                    pages=[(1 if is_pdf else None, md_text)],
                    has_reliable_pages=is_pdf,
                    source_filename=filename,
                )
    except Exception:
        # Fall back gracefully to native parser
        pass
    return None


def parse_uploaded_file(
    content_bytes: bytes,
    filename: str,
) -> ParsedDocument:
    """
    Main parser entrypoint. Validates file, creates a secure temporary file,
    extracts structured text with page boundaries, and safely cleans up temporary storage.
    """
    ext = validate_file_metadata(filename, len(content_bytes))

    # Fast path for plain text
    if ext == ".txt":
        return parse_txt_content(content_bytes, filename)

    # Secure temporary file for PDF and DOCX
    temp_dir = tempfile.gettempdir()
    temp_file = tempfile.NamedTemporaryFile(
        dir=temp_dir,
        suffix=ext,
        delete=False,
    )
    temp_path = temp_file.name

    try:
        temp_file.write(content_bytes)
        temp_file.flush()
        temp_file.close()

        # Try Docling first
        docling_result = parse_with_docling_if_available(temp_path, filename)
        if docling_result and docling_result.text.strip():
            return docling_result

        # Robust built-in parsers
        if ext == ".pdf":
            return parse_pdf_pypdf(temp_path, filename)
        elif ext == ".docx":
            return parse_docx_python_docx(temp_path, filename)
        else:
            raise FileValidationError(f"Unhandled file extension: {ext}")

    finally:
        # Ensure temporary file is always deleted
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
