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
- [x] Document parser in `backend/app/parser.py` supporting PDF, DOCX, TXT, and legacy DOC with upload size validation (20 MiB max) and secure isolated temp directory cleanup (`mkdtemp` + `rmtree`).
- [x] Legacy `.doc` support using headless LibreOffice (`soffice`) conversion with execution timeouts and graceful diagnostics when LibreOffice is not installed.
- [x] Docling parser integration with robust PyPDF and python-docx offline fallbacks.
- [x] Structured LLM curriculum extractor in `backend/app/extractor.py` using Instructor and local Ollama.
- [x] Prompt injection boundaries (`<UNTRUSTED_DOCUMENT_CONTENT>`) and heuristic outline fallback parser.
- [x] Grounding validation, verifiable source evidence matching, and `evidence_status` (`verified` | `needs_review`) tracking in `backend/app/validation.py`.
- [x] Pipeline coordinator in `backend/app/services/ingestion.py`.

### Phase 4: Progress Engine & REST API [COMPLETED]
- [x] Pure progress calculation engine in `backend/app/progress.py` (`completed_leaves / total_leaves * 100%`).
- [x] Dynamic tri-state parent derivation (checked, unchecked, indeterminate).
- [x] FastAPI application in `backend/app/main.py` implementing `/api/health`, `/api/syllabi`, `/api/upload`, `/api/syllabus/{id}`, `/api/syllabus/{id}/toggle-leaf`, `/api/syllabus/{id}/bulk-toggle` (supporting both `node_id` and explicit `leaf_ids`), and `/api/syllabus/{id}`.
- [x] Schema extensions in `backend/app/schemas.py` including `evidence_status` and `source_document_id`.
- [x] CORS middleware and domain exception handlers.
- [x] Verified clean Python byte compilation via `python -m compileall backend/app`.

### Phase 5: React / TypeScript Frontend [COMPLETED]
- [x] Canonical TypeScript interfaces in `frontend/src/types/syllabus.ts` (with `Year` alias, `evidence_status`, and `source_document_id`).
- [x] Pure progress helper library in `frontend/src/lib/progress.ts`.
- [x] Typed HTTP client in `frontend/src/lib/api.ts`.
- [x] Custom hook `frontend/src/hooks/useSyllabus.ts` managing syllabus state, mutations, and Ollama diagnostics.
- [x] Components:
  - `FileUpload.tsx`: Drag-and-drop syllabus upload with size and format checks (PDF, DOCX, DOC, TXT).
  - `SyllabusTree.tsx`: Recursive 5-level tree with Radix UI tri-state checkboxes and accessible disclosures.
  - `ProgressBar.tsx`: Global and per-node progress indicators.
  - `SourceEvidence.tsx`: Grounding modal displaying verbatim document evidence, page, location, and verified/needs-review status badge.
  - `ErrorMessage.tsx`: Dismissible error notifications.
  - `App.tsx`: Header, Ollama badge, sidebar, title rename, and delete dialog.
- [x] Clean TypeScript typecheck (`npm run typecheck`) and production build verified (`npm run build`).

### Current Repository Status
- Codebase complete, verified, and synced to remote: `https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist`.