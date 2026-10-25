# 📚 Hierarchical Syllabus Checklist & Progress Tracker

A privacy-focused, local-first web application that converts unstructured syllabus documents (`.pdf`, `.docx`, `.doc`, `.txt`) into an interactive, multi-tiered curriculum checklist with automatic cascading completion and real-time progress analytics.

---

## 🌟 Key Features

- **Document Ingestion**: Accepts academic syllabi in `.pdf`, `.docx`, `.doc`, and `.txt` formats, preserving layout structure, headings, and markdown tables.
- **Strict 4-Tier Hierarchy**: Organizes curriculum deterministically into:
  $$\text{Program} \longrightarrow \text{Academic Year (Tier 1)} \longrightarrow \text{Semester (Tier 2)} \longrightarrow \text{Course / Topic (Tier 3)} \longrightarrow \text{Subtopic Leaf (Tier 4)}$$
- **Grounded AI Extraction**: Uses local LLMs (via Ollama + Instructor) strictly bounded by prompt constraints to prevent hallucinations and invent zero curriculum.
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

[Uploaded Document: PDF / DOCX / TXT]
│
▼
┌────────────────────────────────────────────────────────┐
│               LAYER 1: INGESTION SERVICE               │
│  - Format Conversion (.doc -> .docx via LibreOffice)   │
│  - Docling Parser (Native layout & table extraction)   │
└───────────────────────────┬────────────────────────────┘
│
▼
┌────────────────────────────────────────────────────────┐
│            LAYER 2: STRUCTURE REASONING                │
│  - Instructor + Pydantic Schema Validation             │
│  - Local LLM via Ollama (llama3.1:8b / qwen2.5:7b)     │
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
│  - React 18 + TypeScript + Radix Tri-State Checkboxes  │
│  - Dynamic bottom-up progress calculation              │
└────────────────────────────────────────────────────────┘
---

## 🛠️ Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLModel / SQLite (WAL mode), Pydantic v2
- **Document Processing**: [Docling](https://github.com/DS4SD/docling), `python-docx`
- **Structured LLM Extraction**: [Instructor](https://github.com/jxnl/instructor), Ollama (`llama3.1:8b` or `qwen2.5:7b`)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, `@radix-ui/react-checkbox`, Lucide React

---

## 🚀 Getting Started

### Prerequisites

1. **Python 3.11+**
2. **Node.js (v18+) & npm**
3. **[Ollama](https://ollama.com/)** running locally:
   ```bash
   ollama pull llama3.1:8b
   ollama serve
(Optional) LibreOffice (required only if converting legacy .doc files).Installation & Setup1. Clone the RepositoryBashgit clone [https://github.com/your-username/syllabus-tracker.git](https://github.com/your-username/syllabus-tracker.git)
cd syllabus-tracker
2. Backend SetupBashcd backend
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
Start the backend server:Bashuvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
API health check available at http://127.0.0.1:8000/api/health and Swagger UI at http://127.0.0.1:8000/docs.3. Frontend SetupBashcd ../frontend
npm install
npm run dev
Open your browser and navigate to http://localhost:5173.🧪 Running TestsBackend Unit & Integration Tests (Pytest)Bashcd backend
pytest -v
Frontend Tests (Vitest)Bashcd frontend
npm run test
📋 API Endpoints SummaryMethodEndpointDescriptionGET/api/healthHealth probe (database & Ollama connectivity)GET/api/configRead runtime settings (allowed file types, max sizes)GET/api/syllabiList all uploaded syllabi and aggregate progressPOST/api/uploadIngest syllabus document, run extraction, and persistGET/api/syllabus/{id}Fetch full hierarchy, progress stats, and completed leavesPATCH/api/syllabus/{id}/toggle-leafToggle single subtopic leaf statePATCH/api/syllabus/{id}/bulk-toggleBulk toggle descendant leaves under a branchDELETE/api/syllabus/{id}Cascade delete syllabus and its completion records🔒 Security & PrivacyLocal Inference: All document parsing and LLM operations remain strictly local (127.0.0.1); zero telemetry or cloud API calls.Prompt Injection Defense: Raw text is encapsulated in <untrusted_syllabus_content> tags, and the LLM extraction system prompt strictly ignores any embedded directives.Upload Hardening: Enforces upload size limits and isolates temporary files with guaranteed cleanup on completion or failure.📄 LicenseThis project is licensed under the MIT License.
