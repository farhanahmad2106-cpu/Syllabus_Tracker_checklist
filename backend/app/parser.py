import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

from pypdf import PdfReader
from docx import Document as DocxDocument

from backend.app.config import settings
from backend.app.exceptions import DocumentParserError, FileValidationError

# Allowed extensions
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".doc"}


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


def find_libreoffice_executable() -> Optional[str]:
    """Find soffice or libreoffice executable in system PATH or standard locations."""
    for cmd in ["soffice", "libreoffice"]:
        path = shutil.which(cmd)
        if path:
            return path
    win_paths = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for p in win_paths:
        if os.path.exists(p):
            return p
    return None


def convert_doc_to_docx(doc_path: str, output_dir: str) -> str:
    """Convert legacy .doc file to .docx using headless LibreOffice."""
    soffice_path = find_libreoffice_executable()
    if not soffice_path:
        raise DocumentParserError(
            "LibreOffice / soffice is not installed or not found in PATH. "
            "Converting legacy .doc files requires LibreOffice. "
            "Please convert the file to .docx or install LibreOffice."
        )
    try:
        subprocess.run(
            [soffice_path, "--headless", "--convert-to", "docx", "--outdir", output_dir, doc_path],
            check=True,
            timeout=30,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        base_name = Path(doc_path).stem
        converted_docx = os.path.join(output_dir, f"{base_name}.docx")
        if not os.path.exists(converted_docx):
            raise DocumentParserError(f"LibreOffice conversion failed: {converted_docx} was not created.")
        return converted_docx
    except subprocess.TimeoutExpired:
        raise DocumentParserError("LibreOffice conversion timed out after 30 seconds.")
    except Exception as e:
        if isinstance(e, DocumentParserError):
            raise
        raise DocumentParserError(f"Failed to convert legacy .doc file: {str(e)}") from e


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

    temp_dir = tempfile.mkdtemp(prefix="syllabus_upload_")
    temp_path = os.path.join(temp_dir, f"staged{ext}")
    converted_docx_path: Optional[str] = None

    try:
        with open(temp_path, "wb") as f:
            f.write(content_bytes)

        # Handle legacy .doc conversion
        effective_path = temp_path
        effective_ext = ext
        if ext == ".doc":
            converted_docx_path = convert_doc_to_docx(temp_path, temp_dir)
            effective_path = converted_docx_path
            effective_ext = ".docx"

        # Try Docling first
        docling_result = parse_with_docling_if_available(effective_path, filename)
        if docling_result and docling_result.text.strip():
            return docling_result

        # Robust built-in parsers
        if effective_ext == ".pdf":
            return parse_pdf_pypdf(effective_path, filename)
        elif effective_ext == ".docx":
            return parse_docx_python_docx(effective_path, filename)
        else:
            raise FileValidationError(f"Unhandled file extension: {ext}")

    finally:
        # Guarantee cleanup of all temporary staged files and directory
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
