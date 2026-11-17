# 14_IMPLEMENTATION_PLAN.md
# Production-Grade Implementation Plan
## UI Modernization, Extraction Reliability, Mobile Readiness & Offline-First Architecture

| Document Attribute | Value |
|---|---|
| **Document ID** | `14_IMPLEMENTATION_PLAN.md` |
| **Project** | Hierarchical Syllabus Checklist & Progress Tracker |
| **Repository** | [farhanahmad2106-cpu/Syllabus_Tracker_checklist](https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist) |
| **Document Type** | Technical Implementation Blueprint |
| **Implementation Scope** | Five Workstreams, Seven Delivery Phases |
| **Engineering Standard** | Production-grade, backward-compatible, local-first architecture |

---


# 1. Executive Summary


## 1.1 Project Overview

The Hierarchical Syllabus Checklist & Progress Tracker is a local-first academic planning and curriculum management application that transforms unstructured university syllabus documents into a structured, evidence-backed academic checklist.
The application supports document ingestion, AI-assisted structured extraction, academic hierarchy reconstruction, elective enrollment, progress tracking, study planning, notes, resources, and academic reporting.
Its architecture combines:
- Python and FastAPI.
- SQLite with WAL mode and foreign-key enforcement.
- PDF, DOCX, DOC, and TXT document processing.
- Instructor-based structured LLM extraction.
- Local Ollama and optional cloud extraction providers.
- React 19 and TypeScript.
- Vite and Tailwind CSS v4.
- Hierarchical academic tree rendering.
- Persistent leaf-level completion tracking.
- Source evidence and extraction validation.
The repository's published README documents the five-tier hierarchy, dual-provider extraction, elective preservation, evidence traceability, and leaf-only completion persistence. These capabilities are foundational architectural contracts, not optional implementation details.

## 1.2 Current Architectural Maturity

The publicly accessible repository documentation establishes the following architecture:
| Area | Documented capability |
| --- | --- |
| Backend | FastAPI |
| Persistence | SQLite, WAL, foreign keys |
| ORM | SQLModel / SQLAlchemy 2.0 |
| Validation | Pydantic v2 |
| PDF extraction | pypdf |
| DOCX extraction | python-docx |
| Legacy DOC | LibreOffice |
| Scanned documents | Optional Docling |
| LLM extraction | Instructor |
| Local AI | Ollama |
| Cloud AI | OpenAI-compatible endpoints |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Testing | Pytest, Vitest, React Testing Library |

The repository also documents asynchronous upload jobs, SSE progress reporting, cancellation, elective onboarding, and atomic enrollment finalization.
These existing capabilities should be extended incrementally rather than replaced.

## 1.3 Remaining Modernization Gaps

Five major workstreams are required.
| Workstream | Primary objective | Expected outcome |
| --- | --- | --- |
| A | Extraction reliability | Cleaner, semantically accurate academic hierarchy |
| B | Design system | Consistent, polished academic workspace |
| C | Command palette | Unified navigation and contextual actions |
| D | Responsive architecture | Fully usable mobile, tablet, and desktop interface |
| E | Offline-first architecture | Persistent offline operations and reliable synchronization |


## 1.4 Modernization Goals

The implementation must achieve:
- Reliable extraction without deleting legitimate academic content.
- Consistent academic hierarchy and provenance.
- A restrained, accessible dark/light design system.
- Unified application search and keyboard navigation.
- Responsive navigation and tree interactions.
- Persistent offline leaf completion and notes.
- Idempotent synchronization.
- Safe conflict resolution.
- Backward-compatible database and API evolution.
- Production-level automated verification.

## 1.5 Implementation Boundaries

This plan authorizes incremental engineering changes only.
The following are outside the immediate scope:
- Replacing the backend framework.
- Replacing SQLite with PostgreSQL.
- Replacing the frontend framework.
- Rebuilding the academic hierarchy.
- Introducing unnecessary global state management.
- Rewriting existing extraction providers.
- Converting the application immediately into a native Android application.
- Changing JSON Schema 2.1 backup compatibility.
- Removing established academic workflows.
The existing application remains the authoritative system for academic data and server-side validation.

# 2. Existing Architecture & Repository Audit


## 2.1 Repository Inspection Status

The public GitHub repository and its README and Python project configuration were accessible during preparation of this document.
However, individual backend and frontend directory listings could not be independently retrieved through the available repository viewer.
Consequently, this document distinguishes:
- Verified: Information explicitly visible in repository documentation or configuration.
- Supplied: Architecture and functionality described in the project brief.
- Proposed: New implementation architecture.
- Conditional: A file or function whose actual existence must be checked before modification.
- No source-level inspection or test execution is claimed.
Repository: [https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist](https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist?utm_source=chatgpt.com)

## 2.2 Verified Repository Structure

The publicly visible root structure includes:
```text
Syllabus_Tracker_checklist/
├── backend/
├── data/
├── frontend/
├── scripts/
├── .env.example
├── .gitignore
├── Master_Context.md
├── README.md
├── pyproject.toml
└── start-backend.ps1
```

The following directory contents must be inspected during Phase 0:
```text
backend/
├── app/
├── tests/
└── [additional modules to verify]

frontend/
├── src/
├── package.json
├── vite.config.ts
└── [additional configuration to verify]

scripts/
└── [existing automation and launcher utilities]
```

This is an inspection map, not a claim that every listed nested path has been verified.

## 2.3 Backend Architecture

The documented backend uses a layered ingestion and extraction architecture.
```text
Uploaded Document
  │
  ▼
Secure Ingestion Layer
  ├──► PDF (pypdf)
  ├──► DOCX (python-docx)
  └──► DOC (LibreOffice)
         │
         ▼
Extracted Source Text
  │
  ▼
Document Normalization
  │
  ▼
Structured Extraction
  ├──► Ollama (Local LLM)
  └──► Cloud LLM (OpenAI-compatible)
         │
         ▼
Pydantic Validation
  │
  ▼
Academic Hierarchy
  │
  ▼
Elective Review
  │
  ▼
SQLite Storage
  │
  ▼
Progress & Analytics API
```

The implementation plan must preserve this architecture.
Existing backend capabilities to inspect
| Component | Responsibility |
| --- | --- |
| Ingestion service | Upload validation and temporary storage |
| PDF parser | PDF text extraction |
| DOCX parser | Word document extraction |
| DOC conversion | Legacy document conversion |
| Extraction provider | Local/cloud AI selection |
| Instructor integration | Structured output |
| Pydantic schemas | Data contract validation |
| Academic parser | Hierarchy construction |
| Elective service | Enrollment decisions |
| Persistence layer | SQLite storage |
| Progress service | Derived completion analytics |
| API routers | Client communication |


## 2.4 Frontend Architecture

The documented frontend uses React 19, TypeScript, Vite, and Tailwind CSS v4.
Existing feature responsibilities to preserve include:
- Academic tree rendering.
- Semester and subject organization.
- Module presentation.
- Topic completion.
- Elective onboarding.
- Progress visualization.
- Notes.
- Resources.
- Evidence.
- Deadlines.
- Export and backup workflows.
- The actual component hierarchy must be established before refactoring.

## 2.5 Database and Persistence Architecture

The documented database architecture uses:
- SQLite.
- WAL journal mode.
- Foreign-key enforcement.
- SQLModel / SQLAlchemy 2.0.
- Leaf-only completion persistence.
- Unique syllabus/leaf completion relationships.
- The database is the authoritative source for synchronized academic state.
- The IndexedDB implementation proposed later must remain a separate local synchronization layer.
- It must never become an alternative authoritative database.

## 2.6 Existing API Contracts

The repository README documents the following endpoints.
| Method | Endpoint | Responsibility |
| --- | --- | --- |
| GET | /health | Liveness and diagnostics |
| GET | /ready | Database readiness |
| GET | /api/config | Safe application configuration |
| GET | /api/syllabi | Syllabus listing |
| POST | /api/upload | Asynchronous upload |
| GET | /api/upload/progress/{id} | SSE upload progress |
| GET | /api/upload/jobs/{id} | Job status |
| POST | /api/upload/jobs/{id}/cancel | Cancel ingestion |
| GET | /api/syllabus/{id}/review | Elective review |
| POST | /api/syllabus/{id}/finalize-enrollment | Finalize enrollment |
| POST | /api/syllabus/{id}/update-enrollment | Update enrollment |
| GET | /api/syllabus/{id} | Retrieve hierarchy |
| PATCH | /api/syllabus/{id}/toggle-leaf | Leaf completion |
| PATCH | /api/syllabus/{id}/bulk-toggle | Branch completion |
| PATCH | /api/syllabus/{id} | Update syllabus metadata |
| DELETE | /api/syllabus/{id} | Delete syllabus |

These are documented contracts, not independently verified endpoint implementations.
Before modifying any route:
- Inspect its router.
- Inspect request and response models.
- Inspect database transactions.
- Inspect authentication and authorization.
- Inspect frontend consumers.
- Record existing error responses.
- Add compatibility tests.

## 2.7 Existing Test Infrastructure

The repository's published pyproject.toml confirms:
```toml
[tool.pytest.ini_options]
pythonpath = [ ".", "backend" ]
testpaths = ["backend/tests"]
```

The public README documents these historical test commands:
```powershell
$env:PYTHONPATH="."
.\backend\venv\Scripts\python.exe -m pytest backend/tests -v
```

```bash
cd frontend
npm test -- --run
npm run typecheck
npm run build
```

The README reports historical results of 102 backend tests and 26 frontend tests.
These numbers must not be confused with the newer supplied preservation targets of 191 backend tests and 53 frontend tests.
Baseline verification required
During Phase 0, establish actual current test discovery, counts, pass/fail results, CI workflows, and frontend scripts.
The implementation must not assume that either historical or supplied counts represent the current repository state.

## 2.8 Architecture Discrepancies to Resolve

| ID | Discrepancy | Required investigation |
| --- | --- | --- |
| AUD-001 | Reported test counts differ | Establish actual discovered tests |
| AUD-002 | Parser file locations unverified | Locate extraction implementation |
| AUD-003 | Validation boundaries unclear | Identify normalization and persistence boundaries |
| AUD-004 | Theme implementation unknown | Locate existing theme state |
| AUD-005 | Tree component decomposition unknown | Inspect actual React component hierarchy |
| AUD-006 | Notes persistence unknown | Identify note storage and API contracts |
| AUD-007 | Search architecture unknown | Inspect existing filtering and indexing |
| AUD-008 | Offline infrastructure unknown | Check for service workers and IndexedDB |
| AUD-009 | Authentication model unknown | Identify account/session boundaries |
| AUD-010 | CI configuration unknown | Inspect .github/workflows and other CI configuration |


# 3. Implementation Strategy & Backward-Compatibility Guarantees


## 3.1 Engineering Principles

All work must follow these principles.
Preserve working functionality.
Extend existing abstractions before introducing new ones.
Keep academic data contracts stable.
Make every mutation recoverable.
Separate original evidence from normalized content.
Keep parent progress derived.
Keep client-side state subordinate to server validation.
Avoid unnecessary dependency additions.
Require automated regression coverage.
Deliver each workstream independently testable.

## 3.2 Canonical Academic Hierarchy

The following structure is immutable:
```text
Document Root (Container)
└── Academic Year [Tier 1]
    └── Semester [Tier 2]
        └── Subject / Course [Tier 3]
            └── Module / Unit [Tier 4]
                └── Topic Leaf [Tier 5]
```

Architectural invariants
| Rule | Requirement |
| --- | --- |
| HIER-001 | Exactly five academic tiers |
| HIER-002 | Document Root is a container |
| HIER-003 | Only Tier-5 leaves persist completion |
| HIER-004 | Parent completion is derived |
| HIER-005 | Parent completion is never independently stored |
| HIER-006 | Elective changes preserve historical progress |
| HIER-007 | Contact hours are informational metadata |
| HIER-008 | Every extracted leaf retains provenance |


## 3.3 Implementation Order

The default execution sequence is:
- Repository audit.
- Backend extraction reliability.
- Design system.
- Command palette.
- Responsive architecture.
- Offline infrastructure.
- Cross-workstream integration.
- Offline synchronization depends on stable entity identifiers and mutation contracts.
Therefore, Workstream E must not begin backend replay implementation until existing persistence semantics have been verified.

## 3.4 Database Preservation

Do not modify existing tables unless necessary.
Any required schema change must include:
- Forward migration.
- Migration versioning.
- Data-preserving transformation.
- Foreign-key validation.
- Existing-data migration tests.
- Rollback or recovery strategy.
- Backup before migration.
- Compatibility with existing records.
- Prefer additive changes.
- Never delete historical completion records when electives are excluded.

## 3.5 API Compatibility

Existing endpoints should remain operational.
For new offline synchronization:
- Prefer additive mutation metadata.
- Preserve existing request fields.
- Maintain existing response semantics.
- Introduce versioning only when necessary.
- Avoid requiring every existing frontend consumer to migrate simultaneously.

## 3.6 Rollback Strategy

Every implementation phase must be independently revertible.
| Workstream | Rollback strategy |
| --- | --- |
| A | Restore previous parser behavior behind a controlled feature flag if required |
| B | Revert design tokens and component presentation without changing academic data |
| C | Disable command palette without affecting existing navigation |
| D | Restore previous layout while retaining semantic component behavior |
| E | Disable offline queue replay while preserving local recoverable data |

Offline rollback must never delete pending user operations.

# 4. Workstream A — Backend Extraction Sanitization & Semantic Naming


## 4.1 Objective

Improve the accuracy of academic hierarchy extraction while preventing document artifacts from becoming trackable topics.
The primary objective is precision improvement without sacrificing valid syllabus content.

## 4.2 Existing Architectural Assumptions

The supplied architecture identifies:
- Fast-path document extraction.
- AI-assisted structured extraction.
- Deterministic fallback parsing.
- Pydantic schema validation.
- Academic hierarchy reconstruction.
- Provenance preservation.
- The exact parser and validation module structure must be verified before modification.

## 4.3 File-by-File Implementation

| File | Classification | Responsibility |
| --- | --- | --- |
| backend/app/parser.py | Inspect / conditional modify | Main parsing pipeline |
| backend/app/validation.py | Inspect / conditional modify | Structural validation |
| Actual extraction schema module | Inspect / conditional modify | Pydantic contracts |
| Actual prompt template module | Inspect / conditional modify | LLM instructions |
| Actual PDF parser module | Inspect / conditional modify | PDF extraction |
| Actual DOCX parser module | Inspect / conditional modify | DOCX extraction |
| Proposed backend/app/extraction/sanitizer.py | Create if no equivalent | Artifact detection |
| Proposed backend/app/extraction/provenance.py | Create if no equivalent | Evidence management |
| Proposed backend/app/extraction/table_reconstruction.py | Create if no equivalent | Table continuation |
| Proposed backend/app/extraction/semantic_naming.py | Create if no equivalent | Contextual naming |
| Actual extraction tests | Modify | Regression coverage |
| New extraction fixtures | Create | Representative documents |

Do not create duplicate abstractions if the existing codebase already has equivalent functionality.

## 4.4 Proposed Extraction Pipeline

The revised extraction architecture should follow this sequence:
```text
Document Ingestion
  │
  ▼
Raw Text Extraction
  │
  ▼
Page-Aware Segmentation
  │
  ▼
Running Header/Footer Analysis
  │
  ▼
Table Reconstruction
  │
  ▼
Contextual Semantic Extraction
  │
  ▼
Artifact Sanitization
  │
  ▼
Hierarchy Reconstruction
  │
  ▼
Structural Validation
  │
  ▼
Pydantic Validation
  │
  ▼
Review Classification
  │
  ▼
Persistence Boundary
```

The order of sanitization and semantic reconstruction must be coordinated.
Aggressive cleaning before semantic interpretation can destroy legitimate context.
The original text must remain available throughout the pipeline.

## 4.5 A1 — Artifact Sanitization


### 4.5.1 Sanitization Objectives

Detect:
- Pagination markers.
- Repeated headers.
- Repeated footers.
- Institutional addresses.
- Administrative notices.
- Copyright text.
- Document version information.
- Empty extraction fragments.
- Formatting artifacts.
- Duplicate headings.
- Broken OCR fragments.

### 4.5.2 Proposed Sanitizer Interface

The following is a proposed interface, not a verified existing function signature.
```python
from dataclasses import dataclass, field
from typing import Literal

ArtifactType = Literal[
    "pagination",
    "header",
    "footer",
    "document_metadata",
    "formatting",
    "ocr_noise",
    "duplicate",
    "ambiguous"
]

@dataclass
class SanitizationWarning:
    code: str
    artifact_type: ArtifactType
    message: str
    confidence: float
    source_page: int | None = None

@dataclass
class SanitizationResult:
    original_text: str
    normalized_text: str
    is_trackable: bool
    warnings: list[SanitizationWarning] = field(default_factory=list)
    requires_review: bool = False
```

The original evidence must never be overwritten.

### 4.5.3 Pagination Detection

Initial candidate pattern:
```python
PAGE_MARKER_PATTERN = r"^\s*\[?\s*PAGE\s+\d+\s*\]?\s*$"
```

Apply case-insensitive matching.
Additional patterns may include:
```python
PAGE_NUMBER_PATTERN = r"^\s*(?:[-–—]\s*)?\d{1,4}(?:\s*[-–—])?\s*$"
```

However, the second pattern must never independently determine deletion.
A standalone number may represent:
- A topic number.
- A module number.
- A course identifier.
- A mathematical value.
- A legitimate academic section.
- Bare-number removal requires contextual evidence.

### 4.5.4 Legitimate Content Protection

The following must remain valid:
- Unit 2: Operating Systems Chapter 3: Database Normalization 8086 Microprocessor Page Replacement Algorithms 2D Transformations IPv6 Addressing 8051 Microcontroller
- The sanitizer must distinguish pagination context from academic terminology.

### 4.5.5 Repeated Header/Footer Detection

Proposed approach:
- Normalize whitespace.
- Extract candidate text from repeated page regions.
- Compare normalized strings across pages.
- Calculate recurrence frequency.
- Check page-position consistency.
- Compare against academic hierarchy context.
- Classify likely boilerplate.
- Preserve source evidence.
- Generate warnings for uncertain classifications.
- A repeated phrase must not automatically be discarded.
- For example, a legitimate module heading may repeat in a table of contents and within the syllabus.
- Use recurrence and positional evidence together.

### 4.5.6 Duplicate Detection

Apply normalized comparison using:
- Whitespace normalization.
- Case folding.
- Unicode normalization.
- Conservative punctuation normalization.
- Do not deduplicate legitimate repeated topics across different modules.
- Duplicate detection must be scoped to appropriate hierarchy levels and source contexts.

## 4.6 A2 — Semantic Document Understanding


### 4.6.1 Objective

Replace fabricated fallback naming with contextual inference.
The extraction pipeline must not automatically create plausible-sounding academic labels when evidence is insufficient.

### 4.6.2 Proposed Naming Priority

Use the following evidence order:
- Explicit course title.
- Nearby academic heading.
- Table caption.
- Table column context.
- Course code.
- Previous and subsequent page context.
- Parent hierarchy context.
- Document-level academic metadata.
- Structured extraction evidence.
- Each inferred name must have traceable supporting evidence.

### 4.6.3 Proposed Semantic Naming Interface

```python
from dataclasses import dataclass
from typing import Literal

ReviewStatus = Literal["verified", "needs_review"]

@dataclass
class SemanticNameResult:
    value: str | None
    confidence: float
    review_status: ReviewStatus
    evidence: list[str]
    warning_codes: list[str]
```


### 4.6.4 Confidence Classification

Suggested initial policy:
| Confidence | Classification | Behavior |
| --- | --- | --- |
| 0.90–1.00 | High | Eligible for automatic acceptance after validation |
| 0.70–0.89 | Medium | Preserve and flag for review |
| Below 0.70 | Low | Require review |
| No evidence | Unknown | Do not invent a name |

These values are proposed thresholds and must be calibrated against a representative fixture dataset.
An LLM's self-reported confidence must not be treated as a reliable probability without empirical calibration.

### 4.6.5 Missing Name Handling

Instead of:
- Subject 1 Unit 2 General Curriculum Unknown Module
- Use a reviewable representation.
Example:
```json
{
  "name": null,
  "review_status": "needs_review",
  "warnings": [
    {
      "code": "SEMANTIC_NAME_UNRESOLVED",
      "message": "No sufficiently supported module title was identified."
    }
  ]
}
```

The actual database and Pydantic model may require a non-null name.
If so, introduce an additive review-state representation or an internal extraction draft model.
Do not force nullable extraction values into a persisted schema without checking compatibility.

### 4.6.6 Content Preservation

If the module name is uncertain but its topic content is valid:
- Preserve the topics.
- Preserve source evidence.
- Preserve hierarchy relationships where possible.
- Mark the parent for review.
- Prevent silent deletion.

## 4.7 A3 — Cross-Page Table Reconstruction


### 4.7.1 Problem

PDF tables may continue across pages while repeating their headers.
Naive text extraction can split:
- Module numbers.
- Module titles.
- Topic descriptions.
- Contact-hour values.
- Course identifiers.

### 4.7.2 Proposed Reconstruction Strategy

Each page should retain:
```python
@dataclass
class PageContext:
    page_number: int
    text_blocks: list[str]
    table_blocks: list[dict]
    headings: list[str]
    repeated_headers: list[str]
```

The actual implementation should use existing parser output structures wherever possible.

### 4.7.3 Continuation Detection

Evaluate:
- Previous page ends inside an unfinished table.
- Current page begins with matching column headers.
- Table captions are repeated.
- Module numbering continues.
- Column count remains consistent.
- Topic text appears grammatically incomplete.
- Row values align with previous-page columns.

### 4.7.4 Reconstruction Algorithm

```text
Read Page N
  │
  ▼
Identify Table
  │
  ▼
Store Column Structure
  │
  ▼
Read Page N+1
  │
  ▼
Detect Repeated Header
  │
  ▼
Compare Column Alignment
  │
  ▼
Identify Continuation
  ├──► [ No ]  ──► New Table
  │
  └──► [ Yes ] ──► Merge Compatible Rows
                     │
                     ▼
                   Preserve Original Page References
                     │
                     ▼
                   Validate Reconstructed Structure
```


### 4.7.5 Reconstruction Rules

Preserve original reading order.
Never merge unrelated tables solely because their columns match.
Remove duplicated column headers from semantic content while retaining evidence.
Preserve row-to-module relationships.
Do not discard ambiguous rows.
Mark uncertain reconstruction for review.
Preserve physical source page references for merged rows.

### 4.7.6 OCR Handling

OCR normalization may repair:
- Broken whitespace.
- Repeated line breaks.
- Obvious character spacing errors.
- Common table boundary inconsistencies.
- It must not silently rewrite academic terminology.

## 4.8 A4 — Provenance Preservation


### 4.8.1 Required Leaf Provenance

Every extracted Tier-5 leaf must retain the existing equivalent of:
- source_text
- source_page
- source_start_offset
- source_end_offset
- Source document identifier
- Original source URL where applicable
- Relevant heading context
- Table context where applicable
- Grounding status
- Validation warnings
The published repository documentation already describes exact excerpts, physical page citations, document offsets, and grounding states.
Extend this model rather than replacing it.

### 4.8.2 Original Versus Normalized Content

Maintain distinct representations:
```text
Original Source Evidence
  │
  ▼
Normalized Extraction Text
  │
  ▼
Semantic Academic Node
```

The normalized representation is suitable for display and tracking.
The original source evidence is suitable for verification.
Never overwrite the original source excerpt with cleaned or paraphrased text.

### 4.8.3 Provenance Invariants

Every verified leaf must map to its original source.
Cross-page rows may have multiple source references.
Normalization must not invalidate source offsets.
Source page numbers remain one-based physical PDF pages.
URL provenance must retain the originating page.
Export must preserve provenance according to existing export contracts.

## 4.9 A5 — Validation Architecture

Proposed Validation Layers
| Layer | Responsibility |
| --- | --- |
| Raw extraction | Capture original document content |
| Normalization | Normalize formatting |
| Artifact detection | Identify non-academic artifacts |
| Reconstruction | Restore semantic relationships |
| Structural validation | Validate five-tier hierarchy |
| Pydantic validation | Enforce schema constraints |
| Grounding validation | Verify source evidence |
| Review classification | Identify uncertain nodes |
| Persistence validation | Prevent invalid writes |

Persistence Boundary
No invalid hierarchy should enter the permanent database.
Use a staging or draft representation if the existing upload workflow already supports one.
The existing elective-review/finalization workflow should remain intact.
Validation Warning Structure
Proposed interface:
```python
class ValidationWarning(BaseModel):
    code: str
    severity: Literal["info", "warning", "error"]
    message: str
    node_id: str | None = None
    source_page: int | None = None
    requires_review: bool = False
```

Warnings should be machine-readable.
Do not make application logic depend on parsing human-readable warning messages.

## 4.10 A6 — Required Tests

| Test ID | Scenario | Expected result |
| --- | --- | --- |
| EXT-001 | [Page 2] | Not a topic |
| EXT-002 | PAGE 4 | Not a topic |
| EXT-003 | Repeated header | Flagged as boilerplate |
| EXT-004 | Repeated footer | Flagged as boilerplate |
| EXT-005 | Unit 2: Operating Systems | Preserved |
| EXT-006 | 8086 Microprocessor | Preserved |
| EXT-007 | Page Replacement Algorithms | Preserved |
| EXT-008 | 2D Transformations | Preserved |
| EXT-009 | Empty leaf | Rejected as trackable content |
| EXT-010 | OCR noise | Review or reject appropriately |
| EXT-011 | Duplicate topic | Deduplicated only within valid scope |
| EXT-012 | Split table | Reconstructed when evidence supports continuation |
| EXT-013 | Missing subject name | Review warning |
| EXT-014 | Missing module name | Review warning |
| EXT-015 | Cross-page topic | Original pages preserved |
| EXT-016 | Invalid LLM output | Validation failure, no invalid persistence |
| EXT-017 | Ambiguous hierarchy | Review required |
| EXT-018 | Existing valid fixture | No legitimate content lost |
| EXT-019 | Source offsets | Remain valid |
| EXT-020 | Previously supported DOCX/PDF | No regression |


### 4.10.1 Recall Protection

The most important extraction acceptance requirement is:
- A reduction in artifact false positives must not be achieved by deleting legitimate academic content.
- Create a gold-standard extraction fixture set.
Measure:

\[ Precision = \frac{TP}{TP+FP} \]


\[ Recall = \frac{TP}{TP+FN} \]


\[ F1 = 2 \times \frac{Precision \times Recall} {Precision + Recall} \]

Track artifact rejection separately from academic topic extraction.
A legitimate topic rejected as an artifact is a critical regression.

## 4.11 Workstream A Acceptance Criteria

Pagination markers never become trackable topics.
Repeated boilerplate is detected conservatively.
Legitimate numbered academic content remains intact.
Cross-page tables preserve semantic relationships.
Missing names generate review states rather than fabricated labels.
Original source evidence remains unchanged.
All leaves retain appropriate provenance.
Invalid structures cannot bypass validation.
Existing extraction fixtures remain valid.
No historical academic progress is affected.

# 5. Workstream B — Design System, Badge Hygiene & Adaptive Theme


## 5.1 Objective

Establish a consistent, elegant academic workspace that prioritizes information hierarchy, readability, and efficient academic navigation.
The visual direction should take inspiration from the restraint of Linear, the content organization of Notion, and modern developer-tool interfaces.
It must not reproduce their interfaces.

## 5.2 Files to Inspect

| File | Classification |
| --- | --- |
| frontend/src/index.css | Inspect / modify |
| frontend/src/App.tsx | Inspect / modify |
| frontend/src/components/SyllabusTree.tsx | Inspect / modify |
| Actual semester components | Inspect |
| Actual subject components | Inspect |
| Actual module components | Inspect |
| Actual topic components | Inspect |
| Actual notes components | Inspect |
| Actual sidebar components | Inspect |
| Actual modal components | Inspect |
| Existing theme utilities | Inspect |


## 5.3 B1 — Design Token Architecture

Introduce a centralized token system.
The following tokens are proposed starting values.

#### Dark Theme

| Token | Value |
| --- | --- |
| Main background | #09090B |
| Sidebar | #09090B |
| Primary surface | #18181B |
| Secondary surface | #27272A |
| Primary text | #FAFAFA |
| Secondary text | #A1A1AA |
| Muted text | #71717A |
| Border | rgba(255,255,255,0.06) |
| Accent emerald | #34D399 |


#### Light Theme

| Token | Value |
| --- | --- |
| Main background | #FAFAFA |
| Primary surface | #FFFFFF |
| Secondary surface | #F4F4F5 |
| Primary text | #18181B |
| Secondary text | #71717A |
| Border | rgba(24,24,27,0.08) |
| Accent emerald | #059669 |

The light accent should be validated against text and component contrast requirements.
Proposed CSS Architecture
Use the existing Tailwind configuration and CSS conventions.
If appropriate, define semantic variables:
```css
:root {
  --background: #09090b;
  --surface-primary: #18181b;
  --surface-secondary: #27272a;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --accent: #34d399;
}

[data-theme="light"] {
  --background: #fafafa;
  --surface-primary: #ffffff;
  --surface-secondary: #f4f4f5;
  --text-primary: #18181b;
  --text-secondary: #71717a;
  --border-subtle: rgba(24, 24, 27, 0.08);
  --accent: #059669;
}
```

These are proposed tokens.
Do not duplicate tokens already available through the existing Tailwind v4 theme configuration.

## 5.4 B2 — Contact-Hour Badge Hygiene

Target
Existing ModuleCard in SyllabusTree.tsx, or the actual equivalent.
Required behavior
```typescript
const shouldShowContactHours = module.contact_hours != null && module.contact_hours > 0;
```

Render only when the condition is true.
Expected behavior:
| Contact hours | Display |
| --- | --- |
| null | Hidden |
| undefined | Hidden |
| 0 | Hidden |
| Negative value | Hidden |
| 6 | Display |
| 12 | Display |

Never display repetitive messages such as:
- Contact Hours Not Specified
- Missing contact-hour information must not be treated as an error.
- Contact hours remain metadata and must never affect completion calculations.

## 5.5 B3 — Academic Component Hierarchy

Refactor existing components incrementally.

#### Academic Year

Responsibilities:
- Year label.
- Aggregate progress.
- Expand/collapse.
- Semester navigation.

#### Semester

Responsibilities:
- Semester identification.
- Examination target.
- Progress.
- Study pacing summary.

#### Subject

Responsibilities:
- Course title.
- Course code where available.
- Lab indicator.
- Elective status.
- Subject progress.

#### Module

Responsibilities:
- Module name.
- Contact-hour metadata.
- Module progress.
- Expand/collapse.

#### Topic Leaf

Responsibilities:
- Topic title.
- Completion checkbox.
- Notes.
- Resources.
- Evidence.
- Deadline indicators.
- Visual hierarchy
Prefer:
- One clear primary surface.
- Subtle nested indentation.
- Minimal separators.
- Consistent typography.
- Small contextual metadata.
- Restrained accent colors.
- Avoid repeatedly nesting bordered cards.

## 5.6 B4 — Typography

Recommended typography system:
| Use | Font |
| --- | --- |
| Main UI | Inter or existing equivalent |
| Academic content | Inter or system sans-serif |
| Numeric metadata | JetBrains Mono, optional |
| Technical IDs | Monospace |

Do not load additional fonts unnecessarily.
Prefer locally available or existing font assets where possible.
Typography must support long academic titles without truncating essential information.

## 5.7 B5 — Contextual Secondary Actions

Group topic actions:
- Notes.
- Resources.
- Evidence.
- Pointer behavior
- Actions may become more visually prominent on hover.
- Keyboard behavior
- Actions must become visible on focus-within.
- Touch behavior
- Actions must remain directly discoverable without hover.
- Proposed component interface
```typescript
interface TopicActionsProps {
  topicId: string;
  notesCount?: number;
  resourceCount?: number;
  hasEvidence?: boolean;
  onOpenNotes: () => void;
  onOpenResources: () => void;
  onOpenEvidence: () => void;
}
```

This interface is illustrative.
Match existing component conventions before introducing it.
Additional requirements
Prevent layout shifts.
Provide accessible names.
Use appropriate icons and tooltips.
Display useful counts.
Preserve all existing actions.
Avoid hiding essential workflows.

## 5.8 B6 — Adaptive Theme

Support:
- Dark.
- Light.
- System.
- Proposed theme model
```typescript
type ThemePreference = "dark" | "light" | "system";
```

Responsibilities
A single theme controller should:
- Read saved explicit preferences.
- Detect operating-system preference.
- Resolve the effective theme.
- Apply the root theme attribute.
- Persist explicit preferences.
- Respond to system changes.
- Avoid theme flashing.
- Do not maintain separate theme state in unrelated components.
- Theme initialization
- Prevent a flash of the wrong theme during initial rendering.
If using a pre-render initialization script, keep it minimal, deterministic, and compatible with the existing security policy.
Command palette integration
Theme switching must update the same central theme state.

## 5.9 B7 — Accessibility

Target WCAG 2.2 AA-oriented accessibility.
Requirements:
- Sufficient contrast.
- Semantic HTML.
- Keyboard navigation.
- Visible focus.
- Accessible checkboxes.
- Proper labels.
- Dialog semantics.
- Screen-reader progress descriptions.
- Reduced-motion support.
- For progress indicators, expose both the numeric value and an understandable label.

## 5.10 B8 — Required Tests

| Test | Expected result |
| --- | --- |
| Contact hours null | Badge hidden |
| Contact hours zero | Badge hidden |
| Positive contact hours | Badge displayed |
| Theme dark | Dark tokens applied |
| Theme light | Light tokens applied |
| Theme system | OS preference respected |
| Explicit preference | Persisted |
| Reload | Correct theme restored |
| Keyboard focus | Actions discoverable |
| Touch layout | Actions accessible |
| Progress | Correct accessible description |
| Empty state | No broken visual layout |
| Reduced motion | Non-essential transitions reduced |


## 5.11 Workstream B Acceptance Criteria

Consistent design tokens.
Reduced nested borders.
No repetitive missing-metadata badges.
Preserved academic content density.
Consistent typography.
Unified theme state.
Persistent dark/light/system preferences.
Accessible controls.
No regression in academic workflows.

# 6. Workstream C — Global Command Palette


## 6.1 Objective

Introduce a global navigation and quick-action interface.
The command palette should reduce navigation friction and provide instant access to academic content and common operations.

## 6.2 Files to Inspect

| File | Classification |
| --- | --- |
| frontend/src/App.tsx | Inspect / modify |
| Proposed frontend/src/components/CommandPalette.tsx | Create if absent |
| Existing search/filter components | Inspect |
| Existing keyboard shortcut utilities | Inspect |
| Existing tree state manager | Inspect |
| Existing notes state manager | Inspect |
| Existing theme controller | Inspect |
| Existing dialog infrastructure | Inspect |


## 6.3 C1 — Activation

Keyboard shortcuts:
| Platform | Shortcut |
| --- | --- |
| Windows | Ctrl + K |
| Linux | Ctrl + K |
| macOS | Cmd + K |
| All | Escape |

Event lifecycle
```text
Keyboard Event
  │
  ▼
Check Modifier Combination
  │
  ▼
Check Active Element
  │
  ▼
Check Modal/Editor Conflicts
  │
  ▼
Open Command Palette
  │
  ▼
Focus Search Input
```

Input exclusions
Do not intercept the shortcut when:
- The user is typing in an incompatible text input.
- A content-editable editor has priority.
- Another modal owns keyboard focus.
- The shortcut conflicts with an active workflow.
- The existing notes editor and other text inputs must remain usable.

## 6.4 C2 — Component Architecture

Proposed component:
```typescript
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

The component should be controlled by a central application-level state or existing dialog manager.
Avoid introducing another global state library.

## 6.5 C3 — Search Coverage

Search:
- Academic years.
- Semesters.
- Subjects.
- Modules.
- Topic leaves.
- Notes.
- Each result should display hierarchical context.
Example:
- Binary Search Trees Year 2 Semester 3 Data Structures Trees
Notes results should include the associated topic and enough contextual information to identify the note.

## 6.6 C4 — Search Index Architecture

Create an in-memory index based on canonical application data.
Proposed interface:
```typescript
type SearchEntityType = "year" | "semester" | "subject" | "module" | "topic" | "note";

interface SearchEntry {
  id: string;
  type: SearchEntityType;
  title: string;
  normalizedTitle: string;
  breadcrumb: string[];
  parentId?: string;
  content?: string;
}
```

The actual identifier types must match existing backend models.
Index lifecycle
Build the index:
- When a syllabus is loaded.
- When a new syllabus is imported.
- When a note is created.
- When a note is edited.
- When an academic node changes.
- Invalidate affected entries rather than rebuilding the entire index after every small change.
- Search normalization
Support:
- Case-insensitive matching.
- Leading/trailing whitespace removal.
- Partial-word matching.
- Multiple-term matching.
- Unicode-aware normalization.
- Avoid overly aggressive normalization that damages technical identifiers.

## 6.7 C5 — Search Ranking

Suggested ranking:
| Match type | Priority |
| --- | --- |
| Exact title match | 100 |
| Title prefix | 80 |
| Title substring | 65 |
| All search terms matched | 55 |
| Note title match | 50 |
| Note content match | 35 |
| Breadcrumb match | 25 |

These are proposed ranking weights.
Ranking should be deterministic and testable.
Do not make a network request for each keystroke.

## 6.8 C6 — Quick Actions

Supported actions:
| Action | Responsibility |
| --- | --- |
| Filter Incomplete | Apply existing incomplete filter |
| Filter At-Risk | Apply existing at-risk filter |
| Clear Filters | Reset current filters |
| Collapse All | Collapse academic tree |
| Expand All | Expand academic tree |
| Switch Theme | Cycle or select supported themes |
| Navigate to Node | Expand and focus the selected academic node |

Only expose actions with verified existing behavior.
For example, if a filter does not exist, implement the filter as a separately tested prerequisite rather than exposing a nonfunctional palette command.

## 6.9 C7 — Keyboard Navigation

Support:
- Arrow Up.
- Arrow Down.
- Enter.
- Escape.
- Tab where appropriate.
- The active result must be visually identifiable.
When navigating to a topic:
- Expand the relevant year.
- Expand the semester.
- Expand the subject.
- Expand the module.
- Focus or scroll the topic into view.
- Preserve existing completion state.

## 6.10 C8 — Accessibility

Use an accessible dialog implementation.
Prefer the existing Radix infrastructure if available.
Requirements:
- Dialog semantics.
- Accessible search label.
- Focus trapping.
- Focus restoration.
- Arrow-key navigation.
- Enter activation.
- Escape dismissal.
- Active-result announcements.
- Proper empty state.
- Do not duplicate dialog primitives unnecessarily.

## 6.11 C9 — Mobile Behavior

The palette must work on small screens.
Requirements:
- Full-width mobile dialog.
- Safe-area-aware positioning.
- Touch-friendly results.
- No clipped search input.
- No horizontal overflow.
- Virtual keyboard compatibility.
- Correct focus behavior.

## 6.12 C10 — Required Tests

| ID | Scenario |
| --- | --- |
| CMD-001 | Ctrl+K activation |
| CMD-002 | Cmd+K activation |
| CMD-003 | Escape closes |
| CMD-004 | Text-input shortcut conflict |
| CMD-005 | Content-editable conflict |
| CMD-006 | Exact search |
| CMD-007 | Partial search |
| CMD-008 | Hierarchical context |
| CMD-009 | Notes indexing |
| CMD-010 | Edited-note reindexing |
| CMD-011 | Imported-node indexing |
| CMD-012 | Arrow-key navigation |
| CMD-013 | Enter activation |
| CMD-014 | Theme switching |
| CMD-015 | Filter actions |
| CMD-016 | Focus restoration |
| CMD-017 | Empty results |
| CMD-018 | Mobile layout |


## 6.13 Workstream C Acceptance Criteria

Reliable global shortcut.
No interference with editors.
Search across all specified academic entities.
Updated search index after mutations.
Hierarchical result context.
Working quick actions.
Accessible keyboard navigation.
Correct focus restoration.
Mobile usability.

# 7. Workstream D — Mobile-First Responsive Overhaul


## 7.1 Objective

Transform the existing desktop-oriented interface into a responsive academic workspace that remains usable from 360px smartphones through 2560px displays.
The implementation must preserve the academic hierarchy rather than flattening it to accommodate mobile screens.

## 7.2 Files to Inspect

| File | Classification |
| --- | --- |
| frontend/src/App.tsx | Inspect / modify |
| frontend/src/index.css | Inspect / modify |
| Existing sidebar components | Inspect |
| Existing syllabus tree components | Inspect |
| Existing modal components | Inspect |
| Existing drawer components | Inspect |
| Existing notes components | Inspect |
| Existing navigation utilities | Inspect |


## 7.3 D1 — Responsive Breakpoints

Use mobile-first CSS.
| Target | Width |
| --- | --- |
| Small mobile | 360px |
| Standard mobile | 375px |
| Large mobile | 390–430px |
| Tablet | 768px |
| Compact desktop | 1024px |
| Desktop | 1440px |
| Large desktop | 1920px |
| Ultra-wide | 2560px |

Do not implement all layouts through fixed pixel widths.
Use:
- CSS Grid.
- Flexbox.
- minmax().
- clamp().
- Responsive padding.
- Container constraints.
- Content-aware sizing.

## 7.4 D2 — Desktop Layout

Desktop behavior:
- Persistent sidebar.
- Main academic workspace.
- Contextual action areas.
- Optional collapsible navigation.
- Consistent content maximum width.
- Stable progress summaries.
- At 2560px, the main academic content must not stretch excessively.
- Use an appropriate maximum content width.

## 7.5 D3 — Mobile Sidebar

Desktop:
- Persistent sidebar.
- Optional collapse.
Mobile:
- Hidden by default.
- Slide-over navigation.
- Backdrop.
- Close button.
- Escape dismissal.
- Scroll locking.
- Focus management.
- Proposed lifecycle
```text
Mobile Navigation Trigger
  │
  ▼
Open Drawer
  │
  ▼
Lock Background Scroll
  │
  ▼
Move Focus Into Drawer
  │
  ▼
User Selects Destination
  │
  ▼
Navigate
  │
  ▼
Close Drawer
  │
  ▼
Restore Focus Appropriately
```

Use the existing dialog/drawer infrastructure where possible.

## 7.6 D4 — Mobile Bottom Action Bar

Introduce a compact bottom action bar.
Recommended primary actions:
- Navigation.
- Search.
- Filters.
- Progress.
- More.
- Do not duplicate every desktop control.
- Less frequently used actions should remain in secondary menus.
The bar must:
- Respect safe-area insets.
- Avoid covering content.
- Avoid overlapping modals.
- Remain keyboard accessible.
- Maintain adequate contrast.

## 7.7 D5 — Responsive Academic Tree

The five-tier tree must remain visually understandable.
Required behavior
Consistent indentation.
Text wrapping.
Expand/collapse controls.
Compact metadata.
Responsive progress indicators.
Contextual secondary actions.
No forced horizontal scrolling for normal content.
Long titles
Use wrapping rather than clipping academic titles.
Technical identifiers and course codes may use controlled truncation with accessible full text.
Deep hierarchy
The tree must remain navigable even when all levels are expanded.
If virtualization is introduced, first evaluate:
- Keyboard navigation.
- Screen-reader accessibility.
- Expanded-state persistence.
- Scroll positioning.
- Search-result navigation.
- Focus behavior.
- Do not introduce virtualization solely as a visual optimization.

## 7.8 D6 — Touch Interaction

Minimum target:

\[ 44 \times 44 \text{ CSS pixels} \]

Apply this to:
- Checkboxes.
- Expand/collapse controls.
- Menu buttons.
- Navigation items.
- Modal controls.
- Secondary action triggers.
- Do not require hover for essential interactions.

## 7.9 D7 — Safe-Area Support

Use:
```css
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

Apply to:
- Mobile bottom navigation.
- Drawers.
- Full-screen sheets.
- Sticky headers.
- Modal content.
- Ensure the viewport configuration supports modern mobile browser behavior.

## 7.10 D8 — Modal and Drawer Adaptation

Adapt these existing workflows:
| Workflow | Desktop | Mobile |
| --- | --- | --- |
| Elective onboarding | Centered modal | Full-height sheet |
| Notes | Side panel or modal | Full-screen drawer |
| Evidence viewer | Modal | Full-screen viewer |
| Resource manager | Dialog | Mobile sheet |
| Target-date configuration | Dialog | Compact sheet |
| Export and backup | Dialog | Full-width workflow |
| Delete confirmation | Dialog | Accessible confirmation sheet |

Never replace safe confirmation workflows with native browser dialogs.

## 7.11 D9 — Layout Overflow Prevention

Establish a global responsive verification rule.
```css
html, body, #root {
  min-height: 100%;
}
* {
  box-sizing: border-box;
}
img, video, canvas {
  max-width: 100%;
}
```

This is a starting point, not a complete responsive implementation.
Test individual components for:
- Long text.
- Large metadata values.
- Nested tree nodes.
- Wide tables.
- Action groups.
- Modal content.

## 7.12 D10 — Responsive Testing Matrix

| Viewport | Primary validation |
| --- | --- |
| 360×800 | Small-screen navigation |
| 375×812 | Standard mobile |
| 390×844 | Common smartphone |
| 430×932 | Large mobile |
| 768×1024 | Tablet |
| 1024×768 | Compact desktop |
| 1440×900 | Desktop |
| 1920×1080 | Large desktop |
| 2560×1440 | Ultra-wide |

Use the existing browser-testing infrastructure.
If Playwright or equivalent is absent, evaluate a lightweight addition after checking existing dependencies.
Automated assertions
scrollWidth does not exceed viewport width for normal page layouts.
Essential buttons remain visible.
No overlapping fixed navigation.
Drawers remain dismissible.
Modal content remains reachable.
Touch targets meet minimum dimensions.
Tree hierarchy remains navigable.

## 7.13 Workstream D Acceptance Criteria

Usable at 360px.
No ordinary page-level horizontal overflow.
Responsive sidebar.
Functional mobile bottom action bar.
Fully navigable five-tier tree.
Accessible dialogs.
Touch-friendly controls.
Correct safe-area behavior.
No desktop functionality removed.

# 8. Workstream E — PWA, Offline Sync & Capacitor Readiness


## 8.1 Objective

Introduce reliable offline interactions for supported academic operations.
The application must preserve user actions through network failures, reloads, browser restarts, and delayed synchronization.
Offline support must be a persistent synchronization architecture, not a temporary local-storage workaround.

## 8.2 Files to Inspect

| File | Classification |
| --- | --- |
| frontend/vite.config.ts | Inspect / conditional modify |
| frontend/src/lib/offlineSync.ts | Inspect / create if absent |
| Existing API client | Inspect |
| Existing leaf mutation functions | Inspect |
| Existing note mutation functions | Inspect |
| Existing authentication state | Inspect |
| Existing backend leaf routes | Inspect |
| Existing backend note routes | Inspect |
| Existing database models | Inspect |
| Existing migration infrastructure | Inspect |


## 8.3 E1 — PWA Architecture

Evaluate:
- vite-plugin-pwa.
- Web application manifest.
- Service-worker registration.
- Installability.
- Application icons.
- Offline fallback.
- Update notifications.
- Before adding the plugin, check the current Vite version and dependency lockfile.
- Do not invent a package version.
- PWA responsibilities
```text
Browser
  │
  ▼
React Application
  ├──► Service Worker
  │      ├──► Static Assets
  │      ├──► Application Shell
  │      └──► Offline Fallback
  │
  ├──► IndexedDB
  │      ├──► Offline Outbox
  │      ├──► Local Operation Metadata
  │      └──► Recoverable Drafts
  │
  └──► Backend API
         ├──► Authentication & Authorization
         ├──► Idempotency
         └──► SQLite Persistence
```


## 8.4 E2 — Manifest

Proposed manifest properties:
```json
{
  "name": "Hierarchical Syllabus Checklist",
  "short_name": "Syllabus Tracker",
  "display": "standalone",
  "start_url": "/",
  "scope": "/",
  "background_color": "#09090B",
  "theme_color": "#09090B"
}
```

This is a proposed example.
Actual icon paths and deployment base paths must be verified.
Do not reference nonexistent icon assets.

## 8.5 E3 — Cache Strategy

Different data types require different caching policies.

#### Static application assets

Use cache-first where appropriate.
Versioned asset names.
Immutable assets.
Old cache cleanup.
Controlled cache expiration.

#### Application shell

Use an explicit offline fallback.
The fallback must explain which operations remain available offline.

#### API responses

Use network-first or controlled caching only for endpoints explicitly approved for offline access.

#### Sensitive data

Do not indiscriminately cache:
- Authentication tokens.
- User-specific API responses.
- Private academic notes.
- Protected documents.
- Account information.
- A service worker must not bypass backend authorization.

#### Account switching

On logout or account change:
- Identify user-specific cache namespaces.
- Prevent cross-account reads.
- Clear or securely isolate protected cached data.
- Preserve recoverable pending operations according to a defined account policy.
- Require reauthentication before synchronization.
- Do not discard pending operations belonging to another account without explicit recovery handling.

## 8.6 E4 — IndexedDB Architecture

IndexedDB is the proposed persistent offline storage layer.
Avoid using localStorage for the outbox.
Proposed database
```text
syllabus-offline-db
├── outbox
├── note_drafts
├── sync_metadata
└── entity_versions
```

These stores are proposed.
Reuse any existing offline database if present.

## 8.7 E5 — Offline Outbox Schema

Proposed TypeScript interface:
```typescript
type OfflineEntityType = "leaf" | "note";
type OfflineOperationType = "set_completion" | "update_note";
type OfflineOperationStatus = "pending" | "syncing" | "failed" | "conflicted";

interface OfflineOperation {
  id: string;
  entity_type: OfflineEntityType;
  entity_id: string;
  operation_type: OfflineOperationType;
  payload: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  status: OfflineOperationStatus;
  retry_count: number;
  last_error?: string;
  idempotency_key: string;
  base_version?: number;
  user_scope: string;
}
```

The schema must use actual backend identifier types.
The user_scope must be derived from the authenticated account context, not trusted as a client-provided authorization claim.

## 8.8 E6 — Supported Offline Operations

Initial offline scope:
| Operation | Offline support |
| --- | --- |
| Leaf completion | Yes |
| Markdown note editing | Yes |
| Academic search over loaded data | Yes |
| Theme switching | Yes |
| Tree expansion/collapse | Yes |
| Document import | Not initially |
| Account creation | No |
| Elective finalization | Requires live server |
| Remote scraping | No |
| Server-dependent export | Requires explicit availability |
| Remote deletion | Requires live server |

The application must clearly communicate unavailable offline workflows.

## 8.9 E7 — Leaf Completion Mutation Design

Do not blindly replay toggle operations.
A toggle is not inherently idempotent.
For example:
- Initial state: false First request: toggle -> true Retry: toggle -> false
- This produces an incorrect final state.
- Instead, use desired-state operations.
Proposed request:
```json
{
  "leaf_id": "leaf-123",
  "completed": true,
  "idempotency_key": "operation-uuid",
  "base_version": 4
}
```

This is a proposed contract.
Preserve the existing /toggle-leaf endpoint for compatibility.
Add an explicit desired-state mutation endpoint or extend the existing route through a backward-compatible request model.
The server must validate that:
- The leaf belongs to the requested syllabus.
- The authenticated user is authorized.
- The leaf is a valid Tier-5 node.
- The syllabus is in a valid state.
- The operation has not already been processed.

## 8.10 E8 — Backend Idempotency

The backend must guarantee that repeated submission of the same operation does not produce duplicate mutations.
Proposed persistence structure
A separate idempotency record may be necessary.
Example:
```text
idempotency_records
├── id
├── user_id
├── idempotency_key
├── request_hash
├── response_status
├── response_payload
└── created_at
```

This is a proposed logical schema.
Do not introduce the table until the current persistence architecture and migration conventions are inspected.
Required constraints
Use a uniqueness boundary appropriate to:
- Authenticated user.
- Idempotency key.
- The request hash must prevent reuse of the same key with a different payload.
- The mutation and idempotency record must be committed atomically.
- A repeated valid request must return the previous logical result.

## 8.11 E9 — Note Mutation Design

Notes require stronger conflict handling than leaf completion.
Proposed interface:
```typescript
interface NoteMutation {
  note_id: string;
  topic_id: string;
  markdown: string;
  base_version: number;
  idempotency_key: string;
}
```


#### Server behavior

Authenticate user.
Authorize note and topic.
Compare base version.
Validate payload.
Persist if version matches.
Increment version.
Return canonical note.
Return a conflict response when the base version is stale.
Never silently overwrite newer content.

## 8.12 E10 — Note Conflict Resolution

Example:
- Server Version: 5 Local Base Version: 5 Device A edits offline. Device B edits online. Device B saves Version 6. Device A reconnects.
- Device A must not overwrite Version 6 automatically.
The application should:
- Preserve local draft.
- Retrieve current server content.
- Display a conflict.
- Allow the user to compare versions.
- Allow explicit resolution.
- Save the resolved content against the current server version.
- If automatic merging is considered, use a well-defined text merge strategy and test its behavior.
- Do not introduce CRDT infrastructure unless real usage requirements justify it.

## 8.13 E11 — Synchronization Lifecycle

```text
User Mutation
  │
  ▼
Validate Local Input
  │
  ▼
Update Local UI State
  │
  ▼
Persist IndexedDB
  │
  ▼
Network Available? ──[ No ]──► Pending in Outbox Queue
  │
 [ Yes ]
  │
  ▼
Send Request to Backend API
  │
  ▼
Server Auth & Validation
  │
  ▼
Idempotency & Version Check
  │
  ├───[ Success ]───► Confirm & Remove from Outbox
  │
  └───[ Conflict ]──► Preserve Draft & Surface for User Review
```


## 8.14 E12 — Synchronization State Machine

Proposed operation states:
| State | Description |
| --- | --- |
| pending | Waiting for synchronization |
| syncing | Request in progress |
| failed | Retryable or permanent failure awaiting classification |
| conflicted | Server version differs |
| Acknowledged | Successful operation removed or archived |

State transitions:
```text
PENDING
  │
  ▼
SYNCING
  ├──► [ Success ]       ──► ACKNOWLEDGED
  ├──► [ Network Error ] ──► PENDING (Retry with backoff)
  ├──► [ Auth Error ]    ──► PAUSED
  ├──► [ Conflict ]      ──► CONFLICTED
  └──► [ Validation ]    ──► FAILED
```

PAUSED may be implemented as derived queue state or an additional persisted state.
Do not leave operations permanently marked as syncing after a crash.
On startup, recover abandoned synchronization leases.

## 8.15 E13 — Retry Strategy

Use exponential backoff with jitter.
Proposed calculation:

\[ delay = \min( baseDelay \times 2^{retryCount}, maximumDelay ) + jitter \]

Suggested starting configuration:
| Parameter | Proposed value |
| --- | --- |
| Base delay | 2 seconds |
| Maximum delay | 5 minutes |
| Maximum automatic attempts | 8 |
| Jitter | Randomized bounded offset |

These are initial operational settings and must be calibrated.
Failure classification
| Failure | Behavior |
| --- | --- |
| Network unavailable | Retry |
| Connection timeout | Retry |
| HTTP 408 | Retry |
| HTTP 429 | Respect retry guidance |
| HTTP 5xx | Retry with backoff |
| HTTP 401 | Pause until authentication |
| HTTP 403 | Stop and surface authorization failure |
| HTTP 404 | Reconcile deleted entity |
| HTTP 409 | Conflict workflow |
| HTTP 422 | Permanent validation failure |

Do not retry permanent validation errors indefinitely.

## 8.16 E14 — Queue Processing

The synchronization manager should:
- Acquire a queue processing lock.
- Select pending operations.
- Group only compatible operations.
- Respect operation ordering.
- Send requests.
- Process acknowledgements.
- Update retry metadata.
- Release the lock.
- Prevent simultaneous synchronizers from replaying the same operation.
- Use a deterministic operation order.
- Do not reorder note updates in a way that allows an older version to overwrite a newer version.

## 8.17 E15 — Offline State Management

Proposed frontend abstraction:
```typescript
interface OfflineSyncStatus {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  isSyncing: boolean;
  lastSuccessfulSync?: number;
}
```

The interface should expose synchronization status to the application UI.
Do not interpret navigator.onLine as proof that the backend is reachable.
It only indicates browser-reported connectivity.
Use actual API connectivity results to establish synchronization availability.

## 8.18 E16 — User-Visible Synchronization Status

The application should display:
- Offline.
- Pending changes.
- Synchronizing.
- Synced.
- Authentication required.
- Conflict requires attention.
- Failed operation.
- Avoid noisy notifications for every successful operation.
- Prefer a compact status indicator with a detailed recovery view when needed.
- Users must be able to inspect failed operations and manually retry recoverable failures.

## 8.19 E17 — Cross-Device Reconciliation

The backend remains authoritative.
When a device reconnects:
- Retrieve the latest server state.
- Validate local entity references.
- Compare local operation versions.
- Detect deleted or archived entities.
- Reconcile desired completion states.
- Detect note conflicts.
- Preserve unresolved drafts.
- Update the local application cache.
- Deleted entity handling
If a topic has been deleted remotely:
- Do not recreate it automatically.
- Preserve pending note content as a recoverable draft.
- Mark related completion operations as unrecoverable or requiring review.
- Explain the situation to the user.

## 8.20 E18 — Service Worker Update Strategy

A new service-worker version must not interrupt pending mutations.
Required behavior:
- Detect waiting updates.
- Notify the user.
- Avoid activating incompatible caches during active critical operations.
- Preserve IndexedDB data.
- Clean obsolete static caches.
- Revalidate application assets.
- Support rollback to a compatible application shell where possible.
- IndexedDB schema changes must be versioned independently from static asset caches.

## 8.21 E19 — Offline Security

Requirements:
- Server-side authorization remains mandatory.
- Local queue payloads are untrusted.
- Validate every replayed operation.
- Prevent cross-user queue processing.
- Avoid storing authentication secrets in operation records.
- Sanitize logged error messages.
- Prevent private cache leakage.
- Protect Markdown rendering against XSS.
- Enforce note-size limits.
- Define local-data retention and logout behavior.
- Local encryption may be considered if the application has a suitable key-management model.
- Do not claim meaningful encryption merely by storing a key beside encrypted data in IndexedDB.

## 8.22 E20 — Capacitor Readiness

Capacitor is a future integration target, not an automatic result of PWA support.

#### Stage 1 — PWA

Implement:
- Manifest.
- Service worker.
- IndexedDB.
- Offline outbox.
- Synchronization.
- Responsive interface.

#### Stage 2 — WebView Compatibility

Evaluate:
- IndexedDB availability.
- Browser API dependencies.
- File import/export.
- Keyboard behavior.
- Safe areas.
- Native navigation bars.
- Android back button.
- Authentication redirects.
- Deep links.
- Storage lifecycle.

#### Stage 3 — Optional Capacitor Integration

Only after browser-based offline behavior is stable.
Evaluate:
- Capacitor runtime.
- Filesystem integration.
- Native keyboard behavior.
- Native splash screen.
- Native status bar.
- Android back-button handling.
- Deep linking.
- Storage persistence.
- App lifecycle synchronization.
- Do not assume a service worker will behave identically inside every native WebView environment.

## 8.23 E21 — Required Tests

| Test ID | Scenario | Expected behavior |
| --- | --- | --- |
| OFF-001 | IndexedDB initialization | Database opens |
| OFF-002 | Queue creation | Operation persisted |
| OFF-003 | Refresh | Pending operation recovered |
| OFF-004 | Browser restart | Pending operation preserved |
| OFF-005 | Desired completion replay | Correct state |
| OFF-006 | Duplicate replay | No duplicate mutation |
| OFF-007 | Idempotency key reuse | Existing result returned |
| OFF-008 | Different payload, same key | Rejected |
| OFF-009 | Network failure | Operation remains pending |
| OFF-010 | Retry | Exponential backoff |
| OFF-011 | HTTP 401 | Synchronization pauses |
| OFF-012 | HTTP 403 | Permanent authorization failure |
| OFF-013 | HTTP 422 | No infinite retry |
| OFF-014 | HTTP 409 | Conflict surfaced |
| OFF-015 | Concurrent note edit | No silent overwrite |
| OFF-016 | Local draft recovery | Content preserved |
| OFF-017 | Deleted leaf | No automatic recreation |
| OFF-018 | Account switch | No cross-user leakage |
| OFF-019 | Service-worker update | Queue preserved |
| OFF-020 | Cache cleanup | Private data protected |
| OFF-021 | Tab closure | Pending operation preserved |
| OFF-022 | Multiple tabs | No duplicate replay |
| OFF-023 | Offline/online transition | Synchronization resumes |
| OFF-024 | Stale entity version | Correct reconciliation |


## 8.24 Workstream E Acceptance Criteria

Installable PWA.
Correct manifest.
Controlled service-worker caching.
IndexedDB persistence.
Offline leaf completion.
Offline Markdown editing.
Queue survives browser restart.
Idempotent server replay.
No blind toggle replay.
Version-aware note updates.
Conflict recovery.
Authentication-aware synchronization.
No cross-account data leakage.
No deleted-entity recreation.
Capacitor compatibility risks documented and tested.

# 9. Cross-Workstream Integration Strategy


## 9.1 Overall Delivery Sequence

The recommended execution sequence contains seven phases.

## Phase 0 — Repository Audit

Establish actual architecture, dependencies, test baseline, API contracts, and implementation boundaries.

## Phase 1 — Extraction Reliability

Implement Workstream A and stabilize extraction contracts, hierarchy validation, and provenance.

## Phase 2 — Design System

Implement Workstream B and establish reusable visual foundations.

## Phase 3 — Navigation & Search

Implement Workstream C using the stabilized academic tree and existing state architecture.

## Phase 4 — Responsive Experience

Implement Workstream D and validate all supported viewport classes.

## Phase 5 — Offline Infrastructure

Implement Workstream E, including backend idempotency and frontend IndexedDB synchronization.

## Phase 6 — Integration & Release Validation

Complete regression, security, migration, accessibility, offline, and production-build verification.

## 9.2 Phase 0 — Repository Audit


#### Objectives

Inspect actual repository structure.
Verify all existing component paths.
Identify backend extraction modules.
Identify Pydantic schemas.
Identify database models.
Identify frontend state management.
Identify existing theme architecture.
Identify notes persistence.
Identify existing API contracts.
Identify dependency versions.
Verify test commands.
Verify CI gates.

#### Deliverables

Verified repository inventory.
Architecture discrepancy report.
Test baseline report.
Dependency inventory.
API contract inventory.
File ownership/change map.
Implementation dependency graph.

#### Exit criteria

No workstream begins with unresolved assumptions about the critical files it intends to modify.

## 9.3 Phase 1 — Extraction Reliability


#### Tasks

Establish extraction fixtures.
Audit current artifact handling.
Identify source evidence boundaries.
Implement conservative sanitizer.
Implement contextual naming.
Improve table continuation.
Introduce structured validation warnings.
Verify provenance.
Add regression tests.

#### Dependencies

No frontend dependency.
Extraction output contracts must be stabilized before later features consume new review metadata.

#### Exit criteria

Valid syllabus content preserved.
Artifact topics eliminated.
Provenance retained.
Ambiguous nodes reviewable.

## 9.4 Phase 2 — Design System


#### Tasks

Audit current CSS.
Define semantic tokens.
Refactor surface hierarchy.
Remove repetitive metadata badges.
Implement conditional contact-hour display.
Consolidate theme state.
Implement dark/light/system.
Improve contextual actions.
Add accessibility tests.

#### Dependencies

Existing academic component contracts.
No database migration should be required.

#### Exit criteria

Consistent visual presentation without functional regressions.

## 9.5 Phase 3 — Navigation & Search


#### Tasks

Inspect current tree state.
Identify stable entity IDs.
Build normalized search index.
Implement command palette.
Add keyboard shortcuts.
Implement ranking.
Connect quick actions.
Connect theme switching.
Implement navigation to nested nodes.
Add focus and accessibility tests.

#### Dependencies

Workstream B for theme integration.
Existing hierarchy and state architecture.

#### Exit criteria

Search remains synchronized with academic content and provides reliable navigation.

## 9.6 Phase 4 — Responsive Experience


#### Tasks

Establish mobile-first tokens.
Refactor application layout.
Implement responsive sidebar.
Implement mobile bottom navigation.
Adapt academic tree.
Adapt modals.
Add safe-area handling.
Validate touch targets.
Run viewport tests.

#### Dependencies

Workstream B should provide the foundational design tokens.
Workstream C must be included in mobile validation.

#### Exit criteria

No critical responsive, navigation, or accessibility regressions.

## 9.7 Phase 5 — Offline Infrastructure


#### Tasks

Audit backend mutation semantics.
Identify stable entity IDs.
Design idempotency contracts.
Add version-aware note updates.
Implement IndexedDB.
Implement offline outbox.
Implement mutation persistence.
Implement retry management.
Implement conflict resolution.
Implement PWA service worker.
Implement cache isolation.
Implement user-visible sync state.
Test recovery scenarios.

#### Dependencies

Stable academic IDs.
Stable completion contracts.
Existing notes persistence.
Authentication model.
Database migration infrastructure.

#### Critical ordering

Backend idempotency and version checks must be available before enabling automatic queue replay in production.

## 9.8 Phase 6 — Integration & Release Validation


#### Integration scenarios

| Scenario | Required behavior |
| --- | --- |
| Import syllabus offline | Clearly unavailable |
| Import syllabus online | Existing ingestion works |
| Search imported syllabus | New nodes indexed |
| Edit note offline | Draft persisted |
| Complete topic offline | Desired state queued |
| Reload while offline | State recovered |
| Reconnect | Safe synchronization |
| Duplicate replay | No duplicate mutation |
| Edit note on another device | Conflict detected |
| Switch theme | Theme remains consistent |
| Open palette on mobile | No overflow |
| Navigate deep topic | Correct hierarchy expanded |
| Exclude elective | Historical completion preserved |
| Re-enroll elective | Historical completion restored |


#### Release criteria

All four global quality gates must pass.

# 10. Verification & Regression Prevention Checklist


## 10.1 Backend Regression

Existing backend tests pass.
Current test count established.
Existing extraction fixtures pass.
Pagination markers rejected.
Legitimate numbered topics preserved.
Header/footer handling verified.
Cross-page table reconstruction verified.
Missing names produce review warnings.
Provenance remains intact.
Invalid hierarchy cannot be persisted.
LLM malformed-output handling verified.
SQLite foreign keys remain enabled.
WAL mode remains functional.
Database integrity checks pass.
Existing API contracts remain compatible.

## 10.2 Academic Integrity

Five academic tiers preserved.
Document Root remains a container.
Only Tier-5 leaves persist completion.
Parent completion remains derived.
Elective filtering preserves historical progress.
Re-enrollment restores progress.
Contact hours do not affect progress.
Lab weighting remains unchanged.
Zero-leaf branch behavior remains correct.
Exported hierarchy remains valid.

## 10.3 Frontend Regression

Existing frontend tests pass.
TypeScript checks pass.
Theme switching works.
Theme preference persists.
System theme works.
Contact-hour badges are conditional.
Topic actions remain available.
Command palette opens.
Search results are accurate.
Quick actions work.
Notes remain functional.
Resources remain functional.
Evidence remains functional.
Deadlines remain functional.
Export and backup remain functional.

## 10.4 Responsive Regression

360px layout verified.
375px layout verified.
390px layout verified.
430px layout verified.
768px layout verified.
1024px layout verified.
1440px layout verified.
1920px layout verified.
2560px layout verified.
No ordinary page overflow.
No clipped controls.
Mobile sidebar dismissible.
Modals remain usable.
Bottom bar respects safe areas.
Touch targets meet requirements.
Keyboard accessibility preserved.

## 10.5 PWA and Offline Regression

Manifest valid.
Installability verified.
Service worker registered.
Offline fallback works.
Static asset caching works.
Sensitive API responses are not indiscriminately cached.
IndexedDB opens.
Outbox persists.
Reload recovers operations.
Browser restart recovers operations.
Desired-state replay is idempotent.
Duplicate replay prevented.
Authentication expiry handled.
Retry behavior verified.
Permanent failures do not retry indefinitely.
Conflicts surfaced.
Note drafts recoverable.
Deleted entities not recreated.
Account isolation verified.
Service-worker updates preserve pending work.

## 10.6 Export and Backup Compatibility

Test:
- JSON Schema 2.1 backup.
- Existing backup import.
- Markdown export.
- Notion-compatible export.
- Printable HTML.
- PDF report.
- Notes.
- Resources.
- Source evidence.
- Historical progress.
- Elective enrollment state.

## 10.7 Production Quality Gate

TypeScript checks pass.
Lint checks pass.
Backend test suite passes.
Frontend test suite passes.
Production build succeeds.
No unresolved critical console errors.
No critical security regressions.
API compatibility verified.
Database migrations verified.
Rollback strategy validated.

# 11. Risk Register

Probability and impact are qualitative initial estimates. They must be updated after Phase 0.
| Risk ID | Risk | Probability | Impact | Mitigation | Validation |
| --- | --- | --- | --- | --- | --- |
| RISK-001 | Sanitizer removes valid academic topics | Medium | Critical | Conservative contextual detection | Gold-standard fixtures |
| RISK-002 | Pagination markers survive extraction | Medium | High | Dedicated artifact patterns | Extraction tests |
| RISK-003 | Repeated headings incorrectly removed | Medium | High | Context-aware deduplication | Multi-page fixtures |
| RISK-004 | Cross-page tables reconstructed incorrectly | High | High | Confidence-based merging | Table fixtures |
| RISK-005 | Semantic naming fabricates titles | Medium | High | Evidence-backed naming | Ambiguous document tests |
| RISK-006 | Provenance offsets become invalid | Medium | Critical | Preserve raw text and offset mappings | Offset verification |
| RISK-007 | Historical elective progress is lost | Low | Critical | Preserve existing identifiers and relationships | Migration tests |
| RISK-008 | Parent completion becomes persisted | Low | Critical | Enforce leaf-only mutation boundaries | Database invariant tests |
| RISK-009 | Theme state becomes inconsistent | Medium | Medium | Single theme controller | Theme integration tests |
| RISK-010 | UI refactoring breaks existing actions | Medium | High | Incremental component changes | Regression tests |
| RISK-011 | Command shortcuts interfere with editors | Medium | Medium | Active-element and modal checks | Keyboard tests |
| RISK-012 | Search index becomes stale | Medium | Medium | Incremental invalidation | Mutation tests |
| RISK-013 | Mobile layout introduces overflow | Medium | High | Viewport automation | Responsive matrix |
| RISK-014 | Bottom bar overlaps content | Medium | Medium | Safe-area padding | Mobile browser tests |
| RISK-015 | IndexedDB data is lost | Low | Critical | Transactional writes and recovery tests | Restart simulation |
| RISK-016 | Duplicate replay reverses completion | Medium | Critical | Desired-state mutation and idempotency | Duplicate replay tests |
| RISK-017 | Concurrent note edits cause data loss | High | Critical | Version checks and conflict resolution | Concurrent-edit tests |
| RISK-018 | Authentication expires during sync | High | High | Pause queue and reauthenticate | Auth expiry tests |
| RISK-019 | Stale cache exposes private data | Medium | Critical | User-scoped cache policy | Cross-account tests |
| RISK-020 | Service-worker update interrupts work | Medium | High | Versioned assets and update coordination | Update lifecycle tests |
| RISK-021 | Deleted entity is recreated offline | Medium | High | Server-side existence validation | Deleted-entity tests |
| RISK-022 | Multiple tabs process same queue | Medium | High | Synchronization lock | Multi-tab tests |
| RISK-023 | PWA assumptions fail inside Capacitor | Medium | Medium | Separate WebView compatibility stage | Native prototype |
| RISK-024 | New dependencies conflict with existing stack | Medium | Medium | Lockfile and compatibility review | Build and dependency checks |
| RISK-025 | Database migration breaks existing data | Low | Critical | Additive migrations and backup | Migration/rollback tests |


# 12. File-by-File Change Matrix


## 12.1 Classification Legend

Modify: Existing file expected to require changes, subject to inspection.
Create: New file proposed if no equivalent exists.
Inspect only: Existing file or configuration requiring examination.
Conditional modification: Modify only if current architecture requires it.

## 12.2 Root and Configuration Files

| File | Existing Responsibility | Proposed Change | Workstream | Dependency | Tests |
| --- | --- | --- | --- | --- | --- |
| README.md | Project documentation | Update only after implementation | All | Verified implementation | Documentation checks |
| Master_Context.md | Project context | Align architecture documentation | All | Phase 0 audit | Consistency review |
| pyproject.toml | Python project configuration | Add test configuration only if needed | A | Existing pytest setup | Pytest discovery |
| .env.example | Configuration template | Document new safe configuration if necessary | E | Auth and sync design | Configuration validation |
| scripts/ | Launcher utilities | Inspect for build/test integration | All | Phase 0 | Existing script tests |


## 12.3 Backend Files

| File | Existing Responsibility | Proposed Change | Workstream | Dependency | Tests |
| --- | --- | --- | --- | --- | --- |
| backend/app/parser.py | Supplied as parser entry point | Improve extraction coordination | A | Actual implementation audit | Parser regression |
| backend/app/validation.py | Supplied as validation entry point | Add artifact and semantic validation integration | A | Parser contracts | Validation tests |
| Actual schema module | Pydantic contracts | Add review metadata if required | A | Existing schemas | Schema compatibility |
| Actual extraction provider | LLM extraction | Improve structured prompt and context handling | A | Provider architecture | Provider fixtures |
| Actual PDF parser | PDF text extraction | Improve page/table context | A | PDF extraction architecture | PDF fixtures |
| Actual DOCX parser | DOCX text extraction | Preserve heading/table context | A | DOCX extraction architecture | DOCX fixtures |
| Actual persistence models | SQLite models | Add versioning/idempotency only if required | E | Database audit | Migration tests |
| Actual leaf mutation route | Completion mutation | Add desired-state compatibility | E | Existing API | Idempotency tests |
| Actual note route | Note persistence | Add version-aware mutation | E | Existing note model | Conflict tests |
| Proposed backend/app/extraction/sanitizer.py | None verified | Central artifact classification | A | Raw extraction | Sanitizer tests |
| Proposed backend/app/extraction/semantic_naming.py | None verified | Evidence-based semantic naming | A | Page and heading context | Naming tests |
| Proposed backend/app/extraction/table_reconstruction.py | None verified | Cross-page table reconstruction | A | PDF/table extraction | Table tests |
| Proposed backend/app/extraction/provenance.py | None verified | Evidence mapping | A | Source extraction | Provenance tests |
| Proposed idempotency persistence module | None verified | Replay protection | E | Database and auth audit | Duplicate replay tests |
| Proposed note versioning service | None verified | Version-aware note writes | E | Existing note persistence | Conflict tests |
| Actual backend tests | Existing test suite | Add regression coverage | A/E | Phase 0 | Pytest |


## 12.4 Frontend Files

| File | Existing Responsibility | Proposed Change | Workstream | Dependency | Tests |
| --- | --- | --- | --- | --- | --- |
| frontend/src/App.tsx | Application composition | Integrate theme, palette, responsive shell | B/C/D | Existing state architecture | Integration tests |
| frontend/src/index.css | Global styles | Introduce semantic design tokens | B/D | Existing Tailwind v4 setup | Theme tests |
| frontend/src/components/SyllabusTree.tsx | Supplied as syllabus tree location | Badge hygiene and component presentation | B/D | Existing tree model | Component tests |
| Actual module component | Module rendering | Conditional contact-hour metadata | B | Actual component location | Badge tests |
| Actual topic component | Leaf rendering | Contextual actions and mobile layout | B/D | Existing topic state | Component tests |
| Actual sidebar component | Navigation | Responsive drawer behavior | D | Existing navigation | Drawer tests |
| Actual notes component | Markdown editing | Offline mutation integration | E | Existing note API | Offline tests |
| Actual theme utility | Theme state | Dark/light/system support | B | Existing theme implementation | Theme tests |
| Proposed frontend/src/components/CommandPalette.tsx | None verified | Global command interface | C | Search index | Palette tests |
| Proposed frontend/src/lib/searchIndex.ts | None verified | In-memory hierarchical index | C | Academic data model | Search tests |
| Proposed frontend/src/lib/offlineSync.ts | Supplied as target to inspect | Offline synchronization manager | E | IndexedDB and API | Sync tests |
| Proposed frontend/src/lib/offlineDb.ts | None verified | IndexedDB abstraction | E | Database design | Persistence tests |
| Proposed frontend/src/lib/offlineOutbox.ts | None verified | Durable operation queue | E | Offline DB | Queue tests |
| Proposed frontend/src/lib/syncConflict.ts | None verified | Conflict management | E | Versioned APIs | Conflict tests |
| frontend/vite.config.ts | Vite configuration | PWA integration if required | E | Existing Vite version | PWA tests |
| Frontend package manifest | Dependency scripts | Add verified dependencies and scripts | B/C/D/E | Lockfile audit | Build checks |
| Actual frontend tests | Existing Vitest suite | Add workstream coverage | All | Component architecture | Vitest |


## 12.5 Conditional PWA Files

| File | Classification | Responsibility |
| --- | --- | --- |
| frontend/public/manifest.webmanifest | Create if absent | Application manifest |
| frontend/public/icons/ | Inspect/create | PWA icon assets |
| frontend/src/service-worker.ts | Create only if required by chosen plugin setup | Custom service-worker behavior |
| frontend/src/components/SyncStatus.tsx | Create if absent | Synchronization indicator |
| frontend/src/components/ConflictResolutionDialog.tsx | Create if absent | Note conflict resolution |
| frontend/src/components/MobileNavigation.tsx | Create if no equivalent | Mobile navigation |

Avoid creating a custom service worker if the selected PWA integration already generates the required worker and the project does not need custom lifecycle behavior.

## 12.6 Database Migration Files

The following are conditional.
| File | Classification | Responsibility |
| --- | --- | --- |
| Existing migration directory | Inspect | Identify migration framework |
| New idempotency migration | Conditional create | Persistent replay protection |
| New note version migration | Conditional create | Optimistic concurrency |
| New sync-related indexes | Conditional create | Query efficiency |

Do not introduce a migration framework if the project already has an established mechanism.

# 13. Definition of Done


## 13.1 Workstream A — Extraction Reliability


#### Completion requirements

Pagination artifacts cannot become trackable topics.
Repeated headers and footers are detected conservatively.
Valid academic titles containing numbers remain intact.
Semantic naming uses contextual evidence.
Generic fabricated names are eliminated from new extraction results.
Ambiguous nodes remain recoverable.
Cross-page tables reconstruct correctly when evidence supports continuation.
Original source evidence is preserved.
Source offsets remain valid.
Validation warnings are structured.
Invalid extraction cannot bypass persistence validation.
Existing valid fixtures pass.
Extraction precision improves without unacceptable recall loss.

## 13.2 Workstream B — Design System

Centralized design tokens implemented.
Dark theme works.
Light theme works.
System theme works.
Theme preference persists.
No initial theme flashing.
Contact-hour badges display only for positive values.
No repetitive missing-metadata badges.
Contact hours do not affect progress.
Component hierarchy is visually consistent.
Secondary actions remain discoverable.
Keyboard accessibility maintained.
Reduced-motion behavior implemented.
Existing academic workflows remain functional.

## 13.3 Workstream C — Command Palette

Ctrl+K works.
Cmd+K works.
Escape closes the palette.
Editor shortcuts are not intercepted incorrectly.
All required academic tiers are searchable.
Notes are searchable.
Hierarchical breadcrumbs are displayed.
Search results update after mutations.
Quick actions work.
Theme switching is integrated.
Navigation expands the correct hierarchy.
Focus is restored.
Mobile layout works.
Automated accessibility tests pass.

## 13.4 Workstream D — Responsive Experience

360px mobile supported.
375px mobile supported.
390px mobile supported.
430px mobile supported.
768px tablet supported.
1024px compact desktop supported.
1440px desktop supported.
1920px desktop supported.
2560px ultra-wide supported.
No ordinary page-level horizontal overflow.
Mobile drawer works.
Bottom navigation works.
Safe areas respected.
All essential controls remain accessible.
Academic hierarchy remains intact.
Touch targets meet the minimum requirement.
Desktop functionality is preserved.

## 13.5 Workstream E — Offline Infrastructure

PWA manifest is valid.
Application is installable.
Service worker is functional.
Static assets cache safely.
Private data is protected.
IndexedDB persists operations.
Leaf completion works offline.
Markdown notes work offline.
Queue survives reload.
Queue survives browser restart.
Server replay is idempotent.
Duplicate mutation is prevented.
Authentication expiration is handled.
Retry behavior is controlled.
Permanent failures are surfaced.
Note conflicts are recoverable.
Deleted entities are not recreated.
User data remains isolated.
Service-worker updates preserve pending operations.
Capacitor readiness is documented and validated.

## 13.6 Global Definition of Done

The application must preserve:
- Five-tier academic hierarchy.
- Leaf-only completion persistence.
- Derived parent completion.
- Historical elective progress.
- Existing lab-course behavior.
- Existing contact-hour metadata.
- Existing notes.
- Existing bookmarks.
- Existing deadlines.
- Existing source evidence.
- Existing academic pacing.
- Existing exports.
- Existing Schema 2.1 backups.
No modernization work is considered complete if it improves presentation or performance while silently compromising academic data integrity.

# 14. Final Engineering Execution Rules


## 14.1 Repository Modification Rules

The implementing engineer or coding agent must:
- Inspect a file before modifying it.
- Confirm whether a proposed file already has an equivalent.
- Reuse existing utilities where appropriate.
- Avoid unnecessary dependencies.
- Preserve established API contracts.
- Avoid destructive database operations.
- Implement migrations only when justified.
- Add tests with each functional change.
- Maintain existing academic workflows.
- Keep changes isolated and reviewable.

## 14.2 Implementation Reporting

After completing each phase, produce an implementation report containing:
| Field | Required information |
| --- | --- |
| Phase | Completed phase identifier |
| Files inspected | Actual files reviewed |
| Files modified | Exact modified paths |
| Files created | Exact new paths |
| Dependencies | Added or changed packages |
| Database changes | Migration details |
| Tests executed | Exact commands |
| Test results | Actual pass/fail counts |
| Regressions | Known issues |
| Security review | Relevant findings |
| Acceptance criteria | Passed/failed |
| Remaining work | Outstanding tasks |

Never report a test as passing unless it was actually executed successfully.

## 14.3 Final Release Conditions

The project is ready for modernization release only when:
- All five workstreams satisfy their acceptance criteria.
- Existing functionality remains operational.
- The five-tier hierarchy is preserved.
- Historical completion data remains intact.
- Extraction provenance remains accessible.
- Existing export contracts remain compatible.
- Responsive validation passes.
- Accessibility validation passes.
- Offline synchronization is demonstrably idempotent.
- Conflict resolution prevents silent data loss.
- Authentication and cache isolation are verified.
- Production build and regression suites pass.
- Migration and rollback procedures are documented.
- END OF 14_IMPLEMENTATION_PLAN.md