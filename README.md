# 📚 Hierarchical Syllabus Checklist & Progress Tracker

A privacy-focused, production-minded, local-first application that ingests academic syllabus documents (`.pdf`, `.docx`, `.doc`, `.txt`) into an interactive, multi-tiered curriculum checklist with automatic cascading completion, source evidence verification, and real-time progress analytics.

---

## 🌟 Key Features

- **Multi-Format Ingestion**: Accepts academic syllabi in `.pdf`, `.docx`, `.doc`, and `.txt` formats with fast-path parsing (`pypdf`, `python-docx`) and headless LibreOffice conversion for legacy `.doc`.
- **Strict 4-Tier Academic Hierarchy**:
  $$\text{Degree/Program (Root Container)} \longrightarrow \text{Academic Year (Tier 1)} \longrightarrow \text{Semester (Tier 2)} \longrightarrow \text{Course/Topic/Unit (Tier 3)} \longrightarrow \text{Subtopic Leaf (Tier 4)}$$
- **Grounded AI Extraction**: Uses local LLMs (via Ollama + Instructor) strictly bounded by prompt boundaries (`<untrusted_syllabus_content>`) to prevent hallucinations and invent zero curriculum.
- **Evidence Traceability**: Every leaf subtopic preserves exact verbatim excerpts (`source_text`), 1-based physical page citations (`source_page`), and grounding status (`verified`, `needs_review`, `unverified`).
- **Cascading Tri-State Checkboxes**:
  - `☑ Checked`: 100% of descendant subtopic leaves are completed.
  - `◐ Indeterminate`: Some descendant leaves are completed.
  - `☐ Unchecked`: 0 descendant leaves are completed.
- **Leaf-Only Persistence**: Only valid Tier 4 leaf completion records are persisted in SQLite; all parent checkbox states and progress metrics are derived dynamically.
- **Dynamic Multi-Level Analytics**: Real-time percentage and fractional tracking at Topic, Semester, Year, and overall Program levels.
- **Windows 11 Reliability**:
  - Lightweight parsing by default: avoids heavy PyTorch/Docling initialization to permanently eliminate `[WinError 1450]`.
  - Scoped development file watcher (`--reload-dir backend/app`) preventing virtual environment or temporary file scan storms.
  - Request timeouts, client-side abort controls, bounded concurrency semaphore, and atomic transactional rollback.
- **100% Local & Private**: Operates entirely offline—no data ever leaves your host.

---

## 🏗️ Architecture Overview

```text
[Uploaded Document: PDF / DOCX / DOC / TXT]
│
▼
┌────────────────────────────────────────────────────────┐
│               LAYER 1: INGESTION SERVICE               │
│  - Secure Temp Storage & Validation (50 MiB, 300 pgs)  │
│  - Fast-Path Parsers: pypdf, python-docx, LibreOffice  │
│  - Opt-in Docling Fallback (ENABLE_DOCLING_FALLBACK)   │
└───────────────────────────┬────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────┐
│            LAYER 2: STRUCTURE REASONING                │
│  - Instructor + Pydantic v2 Schema Validation          │
│  - Local LLM via Ollama (llama3.1:8b / qwen2.5:7b)     │
│  - Prompt-injection containment delimiters             │
│  - Deterministic heuristic outline fallback parser     │
└───────────────────────────┬────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────┐
│             LAYER 3: CANONICAL HIERARCHY               │
│  - Academic Year = (Semester + 1) // 2 inference       │
│  - Grounding verification & stable ID generation       │
│  - Subtopic evidence & physical page mapping           │
└───────────────────────────┬────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────┐
│          LAYER 4: CLIENT & PROGRESS ENGINE             │
│  - SQLite persistence in WAL mode (foreign_keys = ON)  │
│  - React 19 + TypeScript + Radix Tri-State Checkboxes  │
│  - Dynamic bottom-up progress calculation              │
│  - Leaf-only completion persistence & cascade deletion │
└────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack & Verified Configuration

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 / SQLite (WAL mode, foreign keys enabled), Pydantic v2, `pydantic-settings`
- **Document Processing**: `pypdf`, `python-docx`, Headless LibreOffice (optional `.doc`), Docling (optional fallback)
- **Local Structured LLM**: Instructor, Ollama (`llama3.1:8b` default, `qwen2.5:7b` fallback)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, `@radix-ui/react-checkbox`, Lucide React
- **Testing**: Pytest, pytest-asyncio, Vitest, React Testing Library

### Enforced Operational Limits

| Parameter | Default Value | Notes |
|---|---|---|
| `MAX_UPLOAD_SIZE_BYTES` | `52428800` (50 MiB) | Enforced on client and server |
| `MAX_PDF_PAGES` | `300` | Verified on PDF page count before parsing |
| `MAX_EXTRACTED_TEXT_CHARS` | `1500000` | Bounded input reading |
| `PARSER_TIMEOUT_SECONDS` | `300` | Maximum parser runtime limit |
| `MAX_CONCURRENT_PARSING_JOBS` | `2` | Bounded concurrency semaphore |
| `ENABLE_DOCLING_FALLBACK` | `False` | Opt-in to prevent PyTorch `WinError 1450` |
| `DOC_CONVERSION_TIMEOUT_SECONDS`| `30` | Subprocess timeout for LibreOffice conversion |

---

## 🚀 Windows PowerShell Launch & Operations

### 1. Prerequisites
- **Python 3.11+** (Python 3.12 installed in `backend/venv`)
- **Node.js (v18+) & npm**
- **[Ollama](https://ollama.com/)** running locally:
  ```powershell
  ollama serve
  ollama pull llama3.1:8b
  ollama pull qwen2.5:7b
  ```
- *(Optional)* **LibreOffice** for legacy `.doc` files (ensure `soffice` is in PATH).

### 2. Launch Backend Server

Run the dedicated PowerShell launcher from the project root:

```powershell
# Development mode (reload watcher scoped strictly to backend/app):
.\start-backend.ps1 -Mode Development

# Stable mode (production/testing without file watcher overhead):
.\start-backend.ps1 -Mode Stable
```

The API health check will be live at [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) and Swagger documentation at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 3. Launch Frontend Client

In a second PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

Navigate to [http://localhost:5173](http://localhost:5173).

---

## 📋 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Application liveness, SQLite readiness, and Ollama diagnostics |
| `GET` | `/api/config` | Safe configuration metadata (allowed formats, upload limits) |
| `GET` | `/api/syllabi` | List all saved syllabi and progress totals |
| `POST` | `/api/upload` | Multipart upload, structure extraction, validation, and atomic commit |
| `GET` | `/api/syllabus/{id}` | Canonical hierarchy, completed leaves, and derived progress |
| `PATCH` | `/api/syllabus/{id}/toggle-leaf` | Idempotently toggle a single subtopic leaf |
| `PATCH` | `/api/syllabus/{id}/bulk-toggle` | Atomically toggle descendant leaves under any branch or explicit IDs |
| `PATCH` | `/api/syllabus/{id}` | Rename syllabus title |
| `DELETE` | `/api/syllabus/{id}` | Atomically delete syllabus, nodes, and completion records |

---

## 🧪 Automated Verification & Testing

### Backend Test Suite
```powershell
.\backend\venv\Scripts\python -m pytest backend/tests -v
```
*Current suite status: 47 passed in 1.53s.*

### Frontend Test Suite & Typecheck
```powershell
npm --prefix frontend run test
npm --prefix frontend run typecheck
npm --prefix frontend run build
```
*Current suite status: 10 passed in 4.17s; clean production build in 1.44s.*

---

## 🛠️ Windows 11 Troubleshooting

- **`WinError 1450` (Insufficient system resources)**: Occurs when PyTorch/Docling vision models are loaded under broad directory file watchers. The application defaults to fast-path `pypdf` (~20ms) and sets `ENABLE_DOCLING_FALLBACK = False`.
- **Port 8000 in use**: The `start-backend.ps1` script performs non-destructive port conflict checks via `Get-NetTCPConnection` to inform you without terminating other processes.
- **Ollama Offline**: The application remains fully functional offline without Ollama; previously saved syllabi, progress calculations, and deterministic outline extractions operate normally.

---

## 📄 License
This project is licensed under the MIT License.

