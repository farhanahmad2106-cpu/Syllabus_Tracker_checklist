# Product Requirements Document
## Hierarchical Syllabus Checklist & Progress Tracker
Document version: 1.0.0 · Status: Draft for engineering approval · Repository: Syllabus_Tracker_checklist · Last reviewed: 17 November 2026

---

## 1. Document Control & Version Information

### 1.1 Document metadata

| Field | Value |
| --- | --- |
| Document name | 1_PRD.md |
| Product | Hierarchical Syllabus Checklist & Progress Tracker |
| Document type | Product Requirements Document |
| Version | 1.0.0 |
| Status | Engineering specification draft |
| Repository | [GitHub repository](https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist?utm_source=chatgpt.com) |
| Primary platform | Windows desktop-hosted local application |
| Backend | Python, FastAPI |
| Frontend | React, TypeScript, Vite |
| Persistence | SQLite |
| Extraction | Deterministic document processing + structured LLM extraction |
| Primary audience | Students, product engineers, QA engineers, AI coding agents |

### 1.2 Document authority
This PRD defines the intended product behavior and requirements for subsequent engineering implementation.

The following evidence hierarchy applies:
1. Verified executable repository implementation.
2. Existing database constraints and automated tests.
3. Existing approved architecture and project documentation.
4. This PRD's confirmed product invariants.
5. Proposed product enhancements.
6. Unresolved stakeholder decisions.

A proposed requirement does not become an implemented capability merely because it appears in this document.

### 1.3 Normative terminology

| Term | Meaning |
| --- | --- |
| MUST | Mandatory requirement |
| MUST NOT | Prohibited behavior |
| SHOULD | Strong recommendation |
| SHOULD NOT | Behavior to avoid unless justified |
| MAY | Optional capability |
| Verified | Supported by available implementation evidence |
| Proposed | Desired behavior requiring implementation or verification |
| Unverified | Insufficient evidence to establish current behavior |
| Deferred | Intentionally excluded from the current delivery scope |

### 1.4 Product invariants
The following invariants are non-negotiable:
- The academic hierarchy contains exactly five academic tiers.
- Only Tier-5 academic leaves have individually persisted completion states.
- Parent completion states are derived, never independently stored.
- Every eligible academic leaf has equal completion weight.
- Contact hours do not influence completion percentages.
- Elective unenrollment must preserve historical academic information.
- Local academic functionality must not depend on a cloud account.
- Imported academic content must retain source provenance.
- Unverified extraction must not silently become authoritative curriculum content.
- Failed backup restoration must not corrupt existing data.

---

## 2. Executive Summary

### 2.1 Product overview
The Hierarchical Syllabus Checklist & Progress Tracker is a local-first academic productivity application that converts university curriculum documents into structured, evidence-backed, interactive academic checklists.

Its central value proposition is the transformation of complicated academic documents into an actionable representation of what a student must study, what has already been completed, and what remains before an examination.

The product combines:
- Deterministic document ingestion.
- AI-assisted structured academic extraction.
- Five-tier curriculum organization.
- Source-evidence verification.
- Elective enrollment management.
- Leaf-only academic progress persistence.
- Derived multi-level progress analytics.
- Examination planning.
- Topic-specific learning utilities.
- Recoverable local data storage.
- Responsive academic workspace interactions.

### 2.2 The primary user problem
University syllabi frequently contain fragmented tables, inconsistent headings, repeated administrative metadata, nested units, and different academic structures.

Students must manually convert these documents into manageable study tasks.

Existing generic task managers do not adequately represent academic relationships, elective enrollment, source verification, or curriculum-level progress.

The product addresses this problem through a domain-specific academic hierarchy rather than a generic task-management model.

### 2.3 Product positioning

| Dimension | Product position |
| --- | --- |
| Category | Academic productivity software |
| Primary use | Curriculum organization and study tracking |
| Data ownership | Student-controlled local data |
| Core intelligence | Evidence-grounded academic extraction |
| Progress model | Uniformly weighted Tier-5 leaves |
| Primary interface | Hierarchical academic workspace |
| Connectivity | Offline-capable |
| AI dependency | Optional configurable extraction provider |
| Cloud dependency | Not mandatory |

### 2.4 Definition of success
The product is successful when a student can:
- Import an academic syllabus.
- Obtain a structurally valid five-tier hierarchy.
- Identify and correct uncertain extraction.
- Verify academic topics against their original sources.
- Configure enrolled electives.
- Track individual topic completion.
- Understand progress at every academic level.
- Plan remaining study workload against examination dates.
- Preserve notes and resources.
- Export and recover academic records.
- Continue using core features without internet connectivity.

---

## 3. Product Vision & Value Proposition

### 3.1 Vision
Create a reliable, private, evidence-driven academic workspace that turns every university syllabus into a structured and measurable learning journey.

### 3.2 Product mission
Reduce the administrative burden of managing academic curricula while improving students' visibility into study progress, remaining workload, and examination readiness.

### 3.3 Core value propositions

| Value | Student benefit |
| --- | --- |
| Automated ingestion | Less manual syllabus transcription |
| Evidence grounding | Greater confidence in extracted content |
| Hierarchical organization | Better understanding of academic structure |
| Leaf-only tracking | Consistent and understandable progress |
| Elective awareness | Accurate active academic workload |
| Deadline planning | More realistic examination preparation |
| Topic-specific utilities | Notes and resources remain connected to learning |
| Local-first architecture | Academic data remains accessible and user-controlled |
| Backup and recovery | Protection against accidental data loss |

### 3.4 Differentiation
The product is not intended to compete as a generic to-do list.

Its differentiation comes from five architectural and product characteristics:
1. Curriculum-native hierarchy.
2. Evidence-backed extraction.
3. Deterministic academic progress.
4. Historical elective preservation.
5. Offline-first academic data ownership.

---

## 4. Product Goals & Non-Goals

### 4.1 Primary goals

| ID | Goal | Success condition |
| --- | --- | --- |
| PG-001 | Reliable syllabus ingestion | Supported documents enter a controlled extraction lifecycle. |
| PG-002 | Academic structural fidelity | All active curriculum records obey the five-tier invariant. |
| PG-003 | Evidence traceability | Extracted leaves retain verifiable source evidence or an explicit review status. |
| PG-004 | Correct progress calculation | All percentages derive exclusively from eligible Tier-5 leaves. |
| PG-005 | Elective integrity | Enrollment changes never silently erase historical records. |
| PG-006 | Academic planning | Students can assess remaining work against examination dates. |
| PG-007 | Student utilities | Notes and learning resources remain associated with academic topics. |
| PG-008 | Recoverability | Valid backups can be restored without corrupting existing records. |
| PG-009 | Offline independence | Core local workflows remain available without internet. |
| PG-010 | Responsive usability | Essential interactions remain usable across supported screen sizes. |

### 4.2 Secondary goals
- Reduce extraction correction effort.
- Improve handling of complex multi-page PDFs.
- Provide meaningful extraction confidence indicators.
- Improve keyboard navigation.
- Support installable browser experiences where technically compatible.
- Provide optional future migration between devices.

### 4.3 Non-goals
The product is not intended to become:
- A university ERP.
- A learning management system.
- A university attendance platform.
- An online examination system.
- A collaborative classroom.
- An academic grading platform.
- A cloud-dependent subscription service.
- An autonomous academic-content generator.

---

## 5. Project Context & Current Implementation Assessment

### 5.1 Repository identity
- **Repository:** farhanahmad2106-cpu/Syllabus_Tracker_checklist
- **Default branch:** main

The public repository identifies the product as a local-first, AI-powered academic curriculum tracker. Its README documents the Python/FastAPI backend, React/TypeScript frontend, SQLite persistence, structured extraction, and Windows CLI architecture.

### 5.2 Audit methodology and limitations
The available repository evidence includes:
- Public README.
- Master_Context.md.
- Repository-level directory listing.
- Published architecture descriptions.
- Documented implementation phases.
- Published test and build results.

The repository's backend and frontend source directories could not be independently traversed through the available repository interface during this audit.

Consequently:
- Implementation classifications below reflect published repository evidence.
- They do not constitute an independent line-by-line source-code audit.
- Historical test results are not represented as tests executed during this PRD preparation.
- UI screenshots and actual production runtime behavior remain unverified.
- Published API and schema claims require regression verification against the current checkout.

### 5.3 Published implementation assessment

| Capability | Classification | Evidence |
| --- | --- | --- |
| FastAPI backend | Implemented according to repository documentation | README and Master Context |
| React 19 frontend | Implemented according to repository documentation | README and Master Context |
| TypeScript | Implemented according to repository documentation | README and Master Context |
| SQLite WAL | Implemented according to repository documentation | Database architecture |
| Foreign-key enforcement | Implemented according to repository documentation | Database configuration |
| PDF parsing | Implemented according to repository documentation | pypdf integration |
| DOCX parsing | Implemented according to repository documentation | python-docx integration |
| Legacy DOC conversion | Implemented according to repository documentation | LibreOffice integration |
| Docling fallback | Implemented as opt-in according to repository documentation | Parser configuration |
| Ollama extraction | Implemented according to repository documentation | Instructor integration |
| OpenAI-compatible provider | Implemented according to repository documentation | Provider configuration |
| Pydantic structured extraction | Implemented according to repository documentation | Extraction architecture |
| Evidence validation | Implemented according to repository documentation | Validation module |
| Five-tier hierarchy | Implemented according to repository documentation | Schemas and frontend types |
| Leaf-only completion | Implemented according to repository documentation | Database and progress engine |
| Parent tri-state derivation | Implemented according to repository documentation | Progress engine |
| Elective onboarding | Implemented according to repository documentation | README |
| Historical elective preservation | Implemented according to repository documentation | README |
| Lab classification | Implemented according to repository documentation | README |
| Contact-hour extraction | Implemented according to repository documentation | README |
| Asynchronous upload jobs | Implemented according to repository documentation | Master Context |
| SSE upload progress | Implemented according to repository documentation | Master Context |
| Upload cancellation | Implemented according to repository documentation | Master Context |
| Global Windows CLI | Implemented according to repository documentation | Master Context |
| CLI process supervision | Implemented according to repository documentation | Master Context |
| CLI installation and uninstallation | Implemented according to repository documentation | Master Context |
| Examination planning | Unverified | No sufficient implementation evidence |
| Topic-specific Markdown notes | Unverified | No sufficient implementation evidence |
| Resource bookmarks | Unverified | No sufficient implementation evidence |
| Markdown export | Unverified | No sufficient implementation evidence |
| JSON Schema 2.1 backup | Unverified | No sufficient implementation evidence |
| Transactional restore workflow | Unverified | No sufficient implementation evidence |
| Academic portal scraping | Unverified | No sufficient implementation evidence |
| SSRF-resistant scraping | Unverified | No sufficient implementation evidence |
| Command palette | Planned | Product direction |
| Adaptive light/dark/system themes | Partially documented / unverified | Runtime behavior not inspected |
| PWA installation | Planned | No sufficient implementation evidence |
| IndexedDB browser persistence | Planned | No sufficient implementation evidence |
| Multi-device synchronization | Deferred | No established synchronization service |
| Capacitor integration | Deferred | No established native integration |

### 5.4 Documented architecture
```
Academic Document
  │
  ▼
Input Validation & Secure Staging
  │
  ▼
Deterministic Document Parsing (PDF / DOCX / DOC / TXT)
  │
  ▼
Text Normalization & Provenance
  │
  ▼
Semantic Chunking
  │
  ▼
Structured Extraction (Instructor + Pydantic | Ollama OR OpenAI-compatible API)
  │
  ▼
Grounding & Schema Validation
  │
  ▼
Academic Hierarchy Construction
  │
  ▼
Elective Review & Enrollment
  │
  ▼
Transactional SQLite Persistence
  │
  ▼
Derived Academic Progress
  │
  ▼
React Academic Workspace
```

### 5.5 Published technology stack

| Layer | Documented technology |
| --- | --- |
| Runtime | Python 3.12 |
| API | FastAPI |
| Data validation | Pydantic v2 |
| ORM | SQLModel / SQLAlchemy 2.0 |
| Database | SQLite |
| Extraction | Instructor |
| Local AI | Ollama |
| Cloud AI | OpenAI-compatible API |
| PDF | pypdf |
| DOCX | python-docx |
| Legacy DOC | Headless LibreOffice |
| Optional scanned PDF | Docling |
| Frontend | React 19 |
| Language | TypeScript |
| Build tooling | Vite |
| Styling | Tailwind CSS v4 |
| UI controls | Radix UI |
| Icons | Lucide React |
| Backend tests | Pytest |
| Frontend tests | Vitest and React Testing Library |

### 5.6 Important repository documentation discrepancies
The README and Master_Context.md contain different historical implementation limits and must not be silently combined.

| Setting | README | Master Context |
| --- | --- | --- |
| Maximum upload | 50 MiB | Earlier phase: 25 MiB; later phase: 50 MiB |
| Maximum PDF pages | 1000 | Earlier: 150; later: 300 |
| Maximum extracted text | 1,500,000 characters | Earlier: 500,000; later: 1,500,000 |
| Parser timeout | 45 seconds | Earlier: 45 seconds; later: 300 seconds |
| Docling | Disabled by default | Optional fallback |
| Extraction timeout | 180 seconds | Not conclusively aligned |
| Retry count | 3 | Not conclusively aligned |

**PRD decision:** The latest explicitly documented Master Context phase and current README should be used as candidate configuration evidence, but actual runtime configuration must be verified before implementation changes.

The provisional target baseline is:
- Upload: 50 MiB.
- PDF: 300 pages.
- Extracted text: 1,500,000 characters.
- Parser timeout: 300 seconds.
- DOC conversion timeout: 30 seconds.
- Docling: opt-in.
- Extraction timeout: 180 seconds, subject to verification.
- LLM retries: maximum 3, subject to verification.

The implementation MUST have one canonical configuration source. Frontend validation, backend validation, documentation, and tests must agree.

### 5.7 Known architecture issue requiring resolution
The older Master Context describes a five-level schema using Degree/Program → Academic Year → Semester → Topic/Course → Subtopic, while the newer product definition establishes the academic levels as Year → Semester → Subject → Module → Subtopic.

The product invariant in this PRD takes precedence:
```
Document Root → Year → Semester → Subject → Module → Subtopic
```
The document root is a container, not an academic tier. Existing persisted records must be migrated or mapped without flattening academic content.

The repository's documented academic-year derivation is:
$$AcademicYear=\left\lceil\frac{SemesterNumber}{2}\right\rceil$$
Equivalent integer arithmetic:
$$AcademicYear=\frac{SemesterNumber+1}{2}$$
using integer division. This rule is valid only when the curriculum explicitly follows a two-semesters-per-year convention. Otherwise, the year assignment must come from source evidence or student confirmation.

### 5.8 Implementation assessment conclusion
The existing repository documents a substantial foundation for document ingestion, structured extraction, progress tracking, elective handling, and Windows operation.

The primary product-development priorities are therefore:
1. Independently verify the canonical hierarchy against the current database and schemas.
2. Strengthen extraction quality and source-region reconstruction.
3. Audit elective history and progress denominator behavior.
4. Specify and implement academic planning.
5. Specify notes, resources, backup and restoration.
6. Modernize responsive interaction patterns.
7. Establish security boundaries for future URL ingestion.
8. Introduce browser/PWA functionality only after the desktop contract is stable.

---

## 6. Target User Personas & Jobs-to-be-Done

### 6.1 Persona 1 — Undergraduate Engineering Student
**Profile:** Student managing a multi-semester engineering curriculum with theory subjects, laboratory courses, modules, and elective subjects.

- **Goals:**
  - Organize all academic years and semesters.
  - Track theory and practical subjects.
  - Understand completion at subject and semester level.
  - Manage electives.
  - Prepare for examinations.
  - Preserve topic-specific lecture notes.
- **Frustrations:**
  - Long syllabus PDFs.
  - Inconsistent university formatting.
  - Repeated administrative content.
  - Manual checklist creation.
  - Unclear remaining workload.
  - Losing notes across semesters.
- **Primary workflow:**
  1. Upload the university syllabus.
  2. Review extracted years and semesters.
  3. Correct uncertain subjects or modules.
  4. Configure electives.
  5. Open the active academic semester.
  6. Track topics as they are studied.
  7. Review subject progress.
  8. Add examination targets.
  9. Export revision material.
- **Product expectations:**
  - Accurate academic structure.
  - Fast topic completion interactions.
  - Clear laboratory classification.
  - Historical elective preservation.
  - Reliable offline operation.
- **Success metrics:**
  - Successful curriculum creation.
  - Low extraction correction effort.
  - Accurate progress aggregation.
  - Reliable notes retention.
  - Successful backup restoration.
- **JTBD:**
  > When I receive a complex university syllabus, I want to transform it into an organized academic checklist so I can systematically monitor what I have studied and what remains.

### 6.2 Persona 2 — Self-Paced Online Learner
- **Goals:**
  - Convert course material into manageable modules.
  - Bookmark educational resources.
  - Maintain notes.
  - Establish personal study goals.
  - Work without permanent internet connectivity.
- **Frustrations:**
  - Course content spread across multiple sources.
  - Generic task managers lack academic structure.
  - No reliable relationship between topics and notes.
  - Difficulty maintaining study consistency.
- **Primary workflow:**
  1. Import course documents.
  2. Verify the extracted hierarchy.
  3. Organize course topics.
  4. Bookmark relevant lectures.
  5. Record learning notes.
  6. Track completion.
  7. Export the learning plan.
- **Product expectations:**
  - Flexible curriculum naming.
  - Reliable local storage.
  - Topic-centric utilities.
  - No mandatory institutional setup.
- **Success metrics:**
  - Successful import.
  - Topic completion consistency.
  - Resource reuse.
  - Notes persistence.
  - Offline workflow completion.
- **JTBD:**
  > When I study independently, I want to organize learning material into manageable topics so I can maintain consistent progress without depending on a university timetable.

### 6.3 Persona 3 — Examination-Preparation Crammer
- **Goals:**
  - Identify unfinished topics quickly.
  - Prioritize incomplete subjects.
  - Understand deadline feasibility.
  - Estimate remaining study workload.
  - Generate a printable revision checklist.
- **Frustrations:**
  - Incomplete visibility into remaining work.
  - Unclear examination priorities.
  - Unrealistic study schedules.
  - Difficulty identifying overdue preparation.
- **Primary workflow:**
  1. Open the current syllabus.
  2. Inspect incomplete subjects.
  3. Configure examination dates.
  4. Review remaining topics.
  5. Inspect required weekly study pace.
  6. Prioritize subjects.
  7. Print or export the remaining checklist.
- **Product expectations:**
  - Accurate progress summaries.
  - Clear deadline indicators.
  - Honest workload estimates.
  - Fast navigation.
  - Printable reports.
- **Success metrics:**
  - Time required to identify remaining topics.
  - Correctness of workload calculations.
  - Completion of planned study targets.
  - Successful report generation.
- **JTBD:**
  > When an examination approaches, I want a clear view of unfinished topics and realistic weekly study requirements so I can prioritize my remaining preparation time.

---

## 7. Product Scope & User Journeys

### 7.1 Core product journey overview

### 7.2 Journey A — New syllabus ingestion
1. Student selects a local document.
2. Application validates extension, actual content, size, and processing limits.
3. Application stages the file in an isolated temporary directory.
4. Deterministic parser extracts available content.
5. Normalization removes administrative noise while preserving source mapping.
6. Content is divided into semantically meaningful chunks when required.
7. Configured extraction provider generates structured academic data.
8. Schema and provenance validators inspect extracted records.
9. Student reviews uncertain content.
10. Application presents elective configuration when relevant.
11. Student confirms the curriculum.
12. A transaction persists the academic structure.
13. The new syllabus appears in the workspace.

**Success:** The student sees a valid five-tier curriculum, with unresolved records visibly identified rather than fabricated.

### 7.3 Journey B — Daily study tracking
1. Student opens an academic document.
2. Student navigates to a semester.
3. Student expands a subject and module.
4. Student marks a Tier-5 topic complete.
5. The application persists the leaf completion.
6. All relevant ancestor summaries update.
7. The student sees the revised progress fraction and percentage.

**Success:** Only the selected leaf completion changes in persistent completion storage.

### 7.4 Journey C — Elective reconfiguration
1. Student opens enrollment settings.
2. Application displays all elective courses and their enrollment states.
3. Student changes enrollment.
4. Application updates active workload membership.
5. Historical progress, notes, and resources remain retained.
6. Derived progress is recalculated.
7. Re-enabling a course restores its previous records.

### 7.5 Journey D — Examination planning
1. Student opens a semester or subject.
2. Student sets an examination date.
3. Application calculates remaining eligible topics.
4. Application calculates the required weekly topic pace.
5. If reliable workload information exists, it calculates remaining declared contact-hour workload.
6. Application compares required pace with the student's available weekly capacity.
7. The application displays a deterministic status and its explanation.

### 7.6 Journey E — Recovery
1. Student selects a backup.
2. Application validates file structure and schema version.
3. Application verifies integrity.
4. Application previews the academic documents and conflicts.
5. Student confirms the import strategy.
6. Application restores data transactionally.
7. Any failure triggers rollback.
8. The existing database remains usable.

---

## 8. Canonical Five-Tier Academic Hierarchy

### 8.1 Canonical structure
```
Document Root (Container)
  │
  └── Tier 1: Academic Year
        │
        └── Tier 2: Semester
              │
              └── Tier 3: Subject / Course
                    │
                    └── Tier 4: Module / Unit
                          │
                          └── Tier 5: Subtopic / Checklist Leaf
```

### 8.2 Hierarchy invariants

| ID | Invariant |
| --- | --- |
| HIR-001 | Every academic year belongs to exactly one document root. |
| HIR-002 | Every semester belongs to exactly one academic year. |
| HIR-003 | Every subject belongs to exactly one semester. |
| HIR-004 | Every module belongs to exactly one subject. |
| HIR-005 | Every trackable leaf belongs to exactly one module. |
| HIR-006 | No sixth academic tier is permitted. |
| HIR-007 | Only Tier-5 leaves are individually checkable. |
| HIR-008 | Parent completion is derived from descendant leaves. |
| HIR-009 | Structural metadata is not trackable content. |
| HIR-010 | Every node has a stable identity within its document. |

### 8.3 Academic node metadata

| Tier | Required product data | Optional metadata |
| --- | --- | --- |
| Document Root | Stable ID, title, timestamps | Institution, program, academic scheme |
| Year | Stable ID, parent ID, name, sort order | Year number, academic session |
| Semester | Stable ID, parent ID, name, sort order | Semester number, examination target |
| Subject | Stable ID, parent ID, name, sort order | Course code, mandatory/elective classification, is_lab, enrollment state |
| Module | Stable ID, parent ID, name, sort order | contact_hours, source heading |
| Subtopic | Stable ID, parent ID, name, sort order | Provenance, confidence, evidence status |

*All fields not verified in existing schemas are proposed data requirements, not claims about existing database columns.*

### 8.4 Structural validity
A node MUST satisfy all of the following:
- Valid stable identifier.
- Valid parent relationship.
- Correct tier for its parent.
- Non-empty meaningful display name, unless explicitly represented as unresolved.
- Unique sibling ordering.
- No cyclic parent relationship.
- No invalid cross-document reference.

### 8.5 Unresolved structural records
The application MUST distinguish between:
- Verified structural nodes.
- Inferred structural relationships.
- Unresolved structural nodes.
- Student-corrected nodes.

An unresolved record MUST NOT be displayed as a verified academic entity.
The UI MAY display a review item such as:
> `Subject name requires verification`
This is workflow metadata, not an invented subject name.

### 8.6 Empty nodes
A structural node with no eligible Tier-5 leaves:
- Remains visible if it has meaningful academic significance.
- Displays `0 / 0` and `0%`.
- Has an unchecked visual state.
- MUST NOT be interpreted as complete.
- MUST NOT contribute an artificial completion count.

A node containing only unresolved descendants MUST visibly communicate incomplete structural review.

### 8.7 Ordering
Sibling order MUST preserve the original academic sequence whenever available.
If source ordering is unavailable, deterministic extraction ordering is permitted, but the application MUST NOT claim that it represents the university's official ordering.

### 8.8 Curriculum modifications
Moving a node between parents, renaming it, or correcting its structure MUST preserve its stable identity where possible.
A correction that changes academic identity substantially SHOULD create an explicit revision or replacement operation rather than silently attaching historical completion to an unrelated topic.

---

## 9. Comprehensive Functional Requirements

### 9.1 Requirement conventions
All requirement IDs are permanent traceability identifiers.
Each requirement has: Priority, Classification, Description, User-facing behavior, Business rules, Data requirements, Failure behavior, Dependencies, Acceptance criteria.

- **Priority:**
  - **P0:** Critical.
  - **P1:** High.
  - **P2:** Medium.
  - **P3:** Future.
- **Classification:**
  - **I:** Implemented according to published repository evidence.
  - **P:** Partially implemented or implementation completeness unverified.
  - **N:** New or proposed requirement.
  - **U:** Unverified capability requiring audit.

---

### 9.2 FR-ING — Core Document Ingestion

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-ING-001 | PDF ingestion | P0 | I |
| FR-ING-002 | DOCX ingestion | P0 | I |
| FR-ING-003 | Legacy DOC conversion | P1 | I |
| FR-ING-004 | TXT ingestion | P0 | I |
| FR-ING-005 | Input validation | P0 | I |
| FR-ING-006 | Isolated temporary staging | P0 | I |
| FR-ING-007 | Deterministic parsing before LLM inference | P0 | P |
| FR-ING-008 | Asynchronous upload processing | P0 | I |
| FR-ING-009 | Upload progress reporting | P1 | I |
| FR-ING-010 | Cooperative cancellation | P1 | I |
| FR-ING-011 | Recovery from parser failure | P0 | P |
| FR-ING-012 | Duplicate document detection | P1 | N |
| FR-ING-013 | Safe scanned-document fallback | P1 | P |
| FR-ING-014 | Configurable ingestion limits | P0 | P |

#### FR-ING-001 — PDF ingestion
The application MUST accept supported PDF documents and extract their available text using deterministic parsing.
- Parser: pypdf.
- Page references MUST be one-based physical PDF page numbers.
- Digital text extraction MUST be attempted before expensive OCR/model-based fallback.
- Empty extraction MUST NOT automatically be treated as an empty syllabus.
- Encrypted, malformed, oversized, and unsupported PDFs MUST receive actionable errors.
- **Acceptance criteria:**
  - A valid digital PDF produces extracted text with page associations.
  - A malformed PDF produces a controlled failure.
  - An oversized PDF is rejected before expensive processing.
  - A scanned PDF with no usable text is marked as requiring OCR or manual handling.
  - Parsing failure does not corrupt previously saved syllabi.

#### FR-ING-002 — DOCX ingestion
The application MUST extract paragraphs and supported table content from DOCX files using python-docx.
- **Acceptance criteria:**
  - Paragraph text is preserved in document order.
  - Supported table cell relationships are retained.
  - Empty paragraphs do not generate academic leaves.
  - Unsupported embedded content is not represented as extracted academic text.

#### FR-ING-003 — DOC ingestion
Legacy DOC files MUST be converted using headless LibreOffice when available.
- **Acceptance criteria:**
  - Conversion runs in an isolated temporary location.
  - Execution has a bounded timeout.
  - Missing LibreOffice produces an actionable error.
  - Conversion failures clean up temporary files.
  - Converted content follows the normal document parsing and grounding pipeline.

#### FR-ING-004 — TXT ingestion
Plain-text files MUST be read with explicit encoding detection or safe fallback handling.
- **Acceptance criteria:**
  - UTF-8 documents are supported.
  - Unicode academic characters are preserved.
  - Invalid byte sequences do not crash the application.
  - Line ordering is preserved.

#### FR-ING-005 — Input validation
The backend MUST be authoritative for input validation.
- **Acceptance criteria:**
  - Client-side rejection improves usability but is never the security boundary.
  - Extension and actual file content are checked.
  - Upload size and page count limits are enforced.
  - Unsupported formats receive HTTP 415 or an equivalent structured application error.
  - Oversized uploads receive HTTP 413.

#### FR-ING-006 — Isolated temporary staging
Every ingestion job MUST use a unique staging directory.
- **Acceptance criteria:**
  - Concurrent uploads cannot overwrite each other's staged files.
  - Staging directories are cleaned after completion, cancellation, and failure.
  - Cleanup failures are logged without exposing sensitive local paths to the student.

#### FR-ING-007 — Deterministic parsing
The system MUST separate deterministic parsing from LLM interpretation.
- **Acceptance criteria:**
  - A document with clearly structured headings can be processed without requiring an LLM for basic text extraction.
  - Parser output remains available for provenance verification.
  - An LLM outage does not prevent access to existing curricula.
  - Fallback extraction does not invent academic content.

#### FR-ING-008 — Asynchronous processing
Long-running ingestion MUST NOT block the API event loop. The published architecture uses background worker-thread execution, bounded concurrency, and job tracking.
- **Acceptance criteria:**
  - Upload submission returns a job identifier.
  - The student can retrieve job status.
  - A failed job has an explicit terminal state.
  - A completed job has an explicit result.
  - Concurrent jobs respect configured resource limits.

#### FR-ING-009 — Progress reporting
The frontend MUST expose meaningful ingestion stages: `queued`, `validating`, `parsing`, `chunking`, `extracting`, `validating_result`, `persisting`, and terminal states.
- **Acceptance criteria:**
  - Progress is between 0 and 100.
  - Progress never decreases.
  - Terminal jobs cannot return to an active state.
  - SSE interruption falls back to status polling.
  - Progress announcements are accessible.

#### FR-ING-010 — Cancellation
Cancellation MUST be cooperative.
- **Acceptance criteria:**
  - Cancellation is acknowledged.
  - Processing checks cancellation between chunks and before persistence.
  - Cancelled jobs do not partially persist a curriculum.
  - Temporary files are cleaned.
  - A completed job cannot be retroactively cancelled.

#### FR-ING-011 — Parser failure recovery
The application MUST distinguish parser timeout, unavailable dependency, resource exhaustion, unsupported document, and malformed document errors.
- **Acceptance criteria:**
  - Each failure has a distinct actionable message.
  - Failed ingestion does not create a partial active curriculum.
  - Retrying creates a clean processing attempt.
  - Existing data remains unaffected.

#### FR-ING-012 — Duplicate document detection
The application SHOULD calculate a cryptographic content fingerprint. The fingerprint MAY support duplicate warnings, but identical source files MUST NOT automatically overwrite existing academic documents.
- **Acceptance criteria:**
  - A duplicate import can be recognized.
  - The user receives an explicit choice.
  - Existing completion records remain unchanged unless a replacement workflow is confirmed.

#### FR-ING-013 — Scanned-document fallback
OCR or Docling MUST remain optional and resource-bounded.
- **Acceptance criteria:**
  - Digital PDFs use the lightweight parser first.
  - OCR is only invoked when required and configured.
  - OCR failure produces a reviewable error.
  - OCR-derived evidence is distinguished from directly extracted text.

#### FR-ING-014 — Canonical limits
One backend configuration source MUST define ingestion limits.
- **Acceptance criteria:**
  - Frontend configuration reflects the backend.
  - Tests validate the same values.
  - Documentation identifies the effective values.
  - Configuration conflicts fail safely rather than silently selecting different limits.

---

### 9.3 FR-EXT — Structured Academic Extraction

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-EXT-001 | Structured extraction | P0 | I |
| FR-EXT-002 | Instructor integration | P0 | I |
| FR-EXT-003 | Local Ollama provider | P0 | I |
| FR-EXT-004 | OpenAI-compatible provider | P1 | I |
| FR-EXT-005 | Runtime provider configuration | P1 | P |
| FR-EXT-006 | Model availability checks | P1 | P |
| FR-EXT-007 | Bounded extraction retries | P0 | P |
| FR-EXT-008 | Chunk-aware curriculum merging | P0 | I |
| FR-EXT-009 | Schema validation | P0 | I |
| FR-EXT-010 | Provider failure recovery | P0 | P |
| FR-EXT-011 | Cloud-processing consent | P0 | P |

#### FR-EXT-001 — Structured extraction
The extraction system MUST return curriculum data conforming to the canonical academic hierarchy. A structured output schema MUST distinguish: Document metadata, Academic year, Semester, Subject, Module, Subtopic, Elective metadata, Lab metadata, Contact-hour metadata, Source provenance.

#### FR-EXT-002 — Instructor integration
Instructor MUST be used for supported structured-output extraction workflows.
- **Acceptance criteria:**
  - Provider output is validated against the expected Pydantic schema.
  - Invalid output is rejected or retried within configured limits.
  - A valid JSON-like response alone is insufficient to establish source grounding.

#### FR-EXT-003 — Local Ollama
The application MUST support configured local Ollama models (e.g. `llama3.1:8b`, `qwen2.5:7b`, `Qwen3-8B`). The system MUST NOT assume every model is installed.
- **Acceptance criteria:**
  - Missing Ollama produces an understandable diagnostic.
  - Missing model produces a model-unavailable diagnostic.
  - Existing local academic data remains usable.
  - No cloud fallback occurs without explicit permission.

#### FR-EXT-004 — OpenAI-compatible provider
The application MAY support configured OpenAI-compatible endpoints.
- **Acceptance criteria:**
  - Endpoint and model are configurable.
  - API credentials are not exposed in frontend configuration.
  - Requests use bounded timeouts.
  - Provider failure is isolated from local persistence.

#### FR-EXT-005 — Provider configuration
Provider selection MUST be controlled by centralized configuration (`EXTRACTION_PROVIDER`).

#### FR-EXT-006 — Model availability
The application SHOULD expose provider health and model readiness without disclosing credentials, filesystem secrets, or private environment variables.

#### FR-EXT-007 — Retry behavior
Retry behavior MUST be bounded: maximum three attempts, retry transient transport failures, do not retry permanent schema/auth failures, use bounded backoff, avoid duplicate persistence.

#### FR-EXT-008 — Chunk-aware merging
Large documents MUST preserve semantic chunk boundaries.
- **Acceptance criteria:**
  - Semester/year boundaries are preferred where confidently identified.
  - Paragraph boundaries provide fallback chunking.
  - Source provenance remains attached to each chunk.
  - Duplicate subjects and modules are reconciled deterministically.
  - Conflicting metadata is flagged when it cannot be safely reconciled.

#### FR-EXT-009 — Schema validation
The extractor MUST reject invalid academic structures (e.g., Module directly under a semester, Subtopic directly under a subject, missing parent references, invalid leaf provenance, unsupported tier).

#### FR-EXT-010 — Provider failure recovery
If extraction fails, the student MUST retain access to the source document or its safe staged representation until the job's retention policy expires. A failed extraction MUST NOT generate a falsely complete checklist.

#### FR-EXT-011 — Cloud consent
Cloud inference MUST require explicit student authorization. Local inference is the default where configured; cloud processing is visibly identified; credentials are never included in exported curriculum content.

---

### 9.4 FR-GRD — Source Grounding & Provenance

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-GRD-001 | Verbatim source evidence | P0 | I |
| FR-GRD-002 | Physical page references | P0 | I |
| FR-GRD-003 | Source offsets | P0 | I |
| FR-GRD-004 | Evidence validation | P0 | I |
| FR-GRD-005 | Explicit grounding states | P0 | I |
| FR-GRD-006 | Evidence inspection UI | P0 | I |
| FR-GRD-007 | Inferred-relationship disclosure | P1 | N |
| FR-GRD-008 | Evidence-preserving corrections | P1 | N |

#### FR-GRD-001 — Verbatim evidence
Every extracted academic leaf MUST retain an exact source excerpt whenever the source contains a corresponding excerpt. The application MUST NOT fabricate a quotation to satisfy a required field.

#### FR-GRD-002 — Page references
PDF-derived evidence MUST retain one-based physical page numbers. Non-paginated sources MAY use source offsets or document section identifiers.

#### FR-GRD-003 — Offsets
Where supported by the parser, the application SHOULD retain canonical source offsets (`source_start_offset`, `source_end_offset`) referring to normalized canonical text, not original byte offsets.

#### FR-GRD-004 — Evidence validation
The validator MUST verify that the stored evidence corresponds to the original extracted text (normalizing whitespace/wrapping without altering substantive wording).

#### FR-GRD-005 — Grounding states

| State | Meaning |
| --- | --- |
| verified | Evidence was successfully matched and validated. |
| needs_review | Evidence exists but is ambiguous, incomplete, or structurally uncertain. |
| unverified | Evidence cannot currently be established. |

#### FR-GRD-006 — Evidence inspection
The student MUST be able to inspect source evidence associated with a topic (excerpt, page/location, grounding state).

#### FR-GRD-007 — Inferred relationships
The application MUST distinguish inferred parent-child relationships from source-explicit headings (e.g., year assignment via semester number convention is an inference).

#### FR-GRD-008 — Evidence-preserving corrections
When a student edits an extracted topic:
- Original source evidence remains available.
- Student correction is identifiable as user-authored.
- Corrected display text does not overwrite the original quotation.
- The record's grounding state is recalculated or retained with an audit explanation.

---

### 9.5 FR-QLT — Extraction Quality & Sanitization

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-QLT-001 | Page-marker suppression | P0 | P |
| FR-QLT-002 | Repeated-header detection | P0 | P |
| FR-QLT-003 | Footer suppression | P0 | P |
| FR-QLT-004 | Administrative metadata separation | P0 | P |
| FR-QLT-005 | Duplicate topic detection | P0 | P |
| FR-QLT-006 | Cross-page table reconstruction | P0 | P |
| FR-QLT-007 | Continuation-heading detection | P0 | P |
| FR-QLT-008 | Placeholder prevention | P0 | P |
| FR-QLT-009 | Noise-review mechanism | P1 | N |
| FR-QLT-010 | Regression corpus | P0 | N |
| FR-QLT-011 | Confidence calibration | P1 | N |

#### FR-QLT-001 — Pagination markers
Markers such as `[Page 1]`, `[Page 2]`, and parser-generated pagination tokens MUST NOT become academic topics.

#### FR-QLT-002 — Repeated headers
The normalization engine SHOULD identify repeated text in consistent page-header regions and suppress administrative headers while preserving legitimate repeated topics.

#### FR-QLT-003 — Footers
Repeated page footers, contact details, and decorative text MUST be excluded from academic leaf generation.

#### FR-QLT-004 — Metadata separation
University name, department, program title, exam instructions, revision info, signatures, and TOC references SHOULD be stored as document metadata, not academic leaves.

#### FR-QLT-005 — Duplicate topics
The system MUST detect probable duplicates across adjacent paragraphs, repeated page headings, and chunk boundaries without merging distinct topics with similar names.

#### FR-QLT-006 — Cross-page tables
The application MUST attempt to reconstruct tables split across pages, preserving column order, row association, and source-page provenance.

#### FR-QLT-007 — Continuation headings
A module heading split across pages MUST be reconstructed only when continuation evidence is sufficient, or enter review.

#### FR-QLT-008 — Placeholder prevention
The application MUST NOT silently create academic entities named `General Curriculum`, `Course 2`, `Unit 2`, `Unknown Subject`, or `Untitled Module`. Temporary unresolved records are used instead.

#### FR-QLT-009 — Noise review
The student SHOULD be able to inspect uncertain source regions excluded from academic extraction.

#### FR-QLT-010 — Regression corpus
A maintained test corpus MUST include multi-page digital PDFs, repeated headers/footers, page markers, split tables, merged cells, wrapped headings, repeated topics, missing titles, contact-hour tables, scanned PDFs, mixed-language content, and interleaved text.

#### FR-QLT-011 — Confidence calibration
Extraction confidence categories (High confidence, Review recommended, Insufficient evidence) are decision aids, not probabilities.

---

### 9.6 FR-TRE — Five-Tier Academic Tree

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-TRE-001 | Canonical five-tier structure | P0 | I/P |
| FR-TRE-002 | Stable node identity | P0 | P |
| FR-TRE-003 | Valid parent relationships | P0 | I/P |
| FR-TRE-004 | Academic ordering | P1 | P |
| FR-TRE-005 | Empty-node handling | P0 | P |
| FR-TRE-006 | Structural review states | P0 | P |
| FR-TRE-007 | Safe curriculum editing | P1 | N |
| FR-TRE-008 | Academic metadata preservation | P1 | P |

- **Acceptance criteria:**
  - Every valid document contains exactly five possible academic tiers.
  - No structural node is incorrectly promoted into another academic tier.
  - A leaf cannot exist without a module parent; a module cannot exist without a subject parent.
  - Invalid hierarchy is rejected before persistence.
  - Empty branches display `0 / 0` and `0%`.
  - Structural review metadata is not treated as academic progress.

---

### 9.7 FR-PRG — Leaf-Only Completion & Tri-State Logic

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-PRG-001 | Leaf-only persistence | P0 | I |
| FR-PRG-002 | Uniform leaf weighting | P0 | I |
| FR-PRG-003 | Parent tri-state derivation | P0 | I |
| FR-PRG-004 | Multi-level aggregation | P0 | I |
| FR-PRG-005 | Parent bulk interaction | P1 | I/P |
| FR-PRG-006 | Elective-aware denominator | P0 | P |
| FR-PRG-007 | Idempotent updates | P0 | P |
| FR-PRG-008 | Historical progress retention | P0 | P |
| FR-PRG-009 | Structural-change recalculation | P0 | N |

#### Canonical completion formula
Let:
- $L$ = set of eligible Tier-5 leaves.
- $N = |L|$.
- $C$ = number of completed leaves in $L$.

Then:
$$Progress = \begin{cases} \frac{C}{N} \times 100 & N > 0 \\ 0 & N = 0 \end{cases}$$

Every leaf has weight $w_i = 1$. No other metadata changes this weighting.

#### Tri-state rules

| Condition | State |
| --- | --- |
| $N = 0$ | Unchecked |
| $C = 0, N > 0$ | Unchecked |
| $0 < C < N$ | Indeterminate |
| $C = N > 0$ | Checked |

#### Eligibility
A leaf is eligible when:
- It belongs to the active academic document.
- All its ancestor nodes are valid.
- Its subject belongs to an actively enrolled course.
- Its academic record is not explicitly archived or excluded from active progress.

#### Parent interaction
- Checking a parent marks all eligible descendant leaves complete atomically.
- Unchecking a parent marks all eligible descendant leaves incomplete.
- Activating an indeterminate parent marks all eligible descendants complete by default.
- Parent completion states are dynamically derived and never persisted.
- Unenrolled electives do not affect active progress, but their historical completions remain safely stored.

---

### 9.8 FR-ELC — Elective Onboarding

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-ELC-001 | Elective classification | P0 | P |
| FR-ELC-002 | Enrollment review modal | P1 | I |
| FR-ELC-003 | Mandatory course locking | P0 | I |
| FR-ELC-004 | Enrollment persistence | P0 | P |
| FR-ELC-005 | Historical completion preservation | P0 | I |
| FR-ELC-006 | Historical notes preservation | P0 | N |
| FR-ELC-007 | Historical resource preservation | P0 | N |
| FR-ELC-008 | Re-enrollment restoration | P0 | I/P |
| FR-ELC-009 | Enrollment recalculation | P0 | P |
| FR-ELC-010 | Uncertain elective review | P1 | N |

#### Enrollment states
- `mandatory`
- `enrolled`
- `not_enrolled`
- `pending_review`

#### Rules
- Mandatory subjects cannot be excluded.
- Excluding an elective removes it from the active workload denominator.
- Completion records, notes, and bookmarks are preserved upon unenrollment.
- Re-enabling an elective restores historical records. No toggle physically deletes curriculum records.

---

### 9.9 FR-LAB — Laboratory Classification & Contact Hours

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-LAB-001 | Lab classification | P1 | I |
| FR-LAB-002 | User correction | P1 | N |
| FR-LAB-003 | Manual override | P1 | N |
| FR-LAB-004 | Collapsed default presentation | P1 | I |
| FR-LAB-005 | Contact-hour metadata | P1 | I |
| FR-LAB-006 | Contextual badge display | P1 | P |
| FR-LAB-007 | Contact-hour aggregation | P2 | N |

- Lab classification uses `is_lab: true`.
- Lab subjects are collapsed by default in the UI.
- Lab leaves retain standard completion weight $w_i = 1$.
- `contact_hours` values are non-negative informational metadata and do not affect progress percentages.
- Subject contact-hour aggregation:
$$SubjectContactHours = \sum ModuleContactHours$$

---

### 9.10 FR-PAC — Study Pacing & Examination Deadlines

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-PAC-001 | Semester examination target | P1 | N |
| FR-PAC-002 | Subject examination target | P1 | N |
| FR-PAC-003 | Deadline precedence | P1 | N |
| FR-PAC-004 | Remaining topic calculation | P1 | N |
| FR-PAC-005 | Topics-per-week calculation | P1 | N |
| FR-PAC-006 | Remaining declared hours | P1 | N |
| FR-PAC-007 | Available study capacity | P1 | N |
| FR-PAC-008 | Deadline feasibility | P1 | N |
| FR-PAC-009 | Deterministic study status | P1 | N |
| FR-PAC-010 | Deadline change handling | P1 | N |

#### Deadline precedence & date handling
- Subject-specific date overrides semester date.
- Store date-only values as calendar dates (avoid silent time zone shifts).
- Remaining topics: $R = N - C$.
- Remaining weeks: $D = \max(0, \text{CalendarDaysUntilDeadline})$, $W_{effective} = \max\left(1, \frac{D}{7}\right)$ when $D > 0$.
- Topics per week: $TopicsPerWeek = \frac{R}{W_{effective}}$.

#### Study status

| State | Deterministic rule |
| --- | --- |
| completed | Remaining eligible topics = 0 |
| behind | Required weekly pace exceeds available weekly topic capacity |
| at_risk | Required pace is feasible but exceeds 80% of declared available capacity |
| on_track | Required pace is at or below 80% of available capacity |

---

### 9.11 FR-NOT — Topic-Specific Notes

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-NOT-001 | Tier-5 note association | P1 | N |
| FR-NOT-002 | Markdown editor | P1 | N |
| FR-NOT-003 | Debounced autosave | P1 | N |
| FR-NOT-004 | Save-status feedback | P1 | N |
| FR-NOT-005 | Recovery of pending edits | P1 | N |
| FR-NOT-006 | Conflict-safe updates | P1 | N |
| FR-NOT-007 | Elective history retention | P1 | N |
| FR-NOT-008 | Backup inclusion | P1 | N |

- Notes belong to stable Tier-5 leaf IDs.
- Autosave default: 750 ms debounce, save on blur, explicit save status, local draft recovery.
- Version mismatch detection prevents silent overwrites.

---

### 9.12 FR-RES — Learning Resource Bookmarks

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-RES-001 | Topic-resource association | P1 | N |
| FR-RES-002 | Resource metadata | P1 | N |
| FR-RES-003 | URL validation | P1 | N |
| FR-RES-004 | Duplicate handling | P2 | N |
| FR-RES-005 | Resource editing | P1 | N |
| FR-RES-006 | External-link opening | P1 | N |
| FR-RES-007 | Backup inclusion | P1 | N |

- Proposed types: `lecture`, `video`, `academic_reference`, `website`, `other`.
- External links require user interaction. Bookmarks survive elective changes and backup restoration.

---

### 9.13 FR-EXP — Export & Backup

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-EXP-001 | Markdown export | P1 | N |
| FR-EXP-002 | Notion-compatible structure | P1 | N |
| FR-EXP-003 | JSON Schema 2.1 export | P0 | U |
| FR-EXP-004 | Full hierarchy export | P0 | N |
| FR-EXP-005 | Completion export | P0 | N |
| FR-EXP-006 | Notes and resource export | P1 | N |
| FR-EXP-007 | HTML report | P1 | N |
| FR-EXP-008 | PDF print output | P1 | N |
| FR-EXP-009 | Backup integrity manifest | P0 | N |

- Backups include: document IDs, hierarchy, metadata, leaf completions, enrollment state, inactive electives, notes, bookmarks, provenance, schema version, timestamps, and checksum manifest.

---

### 9.14 FR-IMP — Backup Restoration & Recovery

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-IMP-001 | Schema validation | P0 | N |
| FR-IMP-002 | Integrity verification | P0 | N |
| FR-IMP-003 | Import preview | P1 | N |
| FR-IMP-004 | Duplicate detection | P1 | N |
| FR-IMP-005 | Conflict handling | P0 | N |
| FR-IMP-006 | Transactional restore | P0 | N |
| FR-IMP-007 | Rollback | P0 | N |
| FR-IMP-008 | Backward compatibility | P1 | N |
| FR-IMP-009 | Recovery reporting | P1 | N |

- Transactional restore: Parse → Validate schema/checksum/hierarchy/FKs → Preview → Begin transaction → Apply → Verify → Commit (or Rollback on any failure).

---

### 9.15 FR-WEB — Secure Academic Portal Ingestion

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-WEB-001 | URL submission | P2 | U |
| FR-WEB-002 | Scheme restrictions | P0 | N |
| FR-WEB-003 | DNS/IP validation | P0 | N |
| FR-WEB-004 | Redirect validation | P0 | N |
| FR-WEB-005 | SSRF protection | P0 | N |
| FR-WEB-006 | Download limits | P0 | N |
| FR-WEB-007 | Embedded PDF discovery | P2 | N |
| FR-WEB-008 | Portal provenance | P1 | N |
| FR-WEB-009 | Authentication boundaries | P0 | N |
| FR-WEB-010 | Untrusted-content isolation | P0 | P |

- Strict SSRF protection: reject loopback, private IPv4/IPv6, link-local, multicast, cloud metadata endpoints.
- Re-validate destination IP upon connection and on every redirect (maximum 5 redirects).
- Download limits: max 50 MiB per resource, max 10 PDFs per portal, max 100 MiB total, 10s connect timeout, 60s overall timeout.
- Authentication/paywall bypass is prohibited. Imported content is treated strictly as untrusted data.

---

### 9.16 FR-CLI — Windows Global CLI

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-CLI-001 | Global launcher | P0 | I |
| FR-CLI-002 | Start and stop | P0 | I |
| FR-CLI-003 | Status | P1 | I |
| FR-CLI-004 | Logs | P1 | I |
| FR-CLI-005 | Restart | P1 | I |
| FR-CLI-006 | Single-instance protection | P0 | I |
| FR-CLI-007 | Safe port management | P0 | I |
| FR-CLI-008 | Process-tree supervision | P0 | I |
| FR-CLI-009 | Safe uninstallation | P1 | I |
| FR-CLI-010 | Path and Unicode compatibility | P1 | P |

- Commands: `syllabus`, `syllabus start`, `syllabus stop`, `syllabus status`, `syllabus logs`, `syllabus restart`, `syllabus help`.
- Only manages application-owned processes; protects existing Ollama instances and unrelated port listeners.

---

### 9.17 FR-UI — Responsive UI & Design System

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-UI-001 | Academic workspace | P1 | P |
| FR-UI-002 | Responsive navigation | P1 | N |
| FR-UI-003 | Compact academic tree | P1 | P |
| FR-UI-004 | Contextual action grouping | P1 | N |
| FR-UI-005 | Search | P1 | P |
| FR-UI-006 | Command palette | P2 | N |
| FR-UI-007 | Dark/light/system themes | P1 | P |
| FR-UI-008 | Progress visualization | P1 | I/P |
| FR-UI-009 | Accessible modal behavior | P1 | P |
| FR-UI-010 | Mobile notes drawer | P1 | N |

#### Proposed visual tokens

| Token | Proposed value |
| --- | --- |
| Dark background | `#020617` |
| Primary surface | `#0F172A` |
| Secondary surface | `#111827` |
| Primary accent | `#34D399` |
| Primary text | `#F8FAFC` |
| Secondary text | `#94A3B8` |
| Border | `#334155` |
| Warning | Accessible amber variant |
| Error | Accessible red variant |

---

### 9.18 FR-ACC — Accessibility

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-ACC-001 | WCAG 2.2 AA target | P1 | N |
| FR-ACC-002 | Keyboard navigation | P1 | P |
| FR-ACC-003 | Visible focus | P1 | P |
| FR-ACC-004 | Screen-reader labels | P1 | P |
| FR-ACC-005 | Tri-state announcements | P0 | P |
| FR-ACC-006 | Reduced motion | P2 | N |
| FR-ACC-007 | Touch targets | P1 | N |
| FR-ACC-008 | Accessible validation | P1 | P |

---

### 9.19 FR-OFF — Offline Desktop & Browser Operation

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-OFF-001 | Local desktop availability | P0 | I/P |
| FR-OFF-002 | Offline checklist operation | P0 | P |
| FR-OFF-003 | Offline completion persistence | P0 | I/P |
| FR-OFF-004 | Offline notes | P1 | N |
| FR-OFF-005 | Offline backup generation | P1 | N |
| FR-OFF-006 | Browser-local storage | P2 | N |
| FR-OFF-007 | Storage quota handling | P2 | N |

---

### 9.20 FR-PWA — Progressive Web Application

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-PWA-001 | Web manifest | P2 | N |
| FR-PWA-002 | Service worker | P2 | N |
| FR-PWA-003 | Installable application shell | P2 | N |
| FR-PWA-004 | Offline static assets | P2 | N |
| FR-PWA-005 | Cache versioning | P2 | N |
| FR-PWA-006 | Update lifecycle | P2 | N |
| FR-PWA-007 | Browser storage recovery | P2 | N |

---

### 9.21 FR-SYN — Optional Cross-Device Synchronization (Deferred)

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-SYN-001 | Durable outbox | P3 | N |
| FR-SYN-002 | Idempotent operations | P3 | N |
| FR-SYN-003 | Retry handling | P3 | N |
| FR-SYN-004 | Conflict detection | P3 | N |
| FR-SYN-005 | Conflict resolution | P3 | N |
| FR-SYN-006 | Data versioning | P3 | N |
| FR-SYN-007 | Explicit opt-in | P3 | N |

---

### 9.22 FR-SEC — Security & Privacy

| ID | Requirement | Priority | Classification |
| --- | --- | --- | --- |
| FR-SEC-001 | Safe file validation | P0 | P |
| FR-SEC-002 | Temporary-file isolation | P0 | I |
| FR-SEC-003 | Path traversal protection | P0 | N |
| FR-SEC-004 | Resource-exhaustion protection | P0 | P |
| FR-SEC-005 | LLM prompt-injection isolation | P0 | P |
| FR-SEC-006 | Credential protection | P0 | P |
| FR-SEC-007 | Local database protection | P0 | P |
| FR-SEC-008 | SSRF protection | P0 | N |
| FR-SEC-009 | Safe error messages | P0 | P |
| FR-SEC-010 | No mandatory telemetry | P0 | N |
| FR-SEC-011 | Data deletion confirmation | P0 | P |
| FR-SEC-012 | Privacy disclosure for external processing | P0 | N |

---

## 10. User Stories & Measurable Acceptance Criteria

### 10.1 Core ingestion stories

| ID | Persona | User story | Measurable acceptance criteria |
| --- | --- | --- | --- |
| US-001 | Engineering student | Import a PDF syllabus | A valid PDF is parsed and associated with its original physical pages. |
| US-002 | Engineering student | Import a DOCX syllabus | Paragraphs and supported tables are extracted without losing document order. |
| US-003 | Engineering student | Import a DOC syllabus | LibreOffice conversion succeeds or provides a clear dependency error. |
| US-004 | Self-paced learner | Import a TXT syllabus | Unicode content is preserved and processed. |
| US-005 | All | View ingestion progress | Job stage and progress are displayed without blocking the interface. |
| US-006 | All | Cancel an upload | Cancellation prevents partial curriculum persistence. |
| US-007 | All | Retry failed ingestion | A new attempt does not reuse corrupted temporary state. |
| US-008 | All | Import a large PDF | Processing respects configured page, text, concurrency, and timeout limits. |

### 10.2 Extraction and grounding stories

| ID | Persona | User story | Measurable acceptance criteria |
| --- | --- | --- | --- |
| US-009 | Engineering student | Extract academic hierarchy | Output contains only the canonical five academic tiers. |
| US-010 | All | Review uncertain extraction | Every review-required record is visibly distinguishable. |
| US-011 | All | Inspect source evidence | A topic exposes its original quotation and available page/location. |
| US-012 | All | Avoid pagination noise | `[Page N]` markers generate zero academic leaves. |
| US-013 | All | Avoid repeated headers | Repeated administrative headers do not appear as checklist topics. |
| US-014 | All | Preserve legitimate repeated topics | Genuine academic headings are not removed solely because they repeat. |
| US-015 | Engineering student | Import a split-table syllabus | Reconstructed rows preserve column relationships and source-page associations. |
| US-016 | All | Handle missing structural titles | No generic placeholder is silently presented as a verified course or module. |
| US-017 | All | Correct a topic | The original source excerpt remains available after correction. |
| US-018 | All | Handle an LLM failure | No unsupported academic hierarchy is persisted as verified content. |

### 10.3 Hierarchy and progress stories

| ID | Persona | User story | Measurable acceptance criteria |
| --- | --- | --- | --- |
| US-019 | Engineering student | Navigate academic years | Every semester remains associated with exactly one year. |
| US-020 | Engineering student | Open a subject | Subject modules and their leaves remain nested correctly. |
| US-021 | All | Check a topic | Only the selected Tier-5 completion record changes. |
| US-022 | All | View parent completion | Parent tri-state is derived from eligible descendant leaves. |
| US-023 | All | Bulk-complete a module | All eligible descendant leaves update atomically. |
| US-024 | All | View an empty module | It displays `0 / 0`, `0%`, and unchecked. |
| US-025 | Engineering student | View semester progress | The percentage equals completed eligible leaves divided by total eligible leaves. |
| US-026 | All | Exclude an elective | Its historical completion remains stored but is excluded from active progress. |
| US-027 | All | Re-enable an elective | Previous completion and academic identity are restored. |

### 10.4 Elective and laboratory stories

| ID | Persona | User story | Measurable acceptance criteria |
| --- | --- | --- | --- |
| US-028 | Engineering student | Configure electives | The onboarding interface lists elective choices and enrollment states. |
| US-029 | Engineering student | Preserve mandatory courses | Mandatory courses cannot be excluded. |
| US-030 | Engineering student | Change elective enrollment | Completion, notes, and resources are retained. |
| US-031 | Engineering student | Identify laboratory subjects | Lab subjects display a contextual classification badge. |
| US-032 | Engineering student | View lab progress | Lab topics contribute the same leaf weight as theory topics. |
| US-033 | Engineering student | View contact hours | Declared hours are displayed as informational metadata. |

### 10.5 Academic planning stories

| ID | Persona | User story | Measurable acceptance criteria |
| --- | --- | --- | --- |
| US-034 | Crammer | Set semester examination date | The semester deadline is saved and displayed. |
| US-035 | Crammer | Set subject examination date | The subject date overrides the semester date for that subject. |
| US-036 | Crammer | View remaining topics | The count equals eligible incomplete Tier-5 leaves. |
| US-037 | Crammer | View weekly topic target | The calculation uses remaining topics and available weeks. |
| US-038 | Crammer | View workload hours | Unknown contact hours remain unknown rather than becoming fabricated estimates. |
| US-039 | Crammer | Identify overdue subjects | Overdue status is displayed after the examination date has passed. |
| US-040 | Crammer | Change a deadline | Planning recalculates without changing completion records. |
| US-041 | Crammer | View study status | The status follows the documented deterministic capacity rules. |

### 10.6 Student utility stories

| ID | Persona | User story | Measurable acceptance criteria |
| --- | --- | --- | --- |
| US-042 | Self-paced learner | Write a topic note | A note is associated with a stable Tier-5 ID. |
| US-043 | Self-paced learner | Edit Markdown | Supported Markdown syntax is retained. |
| US-044 | All | Autosave a note | Saved changes survive application restart. |
| US-045 | All | Recover unsaved work | Pending drafts are recoverable after an interrupted save. |
| US-046 | Self-paced learner | Bookmark a lecture | A resource is associated with the correct topic. |
| US-047 | Self-paced learner | Edit a resource | The resource can be changed without modifying progress. |
| US-048 | All | Open an external link | The external resource opens only after explicit user interaction. |

### 10.7 Export and recovery stories

| ID | Persona | User story | Measurable acceptance criteria |
| --- | --- | --- | --- |
| US-049 | All | Export Markdown | The complete academic hierarchy and completion summary are preserved. |
| US-050 | All | Export JSON | The backup contains its schema version and all required academic records. |
| US-051 | All | Export a printable report | HTML/PDF output includes readable hierarchy and progress. |
| US-052 | All | Restore a backup | Schema and integrity validation occur before persistence. |
| US-053 | All | Handle conflicting IDs | Conflicts are previewed and resolved explicitly. |
| US-054 | All | Recover from failed restoration | Existing records remain unchanged after rollback. |
| US-055 | All | Import an older backup | Supported older schemas are migrated through explicit versioned migrations. |

### 10.8 Web ingestion stories

| ID | Persona | User story | Measurable acceptance criteria |
| --- | --- | --- | --- |
| US-056 | Engineering student | Import a university portal URL | The portal is fetched only after security validation. |
| US-057 | Engineering student | Discover embedded PDFs | Supported PDF links are identified and validated. |
| US-058 | All | Submit a private IP URL | The request is rejected before content retrieval. |
| US-059 | All | Encounter a malicious redirect | The destination is revalidated and blocked. |
| US-060 | All | Encounter a login-protected portal | The application explains that authenticated retrieval is unsupported. |

### 10.9 UI and offline stories

| ID | Persona | User story | Measurable acceptance criteria |
| --- | --- | --- | --- |
| US-061 | All | Use the application offline | Existing academic records remain accessible without internet. |
| US-062 | All | Check topics offline | Changes persist in local storage. |
| US-063 | All | Use a 360px screen | Essential actions remain accessible without unintended horizontal overflow. |
| US-064 | All | Navigate with keyboard | Essential operations can be completed without a mouse. |
| US-065 | All | Open command palette | `Ctrl+K` opens the palette on Windows/Linux. |
| US-066 | All | Change theme | Dark, light, and system preferences work consistently. |
| US-067 | All | Use mobile navigation | Navigation adapts without hiding essential functionality. |
| US-068 | All | Install PWA | Supported browsers can install the application after PWA implementation. |
| US-069 | All | Recover interrupted operations | Existing records remain intact after process interruption. |

---

## 11. Non-Functional Requirements & Proposed SLAs

### 11.1 NFR-PER — Performance

| ID | Operation | Proposed target | Measurement conditions |
| --- | --- | --- | --- |
| NFR-PER-001 | Application UI initialization | Under 3 seconds | Warm local desktop environment |
| NFR-PER-002 | Expand/collapse a tree node | Under 100 ms | 1,000-node representative curriculum |
| NFR-PER-003 | Single checkbox update | Under 100 ms | Local database, normal workload |
| NFR-PER-004 | Progress recalculation | Under 150 ms | 10,000 eligible leaves |
| NFR-PER-005 | Search | Under 200 ms | 10,000 academic nodes |
| NFR-PER-006 | Note autosave | Under 500 ms after debounce | Local SQLite |
| NFR-PER-007 | Backup validation | Under 5 seconds for a 10 MiB backup | Local machine |
| NFR-PER-008 | Local export | Under 5 seconds for 10,000 leaves | Local machine |
| NFR-PER-009 | Deterministic PDF parsing | Under 10 seconds for 100 pages | Documented test hardware |
| NFR-PER-010 | LLM extraction | No fixed latency guarantee | Provider/model-dependent |

### 11.2 NFR-REL — Reliability

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-REL-001 | Leaf persistence | No acknowledged completion update may disappear after a successful transaction. |
| NFR-REL-002 | Parent derivation | Parent states always agree with descendant completion records. |
| NFR-REL-003 | Ingestion atomicity | Failed ingestion leaves no partial active curriculum. |
| NFR-REL-004 | Restore atomicity | Failed restoration leaves the existing database unchanged. |
| NFR-REL-005 | Recovery | Interrupted jobs reach a recoverable state. |
| NFR-REL-006 | Referential integrity | All persisted academic relationships satisfy foreign-key constraints. |
| NFR-REL-007 | Migration safety | Database migration failures do not silently destroy the previous usable state. |

### 11.3 NFR-OFF — Offline resilience
The application MUST support opening previously persisted documents, navigating hierarchy, updating leaf completions, calculating progress, editing local notes, viewing bookmarks, and exporting local academic data offline.

### 11.4 NFR-PRV — Privacy
Operate without mandatory account or telemetry. Default to local processing when configured. Require explicit consent before cloud LLM submission. Keep provider credentials out of frontend responses and backups.

### 11.5 NFR-SEC — Security
Validate uploaded file content, isolate temporary files, bound system resources, prevent path traversal and SSRF, treat imported text as untrusted data, protect API credentials, and sanitize error messages.

### 11.6 NFR-ACC — Accessibility
Target: WCAG 2.2 AA for supported browser interfaces (keyboard interaction, semantic markup, screen-reader labels, tri-state announcements, visible focus, touch targets).

### 11.7 NFR-COMP — Compatibility

| Platform | Requirement |
| --- | --- |
| Windows 11 | Primary supported desktop environment |
| Windows PowerShell | Global CLI compatibility |
| Modern Chromium browsers | Primary browser target |
| Firefox | Compatibility target |
| Safari | Compatibility target where browser features permit |
| Android browsers | Responsive/PWA target |
| iOS Safari | Responsive/PWA target subject to platform limitations |
| Capacitor WebView | Future compatibility target |

### 11.8 NFR-DB — Database reliability
SQLite requirements: WAL mode, foreign-key enforcement, transactional writes, explicit busy timeout, safe migration, consistent backup behavior, and controlled connection lifecycle.

### 11.9 Proposed operational service levels

| Metric | Proposed target |
| --- | --- |
| Local core availability | Available whenever local runtime is operational |
| Acknowledged completion durability | Transaction committed before success confirmation |
| Failed ingestion recovery | Existing academic records remain unaffected |
| Failed restore recovery | Full rollback |
| Backup validation | 100% of required integrity checks pass before restoration |
| Critical hierarchy integrity | Zero invalid parent-child relationships in committed data |
| Completion consistency | Zero persisted parent-completion records |

---

## 12. Privacy, Security & Data Governance

### 12.1 Data classification

| Data type | Classification | Handling |
| --- | --- | --- |
| Academic syllabus | User-owned academic data | Local by default |
| Academic completion | Personal academic progress | Local persistence |
| Notes | Personal learning material | Local persistence |
| Bookmarks | User-created content | Local persistence |
| Source excerpts | Imported academic material | Retain only as needed for traceability |
| Cloud API credentials | Secret | Never expose to frontend |
| Provider request content | Potentially sensitive | Explicit consent before cloud submission |
| Diagnostic logs | Operational data | Minimize and redact |

### 12.2 Data ownership
The student controls academic documents, curriculum corrections, elective enrollment, completion states, notes, resources, deadlines, backups, and deletion.

### 12.3 Uploaded document security
Enforce server-side file type and size validation, isolated temporary storage, path sanitization, processing timeouts, and safe cleanup.

### 12.4 LLM prompt-injection defense
Imported text must be enclosed within `<UNTRUSTED_DOCUMENT_CONTENT>` and treated strictly as data. The extractor MUST NOT execute instructions found inside documents.

### 12.5 Local database governance
Store SQLite database files in an application-controlled local directory, enforce referential integrity and WAL mode, and avoid putting secrets in academic records.

### 12.6 Cloud provider governance
Explicit student consent is required before transmitting document snippets to any cloud provider.

### 12.7 Logging policy
Logs should redact full source texts, notes, credentials, and unnecessary absolute paths.

### 12.8 Data deletion
Deleting a syllabus is distinct from unenrollment; it requires explicit student confirmation and optional export before permanent deletion.

---

## 13. Product Analytics & Success Metrics

### 13.1 Measurement philosophy
Privacy-respecting local diagnostic measurements are preferred. Remote analytics are disabled by default.

### 13.2 Product success metrics

| Metric ID | Metric | Definition | Desired direction |
| --- | --- | --- | --- |
| MET-001 | Successful ingestion rate | Completed valid ingestion jobs / valid ingestion attempts | Increase |
| MET-002 | Extraction correction rate | Corrected extracted records / reviewed extracted records | Decrease |
| MET-003 | Invalid hierarchy rate | Invalid hierarchy records / extracted records | Decrease to zero |
| MET-004 | Provenance coverage | Leaves with usable provenance / extracted leaves | Increase |
| MET-005 | Review rate | Records requiring review / extracted records | Monitor |
| MET-006 | Checklist latency | Time between user interaction and confirmed update | Decrease |
| MET-007 | Progress correctness | Correct aggregation cases / tested cases | 100% |
| MET-008 | Backup restoration success | Successful valid restorations / valid restore attempts | Increase |
| MET-009 | Notes persistence reliability | Recoverable saved notes / acknowledged saved notes | 100% |
| MET-010 | Mobile usability completion | Completed core workflows on mobile viewports / attempted workflows | Increase |
| MET-011 | Offline workflow success | Completed offline core workflows / attempted offline workflows | Increase |
| MET-012 | Elective retention integrity | Preserved historical records / records existing before unenrollment | 100% |

---

## 14. UX/UI Requirements & Responsive Behavior

### 14.1 Design philosophy
A calm, minimalist academic workspace focused on structure, remaining work, available actions, and verified progress.

### 14.2 Visual hierarchy
Communicate depth via typography, indentation, and spacing rather than 5 layers of identical bordered cards.

### 14.3 Proposed responsive behavior

| Viewport | Layout behavior |
| --- | --- |
| 360–767px | Mobile navigation, compact tree, contextual actions |
| 768–1023px | Tablet layout, collapsible sidebar |
| 1024–1439px | Standard desktop workspace |
| 1440–2560px | Wide desktop with controlled content width |

### 14.4 Mobile layout
Compact tree indentation, drawer/bottom-sheet notes, contextual menus for secondary actions, touch targets $\ge 44\text{px}$.

### 14.5 Desktop layout
Persistent document navigation, main academic tree, contextual detail panels, search, progress summaries, and notes drawer.

### 14.6 Command palette
Triggered via `Ctrl+K` (Windows/Linux) / `Cmd+K` (macOS). Supports document switching, semester navigation, searching topics, opening notes, and managing electives.

### 14.7 Theme system
Persistent local choice of Dark, Light, or System modes.

### 14.8 Feedback states
Loading, Saving, Saved, Unsaved, Processing, Needs review, Failed, Offline, Completed, Overdue.

### 14.9 Error presentation
Actionable, contextual, understandable, and free of raw stack traces.

### 14.10 Academic tree interactions
Expand/collapse does not change completion; checking a leaf never unexpectedly collapses ancestors; full keyboard navigation support.

### 14.11 Responsive acceptance gate
Verified viewports: 360px, 390px, 430px, 768px, 1024px, 1280px, 1440px, 1920px.

---

## 15. Product Risks & Mitigation

### 15.1 Risk register

| Risk ID | Risk | Likelihood | Impact | Mitigation | Requirements |
| --- | --- | --- | --- | --- | --- |
| RSK-001 | Inconsistent university formats | High | High | Deterministic parser fallbacks and review workflow | FR-ING, FR-QLT |
| RSK-002 | Split multi-page tables | High | High | Table reconstruction and source review | FR-QLT-006 |
| RSK-003 | LLM invents academic content | Medium | Critical | Evidence validation and uncertain-state handling | FR-EXT, FR-GRD |
| RSK-004 | Electives misclassified | Medium | High | Student confirmation and correction | FR-ELC |
| RSK-005 | Contact-hour data missing | High | Medium | Unknown-value handling (do not invent zeros) | FR-LAB |
| RSK-006 | Large PDF exhausts resources | Medium | Critical | Bounded parsing, concurrency, and timeouts | FR-ING, NFR-PER |
| RSK-007 | Legacy DOC conversion fails | Medium | Medium | Optional dependency and clear diagnostics | FR-ING-003 |
| RSK-008 | Malicious URL SSRF | Medium | Critical | Connection-time DNS/IP validation | FR-WEB |
| RSK-009 | SQLite migration corruption | Low | Critical | Transactional migrations and verified backups | FR-IMP |
| RSK-010 | Browser storage quota exceeded | Medium | High | Quota handling and export guidance | FR-OFF, FR-PWA |
| RSK-011 | Sync conflict creation | High | High | Versioning and explicit conflict resolution | FR-SYN |
| RSK-012 | Capacitor/Browser storage divergence | Medium | High | Explicit persistence adapter boundary | FR-PWA |
| RSK-013 | Backup schema incompatible | Medium | Critical | Versioned migrations and validation | FR-EXP, FR-IMP |
| RSK-014 | Header filtering removes valid topics | Medium | High | Evidence-aware normalization and review | FR-QLT |
| RSK-015 | Inactive elective data deleted | Medium | Critical | Enrollment state separated from deletion | FR-ELC |
| RSK-016 | Extraction cancellation leaves partial data | Medium | High | Atomic persistence and cooperative cancellation | FR-ING |
| RSK-017 | OCR memory exhaustion | Medium | High | Opt-in OCR, bounded concurrency | FR-ING-013 |
| RSK-018 | Provider leaks credentials | Low | Critical | Secret-safe configuration boundaries | FR-SEC |
| RSK-019 | Parent progress inconsistent | Medium | Critical | Single-source leaf persistence & invariant tests | FR-PRG |
| RSK-020 | Mobile interface hides controls | Medium | High | Responsive workflow testing | FR-UI |
| RSK-021 | Untrusted document prompt injection | Medium | High | Instruction/data separation & restricted capabilities | FR-SEC-005 |
| RSK-022 | Database backup inconsistent during writes | Medium | Critical | SQLite-consistent backup mechanism | FR-EXP |

### 15.2 Highest-priority risks
- **RSK-003 (LLM Hallucination):** Mitigated by strict verbatim quotation matching, provenance offsets, and explicit `needs_review`/`unverified` flags.
- **RSK-008 (SSRF):** Mitigated by connection-time DNS resolution checks against private and reserved IP blocks across all redirects.
- **RSK-009 (Database Migration):** Mitigated by transactional schema migrations and pre-migration backups.
- **RSK-015 (Elective History Loss):** Mitigated by explicit enrollment state flags (`not_enrolled`) that retain full historical rows.

---

## 16. Dependencies & Technical Constraints

### 16.1 Existing technical dependencies

| Dependency | Purpose | Product constraint |
| --- | --- | --- |
| Python 3.12 | Backend runtime | Windows compatibility |
| FastAPI | Local API | Non-blocking long operations |
| Pydantic v2 | Structured validation | Canonical schema contract |
| SQLAlchemy / SQLModel | Persistence abstraction | Preserve database integrity |
| SQLite | Local persistence | Remains canonical for desktop |
| Instructor | Structured extraction | Provider-independent schema |
| Ollama | Local inference | Optional runtime dependency |
| OpenAI-compatible endpoint | Cloud inference | Explicit user consent |
| pypdf | PDF parsing | Deterministic fast path |
| python-docx | DOCX parsing | Preserve paragraph/table order |
| LibreOffice | Legacy DOC conversion | Optional external dependency |
| Docling | Scanned-document fallback | Opt-in resource-heavy processing |
| React 19 | Frontend | Preserve established component architecture |
| TypeScript | Frontend domain contracts | Strict type safety |
| Vite | Frontend build | Existing development workflow |
| Tailwind CSS v4 | Styling | Consistent design tokens |
| Radix UI | Accessible controls | Preserve keyboard semantics |
| Pytest | Backend testing | Domain and integration coverage |
| Vitest | Frontend testing | Component and state coverage |

### 16.2 Database constraints
SQLite remains the desktop persistence authority. No mandatory PostgreSQL or Redis infrastructure.

### 16.3 Architecture constraints
- Parsing is decoupled from extraction.
- Schemas are provider-agnostic.
- Progress calculation is a deterministic domain service.
- Persistence is transactional.

### 16.4 Hardware profiles
- **Constrained:** 8 GB RAM, 4-core CPU, SSD, local inference disabled.
- **Recommended:** 16 GB RAM, modern multi-core CPU, SSD, optional GPU.

---

## 17. Out-of-Scope Boundaries & Anti-Overengineering Guardrails

### 17.1 Explicitly excluded capabilities
University ERP, student information systems, faculty grading, attendance tracking, online exams, social networking, mandatory cloud accounts, cloud databases (PostgreSQL/Redis), Kubernetes/microservices, real-time collaboration, and automatic generative lecture transcribers.

### 17.2 Engineering guardrails
1. Maintain exactly five academic tiers.
2. Persist completion exclusively for Tier-5 leaves.
3. Parent completion is dynamically derived, never independently stored.
4. Contact hours do not influence completion percentages.
5. Do not delete historical electives upon unenrollment.
6. Do not introduce mandatory remote services.
7. Treat LLM output strictly as candidate extraction until grounded.

---

## 18. Product Prioritization & Release Roadmap

### 18.1 Prioritization methodology

| Priority | Meaning |
| --- | --- |
| P0 | Critical correctness, security, reliability, and data integrity |
| P1 | Core academic productivity and usability |
| P2 | Advanced interface and browser capabilities |
| P3 | Future optional infrastructure |

### 18.2 P0 — Critical correctness

| Roadmap ID | Deliverable | Requirements | User value | Dependencies | Completion criteria | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| RD-P0-01 | Canonical hierarchy audit | FR-TRE | Reliable curriculum | Existing schema | Exactly five valid academic tiers | High |
| RD-P0-02 | Leaf-only progress audit | FR-PRG | Correct progress | SQLite models | No persisted parent completion | Critical |
| RD-P0-03 | Elective history integrity | FR-ELC | Safe enrollment changes | Academic identity | Historical records survive toggles | Critical |
| RD-P0-04 | Extraction quality hardening | FR-QLT | Accurate syllabus | Parser pipeline | Regression corpus passes | High |
| RD-P0-05 | Provenance validation | FR-GRD | Evidence confidence | Source offsets | All leaves have appropriate grounding state | High |
| RD-P0-06 | Ingestion resilience | FR-ING | Reliable uploads | Job manager | Cancellation and failures are atomic | High |
| RD-P0-07 | Security hardening | FR-SEC | Safe local processing | Upload pipeline | Security regression tests pass | Critical |
| RD-P0-08 | Backup integrity foundation | FR-EXP, FR-IMP | Data protection | Schema contracts | Validated, transactional recovery | Critical |

### 18.3 P1 — Academic productivity

| Roadmap ID | Deliverable | Requirements | User value | Dependencies | Completion criteria | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| RD-P1-01 | Examination planning | FR-PAC | Better preparation | Progress engine | Deterministic deadline calculations | Medium |
| RD-P1-02 | Topic notes | FR-NOT | Learning continuity | Stable leaf IDs | Reliable autosave and recovery | Medium |
| RD-P1-03 | Resource bookmarks | FR-RES | Learning resources | Stable leaf IDs | Full CRUD and export | Low |
| RD-P1-04 | Markdown export | FR-EXP | Reusable curriculum | Academic hierarchy | Correct nested export | Low |
| RD-P1-05 | JSON backup | FR-EXP | Portability | Versioned schema | Valid backup and restore | High |
| RD-P1-06 | Printable reports | FR-EXP | Examination revision | Progress summaries | Readable HTML/PDF | Low |
| RD-P1-07 | Responsive modernization | FR-UI | Better usability | Frontend architecture | Viewport regression suite passes | Medium |
| RD-P1-08 | Accessibility improvements | FR-ACC | Inclusive usability | UI components | WCAG audit and keyboard tests | Medium |
| RD-P1-09 | Elective review improvements | FR-ELC | Accurate workload | Existing onboarding | Complete historical behavior | Medium |

### 18.4 P2 — Advanced experience

| Roadmap ID | Deliverable | Requirements | User value | Dependencies | Completion criteria | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| RD-P2-01 | Command palette | FR-UI-006 | Faster navigation | Search | Keyboard-accessible commands | Low |
| RD-P2-02 | Theme system | FR-UI-007 | Personalization | Design tokens | Dark/light/system persistence | Low |
| RD-P2-03 | PWA foundation | FR-PWA | Browser convenience | Browser architecture | Installable offline shell | Medium |
| RD-P2-04 | IndexedDB storage | FR-OFF | Browser-local usage | Browser data model | Independent local persistence | High |
| RD-P2-05 | Secure portal ingestion | FR-WEB | Easier syllabus imports | SSRF-resistant downloader | Security tests pass | Critical |
| RD-P2-06 | Mobile refinements | FR-UI, FR-ACC | Mobile usability | Responsive design | Core workflows pass | Medium |

### 18.5 P3 — Future capabilities

| Roadmap ID | Deliverable | Requirements | User value | Dependencies | Completion criteria | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| RD-P3-01 | Optional synchronization | FR-SYN | Device continuity | Sync architecture | Idempotent, conflict-safe sync | High |
| RD-P3-02 | Capacitor integration | FR-PWA | Native mobile distribution | Responsive browser client | Native storage/file workflows verified | High |
| RD-P3-03 | Additional portal adapters | FR-WEB | Wider university support | Secure ingestion | Independently tested adapters | Medium |

### 18.6 Release gates
No release may pass P0/P1 without satisfying the mandatory verification suites and Definition of Done.

---

## 19. Requirements Traceability Matrix

### 19.1 Product objective mapping

| Objective | Requirement domains | Architecture components | Invariants | Verification | Priority |
| --- | --- | --- | --- | --- | --- |
| PG-001 Reliable ingestion | FR-ING | Parser, ingestion service | No partial curriculum | Parser and job tests | P0 |
| PG-002 Structural fidelity | FR-TRE, FR-EXT | Schemas, validator | Exactly five tiers | Hierarchy property tests | P0 |
| PG-003 Evidence traceability | FR-GRD, FR-QLT | Provenance validator | No fabricated evidence | Grounding tests | P0 |
| PG-004 Correct progress | FR-PRG | Progress engine, repository | Leaf-only persistence | Mathematical property tests | P0 |
| PG-005 Elective integrity | FR-ELC | Enrollment service, repository | History preserved | Re-enrollment integration tests | P0 |
| PG-006 Study planning | FR-PAC | Planner service | Deterministic formulas | Boundary and date tests | P1 |
| PG-007 Student utilities | FR-NOT, FR-RES | Notes/resource services | Stable leaf association | Persistence tests | P1 |
| PG-008 Recoverability | FR-EXP, FR-IMP | Backup service | Atomic restoration | Corruption and rollback tests | P0 |
| PG-009 Offline independence | FR-OFF | SQLite and browser storage | No cloud dependency | Offline integration tests | P0 |
| PG-010 Responsive usability | FR-UI, FR-ACC | React components | Essential actions accessible | Viewport and accessibility tests | P1 |

### 19.2 Functional verification matrix

| Domain | Architecture component | Main verification |
| --- | --- | --- |
| FR-ING | Parser and ingestion service | Format, timeout, cancellation, concurrency tests |
| FR-EXT | Provider adapter and extractor | Structured-output and provider-failure tests |
| FR-GRD | Validation service | Source matching and provenance tests |
| FR-QLT | Normalization and table reconstruction | Regression corpus |
| FR-TRE | Hierarchy schemas and repository | Parent-child property tests |
| FR-PRG | Progress engine | Formula and persistence invariants |
| FR-ELC | Enrollment service | Historical preservation tests |
| FR-LAB | Academic metadata | Classification and display tests |
| FR-PAC | Study planner | Date, capacity, and division-boundary tests |
| FR-NOT | Notes service | Autosave and recovery tests |
| FR-RES | Resource service | URL and CRUD tests |
| FR-EXP | Export service | Round-trip and schema tests |
| FR-IMP | Restore service | Transactional rollback tests |
| FR-WEB | Portal downloader | SSRF and redirect tests |
| FR-CLI | Windows supervisor | Process ownership and IPC tests |
| FR-UI | React frontend | Component and responsive tests |
| FR-ACC | Accessible UI components | Keyboard and screen-reader tests |
| FR-OFF | Local persistence | Network-disconnected tests |
| FR-PWA | Service worker and IndexedDB | Offline browser tests |
| FR-SYN | Future outbox | Idempotency and conflict tests |
| FR-SEC | Security boundaries | Adversarial security tests |

### 19.3 Data integrity invariant matrix

| Invariant | Requirement | Verification |
| --- | --- | --- |
| Five academic tiers | FR-TRE-001 | Reject sixth-tier records |
| Valid parent relationships | FR-TRE-003 | Referential-integrity tests |
| Leaf-only completion | FR-PRG-001 | Inspect persisted completion records |
| Uniform weight | FR-PRG-002 | Property tests |
| Parent states derived | FR-PRG-003 | Recompute from leaves |
| Empty branch = 0% | FR-PRG-004 | Empty-tree tests |
| Excluded electives not counted | FR-ELC, FR-PRG | Enrollment denominator tests |
| Elective history retained | FR-ELC-005 | Unenrollment/re-enrollment tests |
| Contact hours informational | FR-LAB | Progress independence tests |
| Provenance retained | FR-GRD | Evidence round-trip tests |
| Restore atomicity | FR-IMP | Failure injection |
| Offline persistence | FR-OFF | Network-disconnected integration tests |

---

## 20. Open Questions & Architectural Decisions

### 20.1 Confirmed product requirements

| ID | Decision |
| --- | --- |
| ADR-001 | Exactly five academic tiers are permitted. |
| ADR-002 | The document root is a non-academic container. |
| ADR-003 | Only Tier-5 leaves persist individual completion. |
| ADR-004 | Parent states are dynamically derived. |
| ADR-005 | Every eligible leaf has weight 1. |
| ADR-006 | Contact hours do not affect completion percentages. |
| ADR-007 | Unenrollment never deletes historical elective records. |
| ADR-008 | Local-first functionality requires no cloud account. |
| ADR-009 | Cloud LLM inference requires explicit permission. |
| ADR-010 | Unverified academic content must remain distinguishable. |
| ADR-011 | SQLite remains the desktop persistence authority. |
| ADR-012 | PWA storage is not interchangeable with desktop SQLite. |
| ADR-013 | Synchronization is optional and deferred. |
| ADR-014 | Failed restoration must roll back. |

### 20.2 Proposed decisions awaiting approval

| ID | Proposal | Rationale | Impact |
| --- | --- | --- | --- |
| PD-001 | 750 ms notes autosave debounce | Balance responsiveness and write frequency | Notes |
| PD-002 | 80% planning-capacity warning threshold | Provide a configurable safety margin | Study planner |
| PD-003 | Maximum five portal redirects | Reduce redirect abuse | Web ingestion |
| PD-004 | Maximum 50 MiB per portal resource | Resource containment | Web ingestion |
| PD-005 | Maximum ten embedded PDFs per portal | Prevent excessive downloads | Web ingestion |
| PD-006 | Separate enrollment state from record existence | Preserve elective history | Database |
| PD-007 | Stable leaf identifiers across structural corrections | Protect notes and completion | Data model |
| PD-008 | Explicit unresolved structural records | Prevent fabricated academic names | Extraction |

### 20.3 Open architectural questions
- **OQ-001 (Canonical hierarchy migration):** Does the current persisted schema already represent Module as a distinct tier, or does it use the older five-tier interpretation documented in Master_Context.md?
- **OQ-002 (Backup Schema 2.1):** Is Schema 2.1 already implemented, or is it a planned compatibility format?
- **OQ-003 (Study pacing availability):** Does an existing implementation already store student weekly study capacity?
- **OQ-004 (Contact-hour granularity):** Are contact hours always assigned to modules, or can they exist at subject level in actual university documents?
- **OQ-005 (Elective identity):** What exact persistence mechanism links historical leaf completions to subjects after enrollment changes?
- **OQ-006 (Notes persistence):** One editable primary note per leaf for the initial release, or multiple dated notes?
- **OQ-007 (Browser architecture):** Separate browser client vs. static PWA vs. served by FastAPI?
- **OQ-008 (PWA data authority):** Independent local storage vs. export/import migration?
- **OQ-009 (Document retention):** Staged file retention lifecycle policy?
- **OQ-010 (OCR dependency):** Is Docling the sole OCR fallback, or evaluate lighter alternatives?
- **OQ-011 (Cross-platform desktop):** Windows 11 primary vs. Linux/macOS?
- **OQ-012 (Study multiplier):** Configurable independent study multiplier handling?

---

## 21. Product Acceptance & Release Readiness Criteria

### 21.1 P0 acceptance gate
- Exactly five academic tiers; valid parent-child relationships.
- Only Tier-5 completion persists; parent states derived; uniform weight; elective-aware denominator.
- Mandatory subjects cannot be excluded; historical records retained upon unenrollment.
- Ingestion is bounded, asynchronous, cooperatively cancellable, and transactional.
- Verbatim source excerpts preserved; uncertain extraction visibly flagged.
- Backup validation strictly enforced; failed restores roll back cleanly.
- Strict upload validation and SSRF defenses.

### 21.2 P1 acceptance gate
- Examination deadlines and pacing formulas operate accurately.
- Notes autosave with recovery safeguards; bookmarks persist and link correctly.
- Markdown, JSON, and print-ready reports export cleanly.
- Responsive layout verified across viewports down to 360px width.
- Keyboard navigation and light/dark theme switching functional.

### 21.3 Definition of Done
A requirement is complete only when its implementation exists, its user-facing behavior is available, its business rules are enforced, its persistence behavior is correct, its failure paths are handled, its acceptance tests pass, its documentation is updated, and its traceability entry is complete.

---

## 22. Glossary & Terminology

| Term | Definition |
| --- | --- |
| Academic document | Imported syllabus or curriculum container |
| Document Root | Non-academic container above Tier 1 |
| Tier 1 | Academic Year |
| Tier 2 | Semester |
| Tier 3 | Subject / Course |
| Tier 4 | Module / Unit |
| Tier 5 | Subtopic / Checklist Leaf |
| Academic leaf | Individually trackable Tier-5 topic |
| Eligible leaf | A leaf belonging to an active, valid academic curriculum |
| Completion record | Persisted state indicating an individual leaf is complete |
| Parent state | Dynamically derived checkbox state |
| Tri-state checkbox | Checked, unchecked, or indeterminate control |
| Indeterminate | Some eligible descendants are complete, but not all |
| Elective | Student-selectable academic subject |
| Enrollment | Student's active participation state for a subject |
| Historical record | Previously saved academic data retained independently of current enrollment |
| Lab classification | Metadata identifying a practical/laboratory subject |
| Contact hours | University-declared instructional workload |
| Grounding | Verification that extracted content corresponds to source material |
| Provenance | Traceable origin of an extracted academic record |
| Source excerpt | Verbatim text associated with an extracted topic |
| Source offset | Position in the canonical normalized source text |
| verified | Evidence successfully matched |
| needs_review | Evidence or structure requires human inspection |
| unverified | Evidence cannot currently be established |
| Deterministic extraction | Parsing and structural processing that do not depend on generative inference |
| Structured extraction | AI-assisted output conforming to a predefined data schema |
| Semantic chunking | Dividing documents into meaningful academic sections |
| Ingestion job | A tracked document-processing operation |
| SSE | Server-Sent Events for progress updates |
| SQLite WAL | SQLite Write-Ahead Logging mode |
| Transaction | Atomic group of database operations |
| Backup | Versioned portable representation of academic data |
| Restore | Controlled reconstruction of academic data from a backup |
| PWA | Progressive Web Application |
| IndexedDB | Browser-local structured database |
| Offline outbox | Durable queue of operations awaiting optional synchronization |
| SSRF | Server-Side Request Forgery |
| DNS rebinding | Attack involving changes in DNS resolution to redirect a request |
| WCAG | Web Content Accessibility Guidelines |
| JTBD | Jobs-to-be-Done |
| NFR | Non-Functional Requirement |
| SLA | Service-Level Agreement or target |
| ADR | Architectural Decision Record |
| P0–P3 | Product implementation priority levels |

---

## Appendix A. Repository Evidence & Audit Notes

### A.1 Sources inspected
- [Repository README](https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist?utm_source=chatgpt.com)
- [Master_Context.md](https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist/blob/main/Master_Context.md?utm_source=chatgpt.com)
- [Backend repository directory](https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist/tree/main/backend?utm_source=chatgpt.com)
- [Frontend repository directory](https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist/tree/main/frontend?utm_source=chatgpt.com)

### A.2 Historical verification results

| Verification | Published result |
| --- | --- |
| Backend tests | 102 passed |
| Frontend tests | 26 passed |
| TypeScript errors | 0 |
| Production build | Successful |

*Note: The Master Context documents earlier implementation milestones with 77 backend tests and 12 frontend tests. These represent distinct historical snapshots and must not be combined.*

---

## Appendix B. Product Specification Change Control

### B.1 Change-management policy
Future changes to this PRD MUST:
1. Preserve existing academic data.
2. Preserve the five-tier hierarchy.
3. Preserve leaf-only completion persistence.
4. Maintain backward compatibility where reasonably possible.
5. Document any database migration.
6. Update affected requirement identifiers and traceability matrix.
7. Add regression tests for changed behavior.
8. Distinguish implementation changes from proposed capabilities.

### B.2 Versioning policy

| Version | Meaning |
| --- | --- |
| 1.0.x | Clarifications, corrections, and non-breaking requirement refinements |
| 1.x.0 | Significant feature additions or product-scope changes |
| 2.0.0 | Major product architecture or business-rule changes |

---

## Final Product Authority Statement

This document defines the intended product behavior of the **Hierarchical Syllabus Checklist & Progress Tracker**.

```
LOCAL-FIRST ACADEMIC WORKSPACE
Document Root
  └── Academic Year (Tier 1)
        └── Semester (Tier 2)
              └── Subject / Course (Tier 3)
                    └── Module / Unit (Tier 4)
                          └── Subtopic / Leaf (Tier 5) ───► Persisted Completion

Progress = (Completed Eligible Tier-5 Leaves / Total Eligible Tier-5 Leaves) × 100
Parent Completion = Derived, Never Persisted
Elective Unenrollment = Preserve Historical Data
Source Grounding = Evidence + Validation + Review
Desktop Persistence = SQLite
Cloud Processing = Optional, Explicitly Authorized
Synchronization = Optional, Deferred
```

**Document status:** Draft for stakeholder review and engineering baseline approval.  
**Deliverable:** `1_PRD.md` — Product Requirements Document, version 1.0.0.
