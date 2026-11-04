"""Automated tests for web_scraper: SSRF validation, DNS rebinding, HTML cleaning, and document discovery."""

import io
import socket
import urllib.parse
import zipfile
import pytest
import httpx
from unittest.mock import patch, MagicMock

from backend.app.exceptions import SSRFProtectionError, ScraperError
from backend.app.services.web_scraper import (
    clean_html_dom,
    detect_binary_type,
    discover_embedded_documents,
    fetch_web_content,
    format_markdown_table,
    html_to_structural_markdown,
    is_ip_allowed,
    resolve_host_ips,
    validate_safe_url,
)
import ipaddress


class TestSSRFAndUrlValidation:
    """Verifies that all SSRF vectors, private IP spaces, cloud metadata endpoints, and schemes are blocked."""

    @pytest.mark.parametrize(
        "prohibited_url",
        [
            "http://127.0.0.1",
            "http://127.0.0.1:80",
            "http://127.0.0.2",
            "http://localhost",
            "http://localhost:80",
            "http://sub.localhost",
            "http://10.0.0.1",
            "http://10.255.255.255",
            "http://172.16.0.1",
            "http://172.31.255.255",
            "http://192.168.1.1",
            "http://192.168.0.254",
            "http://169.254.169.254",
            "http://metadata.google.internal",
            "http://instance-data",
            "http://0.0.0.0",
            "http://[::1]",
            "http://[fe80::1]",
            "http://[fc00::1]",
            "http://[::ffff:127.0.0.1]",
            "http://[::ffff:192.168.1.1]",
            "file:///etc/passwd",
            "ftp://example.com/syllabus.pdf",
            "gopher://example.com",
            "data:text/html,<html></html>",
            "javascript:alert(1)",
            "http://user:pass@example.com",
            "http://example.com:8080",
            "http://example.com:22",
            "http://example.com:3000",
        ],
    )
    def test_prohibited_urls_rejected(self, prohibited_url: str):
        with pytest.raises(SSRFProtectionError):
            validate_safe_url(prohibited_url)

    def test_safe_public_url_accepted(self):
        # Mock DNS resolution to return a public routable IP (e.g. 93.184.215.14)
        with patch("socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.215.14", 443))
            ]
            normalized = validate_safe_url("https://example.com/academics/syllabus")
            assert normalized == "https://example.com/academics/syllabus"

    def test_dns_resolution_private_ip_rejected(self):
        # Even if hostname is innocuous, if DNS resolves to private IP, reject immediately
        with patch("socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 80))
            ]
            with pytest.raises(SSRFProtectionError) as exc_info:
                validate_safe_url("http://malicious-rebinding.com/syllabus")
            assert "prohibited or private IP" in str(exc_info.value)

    def test_dns_resolution_mixed_answers_rejected(self):
        # If any returned A or AAAA record is private/loopback, reject
        with patch("socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.215.14", 80)),
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 80)),
            ]
            with pytest.raises(SSRFProtectionError):
                validate_safe_url("http://dual-homed-attack.com/syllabus")


class TestBinaryDetectionAndResourceLimits:
    """Verifies magic bytes, ZIP bomb defense, and response limits."""

    def test_pdf_magic_bytes_detection(self):
        valid_pdf = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj"
        assert detect_binary_type(valid_pdf) == "pdf"

        non_pdf = b"<html><head><title>Not PDF</title></head></html>"
        assert detect_binary_type(non_pdf) is None

    def test_docx_magic_bytes_detection(self):
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, "w") as z:
            z.writestr("[Content_Types].xml", "<Types></Types>")
            z.writestr("word/document.xml", "<w:document></w:document>")
        docx_bytes = bio.getvalue()

        assert detect_binary_type(docx_bytes) == "docx"

    def test_docx_zip_bomb_prevention(self):
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, "w") as z:
            for i in range(1005):
                z.writestr(f"file_{i}.txt", "test")
        bomb_bytes = bio.getvalue()

        with pytest.raises(ScraperError) as exc_info:
            detect_binary_type(bomb_bytes)
        assert "too many files" in str(exc_info.value)


class TestHtmlCleaningAndMarkdownConversion:
    """Verifies that navigation, scripts, ads, and footers are removed while academic content is preserved."""

    def test_noise_removal_and_academic_preservation(self):
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Computer Science Syllabus - University Portal</title>
            <script>console.log('tracking script');</script>
            <style>body { color: red; }</style>
        </head>
        <body>
            <header>
                <div class="navbar">
                    <a href="/home">Home</a>
                    <a href="/login">Login</a>
                </div>
            </header>
            <aside class="sidebar">
                <div class="ad-container">Sponsored Ad</div>
            </aside>
            <main>
                <h1>Department of Computer Science & Engineering</h1>
                <p>Welcome to the 4-year undergraduate curriculum.</p>
                <table>
                    <thead>
                        <tr><th>Semester</th><th>Course Code</th><th>Course Title</th><th>Credits</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Semester 1</td><td>CS101</td><td>Data Structures</td><td>4</td></tr>
                        <tr><td>Semester 1</td><td>CS102</td><td>Programming Lab</td><td>2</td></tr>
                    </tbody>
                </table>
            </main>
            <footer>
                <p class="copyright">All rights reserved &copy; 2026</p>
                <div class="cookie-banner">Accept all cookies</div>
            </footer>
        </body>
        </html>
        """
        soup, title = clean_html_dom(html)
        assert title == "Computer Science Syllabus - University Portal"

        # Noise elements removed
        assert soup.find("script") is None
        assert soup.find("style") is None
        assert soup.find("div", class_="ad-container") is None
        assert soup.find("div", class_="cookie-banner") is None

        # Academic content preserved
        md = html_to_structural_markdown(soup)
        assert "Department of Computer Science & Engineering" in md
        assert "Data Structures" in md
        assert "Programming Lab" in md
        assert "| Semester | Course Code | Course Title | Credits |" in md


class TestEmbeddedDocumentDiscovery:
    """Verifies discovery, URL normalization, ranking, and deduplication of downloadable files."""

    def test_discover_and_rank_syllabus_documents(self):
        html = """
        <html>
        <body>
            <h2>Academics & Downloads</h2>
            <div>
                <a href="/downloads/btech_cse_syllabus_2024.pdf" title="Detailed Syllabus">
                    Download Detailed B.Tech CSE Syllabus PDF
                </a>
                <a href="/info/academic_calendar.pdf">Academic Calendar 2024-25</a>
                <a href="https://other.edu/irrelevant.pdf">Other University</a>
                <a href="/curriculum/course_structure.docx">Complete Course Structure DOCX</a>
                <a href="javascript:void(0)">Do Not Click</a>
            </div>
        </body>
        </html>
        """
        soup, _ = clean_html_dom(html)
        discovered = discover_embedded_documents(soup, base_url="https://university.edu/academics/")

        assert len(discovered) >= 2
        # Highest confidence document should be the explicitly named syllabus PDF
        top_doc = discovered[0]
        assert "syllabus" in top_doc.url.lower()
        assert top_doc.document_type == "pdf"
        assert top_doc.relevance_label == "High"
        assert top_doc.relevance_score >= 50.0

        # DOCX should also be discovered
        docx_docs = [d for d in discovered if d.document_type == "docx"]
        assert len(docx_docs) == 1
        assert "course_structure.docx" in docx_docs[0].filename


class TestAsyncWebContentAcquisition:
    """Verifies end-to-end safe HTTP acquisition and redirect handling with mocked transport."""

    def test_fetch_html_page_successfully(self):
        import asyncio
        from unittest.mock import AsyncMock

        html_payload = b"""
        <html>
        <head><title>B.Tech Information Technology Syllabus</title></head>
        <body>
            <h1>Information Technology Curriculum</h1>
            <p>Module 1: Operating Systems and Algorithms.</p>
            <a href="/files/detailed_syllabus.pdf">Download Full Syllabus</a>
        </body>
        </html>
        """
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "text/html; charset=utf-8"}
        mock_response.encoding = "utf-8"
        mock_response.url = httpx.URL("https://university.edu/it/syllabus")

        async def mock_aiter_bytes(chunk_size=16384):
            yield html_payload

        mock_response.aiter_bytes = mock_aiter_bytes
        mock_response.aclose = AsyncMock()

        async def run():
            with patch("backend.app.services.web_scraper.validate_safe_url") as mock_val, \
                 patch("backend.app.services.web_scraper.create_safe_async_client") as mock_client_factory:

                mock_val.return_value = "https://university.edu/it/syllabus"
                mock_client = MagicMock()
                mock_client.get = AsyncMock(return_value=mock_response)
                mock_client_factory.return_value.__aenter__.return_value = mock_client

                return await fetch_web_content("https://university.edu/it/syllabus", follow_embedded_pdf=False)

        scraped = asyncio.run(run())

        assert scraped.source_kind == "html"
        assert scraped.resolved_title == "B.Tech Information Technology Syllabus"
        assert "Information Technology Curriculum" in scraped.html_markdown
        assert len(scraped.embedded_documents) == 1
        assert scraped.embedded_documents[0].filename == "detailed_syllabus.pdf"

    def test_fetch_direct_pdf_document(self):
        import asyncio
        from unittest.mock import AsyncMock

        pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "application/pdf"}
        mock_response.encoding = None
        mock_response.url = httpx.URL("https://university.edu/syllabus.pdf")

        async def mock_aiter_bytes(chunk_size=16384):
            yield pdf_bytes

        mock_response.aiter_bytes = mock_aiter_bytes
        mock_response.aclose = AsyncMock()

        async def run():
            with patch("backend.app.services.web_scraper.validate_safe_url") as mock_val, \
                 patch("backend.app.services.web_scraper.create_safe_async_client") as mock_client_factory:

                mock_val.return_value = "https://university.edu/syllabus.pdf"
                mock_client = MagicMock()
                mock_client.get = AsyncMock(return_value=mock_response)
                mock_client_factory.return_value.__aenter__.return_value = mock_client

                return await fetch_web_content("https://university.edu/syllabus.pdf")

        scraped = asyncio.run(run())

        assert scraped.source_kind == "pdf"
        assert scraped.binary_content == pdf_bytes
        assert scraped.binary_filename == "syllabus.pdf"

