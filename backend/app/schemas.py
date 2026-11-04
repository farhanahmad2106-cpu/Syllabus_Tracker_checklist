"""Canonical Pydantic v2 schemas and data contracts.

Enforces the five-tier academic hierarchy:
Document Root (HierarchicalSyllabus)
  Tier 1: AcademicYear
    Tier 2: Semester
      Tier 3: Subject
        Tier 4: Module
          Tier 5: Subtopic (Completion Leaf)
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Union
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


GroundingStatusType = Literal["verified", "needs_review", "unverified", "review_required"]
EnrollmentStatusType = Literal["mandatory", "selected", "excluded", "pending"]


class Subtopic(BaseModel):
    """Tier 5: Leaf checklist item representing a granular course concept or lecture topic."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1, description="Stable unique ID within syllabus")
    title: str = Field(..., min_length=1, description="Non-empty title of subtopic")
    source_text: str = Field(..., min_length=1, description="Verbatim source text snippet")
    source_page: Optional[int] = Field(default=None, description="1-based page number if available")
    source_location: Optional[Union[str, Dict[str, Any]]] = Field(default=None, description="Section, heading, or paragraph location")
    source_document_id: Optional[str] = Field(default=None, description="Reference to ingestion document")
    evidence_status: GroundingStatusType = Field(
        default="verified", description="Grounding verification status"
    )
    grounding_status: Optional[GroundingStatusType] = Field(
        default=None, description="Grounding verification status alias"
    )
    source_start_offset: Optional[int] = Field(default=None, description="Start char offset in canonical document")
    source_end_offset: Optional[int] = Field(default=None, description="End char offset in canonical document")
    order_index: int = Field(default=0, ge=0)

    @field_validator("grounding_status", mode="before")
    @classmethod
    def populate_grounding_status(cls, v: Any) -> Any:
        return v

    def model_post_init(self, __context: Any) -> None:
        if self.grounding_status is None:
            self.grounding_status = self.evidence_status
        elif self.evidence_status is None:
            self.evidence_status = self.grounding_status

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

    @field_validator("source_start_offset", "source_end_offset")
    @classmethod
    def validate_non_negative_offset(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("Offset must be non-negative")
        return v


class Module(BaseModel):
    """Tier 4: Module or Unit within a Subject."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    module_number: Optional[str] = Field(default=None)
    title: str = Field(..., min_length=1)
    contact_hours: Optional[int] = Field(default=None, ge=0, description="Informational contact hours")
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
    """Tier 3: Course or Subject within a Semester."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    code: Optional[str] = Field(default=None)
    title: str = Field(..., min_length=1)
    is_lab: bool = Field(default=False, description="Laboratory, practical, workshop, or sessional course")
    is_elective: bool = Field(default=False, description="Whether this is an elective course")
    elective_group: Optional[str] = Field(default=None, description="Category or group label for elective course")
    is_enrolled: bool = Field(default=True, description="Whether student is actively enrolled in this course")
    enrollment_status: EnrollmentStatusType = Field(
        default="mandatory",
        description="Enrollment classification: mandatory, selected, excluded, pending",
    )
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
    """Tier 2: Semester within an Academic Year."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    semester_number: Optional[int] = Field(default=None, ge=1)
    subjects: List[Subject] = Field(default_factory=list)
    order_index: int = Field(default=0, ge=0)

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_topics(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "subjects" in data and data["subjects"]:
                return data
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
    """Tier 1: Academic Year grouping."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    year_number: Optional[int] = Field(default=None, ge=1)
    semesters: List[Semester] = Field(default_factory=list)
    order_index: int = Field(default=0, ge=0)

    @field_validator("id", "title")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only")
        return s


Year = AcademicYear


class HierarchicalSyllabus(BaseModel):
    """Root Document Container representing a degree, program, or course curriculum."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    years: List[AcademicYear] = Field(default_factory=list)
    content_hash: Optional[str] = Field(default=None)
    source_file_hash: Optional[str] = Field(default=None)
    source_filename: str = Field(..., min_length=1)
    source_file_type: str = Field(default="pdf")
    extraction_status: str = Field(default="completed")
    requires_enrollment_confirmation: bool = Field(default=False)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    schema_version: int = Field(default=2)

    def model_post_init(self, __context: Any) -> None:
        if self.source_file_hash is None and self.content_hash is not None:
            self.source_file_hash = self.content_hash
        elif self.content_hash is None and self.source_file_hash is not None:
            self.content_hash = self.source_file_hash

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


class SetTargetDateRequest(BaseModel):
    """Payload to register or update a deadline for a Subject or Semester."""
    model_config = ConfigDict(strict=False)

    node_id: str = Field(..., min_length=1)
    node_type: Literal["subject", "semester"]
    target_date: date

    @field_validator("node_id")
    @classmethod
    def validate_non_blank_node_id(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("node_id must not be empty or whitespace only")
        return s


class PacingMetrics(BaseModel):
    """Calculated pacing workload and status metrics for a node."""
    model_config = ConfigDict(strict=False)

    node_id: str
    target_date: Optional[date] = None
    days_remaining: Optional[int] = None
    total_leaves: int = Field(default=0, ge=0)
    completed_leaves: int = Field(default=0, ge=0)
    remaining_leaves: int = Field(default=0, ge=0)
    remaining_contact_hours: float = Field(default=0.0, ge=0.0)
    topics_per_week: float = Field(default=0.0, ge=0.0)
    hours_per_week: float = Field(default=0.0, ge=0.0)
    status: Literal["completed", "on_track", "at_risk", "behind", "not_set"]


class SyllabusPacingSummaryResponse(BaseModel):
    """Collection of all active deadline metrics for a syllabus."""
    model_config = ConfigDict(strict=False)

    syllabus_id: str
    deadlines: Dict[str, PacingMetrics] = Field(default_factory=dict)


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
    model_config = ConfigDict(strict=False)

    leaf_id: str = Field(..., min_length=1)
    is_completed: Optional[bool] = None
    completed: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def sync_completed(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "completed" in data and "is_completed" not in data:
                data["is_completed"] = data["completed"]
            elif "is_completed" in data and "completed" not in data:
                data["completed"] = data["is_completed"]
        return data

    @field_validator("leaf_id")
    @classmethod
    def validate_leaf_id(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("leaf_id must not be empty")
        return s

    @property
    def target_completed(self) -> bool:
        if self.is_completed is not None:
            return self.is_completed
        if self.completed is not None:
            return self.completed
        return True


class BulkToggleRequest(BaseModel):
    """Payload to set completion state for an entire branch or list of leaves."""
    model_config = ConfigDict(strict=False)

    node_type: Optional[str] = None
    node_id: Optional[str] = None
    leaf_ids: Optional[List[str]] = None
    is_completed: Optional[bool] = None
    completed: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def sync_completed(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "completed" in data and "is_completed" not in data:
                data["is_completed"] = data["completed"]
            elif "is_completed" in data and "completed" not in data:
                data["completed"] = data["is_completed"]
        return data

    @field_validator("node_id")
    @classmethod
    def validate_node_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("node_id cannot be whitespace only")
            return s
        return None

    @property
    def target_completed(self) -> bool:
        if self.is_completed is not None:
            return self.is_completed
        if self.completed is not None:
            return self.completed
        return True


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


# --- Elective Onboarding Workflow Schemas ---

class ParseReviewResponse(BaseModel):
    """Response returned for review before finalizing elective enrollment."""
    model_config = ConfigDict(strict=False)

    syllabus_id: str
    title: str
    detected_electives: List[Subject] = Field(default_factory=list)
    elective_groups: Dict[str, List[Subject]] = Field(default_factory=dict)
    years: List[AcademicYear] = Field(default_factory=list)
    requires_enrollment_confirmation: bool = False
    extraction_warnings: List[str] = Field(default_factory=list)


class FinalizeEnrollmentRequest(BaseModel):
    """Request payload containing confirmed enrolled subject IDs."""
    model_config = ConfigDict(strict=False)

    enrolled_subject_ids: List[str] = Field(default_factory=list)


# --- Structured LLM Extraction Schemas ---

class ExtractedSubtopic(BaseModel):
    """Subtopic as extracted by Instructor/LLM."""
    title: str = Field(..., description="Title or concept name of the subtopic")
    source_text: str = Field(..., description="Exact verbatim text snippet from the document")
    source_page: Optional[int] = Field(default=None, description="Page number where snippet occurs, if known")
    source_start_offset: Optional[int] = Field(default=None, description="Start offset in source text")
    source_end_offset: Optional[int] = Field(default=None, description="End offset in source text")
    source_location: Optional[str] = Field(default=None, description="Section, heading, or paragraph location")


class ExtractedModule(BaseModel):
    """Module or Unit within a Course/Subject."""
    title: str = Field(..., description="Module or unit title, e.g. 'Unit 1: Data Structures'")
    module_number: Optional[str] = Field(default=None, description="Unit/module label or number, e.g. 'Unit I', 'Module 1'")
    contact_hours: Optional[int] = Field(default=None, ge=0, description="Explicit contact hours for module if specified")
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
    is_lab: bool = Field(default=False, description="Whether this is a laboratory, practical, workshop, or sessional course")
    is_elective: bool = Field(default=False, description="Whether this is an elective course requiring student choice")
    elective_group: Optional[str] = Field(default=None, description="Group or bucket name, e.g. 'Elective I', 'Group A'")
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
    syllabus_id: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# --- Option-B: Notes, Resources & Export/Restore Schemas ---

class SaveNoteRequest(BaseModel):
    """Request to create or update a topic study note."""
    model_config = ConfigDict(strict=False)
    content: str = Field(..., max_length=50000, description="Markdown content (max 50,000 characters)")


class NoteResponse(BaseModel):
    """Topic note content and timestamp."""
    model_config = ConfigDict(strict=False)
    leaf_id: str
    content: str
    updated_at: Optional[datetime] = None


ResourceType = Literal["youtube", "documentation", "slides", "github", "link"]
ResourceNodeType = Literal["subtopic", "module"]


class AddResourceRequest(BaseModel):
    """Request to attach a learning resource to a Subtopic or Module."""
    model_config = ConfigDict(strict=False)

    node_id: str = Field(..., min_length=1, description="ID of subtopic leaf or module")
    node_type: ResourceNodeType = Field(..., description="subtopic or module")
    title: str = Field(..., min_length=1, max_length=200, description="Human-readable title")
    url: str = Field(..., min_length=1, max_length=2048, description="Safe HTTP/HTTPS URL")
    resource_type: ResourceType = Field(default="link", description="Resource category")

    @field_validator("title")
    @classmethod
    def validate_title_non_empty(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Title must not be empty or whitespace only")
        return s

    @field_validator("url")
    @classmethod
    def validate_safe_url(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("URL must not be empty")
        parsed = urlparse(s)
        if parsed.scheme.lower() not in ("http", "https"):
            raise ValueError("URL scheme must be http or https")
        if not parsed.netloc:
            raise ValueError("URL must have a valid host/domain")
        if parsed.username or parsed.password:
            raise ValueError("Credentials in URL are strictly prohibited")
        return s

    @model_validator(mode="after")
    def auto_detect_type(self) -> "AddResourceRequest":
        if self.resource_type == "link":
            parsed = urlparse(self.url)
            netloc = (parsed.netloc or "").lower()
            if "youtube.com" in netloc or "youtu.be" in netloc:
                self.resource_type = "youtube"
            elif "github.com" in netloc:
                self.resource_type = "github"
        return self


class ResourceResponse(BaseModel):
    """Learning resource representation."""
    model_config = ConfigDict(strict=False)

    id: int
    node_id: str
    node_type: str
    title: str
    url: str
    resource_type: str
    created_at: datetime


class ExportOptions(BaseModel):
    """Configuration options for syllabus export."""
    include_notes: bool = True
    include_resources: bool = True
    include_pacing: bool = True
    enrolled_only: bool = True


class BackupRestoreRequest(BaseModel):
    """Request payload to restore a syllabus backup."""
    backup_data: Dict[str, Any]
    mode: Literal["clone", "replace"] = "clone"
    target_syllabus_id: Optional[str] = None


class BackupRestoreResult(BaseModel):
    """Result of restoring a syllabus backup."""
    model_config = ConfigDict(strict=False)

    success: bool = True
    syllabus_id: str
    restored_completed_leaves: int = 0
    restored_notes: int = 0
    restored_resources: int = 0
    restored_deadlines: int = 0
    warnings: List[str] = Field(default_factory=list)


class BackupEnvelope(BaseModel):
    """Versioned portable backup envelope (Schema 2.1)."""
    model_config = ConfigDict(strict=False)

    schema_version: str = "2.1"
    application: str = "Hierarchical Syllabus Checklist & Progress Tracker"
    exported_at: str
    syllabus: Dict[str, Any]
    enrollment: Optional[Dict[str, Any]] = None
    completed_leaves: List[str] = Field(default_factory=list)
    notes: Dict[str, str] = Field(default_factory=dict)
    resources: List[Dict[str, Any]] = Field(default_factory=list)
    deadlines: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

