# 12. Application Flow — End-to-End User Journeys, State Machines, and Internal Data Flows

**Document**: `12_APP_FLOW.md`  
**Product**: Hierarchical Syllabus Checklist & Progress Tracker  
**Repository**: [farhanahmad2106-cpu/Syllabus_Tracker_checklist](https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist?utm_source=chatgpt.com)  
**Authority**: Normative Engineering Contract & Behavioral Architecture  
**Version**: 1.0  
**Last Updated**: 2026-11-17  

---

> **Authority and traceability.** This document separates repository-documented behavior from architectural contracts and proposed extensions. The public repository README and `Master_Context.md` were accessible; the backend/frontend source directories could not be fetched through the available repository viewer. Therefore, implementation claims below are limited to those repository documents. No tests or terminal commands were run. The repository's `Master_Context.md` records a project instruction not to execute tests unless explicitly requested.
>
> Status labels: **IMPLEMENTED-DOC** = explicitly recorded as implemented in repository documentation, but not independently source-verified here; **SPECIFIED** = required by the supplied project brief; **PROPOSED** = recommended contract not verified as implemented; **UNRESOLVED** = must be checked against source before treating as current behavior.

## 1. Document Purpose and Scope

This document defines the user-visible and internal lifecycle of the local-first Hierarchical Syllabus Checklist & Progress Tracker. It is the companion workflow authority to `13_SCHEMA.md`.

The application ingests academic source material, builds a verifiable five-tier hierarchy, optionally collects elective enrollment choices, tracks completion only on Tier-5 leaves, and stores student annotations and planning metadata locally.

### 1.1 System boundaries

| Boundary | Responsibility | Authority |
|---|---|---|
| React client | Navigation, input, rendering, optimistic interaction, IndexedDB outbox | Temporary UI state only |
| FastAPI application | Validation, API contracts, orchestration, job access | Request and workflow policy |
| Ingestion workers | Parsing, cleanup, extraction, grounding, hierarchy validation | Candidate hierarchy |
| SQLite | Syllabus JSON, leaf completion, jobs, deadlines, notes, resources | Durable local authority |
| Ollama / optional cloud provider | Structured extraction suggestions | Untrusted extraction output |
| University website | External source content | Untrusted input |
| CLI supervisor | Process lifecycle and authenticated local control | Managed process ownership |

The AI provider never directly writes authoritative records. Every extracted hierarchy must pass deterministic validation and provenance checks before persistence.

### 1.2 Canonical academic hierarchy

```text
Document Root (container; not an academic tier)
└── Academic Year (Tier 1)
    └── Semester (Tier 2)
        └── Subject / Course (Tier 3)
            └── Module / Unit (Tier 4)
                └── Subtopic / Topic leaf (Tier 5)
```

Only Tier-5 leaves are completion units. A parent checkbox and its percentage are derived from currently eligible descendant leaves. Contact hours are workload metadata, not completion units.

### 1.3 Repository evidence and known discrepancies

The README documents FastAPI, Pydantic v2, SQLModel/SQLAlchemy 2.0, SQLite WAL, React 19/TypeScript, 50 MiB upload limit, 1,000-page PDF limit and 1.5-million-character extraction limit. `Master_Context.md` records later phase work aligning limits to 50 MiB, 300 PDF pages, 1.5 million characters, and 300 seconds parser timeout; it also records a 25 MiB earlier limit. **The later Phase 7 values are the preferred documented baseline**, but must be confirmed in `backend/app/config.py` before implementation. Do not copy conflicting README values into runtime configuration without checking source.

`Master_Context.md` documents Phase 8 in-memory job management, monotonic progress, worker-thread ingestion, SSE heartbeats, polling fallback, cancellation, and atomic persistence. It also documents Phase 9 CLI supervision and token-authenticated loopback IPC. In-memory jobs are not durable across process restart; durable job recovery is therefore a proposed extension unless source inspection confirms a persistent job table.

## 2. System Actors and Responsibilities

| Actor | Actions | Trust level |
|---|---|---|
| Student | Uploads files, selects electives, tracks leaves, manages notes/deadlines/resources | Trusted user input, still validated |
| Browser client | Sends API requests, caches pending mutations, reconnects to SSE | Untrusted client |
| API process | Validates requests and coordinates services | Trusted application boundary |
| Ingestion worker | Parses and validates external content | Restricted worker |
| AI provider | Returns structured candidate data | Untrusted |
| Portal server | Serves HTML/PDF content | Untrusted |
| CLI supervisor | Starts/stops managed local processes | Privileged local component |

No browser-provided node type, leaf ID, progress percentage, source excerpt, or enrollment status is trusted without server-side validation.

## 3. Application State Machine Overview

### 3.1 Syllabus lifecycle

```text
EMPTY
  -> SOURCE_SELECTED
  -> INGESTION_QUEUED
  -> INGESTING
       -> CANCELLED
       -> FAILED
       -> EXTRACTION_REVIEW
             -> ELECTIVE_REVIEW
             -> ENROLLMENT_FINALIZED
             -> ACTIVE_TRACKING
  ACTIVE_TRACKING <-> OFFLINE
  OFFLINE -> OFFLINE_QUEUED -> SYNCING -> ACTIVE_TRACKING
  ACTIVE_TRACKING -> ERROR_RECOVERY -> ACTIVE_TRACKING
```

`EXTRACTION_REVIEW` is a reviewable candidate state, not necessarily a separate persisted syllabus status. The implementation may store the candidate in a job result until the user confirms it. This choice must be consistent with the actual repository.

### 3.2 State ownership

| State | Owner | Durable? | Entry condition |
|---|---|---:|---|
| EMPTY | Client | No | No selected syllabus |
| SOURCE_SELECTED | Client | No | Valid local selection or URL draft |
| INGESTION_QUEUED | Job service | Job record recommended | Upload accepted and job created |
| INGESTING | Worker/job service | Job record recommended | Worker claims job |
| FAILED/CANCELLED | Job service | Yes if job table exists | Terminal failure/cancel |
| EXTRACTION_REVIEW | Client + job result | Candidate should be retained | Extraction succeeds but needs review |
| ELECTIVE_REVIEW | Client/API | Syllabus candidate durable | Elective choices required |
| ACTIVE_TRACKING | API/SQLite | Yes | Enrollment finalized |
| OFFLINE/QUEUED | Client/IndexedDB | Browser-local | Network unavailable |
| SYNCING | Client | Browser-local | Outbox dispatcher active |
| ERROR_RECOVERY | Owning subsystem | Depends | Retryable error detected |

### 3.3 Transition rules

- A job may move `queued -> running -> completed|failed|cancelled`; terminal states are immutable.
- Cancellation is cooperative. A cancellation request does not mean cancellation has completed until the worker acknowledges it.
- Progress is monotonic within one attempt, bounded to 0–100. A retry creates a new attempt or explicitly resets a new progress epoch; it must not silently decrease the same attempt's progress.
- `completed` is emitted only after the database transaction commits.
- A refresh rehydrates durable syllabus data and polls known jobs. If jobs exist only in memory, process restart makes their status unknowable; the API must report `JOB_STATUS_LOST` rather than inventing a result.
- Offline operations remain pending until the server confirms them. Closing the browser does not guarantee background sync.

## 4. Flow 1 — File Upload and Chunked SSE Ingestion

**Status:** asynchronous upload/SSE/polling/cancellation and chunked extraction are **IMPLEMENTED-DOC** in `Master_Context.md`; durable job persistence is **PROPOSED** unless source confirms it.

### 4.1 Objective, actors, preconditions

Objective: accept a supported syllabus file quickly, return a job identifier, process it outside the request path, and expose progress without holding an HTTP request open.

Actors: Student, React upload component, FastAPI, job manager, parser, chunker, extraction provider, validator, SQLite.

Preconditions: application ready; supported file extension; request within configured byte limit; available staging space; worker capacity available.

### 4.2 Success sequence

```text
Student -> FilePicker: choose PDF/DOCX/DOC/TXT
FilePicker -> API: POST /api/upload (multipart)
API -> API: extension, MIME, size and filename validation
API -> Staging: stream to unique temporary file; calculate SHA-256
API -> JobManager: create queued job
API --> Client: 202 {job_id, status, progress_url}
Worker -> JobManager: claim job
Worker -> Parser: normalize and extract text + physical page map
Worker -> Chunker: split at semantic boundaries
Worker -> Extractor: structured extraction per chunk
Extractor --> Worker: untrusted candidate objects
Worker -> Validator: hierarchy + provenance + noise checks
Worker -> SQLite: atomic syllabus persistence
SQLite --> Worker: commit
Worker -> JobManager: completed, 100%
Client -> API: GET /api/upload/progress/{job_id}
API --> Client: SSE progress and terminal event
```

### 4.3 Stages and progress

The documented Phase 8 milestones are the recommended baseline:

| Stage | Progress interval | Work |
|---|---:|---|
| `queued` | 0 | Job accepted |
| `validating` | 5 | Extension, size, signature and metadata |
| `parsing` | 10–30 | File normalization and text extraction |
| `chunking` | 30–40 | Semantic chunk construction |
| `extracting` | 40–85 | Structured extraction; weighted chunk progress |
| `validating_result` | 85–95 | Hierarchy, evidence, duplicate/noise checks |
| `persisting` | 95–99 | Atomic SQLite writes |
| `completed` | 100 | Commit succeeded |

The documented chunk formula is `P = 40 + 45 × (completed_chunks / total_chunks)`. Clamp intermediate progress to the stage interval and never publish 100 before commit.

### 4.4 API contract

- `POST /api/upload`: multipart field `file`; optional client request ID. Returns `202 Accepted` with `job_id`, `status`, `progress_url`, `poll_url`.
- `GET /api/upload/progress/{job_id}`: `text/event-stream`; emits `progress`, then exactly one terminal event (`completed`, `failed`, or `cancelled`) where the transport remains connected.
- `GET /api/upload/jobs/{job_id}`: current snapshot; fallback if SSE is interrupted.
- `POST /api/upload/jobs/{job_id}/cancel`: sets cooperative cancellation request; returns current job state.

Example event:

```json
{
  "job_id": "0192f1a2-7c3a-7b11-a1b2-2a2a5a3d9f11",
  "status": "running",
  "stage": "extracting",
  "progress": 63,
  "message": "Extracting curriculum chunk 3 of 5",
  "timestamp": "2026-11-17T12:00:00Z",
  "error": null
}
```

Use SSE `id:` as a monotonically increasing per-job event sequence. Honor `Last-Event-ID` only if event history is retained; otherwise send a fresh snapshot followed by live events. Send comment heartbeat lines (for example `: keep-alive`) at a bounded interval. Client disconnect must detach the subscriber, not cancel the job.

### 4.5 Validation, duplicate handling and failure behavior

- Enforce the configured server-side maximum even if client validation passed. Preferred documented limit: 50 MiB.
- Validate extension against an allowlist and inspect file signature where possible; do not trust client MIME or filename.
- PDF page and extracted-character limits must be configurable. `Master_Context.md` records 300 pages and 1,500,000 characters as later aligned values; verify current settings.
- Use unique isolated staging paths; never use a shared fixed filename. Delete staged artifacts in `finally`.
- Compute SHA-256 over normalized source bytes. Deduplicate within a defined scope (same source type + hash + relevant source identity); do not impose global unique content hash.
- If an identical completed syllabus exists, return a duplicate/conflict result with the existing record reference or require explicit import-as-new. Never silently overwrite progress.
- Offload blocking parser/provider work from the event loop; apply worker concurrency limits and timeouts.
- Extraction output is untrusted. Reject fabricated page references, malformed depth, duplicate IDs, empty artificial fallback nodes, and metadata mistaken for leaves.
- Keep rejected/unclassified text in a review artifact when feasible; do not silently discard evidence.
- On failure, persist a safe error code and user-actionable message. Do not expose paths, stack traces, provider credentials, or raw external responses.
- Cancellation checks occur before and after each chunk and before persistence. A cancellation during a database transaction rolls back.
- A timeout is terminal for that attempt. Retry creates a new attempt/job; do not reuse a terminal job.

### 4.6 Persistence and recovery

Recommended durable job row fields are defined in `13_SCHEMA.md`. The documented Phase 8 manager is in-memory, so restart recovery is not proven. **PROPOSED:** persist job state and staging metadata; at startup mark stale `running` jobs `interrupted`, then either safely retry from retained staging or mark `failed` with `WORKER_INTERRUPTED`. Never mark an interrupted job complete without verifying the syllabus transaction.

Acceptance criteria:
- Upload returns 202 only after job creation succeeds.
- Progress is monotonic and reaches 100 only after commit.
- SSE disconnect does not stop work.
- Polling provides the latest snapshot.
- Cancellation is cooperative and terminal.
- Every failed/cancelled attempt cleans temporary files.
- A persisted syllabus is never half-written.

## 5. Flow 2 — Web Portal Preview and SSRF-Safe Ingestion

**Status:** portal scraping is **SPECIFIED**; SSRF controls below are **PROPOSED** until verified in source.

### 5.1 Objective and trust boundary

Allow a student to preview an academic portal page and discovered PDFs before choosing one or more sources for ingestion. Preview and ingest are separate requests and each must independently validate the target. A preview result is not a security authorization token.

### 5.2 Sequence

```text
Student -> API: POST /api/scrape/preview {url}
API -> URLGuard: parse and normalize URL
URLGuard -> DNS: resolve all A/AAAA answers
URLGuard -> URLGuard: reject unsafe address/port/scheme
Fetcher -> Target: bounded HTTP GET
Fetcher -> URLGuard: validate every redirect and connection IP
Cleaner -> Parser: sanitize DOM and extract readable text
Discovery -> Cleaner: enumerate embedded PDF candidates
API --> Student: preview_id, page metadata, selectable sources
Student -> API: POST /api/scrape/ingest {preview_id, selections}
API -> URLGuard: revalidate selected URL(s)
API -> JobManager: queue ingestion
Worker -> Parser: download/parse selected content
Worker -> SQLite: commit after validation
```

### 5.3 Security rules

- Permit only `https`; allow `http` only behind an explicit local configuration decision. Reject `file`, `ftp`, `data`, `javascript`, `gopher`, and unknown schemes.
- Reject URL credentials, malformed IDNs, control characters, fragments where not meaningful, and unsupported ports. Prefer 443; optionally 80 only for explicitly enabled HTTP.
- Resolve all A and AAAA records. Reject loopback, private, link-local, multicast, unspecified, reserved, IPv4-mapped unsafe IPv6, and cloud metadata destinations.
- DNS validation must be bound to the actual connection. Use a transport/resolver that connects to a validated IP while preserving TLS hostname verification and Host header. Re-resolve/revalidate on every redirect and every new connection. A preflight DNS check alone does not prevent rebinding.
- Disable automatic redirects; process a small bounded number manually and re-run all checks at each hop.
- Enforce connect/read/total timeouts, response byte limits, decompression limits, redirect count, and content-type allowlist.
- Reject HTML responses with unexpected content types; parse PDFs only after size/signature validation and page limits.
- Do not fetch arbitrary embedded resources, scripts, images, or CSS. Extract candidate links from sanitized DOM only.
- Strip scripts, styles, forms, event handlers, and hidden boilerplate. Preserve source URL, page title, fetched timestamp, and text-location provenance.
- Revalidate discovered PDF URLs at preview selection and at actual download.
- Apply rate limits and per-host concurrency limits where deployed; these are recommendations, not claimed existing behavior.

### 5.4 Preview and ingest contract

`POST /api/scrape/preview` accepts `{ "url": "https://university.example.edu/academics/syllabus" }` and returns a short-lived `preview_id`, normalized page URL, title, cleaned text summary, and selectable PDF candidates. Do not accept a client-supplied resolved IP as authority.

`POST /api/scrape/ingest` accepts `{ "preview_id": "...", "selected_source_ids": ["..."] }`; server retrieves its own preview record, revalidates each URL, then creates an ingestion job. Expired preview IDs return `410 PREVIEW_EXPIRED`; unsafe targets return `422 URL_NOT_ALLOWED`.

Acceptance criteria:
- Every redirect and final connection is checked.
- Private/loopback/link-local/metadata targets cannot be fetched.
- Preview cannot be replayed as a bypass to ingestion.
- External content remains untrusted through extraction.
- Size/time limits terminate hostile or stalled responses safely.

## 6. Flow 3 — Elective Onboarding and Reconfiguration

**Status:** elective modal, mandatory locked enrollment, excluded elective filtering, and historical completion preservation are **IMPLEMENTED-DOC**.

### 6.1 Objective and sequence

```text
Extraction -> classify subjects -> persist candidate hierarchy
     -> GET /api/syllabus/{id}/review
     -> show ElectiveOnboardingModal
     -> student selects elective courses
     -> POST /api/syllabus/{id}/finalize-enrollment
     -> transaction validates and stores enrollment flags
     -> return active hierarchy + derived progress
```

For later changes, use `POST /api/syllabus/{id}/update-enrollment` with the complete desired selection for each elective group.

### 6.2 Rules

- `is_elective=false` subjects are mandatory and must be enrolled.
- Elective courses require a stable `elective_group` identifier. Groups represent mutually exclusive or selectable alternatives according to extracted source semantics; do not infer group cardinality without evidence.
- Default selection is proposed as “none selected” when the source does not identify a default. A configurable policy may preselect a clearly designated default.
- Reject a group selection that violates its declared min/max cardinality. If cardinality is unknown, require at least one selection only when the source clearly defines a choice requirement; otherwise request review rather than guessing.
- Finalization is idempotent for the same selection and uses a transaction.
- Reconfiguration updates `is_enrolled`; it does not delete subjects, leaf completion rows, notes, resources, or deadlines.
- Excluded elective leaves are removed from active progress denominators but their completion rows remain historical. Re-enrollment restores their prior completed state.
- Deadlines on excluded courses remain stored and may be hidden from active planning views, not deleted.
- Subject and node IDs remain stable across reconfiguration.

### 6.3 Acceptance criteria

- Mandatory courses cannot be excluded.
- Invalid elective group choices return a validation error without partial writes.
- Exclusion never deletes history.
- Re-enrollment restores the previous leaf completion state.
- Progress recalculates using only eligible enrolled leaves.

## 7. Flow 4 — Five-Tier Tree and Tri-State Progress

**Status:** leaf-only persistence and bottom-up progress calculation are **IMPLEMENTED-DOC**.

### 7.1 Objective and interaction

The tree renders the canonical hierarchy. Parent state is computed from enrolled descendant leaves; no parent completion value is persisted.

```text
GET /api/syllabus/{id}
  -> hierarchy + completion IDs + derived progress
  -> render tree
User toggles Tier-5 leaf
  -> optimistic local state
  -> PATCH /api/syllabus/{id}/toggle-leaf
  -> validate leaf is a Tier-5 node
  -> transaction upserts/deletes completion row
  -> return authoritative completed IDs/progress
  -> reconcile UI
```

Bulk branch operation:

```text
User chooses branch action
  -> PATCH /api/syllabus/{id}/bulk-toggle
  -> server resolves descendant Tier-5 leaves
  -> filter to enrolled eligible leaves
  -> transaction applies desired state to all
  -> response returns changed count and derived progress
```

### 7.2 Mathematics

Let `E(b)` be the set of eligible (enrolled) Tier-5 descendants of branch `b`; let `N = |E(b)|`; let `C` be the number of those leaves with a completion record.

For `N > 0`:

- Checked iff `C = N`.
- Unchecked iff `C = 0`.
- Indeterminate iff `0 < C < N`.
- Progress percentage = `100 × C / N`.

For `N = 0`, state is `not_trackable`, denominator is zero, and percentage is `null` (display `0/0` if desired). It is never automatically checked. Contact hours, module count, subject count, and parent nodes do not enter this formula.

### 7.3 Request and consistency rules

Single toggle request: `{ "leaf_id": "leaf-uuid", "completed": true, "operation_id": "uuid" }`.

Bulk request: `{ "node_id": "module-uuid", "completed": true, "operation_id": "uuid" }`. An explicit `leaf_ids` variant may be supported for bounded batches, but the server must verify every ID belongs to the syllabus and is Tier 5. A branch request resolves current enrolled descendants on the server.

Use desired-state operations (`completed: true|false`), not “invert current state”; retries then remain idempotent. Store processed `operation_id` values if strict exactly-once effect is required. If no operation ledger exists, the endpoint remains state-idempotent but cannot promise exactly-once response replay.

### 7.4 Optimistic UI, offline and rollback

The client updates the leaf and derived ancestor display immediately, marking it pending. On API success, replace local completion/progress with server response. On failure, rollback to the last confirmed state unless the operation is durably queued in IndexedDB. When offline, enqueue the desired-state operation and display a pending indicator. Do not show an unconfirmed update as server-saved.

### 7.5 Errors and acceptance

- Unknown syllabus/leaf: 404.
- Parent ID sent to single-leaf endpoint: 422 `LEAF_REQUIRED`.
- Leaf not in syllabus: 404/422 without mutation.
- Stale conflicting version: 409 if optimistic concurrency is enabled.
- Bulk update is atomic; partial branch writes are forbidden.
- Two retries with the same desired state converge to the same result.

## 8. Flow 5 — Study Pacing and Target Deadlines

**Status:** feature is **SPECIFIED**; persistence and endpoint implementation are **UNRESOLVED**.

### 8.1 Objective and workflow

Student selects a Semester or Subject and assigns a target date. Only these two node types can own deadlines.

```text
Select Semester/Subject -> PUT /deadlines
 -> validate node and ISO date -> upsert deadline
 -> calculate remaining eligible leaves and contact hours
 -> calculate weekly workload -> return pacing view
```

### 8.2 Calculation contract

Let:
- `R` = remaining eligible Tier-5 leaves below the target node.
- `H` = remaining contact hours. Recommended definition: sum declared module contact hours weighted by remaining eligible leaf ratio within each module; if no reliable leaf-to-hour allocation exists, show module hours as an estimate and label it.
- `D` = calendar days from local current date to target date.
- `W = D / 7`.

If `W > 0`, `topics_per_week = R / W`; if `W <= 0` and `R > 0`, return `deadline_passed` and do not divide. If `R = 0`, status is `completed`, and required weekly velocity is zero. If contact hours are unknown, `hours_per_week = null`, not zero.

The deadline is a date-only academic target (`YYYY-MM-DD`) interpreted in the user's configured local timezone for “days remaining”; persist the date without a UTC offset. Server responses include the timezone used for calculations.

### 8.3 Status semantics

- `completed`: no eligible topics remain.
- `on_track`: observed completion velocity meets or exceeds required velocity.
- `at_risk`: velocity is below target but within a configurable warning band.
- `behind`: velocity is materially below target or target date has passed with work remaining.

No numeric thresholds are claimed as existing. **PROPOSED:** configure `at_risk_ratio` and `behind_ratio` (for example 0.8 and 0.6) and expose them in documented non-sensitive config only if needed. Avoid hardcoding thresholds in UI.

### 8.4 Recalculation and errors

Recalculate after completion changes, enrollment changes, deadline edits, and deadline deletion. Past dates are accepted but marked overdue; reject malformed dates and unsupported node types. A zero-duration deadline never causes division by zero.

Acceptance: deadline writes are atomic; a deadline cannot reference a nonexistent or wrong-tier node; excluded elective leaves do not inflate active topic counts; deleting a deadline does not delete course data.

## 9. Flow 6 — Notes, Resources, Export and Restore

**Status:** features are **SPECIFIED**; endpoint implementation is **UNRESOLVED**.

### 9.1 Topic notes

`GET/PUT/DELETE /api/syllabus/{id}/notes/{leaf_id}`.

A note belongs to exactly one Tier-5 leaf. `PUT` is an upsert with content, client `updated_at`/ETag or `expected_updated_at`, and operation ID. Server stores canonical content and timestamps. Empty content may be represented as an empty note or deletion; choose one behavior consistently (recommended: empty string is valid content, explicit DELETE removes the row).

The TopicNotesDrawer has `clean -> dirty -> saving -> saved|save_error` states. Debounce writes (recommended 500–800 ms); show “Saving”, “Saved”, or “Not saved”. Before navigation, flush pending writes or preserve them in the offline outbox. Concurrent edits use optimistic concurrency: send `If-Match`/expected version; return 409 with current server version rather than silently overwriting another edit.

### 9.2 Resources

Resources may attach to a Tier-5 subtopic or Tier-4 module. Supported types: `youtube`, `lecture`, `slides`, `article`, `other`. Validate absolute HTTP(S) URLs, reject credentials and dangerous schemes, normalize host, and detect duplicate `(syllabus_id,node_id,url)` entries. YouTube is a classification, not a guarantee that the URL is playable. Deletion requires resource ownership by the target syllabus.

### 9.3 Exports

- Markdown: preserve five-tier headings, enrollment labels, completion indicators, deadlines, notes, resource links and provenance references.
- Notion-compatible Markdown: use portable headings, bullets, checkboxes and ordinary links; avoid proprietary blocks.
- JSON: emit portable backup Schema 2.1, not a SQLite dump.
- HTML: escape all syllabus text, note content, titles and URLs; sanitize Markdown output and apply a restrictive CSP when served.
- PDF: render the printable HTML through an approved print/browser pipeline. PDF is an output representation; JSON remains the lossless portable format.

Exports should identify omitted data explicitly. Markdown/HTML cannot promise lossless restoration of relational metadata.

### 9.4 Restore

`POST /api/syllabus/restore-backup` accepts a validated Schema 2.1 envelope and mode: `import_as_new` (default), `replace_existing`, or `merge`. `replace_existing` requires explicit target syllabus ID and confirmation token; merge requires stable IDs and conflict policy. The default `import_as_new` assigns a new syllabus ID while preserving stable node IDs only within the imported syllabus namespace; regenerate IDs if collisions could cross records.

Validate payload size, format, schema version, hierarchy, references, and content before opening a write transaction. Unknown optional fields may be ignored only when the version policy allows it; preserve extension fields where feasible. Reject unsupported future versions. Any completion reference to a nonexistent or non-leaf ID rejects the whole restore. Restore all relational records and hierarchy JSON in one transaction; rollback everything on any failure.

## 10. Flow 7 — Global CLI Lifecycle

**Status:** Windows supervisor, process-tree ownership, single-instance lock, stale PID recovery, and 256-bit-token-authenticated loopback IPC are **IMPLEMENTED-DOC** in `Master_Context.md`.

### 10.1 Startup

```text
syllabus start
 -> validate install/config/venv/frontend
 -> acquire supervisor lock; recover stale lock safely
 -> inspect ports and reuse only verified healthy app instances
 -> launch managed backend/frontend and optional Ollama
 -> poll /health and frontend URL until ready or timeout
 -> open browser
 -> RUNNING
```

The documented CLI also supports `syllabus`, `status`, `logs`, `restart`, and `help`; this flow focuses on `start` and `stop`.

### 10.2 Shutdown

```text
syllabus stop
 -> connect to 127.0.0.1:<ephemeral_port>
 -> authenticate with 256-bit random token
 -> stop accepting new jobs
 -> request cooperative job cancellation or bounded completion
 -> flush/close database resources
 -> terminate owned process tree
 -> release lock
 -> STOPPED
```

Never expose unauthenticated shutdown control. The token must be stored with restrictive local permissions and never logged. Bind IPC only to loopback. Verify process identity before acting on a PID. Never kill unrelated processes merely because they occupy a configured port.

### 10.3 Recovery

- A stale PID is not sufficient proof of process identity; verify executable, start time, and lock ownership.
- Windows Job Objects are documented for child-process cleanup if supervisor exits.
- If graceful shutdown exceeds the configured deadline, terminate only the owned Job Object/process tree.
- On unexpected exit, rely on SQLite WAL recovery and run an integrity check before serving writes.
- Preserve logs with rotation; do not log secrets or note contents.

Acceptance: stop from another terminal requires token authentication; unrelated processes survive; startup reuses only verified healthy services; stale locks recover without deleting user data.

## 11. Flow 8 — Offline Operations and Synchronization

**Status:** offline progress updates are **SPECIFIED**; an implemented IndexedDB outbox is **UNRESOLVED**.

### 11.1 Outbox lifecycle

```text
USER ACTION
 -> optimistic local update
 -> online?
    YES -> API request -> confirmed -> clear pending marker
    NO  -> IndexedDB outbox (pending)
             -> network restored
             -> ordered dispatcher
             -> API confirmation
             -> mark completed/delete item
```

Each outbox item contains `operation_id`, `syllabus_id`, `operation_type`, `payload_version`, `payload`, `created_at`, `attempt_count`, `next_attempt_at`, `state`, and optional `last_error`.

States: `pending -> in_flight -> completed`; transient failures return to `pending`; permanent validation/conflict errors become `failed` and require user resolution.

### 11.2 Ordering and idempotency

- Preserve FIFO order per syllabus and entity where operations are causally dependent.
- Coalesce consecutive desired-state leaf toggles for the same leaf only if no intervening operation depends on the intermediate state.
- Notes use version-aware last-write conflict detection; never silently discard the losing content.
- Enrollment changes precede progress operations that depend on new eligibility.
- Server validates every referenced ID at replay time.
- Use exponential backoff with jitter and a cap; stop retrying 4xx validation errors except recoverable 409 conflicts.
- Operation IDs protect against duplicate application when the server persists a processed-operation ledger. Without that ledger, state-setting operations remain idempotent but event side effects may duplicate.
- Do not claim background sync after browser closure unless service-worker/background-sync support is verified.

### 11.3 User-visible status

Show `Saved locally`, `Syncing`, `Synced`, or `Needs attention`. A pending item is not server-confirmed. A permanent failure retains the payload locally until the user resolves or explicitly discards it.

Acceptance: offline changes survive reload in the same browser profile; replay is idempotent; ordering is deterministic; conflicts are visible; permanent failures do not disappear silently.

## 12. Cross-Device Navigation

The same hierarchy and server-derived progress must be represented consistently at all viewport sizes.

### Desktop
- Persistent sidebar and content workspace.
- `Ctrl+K` / `Cmd+K` command palette.
- Keyboard-accessible tree expansion, checkbox controls and contextual actions.
- Focus remains predictable after modal close or node deletion.

### Tablet
- Collapsible sidebar and adaptive content width.
- Contextual actions remain reachable without horizontal scrolling.
- Tree indentation is capped to preserve readable content width.

### Mobile
- Drawer navigation and compact bottom action bar.
- Topic actions use compact menus rather than desktop action rows.
- Notes drawer and elective modal become full-height or bottom-sheet layouts as appropriate.
- Tree uses scroll-safe nested rows, adequate touch targets and no page-level horizontal overflow.
- Evidence, Notes, Links, Target Date, Export & Backup, Configure Electives and Delete Document remain reachable.

Viewport layout is presentation only. It must not create separate completion or enrollment state.

## 13. Global Error and Recovery Strategy

| Failure | Client behavior | Server behavior | Recovery |
|---|---|---|---|
| Invalid file | Explain accepted formats/limits | 413/415/422 | Select another file |
| Parser timeout | Keep job reference | Terminal `PARSER_TIMEOUT` | Retry as new job |
| Worker crash | Poll job | Mark interrupted if durable jobs exist | Retry/recover |
| SSE disconnect | Reconnect/poll | Continue job | Resume from snapshot |
| Invalid hierarchy | Show reviewable issue | Do not persist invalid tree | Correct source/review |
| Unsafe URL | Explain target rejected | Reject before fetch | Use official safe URL/upload |
| Offline mutation | Show local pending | No server write | Replay on reconnect |
| Conflict | Preserve local draft | 409 with current version | Compare/resolve |
| Restore failure | Show validation summary | Roll back transaction | Correct backup |
| SQLite busy | Retry boundedly | 503 after timeout | Retry safely |

Error responses use the common envelope in `13_SCHEMA.md`. Never show raw stack traces or filesystem paths.

## 14. Security and Data Integrity Boundaries

- Treat syllabus text, URL content, model output, filenames, resource URLs and browser requests as untrusted.
- Enforce upload limits and parser timeouts server-side.
- Use unique temporary directories and cleanup in `finally`.
- Escape HTML and sanitize Markdown-derived HTML.
- Protect SSRF at DNS resolution and connection time, including redirects.
- Keep provider API keys out of `/api/config`, logs, browser bundles and errors.
- Validate stable node IDs and tier membership against canonical hierarchy JSON before any relational write.
- Enable SQLite foreign keys on every connection and use explicit transactions.
- Keep parent progress derived; never store authoritative parent completion.
- Preserve excluded elective history.
- Restore backups atomically.
- Restrict CLI control IPC to authenticated loopback.

## 15. End-to-End Acceptance Criteria

1. The tree always has exactly five academic tiers beneath a non-tier root.
2. Only Tier-5 leaves can be completed.
3. Parent states and percentages are derived from eligible enrolled leaves.
4. A zero-leaf branch is `not_trackable`, never complete.
5. Contact hours do not affect completion counts.
6. Upload returns 202 only after a job is registered.
7. SSE and polling report the same job state.
8. Progress is monotonic and 100% follows successful persistence.
9. Extraction retains page/offset provenance and does not fabricate missing hierarchy.
10. Noise and split-table cleanup do not erase source evidence.
11. URL preview and final ingestion both enforce SSRF protections.
12. Elective exclusion preserves completion, notes, resources and deadlines.
13. Deadline calculations handle zero duration and unknown hours.
14. Notes and resource mutations validate node tier and syllabus ownership.
15. Restore is atomic and rejects dangling leaf references.
16. Offline operations remain visible until server confirmation.
17. CLI stop is authenticated and affects only managed processes.
18. Desktop, tablet and mobile layouts expose equivalent actions without changing domain state.
