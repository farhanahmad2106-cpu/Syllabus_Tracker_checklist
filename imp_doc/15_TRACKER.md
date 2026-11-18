# Master Engineering Progress, Implementation Status & Technical Audit Checklist

**Document**: `15_TRACKER.md`  
**Document Classification**: Authoritative Engineering Progress Register  
**Project**: Hierarchical Syllabus Checklist & Progress Tracker  
**Repository**: [farhanahmad2106-cpu/Syllabus_Tracker_checklist](https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist?utm_source=chatgpt.com)  
**Document Version**: 1.0  
**Audit Reference Date**: 2026-11-17  
**Primary Purpose**: Implementation accountability, technical verification, regression prevention, and future development planning.  

---

## Document Governance

### Purpose

This document is the master engineering tracker for the Hierarchical Syllabus Checklist & Progress Tracker.
It establishes a single structured record of:
Existing application capabilities.
Verified implementation evidence.
Historical implementation claims.
Outstanding technical work.
Future development phases.
Architecture and data-integrity constraints.
Testing and release requirements.
Technical risks and dependencies.
This document must be updated whenever a feature is implemented, modified, tested, migrated, or formally deferred.

### Source-of-Truth Policy

Implementation status must be determined using the following evidence priority:
Actual source-code implementation.
Automated tests and their assertions.
Database models, migrations, and API schemas.
Architecture and engineering documentation.
Implementation plans and previous trackers.
Git history and release records.
README descriptions and historical project claims.
A documented feature is not automatically a verified feature.

### Repository Audit Limitation

The publicly accessible GitHub repository landing page and README were inspected for this initial tracker. The complete source tree, all 16 architecture documents, test implementations, database migrations, and current execution results were not independently inspected in this audit.
Consequently:
README-documented capabilities are recorded as historical implementation claims.
No source-code function or test implementation is considered independently verified merely from its documentation.
Historical test results are retained with their original context.
Unverified capabilities must not be represented as independently audited production-ready functionality.
The next audit must reconcile every outstanding evidence reference against the actual repository.

### Status Legend

Exactly three primary implementation statuses are used throughout this document.

| Status | Meaning | Checkbox |
| --- | --- | --- |
| [COMPLETED] | Implemented and supported by sufficient identifiable implementation or verification evidence. | - [x] |
| [IN_PROGRESS] | Partially implemented, documented but awaiting verification, or requiring additional work. | - [ ] |
| [PLANNED] | Future functionality or work not yet established as implemented. | - [ ] |

Important distinction: A documented historical implementation claim may be marked [IN_PROGRESS] when independent implementation evidence is unavailable. This does not mean the feature is necessarily absent; it means its current completion status remains unaudited.

### Task Identifier Convention

| Prefix | Engineering Domain |
| --- | --- |
| CORE | Backend foundation and document ingestion |
| HIER | Academic hierarchy and persistence |
| PACE | Study pacing and exam deadlines |
| UTIL | Notes, bookmarks, exports, and backups |
| WEB | University portal scraping and network security |
| WIN | Windows stability and global CLI |
| P10 | Extraction sanitization and commercial UI |
| P11 | Responsive architecture, PWA, and offline synchronization |
| P12 | Study analytics and spaced repetition |
| QA | Testing, regression, and release verification |
| ARCH | Cross-phase architecture and governance |

Task identifiers are permanent. Completed tasks must not be renumbered or reused.

# Section 0 — Executive Status Dashboard

## 0.1 Project Health Summary

### Project Identity

| Attribute | Current Record |
| --- | --- |
| Project | Hierarchical Syllabus Checklist & Progress Tracker |
| Repository | farhanahmad2106-cpu/Syllabus_Tracker_checklist |
| Default branch documented | main |
| Backend | Python, FastAPI, SQLModel / SQLAlchemy |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Database | SQLite |
| AI extraction | Instructor, Pydantic, Ollama, OpenAI-compatible provider |
| Document processing | pypdf, python-docx, LibreOffice |
| Backend testing | Pytest |
| Frontend testing | Vitest, React Testing Library |
| Primary operating environment | Windows 11 |
| Product architecture | Local-first |

### Overall Development Status

Engineering audit required
The repository README describes an established local-first application with:
Multi-format syllabus ingestion.
Dual-provider structured AI extraction.
Five-tier academic hierarchy.
Leaf-only completion persistence.
Dynamic parent progress calculations.
Elective onboarding.
Historical completion preservation.
Lab-course handling.
Contact-hour metadata.
Source evidence and provenance.
A Windows global CLI.
Upload job tracking and SSE progress reporting.
These capabilities form the documented historical baseline.
However, the current source-level implementation and verification status of each subsystem must be reconciled before assigning final production-completion status.

### Current Implementation Phase

Phase 0 — Existing Core Audit and Stability Reconciliation
The next engineering milestone is to establish an evidence-backed baseline before beginning Phase 10.

### Major Engineering Priorities

Verify the existing parser and extraction pipeline.
Establish the actual database schema and migration behavior.
Verify the five-tier hierarchy and leaf-only completion invariant.
Reconcile documented test counts with the current test suite.
Audit Windows PDF processing and resource cleanup.
Verify the global CLI independently of the README.
Implement Phase 10 extraction sanitization and UI modernization.
Establish stable persistence and synchronization contracts before Phase 11.
Introduce reliable historical event data before Phase 12 analytics.

### Major Technical Risks

AI-generated hierarchy hallucinations.
Loss of source provenance during normalization.
Destructive hierarchy migrations.
Historical completion loss during elective changes.
PDF processing resource exhaustion on Windows.
Cross-page table reconstruction errors.
SSRF through university portal ingestion.
Future offline synchronization conflicts.
Analytics based on incomplete historical records.

### Next Engineering Milestone

Milestone M0 — Repository-Wide Engineering Baseline Audit
Deliverables:
Source inventory.
Architecture documentation reconciliation.
Database schema inventory.
API contract inventory.
Backend and frontend test inventory.
Test execution report.
Existing subsystem evidence register.
Phase 10 implementation readiness assessment.

## 0.2 Master Subsystem Status Table

The following table distinguishes historical documentation from independently audited implementation.

| Subsystem | Implementation Status | Test Coverage / Evidence | Health | Remaining Work |
| --- | --- | --- | --- | --- |
| Backend architecture | [IN_PROGRESS] | README documents FastAPI and SQLModel architecture | Not Yet Audited | Inspect routing, services, configuration, and exceptions |
| Document ingestion | [IN_PROGRESS] | README documents four formats | Not Yet Audited | Inspect parsers and edge-case tests |
| AI extraction providers | [IN_PROGRESS] | README documents Ollama and cloud providers | Not Yet Audited | Verify provider switching and model compatibility |
| Extraction validation | [IN_PROGRESS] | README documents Pydantic and grounding | Not Yet Audited | Audit validation and normalization |
| Five-tier hierarchy | [IN_PROGRESS] | Canonical hierarchy documented | Not Yet Audited | Verify actual node models and invariants |
| SQLite persistence | [IN_PROGRESS] | WAL and foreign-key configuration documented | Not Yet Audited | Inspect schema, transactions, and migrations |
| Tri-state progress tracking | [IN_PROGRESS] | Tri-state behavior documented | Not Yet Audited | Verify aggregation and regression tests |
| Elective management | [IN_PROGRESS] | Review and enrollment APIs documented | Not Yet Audited | Verify restoration and enrollment transitions |
| Study pacing | [IN_PROGRESS] | Historical project baseline; no independent evidence | Not Yet Audited | Inspect implementation and calculations |
| Notes management | [IN_PROGRESS] | No independently audited evidence | Not Yet Audited | Inspect UI, persistence, and tests |
| Resource bookmarking | [IN_PROGRESS] | No independently audited evidence | Not Yet Audited | Inspect models, API, and UI |
| Export and backup | [IN_PROGRESS] | Schema 2.1 is a documented requirement | Not Yet Audited | Verify all formats and restoration |
| Web portal scraper | [IN_PROGRESS] | SSRF-safe ingestion is a documented requirement | Not Yet Audited | Audit network boundary validation |
| Windows stability | [IN_PROGRESS] | Windows launch documentation exists | Not Yet Audited | Reproduce and investigate WinError 1450 |
| Global CLI | [IN_PROGRESS] | README documents syllabus launcher | Not Yet Audited | Verify installation and execution lifecycle |
| Desktop UI | [IN_PROGRESS] | React application documented | Not Yet Audited | Audit application structure and interactions |
| Responsive UI | [PLANNED] | No responsive acceptance evidence supplied | Not Yet Audited | Phase 11 |
| PWA architecture | [PLANNED] | No independently verified PWA implementation | Not Yet Audited | Phase 11 |
| Offline synchronization | [PLANNED] | No synchronization contract verified | Not Yet Audited | Phase 11 |
| Study analytics | [PLANNED] | Future functionality | Not Yet Audited | Phase 12 |
| Spaced-repetition scheduling | [PLANNED] | Future functionality | Not Yet Audited | Phase 12 |

## 0.3 Engineering Baseline

### Historical Test Claims

The supplied project context reports the following historical baseline:

| Test Category | Historical Report | Current Audit Result |
| --- | --- | --- |
| Backend tests | 191 | Not Yet Audited |
| Frontend tests | 53 | Not Yet Audited |
| Combined | 244 | Not Yet Audited |

These are historical project claims and must not be interpreted as the current number of passing tests.

### Public README Test Results

The accessible README separately reports an earlier testing snapshot:

| Test Category | Historical README Result |
| --- | --- |
| Backend | 102 passed, 0 failed |
| Frontend | 26 passed across 5 test files |
| TypeScript | 0 reported errors |
| Production build | Clean build reported |

These results are historical and are not evidence of the current repository's execution status.

### Current Verification Register

- [ ] `[IN_PROGRESS]` **QA-001**: Inventory all backend tests and identify their current count.
- [ ] `[IN_PROGRESS]` **QA-002**: Inventory all frontend tests and identify their current count.
- [ ] `[IN_PROGRESS]` **QA-003**: Execute the complete backend test suite and capture the result.
- [ ] `[IN_PROGRESS]` **QA-004**: Execute the complete frontend test suite and capture the result.
- [ ] `[IN_PROGRESS]` **QA-005**: Execute TypeScript type checking.
- [ ] `[IN_PROGRESS]` **QA-006**: Execute the production frontend build.
- [ ] `[IN_PROGRESS]` **QA-007**: Identify skipped, flaky, and environment-dependent tests.
- [ ] `[IN_PROGRESS]` **QA-008**: Reconcile the reported 191 + 53 baseline with the actual test inventory.
Current testing baseline: Not Yet Audited.
No current test execution is claimed by this document.

# Section 1 — Core Backend, Parsers & Dual-Provider Ai Extraction

Subsystem: Core backend and document intelligence
Audit status: [IN_PROGRESS]
Historical documentation: Phases 1–3 and subsequent extraction enhancements are documented in Master_Context.md.

## 1.1 Backend Foundation

### Historical Implementation Register

The repository's Master_Context.md identifies the following implementation locations.

| Component | Documented Location | Historical Status |
| --- | --- | --- |
| FastAPI application | backend/app/main.py | Documented |
| Domain schemas | backend/app/schemas.py | Documented |
| Persistence models | backend/app/models.py | Documented |
| Database engine | backend/app/database.py | Documented |
| Application configuration | backend/app/config.py | Documented |
| Parser | backend/app/parser.py | Documented |
| AI extractor | backend/app/extractor.py | Documented |
| Validation | backend/app/validation.py | Documented |
| Ingestion coordinator | backend/app/services/ingestion.py | Documented |
| Progress engine | backend/app/progress.py | Documented |

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **CORE-001**: Audit FastAPI application initialization and lifecycle management.
- [ ] `[IN_PROGRESS]` **CORE-002**: Verify API routing and service separation.
- [ ] `[IN_PROGRESS]` **CORE-003**: Verify centralized environment configuration.
- [ ] `[IN_PROGRESS]` **CORE-004**: Audit .env.example and ensure no credentials are committed.
- [ ] `[IN_PROGRESS]` **CORE-005**: Verify structured exception handling and API error responses.
- [ ] `[IN_PROGRESS]` **CORE-006**: Audit application logging and sensitive-data redaction.
- [ ] `[IN_PROGRESS]` **CORE-007**: Verify request and response schema validation.
- [ ] `[IN_PROGRESS]` **CORE-008**: Verify upload validation before temporary-file creation.
- [ ] `[IN_PROGRESS]` **CORE-009**: Verify temporary directory isolation and cleanup.
- [ ] `[IN_PROGRESS]` **CORE-010**: Verify resource lifecycle during successful and failed requests.
- [ ] `[IN_PROGRESS]` **CORE-011**: Verify /health and /ready behavior independently.
- [ ] `[IN_PROGRESS]` **CORE-012**: Verify startup and shutdown resource cleanup.

### Implementation Evidence

- **File: backend/app/main.py**
- **File: backend/app/config.py**
- **File: backend/app/schemas.py**
- **Tests: Not Yet Identified — Requires Repository Audit**
- **Verification: Not Yet Verified**

## 1.2 Multi-Format Document Ingestion

### Supported Formats

| Format | Documented Technology | Processing Strategy |
| --- | --- | --- |
| PDF | pypdf | Digital text extraction |
| DOCX | python-docx | Paragraph and document extraction |
| DOC | Headless LibreOffice | Conversion to a supported intermediate format |
| TXT | Python text processing | Encoding-aware text ingestion |
| Scanned PDF | Optional Docling | Fallback processing |

### Historical Parser Architecture

The documented Windows stability improvements establish a lightweight-first parsing strategy:
Validate upload type and size.
Create an isolated temporary directory.
Extract digital PDF text using pypdf.
Use python-docx for DOCX files.
Convert legacy DOC files through LibreOffice.
Use Docling only when the lightweight PDF parser cannot extract meaningful text and the fallback is enabled.
Preserve physical page provenance.
Clean temporary resources after processing.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **CORE-013**: Verify PDF parsing with pypdf.
- [ ] `[IN_PROGRESS]` **CORE-014**: Verify DOCX paragraph extraction.
- [ ] `[IN_PROGRESS]` **CORE-015**: Verify DOC conversion using headless LibreOffice.
- [ ] `[IN_PROGRESS]` **CORE-016**: Verify TXT parsing and encoding handling.
- [ ] `[IN_PROGRESS]` **CORE-017**: Verify physical page numbering is retained.
- [ ] `[IN_PROGRESS]` **CORE-018**: Verify multi-page document handling.
- [ ] `[IN_PROGRESS]` **CORE-019**: Verify table and structured-text extraction.
- [ ] `[IN_PROGRESS]` **CORE-020**: Verify malformed document rejection.
- [ ] `[IN_PROGRESS]` **CORE-021**: Verify empty-document rejection.
- [ ] `[IN_PROGRESS]` **CORE-022**: Verify maximum upload size enforcement.
- [ ] `[IN_PROGRESS]` **CORE-023**: Verify maximum PDF page enforcement.
- [ ] `[IN_PROGRESS]` **CORE-024**: Verify extracted-text length limits.
- [ ] `[IN_PROGRESS]` **CORE-025**: Verify temporary-file cleanup after parser exceptions.
- [ ] `[IN_PROGRESS]` **CORE-026**: Verify large-document memory consumption.
- [ ] `[IN_PROGRESS]` **CORE-027**: Verify scanned-document fallback behavior.
- [ ] `[IN_PROGRESS]` **CORE-028**: Verify concurrent uploads do not share temporary resources.
Documented Operational Limits
The README and Master Context contain different historical configuration snapshots.

| Setting | README Snapshot | Master Context Snapshot | Audit Requirement |
| --- | --- | --- | --- |
| Upload size | 50 MiB | 50 MiB in later phase | Verify effective configuration |
| PDF pages | 1,000 | 300 in Phase 7 | Resolve discrepancy |
| Extracted characters | 1,500,000 | 1,500,000 | Verify |
| Extraction timeout | 180 seconds | 300 seconds in Phase 7 | Verify |
| Parser timeout | Not independently established | 300 seconds in Phase 7 | Verify |
| DOC conversion timeout | Not independently established | 30 seconds | Verify |
| Docling fallback | Disabled by default | Disabled by default | Verify |

Important: Do not silently choose one historical value as authoritative. Inspect the current settings and establish a single documented configuration contract.

## 1.3 AI Extraction Engine

### Provider Architecture

The documented extraction architecture uses:
Document ingestion and normalized source text
Instructor + Pydantic structured extraction
Local provider
Local-first
Ollama
llama3.1:8b
qwen2.5:7b
Qwen3-8B
Cloud provider
OpenAI-compatible API
Configurable endpoint
Configurable model
External network dependency
Validation, provenance verification and canonical hierarchy normalization

### Documented Capabilities

Instructor structured extraction.
Pydantic response schemas.
Local Ollama integration.
OpenAI-compatible cloud provider.
Provider selection through EXTRACTION_PROVIDER.
Untrusted document-content delimiters.
Heuristic outline fallback.
Source evidence validation.
Grounding status tracking.

### Model Availability Policy

The following models are documented as supported configurations:

| Model | Provider | Availability |
| --- | --- | --- |
| llama3.1:8b | Ollama | Documented |
| qwen2.5:7b | Ollama | Documented |
| Qwen3-8B | Ollama | Documented in Master Context |
| gpt-4o-mini | OpenAI-compatible cloud | Documented example |

A documented model must not be interpreted as installed, downloadable, or successfully tested in the current environment.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **CORE-029**: Verify Instructor initialization and structured output integration.
- [ ] `[IN_PROGRESS]` **CORE-030**: Verify Pydantic schema validation.
- [ ] `[IN_PROGRESS]` **CORE-031**: Verify Ollama provider initialization.
- [ ] `[IN_PROGRESS]` **CORE-032**: Verify cloud OpenAI-compatible provider initialization.
- [ ] `[IN_PROGRESS]` **CORE-033**: Verify runtime provider selection.
- [ ] `[IN_PROGRESS]` **CORE-034**: Verify provider switching without application restart, if supported.
- [ ] `[IN_PROGRESS]` **CORE-035**: Verify model availability diagnostics.
- [ ] `[IN_PROGRESS]` **CORE-036**: Verify authentication and endpoint configuration.
- [ ] `[IN_PROGRESS]` **CORE-037**: Verify bounded extraction retries.
- [ ] `[IN_PROGRESS]` **CORE-038**: Verify extraction timeout enforcement.
- [ ] `[IN_PROGRESS]` **CORE-039**: Verify malformed structured-output recovery.
- [ ] `[IN_PROGRESS]` **CORE-040**: Verify deterministic extraction fallback.
- [ ] `[IN_PROGRESS]` **CORE-041**: Verify local provider operation without cloud credentials.
- [ ] `[IN_PROGRESS]` **CORE-042**: Verify cloud credentials never enter logs or responses.
- [ ] `[IN_PROGRESS]` **CORE-043**: Verify prompt-injection isolation for uploaded documents.

## 1.4 Extraction Integrity

Non-Negotiable Grounding Rules
The extraction engine must never create academic content solely to fill an incomplete schema.
Every extracted academic leaf must be traceable to the original document.
Expected provenance fields include:
source_text
source_page
source_start_offset
source_end_offset
evidence_status
grounding_status, where supported
Integrity Checklist
- [ ] `[IN_PROGRESS]` **CORE-044**: Verify every leaf has a meaningful source excerpt.
- [ ] `[IN_PROGRESS]` **CORE-045**: Verify physical page references use one-based indexing.
- [ ] `[IN_PROGRESS]` **CORE-046**: Verify source offsets refer to canonical extracted text.
- [ ] `[IN_PROGRESS]` **CORE-047**: Verify fabricated subjects are rejected.
- [ ] `[IN_PROGRESS]` **CORE-048**: Verify fabricated modules are rejected.
- [ ] `[IN_PROGRESS]` **CORE-049**: Verify unsupported topics are rejected or flagged.
- [ ] `[IN_PROGRESS]` **CORE-050**: Verify missing hierarchy levels are not silently fabricated.
- [ ] `[IN_PROGRESS]` **CORE-051**: Verify duplicate leaves are handled deterministically.
- [ ] `[IN_PROGRESS]` **CORE-052**: Verify empty topic names are rejected.
- [ ] `[IN_PROGRESS]` **CORE-053**: Verify incorrect page references are detected.
- [ ] `[IN_PROGRESS]` **CORE-054**: Verify repeated headers and footers do not become curriculum content.
- [ ] `[IN_PROGRESS]` **CORE-055**: Verify pagination artifacts are detected.
- [ ] `[IN_PROGRESS]` **CORE-056**: Verify split tables retain academic relationships.
- [ ] `[IN_PROGRESS]` **CORE-057**: Verify uncertain content receives review status rather than fabricated certainty.
- [ ] `[IN_PROGRESS]` **CORE-058**: Verify normalization preserves source offsets and excerpts.

### Grounding Status Semantics

| Status | Meaning |
| --- | --- |
| verified | Source evidence sufficiently supports the extracted content |
| needs_review | Evidence exists but requires human confirmation |
| unverified | Grounding has not been established |

The repository's Master Context documents these three values and a bidirectional relationship between grounding_status and evidence_status. The actual synchronization mechanism must be inspected before relying on this contract.

### Implementation Evidence

backend/app/parser.py
backend/app/extractor.py
backend/app/validation.py
backend/app/services/ingestion.py
backend/app/schemas.py
- **Tests: Not Yet Identified — Requires Repository Audit**
- **Verification: Not Yet Verified**

# Section 2 — Five-Tier Hierarchy, Leaf-Only Persistence & Elective Onboarding

Subsystem: Academic domain model and progress persistence
Audit status: [IN_PROGRESS]

## 2.1 Canonical Academic Hierarchy

The canonical hierarchy is:

```text
Document Root
└── Academic Year (Tier 1)
    └── Semester (Tier 2)
        └── Subject / Course (Tier 3)
            └── Module / Unit (Tier 4)
                └── Subtopic Leaf (Tier 5)
```

### Domain Invariants

| Rule ID | Invariant |
| --- | --- |
| HIER-I01 | Every academic node belongs to a valid parent, except the document root. |
| HIER-I02 | Academic hierarchy must preserve all five canonical tiers. |
| HIER-I03 | Completion is persisted only against Tier-5 leaves. |
| HIER-I04 | Parent completion is derived, never independently persisted. |
| HIER-I05 | Parent state is calculated from enrolled descendant leaves. |
| HIER-I06 | Parent percentages are derived bottom-up. |
| HIER-I07 | Contact hours do not influence completion percentages. |
| HIER-I08 | Elective exclusion must not delete historical completion. |
| HIER-I09 | Re-enrollment must restore previously recorded completion. |
| HIER-I10 | Zero-leaf branches must not produce division-by-zero errors. |
| HIER-I11 | Stable identifiers must survive non-destructive metadata updates. |
| HIER-I12 | Export and restore must preserve hierarchy relationships. |

### Academic Year Inference

The Master Context documents the formula:
academic_year = (semester_number + 1) // 2
This formula is valid only when the source uses a sequential two-semester academic-year structure.
It must not override explicit year labels or institutional academic calendars.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **HIER-001**: Verify document-root representation.
- [ ] `[IN_PROGRESS]` **HIER-002**: Verify academic-year node relationships.
- [ ] `[IN_PROGRESS]` **HIER-003**: Verify semester node relationships.
- [ ] `[IN_PROGRESS]` **HIER-004**: Verify subject/course node relationships.
- [ ] `[IN_PROGRESS]` **HIER-005**: Verify module/unit node relationships.
- [ ] `[IN_PROGRESS]` **HIER-006**: Verify Tier-5 leaf representation.
- [ ] `[IN_PROGRESS]` **HIER-007**: Verify invalid hierarchy depth is rejected.
- [ ] `[IN_PROGRESS]` **HIER-008**: Verify academic-year inference behavior.
- [ ] `[IN_PROGRESS]` **HIER-009**: Verify explicit year labels override inferred values where appropriate.
- [ ] `[IN_PROGRESS]` **HIER-010**: Verify stable node identifiers.
- [ ] `[IN_PROGRESS]` **HIER-011**: Verify hierarchy survives backup and restore.

## 2.2 Leaf-Only Completion Persistence

### Documented Database Architecture

The Master Context identifies:
backend/app/models.py
backend/app/database.py
SyllabusRecord
LeafCompletionRecord
The database configuration reportedly includes:
SQLite.
WAL journal mode.
PRAGMA foreign_keys=ON.
PRAGMA busy_timeout=5000.
Unique completion association per syllabus and leaf.

### Required Persistence Model

Conceptually:

```text
SyllabusRecord
└── Academic Hierarchy
    └── Tier-5 Leaf
        └── LeafCompletionRecord
```

A parent node must not receive its own independent completion record.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **HIER-012**: Verify SQLite WAL configuration.
- [ ] `[IN_PROGRESS]` **HIER-013**: Verify foreign-key enforcement on every database connection.
- [ ] `[IN_PROGRESS]` **HIER-014**: Verify leaf completion uniqueness.
- [ ] `[IN_PROGRESS]` **HIER-015**: Verify parent completion is never persisted.
- [ ] `[IN_PROGRESS]` **HIER-016**: Verify atomic leaf-toggle transactions.
- [ ] `[IN_PROGRESS]` **HIER-017**: Verify atomic bulk branch updates.
- [ ] `[IN_PROGRESS]` **HIER-018**: Verify transaction rollback after partial failure.
- [ ] `[IN_PROGRESS]` **HIER-019**: Verify concurrent completion updates.
- [ ] `[IN_PROGRESS]` **HIER-020**: Verify stale or invalid leaf identifiers are rejected.
- [ ] `[IN_PROGRESS]` **HIER-021**: Verify historical completion survives metadata changes.
- [ ] `[IN_PROGRESS]` **HIER-022**: Verify database backup consistency.
- [ ] `[IN_PROGRESS]` **HIER-023**: Verify restore consistency.

## 2.3 Dynamic Tri-State Progress

### Required Parent States

| State | Condition |
| --- | --- |
| Checked | All enrolled descendant leaves are complete |
| Indeterminate | At least one, but not all, enrolled descendant leaves are complete |
| Unchecked | No enrolled descendant leaves are complete |

Progress formula:

\[ P = \frac{C}{T}\times100 \]

Where:
\(C\) = completed enrolled descendant leaves.
\(T\) = total enrolled descendant leaves.
When \(T=0\), progress must safely resolve to zero rather than generating an invalid numeric result.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **HIER-024**: Verify pure progress calculation functions.
- [ ] `[IN_PROGRESS]` **HIER-025**: Verify checked parent aggregation.
- [ ] `[IN_PROGRESS]` **HIER-026**: Verify indeterminate parent aggregation.
- [ ] `[IN_PROGRESS]` **HIER-027**: Verify unchecked parent aggregation.
- [ ] `[IN_PROGRESS]` **HIER-028**: Verify zero-leaf branch handling.
- [ ] `[IN_PROGRESS]` **HIER-029**: Verify enrolled-leaf filtering.
- [ ] `[IN_PROGRESS]` **HIER-030**: Verify bottom-up aggregation at every hierarchy level.
- [ ] `[IN_PROGRESS]` **HIER-031**: Verify frontend and backend progress calculations agree.
- [ ] `[IN_PROGRESS]` **HIER-032**: Verify bulk updates do not double-count leaves.

## 2.4 Elective Onboarding

### Documented API Contract

The README documents:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /api/syllabus/{id}/review | Review detected elective courses |
| POST | /api/syllabus/{id}/finalize-enrollment | Confirm elective enrollment |
| POST | /api/syllabus/{id}/update-enrollment | Reconfigure enrollment |

The Master Context identifies the frontend component:
ElectiveOnboardingModal.tsx

### Required Behavior

Detect mandatory and optional courses.
Lock mandatory courses as enrolled.
Present optional courses for student selection.
Exclude unenrolled electives from active progress.
Preserve completion records for excluded electives.
Restore previous completion when re-enrolled.
Recalculate active progress without deleting historical records.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **HIER-033**: Verify elective classification.
- [ ] `[IN_PROGRESS]` **HIER-034**: Verify mandatory-course locking.
- [ ] `[IN_PROGRESS]` **HIER-035**: Verify elective onboarding modal.
- [ ] `[IN_PROGRESS]` **HIER-036**: Verify enrollment confirmation persistence.
- [ ] `[IN_PROGRESS]` **HIER-037**: Verify idempotent enrollment finalization.
- [ ] `[IN_PROGRESS]` **HIER-038**: Verify dynamic elective reconfiguration.
- [ ] `[IN_PROGRESS]` **HIER-039**: Verify unenrollment does not delete completion records.
- [ ] `[IN_PROGRESS]` **HIER-040**: Verify re-enrollment restores completion.
- [ ] `[IN_PROGRESS]` **HIER-041**: Verify excluded electives do not affect active progress.
- [ ] `[IN_PROGRESS]` **HIER-042**: Verify mandatory subjects cannot be accidentally excluded.

## 2.5 Lab and Contact-Hour Metadata

Required Rules
Lab classification is contextual academic metadata.
Labs initialize collapsed where that behavior is configured.
Lab topics remain ordinary Tier-5 completion leaves.
Lab classification must not introduce separate completion mathematics.
Contact hours are informational.
Contact hours must never be used as completion weights.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **HIER-043**: Verify is_lab extraction and persistence.
- [ ] `[IN_PROGRESS]` **HIER-044**: Verify collapsed-by-default lab presentation.
- [ ] `[IN_PROGRESS]` **HIER-045**: Verify lab completion uses normal leaf persistence.
- [ ] `[IN_PROGRESS]` **HIER-046**: Verify module contact_hours metadata.
- [ ] `[IN_PROGRESS]` **HIER-047**: Verify contact-hour badge rendering.
- [ ] `[IN_PROGRESS]` **HIER-048**: Verify contact hours never affect progress mathematics.
- [ ] `[IN_PROGRESS]` **HIER-049**: Verify invalid or negative contact-hour values are rejected or normalized safely.

### Implementation Evidence

backend/app/schemas.py
backend/app/models.py
backend/app/database.py
backend/app/progress.py
backend/app/validation.py
frontend/src/types/syllabus.ts
frontend/src/lib/progress.ts
frontend/src/components/ElectiveOnboardingModal.tsx — documented filename; verify existence.
- **Tests: Not Yet Identified — Requires Repository Audit.**
- **Verification: Not Yet Verified.**

# Section 3 — Option A: Study Pacing & Exam Deadlines

Subsystem: Academic planning and study velocity
Audit status: [IN_PROGRESS]
This subsystem is part of the historical product requirements. Its current source implementation and persistence must be inspected independently.

## 3.1 Deadline Management

### Functional Requirements

The system should support:
Semester-level target dates.
Subject-level target dates.
Editable deadlines.
Persistent deadline records.
Overdue detection.
Deadline removal.
Date validation.
Historical deadline handling.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **PACE-001**: Inspect semester deadline data model.
- [ ] `[IN_PROGRESS]` **PACE-002**: Inspect subject deadline data model.
- [ ] `[IN_PROGRESS]` **PACE-003**: Verify deadline creation.
- [ ] `[IN_PROGRESS]` **PACE-004**: Verify deadline editing.
- [ ] `[IN_PROGRESS]` **PACE-005**: Verify deadline deletion.
- [ ] `[IN_PROGRESS]` **PACE-006**: Verify deadline persistence after restart.
- [ ] `[IN_PROGRESS]` **PACE-007**: Verify invalid date rejection.
- [ ] `[IN_PROGRESS]` **PACE-008**: Verify past-date handling.
- [ ] `[IN_PROGRESS]` **PACE-009**: Verify timezone-safe date calculations.
- [ ] `[IN_PROGRESS]` **PACE-010**: Verify overdue indicators.
- [ ] `[IN_PROGRESS]` **PACE-011**: Verify completed-subject deadline handling.
- [ ] `[IN_PROGRESS]` **PACE-012**: Verify historical deadline behavior after edits.

## 3.2 Study Velocity Engine

### Required Calculations

Remaining topics:

\[ R=T-C \]

Where:
\(T\) = total enrolled leaves.
\(C\) = completed enrolled leaves.
\(R\) = remaining leaves.
Remaining days:

\[ D=\max(1,\text{deadline date}-\text{current date}) \]

Weekly topic requirement:

\[ \text{Topics/Wk}=\frac{R}{D/7} \]

Contact-hour estimate:

\[ \text{Hours/Wk}= \frac{\text{Remaining Contact Hours}}{D/7} \]

These formulas are planning estimates. Contact hours must not influence actual completion percentages.
The implementation must define whether the calculation uses calendar days, inclusive dates, business days, or a configurable academic calendar.

### Required Outputs

| Output | Meaning |
| --- | --- |
| topics/wk | Required weekly topic completion rate |
| hrs/wk | Estimated weekly contact-hour requirement |
| Deadline status | Upcoming, at risk, overdue, or completed |
| Study readiness | Derived readiness classification |

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **PACE-013**: Verify remaining-topic calculations.
- [ ] `[IN_PROGRESS]` **PACE-014**: Verify weekly topic estimates.
- [ ] `[IN_PROGRESS]` **PACE-015**: Verify remaining contact-hour estimates.
- [ ] `[IN_PROGRESS]` **PACE-016**: Verify deadline-aware pacing.
- [ ] `[IN_PROGRESS]` **PACE-017**: Verify at-risk classification.
- [ ] `[IN_PROGRESS]` **PACE-018**: Verify overdue classification.
- [ ] `[IN_PROGRESS]` **PACE-019**: Verify completed-subject handling.
- [ ] `[IN_PROGRESS]` **PACE-020**: Verify zero-topic handling.
- [ ] `[IN_PROGRESS]` **PACE-021**: Verify zero-contact-hour handling.
- [ ] `[IN_PROGRESS]` **PACE-022**: Verify deadline-equals-current-date handling.
- [ ] `[IN_PROGRESS]` **PACE-023**: Verify negative remaining-time handling.
- [ ] `[IN_PROGRESS]` **PACE-024**: Verify frontend displays estimates without misrepresenting actual completion.

### Implementation Evidence

- **File: Not Yet Identified — Requires Repository Audit.**
Components: Not Yet Identified.
Database models: Not Yet Identified.
- **Tests: Not Yet Identified.**
- **Verification: Not Yet Verified.**

# Section 4 — Option B: Notes, Bookmarks & Multi-Format Exports

Subsystem: Student productivity and data portability
Audit status: [IN_PROGRESS]

## 4.1 Per-Topic Notes

### Functional Requirements

Every Tier-5 leaf should support an associated personal note.
Expected behavior:
Markdown-compatible content.
Topic-level association.
Auto-save.
Persistence after refresh.
Empty-note support.
Error recovery.
Protection against accidental stale writes.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **UTIL-001**: Verify note database model.
- [ ] `[IN_PROGRESS]` **UTIL-002**: Verify stable note-to-topic association.
- [ ] `[IN_PROGRESS]` **UTIL-003**: Verify notes drawer UI.
- [ ] `[IN_PROGRESS]` **UTIL-004**: Verify Markdown editing.
- [ ] `[IN_PROGRESS]` **UTIL-005**: Verify debounced auto-save.
- [ ] `[IN_PROGRESS]` **UTIL-006**: Verify persistence after application restart.
- [ ] `[IN_PROGRESS]` **UTIL-007**: Verify empty-note deletion or retention semantics.
- [ ] `[IN_PROGRESS]` **UTIL-008**: Verify save-failure recovery.
- [ ] `[IN_PROGRESS]` **UTIL-009**: Verify rapid successive edits do not produce stale writes.
- [ ] `[IN_PROGRESS]` **UTIL-010**: Verify note preservation after elective exclusion.
- [ ] `[IN_PROGRESS]` **UTIL-011**: Verify note preservation after non-destructive hierarchy updates.

## 4.2 Resource Bookmarks

### Functional Requirements

Resources must be associated with a syllabus topic.
Supported resource types may include:
Lecture notes.
YouTube videos.
University learning materials.
External websites.
Reference documentation.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **UTIL-012**: Verify bookmark data model.
- [ ] `[IN_PROGRESS]` **UTIL-013**: Verify topic-level resource association.
- [ ] `[IN_PROGRESS]` **UTIL-014**: Verify URL validation.
- [ ] `[IN_PROGRESS]` **UTIL-015**: Verify allowed URL schemes.
- [ ] `[IN_PROGRESS]` **UTIL-016**: Verify resource title and metadata persistence.
- [ ] `[IN_PROGRESS]` **UTIL-017**: Verify bookmark creation.
- [ ] `[IN_PROGRESS]` **UTIL-018**: Verify bookmark editing.
- [ ] `[IN_PROGRESS]` **UTIL-019**: Verify bookmark deletion.
- [ ] `[IN_PROGRESS]` **UTIL-020**: Verify resource restoration from backups.
- [ ] `[IN_PROGRESS]` **UTIL-021**: Verify unsafe URLs cannot trigger unintended server-side requests.

## 4.3 Export and Backup

### Required Formats

| Format | Purpose | Status |
| --- | --- | --- |
| Markdown | Readable curriculum export | [IN_PROGRESS] |
| Notion-compatible Markdown | External knowledge-base transfer | [IN_PROGRESS] |
| Schema 2.1 JSON | Structured backup | [IN_PROGRESS] |
| JSON restoration | Data recovery | [IN_PROGRESS] |
| Printable HTML | Browser printing | [IN_PROGRESS] |
| PDF | Portable report | [IN_PROGRESS] |

These are required capabilities, not independently verified current implementations.

### Backup Preservation Requirements

Every complete backup must preserve, where supported:
Document metadata.
Five-tier hierarchy.
Stable identifiers.
Leaf completion records.
Elective enrollment configuration.
Personal notes.
Resource bookmarks.
Deadline records.
Contact-hour metadata.
Lab metadata.
Source evidence and provenance.
Relevant version and migration metadata.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **UTIL-022**: Verify Markdown export.
- [ ] `[IN_PROGRESS]` **UTIL-023**: Verify Notion-compatible export.
- [ ] `[IN_PROGRESS]` **UTIL-024**: Verify Schema 2.1 JSON serialization.
- [ ] `[IN_PROGRESS]` **UTIL-025**: Verify JSON schema version identification.
- [ ] `[IN_PROGRESS]` **UTIL-026**: Verify backup import validation.
- [ ] `[IN_PROGRESS]` **UTIL-027**: Verify backup restoration.
- [ ] `[IN_PROGRESS]` **UTIL-028**: Verify printable HTML generation.
- [ ] `[IN_PROGRESS]` **UTIL-029**: Verify PDF report generation.
- [ ] `[IN_PROGRESS]` **UTIL-030**: Verify five-tier hierarchy preservation.
- [ ] `[IN_PROGRESS]` **UTIL-031**: Verify leaf completion preservation.
- [ ] `[IN_PROGRESS]` **UTIL-032**: Verify elective enrollment preservation.
- [ ] `[IN_PROGRESS]` **UTIL-033**: Verify notes preservation.
- [ ] `[IN_PROGRESS]` **UTIL-034**: Verify bookmarks preservation.
- [ ] `[IN_PROGRESS]` **UTIL-035**: Verify deadlines preservation.
- [ ] `[IN_PROGRESS]` **UTIL-036**: Verify malformed backup rejection.
- [ ] `[IN_PROGRESS]` **UTIL-037**: Verify duplicate identifiers cannot corrupt restoration.
- [ ] `[IN_PROGRESS]` **UTIL-038**: Verify interrupted restoration rollback.
- [ ] `[IN_PROGRESS]` **UTIL-039**: Verify older compatible backup versions can be handled safely.
- [ ] `[IN_PROGRESS]` **UTIL-040**: Verify restoration does not silently overwrite unrelated student data.

### Implementation Evidence

Files: Not Yet Identified — Requires Repository Audit.
Models: Not Yet Identified.
Components: Not Yet Identified.
- **Tests: Not Yet Identified.**
- **Verification: Not Yet Verified.**

# Section 5 — Option C: Ssrf-Safe University Web Portal Scraper

Subsystem: External academic content ingestion
Audit status: [IN_PROGRESS]

## 5.1 Web Ingestion

### Required Workflow

```text
University Portal URL
       │
       ▼
 URL Validation
       │
       ▼
Safe Network Resolution
       │
       ▼
 HTML Retrieval
       │
       ▼
Academic Content Extraction
       │
       ├──────> Embedded PDF Discovery
       │                 │
       │                 ▼
       │        PDF Download Validation
       │                 │
       │                 ▼
       │        Existing PDF Parser
       ▼                 │
Normalized Source Content ◄┘
       │
       ▼
Structured Extraction
       │
       ▼
Source-Grounded Five-Tier Curriculum
```

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **WEB-001**: Verify direct university URL ingestion.
- [ ] `[IN_PROGRESS]` **WEB-002**: Verify multi-tab or dual-tab ingestion workflow.
- [ ] `[IN_PROGRESS]` **WEB-003**: Verify HTML content extraction.
- [ ] `[IN_PROGRESS]` **WEB-004**: Verify embedded PDF discovery.
- [ ] `[IN_PROGRESS]` **WEB-005**: Verify safe PDF downloading.
- [ ] `[IN_PROGRESS]` **WEB-006**: Verify URL provenance.
- [ ] `[IN_PROGRESS]` **WEB-007**: Verify page and document association.
- [ ] `[IN_PROGRESS]` **WEB-008**: Verify unsupported website handling.
- [ ] `[IN_PROGRESS]` **WEB-009**: Verify extraction of links from supported academic portals.
- [ ] `[IN_PROGRESS]` **WEB-010**: Verify website failure recovery.
- [ ] `[IN_PROGRESS]` **WEB-011**: Verify duplicate resource handling.
- [ ] `[IN_PROGRESS]` **WEB-012**: Verify remote content size limits.

## 5.2 SSRF and Network Security

Required Threat Model
The scraper is a network boundary and must be treated as an untrusted URL ingestion service.
It must defend against:
Localhost requests.
Private IPv4 addresses.
Private IPv6 addresses.
Loopback addresses.
Link-local addresses.
Cloud metadata endpoints.
DNS rebinding.
Redirect-based SSRF.
Unsafe URL schemes.
DNS resolution changes.
Internal service access.
Excessive downloads.
Malicious content types.
Connection exhaustion.
Network Validation Requirements
Validation must occur at the actual network connection boundary.
Initial URL string validation is insufficient.
The implementation must:
Parse and normalize the URL.
Restrict permitted schemes, preferably HTTP and HTTPS only.
Resolve DNS.
Validate every resolved address.
Reject prohibited address classes.
Validate redirects independently.
Revalidate resolved addresses for each new connection.
Avoid a gap between DNS validation and connection.
Restrict response size.
Apply connection and total-request timeouts.
Validate content type and downloaded file signatures.
Prevent access to cloud metadata services and internal networks.
A robust implementation should use a network client or controlled transport that pins the validated destination address while preserving the correct TLS hostname and HTTP Host behavior.
Redirects must not bypass the same validation rules.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **WEB-013**: Verify localhost rejection.
- [ ] `[IN_PROGRESS]` **WEB-014**: Verify private IPv4 rejection.
- [ ] `[IN_PROGRESS]` **WEB-015**: Verify private IPv6 rejection.
- [ ] `[IN_PROGRESS]` **WEB-016**: Verify loopback rejection.
- [ ] `[IN_PROGRESS]` **WEB-017**: Verify link-local rejection.
- [ ] `[IN_PROGRESS]` **WEB-018**: Verify cloud metadata endpoint rejection.
- [ ] `[IN_PROGRESS]` **WEB-019**: Verify DNS rebinding protection.
- [ ] `[IN_PROGRESS]` **WEB-020**: Verify redirect destination validation.
- [ ] `[IN_PROGRESS]` **WEB-021**: Verify every redirect is independently validated.
- [ ] `[IN_PROGRESS]` **WEB-022**: Verify DNS resolution is checked at connection boundaries.
- [ ] `[IN_PROGRESS]` **WEB-023**: Verify unsafe URL schemes are rejected.
- [ ] `[IN_PROGRESS]` **WEB-024**: Verify excessive download sizes are rejected.
- [ ] `[IN_PROGRESS]` **WEB-025**: Verify connection timeouts.
- [ ] `[IN_PROGRESS]` **WEB-026**: Verify total request timeouts.
- [ ] `[IN_PROGRESS]` **WEB-027**: Verify content-type validation.
- [ ] `[IN_PROGRESS]` **WEB-028**: Verify PDF signature validation.
- [ ] `[IN_PROGRESS]` **WEB-029**: Verify downloaded files use isolated temporary storage.
- [ ] `[IN_PROGRESS]` **WEB-030**: Verify failed downloads are cleaned up.

### Implementation Evidence

- **File: Not Yet Identified — Requires Repository Audit.**
Network client: Not Yet Identified.
URL validation functions: Not Yet Identified.
- **Tests: Not Yet Identified.**
- **Verification: Not Yet Verified.**

# Section 6 — Windows 11 Stability, Winerror 1450 & Global Cli

Subsystem: Windows runtime reliability and application lifecycle
Audit status: [IN_PROGRESS]

## 6.1 Windows Stability and WinError 1450

Historical Root Cause
The Master Context documents an earlier Windows 11 ingestion failure:
WinError 1450: Insufficient system resources exist to complete the requested service.
The historical investigation identified three interacting problems:
Docling was initialized before lightweight PDF parsing, unnecessarily loading PyTorch and computer-vision dependencies.
Heavy synchronous parsing was performed directly inside an asynchronous FastAPI route.
The frontend upload request lacked reliable timeout and cancellation behavior.
The Master Context documents a layered mitigation introduced during Phase 6.

### Historical Remediation

Parser
Lightweight pypdf processing moved ahead of Docling.
Docling changed to an opt-in fallback.
Unique temporary filenames introduced.
Windows resource exceptions handled explicitly.
Resource limits introduced.
Backend
Blocking ingestion offloaded using asyncio.to_thread.
Bounded parsing concurrency introduced through a semaphore.
Request processing timeout added.
Structured HTTP errors introduced.
Windows launcher
Uvicorn reload monitoring restricted to backend/app.
Stable mode introduced.
Non-destructive port conflict checks added.
Frontend
AbortController introduced.
Upload timeout introduced.
Retry and cancellation controls added.
Upload state cleanup moved into finally handling.
Historical Configuration Changes
The Master Context records an important configuration evolution.

| Setting | Phase 6 | Phase 7 |
| --- | --- | --- |
| Upload limit | 25 MiB | 50 MiB |
| PDF page limit | 150 | 300 |
| Extracted characters | 500,000 | 1,500,000 |
| Parser timeout | 45 seconds | 300 seconds |
| DOC conversion timeout | Earlier bounded timeout | 30 seconds |
| Client upload timeout | 90 seconds | 300 seconds |

These are documented historical settings, not confirmation of the current effective configuration.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **WIN-001**: Verify lightweight-first PDF parsing.
- [ ] `[IN_PROGRESS]` **WIN-002**: Verify Docling remains opt-in where configured.
- [ ] `[IN_PROGRESS]` **WIN-003**: Verify bounded parsing concurrency.
- [ ] `[IN_PROGRESS]` **WIN-004**: Verify worker-thread isolation.
- [ ] `[IN_PROGRESS]` **WIN-005**: Verify parser timeout enforcement.
- [ ] `[IN_PROGRESS]` **WIN-006**: Verify temporary-file cleanup.
- [ ] `[IN_PROGRESS]` **WIN-007**: Verify unique temporary filenames.
- [ ] `[IN_PROGRESS]` **WIN-008**: Verify file-handle cleanup.
- [ ] `[IN_PROGRESS]` **WIN-009**: Verify LibreOffice subprocess timeouts.
- [ ] `[IN_PROGRESS]` **WIN-010**: Verify subprocess termination after failure.
- [ ] `[IN_PROGRESS]` **WIN-011**: Verify no orphaned parser processes.
- [ ] `[IN_PROGRESS]` **WIN-012**: Verify structured WinError 1450 handling.
- [ ] `[IN_PROGRESS]` **WIN-013**: Verify upload failure recovery.
- [ ] `[IN_PROGRESS]` **WIN-014**: Verify frontend cancellation.
- [ ] `[IN_PROGRESS]` **WIN-015**: Verify upload retry behavior.
- [ ] `[IN_PROGRESS]` **WIN-016**: Verify Windows path normalization.
- [ ] `[IN_PROGRESS]` **WIN-017**: Verify repeated large PDF uploads.
- [ ] `[IN_PROGRESS]` **WIN-018**: Verify concurrent document uploads.
- [ ] `[IN_PROGRESS]` **WIN-019**: Verify application responsiveness during extraction.

## 6.2 Windows Global CLI

Documented Architecture
The Master Context identifies:
scripts/launcher.py
scripts/setup-global-cli.ps1
scripts/uninstall-global-cli.ps1
scripts/README-launcher.md
Documented capabilities include:
Windows Job Object process supervision.
Single-instance lock.
Localhost control IPC.
Token-authenticated commands.
Non-destructive port conflict handling.
Ollama lifecycle checks.
Persistent log rotation.
Idempotent installation.
Non-destructive uninstallation.
Supported Commands
syllabus syllabus start syllabus stop syllabus status syllabus logs syllabus restart syllabus help

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **WIN-020**: Verify launcher argument parsing.
- [ ] `[IN_PROGRESS]` **WIN-021**: Verify installation from repository root.
- [ ] `[IN_PROGRESS]` **WIN-022**: Verify User PATH registration.
- [ ] `[IN_PROGRESS]` **WIN-023**: Verify command invocation outside repository directory.
- [ ] `[IN_PROGRESS]` **WIN-024**: Verify backend startup.
- [ ] `[IN_PROGRESS]` **WIN-025**: Verify frontend startup.
- [ ] `[IN_PROGRESS]` **WIN-026**: Verify optional Ollama startup behavior.
- [ ] `[IN_PROGRESS]` **WIN-027**: Verify existing Ollama daemon preservation.
- [ ] `[IN_PROGRESS]` **WIN-028**: Verify health-probe-based process reuse.
- [ ] `[IN_PROGRESS]` **WIN-029**: Verify Windows Job Object process supervision.
- [ ] `[IN_PROGRESS]` **WIN-030**: Verify orphan-process cleanup.
- [ ] `[IN_PROGRESS]` **WIN-031**: Verify cross-terminal control IPC authentication.
- [ ] `[IN_PROGRESS]` **WIN-032**: Verify single-instance lock recovery.
- [ ] `[IN_PROGRESS]` **WIN-033**: Verify log rotation.
- [ ] `[IN_PROGRESS]` **WIN-034**: Verify status reporting.
- [ ] `[IN_PROGRESS]` **WIN-035**: Verify log-following functionality.
- [ ] `[IN_PROGRESS]` **WIN-036**: Verify restart behavior.
- [ ] `[IN_PROGRESS]` **WIN-037**: Verify non-destructive port conflict handling.
- [ ] `[IN_PROGRESS]` **WIN-038**: Verify uninstall removes only application-owned artifacts.
- [ ] `[IN_PROGRESS]` **WIN-039**: Verify upgrade behavior.
- [ ] `[IN_PROGRESS]` **WIN-040**: Verify operation after Windows restart.
Historical Verification Claims
Master Context Phase 9 reports:
17 launcher-specific tests passed.
77 backend tests passed.
12 frontend tests passed.
TypeScript type checking passed.
These results are historical phase evidence and require reconciliation against the current test suite.

### Implementation Evidence

scripts/launcher.py
scripts/setup-global-cli.ps1
scripts/uninstall-global-cli.ps1
scripts/README-launcher.md
start-backend.ps1
backend/app/parser.py
backend/app/main.py
frontend/src/lib/api.ts
frontend/src/components/FileUpload.tsx — documented filename; verify exact path.
frontend/src/hooks/useSyllabus.ts
- **Verification: Not Yet Independently Verified.**

# Section 7 — Phase 10: Artifact Sanitization & Commercial Ui Polish

Next planned development phase
Phase status: [PLANNED]

## 7.1 Phase Objective

Improve extraction quality and frontend visual consistency without modifying the canonical academic hierarchy or compromising source evidence.
Phase 10 has two major workstreams:
Extraction artifact sanitization and semantic validation.
Commercial-quality UI modernization.
The extraction workstream should precede or be coordinated with UI polish because extraction defects directly affect the visual quality of the curriculum tree.

## 7.2 Extraction Artifact Sanitization

### Target Files

backend/app/parser.py
backend/app/validation.py

### Sanitization Requirements

- [ ] `[PLANNED]` **P10-001**: Inspect existing parser normalization rules.
- [ ] `[PLANNED]` **P10-002**: Build a representative extraction-artifact test corpus.
- [ ] `[PLANNED]` **P10-003**: Detect standalone pagination markers.
- [ ] `[PLANNED]` **P10-004**: Detect bare numeric artifacts.
- [ ] `[PLANNED]` **P10-005**: Detect repeated institutional headers.
- [ ] `[PLANNED]` **P10-006**: Detect repeated document titles.
- [ ] `[PLANNED]` **P10-007**: Detect page-boundary noise.
- [ ] `[PLANNED]` **P10-008**: Detect program-level headings incorrectly classified as leaves.
- [ ] `[PLANNED]` **P10-009**: Detect empty leaf names.
- [ ] `[PLANNED]` **P10-010**: Detect malformed academic headings.
- [ ] `[PLANNED]` **P10-011**: Prevent generic fallback names from silently entering the curriculum.
- [ ] `[PLANNED]` **P10-012**: Preserve genuine numbered topics.
- [ ] `[PLANNED]` **P10-013**: Preserve legitimate short academic topic names.
- [ ] `[PLANNED]` **P10-014**: Preserve source excerpts through sanitization.
- [ ] `[PLANNED]` **P10-015**: Preserve physical page references.
- [ ] `[PLANNED]` **P10-016**: Preserve source offsets after normalization.
- [ ] `[PLANNED]` **P10-017**: Reconstruct split tables across PDF pages.
- [ ] `[PLANNED]` **P10-018**: Associate continued table rows with the correct academic heading.
- [ ] `[PLANNED]` **P10-019**: Prevent table reconstruction from merging unrelated subjects.
- [ ] `[PLANNED]` **P10-020**: Add deterministic normalization tests.

### Generic Fallback Prevention

The following fallback names must not be inserted automatically as real academic content:
- `General Curriculum Course 2 Unit 2`
If the source cannot establish a legitimate name, the extraction must be flagged for review.
It must not fabricate a label merely to satisfy a schema requirement.

### Sanitization Safety Rule

Do not use broad regular expressions that remove every short line, number, Roman numeral, or numbered heading.
Examples of valid academic content that must remain eligible for preservation:
- `1. Introduction to Algorithms`
- `2. Binary Search Trees`
- `3. TCP/IP Fundamentals`
- `Unit 1: Mathematics`
- `Module IV: Database Transactions`
A valid numbered topic must not be discarded simply because it resembles a page number.

## 7.3 Semantic Validation

Requirements
- [ ] `[PLANNED]` **P10-021**: Introduce context-aware heading classification.
- [ ] `[PLANNED]` **P10-022**: Validate parent-child relationships.
- [ ] `[PLANNED]` **P10-023**: Introduce confidence-based review classification.
- [ ] `[PLANNED]` **P10-024**: Verify source excerpt relevance.
- [ ] `[PLANNED]` **P10-025**: Improve duplicate detection.
- [ ] `[PLANNED]` **P10-026**: Implement conservative semantic normalization.
- [ ] `[PLANNED]` **P10-027**: Recover incomplete but source-supported hierarchy.
- [ ] `[PLANNED]` **P10-028**: Flag uncertain academic classification.
- [ ] `[PLANNED]` **P10-029**: Prevent fabricated parent nodes.
- [ ] `[PLANNED]` **P10-030**: Verify hierarchy remains exactly five tiers.
Semantic Validation Policy
The validation system must distinguish:

| Condition | Required Action |
| --- | --- |
| Strong source support | Accept |
| Partial source support | Flag for review |
| Ambiguous heading | Preserve evidence and request review |
| Duplicate content | Resolve deterministically |
| Unsupported generated content | Reject |
| Missing academic relationship | Flag or recover only when supported |

The system must prefer uncertainty over fabricated certainty.

## 7.4 Commercial UI Modernization

### Target Files

frontend/src/SyllabusTree.tsx
frontend/src/index.css
Related card and badge components.
Visual Requirements
- [ ] `[PLANNED]` **P10-031**: Audit the current visual design.
- [ ] `[PLANNED]` **P10-032**: Establish consistent surface hierarchy.
- [ ] `[PLANNED]` **P10-033**: Improve card elevation.
- [ ] `[PLANNED]` **P10-034**: Introduce subtle hairline borders.
- [ ] `[PLANNED]` **P10-035**: Reduce repetitive outlines.
- [ ] `[PLANNED]` **P10-036**: Improve typography hierarchy.
- [ ] `[PLANNED]` **P10-037**: Introduce JetBrains Mono for suitable numerical metadata.
- [ ] `[PLANNED]` **P10-038**: Standardize spacing tokens.
- [ ] `[PLANNED]` **P10-039**: Improve information density.
- [ ] `[PLANNED]` **P10-040**: Improve empty states.
- [ ] `[PLANNED]` **P10-041**: Improve loading states.
- [ ] `[PLANNED]` **P10-042**: Improve error states.
- [ ] `[PLANNED]` **P10-043**: Improve hover behavior.
- [ ] `[PLANNED]` **P10-044**: Improve visible keyboard-focus behavior.
- [ ] `[PLANNED]` **P10-045**: Verify responsive behavior remains unaffected.

## 7.5 Badge Hygiene

Requirements
- [ ] `[PLANNED]` **P10-046**: Hide contact-hour badges when the value is missing.
- [ ] `[PLANNED]` **P10-047**: Hide contact-hour badges when the value is zero.
- [ ] `[PLANNED]` **P10-048**: Reject or safely handle invalid negative values.
- [ ] `[PLANNED]` **P10-049**: Remove repetitive Contact Hours Not Specified labels.
- [ ] `[PLANNED]` **P10-050**: Separate informational badges from completion indicators.
- [ ] `[PLANNED]` **P10-051**: Standardize badge sizing.
- [ ] `[PLANNED]` **P10-052**: Remove unnecessary decorative badges.
- [ ] `[PLANNED]` **P10-053**: Preserve useful lab and academic metadata.

## 7.6 Adaptive Theme

Requirements
- [ ] `[PLANNED]` **P10-054**: Implement centralized theme tokens.
- [ ] `[PLANNED]` **P10-055**: Establish dark-theme palette.
- [ ] `[PLANNED]` **P10-056**: Establish light-theme palette.
- [ ] `[PLANNED]` **P10-057**: Implement theme switching.
- [ ] `[PLANNED]` **P10-058**: Persist theme preference.
- [ ] `[PLANNED]` **P10-059**: Add system-theme detection.
- [ ] `[PLANNED]` **P10-060**: Verify theme consistency in nested cards.
- [ ] `[PLANNED]` **P10-061**: Verify theme consistency in drawers and dialogs.
- [ ] `[PLANNED]` **P10-062**: Verify WCAG contrast requirements.
- [ ] `[PLANNED]` **P10-063**: Verify focus indicators in both themes.

## 7.7 Phase 10 Acceptance Criteria

Phase 10 may only become [COMPLETED] when:
[PLANNED] Pagination artifacts are rejected without deleting genuine numbered topics.
[PLANNED] Repeated institutional headers are handled correctly.
[PLANNED] Split-page tables retain correct relationships.
[PLANNED] Source evidence remains intact.
[PLANNED] Five-tier hierarchy remains unchanged.
[PLANNED] Ambiguous extraction receives review status.
[PLANNED] Generic fallback names do not become fabricated academic content.
[PLANNED] Contact-hour badges are conditionally rendered.
[PLANNED] Dark and light themes work consistently.
[PLANNED] Existing tree interactions remain functional.
[PLANNED] All relevant backend and frontend regression tests pass.
[PLANNED] Documentation is updated.

### Implementation Evidence

Implementation Evidence: Not Applicable — Planned Work.

# Section 8 — Phase 11: Cross-Device Mobile Ui, Pwa & Offline Synchronization

Phase status: [PLANNED]

## 8.1 Phase Objective

Transform the existing web application into a responsive, installable, offline-capable academic planning experience.
The phase must preserve local-first operation while introducing reliable synchronization semantics.
Target viewport range: 360px–2560px.
A responsive web application must not automatically be described as a native mobile application.
Capacitor readiness and actual native packaging must be verified separately.

## 8.2 Responsive Layout

Requirements
- [ ] `[PLANNED]` **P11-001**: Establish mobile-first layout architecture.
- [ ] `[PLANNED]` **P11-002**: Verify 360px viewport rendering.
- [ ] `[PLANNED]` **P11-003**: Implement tablet layout.
- [ ] `[PLANNED]` **P11-004**: Optimize desktop layout.
- [ ] `[PLANNED]` **P11-005**: Verify large desktop rendering at 2560px.
- [ ] `[PLANNED]` **P11-006**: Implement responsive sidebar.
- [ ] `[PLANNED]` **P11-007**: Implement mobile slide-over navigation.
- [ ] `[PLANNED]` **P11-008**: Adapt tree indentation.
- [ ] `[PLANNED]` **P11-009**: Adapt action groups.
- [ ] `[PLANNED]` **P11-010**: Adapt typography.
- [ ] `[PLANNED]` **P11-011**: Prevent horizontal overflow.
- [ ] `[PLANNED]` **P11-012**: Introduce touch-friendly controls.
- [ ] `[PLANNED]` **P11-013**: Meet 44 × 44 px minimum interactive target guidance.
- [ ] `[PLANNED]` **P11-014**: Implement safe-area padding.
- [ ] `[PLANNED]` **P11-015**: Verify mobile keyboard and viewport interactions.

## 8.3 Mobile Navigation

- [ ] `[PLANNED]` **P11-016**: Implement mobile navigation drawer.
- [ ] `[PLANNED]` **P11-017**: Implement bottom navigation or action bar where appropriate.
- [ ] `[PLANNED]` **P11-018**: Implement accessible drawer controls.
- [ ] `[PLANNED]` **P11-019**: Implement backdrop dismissal.
- [ ] `[PLANNED]` **P11-020**: Implement Escape dismissal where supported.
- [ ] `[PLANNED]` **P11-021**: Implement focus trapping.
- [ ] `[PLANNED]` **P11-022**: Restore focus after closing.
- [ ] `[PLANNED]` **P11-023**: Implement scroll locking.
- [ ] `[PLANNED]` **P11-024**: Verify safe-area compatibility.
- [ ] `[PLANNED]` **P11-025**: Prevent overlapping fixed-position elements.

## 8.4 Mobile Action Management

Current action categories requiring responsive treatment:
Evidence.
Notes.
Resources.
Target Date.
Export & Backup.
Configure Electives.
Delete Document.
Requirements
- [ ] `[PLANNED]` **P11-026**: Audit current action-row density.
- [ ] `[PLANNED]` **P11-027**: Introduce contextual action menus.
- [ ] `[PLANNED]` **P11-028**: Implement compact action groups.
- [ ] `[PLANNED]` **P11-029**: Ensure touch-accessible actions.
- [ ] `[PLANNED]` **P11-030**: Add accessible action labels.
- [ ] `[PLANNED]` **P11-031**: Add destructive-action confirmation.
- [ ] `[PLANNED]` **P11-032**: Standardize action priority.
- [ ] `[PLANNED]` **P11-033**: Preserve all existing desktop actions.

## 8.5 Command Palette

Target: frontend/src/components/CommandPalette.tsx

### Keyboard Shortcuts

| Platform | Shortcut |
| --- | --- |
| macOS | Cmd+K |
| Windows | Ctrl+K |
| Linux | Ctrl+K |

### Search Requirements

- [ ] `[PLANNED]` **P11-034**: Implement accessible command-palette modal.
- [ ] `[PLANNED]` **P11-035**: Implement instant local search.
- [ ] `[PLANNED]` **P11-036**: Search academic years.
- [ ] `[PLANNED]` **P11-037**: Search semesters.
- [ ] `[PLANNED]` **P11-038**: Search subjects.
- [ ] `[PLANNED]` **P11-039**: Search modules.
- [ ] `[PLANNED]` **P11-040**: Search topics.
- [ ] `[PLANNED]` **P11-041**: Search notes.
- [ ] `[PLANNED]` **P11-042**: Implement keyboard navigation.
- [ ] `[PLANNED]` **P11-043**: Implement Escape dismissal.
- [ ] `[PLANNED]` **P11-044**: Restore focus after dismissal.
- [ ] `[PLANNED]` **P11-045**: Implement empty-result state.
- [ ] `[PLANNED]` **P11-046**: Prevent duplicate shortcut listeners.
- [ ] `[PLANNED]` **P11-047**: Ensure search does not generate unnecessary server requests.
Quick Actions
- [ ] `[PLANNED]` **P11-048**: Filter incomplete topics.
- [ ] `[PLANNED]` **P11-049**: Filter at-risk subjects.
- [ ] `[PLANNED]` **P11-050**: Collapse all tree branches.
- [ ] `[PLANNED]` **P11-051**: Expand all tree branches.
- [ ] `[PLANNED]` **P11-052**: Switch theme.
- [ ] `[PLANNED]` **P11-053**: Navigate to matching academic nodes.

## 8.6 PWA Foundation

### Target Files

frontend/vite.config.ts
frontend/src/lib/offlineSync.ts
Requirements
- [ ] `[PLANNED]` **P11-054**: Audit existing Vite PWA configuration.
- [ ] `[PLANNED]` **P11-055**: Configure web app manifest.
- [ ] `[PLANNED]` **P11-056**: Add application icons.
- [ ] `[PLANNED]` **P11-057**: Configure service worker.
- [ ] `[PLANNED]` **P11-058**: Verify installation eligibility.
- [ ] `[PLANNED]` **P11-059**: Implement offline application shell.
- [ ] `[PLANNED]` **P11-060**: Introduce versioned caches.
- [ ] `[PLANNED]` **P11-061**: Implement service-worker update lifecycle.
- [ ] `[PLANNED]` **P11-062**: Implement cache invalidation.
- [ ] `[PLANNED]` **P11-063**: Implement offline fallback.
- [ ] `[PLANNED]` **P11-064**: Verify cache cleanup after application updates.
- [ ] `[PLANNED]` **P11-065**: Verify offline startup after prior installation.
Cache Security
Do not indiscriminately cache:
Uploaded academic documents.
Private API responses.
Authentication credentials.
Sensitive personal notes.
Provider API keys.
Cache only explicitly approved static resources and non-sensitive data.

## 8.7 IndexedDB Offline Outbox

### Target Architecture

```text
User Interaction
       │
       ▼
Local Application State
       │
       ▼
   IndexedDB
       │
       ▼
 offlineOutbox
       │
       ▼
Network Available?
       ├────── No ──────> Keep Pending
       │
       └───── Yes ─────> Validate Operation
                               │
                               ▼
                        Send to Backend
                               │
                               ▼
                       Idempotency Check
                               │
                               ▼
                      Persist Server Result
                               │
                               ▼
                      Update Local State
```

### Required Operation Types

Leaf completion changes.
Note edits.
Future supported user-generated operations.
Required Outbox Fields
The final schema must be decided during implementation, but the following concepts are mandatory:

| Field | Purpose |
| --- | --- |
| operation_id | Globally unique idempotency identifier |
| entity_id | Target leaf or note |
| operation_type | Operation classification |
| payload | Validated operation data |
| created_at | Local operation creation time |
| base_version | Version against which the change was made |
| attempt_count | Retry tracking |
| status | Pending, syncing, failed, or acknowledged |
| last_error | Safe diagnostic information |

### Engineering Checklist

- [ ] `[PLANNED]` **P11-066**: Define IndexedDB database schema.
- [ ] `[PLANNED]` **P11-067**: Create offlineOutbox store.
- [ ] `[PLANNED]` **P11-068**: Persist offline leaf completion changes.
- [ ] `[PLANNED]` **P11-069**: Persist offline note edits.
- [ ] `[PLANNED]` **P11-070**: Generate unique operation identifiers.
- [ ] `[PLANNED]` **P11-071**: Implement idempotent operation replay.
- [ ] `[PLANNED]` **P11-072**: Preserve operation ordering per entity.
- [ ] `[PLANNED]` **P11-073**: Implement bounded retries.
- [ ] `[PLANNED]` **P11-074**: Detect network reconnection.
- [ ] `[PLANNED]` **P11-075**: Recover failed operations.
- [ ] `[PLANNED]` **P11-076**: Remove acknowledged queue entries safely.
- [ ] `[PLANNED]` **P11-077**: Prevent duplicate operation insertion.
- [ ] `[PLANNED]` **P11-078**: Implement synchronization status indicators.
- [ ] `[PLANNED]` **P11-079**: Implement stale-write detection.
- [ ] `[PLANNED]` **P11-080**: Implement conflict resolution.
- [ ] `[PLANNED]` **P11-081**: Preserve unsynchronized changes after application restart.
- [ ] `[PLANNED]` **P11-082**: Prevent queue loss after service-worker updates.
Synchronization Semantics
The following contract must be established before implementation.
Leaf completion
A leaf completion operation should be idempotent and based on an explicit desired state, rather than replaying an ambiguous toggle.
For example:
{ "operation_id": "unique-operation-id", "leaf_id": "stable-leaf-id", "completed": true, "base_version": 12 }
The server must deduplicate repeated operations using operation_id.
Notes
Notes require version-aware updates.
A stale note edit must not silently overwrite a newer server-side version.
Conflict handling must support at least one explicit outcome:
Automatic merge when safe.
User-assisted conflict resolution.
Preserve both versions until the conflict is resolved.
Ordering
Operations affecting the same entity must be replayed in a deterministic order.
An older completion operation must not accidentally reverse a newer desired state.
Server dependencies
The current backend API documented in the README does not establish a complete offline synchronization contract.
The following backend capabilities must therefore be evaluated and implemented where missing:
Idempotency-key handling.
Operation acknowledgment.
Entity versioning.
Conflict detection.
Conditional updates.
Stable operation ordering.
Safe retry responses.
Optional synchronization cursor or change-feed support.
Backend Dependency Checklist
- [ ] `[PLANNED]` **P11-083**: Define idempotent completion API contract.
- [ ] `[PLANNED]` **P11-084**: Define note versioning contract.
- [ ] `[PLANNED]` **P11-085**: Define stale-update response semantics.
- [ ] `[PLANNED]` **P11-086**: Define conflict response schema.
- [ ] `[PLANNED]` **P11-087**: Define operation acknowledgment schema.
- [ ] `[PLANNED]` **P11-088**: Define synchronization retry semantics.
- [ ] `[PLANNED]` **P11-089**: Verify API backward compatibility.

## 8.8 Capacitor Readiness

Capacitor integration must be treated as a separate deliverable.
Requirements
- [ ] `[PLANNED]` **P11-090**: Verify WebView-compatible layout.
- [ ] `[PLANNED]` **P11-091**: Verify safe-area handling.
- [ ] `[PLANNED]` **P11-092**: Verify touch interaction.
- [ ] `[PLANNED]` **P11-093**: Verify offline persistence compatibility.
- [ ] `[PLANNED]` **P11-094**: Evaluate platform-specific storage requirements.
- [ ] `[PLANNED]` **P11-095**: Verify navigation compatibility.
- [ ] `[PLANNED]` **P11-096**: Prepare Capacitor integration architecture.
- [ ] `[PLANNED]` **P11-097**: Establish native build documentation.
- [ ] `[PLANNED]` **P11-098**: Verify Android package build.
- [ ] `[PLANNED]` **P11-099**: Verify native lifecycle behavior.
- [ ] `[PLANNED]` **P11-100**: Verify offline operation on a physical mobile device.

## 8.9 Phase 11 Acceptance Criteria

[PLANNED] Application renders correctly at 360px.
[PLANNED] Application renders correctly on tablet.
[PLANNED] Application renders correctly at 2560px.
[PLANNED] No unintended horizontal overflow exists.
[PLANNED] Mobile navigation is accessible.
[PLANNED] Action controls are touch-friendly.
[PLANNED] Command palette supports platform shortcuts.
[PLANNED] Search operates on loaded local application data.
- [ ] `[PLANNED]` **PWA**: can be installed in supported browsers.
[PLANNED] Offline application shell loads.
[PLANNED] Offline leaf completion is preserved.
[PLANNED] Offline note edits are preserved.
[PLANNED] Duplicate operations are rejected or deduplicated.
[PLANNED] Operation ordering is deterministic.
[PLANNED] Note conflicts do not silently overwrite newer content.
[PLANNED] Reconnection synchronization is verified.
[PLANNED] Existing online functionality remains intact.
[PLANNED] Capacitor support is separately documented and verified if included in the release.

### Implementation Evidence

Implementation Evidence: Not Applicable — Planned Work.

# Section 9 — Phase 12: Study Analytics & Spaced-Repetition Scheduler

Phase status: [PLANNED]

## 9.1 Phase Objective

Introduce measurable academic progress analytics and a persistent revision scheduling system.
Phase 12 must build on reliable completion data rather than attempting to reconstruct historical student behavior from current checklist states.
Two distinct capabilities are required:
Study analytics: understand progress over time.
Spaced repetition: schedule future revision based on recall performance.
These systems must share stable academic topic identifiers but must maintain separate domain records.

## 9.2 Study Analytics

### Required Metrics

| Metric | Description | Data Requirement |
| --- | --- | --- |
| Daily progress | Daily completion changes | Completion events |
| Weekly progress | Weekly completion trends | Timestamped events |
| Monthly progress | Monthly progress trends | Timestamped events |
| Subject analytics | Subject completion and remaining topics | Current hierarchy and completion records |
| Semester analytics | Aggregated semester performance | Current hierarchy |
| Topic trends | Topic completion over time | Completion history |
| Study consistency | Frequency of recorded study activity | Historical events |
| Deadline readiness | Remaining workload versus time | Deadlines and current progress |
| At-risk subjects | Subjects with insufficient projected progress | Deadline and pacing calculations |

### Engineering Checklist

- [x] `[COMPLETED]` **P12-001**: Define analytics domain model.
- [x] `[COMPLETED]` **P12-002**: Define historical completion-event schema.
- [x] `[COMPLETED]` **P12-003**: Record leaf completion timestamps.
- [x] `[COMPLETED]` **P12-004**: Record leaf uncompletion events.
- [x] `[COMPLETED]` **P12-005**: Preserve event history after progress changes.
- [x] `[COMPLETED]` **P12-006**: Define daily aggregation.
- [x] `[COMPLETED]` **P12-007**: Define weekly aggregation.
- [x] `[COMPLETED]` **P12-008**: Define monthly aggregation.
- [x] `[COMPLETED]` **P12-009**: Implement subject-level analytics.
- [x] `[COMPLETED]` **P12-010**: Implement semester-level analytics.
- [x] `[COMPLETED]` **P12-011**: Implement topic completion trends.
- [x] `[COMPLETED]` **P12-012**: Implement study consistency metrics.
- [x] `[COMPLETED]` **P12-013**: Implement deadline readiness calculations.
- [x] `[COMPLETED]` **P12-014**: Implement at-risk subject identification.
- [x] `[COMPLETED]` **P12-015**: Define analytics treatment for excluded electives.
- [x] `[COMPLETED]` **P12-016**: Define analytics treatment for archived topics.
- [x] `[COMPLETED]` **P12-017**: Implement historical analytics export.
- [x] `[COMPLETED]` **P12-018**: Verify analytics survive backup and restore.
Historical Data Integrity
The application must not invent past completion events.
For existing databases that contain only current leaf completion states:
Existing completed leaves may be counted in current progress.
Their exact historical completion dates must be treated as unknown.
They must not be assigned fabricated historical timestamps.
Historical analytics must clearly identify incomplete historical coverage.
A migration may record an initial baseline snapshot, but it must identify the snapshot as an initialization event rather than an actual historical study event.

### Recommended Event Model

A future implementation may introduce an append-only completion event table.
Conceptual structure:

```text
CompletionEvent
├── event_id
├── syllabus_id
├── leaf_id
├── event_type
├── occurred_at
├── recorded_at
├── source
└── event_metadata
```

Possible event types:
- `leaf_completed`
- `leaf_uncompleted`
- `completion_corrected`
The final schema must account for:
Stable identifiers.
Idempotency.
Timezone handling.
Imported data.
Historical corrections.
Deleted or archived academic nodes.

## 9.3 Spaced-Repetition Scheduler

### Functional Requirements

Topic-level revision scheduling.
Review history.
Recall-quality input.
Difficulty tracking.
Review interval adjustment.
Overdue review detection.
Daily revision queue.
Weekly revision planning.
Manual rescheduling.
Persistent review results.
Algorithm Selection
No scheduling algorithm is established as implemented.
Candidate approaches:

| Algorithm | Characteristics | Consideration |
| --- | --- | --- |
| SM-2 | Established interval-based scheduling | More detailed recall-quality model |
| Simple interval scheduler | Easier to implement and explain | Less adaptive |
| Configurable hybrid | Combines simple intervals with user adjustments | Greater implementation complexity |

The algorithm must be formally selected before implementation.

### Engineering Checklist

- [x] `[COMPLETED]` **P12-019**: Define scheduler requirements.
- [x] `[COMPLETED]` **P12-020**: Evaluate SM-2.
- [x] `[COMPLETED]` **P12-021**: Evaluate a configurable interval-based alternative.
- [x] `[COMPLETED]` **P12-022**: Select and document the scheduling algorithm (SM-2-v1).
- [x] `[COMPLETED]` **P12-023**: Define initial review intervals.
- [x] `[COMPLETED]` **P12-024**: Define recall-quality input (ratings 1-4).
- [x] `[COMPLETED]` **P12-025**: Define difficulty tracking (ease factor >= 1.3).
- [x] `[COMPLETED]` **P12-026**: Implement review scheduling.
- [x] `[COMPLETED]` **P12-027**: Persist review history.
- [x] `[COMPLETED]` **P12-028**: Implement interval adjustment.
- [x] `[COMPLETED]` **P12-029**: Detect overdue reviews.
- [x] `[COMPLETED]` **P12-030**: Implement daily review queue.
- [x] `[COMPLETED]` **P12-031**: Implement weekly review planning.
- [x] `[COMPLETED]` **P12-032**: Support manual rescheduling.
- [x] `[COMPLETED]` **P12-033**: Verify scheduling determinism.
- [x] `[COMPLETED]` **P12-034**: Verify review history persistence.

### Proposed Review Record

```text
TopicReview
├── review_id
├── leaf_id
├── scheduled_at
├── reviewed_at
├── recall_quality
├── difficulty
├── previous_interval
├── next_interval
├── algorithm_version
└── review_notes
```

The exact schema is subject to the selected scheduling algorithm.

## 9.4 Study Workflow Integration

- [x] `[COMPLETED]` **P12-035**: Integrate review scheduling with the existing topic hierarchy.
- [x] `[COMPLETED]` **P12-036**: Provide notes access from review sessions.
- [x] `[COMPLETED]` Provide resource access from review sessions.
- [x] `[COMPLETED]` Build review progress dashboard.
- [x] `[COMPLETED]` Integrate deadline-aware review prioritization.
- [x] `[COMPLETED]` Respect elective enrollment.
- [x] `[COMPLETED]` Define completed-topic review behavior.
- [x] `[COMPLETED]` Support manual review scheduling.
- [x] `[COMPLETED]` Ensure review completion does not modify academic completion records.
- [x] `[COMPLETED]` Ensure revision activity is distinguishable from new-topic completion.

## 9.5 Data Integrity and Compatibility

- [x] `[COMPLETED]` **P12-036**: Preserve existing completion records.
- [x] `[COMPLETED]` **P12-037**: Add backward-compatible event migration.
- [x] `[COMPLETED]` **P12-038**: Persist review history.
- [x] `[COMPLETED]` **P12-039**: Support review-history export.
- [x] `[COMPLETED]` **P12-040**: Support review-history restoration.
- [x] `[COMPLETED]` **P12-041**: Handle deleted topics.
- [x] `[COMPLETED]` **P12-042**: Handle archived topics.
- [x] `[COMPLETED]` **P12-043**: Handle changed syllabus structures.
- [x] `[COMPLETED]` **P12-044**: Verify analytics and scheduler migrations are non-destructive.

## 9.6 Phase 12 Acceptance Criteria

[PLANNED] Historical completion events are recorded reliably.
[PLANNED] No fabricated historical events are introduced.
[PLANNED] Daily, weekly, and monthly analytics are reproducible.
[PLANNED] Subject and semester aggregations are accurate.
[PLANNED] Review intervals are generated using the documented algorithm.
[PLANNED] Recall-quality changes affect future scheduling correctly.
[PLANNED] Overdue reviews are detected.
[PLANNED] Review history survives application restart.
[PLANNED] Review records survive backup and restore.
[PLANNED] Review operations do not corrupt leaf completion records.
[PLANNED] Existing SQLite databases migrate safely.
[PLANNED] Existing application features pass regression testing.

### Implementation Evidence

Implementation Evidence: Not Applicable — Planned Work.

# Section 10 — Cross-Phase Engineering Requirements

These requirements apply to every existing and future implementation phase.

## 10.1 Backward Compatibility

### Non-Negotiable Requirements

Preserve the canonical five-tier hierarchy.
Preserve leaf-only completion persistence.
Preserve historical completion records.
Preserve existing SQLite databases.
Avoid destructive schema modifications.
Preserve elective configuration.
Preserve existing API behavior unless explicitly versioned.
Preserve Schema 2.1 backup compatibility.
Preserve source provenance.
Preserve notes and bookmarks when supported.
Document every required migration.

### Engineering Checklist

- [ ] `[IN_PROGRESS]` **ARCH-001**: Inventory all current SQLite tables.
- [ ] `[IN_PROGRESS]` **ARCH-002**: Inventory foreign-key relationships.
- [ ] `[IN_PROGRESS]` **ARCH-003**: Identify the current database schema version.
- [ ] `[IN_PROGRESS]` **ARCH-004**: Inventory existing migration mechanisms.
- [ ] `[IN_PROGRESS]` **ARCH-005**: Establish a database migration policy.
- [ ] `[IN_PROGRESS]` **ARCH-006**: Verify migration rollback or recovery strategy.
- [ ] `[IN_PROGRESS]` **ARCH-007**: Verify existing completion records survive migrations.
- [ ] `[IN_PROGRESS]` **ARCH-008**: Verify existing syllabus records survive migrations.
- [ ] `[IN_PROGRESS]` **ARCH-009**: Verify API contract compatibility.
- [ ] `[IN_PROGRESS]` **ARCH-010**: Verify Schema 2.1 import/export compatibility.
- [ ] `[IN_PROGRESS]` **ARCH-011**: Establish backup-before-migration procedures.
- [ ] `[IN_PROGRESS]` **ARCH-012**: Verify interrupted migrations cannot silently corrupt the database.

## 10.2 Security

Document Security
- [ ] `[IN_PROGRESS]` **ARCH-013**: Verify uploaded documents are validated before parsing.
- [ ] `[IN_PROGRESS]` **ARCH-014**: Verify temporary files are isolated.
- [ ] `[IN_PROGRESS]` **ARCH-015**: Verify temporary files are cleaned after failures.
- [ ] `[IN_PROGRESS]` **ARCH-016**: Verify document content is treated as untrusted input.
- [ ] `[IN_PROGRESS]` **ARCH-017**: Verify prompt-injection delimiters remain enforced.
- [ ] `[IN_PROGRESS]` **ARCH-018**: Verify extracted content is validated before persistence.
Application Security
- [ ] `[IN_PROGRESS]` **ARCH-019**: Verify environment secrets remain outside source control.
- [ ] `[IN_PROGRESS]` **ARCH-020**: Verify API credentials are not exposed to the frontend.
- [ ] `[IN_PROGRESS]` **ARCH-021**: Verify logs do not expose private academic content unnecessarily.
- [ ] `[IN_PROGRESS]` **ARCH-022**: Verify backup files are validated before import.
- [ ] `[IN_PROGRESS]` **ARCH-023**: Verify resource URLs use safe schemes.
- [ ] `[IN_PROGRESS]` **ARCH-024**: Verify SSRF protection is enforced at network boundaries.
- [ ] `[IN_PROGRESS]` **ARCH-025**: Verify local IPC authentication for the CLI.
- [ ] `[IN_PROGRESS]` **ARCH-026**: Verify untrusted imported identifiers cannot overwrite unrelated records.

## 10.3 Performance

- [ ] `[IN_PROGRESS]` **ARCH-027**: Establish baseline PDF processing performance.
- [ ] `[IN_PROGRESS]` **ARCH-028**: Measure memory consumption for large PDFs.
- [ ] `[IN_PROGRESS]` **ARCH-029**: Verify bounded concurrent parsing.
- [ ] `[IN_PROGRESS]` **ARCH-030**: Measure deep-tree rendering performance.
- [ ] `[IN_PROGRESS]` **ARCH-031**: Verify search responsiveness on large syllabi.
- [ ] `[IN_PROGRESS]` **ARCH-032**: Measure SQLite transaction performance.
- [ ] `[PLANNED]` **ARCH-033**: Measure IndexedDB operation performance.
- [ ] `[PLANNED]` **ARCH-034**: Measure background synchronization overhead.
- [ ] `[PLANNED]` **ARCH-035**: Establish mobile rendering performance baselines.
- [ ] `[IN_PROGRESS]` **ARCH-036**: Verify memory and resource cleanup after repeated uploads.

## 10.4 Accessibility

- [ ] `[IN_PROGRESS]` **ARCH-037**: Verify keyboard navigation.
- [ ] `[IN_PROGRESS]` **ARCH-038**: Verify screen-reader labels.
- [ ] `[IN_PROGRESS]` **ARCH-039**: Verify semantic HTML structure.
- [ ] `[IN_PROGRESS]` **ARCH-040**: Verify modal focus management.
- [ ] `[IN_PROGRESS]` **ARCH-041**: Verify color contrast.
- [ ] `[IN_PROGRESS]` **ARCH-042**: Verify reduced-motion support.
- [ ] `[PLANNED]` **ARCH-043**: Verify minimum mobile touch targets.
- [ ] `[IN_PROGRESS]` **ARCH-044**: Verify accessible tri-state checkbox semantics.
- [ ] `[IN_PROGRESS]` **ARCH-045**: Verify accessible progress indicators.
- [ ] `[IN_PROGRESS]` **ARCH-046**: Verify visible keyboard focus in both themes.
- [ ] `[PLANNED]` **ARCH-047**: Verify mobile navigation accessibility.

## 10.5 Architecture Governance

- [ ] `[IN_PROGRESS]` **ARCH-048**: Keep business logic outside presentation components.
- [ ] `[IN_PROGRESS]` **ARCH-049**: Keep database access outside frontend code.
- [ ] `[IN_PROGRESS]` **ARCH-050**: Keep provider-specific logic isolated.
- [ ] `[IN_PROGRESS]` **ARCH-051**: Keep parsing and extraction stages independently testable.
- [ ] `[IN_PROGRESS]` **ARCH-052**: Preserve typed frontend API contracts.
- [ ] `[IN_PROGRESS]` **ARCH-053**: Avoid duplicate progress-calculation implementations.
- [ ] `[IN_PROGRESS]` **ARCH-054**: Document intentional frontend/backend calculation differences.
- [ ] `[IN_PROGRESS]` **ARCH-055**: Keep new features modular and migration-aware.
- [ ] `[IN_PROGRESS]` **ARCH-056**: Update this tracker when implementation status changes.

# Section 11 — Verification & Regression Prevention

## 11.1 Quality Assurance Strategy

The project must use a layered verification strategy.

| Layer | Responsibility |
| --- | --- |
| Unit tests | Individual functions and domain rules |
| Integration tests | Database, API, and provider integration |
| Contract tests | Frontend/backend API compatibility |
| End-to-end tests | Complete academic workflows |
| Security tests | Upload, scraper, backup, and network boundaries |
| Platform tests | Windows runtime and CLI stability |
| Visual tests | Responsive layout and UI consistency |
| Migration tests | Existing database compatibility |
| Recovery tests | Failure handling and resource cleanup |

A passing unit-test suite alone is not sufficient evidence of production readiness.

## 11.2 Backend Regression Suite

Document Parsing
- [ ] `[IN_PROGRESS]` **QA-009**: PDF digital-text parsing tests.
- [ ] `[IN_PROGRESS]` **QA-010**: DOCX extraction tests.
- [ ] `[IN_PROGRESS]` **QA-011**: Legacy DOC conversion tests.
- [ ] `[IN_PROGRESS]` **QA-012**: TXT encoding tests.
- [ ] `[IN_PROGRESS]` **QA-013**: Empty-document tests.
- [ ] `[IN_PROGRESS]` **QA-014**: Malformed-document tests.
- [ ] `[IN_PROGRESS]` **QA-015**: Large-document tests.
- [ ] `[IN_PROGRESS]` **QA-016**: Temporary-file cleanup tests.
AI and Validation
- [ ] `[IN_PROGRESS]` **QA-017**: Ollama provider tests.
- [ ] `[IN_PROGRESS]` **QA-018**: Cloud provider tests.
- [ ] `[IN_PROGRESS]` **QA-019**: Provider-switching tests.
- [ ] `[IN_PROGRESS]` **QA-020**: Pydantic validation tests.
- [ ] `[IN_PROGRESS]` **QA-021**: Extraction retry tests.
- [ ] `[IN_PROGRESS]` **QA-022**: Extraction timeout tests.
- [ ] `[IN_PROGRESS]` **QA-023**: Malformed structured-output tests.
- [ ] `[IN_PROGRESS]` **QA-024**: Source-grounding tests.
- [ ] `[IN_PROGRESS]` **QA-025**: Prompt-injection isolation tests.
Academic Domain
- [ ] `[IN_PROGRESS]` **QA-026**: Five-tier hierarchy tests.
- [ ] `[IN_PROGRESS]` **QA-027**: Leaf-only completion tests.
- [ ] `[IN_PROGRESS]` **QA-028**: Tri-state parent calculation tests.
- [ ] `[IN_PROGRESS]` **QA-029**: Bottom-up progress tests.
- [ ] `[IN_PROGRESS]` **QA-030**: Zero-leaf branch tests.
- [ ] `[IN_PROGRESS]` **QA-031**: Elective enrollment tests.
- [ ] `[IN_PROGRESS]` **QA-032**: Historical progress preservation tests.
- [ ] `[IN_PROGRESS]` **QA-033**: Lab handling tests.
- [ ] `[IN_PROGRESS]` **QA-034**: Contact-hour metadata tests.
Productivity
- [ ] `[IN_PROGRESS]` **QA-035**: Study pacing tests.
- [ ] `[IN_PROGRESS]` **QA-036**: Deadline calculation tests.
- [ ] `[IN_PROGRESS]` **QA-037**: Notes persistence tests.
- [ ] `[IN_PROGRESS]` **QA-038**: Bookmark persistence tests.
- [ ] `[IN_PROGRESS]` **QA-039**: Markdown export tests.
- [ ] `[IN_PROGRESS]` **QA-040**: JSON export tests.
- [ ] `[IN_PROGRESS]` **QA-041**: Backup restoration tests.
- [ ] `[IN_PROGRESS]` **QA-042**: Hierarchy-preserving serialization tests.
Web Security
- [ ] `[IN_PROGRESS]` **QA-043**: SSRF localhost rejection tests.
- [ ] `[IN_PROGRESS]` **QA-044**: Private IPv4 rejection tests.
- [ ] `[IN_PROGRESS]` **QA-045**: Private IPv6 rejection tests.
- [ ] `[IN_PROGRESS]` **QA-046**: DNS rebinding tests.
- [ ] `[IN_PROGRESS]` **QA-047**: Redirect-based SSRF tests.
- [ ] `[IN_PROGRESS]` **QA-048**: Unsafe scheme tests.
- [ ] `[IN_PROGRESS]` **QA-049**: Oversized download tests.
- [ ] `[IN_PROGRESS]` **QA-050**: Invalid content-type tests.
Windows Reliability
- [ ] `[IN_PROGRESS]` **QA-051**: WinError 1450 handling tests.
- [ ] `[IN_PROGRESS]` **QA-052**: Parser timeout tests.
- [ ] `[IN_PROGRESS]` **QA-053**: Subprocess cleanup tests.
- [ ] `[IN_PROGRESS]` **QA-054**: Concurrent upload tests.
- [ ] `[IN_PROGRESS]` **QA-055**: Global CLI unit tests.
- [ ] `[IN_PROGRESS]` **QA-056**: CLI installation tests.
- [ ] `[IN_PROGRESS]` **QA-057**: CLI uninstallation tests.
- [ ] `[IN_PROGRESS]` **QA-058**: Cross-terminal IPC tests.

## 11.3 Frontend Regression Suite

Core UI
- [ ] `[IN_PROGRESS]` **QA-059**: Tree rendering tests.
- [ ] `[IN_PROGRESS]` **QA-060**: Hierarchical navigation tests.
- [ ] `[IN_PROGRESS]` **QA-061**: Progress update tests.
- [ ] `[IN_PROGRESS]` **QA-062**: Parent tri-state tests.
- [ ] `[IN_PROGRESS]` **QA-063**: Source evidence tests.
- [ ] `[IN_PROGRESS]` **QA-064**: File upload validation tests.
- [ ] `[IN_PROGRESS]` **QA-065**: Upload progress tests.
- [ ] `[IN_PROGRESS]` **QA-066**: Upload cancellation tests.
- [ ] `[IN_PROGRESS]` **QA-067**: Upload retry tests.
Productivity
- [ ] `[IN_PROGRESS]` **QA-068**: Elective onboarding tests.
- [ ] `[IN_PROGRESS]` **QA-069**: Notes drawer tests.
- [ ] `[IN_PROGRESS]` **QA-070**: Notes persistence tests.
- [ ] `[IN_PROGRESS]` **QA-071**: Resource management tests.
- [ ] `[IN_PROGRESS]` **QA-072**: Deadline control tests.
- [ ] `[IN_PROGRESS]` **QA-073**: Export action tests.
- [ ] `[IN_PROGRESS]` **QA-074**: Backup and restore UI tests.
Future UI Regression
- [ ] `[PLANNED]` **QA-075**: Responsive layout tests.
- [ ] `[PLANNED]` **QA-076**: Theme-switching tests.
- [ ] `[PLANNED]` **QA-077**: Command-palette tests.
- [ ] `[PLANNED]` **QA-078**: Mobile navigation tests.
- [ ] `[PLANNED]` **QA-079**: Offline status indicator tests.
- [ ] `[PLANNED]` **QA-080**: Offline outbox tests.
- [ ] `[PLANNED]` **QA-081**: Synchronization conflict UI tests.

## 11.4 Phase 10 Acceptance Tests

- [ ] `[PLANNED]` **QA-082**: Reject standalone pagination markers.
- [ ] `[PLANNED]` **QA-083**: Reject repeated headers.
- [ ] `[PLANNED]` **QA-084**: Preserve valid numbered academic topics.
- [ ] `[PLANNED]` **QA-085**: Reconstruct tables split across pages.
- [ ] `[PLANNED]` **QA-086**: Preserve correct subject and module relationships.
- [ ] `[PLANNED]` **QA-087**: Verify semantic naming.
- [ ] `[PLANNED]` **QA-088**: Preserve source excerpts after sanitization.
- [ ] `[PLANNED]` **QA-089**: Preserve source page references.
- [ ] `[PLANNED]` **QA-090**: Preserve source offsets.
- [ ] `[PLANNED]` **QA-091**: Suppress missing contact-hour badges.
- [ ] `[PLANNED]` **QA-092**: Suppress zero contact-hour badges.
- [ ] `[PLANNED]` **QA-093**: Verify light and dark theme contrast.
- [ ] `[PLANNED]` **QA-094**: Verify existing hierarchy interactions remain intact.

## 11.5 Phase 11 Acceptance Tests

- [ ] `[PLANNED]` **QA-095**: Verify 360px rendering.
- [ ] `[PLANNED]` **QA-096**: Verify tablet rendering.
- [ ] `[PLANNED]` **QA-097**: Verify 2560px rendering.
- [ ] `[PLANNED]` **QA-098**: Verify mobile drawer interaction.
- [ ] `[PLANNED]` **QA-099**: Verify keyboard navigation.
- [ ] `[PLANNED]` **QA-100**: Verify PWA installation.
- [ ] `[PLANNED]` **QA-101**: Verify offline application loading.
- [ ] `[PLANNED]` **QA-102**: Verify offline leaf completion.
- [ ] `[PLANNED]` **QA-103**: Verify offline note editing.
- [ ] `[PLANNED]` **QA-104**: Verify idempotent synchronization.
- [ ] `[PLANNED]` **QA-105**: Verify duplicate operation handling.
- [ ] `[PLANNED]` **QA-106**: Verify operation ordering.
- [ ] `[PLANNED]` **QA-107**: Verify stale-write rejection.
- [ ] `[PLANNED]` **QA-108**: Verify note conflict handling.
- [ ] `[PLANNED]` **QA-109**: Verify synchronization recovery after restart.
- [ ] `[PLANNED]` **QA-110**: Verify service-worker cache updates.

## 11.6 Phase 12 Acceptance Tests

- [ ] `[PLANNED]` **QA-111**: Verify review scheduling.
- [ ] `[PLANNED]` **QA-112**: Verify recall-quality updates.
- [ ] `[PLANNED]` **QA-113**: Verify difficulty-based scheduling.
- [ ] `[PLANNED]` **QA-114**: Verify overdue review detection.
- [ ] `[PLANNED]` **QA-115**: Verify daily review queue.
- [ ] `[PLANNED]` **QA-116**: Verify review history persistence.
- [ ] `[PLANNED]` **QA-117**: Verify subject-level analytics.
- [ ] `[PLANNED]` **QA-118**: Verify semester-level analytics.
- [ ] `[PLANNED]` **QA-119**: Verify historical event integrity.
- [ ] `[PLANNED]` **QA-120**: Verify analytics after data migration.
- [ ] `[PLANNED]` **QA-121**: Verify backup and restoration of review records.
- [ ] `[PLANNED]` **QA-122**: Verify existing completion records remain unchanged.

## 11.7 Release Gate

A phase must not be marked [COMPLETED] until all applicable requirements are satisfied.
Implementation Gate
- [ ] `[IN_PROGRESS]` **QA-123**: Verify all scoped implementation tasks are complete.
- [ ] `[IN_PROGRESS]` **QA-124**: Verify no critical implementation placeholders remain.
- [ ] `[IN_PROGRESS]` **QA-125**: Verify error handling and recovery behavior.
Automated Quality Gate
- [ ] `[IN_PROGRESS]` **QA-126**: Verify all required backend tests pass.
- [ ] `[IN_PROGRESS]` **QA-127**: Verify all required frontend tests pass.
- [ ] `[IN_PROGRESS]` **QA-128**: Verify regression tests pass.
- [ ] `[IN_PROGRESS]` **QA-129**: Verify TypeScript checks pass.
- [ ] `[IN_PROGRESS]` **QA-130**: Verify production build succeeds.
- [ ] `[IN_PROGRESS]` **QA-131**: Document skipped or environment-dependent tests.
Data Integrity Gate
- [ ] `[IN_PROGRESS]` **QA-132**: Verify database compatibility.
- [ ] `[IN_PROGRESS]` **QA-133**: Verify historical completion preservation.
- [ ] `[IN_PROGRESS]` **QA-134**: Verify backup and restore compatibility.
- [ ] `[IN_PROGRESS]` **QA-135**: Verify API contract compatibility.
Security and Documentation Gate
- [ ] `[IN_PROGRESS]` **QA-136**: Review security implications.
- [ ] `[IN_PROGRESS]` **QA-137**: Review resource lifecycle and performance implications.
- [ ] `[IN_PROGRESS]` **QA-138**: Update architecture documentation.
- [ ] `[IN_PROGRESS]` **QA-139**: Update implementation documentation.
- [ ] `[IN_PROGRESS]` **QA-140**: Update 15_TRACKER.md.
- [ ] `[IN_PROGRESS]` **QA-141**: Record final verification evidence.
Release rule: An unchecked release-gate item blocks phase completion unless a documented, approved exception exists.

# Section 12 — Dependency & Execution Roadmap

## 12.1 Master Development Sequence

The recommended development order is:

```text
M0 — Existing Repository Audit
       │
       ▼
Existing Core Stability
       │
       ▼
Phase 10 — Extraction Sanitization
       │
       ▼
Phase 10 — Commercial UI Polish
       │
       ▼
Phase 11 — Responsive Architecture
       │
       ▼
Phase 11 — PWA Foundation
       │
       ▼
Phase 11 — Offline Synchronization
       │
       ▼
Phase 11 — Capacitor Readiness
       │
       ▼
Phase 12 — Historical Analytics Foundation
       │
       ▼
Phase 12 — Study Analytics
       │
       ▼
Phase 12 — Spaced Repetition
       │
       ▼
Final Production Readiness
```

## 12.2 Phase Dependency Matrix

| Phase | Primary Objective | Dependencies | Expected Deliverables | Completion Criteria |
| --- | --- | --- | --- | --- |
| M0 | Existing repository audit | Repository access | Verified implementation baseline | Evidence inventory and test report |
| Core stabilization | Verify existing capabilities | M0 | Stable backend, database, frontend | Core regression suite passes |
| Phase 10 | Extraction sanitization | Core extraction pipeline | Cleaner, source-grounded hierarchy | Extraction acceptance tests pass |
| Phase 10 | Commercial UI polish | Existing frontend architecture | Consistent visual design | Visual and accessibility tests pass |
| Phase 11A | Responsive UI | Stable frontend | Mobile/tablet/desktop layouts | Viewport tests pass |
| Phase 11B | Command palette | Loaded frontend data | Local academic search and commands | Keyboard and search tests pass |
| Phase 11C | PWA | Responsive UI and static assets | Installable application shell | Installation and offline-shell tests pass |
| Phase 11D | Offline synchronization | Stable persistence and backend API | IndexedDB outbox and synchronization | Idempotency and conflict tests pass |
| Phase 11E | Capacitor readiness | Responsive UI and offline persistence | Native-wrapper readiness | Platform compatibility verified |
| Phase 12A | Historical data foundation | Stable completion persistence | Completion event history | Historical integrity tests pass |
| Phase 12B | Study analytics | Historical data foundation | Analytics dashboard | Aggregation tests pass |
| Phase 12C | Spaced repetition | Stable topic identifiers | Review scheduler | Scheduling and persistence tests pass |
| Final release | Complete product verification | All required phases | Production-ready release | Full release gate passes |

## 12.3 Critical Dependencies

Dependency D-01 — Core Hierarchy Before Phase 10
Phase 10 extraction improvements must preserve the canonical five-tier hierarchy.
Sanitization must not change academic relationships merely to produce a visually cleaner tree.
Dependency D-02 — Extraction Before UI Polish
The extraction pipeline should produce reliable academic structures before UI polish is considered complete.
Otherwise, the frontend may present incorrect academic content in a visually attractive interface.
Dependency D-03 — Stable Persistence Before Offline Synchronization
Phase 11 requires:
Stable leaf identifiers.
Reliable completion persistence.
Transactional updates.
Explicit API operation semantics.
Version-aware updates.
Conflict detection.
Offline synchronization must not be implemented as a frontend-only queue without backend acknowledgment and idempotency.
Dependency D-04 — PWA Cache and Data Separation
PWA caching and IndexedDB persistence are different concerns.
Static application assets must be separated from private academic data.
The service worker must not become an uncontrolled cache of sensitive documents or API responses.
Dependency D-05 — Historical Events Before Analytics
Current completion states cannot reconstruct exact past completion dates.
Phase 12 analytics therefore requires a new historical event foundation or an explicitly limited historical reporting model.
Dependency D-06 — Review History Before Adaptive Scheduling
A scheduler must persist review outcomes before it can reliably adapt future intervals.
The scheduling algorithm must be versioned so future algorithm changes do not silently reinterpret old review records.

## 12.4 Recommended Execution Priorities

| Priority | Task | Reason |
| --- | --- | --- |
| P0 | Repository and test audit | Establish reliable engineering baseline |
| P0 | Database and hierarchy verification | Protect existing student data |
| P0 | WinError 1450 regression verification | Protect ingestion reliability |
| P0 | Extraction grounding verification | Protect academic correctness |
| P1 | Phase 10 sanitization | Improve extraction quality |
| P1 | Phase 10 UI polish | Improve daily usability |
| P2 | Phase 11 responsive layout | Enable cross-device usability |
| P2 | Phase 11 PWA | Establish installable application |
| P2 | Phase 11 offline synchronization | Enable reliable disconnected workflows |
| P3 | Phase 12 historical analytics | Establish meaningful progress history |
| P3 | Phase 12 spaced repetition | Introduce adaptive revision |

Priority is an execution recommendation, not a claim of implementation completion.

# Section 13 — Technical Risk Register

## 13.1 Risk Assessment Method

Impact:
Critical: Could cause data loss, security compromise, or major application failure.
High: Could invalidate academic content or materially disrupt core workflows.
Medium: Could degrade usability, performance, or reliability.
Low: Limited operational or presentation impact.
Likelihood:
High: Strong technical exposure or recurring failure potential.
Medium: Credible risk requiring mitigation.
Low: Limited exposure under current known conditions.
Risk status uses the same three primary implementation statuses.

## 13.2 Master Risk Register

| Risk ID | Risk Description | Impact | Likelihood | Mitigation | Affected Phase | Status |
| --- | --- | --- | --- | --- | --- | --- |
| RISK-001 | AI generates fabricated academic content | Critical | Medium | Source-grounded extraction, Pydantic validation, evidence review | Core, P10 | [IN_PROGRESS] |
| RISK-002 | Aggressive sanitization deletes genuine topics | High | Medium | Context-aware filtering and positive preservation tests | P10 | [PLANNED] |
| RISK-003 | Cross-page tables produce incorrect academic relationships | High | High | Page-aware table reconstruction and regression corpus | P10 | [PLANNED] |
| RISK-004 | Elective changes destroy historical completion | Critical | Medium | Preserve completion records independently of enrollment | Core, P10 | [IN_PROGRESS] |
| RISK-005 | SQLite migrations break existing databases | Critical | Medium | Versioned migrations, backups, rollback and migration tests | All | [IN_PROGRESS] |
| RISK-006 | Offline synchronization overwrites newer data | Critical | Medium | Version checks and explicit conflict handling | P11 | [PLANNED] |
| RISK-007 | Outbox replay duplicates operations | High | Medium | Unique operation IDs and server-side idempotency | P11 | [PLANNED] |
| RISK-008 | Service worker serves stale application assets | Medium | Medium | Versioned caches and update lifecycle | P11 | [PLANNED] |
| RISK-009 | Sensitive academic data leaks through logs or caches | Critical | Medium | Data minimization, redaction, cache restrictions | All | [IN_PROGRESS] |
| RISK-010 | SSRF exposes internal services | Critical | Medium | Connection-boundary IP validation and redirect controls | WEB | [IN_PROGRESS] |
| RISK-011 | DNS rebinding bypasses URL validation | Critical | Medium | Validated connection pinning and DNS revalidation | WEB | [IN_PROGRESS] |
| RISK-012 | Windows resource exhaustion returns WinError 1450 | High | Medium | Lightweight-first parsing and bounded concurrency | WIN | [IN_PROGRESS] |
| RISK-013 | Deep academic trees degrade mobile rendering | Medium | Medium | Performance profiling and controlled rendering | P11 | [PLANNED] |
| RISK-014 | UI modernization introduces accessibility regressions | High | Medium | Automated accessibility and keyboard regression tests | P10, P11 | [PLANNED] |
| RISK-015 | Analytics report inaccurate historical activity | High | High | Timestamped events and explicit historical coverage limitations | P12 | [PLANNED] |
| RISK-016 | Incorrect scheduling algorithm produces unsuitable review intervals | Medium | Medium | Formal algorithm specification and deterministic tests | P12 | [PLANNED] |
| RISK-017 | Provider switching exposes credentials or fails silently | High | Medium | Secret-safe configuration and provider diagnostics | Core | [IN_PROGRESS] |
| RISK-018 | Large document processing blocks application responsiveness | High | Medium | Worker threads, bounded jobs and cancellation | Core, WIN | [IN_PROGRESS] |
| RISK-019 | Temporary files remain after interrupted ingestion | Medium | Medium | Scoped cleanup and recovery tests | Core, WIN | [IN_PROGRESS] |
| RISK-020 | Backup restoration imports malicious or malformed data | Critical | Medium | Schema validation, bounded imports and transactional restore | UTIL | [IN_PROGRESS] |
| RISK-021 | Contact hours accidentally influence completion percentages | High | Medium | Separate metadata and progress calculations | HIER, P10 | [IN_PROGRESS] |
| RISK-022 | Review activity accidentally modifies academic completion | High | Medium | Separate review and completion domain models | P12 | [PLANNED] |
| RISK-023 | Local and backend progress calculations diverge | High | Medium | Shared calculation contract and differential tests | HIER | [IN_PROGRESS] |
| RISK-024 | CLI terminates unrelated Windows processes | Critical | Low | Process ownership checks and non-destructive supervision | WIN | [IN_PROGRESS] |
| RISK-025 | Note auto-save causes stale-write data loss | High | Medium | Version-aware persistence and conflict detection | UTIL, P11 | [IN_PROGRESS] |

## 13.3 Critical Risk Mitigation Requirements

RISK-001 — AI Hallucination
Mandatory controls:
Preserve source evidence.
Validate every extracted leaf.
Reject unsupported content.
Keep uncertain content reviewable.
Never silently invent missing academic structure.
RISK-004 — Historical Progress Loss
Mandatory controls:
Completion records must remain independent of elective enrollment.
Enrollment changes must not delete historical leaf completion.
Database migrations must preserve stable identifiers.
Backup and restore must preserve completion records.
RISK-005 — Database Migration Failure
Mandatory controls:
Back up before migration.
Record schema version.
Use transactional migration operations where supported.
Validate foreign keys after migration.
Test against copies of existing database versions.
Provide a recovery strategy.
RISK-006 — Offline Conflict
Mandatory controls:
Use operation IDs.
Track entity versions.
Use explicit desired states.
Detect stale writes.
Preserve conflicting note content.
Never silently discard unacknowledged operations.
RISK-010 / RISK-011 — SSRF
Mandatory controls:
Validate every DNS result.
Reject prohibited address classes.
Revalidate redirects.
Control the actual connection destination.
Restrict content sizes.
Apply connection timeouts.
Test DNS rebinding scenarios.
RISK-015 — Historical Analytics Accuracy
Mandatory controls:
Record actual events going forward.
Do not manufacture past timestamps.
Distinguish current state from historical activity.
Expose historical data coverage.
RISK-016 — Scheduling Accuracy
Mandatory controls:
Select and document an algorithm.
Version the algorithm.
Persist recall-quality input.
Test boundary conditions.
Preserve previous review history when the algorithm changes.

# Section 14 — Implementation Evidence & Traceability

## 14.1 Evidence Policy

Every completed major subsystem must have identifiable implementation evidence.
A task cannot be promoted to [COMPLETED] based solely on:
A README description.
A proposed architecture.
A planned implementation.
A previous AI-generated report.
An unverified checklist.
A test count without test execution evidence.
Required Evidence Format
For every major subsystem:
Implementation Evidence - File: - Component/function: - API endpoint: - Database table/model: - Tests: - Verification: - Notes:
Verification Values
Use:
Verified — Actual implementation and relevant verification evidence inspected.
Not Yet Verified — Evidence is incomplete or has not been inspected.
Not Applicable — Planned work with no current implementation requirement.

## 14.2 Current Evidence Inventory

The following references were identifiable in the publicly accessible repository documentation.

| Subsystem | Identified Evidence | Current Verification |
| --- | --- | --- |
| Backend application | backend/app/main.py | Not Yet Verified |
| Configuration | backend/app/config.py | Not Yet Verified |
| Schemas | backend/app/schemas.py | Not Yet Verified |
| Models | backend/app/models.py | Not Yet Verified |
| Database | backend/app/database.py | Not Yet Verified |
| Parser | backend/app/parser.py | Not Yet Verified |
| Extractor | backend/app/extractor.py | Not Yet Verified |
| Validation | backend/app/validation.py | Not Yet Verified |
| Ingestion | backend/app/services/ingestion.py | Not Yet Verified |
| Progress | backend/app/progress.py | Not Yet Verified |
| Job manager | backend/app/services/job_manager.py | Not Yet Verified |
| Chunking | backend/app/services/chunking.py | Not Yet Verified |
| CLI launcher | scripts/launcher.py | Not Yet Verified |
| CLI installer | scripts/setup-global-cli.ps1 | Not Yet Verified |
| CLI uninstaller | scripts/uninstall-global-cli.ps1 | Not Yet Verified |
| Frontend types | frontend/src/types/syllabus.ts | Not Yet Verified |
| Frontend progress | frontend/src/lib/progress.ts | Not Yet Verified |
| Frontend API | frontend/src/lib/api.ts | Not Yet Verified |
| Frontend state | frontend/src/hooks/useSyllabus.ts | Not Yet Verified |
| Main tree | frontend/src/SyllabusTree.tsx | Not Yet Verified |
| Upload component | frontend/src/FileUpload.tsx or documented component location | Exact path requires verification |
| Source evidence | frontend/src/components/SourceEvidence.tsx | Not Yet Verified |
| Elective onboarding | ElectiveOnboardingModal.tsx | Exact path requires verification |
| CSS | frontend/src/index.css | Not Yet Verified |
| PWA configuration | frontend/vite.config.ts | Not Yet Verified |
| Offline synchronization | frontend/src/lib/offlineSync.ts | Not Yet Verified |

Important: These paths are references documented in the repository's Master Context or supplied project requirements. Their existence and current contents have not all been independently checked.

## 14.3 Historical Verification Evidence

The following historical claims were found in Master_Context.md.

| Phase | Historical Backend | Historical Frontend | Additional Evidence |
| --- | --- | --- | --- |
| Phase 6 | 47 passed | 9 passed | Typecheck and build reported successful |
| Phase 7 | 47 passed | 10 passed | Typecheck and build reported successful |
| Phase 8 | 60 passed | 12 passed | Large multi-page ingestion integration test reported passed |
| Phase 9 | 77 passed | 12 passed | 17 launcher tests reported passed |

These are individual historical snapshots. They must not be added together because later phases may include earlier tests.
They must also not be substituted for the current test count.

## 14.4 Outstanding Repository Audit

- [ ] `[IN_PROGRESS]` **QA-142**: Inspect the complete backend source tree.
- [ ] `[IN_PROGRESS]` **QA-143**: Inspect the complete frontend source tree.
- [ ] `[IN_PROGRESS]` **QA-144**: Inspect all database models and relationships.
- [ ] `[IN_PROGRESS]` **QA-145**: Inspect database initialization and migration strategy.
- [ ] `[IN_PROGRESS]` **QA-146**: Inspect all API route implementations.
- [ ] `[IN_PROGRESS]` **QA-147**: Inspect all backend automated tests.
- [ ] `[IN_PROGRESS]` **QA-148**: Inspect all frontend automated tests.
- [ ] `[IN_PROGRESS]` **QA-149**: Inspect the complete architecture documentation set.
- [ ] `[IN_PROGRESS]` **QA-150**: Inspect 14_IMPLEMENTATION_PLAN.md.
- [ ] `[IN_PROGRESS]` **QA-151**: Inspect existing phase trackers.
- [ ] `[IN_PROGRESS]` **QA-152**: Inspect README setup instructions against actual configuration.
- [ ] `[IN_PROGRESS]` **QA-153**: Inspect Git history for implementation and regression context.
- [ ] `[IN_PROGRESS]` **QA-154**: Reconcile the 191 backend and 53 frontend historical test claims.
- [ ] `[IN_PROGRESS]` **QA-155**: Produce an evidence-backed completed-feature register.
- [ ] `[IN_PROGRESS]` **QA-156**: Identify undocumented implemented features.
- [ ] `[IN_PROGRESS]` **QA-157**: Identify documented but missing or incomplete features.
- [ ] `[IN_PROGRESS]` **QA-158**: Resolve README and Master Context configuration discrepancies.
- [ ] `[IN_PROGRESS]` **QA-159**: Publish an updated engineering baseline.

# Section 15 — Master Implementation Accountability Register

This section provides a concise task-selection view across the entire engineering roadmap.
It does not replace the detailed checklists in earlier sections.

## 15.1 Current Engineering Work Queue

| Order | Task | Priority | Dependency | Status |
| --- | --- | --- | --- | --- |
| 1 | Complete repository source audit | Critical | Repository access | [IN_PROGRESS] |
| 2 | Reconcile actual test counts | Critical | Test inventory | [IN_PROGRESS] |
| 3 | Verify database invariants | Critical | Source audit | [IN_PROGRESS] |
| 4 | Verify extraction grounding | Critical | Parser and validation audit | [IN_PROGRESS] |
| 5 | Verify Windows resource fixes | High | Parser and launcher audit | [IN_PROGRESS] |
| 6 | Verify global CLI lifecycle | High | Launcher audit | [IN_PROGRESS] |
| 7 | Build Phase 10 artifact corpus | High | Extraction audit | [PLANNED] |
| 8 | Implement Phase 10 sanitization | High | Artifact corpus | [PLANNED] |
| 9 | Implement Phase 10 UI polish | Medium | Frontend audit | [PLANNED] |
| 10 | Design Phase 11 synchronization contract | High | Persistence audit | [PLANNED] |
| 11 | Implement Phase 11 responsive layout | Medium | Frontend architecture | [PLANNED] |
| 12 | Implement Phase 11 PWA | Medium | Responsive architecture | [PLANNED] |
| 13 | Implement offline synchronization | High | Backend sync contract | [PLANNED] |
| 14 | Establish historical event storage | High | Completion persistence | [PLANNED] |
| 15 | Implement Phase 12 analytics | Medium | Historical events | [PLANNED] |
| 16 | Implement spaced repetition | Medium | Scheduler specification | [PLANNED] |

## 15.2 Phase Completion Register

| Phase | Name | Current Status | Completion Evidence Required |
| --- | --- | --- | --- |
| 1–3 | Repository, domain models, parsing | [IN_PROGRESS] | Source and test audit |
| 4–5 | Progress engine and React frontend | [IN_PROGRESS] | Source, integration, and UI tests |
| 6 | Windows WinError 1450 remediation | [IN_PROGRESS] | Current regression verification |
| 7 | Engineering audit and limits alignment | [IN_PROGRESS] | Configuration reconciliation |
| 8 | SSE and chunked ingestion | [IN_PROGRESS] | Job lifecycle and integration verification |
| 9 | Windows global CLI | [IN_PROGRESS] | Installation and lifecycle verification |
| 10 | Sanitization and commercial UI | [PLANNED] | Phase 10 acceptance suite |
| 11 | Mobile, PWA, offline synchronization | [PLANNED] | Phase 11 acceptance suite |
| 12 | Analytics and spaced repetition | [PLANNED] | Phase 12 acceptance suite |

Status interpretation: Phases 1–9 are historically documented as completed, but their completion is not yet independently established by this audit. The [IN_PROGRESS] designation reflects outstanding verification rather than an assertion that those phases were never implemented.

## 15.3 Definition of Done

Every task must satisfy the following criteria before being marked [COMPLETED].
Implementation exists.
Implementation is connected to the appropriate application workflow.
Relevant tests exist.
Required tests pass.
Regression tests pass.
Database compatibility is established where applicable.
Security implications are reviewed.
Error handling is implemented.
Documentation is updated.
Evidence is recorded.
No unresolved critical defect blocks the task.
For a purely documentation-related task, applicable criteria should be adapted without claiming source-code implementation.

# Section 16 — Tracker Maintenance & Change Control

## 16.1 Updating Task Status

A task may transition through:

```text
[PLANNED]
   │
   ▼
[IN_PROGRESS]
   │
   ▼
[COMPLETED]
```

A completed task may return to [IN_PROGRESS] if:
A regression is discovered.
Its acceptance criteria are no longer satisfied.
An implementation is removed.
A dependency becomes invalid.
A security defect invalidates its previous verification.
Never change a task's identifier when updating its status.

## 16.2 Evidence Update Requirements

Whenever a task changes to [COMPLETED], record:
Implementation file.
Component or function.
Related database model or API endpoint, where applicable.
Relevant test file.
Verification result.
Verification date.
Important limitations.
Example:
- [x] [COMPLETED] CORE-001 — Verify backend initialization. Implementation Evidence: - File: `backend/app/main.py` - Component/function: Actual verified implementation - Tests: Actual test file - Verification: Verified - Verification date: YYYY-MM-DD - Notes: Acceptance criteria satisfied.
The example is a documentation template, not evidence that CORE-001 is currently complete.

## 16.3 Regression Management

When a regression occurs:
Identify the affected task.
Change its status to [IN_PROGRESS].
Record the failing behavior.
Identify affected dependencies.
Add a regression test.
Correct the implementation.
Re-run relevant tests.
Restore [COMPLETED] only after verification.

## 16.4 Historical Accountability

Do not delete completed task records merely because an implementation changes.
Maintain the history of:
Previous implementation.
Relevant migrations.
Previous acceptance criteria.
Regression incidents.
Corrective actions.
Verification results.
For significant changes, add a dated change-log entry.

## 16.5 Tracker Change Log

| Date | Version | Change | Author | Verification |
| --- | --- | --- | --- | --- |
| 2026-11-17 | 1.0 | Initial evidence-driven master tracker generated | Engineering documentation | Repository landing page, README, and Master Context inspected; source audit outstanding |

# Section 17 — Final Engineering Guardrails

The following rules are mandatory for all future developers and AI coding agents working on this project.

## 17.1 Academic Data Integrity

Never flatten the five-tier academic hierarchy.
Never persist completion against parent nodes.
Never use contact hours as completion weights.
Never delete historical completion when an elective is excluded.
Never invent academic content to satisfy a schema.
Preserve verbatim source evidence.
Preserve source page references.
Preserve stable identifiers wherever possible.
Treat uncertain extraction as reviewable content.
Keep revision history distinct from syllabus completion.

## 17.2 Backend Engineering

Keep parsing, extraction, validation, persistence, and API routing separated.
Bound resource-intensive processing.
Avoid blocking asynchronous request handlers.
Clean up temporary files and subprocesses.
Keep local AI operation independent of cloud credentials.
Maintain explicit provider configuration.
Keep errors structured and actionable.
Maintain backwards-compatible API contracts.

## 17.3 Database Engineering

Use SQLite with the established WAL and foreign-key behavior.
Preserve relational integrity.
Use transactions for multi-record updates.
Keep completion persistence leaf-only.
Version schema changes.
Back up before migrations.
Test migration against existing databases.
Preserve historical academic progress.
Do not silently discard offline operations.
Keep backup and restore compatible with documented schemas.

## 17.4 Frontend Engineering

Preserve accessible hierarchy navigation.
Preserve tri-state checkbox behavior.
Keep API communication typed.
Avoid unnecessary duplicate state.
Do not move business logic into presentation-only components.
Preserve desktop functionality during responsive modernization.
Maintain keyboard accessibility.
Avoid destructive UI changes without confirmation.
Ensure offline changes are visibly distinguished from synchronized changes.
Preserve user-entered notes and resources.

## 17.5 AI Extraction Engineering

Treat every uploaded document as untrusted input.
Preserve document provenance.
Validate model output.
Reject unsupported academic claims.
Avoid overly aggressive normalization.
Maintain deterministic fallback behavior.
Keep provider-specific logic isolated.
Bound retries and execution time.
Keep confidence and grounding information explicit.
Never represent model-generated guesses as verified academic source material.

## 17.6 Production Readiness

A production-ready release requires:
Stable document ingestion.
Reliable source-grounded extraction.
Correct five-tier academic hierarchy.
Leaf-only completion persistence.
Historical progress preservation.
Reliable elective management.
Database compatibility.
Secure web ingestion.
Windows resource stability.
Verified backup and restoration.
Accessible frontend interactions.
Comprehensive regression tests.
Accurate documentation.
Reproducible installation and startup.
Future PWA, offline synchronization, analytics, and spaced-repetition capabilities must satisfy their own acceptance criteria before being included in a production-completion claim.

### FINAL PROJECT STATUS

| Category | Status |
| --- | --- |
| Project identity and repository | Documented |
| Historical architecture | Documented |
| Historical core implementation | Documented |
| Independent source-code audit | Not Yet Audited |
| Current test baseline | Not Yet Audited |
| Current passing test count | Not Yet Audited |
| Database migration compatibility | Not Yet Verified |
| Five-tier invariants | Not Yet Independently Verified |
| Historical progress preservation | Not Yet Independently Verified |
| Windows WinError 1450 remediation | Historically Documented; Current Verification Required |
| Global CLI | Historically Documented; Current Verification Required |
| Phase 10 | [PLANNED] |
| Phase 11 | [PLANNED] |
| Phase 12 | [PLANNED] |
| Production release readiness | Not Yet Audited |

### Immediate Next Action

Complete Milestone M0 — Repository-Wide Engineering Baseline Audit before starting Phase 10 implementation.
The most important outcome is not a higher completion percentage. It is an accurate, evidence-backed understanding of the current system that protects existing academic data, preserves the canonical architecture, and allows future development to proceed without introducing regressions.
This tracker is the authoritative engineering accountability document. All future phase progress, implementation evidence, technical risks, and release verification must be reconciled against it.