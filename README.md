# 📚 Hierarchical Syllabus Checklist & Progress Tracker

A privacy-focused, local-first web application that converts academic syllabus documents (`.pdf`, `.docx`, `.txt`) into an interactive, multi-tiered curriculum checklist with automatic cascading completion, source evidence verification, and real-time progress analytics.

---

## 🌟 Key Features

- **Document Ingestion**: Accepts academic syllabi in `.pdf`, `.docx`, and `.txt` formats, preserving layout structure, headings, and tables.
- **Strict 5-Level Hierarchy**:
  $$\text{Degree/Program} \longrightarrow \text{Academic Year} \longrightarrow \text{Semester} \longrightarrow \text{Topic/Course} \longrightarrow \text{Subtopic Leaf}$$
- **Grounded AI Extraction**: Uses local LLMs (via Ollama + Instructor) strictly bounded by prompt boundaries to prevent hallucinations and invent zero curriculum.
- **Evidence Traceability**: Every leaf subtopic preserves exact verbatim excerpts (`source_text`) and 1-based page citations (`source_page`) from the source document.
- **Cascading Tri-State Checkboxes**:
  - `☑ Checked`: 100% of child subtopics are completed.
  - `◐ Indeterminate`: Some child subtopics are completed.
  - `☐ Unchecked`: 0 child subtopics are completed.
- **Leaf-Only Persistence**: Only leaf subtopic states are stored in SQLite; parent progress and states are derived dynamically to eliminate synchronization drift.
- **Dynamic Multi-Level Analytics**: Real-time percentage and fractional tracking at the Topic, Semester, Year, and overall Program levels.
- **100% Local & Private**: Runs entirely on your local machine using local LLM inference—no data leaves your host.

---

## 🏗️ Architecture Overview

```text
[Uploaded Document: PDF / DOCX / TXT]
│
▼
┌────────────────────────────────────────────────────────┐
│               LAYER 1: INGESTION SERVICE               │
│  - Secure Temp Storage & Validation (Max 20 MiB)       │
│  - Docling Parser & PyPDF/python-docx Fallbacks        │
└───────────────────────────┬────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────┐
│            LAYER 2: STRUCTURE REASONING                │
│  - Instructor + Pydantic Schema Validation             │
│  - Local LLM via Ollama (qwen2.5:7b / llama3.1:8b)     │
│  - Prompt-injection containment delimiters             │
└───────────────────────────┬────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────┐
│             LAYER 3: CANONICAL JSON TREE               │
│  - Year = ceil(Semester / 2) derivation               │
│  - Grounding verification & ID deduplication           │
└───────────────────────────┬────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────┐
│          LAYER 4: CLIENT & PROGRESS ENGINE             │
│  - SQLite persistence in WAL mode                      │
│  - React 19 + TypeScript + Radix Tri-State Checkboxes  │
│  - Dynamic bottom-up progress calculation              │
└────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 / SQLite (WAL mode), Pydantic v2
- **Document Processing**: Docling, PyPDF, `python-docx`
- **Structured LLM Extraction**: Instructor, Ollama (`qwen2.5:7b` / `llama3.1:8b`)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, `@radix-ui/react-checkbox`, Lucide React
- **Testing**: Pytest, HTTPX, Vitest, React Testing Library

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.11+** (Python 3.12 recommended)
- **Node.js (v18+) & npm**
- **[Ollama](https://ollama.com/)** running locally:
  ```bash
  ollama serve
  ollama pull qwen2.5:7b
  # or alternative
  ollama pull llama3.1:8b
  ```

### 2. Backend Setup
1. Open a terminal in the project root:
   ```bash
   cd Syllabus_Tracker
   ```
2. Activate the virtual environment:
   - On Windows (PowerShell):
     ```powershell
     backend\venv\Scripts\Activate.ps1
     ```
   - On macOS/Linux:
     ```bash
     source backend/venv/bin/activate
     ```
3. Install backend dependencies (if setting up on a new environment):
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Start the backend server:
   ```bash
   uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   API health check available at [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) and Swagger documentation at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 3. Frontend Setup
1. Open a second terminal in the project root:
   ```bash
   cd Syllabus_Tracker/frontend
   ```
2. Install dependencies (if setting up on a new environment):
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   [http://localhost:5173](http://localhost:5173)

---

## 📋 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health probe (database & Ollama diagnostics) |
| `GET` | `/api/syllabi` | List all uploaded syllabi and aggregate progress |
| `POST` | `/api/upload` | Ingest syllabus document, extract hierarchy, and persist |
| `GET` | `/api/syllabus/{id}` | Fetch full hierarchy, progress stats, and completed leaves |
| `PATCH` | `/api/syllabus/{id}/toggle-leaf` | Idempotently toggle single subtopic leaf state |
| `PATCH` | `/api/syllabus/{id}/bulk-toggle` | Bulk toggle descendant leaves under any branch |
| `PATCH` | `/api/syllabus/{id}` | Rename syllabus title |
| `DELETE` | `/api/syllabus/{id}` | Cascade delete syllabus and its completion records |

---

## 🔒 Security & Privacy

1. **Local Inference**: All document parsing and LLM operations remain strictly local (`127.0.0.1`); zero telemetry or external API calls.
2. **Prompt Injection Defense**: Raw text is encapsulated in `<UNTRUSTED_DOCUMENT_CONTENT>` tags, and the LLM extraction system prompt strictly ignores any embedded directives.
3. **Upload Hardening**: Enforces upload size limits (20 MiB max) and isolates temporary files with guaranteed cleanup on completion or failure.
4. **Deterministic Validation**: All extracted subtopics are verified for non-empty source evidence and grounded in normalized source text.

---

## 📄 License
This project is licensed under the MIT License.
