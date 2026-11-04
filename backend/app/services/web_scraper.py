"""Secure Automated Web Scraping & University Portal Syllabus Ingestion Engine.

Provides:
- SSRF and DNS rebinding protection (IPv4, IPv6, special-use ranges, cloud metadata).
- Bounded, validated redirect loop (no protocol downgrades or loops).
- Resource-bounded streaming (10 MiB limit, timeouts, zip-bomb defense).
- Magic-byte / binary signature validation (PDF, DOCX).
- Semantic HTML cleaning and structural Markdown conversion.
- Embedded syllabus document discovery and deterministic ranking.
- Source provenance tracking for zero-hallucination verification.
"""

import ipaddress
import logging
import os
import re
import socket
import tempfile
import urllib.parse
import zipfile
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

import bs4
from bs4 import BeautifulSoup
import httpx
import httpcore
import httpcore._backends.anyio
from httpcore._backends.anyio import AnyIOBackend, AnyIOStream
from httpcore._exceptions import ConnectError, ConnectTimeout, map_exceptions

from backend.app.exceptions import SSRFProtectionError, ScraperError

logger = logging.getLogger(__name__)

# Constants and Security Limits
MAX_DOWNLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MiB per response
MAX_REDIRECTS = 5
DEFAULT_TIMEOUT_SECONDS = 15.0
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AcademicSyllabusScraper/1.0"
)

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443}

# Prohibited hostnames
PROHIBITED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
    "instance-data",
    "169.254.169.254",
}

# Explicit IPv4 private / reserved ranges
PROHIBITED_IPV4_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),         # Current network (RFC 1122)
    ipaddress.ip_network("10.0.0.0/8"),        # Private network (RFC 1918)
    ipaddress.ip_network("100.64.0.0/10"),     # Shared address space / CGNAT (RFC 6598)
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback (RFC 1122)
    ipaddress.ip_network("169.254.0.0/16"),    # Link-local / Cloud metadata (RFC 3927)
    ipaddress.ip_network("172.16.0.0/12"),     # Private network (RFC 1918)
    ipaddress.ip_network("192.0.0.0/24"),      # IETF protocol assignments (RFC 6890)
    ipaddress.ip_network("192.0.2.0/24"),      # TEST-NET-1 (RFC 5737)
    ipaddress.ip_network("192.168.0.0/16"),    # Private network (RFC 1918)
    ipaddress.ip_network("198.18.0.0/15"),     # Benchmarking (RFC 2544)
    ipaddress.ip_network("198.51.100.0/24"),   # TEST-NET-2 (RFC 5737)
    ipaddress.ip_network("203.0.113.0/24"),    # TEST-NET-3 (RFC 5737)
    ipaddress.ip_network("224.0.0.0/4"),       # Multicast (RFC 5771)
    ipaddress.ip_network("240.0.0.0/4"),       # Reserved for future use (RFC 1112)
    ipaddress.ip_network("255.255.255.255/32"),# Limited broadcast
]

# Explicit IPv6 private / reserved ranges
PROHIBITED_IPV6_NETWORKS = [
    ipaddress.ip_network("::1/128"),           # Loopback (RFC 4291)
    ipaddress.ip_network("::/128"),            # Unspecified (RFC 4291)
    ipaddress.ip_network("fc00::/7"),          # Unique local address (ULA, RFC 4193)
    ipaddress.ip_network("fe80::/10"),         # Link-local unicast (RFC 4291)
    ipaddress.ip_network("ff00::/8"),          # Multicast (RFC 4291)
    ipaddress.ip_network("2001:db8::/32"),     # Documentation (RFC 3849)
]

# Academic relevance keywords
CURRICULUM_KEYWORDS = [
    "syllabus",
    "curriculum",
    "scheme",
    "course structure",
    "course outcomes",
    "program structure",
    "semester",
    "module",
    "unit",
    "credits",
    "lecture hours",
    "practical hours",
    "laboratory",
    "elective",
    "core subject",
]


@dataclass
class DiscoveredDocument:
    """Discovered downloadable syllabus document."""
    url: str
    filename: str
    document_type: str  # 'pdf' or 'docx'
    relevance_score: float
    relevance_label: str  # 'High', 'Medium', 'Low'
    display_title: str


@dataclass
class ScrapedContent:
    """Normalized output from secure web acquisition."""
    requested_url: str
    final_url: str
    resolved_title: str
    content_type: str
    source_kind: str  # 'html', 'pdf', 'docx'
    html_markdown: str = ""
    raw_html: str = ""
    binary_content: Optional[bytes] = None
    binary_filename: Optional[str] = None
    embedded_documents: List[DiscoveredDocument] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    requires_document_selection: bool = False


def is_ip_allowed(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """
    Evaluate whether an IP address is a globally routable, non-private, non-loopback address.
    Explicitly checks IPv4-mapped IPv6 addresses against IPv4 prohibited subnets.
    """
    # 1. Check IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:192.168.1.1)
    if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped:
        return is_ip_allowed(ip_obj.ipv4_mapped)

    # 2. General standard checks
    if (
        ip_obj.is_loopback
        or ip_obj.is_private
        or ip_obj.is_link_local
        or ip_obj.is_reserved
        or ip_obj.is_multicast
        or ip_obj.is_unspecified
    ):
        return False

    # 3. Explicit IPv4 subnet checks
    if isinstance(ip_obj, ipaddress.IPv4Address):
        for net in PROHIBITED_IPV4_NETWORKS:
            if ip_obj in net:
                return False

    # 4. Explicit IPv6 subnet checks
    if isinstance(ip_obj, ipaddress.IPv6Address):
        for net in PROHIBITED_IPV6_NETWORKS:
            if ip_obj in net:
                return False

    return True


def resolve_host_ips(host: str, port: int) -> List[str]:
    """
    Resolve all A and AAAA DNS records for a host and port.
    Returns list of IP string representations.
    Raises SSRFProtectionError on lookup failure or if any resolved address is prohibited.
    """
    try:
        addrinfo = socket.getaddrinfo(host, port, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise SSRFProtectionError(f"DNS resolution failed for host '{host}': {e}") from e
    except Exception as e:
        raise SSRFProtectionError(f"Failed to resolve host '{host}': {e}") from e

    if not addrinfo:
        raise SSRFProtectionError(f"DNS lookup returned no addresses for host '{host}'.")

    resolved_ips: List[str] = []
    seen: Set[str] = set()

    for item in addrinfo:
        sockaddr = item[4]
        ip_str = sockaddr[0]
        if ip_str in seen:
            continue
        seen.add(ip_str)

        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError as e:
            raise SSRFProtectionError(f"Resolved address '{ip_str}' is not a valid IP: {e}") from e

        if not is_ip_allowed(ip_obj):
            raise SSRFProtectionError(
                f"Host '{host}' resolved to prohibited or private IP address '{ip_str}'."
            )

        resolved_ips.append(ip_str)

    return resolved_ips


def validate_safe_url(url: str) -> str:
    """
    Authoritative SSRF and URL validation:
    - Normalizes scheme and host.
    - Accepts only http:// and https://.
    - Rejects credentials (user:pass@host).
    - Restricts ports to 80 and 443 by default.
    - Rejects localhost and known prohibited hostnames.
    - Resolves all DNS records (A and AAAA) and rejects if any IP is prohibited.
    """
    if not url or not isinstance(url, str):
        raise SSRFProtectionError("URL must be a non-empty string.")

    cleaned_url = url.strip()
    parsed = urllib.parse.urlsplit(cleaned_url)

    # 1. Scheme validation
    scheme = parsed.scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise SSRFProtectionError(
            f"Unsupported URL scheme '{parsed.scheme}'. Only http:// and https:// are permitted."
        )

    # 2. Host validation
    host = parsed.hostname
    if not host:
        raise SSRFProtectionError("URL must contain a valid hostname.")

    host_lower = host.lower()

    # Reject credentials
    if parsed.username or parsed.password:
        raise SSRFProtectionError("URLs containing embedded credentials are prohibited.")

    # Reject prohibited hostnames
    if host_lower in PROHIBITED_HOSTNAMES or host_lower.endswith(".localhost"):
        raise SSRFProtectionError(f"Access to prohibited hostname '{host}' is blocked.")

    # 3. Port validation
    port = parsed.port
    if port is None:
        port = 443 if scheme == "https" else 80
    elif port not in ALLOWED_PORTS:
        raise SSRFProtectionError(f"Port {port} is not permitted. Only ports 80 and 443 are allowed.")

    # 4. Direct IP address check or DNS resolution
    try:
        direct_ip = ipaddress.ip_address(host_lower)
        if not is_ip_allowed(direct_ip):
            raise SSRFProtectionError(
                f"Direct access to prohibited IP address '{host_lower}' is blocked."
            )
    except ValueError:
        # Host is a domain name -> resolve DNS and validate all returned records
        resolve_host_ips(host_lower, port)

    # Return normalized URL
    normalized = urllib.parse.urlunsplit((
        scheme,
        f"{host_lower}:{port}" if (scheme == "http" and port != 80) or (scheme == "https" and port != 443) else host_lower,
        parsed.path or "/",
        parsed.query,
        parsed.fragment,
    ))
    return normalized


# --- Safe Network Transport for DNS Rebinding Defense ---

class SafeAnyIOBackend(AnyIOBackend):
    """
    Custom AnyIO network backend that enforces SSRF and DNS rebinding protection
    at the exact TCP connection moment.
    """

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: Optional[float] = None,
        local_address: Optional[str] = None,
        socket_options: Any = None,
    ) -> AnyIOStream:
        # Validate and resolve destination host right before connecting
        try:
            direct_ip = ipaddress.ip_address(host)
            if not is_ip_allowed(direct_ip):
                raise SSRFProtectionError(f"Connecting to prohibited IP address '{host}' is blocked.")
            connect_host = str(direct_ip)
        except ValueError:
            # Resolve DNS and verify all records
            valid_ips = resolve_host_ips(host, port)
            if not valid_ips:
                raise SSRFProtectionError(f"No valid public IP resolved for '{host}'.")
            # Connect directly to the validated IP to prevent DNS rebinding
            connect_host = valid_ips[0]

        return await super().connect_tcp(
            host=connect_host,
            port=port,
            timeout=timeout,
            local_address=local_address,
            socket_options=socket_options,
        )


def create_safe_async_client() -> httpx.AsyncClient:
    """
    Create an httpx.AsyncClient configured with safe backend, explicit timeouts,
    browser User-Agent, and disabled automatic redirects.
    """
    transport = httpx.AsyncHTTPTransport(
        verify=True,
    )
    # Inject our safe backend into httpcore's connection pool
    transport._pool._network_backend = SafeAnyIOBackend()

    client = httpx.AsyncClient(
        transport=transport,
        timeout=httpx.Timeout(DEFAULT_TIMEOUT_SECONDS),
        headers={
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,"
                "*/*;q=0.8"
            ),
        },
        follow_redirects=False,
    )
    return client


# --- Binary Magic Byte & Archive Validation ---

def detect_binary_type(content: bytes) -> Optional[str]:
    """
    Verify magic bytes for supported binary document formats:
    - PDF: starts with %PDF- (within first 1024 bytes)
    - DOCX: zip signature PK\x03\x04 and Office document XML structure
    """
    if not content:
        return None

    # Check PDF magic bytes
    if b"%PDF-" in content[:1024]:
        return "pdf"

    # Check DOCX (ZIP container)
    if content.startswith(b"PK\x03\x04"):
        try:
            import io
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                # Check for zip bomb: max 1000 files, max 50 MiB uncompressed size
                namelist = z.namelist()
                if len(namelist) > 1000:
                    raise ScraperError("DOCX archive contains too many files (possible decompression bomb).")
                total_uncompressed = sum(info.file_size for info in z.infolist())
                if total_uncompressed > 50 * 1024 * 1024:
                    raise ScraperError("DOCX archive exceeds maximum uncompressed size limit (50 MiB).")
                # Look for Word document structure
                if any(name.startswith("word/") or name == "[Content_Types].xml" for name in namelist):
                    return "docx"
        except zipfile.BadZipFile:
            return None

    return None


# --- Semantic HTML Cleaning and Structural Markdown Conversion ---

def clean_html_dom(html_content: str) -> Tuple[BeautifulSoup, str]:
    """
    Sanitize HTML DOM by removing navigational, promotional, and tracking elements
    while preserving academic headings, course tables, and curriculum lists.
    Returns (cleaned_soup, document_title).
    """
    try:
        soup = BeautifulSoup(html_content, "lxml")
    except Exception:
        soup = BeautifulSoup(html_content, "html.parser")

    # Extract title
    title = ""
    title_el = soup.find("title")
    if title_el and title_el.get_text(strip=True):
        title = title_el.get_text(strip=True)
    if not title:
        h1_el = soup.find("h1")
        if h1_el and h1_el.get_text(strip=True):
            title = h1_el.get_text(strip=True)

    # Tags to remove unconditionally
    unconditional_tags = [
        "script", "style", "noscript", "iframe", "svg", "canvas",
        "form", "button", "input", "select", "textarea",
    ]
    for tag_name in unconditional_tags:
        for el in soup.find_all(tag_name):
            el.decompose()

    # Structural tags to remove only if they don't contain core academic keywords
    structural_tags = ["nav", "header", "footer", "aside"]
    for tag_name in structural_tags:
        for el in soup.find_all(tag_name):
            text_lower = el.get_text().lower()
            if not any(k in text_lower for k in ["syllabus", "curriculum", "module", "course", "semester", "unit"]):
                el.decompose()

    # Noise class and id patterns
    noise_pattern = re.compile(
        r"(navbar|footer|sidebar|cookie|advertisement|ad-container|social-share|breadcrumb|popup|modal)",
        re.I,
    )
    for el in soup.find_all(attrs={"class": noise_pattern}):
        text_lower = el.get_text().lower()
        if not any(k in text_lower for k in ["syllabus", "curriculum", "module", "course", "semester", "unit"]):
            el.decompose()

    for el in soup.find_all(attrs={"id": noise_pattern}):
        text_lower = el.get_text().lower()
        if not any(k in text_lower for k in ["syllabus", "curriculum", "module", "course", "semester", "unit"]):
            el.decompose()

    return soup, title


def html_to_structural_markdown(soup: BeautifulSoup) -> str:
    """
    Convert sanitized BeautifulSoup DOM into well-structured Markdown,
    preserving tables, headings, and nested lists.
    """
    # Prefer main or article container if present
    content_root = (
        soup.find("main")
        or soup.find("article")
        or soup.find(attrs={"class": re.compile(r"(curriculum|syllabus|course-content|academic)", re.I)})
        or soup.find(attrs={"id": re.compile(r"(curriculum|syllabus|course-content|academic)", re.I)})
        or soup.body
        or soup
    )

    lines: List[str] = []

    def process_node(node: Any, depth: int = 0) -> None:
        if isinstance(node, bs4.element.NavigableString):
            txt = str(node).strip()
            if txt:
                lines.append(txt)
            return

        if not isinstance(node, bs4.element.Tag):
            return

        tag = node.name.lower()

        # Headings
        if tag in ["h1", "h2", "h3", "h4", "h5", "h6"]:
            level = int(tag[1])
            htxt = node.get_text(separator=" ", strip=True)
            if htxt:
                lines.append(f"\n{'#' * level} {htxt}\n")
            return

        # Tables
        if tag == "table":
            table_md = format_markdown_table(node)
            if table_md:
                lines.append(f"\n{table_md}\n")
            return

        # Lists
        if tag in ["ul", "ol"]:
            is_ordered = (tag == "ol")
            for idx, li in enumerate(node.find_all("li", recursive=False), start=1):
                li_text = li.get_text(separator=" ", strip=True)
                if li_text:
                    prefix = f"{idx}. " if is_ordered else "- "
                    indent = "  " * depth
                    lines.append(f"{indent}{prefix}{li_text}")
            lines.append("")
            return

        # Paragraphs and blocks
        if tag in ["p", "div", "section"]:
            child_text = node.get_text(separator=" ", strip=True)
            if child_text and len(node.find_all(["p", "table", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6"])) == 0:
                lines.append(f"\n{child_text}\n")
                return

        for child in node.children:
            process_node(child, depth + 1)

    process_node(content_root)

    raw_md = "\n".join(lines)
    # Collapse multiple consecutive blank lines
    cleaned_md = re.sub(r"\n{3,}", "\n\n", raw_md).strip()
    return cleaned_md


def format_markdown_table(table_tag: bs4.element.Tag) -> str:
    """Format an HTML table into GitHub-flavored Markdown table syntax."""
    rows: List[List[str]] = []
    headers: List[str] = []

    thead = table_tag.find("thead")
    if thead:
        header_tr = thead.find("tr")
        if header_tr:
            headers = [th.get_text(separator=" ", strip=True) for th in header_tr.find_all(["th", "td"])]

    tbody = table_tag.find("tbody") or table_tag
    for tr in tbody.find_all("tr", recursive=False):
        cells = [td.get_text(separator=" ", strip=True) for td in tr.find_all(["td", "th"])]
        if cells:
            if not headers:
                headers = cells
            else:
                rows.append(cells)

    if not headers and not rows:
        return ""

    if not headers and rows:
        headers = [f"Column {i+1}" for i in range(len(rows[0]))]

    col_count = len(headers)
    md_lines: List[str] = []
    # Header row
    md_lines.append("| " + " | ".join(h.replace("|", "\\|") for h in headers) + " |")
    # Separator row
    md_lines.append("| " + " | ".join("---" for _ in range(col_count)) + " |")

    for row in rows:
        # Pad or truncate row to match column count
        padded = (row + [""] * col_count)[:col_count]
        md_lines.append("| " + " | ".join(c.replace("|", "\\|") for c in padded) + " |")

    return "\n".join(md_lines)


# --- Embedded Document Discovery & Ranking ---

def discover_embedded_documents(
    soup: BeautifulSoup,
    base_url: str,
) -> List[DiscoveredDocument]:
    """
    Inspect all anchor elements, resolve URLs, filter with SSRF validation,
    and rank discovered PDF and DOCX syllabus documents by academic relevance.
    """
    discovered: List[DiscoveredDocument] = []
    seen_urls: Set[str] = set()

    links = soup.find_all("a", href=True)

    for link in links:
        raw_href = link["href"].strip()
        if not raw_href or raw_href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue

        resolved_url = urllib.parse.urljoin(base_url, raw_href)

        # Basic safety and scheme check
        try:
            parsed = urllib.parse.urlsplit(resolved_url)
            if parsed.scheme.lower() not in ALLOWED_SCHEMES:
                continue
            # Quick SSRF pre-check on host
            host = parsed.hostname
            if not host or host.lower() in PROHIBITED_HOSTNAMES:
                continue
        except Exception:
            continue

        if resolved_url in seen_urls:
            continue
        seen_urls.add(resolved_url)

        # Detect document format from extension or path
        path_lower = parsed.path.lower()
        doc_type: Optional[str] = None
        if path_lower.endswith(".pdf") or ".pdf?" in resolved_url.lower():
            doc_type = "pdf"
        elif path_lower.endswith(".docx") or ".docx?" in resolved_url.lower():
            doc_type = "docx"

        link_text = link.get_text(separator=" ", strip=True)
        title_attr = link.get("title", "").strip()
        combined_text = f"{link_text} {title_attr}".strip()

        # If extension isn't explicit in path, check link text for PDF/DOCX mentions
        if not doc_type:
            if "pdf" in combined_text.lower():
                doc_type = "pdf"
            elif "docx" in combined_text.lower() or "word" in combined_text.lower():
                doc_type = "docx"

        if not doc_type:
            continue

        filename = os.path.basename(parsed.path) or f"document.{doc_type}"
        if not filename.endswith(f".{doc_type}"):
            filename = f"{filename}.{doc_type}"

        # Calculate relevance score
        score = 0.0
        text_lower = combined_text.lower()
        url_lower = resolved_url.lower()

        # Anchor text relevance
        if any(k in text_lower for k in ["syllabus", "curriculum", "scheme", "detailed syllabus"]):
            score += 50.0
        elif any(k in text_lower for k in ["course", "b.tech", "m.tech", "semester", "regulations", "program"]):
            score += 25.0

        # URL path relevance
        if any(k in url_lower for k in ["syllabus", "curriculum", "scheme"]):
            score += 30.0
        elif any(k in url_lower for k in ["course", "btech", "mtech", "sem", "academic"]):
            score += 15.0

        # Base format score
        score += 10.0

        # Nearby heading context
        parent_heading = link.find_previous(["h1", "h2", "h3", "h4", "h5", "h6"])
        if parent_heading:
            heading_txt = parent_heading.get_text().lower()
            if any(k in heading_txt for k in ["syllabus", "curriculum", "scheme"]):
                score += 20.0

        relevance_label = "High" if score >= 50.0 else "Medium" if score >= 25.0 else "Low"
        display_title = link_text or filename

        discovered.append(
            DiscoveredDocument(
                url=resolved_url,
                filename=filename,
                document_type=doc_type,
                relevance_score=score,
                relevance_label=relevance_label,
                display_title=display_title,
            )
        )

    # Sort deterministically by relevance score descending, then filename ascending
    discovered.sort(key=lambda d: (-d.relevance_score, d.filename))
    return discovered


# --- High-Level Web Content Fetcher ---

async def fetch_web_content(
    url: str,
    follow_embedded_pdf: bool = True,
    selected_document_url: Optional[str] = None,
) -> ScrapedContent:
    """
    Securely acquire academic content:
    1. Validates URL against SSRF and DNS rebinding policies.
    2. Follows max 5 redirects with full re-validation at each step.
    3. Streams response up to 10 MiB limit.
    4. Detects direct binary (PDF/DOCX) or HTML.
    5. Discovers embedded syllabus documents in HTML.
    6. If selected_document_url or auto-follow is active, acquires the authoritative document.
    """
    validated_url = validate_safe_url(url)
    warnings: List[str] = []

    async with create_safe_async_client() as client:
        # Bounded manual redirect loop
        current_url = validated_url
        redirect_count = 0
        visited_urls: Set[str] = {current_url}
        final_response: Optional[httpx.Response] = None

        while True:
            try:
                response = await client.get(current_url)
            except Exception as e:
                raise ScraperError(f"HTTP connection failed for '{current_url}': {e}") from e

            # Handle redirects manually
            if response.status_code in (301, 302, 303, 307, 308):
                redirect_count += 1
                if redirect_count > MAX_REDIRECTS:
                    raise ScraperError(f"Exceeded maximum redirect limit of {MAX_REDIRECTS}.")

                location = response.headers.get("Location")
                if not location:
                    raise ScraperError(f"Redirect response {response.status_code} missing Location header.")

                next_url = urllib.parse.urljoin(current_url, location)

                # Protocol downgrade protection: HTTPS cannot downgrade to HTTP
                if urllib.parse.urlsplit(current_url).scheme == "https" and urllib.parse.urlsplit(next_url).scheme == "http":
                    raise SSRFProtectionError("Protocol downgrade from HTTPS to HTTP during redirect is prohibited.")

                # Re-validate target URL
                validated_next = validate_safe_url(next_url)
                if validated_next in visited_urls:
                    raise ScraperError(f"Redirect loop detected: '{validated_next}' already visited.")
                visited_urls.add(validated_next)

                current_url = validated_next
                await response.aclose()
                continue

            if response.status_code != 200:
                await response.aclose()
                raise ScraperError(f"Server returned HTTP status {response.status_code} for '{current_url}'.")

            final_response = response
            break

        # Check Content-Length header
        content_length_hdr = final_response.headers.get("Content-Length")
        if content_length_hdr:
            try:
                cl_bytes = int(content_length_hdr)
                if cl_bytes > MAX_DOWNLOAD_SIZE_BYTES:
                    await final_response.aclose()
                    raise ScraperError(
                        f"Response content length ({cl_bytes / (1024*1024):.1f} MiB) "
                        f"exceeds maximum allowed size of {MAX_DOWNLOAD_SIZE_BYTES // (1024*1024)} MiB."
                    )
            except ValueError:
                pass

        # Stream body with byte limit enforcement
        chunks: List[bytes] = []
        total_received = 0
        async for chunk in final_response.aiter_bytes(chunk_size=16384):
            total_received += len(chunk)
            if total_received > MAX_DOWNLOAD_SIZE_BYTES:
                await final_response.aclose()
                raise ScraperError(
                    f"Download exceeded maximum allowed size of {MAX_DOWNLOAD_SIZE_BYTES // (1024*1024)} MiB."
                )
            chunks.append(chunk)

        body_bytes = b"".join(chunks)
        await final_response.aclose()

        content_type_header = final_response.headers.get("Content-Type", "").lower()
        final_url = str(final_response.url)

    # 1. Check if the response is a direct PDF or DOCX
    binary_type = detect_binary_type(body_bytes)
    if binary_type in ["pdf", "docx"]:
        resolved_filename = os.path.basename(urllib.parse.urlsplit(final_url).path) or f"syllabus.{binary_type}"
        if not resolved_filename.endswith(f".{binary_type}"):
            resolved_filename = f"{resolved_filename}.{binary_type}"

        return ScrapedContent(
            requested_url=url,
            final_url=final_url,
            resolved_title=resolved_filename,
            content_type=content_type_header or f"application/{binary_type}",
            source_kind=binary_type,
            binary_content=body_bytes,
            binary_filename=resolved_filename,
            warnings=warnings,
        )

    # 2. Treat as HTML page
    try:
        # Detect encoding
        encoding = final_response.encoding or "utf-8"
        html_text = body_bytes.decode(encoding, errors="replace")
    except Exception:
        html_text = body_bytes.decode("utf-8", errors="replace")

    soup, resolved_title = clean_html_dom(html_text)
    if not resolved_title:
        resolved_title = urllib.parse.urlsplit(final_url).netloc or "University Syllabus Page"

    # Discover embedded downloadable documents
    embedded_docs = discover_embedded_documents(soup, base_url=final_url)

    # Check curriculum relevance
    cleaned_md = html_to_structural_markdown(soup)
    keyword_hits = sum(1 for kw in CURRICULUM_KEYWORDS if kw in cleaned_md.lower())
    if keyword_hits < 2 and not embedded_docs:
        warnings.append(
            "Page contains limited academic terminology. Please verify that this page contains a complete curriculum."
        )

    # 3. If a specific embedded document was explicitly selected by the student
    target_doc_url = selected_document_url
    if not target_doc_url and follow_embedded_pdf and embedded_docs:
        # Auto-follow only if single unambiguous highest-confidence document exists
        high_conf = [d for d in embedded_docs if d.relevance_score >= 50.0]
        if len(high_conf) == 1:
            target_doc_url = high_conf[0].url

    if target_doc_url:
        # Fetch the selected embedded document securely
        doc_result = await fetch_web_content(
            url=target_doc_url,
            follow_embedded_pdf=False,
            selected_document_url=None,
        )
        if doc_result.source_kind in ["pdf", "docx"]:
            doc_result.requested_url = url  # preserve original source URL
            doc_result.embedded_documents = embedded_docs
            return doc_result

    requires_selection = len(embedded_docs) > 1 and not selected_document_url

    return ScrapedContent(
        requested_url=url,
        final_url=final_url,
        resolved_title=resolved_title,
        content_type=content_type_header or "text/html",
        source_kind="html",
        html_markdown=cleaned_md,
        raw_html=html_text,
        embedded_documents=embedded_docs,
        warnings=warnings,
        requires_document_selection=requires_selection,
    )

