## Syllabus Tracker Project - Master Context

# Never Change this :-

**1. Github Repository:-**
*   **Link:** https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist

# **Important:-**  

**1. Local LLM:- Ollama 1.6.10 (Qwen3-8B:latest / qwen2.5:7b / llama3.1:8b)**
**2. Frontend:- React 19 + TypeScript + Tailwind CSS v4**
**3. Backend:- FastAPI + Python 3.12**
**4. Database:- SQLite (WAL mode, Foreign Keys ON)**

**5. Note:-** 
   a. Always follow the **checklists** for each phase of the project.
   b. Refer **Master_Context.md** for the complete context of the project.
   c. Do not execute tests until explicitly asked.

---

## Architecture & Project Status Checklist

### Phase 1: Repository & Environment Setup [COMPLETED]
- [x] Initialized Git repository and configured `.gitignore` for Python, Node, and SQLite artifacts.
- [x] Pinned Python 3.12 virtual environment (`backend/venv`) with core dependencies (`fastapi`, `uvicorn`, `pydantic`, `sqlalchemy`, `instructor`, `openai`, `docling`, `pypdf`, `python-docx`).
- [x] Scaffolded React + TypeScript + Tailwind CSS frontend with Vite.
- [x] Created root and component `.env.example` configurations.

### Phase 2: Domain Models & SQLite Persistence [COMPLETED]
- [x] Canonical 5-level hierarchy schema in `backend/app/schemas.py`:
  `Degree/Program → Academic Year → Semester → Topic/Course → Subtopic`
- [x] SQLAlchemy persistence models in `backend/app/models.py` (`SyllabusRecord`, `LeafCompletionRecord`).
- [x] SQLite engine in `backend/app/database.py` with `PRAGMA foreign_keys=ON`, `PRAGMA busy_timeout=5000`, and WAL mode.
- [x] Transactional repository methods for saving syllabi, atomic leaf toggles, bulk branch updates, renames, and cascade deletions.

### Phase 3: Parsing & Structured Extraction [COMPLETED]
- [x] Document parser in `backend/app/parser.py` supporting PDF, DOCX, TXT, and legacy DOC with upload size validation (25 MiB max) and secure isolated temp directory cleanup (`mkdtemp` + `rmtree`).
- [x] Legacy `.doc` support using headless LibreOffice (`soffice`) conversion with execution timeouts and graceful diagnostics when LibreOffice is not installed.
- [x] Docling parser integration with robust PyPDF and python-docx offline fallbacks.
- [x] Structured LLM curriculum extractor in `backend/app/extractor.py` using Instructor and local Ollama.
- [x] Prompt injection boundaries (`<UNTRUSTED_DOCUMENT_CONTENT>`) and heuristic outline fallback parser.
- [x] Grounding validation, verifiable source evidence matching, and `evidence_status` (`verified` | `needs_review`) tracking in `backend/app/validation.py`.
- [x] Pipeline coordinator in `backend/app/services/ingestion.py`.

### Phase 4: Progress Engine & REST API [COMPLETED]
- [x] Pure progress calculation engine in `backend/app/progress.py` (`completed_leaves / total_leaves * 100%`).
- [x] Dynamic tri-state parent derivation (checked, unchecked, indeterminate).
- [x] FastAPI application in `backend/app/main.py` implementing `/api/health`, `/api/config`, `/api/syllabi`, `/api/upload`, `/api/syllabus/{id}`, `/api/syllabus/{id}/toggle-leaf`, `/api/syllabus/{id}/bulk-toggle` (supporting both `node_id` and explicit `leaf_ids`), and `/api/syllabus/{id}`.
- [x] Safe frontend configuration endpoint `GET /api/config` exposing non-sensitive runtime parameters (upload limits, allowed extensions, active model) without leaking private keys or filesystem paths.
- [x] Schema extensions in `backend/app/schemas.py` including `evidence_status`, `source_document_id`, and `AppConfigResponse`.
- [x] CORS middleware and domain exception handlers.
- [x] Verified clean Python byte compilation via `python -m compileall backend/app`.

### Phase 5: React / TypeScript Frontend [COMPLETED]
- [x] Canonical TypeScript interfaces in `frontend/src/types/syllabus.ts` (with `Year` alias, `evidence_status`, `source_document_id`, and `AppConfigResponse`).
- [x] Pure progress helper library in `frontend/src/lib/progress.ts`.
- [x] Safe error normalization and parsing utilities in `frontend/src/lib/errors.ts`.
- [x] Typed HTTP client in `frontend/src/lib/api.ts` (including `fetchConfig`, `fetchHealth`, `fetchSyllabiList`, etc.).
- [x] Custom hook `frontend/src/hooks/useSyllabus.ts` managing syllabus state, mutations, and Ollama diagnostics.
- [x] Components:
  - `FileUpload.tsx`: Drag-and-drop syllabus upload with size and format checks (PDF, DOCX, DOC, TXT; 25 MiB max).
  - `SyllabusTree.tsx`: Recursive 5-level tree with Radix UI tri-state checkboxes and accessible disclosures.
  - `ProgressBar.tsx`: Global and per-node progress indicators (`X / Y completed (Z%)`).
  - `SourceEvidence.tsx`: Grounding modal displaying verbatim document evidence, page, location, and verified/needs-review status badge.
  - `ConfirmDelete.tsx`: Accessible modal dialog for syllabus deletion with keyboard focus management and escape cancellation.
  - `EmptyState.tsx`: Reusable accessible empty state component with action button.
  - `ErrorMessage.tsx`: Dismissible error notifications.
  - `App.tsx`: Main layout, Ollama badge, sidebar, title rename, and delete dialog.
- [x] Clean TypeScript typecheck (`npm run typecheck`) and production build verified (`npm run build`).

### Phase 6: Document Upload Freeze & Windows WinError 1450 Permanent Fix [COMPLETED]
- [x] Diagnosed Root Cause:
  - Docling parser was previously placed first in `parse_uploaded_file`, forcing PyTorch and computer-vision model initialization (`torch/utils/deterministic.py`) on every PDF upload. On Windows 11 with Uvicorn watching the workspace (including the 5GB `backend/venv`), Windows kernel paged pool and file handles became exhausted (`[WinError 1450] Insufficient system resources exist to complete the requested service`).
  - The upload endpoint `POST /api/upload` was calling the heavy synchronous parsing pipeline directly inside an `async def` route without `asyncio.to_thread` or an explicit timeout deadline (`asyncio.wait_for`), blocking the FastAPI event loop indefinitely when PyTorch hung.
  - The frontend `uploadSyllabusFile` fetch call lacked an `AbortController` and timeout deadline, causing the UI to freeze indefinitely on "Extracting Syllabus Curriculum...".
- [x] Layered Document-Parsing Pipeline (`backend/app/parser.py`):
  - Inverted parsing order: Digital text PDFs now default to fast-path `pypdf` (~20ms extraction, 0MB model overhead, zero PyTorch initialization).
  - Docling is now an opt-in fallback (`ENABLE_DOCLING_FALLBACK = False` by default), only attempted if `pypdf` extracts 0 characters (indicating a scanned image).
  - Explicitly handles `OSError` (WinError 1450) and raises a structured, human-actionable error instead of crashing the server process.
  - Replaced hardcoded temporary file `staged.pdf` with uniquely isolated temporary filenames (`upload_{uuid}{ext}`) to prevent collisions during concurrent uploads.
  - Enforced resource limits in `backend/app/config.py`: `MAX_PDF_PAGES = 150`, `MAX_EXTRACTED_TEXT_CHARS = 500_000`, `PARSER_TIMEOUT_SECONDS = 45`.
- [x] Failure-Safe Async Upload Endpoint (`backend/app/main.py`):
  - Offloaded blocking ingestion to worker threads using `asyncio.to_thread` with bounded concurrency semaphore (`upload_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_PARSING_JOBS)`).
  - Enforced request processing timeout using `asyncio.wait_for`.
  - Added clean terminal error responses with HTTP 413 (Payload Too Large), HTTP 415 (Unsupported Media Type), HTTP 504 (Processing Timeout), and HTTP 503 (System Resource Exhausted / WinError 1450).
  - Fixed pre-existing indentation bug in `get_node_descendant_leaf_ids` in `backend/app/progress.py`.
- [x] Restructured Windows 11 Backend Launcher (`start-backend.ps1`):
  - In Development mode, restricted Uvicorn reload monitoring strictly to `--reload-dir backend/app` so that `backend/venv`, node_modules, and temp files are never scanned.
  - Added Stable execution mode (`-Mode Stable`) without file watching.
  - Implemented safe, non-destructive port conflict checks via PowerShell `Get-NetTCPConnection` without killing unrelated `python.exe` processes.
- [x] Frontend Upload Recovery & Cancellation (`frontend/src/lib/api.ts`, `FileUpload.tsx`, `useSyllabus.ts`):
  - Added 90-second client-side timeout and `AbortController` in `uploadSyllabusFile`.
  - Added user "Cancel Upload" and "Retry" controls in `FileUpload.tsx`.
  - Guaranteed `isUploading` resets in `finally` blocks and added accessible `role="alert"` announcements.
- [x] Verification & Test Suite:
  - Backend tests: 47 passed out of 47 in 1.90s (`pytest backend/tests`).
  - Frontend tests: 9 passed out of 9 in 3.66s (`npm run test`).
  - TypeScript typecheck passed with 0 errors (`npm run typecheck`).
  - Production build completed successfully in 2.14s (`npm run build`).

### Phase 7: Master Engineering Audit, Limits Alignment & Verification [COMPLETED]
- [x] Aligned Application Limits with Master Engineering Specification:
  - `MAX_UPLOAD_SIZE_BYTES = 52428800` (50 MiB) enforced across backend `config.py` and frontend `FileUpload.tsx`.
  - `MAX_PDF_PAGES = 300` in `config.py`.
  - `MAX_EXTRACTED_TEXT_CHARS = 1500000` in `config.py`.
  - `PARSER_TIMEOUT_SECONDS = 300` in `config.py`.
  - `DOC_CONVERSION_TIMEOUT_SECONDS = 30` in `config.py` and plumbed directly into `parser.py` LibreOffice conversion.
  - Client-side upload timeout updated to 300s (300,000 ms) with `AbortController` in `frontend/src/lib/api.ts`.
- [x] Schema & Grounding Status Alignment:
  - Extended `Subtopic` in `backend/app/schemas.py` and `frontend/src/types/syllabus.ts` to support `Literal["verified", "needs_review", "unverified"]`.
  - Added `grounding_status` alias synced bidirectionally with `evidence_status`.
  - Updated `SourceEvidence.tsx` badge rendering: `verified` (emerald), `needs_review` (amber), and `unverified` (rose).
- [x] Academic-Year Inference Formula:
  - Grounded `derive_academic_year_number` in `backend/app/validation.py` to the strict `academic_year = (semester_number + 1) // 2` integer arithmetic formula.
- [x] IDE Interpreter & Language Server Import Diagnostics Fix:
  - Created `.vscode/settings.json` configuring `python.defaultInterpreterPath` to point to `backend/venv/Scripts/python.exe` and adding virtual environment `site-packages` to `python.analysis.extraPaths` to eliminate IDE unresolved import warnings when the editor defaults to system Python.
  - Added defensive import guards and `# type: ignore[import-not-found]` in `backend/app/parser.py` and `backend/tests/test_parser.py` for `pypdf`, `docx`, and `docling`.
- [x] Test Coverage & Build Verification:
  - Added unit test in `frontend/src/__tests__/FileUpload.test.tsx` verifying client-side rejection of files >50 MiB.
  - Backend tests: 47 passed out of 47 in 2.61s (`pytest backend/tests`).
  - Frontend tests: 10 passed out of 10 in 4.17s (`vitest run`).
  - TypeScript typecheck: `tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded in 1.44s.

### Phase 8: Real-Time Upload Progress, Resumable SSE Job Tracking, and Timeout-Resistant Chunked Ingestion [COMPLETED]
- [x] Thread-Safe In-Memory Job Manager (`backend/app/services/job_manager.py`):
  - Model `JobProgress` tracking `job_id`, `stage`, `percent`, `message`, `result`, `error`, `created_at`, `updated_at`, `cancel_requested`.
  - Atomic thread-safe updates protected by `threading.RLock`.
  - Strict monotonic progress enforcement (progress can never decrease, clamped 0–100%).
  - Terminal state immutability (`completed`, `failed`, `cancelled` can never transition back to active).
  - Snapshot isolation: returns validated immutable copies (`get`, `update`, `create_job`).
  - Subscriber fan-out with `asyncio.Queue` for Server-Sent Events.
  - Automatic isolation and cleanup of staging files/directories.
- [x] Semantic Chunking Pipeline for Large Syllabi (`backend/app/services/chunking.py`):
  - Documents exceeding 15,000 characters partitioned along semester/year boundaries (`Semester 1`, `Year 1`, course headings).
  - Paragraph-boundary sizing fallback for long unstructured sections.
  - Provable page provenance retained per chunk.
  - Sequential chunk extraction pipeline with weighted milestones ($P = 40 + 45 \times \frac{\text{completed}}{\text{total}}$).
  - Cooperative cancellation checks before and after each chunk.
  - Deterministic multi-chunk curriculum merger (`merge_extracted_curricula`) resolving conflicting metadata and deduplicating courses.
- [x] Asynchronous Ingestion & Persistence (`backend/app/services/ingestion.py`):
  - Implemented `process_ingestion_job` executing stages asynchronously in worker threads.
  - Clear stages: `queued` (0%), `validating` (5%), `parsing` (10-30%), `chunking` (30-40%), `extracting` (40-85%), `validating_result` (85-95%), `persisting` (95-99%), and `completed` (100%).
  - Single-transaction atomic SQLite writes with automatic rollback on error or cancellation.
  - Preserved synchronous `ingest_syllabus_document` for backward compatibility (`?sync=true`).
- [x] Real-Time SSE Endpoint & Job API (`backend/app/main.py`):
  - `POST /api/upload` streams file to isolated staging disk and immediately returns `202 Accepted` with `StartUploadResponse`.
  - `GET /api/upload/progress/{job_id}`: Standard SSE stream (`id:`, `event: progress`, `data: {json}`) with `: keep-alive\n\n` heartbeats and client disconnection awareness (`request.is_disconnected()`).
  - `GET /api/upload/jobs/{job_id}`: Polling fallback returning `JobProgressResponse`.
  - `POST /api/upload/jobs/{job_id}/cancel`: Explicit cooperative cancellation.
- [x] Accessible React Progress UI & Client Architecture (`frontend`):
  - Extended domain types in `types/syllabus.ts` (`UploadStage`, `StartUploadResponse`, `UploadProgress`).
  - Implemented `startUploadJob`, `subscribeUploadProgress`, `cancelUploadJob`, and `pollJobStatus` in `frontend/src/lib/api.ts` with automatic polling fallback if SSE encounters interruption.
  - Updated `useSyllabus.ts` to manage upload state, expose `uploadProgress`, and support user cancellation.
  - Updated `FileUpload.tsx` with accessible progress bar (`role="progressbar"`), ARIA bounds, current percentage, stage badge, status message, and cancellation button.
- [x] Verification & Automated Test Suite:
  - Backend tests: 60 passed out of 60 in 1.98s (`pytest backend/tests`).
  - Frontend tests: 12 passed out of 12 in 2.90s (`vitest run`).
  - TypeScript typecheck: `tsc --noEmit` passed with 0 errors.
  - Production build: `npm run build` succeeded in 1.80s.
  - End-to-end integration test: `test_large_multipage_pdf_chunked_ingestion` passed with synthetic multi-page document exceeding 15,000 characters.

### Phase 9: Production-Grade Windows 11 Global CLI Launcher (`syllabus`) [COMPLETED]
- [x] Windows-Native Global CLI Supervisor Engine (`scripts/launcher.py`):
  - Unified commands: `syllabus`, `syllabus start`, `syllabus stop`, `syllabus status`, `syllabus logs`, `syllabus restart`, `syllabus help`.
  - Windows Job Object process tree supervision (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` via `ctypes.windll.kernel32`), guaranteeing automatic kernel-level termination of all child processes (`uvicorn`, `node`, `vite`) if supervisor exits, eliminating orphaned processes.
  - Non-destructive port conflict management: strictly avoids indiscriminate `taskkill` commands; probes HTTP health endpoints before binding; reuses verified healthy instances without crashing.
  - Safe Ollama lifecycle management: probes `GET http://127.0.0.1:11434/api/tags`; preserves pre-existing daemons; runs in optional/degraded mode if Ollama is absent.
  - Cross-terminal control IPC: loopback HTTP control server on `127.0.0.1:<ephemeral_port>` with cryptographically random 256-bit token authentication for graceful `syllabus stop` and live status inspection from external terminals.
  - Single-instance lock (`supervisor.lock`) with automated stale PID detection and recovery.
  - Persistent log rotation under `%LOCALAPPDATA%\SyllabusTracker\logs\` (`launcher.log`, `backend.log`, `frontend.log`, `ollama.log`).
- [x] Idempotent Windows 11 Installer (`scripts/setup-global-cli.ps1`):
  - Validates repository root, backend virtual environment, and frontend package manifest.
  - Generates `%USERPROFILE%\bin\syllabus.cmd` and `syllabus.ps1` with signature verification.
  - Adds `%USERPROFILE%\bin` to User PATH environment variable without requiring Administrator privileges.
  - Configures `%LOCALAPPDATA%\SyllabusTracker\config.json`.
- [x] Clean Uninstaller (`scripts/uninstall-global-cli.ps1`):
  - Safely deletes only application-owned CLI wrappers and cleans User PATH without altering unrelated user tools or project data.
- [x] Comprehensive Documentation (`scripts/README-launcher.md`):
  - Documented prerequisites, setup commands, CLI options, config schema, process ownership, port safety, and recovery procedures.
- [x] Automated Testing & Quality Verification:
  - 17 unit tests in `backend/tests/test_launcher.py` covering CLI parsing, health probes, port inspection, single-instance locks, and IPC control server authentication (17 passed).
  - Full backend test suite: 77 passed out of 77 in `backend/tests`.
  - Frontend test suite: 12 passed out of 12 in `vitest run`.
  - TypeScript typecheck: `tsc --noEmit` passed with 0 errors.

### Current Repository Status
- Codebase complete, verified, and synced to remote: `https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist`.