# Local-First Hierarchical Syllabus Checklist & Progress Tracker

A production-grade, local-first academic curriculum tracking application that ingests academic syllabi (PDF, DOCX, TXT), extracts their hierarchical curriculum structure with verifiable source references, persists the canonical curriculum in SQLite, and provides an interactive cascading checklist with real-time progress calculations at every hierarchy level.

---

## 1. Domain Taxonomy & Hierarchy

The application enforces a strict, canonical 5-level hierarchy across the data model, database persistence, REST API, and user interface:

$$\text{Degree/Program} \longrightarrow \text{Academic Year} \longrightarrow \text{Semester} \longrightarrow \text{Topic/Course} \longrightarrow \text{Subtopic}$$

- **Degree/Program**: Root syllabus entity.
- **Academic Year**: Academic annual grouping (e.g., Year 1, Year 2).
- **Semester**: Academic semester term (e.g., Semester 1, Semester 2).
- **Topic/Course**: Course, subject, unit, or module within a semester.
- **Subtopic**: The granular leaf concept or lecture item that can be independently checked off.

### Single Source of Truth for Progress
- Only leaf subtopic IDs are persisted in SQLite (`leaf_completions` table).
- Parent branch states (checked, unchecked, indeterminate) are dynamically and deterministically derived.
- Toggling a branch cascades to all its descendant leaves atomically and idempotently.
- Progress percentage:
  $$\text{Progress} = \frac{\text{Completed Descendant Leaves}}{\text{Total Descendant Leaves}} \times 100\%$$

---

## 2. Technology Stack

- **Backend**:
  - Python 3.12, FastAPI, Uvicorn
  - Pydantic v2 (strict validation and canonical schemas)
  - SQLAlchemy 2.0 with SQLite (WAL mode, busy timeout, foreign-key cascade enforcement)
  - Document conversion via Docling with robust PyPDF and python-docx offline fallback
  - Structured LLM extraction via Instructor & local Ollama (OpenAI-compatible)
  - Pytest and HTTPX test suite
- **Frontend**:
  - React 19, TypeScript (strict mode, verbatim module syntax)
  - Vite, Tailwind CSS v4
  - Radix UI Checkbox (`@radix-ui/react-checkbox` for tri-state branch checkboxes)
  - Lucide React icons
  - Vitest and React Testing Library

---

## 3. Local LLM Runtime (Ollama) Setup

The application is completely local-first and never sends document contents or syllabus excerpts to external cloud LLM APIs.

### Setup Instructions:
1. Install [Ollama](https://ollama.com/) on your system.
2. Start the local Ollama background daemon:
   ```bash
   ollama serve
   ```
3. Pull your preferred local model (Qwen 2.5 or Llama 3.1):
   ```bash
   ollama pull qwen2.5:7b
   # or alternative
   ollama pull llama3.1:8b
   ```
4. Verify local connectivity:
   ```bash
   curl http://127.0.0.1:11434/api/tags
   ```

*Note: If Ollama is offline or the model is not installed yet, the application gracefully provides deterministic outline extraction fallback and displays the status badge in the UI.*

---

## 4. Getting Started & Startup Instructions

### 4.1 Backend Startup

1. Open a terminal in the project root:
   ```bash
   cd Syllabus_Tracker
   ```
2. Activate the Python virtual environment:
   - On Windows (PowerShell):
     ```powershell
     backend\venv\Scripts\Activate.ps1
     ```
   - On Windows (CMD):
     ```cmd
     backend\venv\Scripts\activate.bat
     ```
   - On macOS/Linux:
     ```bash
     source backend/venv/bin/activate
     ```
3. (If initializing on a new machine) Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Start the FastAPI backend server:
   ```bash
   uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
   ```
5. Check backend health in your browser:
   [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 4.2 Frontend Startup

1. Open a second terminal in the project root:
   ```bash
   cd Syllabus_Tracker/frontend
   ```
2. (If initializing on a new machine) Install frontend dependencies:
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

## 5. SQLite Database & Persistence

- **Default Location**: `backend/syllabus_tracker.db` (or `./syllabus_tracker.db` in the working directory).
- **WAL Mode**: Write-Ahead Logging is automatically enabled (`PRAGMA journal_mode=WAL`) for high concurrency and resilience.
- **Foreign Keys**: Enforced on every connection (`PRAGMA foreign_keys=ON`).
- **Backup**: Simply copy the `syllabus_tracker.db` file when the application is stopped to create a clean, portable snapshot.

---

## 6. Verification and Test Suite

To run tests when requested:

- **Backend Pytest Suite**:
  ```bash
  backend\venv\Scripts\python -m pytest -v
  ```
- **Frontend Build**:
  ```bash
  cd frontend
  npm run build
  ```
- **Frontend Vitest Suite**:
  ```bash
  cd frontend
  npm run test
  ```

---

## 7. Security and Safety Safeguards

1. **Prompt Injection Boundaries**: Document content passed to LLMs is wrapped within untrusted boundaries (`<UNTRUSTED_DOCUMENT_CONTENT> ... </UNTRUSTED_DOCUMENT_CONTENT>`), with instructions forbidding execution of embedded commands.
2. **Grounding Verification**: Extracted snippets are verified against normalized document text before acceptance.
3. **Upload Security**: 20 MiB size limit, extension checks, secure temporary file creation, and guaranteed temporary file deletion in `finally` blocks.
4. **Idempotent Mutations**: Checklist updates never use blind toggles. Explicit target states ensure consistency under race conditions.
