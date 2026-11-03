# 📚 Hierarchical Syllabus Checklist & Progress Tracker
## Production-Grade 5-Tier Curriculum Architecture, Deterministic Extraction, Elective Enrollment, Historical Progress Preservation, Contextual Lab Handling, Contact-Hour Metadata, and Hot-Switchable Dual-Provider AI Engine

A local-first, privacy-respecting, production-grade application that ingests academic syllabus documents (`.pdf`, `.docx`, `.doc`, `.txt`) into an interactive, five-tiered curriculum checklist with automatic cascading completion, source evidence verification, elective enrollment onboarding, and real-time progress analytics.

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
- **Operational Health Endpoints**: `/health` (liveness probe with active provider and model diagnostics) and `/ready` (readiness probe verifying database connectivity without exposing secrets).

---

## 🏗️ Architecture Overview

```text
[Uploaded Document: PDF / DOCX / DOC / TXT]
│
▼
┌────────────────────────────────────────────────────────────────────────┐
│                      LAYER 1: INGESTION SERVICE                        │
│  - Secure Temp Storage & Validation (50 MiB, 1000 pgs)                 │
│  - Fast-Path Parsers: pypdf, python-docx, LibreOffice                  │
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
│  - Academic Year = ceil(Semester / 2) inference                        │
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
│  - Enrolled-Course Filtering in Tri-State Checkboxes                   │
│  - Dynamic Bottom-Up Progress Derivation                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack & Verified Configuration

- **Backend**: Python 3.12, FastAPI, SQLModel / SQLAlchemy 2.0, SQLite (WAL mode, foreign keys enabled), Pydantic v2, `pydantic-settings`
- **Document Processing**: `pypdf`, `python-docx`, Headless LibreOffice (optional `.doc`), Docling (optional scanned fallback)
- **AI Extraction Providers**:
  - **Local**: Ollama via OpenAI-compatible endpoint (`llama3.1:8b`, `qwen2.5:7b`) with Instructor
  - **Cloud**: OpenAI-compatible API (`gpt-4o-mini`, etc.) with Instructor
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, `@radix-ui/react-checkbox`, Lucide React
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

---

## 🧪 Automated Verification & Testing

### Backend Test Suite (Pytest)
```powershell
$env:PYTHONPATH="."
.\backend\venv\Scripts\python.exe -m pytest backend/tests -v
```
**Result: 102 passed, 0 failed in 13.36s (100% pass rate).**

### Frontend Test Suite (Vitest) & Build Check
```powershell
cd frontend
npm test -- --run
npm run typecheck
npm run build
```
**Result: 26 passed across 5 test files in 7.10s; 0 TypeScript errors; clean production build in 1.92s.**

---

## 📄 License
This project is licensed under the MIT License.
