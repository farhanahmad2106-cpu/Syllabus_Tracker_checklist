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
   d. Always update the **Master_Context.md** and **Github Repo** after completing each phase.

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

### Options A, B, & C: Study Pacing, Notes, Resources, Export & Web Scraper [COMPLETED]
- [x] Option A — Study Pacing & Target Deadlines:
  - Persistent target deadlines per module and subject stored in SQLite (`target_deadlines` table).
  - Pacing calculation engine (`backend/app/pacing.py`) computing required daily velocity vs actual pace.
  - Pacing status classification: `on-track`, `ahead`, `behind`, `overdue`.
  - Frontend `PacingBadge.tsx` with date picker popover and visual countdown indicators.
- [x] Option B — Notes, Bookmarks & Multi-Format Syllabus Export:
  - Topic personal notes stored in SQLite (`topic_notes` table) with markdown support via `TopicNotesDrawer.tsx`.
  - External curated study resources and bookmarks stored in SQLite (`topic_resources` table) via `TopicResourcesModal.tsx`.
  - Multi-format syllabus export endpoints: Markdown (`/api/syllabus/{id}/export/markdown`), JSON (`/api/syllabus/{id}/export/json`), and self-contained styled HTML (`/api/syllabus/{id}/export/html`).
  - Full syllabus backup and restore endpoint (`/api/syllabus/restore-backup`) supporting both `clone` and `merge` restoration modes.
- [x] Option C — Web URL Syllabus Scraper & SSRF Defense:
  - Scraper service in `backend/app/scraper.py` with multi-layered SSRF defense (blocking private subnets, localhost, and AWS/GCP cloud metadata endpoints).
  - HTML extraction with BeautifulSoup4 and Markdown conversion with html2text.
  - Automatic downloadable document discovery (`.pdf`, `.docx`) from web pages.
  - Endpoints: `POST /api/scrape/preview` and `POST /api/scrape/ingest`.
  - Frontend `UrlImport.tsx` tab integrated into syllabus upload dialog.

### Phase 10: Extraction Sanitization, Commercial UI & Unified Command Palette [COMPLETED]
- [x] Extraction Sanitization & Input Defense:
  - Document content normalization in `backend/app/sanitizer.py` stripping dangerous script/style blocks, iframes, and null bytes before LLM extraction.
  - Preserved prompt-injection defense delimiters (`<untrusted_syllabus_content>`).
- [x] Commercial UI Modernization & Adaptive Theme System:
  - Centralized semantic CSS design tokens (`--bg-canvas`, `--bg-surface`, `--bg-surface-elevated`, `--text-primary`, `--border-subtle`).
  - Adaptive theme engine (`frontend/src/hooks/useTheme.ts`) supporting dark, light, and system themes with OS `prefers-color-scheme` listener and `localStorage` persistence (`syllabus_tracker_theme`).
  - Clean badge hygiene and elevation surfaces across all UI components.
- [x] Unified Global Command Palette & Instant Search:
  - Global shortcut modal (`frontend/src/components/CommandPalette.tsx`) triggered via `Ctrl+K` (Windows/Linux) or `Cmd+K` (macOS).
  - Multi-entity fuzzy search across 5 hierarchy tiers (Years, Semesters, Subjects, Modules, Topics), personal topic notes, and study resources.
  - Quick category filtering (`all`, `topics`, `modules`, `subjects`, `notes`, `resources`) with keyboard navigation and deep tree navigation.

### Phase 11: Cross-Device Mobile Ergonomics, Installable PWA & Offline IndexedDB Sync [COMPLETED]
- [x] Cross-Device Mobile & Tablet Ergonomics:
  - Responsive layouts covering 360px–2560px viewports with mobile-first slide-over sidebar drawer.
  - Touch ergonomics: minimum 44px tap targets, responsive action bars, and viewport-aware bottom sheets (`TopicNotesDrawer`).
  - Safe-area inset compatibility (`env(safe-area-inset-bottom)`) for mobile notches and gesture bars.
- [x] Installable Progressive Web App (PWA):
  - Standalone web app manifest (`frontend/public/manifest.webmanifest`) with application metadata, icons, and display mode.
  - Service Worker (`frontend/public/sw.js`) caching core app shell assets for offline availability.
- [x] Local-First IndexedDB Persistence & FIFO Outbox Sync:
  - IndexedDB storage engine (`frontend/src/lib/offlineStore.ts`) using `syllabus_tracker_offline_v1` database.
  - Caches syllabi list, complete syllabus trees, topic notes, and study resources.
  - Mutation outbox (`offline_outbox`) capturing offline toggle, note, and resource mutations in FIFO sequence.
  - Synchronization hook (`frontend/src/hooks/useOfflineSync.ts`) replaying queued mutations on network reconnection with server conflict detection (404/409 reconciliation).
  - Non-blocking offline status banner (`frontend/src/components/OfflineStatusBanner.tsx`) displaying online/offline status, pending sync count, and conflict recovery.

### Phase 12: Study Analytics, Historical Activity Log & SM-2 Spaced-Repetition Scheduler [COMPLETED]
- [x] Historical Activity Tracking & Event Logging:
  - SQLite WAL persistence table `study_activity_events` capturing timestamped completion events, undos, and revision ratings without altering canonical completion authority.
- [x] Study Analytics Aggregation Service:
  - Analytics calculation engine (`backend/app/analytics.py`, `GET /api/syllabus/{id}/analytics`).
  - 14-day study velocity chart, current and longest study streak calculation, and heuristic exam risk forecasting.
- [x] Deterministic SM-2 Spaced Repetition Engine:
  - Spaced repetition engine (`backend/app/spaced_repetition.py`) implementing deterministic `SM2-v1` algorithm.
  - Computes repetition count, interval (in days), and easiness factor ($EF \ge 1.3$) based on user review ratings.
  - Revision queue endpoint (`GET /api/syllabus/{id}/revisions/due`) and review submission endpoint (`POST /api/syllabus/{id}/revisions/{leaf_id}/review`).
  - Rapid rating shortcuts: `1` (Again), `2` (Hard), `3` (Good), `4` (Easy).
- [x] Analytics & Revision Workspace Dashboard:
  - Dedicated workspace tab (`frontend/src/components/AnalyticsDashboard.tsx`) with KPI summary cards, 14-day velocity visualization, exam risk alert banner, and interactive due revision flashcards.

### Step 1: Capacitor Native Mobile Packaging & Cross-Platform Integration [COMPLETED]
- [x] Thin Native Wrapper Architecture:
  - Installed Capacitor 7 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/network`) in `frontend/`.
  - Preserves 100% of existing React 19 / Vite / Tailwind CSS application architecture with zero duplicated state or academic logic.
- [x] Configuration & Scaffolding:
  - `frontend/capacitor.config.ts` configured with `appId: 'com.syllabustracker.app'`, `appName: 'Syllabus Tracker'`, `webDir: 'dist'`, `androidScheme: 'https'`.
  - Scaffolded native Android (`frontend/android`) and iOS (`frontend/ios`) project directories.
- [x] Cross-Platform Native Bridge (`frontend/src/lib/nativeBridge.ts`):
  - Browser-safe platform detection (`isNativePlatform`, `getNativePlatform`).
  - Theme-aware status bar appearance synchronization (`syncNativeStatusBar`: `#09090B` in dark mode, `#FAFAFA` in light mode; Android-guarded).
  - Android hardware back-button listener (`registerNativeBackButton`) with priority overlay hierarchy (Command Palette $\to$ Confirm Delete $\to$ Notes Drawer $\to$ Resources Modal $\to$ Upload Modal $\to$ Elective Modal $\to$ Mobile Sidebar $\to$ Exit).
- [x] Environment-Aware API URL Resolution (`frontend/src/lib/api.ts`):
  - `resolveApiBaseUrl` resolves absolute backend URL on native mobile platforms (`VITE_API_BASE_URL`) while defaulting to `/api` on web/PWA.
  - Documented in `frontend/.env.example` with emulator, simulator, LAN, and production guidelines.
- [x] Build Tooling & Git Hygiene:
  - Added npm scripts to `frontend/package.json`: `cap:sync`, `cap:android`, `cap:ios`.
  - Added native build artifact and keystore exclusions in `.gitignore`.

### Step 2: Native Mobile Release Packaging & App Store Distribution [COMPLETED]
- [x] Android Release Artifact Generation (Windows 11):
  - Configuration checklist for production backend URL: `VITE_API_BASE_URL="https://your-api-domain.com/api"` followed by `npm run cap:sync`.
  - Secure release keystore creation protocol outside git tracking (`$env:USERPROFILE\syllabus-release-key.jks`) using 2048-bit RSA and SHA-256 signatures.
  - Double-guarded git hygiene with `*.keystore` and `*.jks` in both root and frontend `.gitignore`.
  - Headless CLI compilation using Gradle Wrapper (`.\gradlew.bat assembleRelease` and `.\gradlew.bat bundleRelease`):
    - Release APK: `frontend\android\app\build\outputs\apk\release\app-release-unsigned.apk`
    - Release AAB: `frontend\android\app\build\outputs\bundle\release\app-release.aab`
  - Visual release signing documentation via Android Studio GUI (**Build** $\to$ **Generate Signed Bundle / APK**).
- [x] iOS Release IPA Compilation Workflow (macOS + Xcode):
  - Environment variable configuration: `VITE_API_BASE_URL="https://your-api-domain.com/api" npm run cap:ios`.
  - Target specification: Any iOS Device (arm64).
  - Apple Developer signing configuration: Team identification, bundle ID `com.syllabustracker.app`, App Transport Security rules.
  - Xcode distribution pipeline: `Product → Archive` and `Distribute App` in Organizer for TestFlight and App Store submission.

### Phase 13 — Cycle A: Multi-Syllabus Comparison & GPA / Credit Planner [COMPLETED]
- [x] Declared Academic Metadata & Schema Extension:
  - Added optional `credits?: float` and `ltp?: str` (e.g. `"3-1-0"`, `"0-0-4"`) to canonical Tier-3 `Subject` schema in `backend/app/schemas.py`.
  - Enhanced LLM extraction prompt and rule-based fallback in `backend/app/extractor.py` to extract credits and L-T-P lecture-tutorial-practical breakdowns only when grounded in source text.
- [x] Academic Plan Database Persistence:
  - Created `SubjectAcademicPlan` SQLModel table (`subject_academic_plans`) in `backend/app/models.py` with foreign key cascade to `syllabi.id` and unique constraint on `(syllabus_id, subject_id)`.
  - Implemented transactional helpers in `backend/app/database.py`: `get_subject_academic_plans`, `get_subject_academic_plan`, `upsert_subject_academic_plan`.
- [x] Academic Planning & Credit Engine (`backend/app/services/academic_planner.py`):
  - `compute_credit_and_gpa_plan`:
    - Resolves effective credits ($override ?? declared$).
    - Calculates completed credits requiring 100% leaf completion ($L_{completed} == L_{total} \land L_{total} > 0$).
    - Computes proportional earned credits estimate: $\sum C_i \times \frac{L_{completed}}{L_{total}}$.
    - Grade scale isolation: Computes target SGPA and CGPA separately for 10.0 and 4.0 scales without mixing.
    - Elective exclusion invariant: Excluded electives (`is_enrolled == False`) contribute 0 to declared, completed, and GPA totals.
- [x] Multi-Syllabus Comparison Service:
  - `compare_syllabi`: Compares 2 to 4 unique syllabi across curriculum structure, completion %, lab workload, declared/effective/completed credits, and weekly lecture/tutorial/practical hours.
  - Shared subject detection across exact course code, exact title, and token overlap.
- [x] REST API Endpoints in `backend/app/main.py`:
  - `GET /api/syllabus/{id}/academic-plan`: Computes and returns complete semester and program credit summaries and grade projections.
  - `PUT /api/syllabus/{id}/subjects/{id}/academic-plan`: Upserts credit overrides and target grade points with grade scale validation.
  - `POST /api/syllabi/compare`: Compares 2 to 4 syllabi and returns side-by-side metrics and shared courses.
- [x] Offline-First Frontend Integration:
  - Added mutation type `'SAVE_ACADEMIC_PLAN'` to `frontend/src/lib/offlineStore.ts` and outbox replay handler in `frontend/src/hooks/useOfflineSync.ts`.
  - Built accessible `AcademicPlanModal.tsx` for credit overrides and target grade configuration.
  - Built `CompareSyllabiModal.tsx` supporting 2–4 syllabus selection, comparison matrix table, and shared courses view.
  - Added credit badges (`X Cr`) and `Credits / GPA` buttons to Tier-3 subjects in `SyllabusTree.tsx`.
  - Added "Credit Workload & Target GPA" section to `AnalyticsDashboard.tsx`.
  - Wired header and sidebar Compare triggers and modals into `frontend/src/App.tsx`.
- [x] Testing & Verification:
  - Authored comprehensive backend unit tests in `backend/tests/test_academic_planner.py`.
  - Authored frontend component tests in `frontend/src/__tests__/CompareSyllabiModal.test.tsx` and `frontend/src/__tests__/AcademicPlanModal.test.tsx`.
  - Verified static Python syntax compilation across all backend files.

### Phase 13 — Cycle B: AI Study Assistant, Local RAG & Grounded Flashcards [COMPLETED]
- [x] SQLite FTS5 Full-Text Retrieval Virtual Table:
  - Created `syllabus_retrieval_fts` virtual table using SQLite FTS5 with `unicode61` tokenizer indexing (`syllabus_id`, `node_id`, `leaf_id`, `source_type`, `title`, `content_text`).
  - Added atomic index rebuild and sync services: `rebuild_syllabus_fts_index`, `sync_topic_note_fts`, `delete_topic_note_fts`, `delete_syllabus_fts`.
  - Wired FTS rebuild and synchronization directly into syllabus upload, enrollment finalization, and topic note upsert/delete operations.
  - Strict unenrolled elective exclusion: Invariant enforced where topics in unenrolled electives (`is_enrolled == False`) are omitted from FTS index and retrieval.
- [x] Study Flashcard Persistence:
  - Created `StudyFlashcard` SQLModel table (`study_flashcards`) with columns `id`, `syllabus_id`, `leaf_id`, `front_question`, `back_answer`, `citation_label`, `source_quote`, `source_type`, `source_page`, `created_by`, `fingerprint`, `created_at`.
  - Added cascading foreign key to `syllabi.id` and index on `(syllabus_id, leaf_id)`.
  - Added repository CRUD helpers in `backend/app/database.py`: `get_study_flashcards`, `get_study_flashcard`, `create_study_flashcard`, `create_study_flashcards_batch`, `delete_study_flashcard`.
- [x] Grounded AI Retrieval & Study Assistant Service (`backend/app/services/study_assistant.py`):
  - `retrieve_grounded_context`: Sanitizes FTS queries, executes BM25-ranked full-text retrieval, filters out unenrolled electives, and returns `EvidenceChunk` dataclasses.
  - `ask_study_assistant`:
    - Zero-hallucination abstention: If no evidence is found, returns `answer_state = "insufficient_evidence"` immediately without calling Ollama.
    - Prompt-injection defense: Wraps untrusted syllabus and note text in boundary tags `<untrusted_syllabus_content>`.
    - Citation verification: Cross-checks every returned citation against retrieved text to ensure `verbatim_quote` is a strict substring, discarding unverified citations.
    - Local Ollama invocation with fallback when offline.
  - `generate_topic_flashcards`:
    - Generates 3–5 active-recall flashcards grounded in Tier-5 subtopic text and notes using Instructor structured outputs.
    - Verifies that `source_quote` is a strict substring of the retrieved topic context.
    - Deduplication fingerprinting prevents duplicate cards from being saved across runs.
    - Offline fallback (`generate_deterministic_flashcards`): Automatically synthesizes grounded concept and recall cards even when Ollama is offline.
- [x] Phase 12 Spaced Repetition (SM-2) Integration:
  - Rating recall on flashcards (1 = Again, 2 = Hard, 3 = Good, 4 = Easy) in `FlashcardDeckModal` submits review ratings directly to `submitRevisionReview(syllabusId, leafId, quality)`, updating the canonical `RevisionSchedule` without duplicate scheduling systems.
- [x] REST API Endpoints in `backend/app/main.py`:
  - `POST /api/syllabus/{id}/assistant/ask`: Ask evidence-grounded questions with citations and abstention.
  - `GET /api/syllabus/{id}/flashcards`: Retrieve study flashcards scoped to syllabus or specific leaf.
  - `POST /api/syllabus/{id}/topics/{leaf_id}/flashcards/generate`: Generate 3–5 grounded flashcards for a Tier-5 subtopic.
  - `DELETE /api/syllabus/{id}/flashcards/{card_id}`: Delete an individual flashcard.
- [x] Accessible Frontend Integration:
  - Types in `frontend/src/types/syllabus.ts` (`StudyCitation`, `GroundedStudyAnswer`, `StudyAssistantRequest`, `StudyFlashcard`, `FlashcardGenerationResponse`).
  - Typed client methods in `frontend/src/lib/api.ts` (`askStudyAssistant`, `fetchStudyFlashcards`, `generateTopicFlashcards`, `deleteStudyFlashcard`).
  - `StudyAssistantDrawer.tsx`: Accessible slide-over drawer with quick suggested questions, status pills (`Fully Grounded`, `Partially Grounded`, `Insufficient Evidence`), citation cards with "View in Tree" deep navigation.
  - `FlashcardDeckModal.tsx`: Flippable 3D card deck with keyboard shortcuts (Space to flip, 1-4 for SM-2 recall rating, Arrow keys to navigate, Delete to remove), verbatim quotes, source badges, and generation button.
  - `SyllabusTree.tsx`: Added Flashcard (`Sparkles`) and Ask AI (`Bot`) quick actions to each Tier-5 subtopic leaf row.
  - `AnalyticsDashboard.tsx`: Added Flashcards button on due revision schedule items.
  - `CommandPalette.tsx`: Added "Ask Syllabus AI" action and shortcut.
  - `App.tsx`: Header "Ask AI" button, modal wiring, and hardware back-button stack handling (priorities 1.7 & 1.8).
- [x] Testing & Verification:
  - Authored comprehensive backend unit & integration tests in `backend/tests/test_study_assistant.py`.
  - Authored frontend component tests in `frontend/src/__tests__/StudyAssistantDrawer.test.tsx` and `frontend/src/__tests__/FlashcardDeckModal.test.tsx`.
  - Verified static Python syntax compilation across all backend files.

### Current Repository Status
- Codebase complete, hardened, verified, and synced to remote: `https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist`.
- Verified Automated Test Baseline:
  - Backend: 182 passed, 0 failed (`pytest backend/tests/`).
  - Frontend: 123 passed across 17 test files (`vitest run`).
  - Static Typecheck: 0 TypeScript errors (`tsc --noEmit`).
  - Production Bundle: Clean Vite build (`npm run build`).