"""Canonical Pydantic v2 schemas and data contracts."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Subtopic(BaseModel):
    """Leaf checklist item representing a granular course concept or lecture topic."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1, description="Stable unique ID within syllabus")
    title: str = Field(..., min_length=1, description="Non-empty title of subtopic")
    source_text: str = Field(..., min_length=1, description="Verbatim source text snippet")
    source_page: Optional[int] = Field(default=None, description="1-based page number if available")
    source_location: Optional[Union[str, Dict]] = Field(default=None, description="Section, heading, or paragraph location")
    source_document_id: Optional[str] = Field(default=None, description="Reference to ingestion document")
    evidence_status: Literal["verified", "needs_review", "unverified"] = Field(
        default="verified", description="Grounding verification status"
    )
    grounding_status: Optional[str] = Field(
        default=None, description="Grounding verification status alias"
    )
    order_index: int = Field(default=0, ge=0)

    @field_validator("grounding_status", mode="before")
    @classmethod
    def populate_grounding_status(cls, v, info):
        return v

    def model_post_init(self, __context) -> None:
        if self.grounding_status is None:
            self.grounding_status = self.evidence_status
        elif self.evidence_status is None:
            self.evidence_status = self.grounding_status  # type: ignore

    @field_validator("id", "title", "source_text")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only")
        return s

    @field_validator("source_page")
    @classmethod
    def validate_positive_page(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("source_page must be a positive 1-based integer")
        return v


class Module(BaseModel):
    """Module or Unit within a Subject."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    module_number: Optional[str] = Field(default=None)
    title: str = Field(..., min_length=1)
    topics: List[Subtopic] = Field(default_factory=list)
    order_index: int = Field(default=0, ge=0)

    @model_validator(mode="before")
    @classmethod
    def handle_subtopics_alias(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "subtopics" in data and "topics" not in data:
                data["topics"] = data.pop("subtopics")
        return data

    @field_validator("id", "title")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only")
        return s

    @property
    def subtopics(self) -> List[Subtopic]:
        return self.topics


class Subject(BaseModel):
    """Subject or Course within a Semester."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    code: Optional[str] = Field(default=None)
    title: str = Field(..., min_length=1)
    modules: List[Module] = Field(default_factory=list)
    order_index: int = Field(default=0, ge=0)

    @field_validator("id", "title")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only")
        return s


class Topic(Module):
    """Course topic/module representation supporting backward compatibility."""
    pass


class Semester(BaseModel):
    """Semester within an academic year."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    subjects: List[Subject] = Field(default_factory=list)
    order_index: int = Field(default=0, ge=0)

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_topics(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # If subjects already provided, use it
            if "subjects" in data and data["subjects"]:
                return data
            # If legacy topics provided, migrate them into subjects
            if "topics" in data and data["topics"]:
                legacy_topics = data.pop("topics")
                subjects = []
                for idx, t in enumerate(legacy_topics):
                    if isinstance(t, dict):
                        t_id = t.get("id", f"top_{idx}")
                        t_title = t.get("title", f"Subject {idx + 1}")
                        subtopics_raw = t.get("subtopics", t.get("topics", []))
                        mod = Module(
                            id=t_id,
                            module_number=str(idx + 1),
                            title=f"Module: {t_title}",
                            topics=[Subtopic.model_validate(s) if isinstance(s, dict) else s for s in subtopics_raw],
                            order_index=0,
                        )
                        subj = Subject(
                            id=f"{t_id}_subj",
                            title=t_title,
                            modules=[mod],
                            order_index=idx,
                        )
                        subjects.append(subj)
                    elif isinstance(t, Module):
                        subj = Subject(
                            id=f"{t.id}_subj",
                            title=t.title,
                            modules=[t],
                            order_index=idx,
                        )
                        subjects.append(subj)
                data["subjects"] = subjects
        return data

    @field_validator("id", "title")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only")
        return s

    @property
    def topics(self) -> List[Module]:
        return [m for s in self.subjects for m in s.modules]


class AcademicYear(BaseModel):
    """Academic year grouping."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    semesters: List[Semester] = Field(default_factory=list)
    order_index: int = Field(default=0, ge=0)

    @field_validator("id", "title")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only")
        return s


class HierarchicalSyllabus(BaseModel):
    """Root syllabus entity representing a degree, program, or course curriculum."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    years: List[AcademicYear] = Field(default_factory=list)
    content_hash: Optional[str] = Field(default=None)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    source_filename: str = Field(..., min_length=1)
    schema_version: int = Field(default=2)

    @field_validator("id", "title", "source_filename")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only")
        return s


# --- Progress and API Payloads ---

class ProgressSummary(BaseModel):
    """Progress statistics for a node or syllabus."""
    model_config = ConfigDict(strict=False)

    total_leaves: int = Field(ge=0)
    completed_leaves: int = Field(ge=0)
    progress_percent: float = Field(ge=0.0, le=100.0)


class SyllabusResponse(BaseModel):
    """Authoritative API response containing hierarchy, completed leaves, and progress."""
    model_config = ConfigDict(strict=False)

    syllabus: HierarchicalSyllabus
    completed_leaf_ids: List[str] = Field(default_factory=list)
    progress: ProgressSummary
    node_progress: Dict[str, ProgressSummary] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)


class SyllabusSummary(BaseModel):
    """Summary representation for syllabus listing."""
    model_config = ConfigDict(strict=False)

    id: str
    title: str
    created_at: str
    updated_at: str
    source_filename: str
    progress: ProgressSummary
    leaf_count: int


class LeafToggleRequest(BaseModel):
    """Payload to toggle or set a single leaf subtopic completion."""
    model_config = ConfigDict(strict=True)

    leaf_id: str = Field(..., min_length=1)
    is_completed: bool

    @field_validator("leaf_id")
    @classmethod
    def validate_leaf_id(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("leaf_id must not be empty")
        return s


Year = AcademicYear


class BulkToggleRequest(BaseModel):
    """Payload to set completion state for an entire branch or list of leaves."""
    model_config = ConfigDict(strict=False)

    node_id: Optional[str] = None
    leaf_ids: Optional[List[str]] = None
    is_completed: bool

    @field_validator("node_id")
    @classmethod
    def validate_node_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("node_id cannot be whitespace only")
            return s
        return None


class SyllabusRenameRequest(BaseModel):
    """Payload to rename a syllabus."""
    model_config = ConfigDict(strict=True)

    title: str = Field(..., min_length=1, max_length=255)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("title cannot be empty or whitespace only")
        return s


# --- Structured LLM Extraction Schemas ---

class ExtractedSubtopic(BaseModel):
    """Subtopic as extracted by Instructor/LLM."""
    title: str = Field(..., description="Title or concept name of the subtopic")
    source_text: str = Field(..., description="Exact verbatim text snippet from the document")
    source_page: Optional[int] = Field(default=None, description="Page number where snippet occurs, if known")
    source_location: Optional[str] = Field(default=None, description="Section, heading, or paragraph location")


class ExtractedModule(BaseModel):
    """Module or Unit within a Course/Subject."""
    title: str = Field(..., description="Module or unit title, e.g. 'Unit 1: Data Structures'")
    module_number: Optional[str] = Field(default=None, description="Unit/module label or number, e.g. 'Unit I', 'Module 1'")
    topics: List[ExtractedSubtopic] = Field(default_factory=list, description="Leaf subtopics/concepts")

    @model_validator(mode="before")
    @classmethod
    def handle_subtopics_alias(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "subtopics" in data and "topics" not in data:
                data["topics"] = data.pop("subtopics")
        return data

    @property
    def subtopics(self) -> List[ExtractedSubtopic]:
        return self.topics


class ExtractedSubject(BaseModel):
    """Subject or Course within a Semester."""
    title: str = Field(..., description="Course or subject title, e.g. 'Computer Science 101'")
    code: Optional[str] = Field(default=None, description="Subject code, e.g. 'CS101'")
    modules: List[ExtractedModule] = Field(default_factory=list, description="List of modules/units")


class ExtractedTopic(ExtractedModule):
    """Backward compatibility alias for ExtractedModule."""
    pass


class ExtractedSemester(BaseModel):
    """Semester extracted by Instructor/LLM."""
    title: str = Field(..., description="Semester title, e.g. 'Semester 1', 'Semester 2', 'Spring'")
    semester_number: Optional[int] = Field(default=None, description="Sequential integer number if applicable (e.g. 1, 2, 3)")
    subjects: List[ExtractedSubject] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def handle_legacy_topics(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "subjects" in data and data["subjects"]:
                return data
            if "topics" in data and data["topics"]:
                legacy_topics = data.pop("topics")
                subjects = []
                for idx, t in enumerate(legacy_topics):
                    if isinstance(t, dict):
                        t_title = t.get("title", f"Subject {idx + 1}")
                        subtopics_raw = t.get("subtopics", t.get("topics", []))
                        subs = [ExtractedSubtopic.model_validate(s) if isinstance(s, dict) else s for s in subtopics_raw]
                        mod = ExtractedModule(
                            title=f"Module: {t_title}",
                            module_number=str(idx + 1),
                            topics=subs,
                        )
                        subjects.append(ExtractedSubject(title=t_title, modules=[mod]))
                    elif isinstance(t, ExtractedModule):
                        subjects.append(ExtractedSubject(title=t.title, modules=[t]))
                data["subjects"] = subjects
        return data

    @property
    def topics(self) -> List[ExtractedModule]:
        return [m for s in self.subjects for m in s.modules]


class ExtractedYear(BaseModel):
    """Academic Year extracted by Instructor/LLM."""
    title: str = Field(..., description="Academic year title, e.g. 'Year 1', 'First Year'")
    year_number: Optional[int] = Field(default=None, description="Year integer (e.g. 1, 2)")
    semesters: List[ExtractedSemester] = Field(default_factory=list)


class ExtractedCurriculum(BaseModel):
    """Overall curriculum extracted from the document."""
    program_title: Optional[str] = Field(default=None, description="Degree or program title, if explicitly mentioned")
    years: List[ExtractedYear] = Field(default_factory=list)
    extraction_notes: Optional[str] = Field(default=None, description="Notes on document structure or ambiguity")


class AppConfigResponse(BaseModel):
    """Safe frontend configuration metadata without exposing secrets."""
    model_config = ConfigDict(strict=False)

    max_upload_size_bytes: int
    max_upload_size_mib: int
    allowed_extensions: List[str]
    active_provider: str
    configured_model: str
    active_model: Optional[str]
    ollama_connected: bool
    features: Dict[str, bool]
    app_version: str
    schema_version: int


class StartUploadResponse(BaseModel):
    """Response returned immediately after staging an upload and registering an ingestion job."""
    model_config = ConfigDict(strict=False)

    job_id: str
    stage: str = "queued"
    percent: int = 0
    message: str = "Upload accepted. Waiting for document processing."


class JobProgressResponse(BaseModel):
    """Current state and progress snapshot of an ingestion job."""
    model_config = ConfigDict(strict=False)

    job_id: str
    stage: str
    percent: int
    message: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
