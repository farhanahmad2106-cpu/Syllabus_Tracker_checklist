# 📚 Hierarchical Syllabus Checklist & Progress Tracker
## Production-Grade 5-Tier Curriculum Architecture, Deterministic Extraction, Elective Enrollment, Historical Progress Preservation, Contextual Lab Handling, Contact-Hour Metadata, and Hot-Switchable Dual-Provider AI Engine

A local-first, privacy-respecting, production-grade application that ingests academic syllabus documents (`.pdf`, `.docx`, `.doc`, `.txt`) into an interactive, five-tiered curriculum checklist with automatic cascading completion, source evidence verification, elective enrollment onboarding, study pacing, personal notes, curated resources, multi-format export, offline-first PWA sync, study analytics, SM-2 spaced repetition, and Capacitor native mobile packaging.

---

## 🌟 Key Features

- **Strict 5-Tier Canonical Academic Hierarchy**:
  $$\text{Document Root (Container)} \longrightarrow \text{Academic Year (Tier 1)} \longrightarrow \text{Semester (Tier 2)} \longrightarrow \text{Subject / Course (Tier 3)} \longrightarrow \text{Module / Unit (Tier 4)} \longrightarrow \text{Subtopic Leaf (Tier 5)}$$
- **Deterministic Multi-Format Ingestion**: Accepts academic syllabi in `.pdf`, `.docx`, `.doc`, and `.txt` formats with fast-path parsing (`pypdf`, `python-docx`), boilerplate noise removal (headers/footers/page numbers), and headless LibreOffice conversion for legacy `.doc`.
- **Hot-Switchable Dual-Provider AI Engine**: Seamlessly switch between local **Ollama** (`llama3.1:8b`, `qwen2.5:7b`) and cloud **OpenAI-compatible** endpoints via `EXTRACTION_PROVIDER` with strict `<untrusted_syllabus_content>` prompt-injection defense.
- **Elective Course Onboarding Workflow**:
  - Interactive onboarding modal (`ElectiveOnboardingModal.tsx`) presented before final checklist generation.
  - Mandatory courses are locked as enrolled and cannot be excluded.
  - Excluded/pending electives are omitted from active checklist progress.
  - **Historical Progress Preservation**: Completion records are preserved upon elective unenrollment and restored upon re-enrollment.
- **Contextual Laboratory & Practical Course Handling**: Automatically detects labs (`is_lab: True`), displays `"Lab Course"` badge, initializes collapsed on tree load, and retains uniform completion weighting ($w = 1$).
- **Module Contact-Hour Metadata**: Extracts declared module contact hours (`contact_hours: Optional[int]`) and renders informational badges without altering completion weighting.
- **Evidence Traceability & Zero Hallucination**: Every leaf subtopic preserves exact verbatim excerpts (`source_text`), 1-based physical page citations (`source_page`), canonical document offsets (`[source_start_offset, source_end_offset]`), and grounding status (`verified`, `needs_review`).
- **Cascading Tri-State Checkboxes**:
  - `☑ Checked`: 100% of enrolled descendant subtopic leaves are completed.
  - `◐ Indeterminate`: Some enrolled descendant leaves are completed.
  - `☐ Unchecked`: 0 enrolled descendant leaves are completed (zero-leaf branches display 0/0 and 0%).
- **Leaf-Only SQLite Persistence**: Only valid Tier 5 leaf completion IDs are persisted in SQLite; all parent checkbox states and progress percentages are derived dynamically bottom-up.
- **Dynamic Multi-Level Analytics**: Real-time percentage and fractional tracking at Module, Subject, Semester, Year, and overall Program levels.
- **Adaptive Theme System & Design Tokens (Phase 10)**: Seamless dark, light, and system theme switching (`useTheme`) with persistent user preference in `localStorage` (`syllabus_tracker_theme`), centralized semantic design tokens, and smooth contrast-compliant transitions.
- **Unified Global Command Palette & Instant Search (Phase 10)**: Keyboard-driven modal (`Ctrl+K` on Windows/Linux, `Cmd+K` on macOS) providing instant multi-entity fuzzy search across all 5 canonical hierarchy tiers (Years, Semesters, Subjects, Modules, Topics), personal topic notes, and bookmarks/resources, with keyboard navigation and deep tree navigation.
- **Cross-Device Mobile & Touch Ergonomics (Phase 11)**: Responsive layouts (360px–2560px), mobile-first slide-over sidebar drawers, touch-friendly tap targets ($\ge 44\text{px}$), and viewport-aware bottom sheets (`TopicNotesDrawer`) with safe-area insets (`env(safe-area-inset-bottom)`).
- **Installable PWA & Local-First Offline Synchronization (Phase 11)**: Complete Progressive Web App with standalone web app manifest (`manifest.webmanifest`), Service Worker asset caching (`sw.js`), IndexedDB offline persistence (`syllabus_tracker_offline_v1`), FIFO outbox queue (`offline_outbox`), automatic network recovery reconciliation (`useOfflineSync`), conflict detection, and non-blocking offline status banner (`OfflineStatusBanner.tsx`).
- **Study Analytics & Spaced-Repetition Revision Scheduler (Phase 12)**:
  - Immutable historical study activity event logging (`study_activity_events` in SQLite WAL).
  - Real-time study analytics aggregation (`/api/syllabus/{id}/analytics`): 14-day study velocity chart, current and longest study streak tracking, and heuristic exam risk forecasting.
  - Deterministic SM-2 spaced repetition engine (`SM2-v1` algorithm) calculating optimal review intervals based on easiness factor ($EF \ge 1.3$) and repetition history.
  - Daily due revisions queue (`/api/syllabus/{id}/revisions/due`) with rapid keyboard evaluation shortcuts: `1` (Again), `2` (Hard), `3` (Good), `4` (Easy).
- **Study Pacing & Target Deadlines (Option A)**: Configurable completion target dates per module and subject with automatic velocity tracking and visual status badges (`on-track`, `ahead`, `behind`, `overdue`).
- **Markdown Notes, Resources & Multi-Format Export (Option B)**: Rich markdown topic notes, external curated reference links, multi-format syllabus export (Markdown, JSON, self-contained printable HTML), and full database backup export with merge/clone restore (`/api/syllabus/restore-backup`).
- **Web URL Syllabus Ingestion & SSRF Defense (Option C)**: Direct ingestion of web-hosted syllabi via URL scraping (`/api/scrape/preview`, `/api/scrape/ingest`) with strict SSRF defense (private IP/subnet blocking, AWS/GCP cloud metadata blocking), HTML extraction, and automatic downloadable `.pdf`/`.docx` document discovery.
- **Capacitor Native Mobile Packaging (Step 1)**: Thin native wrapper for Android and iOS using Capacitor 7, preserving 100% of the React application architecture with zero duplicated business logic, theme-synchronized native status bars, Android hardware back-button interception with modal priority stack, and environment-aware backend URL resolution (`VITE_API_BASE_URL`).
- **Operational Health Endpoints**: `/health` (liveness probe with active provider and model diagnostics) and `/ready` (readiness probe verifying database connectivity without exposing secrets).

---

## 🏗️ Architecture Overview

```text
[Uploaded Document: PDF / DOCX / DOC / TXT / Web URL]
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│                      LAYER 1: INGESTION SERVICE                        │
│  - Secure Temp Storage & Validation (50 MiB, 1000 pgs)                 │
│  - Fast-Path Parsers: pypdf, python-docx, LibreOffice                  │
│  - Web URL Scraper & SSRF Defense (Option C)                           │
│  - Running Header/Footer Boilerplate Removal & Offset Tracking         │
└───────────────────────────────────┬────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│                   LAYER 2: STRUCTURED REASONING                        │
│  - Dual-Provider: Ollama (Local) OR OpenAI (Cloud) via Instructor      │
│  - Prompt-Injection Delimiters (<untrusted_syllabus_content>)          │
│  - Deterministic Rule-Based Fallback Parser (5 Canonical Tiers)        │
└───────────────────────────────────┬────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: CANONICAL HIERARCHY                        │
│  - Academic Year = ceil(Semester / 2) integer arithmetic inference     │
│  - Contextual Lab Detection (is_lab) & Elective Detection              │
│  - Module Contact-Hour Parsing & Grounding Verification                │
└───────────────────────────────────┬────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│               LAYER 4: ELECTIVE ONBOARDING & CLIENT                    │
│  - Review Endpoint (GET /api/syllabus/{id}/review)                     │
│  - Interactive Elective Confirmation Modal                             │
│  - Atomic Finalization (POST /api/syllabus/{id}/finalize-enrollment)   │
│  - Historical Completion Preservation on Re-Enrollment                 │
└───────────────────────────────────┬────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│                 LAYER 5: PROGRESS & PERSISTENCE                        │
│  - SQLite in WAL Mode with Foreign Keys Enabled                        │
│  - Leaf-Only Persistence (UNIQUE(syllabus_id, leaf_id))                │
│  - Study Activity Event Log (study_activity_events)                    │
│  - SM-2 Spaced Repetition Revision Records (topic_revision_records)    │
│  - Dynamic Bottom-Up Progress & Multi-Level Analytics Derivation       │
└───────────────────────────────────┬────────────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│                 LAYER 6: CROSS-PLATFORM DELIVERY                       │
│  - Web Client (Desktop / Mobile responsive: 360px–2560px)              │
│  - Installable PWA with Service Worker & IndexedDB Offline Outbox      │
│  - Capacitor Native Mobile Packaging (Android APK & iOS App)           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack & Verified Configuration

- **Backend**: Python 3.12, FastAPI, Starlette, SQLModel / SQLAlchemy 2.0, SQLite (WAL mode, foreign keys enabled), Pydantic v2, `pydantic-settings`
- **Document Processing**: `pypdf`, `python-docx`, Headless LibreOffice (optional `.doc`), Docling (optional scanned fallback), BeautifulSoup4 (Web Ingestion)
- **AI Extraction Providers**:
  - **Local**: Ollama via OpenAI-compatible endpoint (`llama3.1:8b`, `qwen2.5:7b`) with Instructor
  - **Cloud**: OpenAI-compatible API (`gpt-4o-mini`, etc.) with Instructor
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, `@radix-ui/react-checkbox`, Lucide React
- **Mobile Runtime**: Capacitor 7 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/network`, `@capacitor/android`, `@capacitor/ios`)
- **Offline Storage**: IndexedDB (`idb` wrapper, `syllabus_tracker_offline_v1` database)
- **Testing**: Pytest, pytest-asyncio, Vitest, React Testing Library

### Enforced Operational Limits

| Parameter | Default Value | Notes |
|---|---|---|
| `MAX_UPLOAD_SIZE_MB` | `50` (52,428,800 bytes) | Enforced on client and server |
| `MAX_PDF_PAGES` | `1000` | Verified on PDF page count before parsing |
| `MAX_EXTRACTED_TEXT_CHARS` | `1500000` | Bounded text extraction reading |
| `EXTRACTION_TIMEOUT_SECONDS` | `180` | Extraction runtime limit |
| `EXTRACTION_MAX_RETRIES` | `3` | Bounded LLM retry budget |
| `ENABLE_DOCLING_FALLBACK` | `False` | Opt-in to prevent PyTorch memory exhaustion |

---

## ⚡ Global CLI Launcher (`syllabus`) [Recommended]

Syllabus Tracker includes a **Windows Global CLI** with automatic process supervision, job tracking, and non-destructive port conflict management.

### Installation (One-Time Setup)

Run from PowerShell inside the repository:

```powershell
.\scripts\setup-global-cli.ps1
```

This registers `syllabus` in your User PATH without Administrator privileges.

### Usage From Any Directory

```powershell
syllabus                     # Starts backend, frontend & Ollama, opens browser
syllabus status              # Inspects health, process PIDs, and ports
syllabus logs backend -f     # Follow backend Uvicorn logs live
syllabus stop                # Cleanly terminates managed services
syllabus restart             # Restarts managed services
syllabus help                # Displays full options & configuration paths
```

---

## 📱 Mobile & Native Packaging (Capacitor)

The application utilizes a **shared-codebase architecture**: 100% of the UI, state, offline storage, and academic logic resides in the React 19 / TypeScript / Vite frontend. For native mobile platforms, Capacitor 7 wraps this web application inside a lightweight native WebView (Android WebView and iOS WKWebView) without duplicating code.

### Platform Architecture & Delivery Targets

1. **Responsive Web Application**: Accessible from any modern desktop, tablet, or mobile browser (360px–2560px viewports).
2. **Installable PWA**: Installable via browser prompts with offline Service Worker asset caching and IndexedDB local mutation persistence.
3. **Capacitor Native Mobile App**: Packaged Android (`.apk` / `.aab`) and iOS (`.ipa`) applications with theme-aware status bar synchronization and native hardware back-button handling.

### Environment Configuration (`frontend/.env.example`)

Native mobile applications execute within an isolated local WebView origin (`https://localhost` or `capacitor://localhost`). Because relative paths like `/api` cannot be resolved locally without a proxy, native builds require the backend base URL to be configured at build time:

```bash
# Web / PWA development with local Vite proxy (defaults to '/api' if omitted):
# VITE_API_BASE_URL=

# Android Emulator host loopback:
VITE_API_BASE_URL=http://10.0.2.2:8000/api

# iOS Simulator / Local machine:
VITE_API_BASE_URL=http://127.0.0.1:8000/api

# Physical device on local Wi-Fi:
VITE_API_BASE_URL=http://192.168.1.100:8000/api

# Production / Staging deployment:
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

> **Note**: In native mobile environments, `VITE_API_BASE_URL` is baked into frontend bundle assets during `npm run build`. Set the variable before running native build or sync commands.

### Capacitor Commands (`frontend/package.json`)

| Command | Purpose |
|---|---|
| `npm run cap:sync` | Builds the Vite production bundle (`npm run build`) and synchronizes web assets and plugins to both `frontend/android` and `frontend/ios`. |
| `npm run cap:android` | Builds Vite assets, synchronizes the Android platform, and opens the native project in Android Studio. |
| `npm run cap:ios` | Builds Vite assets, synchronizes the iOS platform, and opens the native Xcode workspace. |

### Platform Prerequisites

- **Node.js** (v18+) & **npm**
- **Android Platform**:
  - Android Studio (Jellyfish or newer recommended)
  - Android SDK (API Level 34+ target)
  - Java Development Kit (JDK 17 or JDK 21)
- **iOS Platform**:
  - **macOS** with **Xcode 15+** installed
  - CocoaPods (`pod install`)
  - Valid Apple Developer provisioning profile for physical device signing
  - *Note: While iOS scaffolding is maintained in the repository, native iOS binaries cannot be compiled on Windows.*

### Native Bridge Capabilities

- **Theme-Aware Status Bar Sync**: Automatically synchronizes the native system status bar with the active application theme (`#09090B` deep zinc background with light text in dark mode; `#FAFAFA` soft neutral background with dark text in light mode; Android background guarded).
- **Android Hardware Back-Button Handling**: Intercepts native back-button presses through an overlay priority hierarchy:
  $$\text{Command Palette} \longrightarrow \text{Confirm Delete} \longrightarrow \text{Topic Notes Drawer} \longrightarrow \text{Resources Modal} \longrightarrow \text{Upload Modal} \longrightarrow \text{Elective Modal} \longrightarrow \text{Mobile Sidebar} \longrightarrow \text{Default Back / Exit}$$

---

## 🚀 Manual Windows PowerShell Launch (Alternative)

### 1. Prerequisites
- **Python 3.11+** (virtual environment in `backend/venv`)
- **Node.js (v18+) & npm**
- **Ollama** running locally (if using `EXTRACTION_PROVIDER=ollama`):
  ```powershell
  ollama serve
  ollama pull llama3.1:8b
  ```

### 2. Launch Backend Server

```powershell
# Development mode (reload watcher scoped strictly to backend/app):
.\start-backend.ps1 -Mode Development

# Or directly with Uvicorn:
$env:PYTHONPATH="."
.\backend\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

- API Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- API Readiness Check: [http://127.0.0.1:8000/ready](http://127.0.0.1:8000/ready)
- Swagger Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 3. Launch Frontend Client

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Navigate to [http://localhost:5173](http://localhost:5173).

---

## 📱 Mobile Production Release & Distribution

### 1. Android Release APK & Play Store AAB (Windows 11)

#### Step 1: Configure Production Endpoint & Synchronize
Ensure `VITE_API_BASE_URL` points to your HTTPS production or LAN backend URL before building the bundle (never bundle localhost `127.0.0.1` for physical mobile devices):
```powershell
cd frontend
$env:VITE_API_BASE_URL="https://your-api-domain.com/api"
npm run cap:sync
```

#### Step 2: Generate a Release Signing Keystore (One-Time Setup)
Keep your keystore strictly outside the repository (verified by root and frontend `.gitignore` which exclude `*.jks` and `*.keystore`):
```powershell
keytool -genkey -v -keystore "$env:USERPROFILE\syllabus-release-key.jks" -keyalg RSA -keysize 2048 -validity 10000 -alias syllabus-key
```

#### Step 3: Compile Release APK & Android App Bundle (AAB)
Using the Gradle wrapper with Android Studio's bundled JDK or system Java:
```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
cd frontend\android
.\gradlew.bat assembleRelease
.\gradlew.bat bundleRelease
```

**Compilation Outputs:**
- **Unsigned Release APK**: `frontend\android\app\build\outputs\apk\release\app-release-unsigned.apk`
- **Release App Bundle (AAB)**: `frontend\android\app\build\outputs\bundle\release\app-release.aab`

#### Step 4: Visual Code Signing via Android Studio
```powershell
cd frontend
npm run cap:android
```
1. In Android Studio, select **Build** → **Generate Signed Bundle / APK**.
2. Choose **Android App Bundle** (Google Play Store) or **APK** (direct sideload / enterprise).
3. Point to `$env:USERPROFILE\syllabus-release-key.jks` and key alias `syllabus-key`.
4. Build the signed release artifact with V1/V2 signatures and SHA-256 checksum verification.

---

### 2. iOS Release IPA (Requires macOS + Xcode)

Native iOS compilation and code signing cannot execute on Windows and must be run on a macOS build host with Xcode and CocoaPods installed:

```bash
cd frontend
VITE_API_BASE_URL="https://your-api-domain.com/api" npm run cap:ios
```

**In Xcode:**
1. Select **Any iOS Device (arm64)** as the active build target.
2. Configure **Signing & Capabilities** (Developer Team, Bundle ID `com.syllabustracker.app`, App Transport Security HTTPS rules).
3. Select **Product** → **Archive**.
4. In the Xcode Organizer window, click **Distribute App** to export the signed `.ipa` or upload to TestFlight / App Store Connect.


---

## 📋 Canonical API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` / `/api/health` | Application liveness, database status, and active extraction provider diagnostics |
| `GET` | `/ready` / `/api/ready` | Readiness check verifying active database ping (`SELECT 1`) |
| `GET` | `/api/config` | Safe configuration metadata (allowed formats, upload limits) |
| `GET` | `/api/syllabi` | List all saved syllabi and progress totals |
| `POST` | `/api/upload` | Multipart upload returning 202 Accepted with `job_id` |
| `GET` | `/api/upload/progress/{id}` | Real-time Server-Sent Events (SSE) progress stream (0–100%) |
| `GET` | `/api/upload/jobs/{id}` | Polling fallback for upload job progress snapshot |
| `POST` | `/api/upload/jobs/{id}/cancel` | Explicit cancellation of in-progress syllabus ingestion |
| `GET` | `/api/syllabus/{id}/review` | Pre-enrollment review returning detected electives and confirmation status |
| `POST` | `/api/syllabus/{id}/finalize-enrollment` | Atomic idempotent confirmation of elective choices |
| `POST` | `/api/syllabus/{id}/update-enrollment` | Dynamic reconfiguration of elective enrollment during semester cycles |
| `GET` | `/api/syllabus/{id}` | Canonical 5-tier hierarchy, enrolled completed leaves, and derived progress |
| `PATCH` | `/api/syllabus/{id}/toggle-leaf` | Idempotently toggle an individual subtopic leaf |
| `PATCH` | `/api/syllabus/{id}/bulk-toggle` | Atomically toggle enrolled descendant leaves under any branch |
| `PATCH` | `/api/syllabus/{id}` | Rename syllabus title |
| `DELETE` | `/api/syllabus/{id}` | Atomically delete syllabus, nodes, and completion records |
| `GET` | `/api/syllabus/{id}/pacing` | Retrieve study pacing metrics, target deadlines, and completion forecasts |
| `POST` | `/api/syllabus/{id}/deadline` | Set or update a target completion deadline for a module or subject |
| `DELETE` | `/api/syllabus/{id}/deadline/{node_id}` | Remove a target completion deadline from a module or subject |
| `GET` | `/api/syllabus/{id}/notes` | Retrieve all notes across subtopics for a syllabus |
| `GET` | `/api/syllabus/{id}/notes/{leaf_id}` | Retrieve personal markdown note for a specific subtopic |
| `PUT` | `/api/syllabus/{id}/notes` | Upsert personal markdown note for a specific subtopic |
| `DELETE` | `/api/syllabus/{id}/notes/{leaf_id}` | Delete personal note for a specific subtopic |
| `GET` | `/api/syllabus/{id}/resources` | Retrieve curated study resources and bookmarks for a syllabus |
| `POST` | `/api/syllabus/{id}/resources` | Add a study resource (URL, title, type) to a topic or module |
| `DELETE` | `/api/syllabus/{id}/resources/{resource_id}` | Delete a study resource |
| `GET` | `/api/syllabus/{id}/export/markdown` | Export syllabus checklist with notes and resources in Markdown |
| `GET` | `/api/syllabus/{id}/export/json` | Export syllabus hierarchy and completion records in JSON |
| `GET` | `/api/syllabus/{id}/export/html` | Export self-contained, printable HTML checklist with embedded styles |
| `POST` | `/api/syllabus/restore-backup` | Restore syllabus from JSON backup payload (`clone` or `merge` mode) |
| `POST` | `/api/scrape/preview` | Preview web URL content and discover downloadable syllabus documents |
| `POST` | `/api/scrape/ingest` | Ingest web syllabus content or direct document into ingestion pipeline |
| `GET` | `/api/syllabus/{id}/analytics` | Retrieve study analytics (14-day velocity, study streaks, exam risk forecast) |
| `GET` | `/api/syllabus/{id}/revisions/due` | Retrieve subtopics currently due for revision under SM-2 schedule |
| `POST` | `/api/syllabus/{id}/revisions/{leaf_id}/review` | Record SM-2 review rating (`1` Again, `2` Hard, `3` Good, `4` Easy) |

---

## 🧪 Automated Verification & Testing

The repository maintains continuous automated test coverage across all architectural layers:

### Backend Test Suite (Pytest)
```powershell
$env:PYTHONPATH="."
.\backend\venv\Scripts\python.exe -m pytest backend/tests -v
```
**Verified Baseline: 182 passed, 0 failed (100% pass rate).**

### Frontend Test Suite (Vitest) & Build Check
```powershell
cd frontend
npm test -- --run
npm run typecheck
npm run build
```
**Verified Baseline: 123 passed across 17 test files (100% pass rate); 0 TypeScript errors; clean production build.**

---

## 📄 License
This project is licensed under the MIT License.
