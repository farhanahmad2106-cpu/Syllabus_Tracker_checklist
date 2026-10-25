"""Canonical Pydantic v2 schemas and data contracts."""

from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Subtopic(BaseModel):
    """Leaf checklist item representing a granular course concept or lecture topic."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1, description="Stable unique ID within syllabus")
    title: str = Field(..., min_length=1, description="Non-empty title of subtopic")
    source_text: str = Field(..., min_length=1, description="Verbatim source text snippet")
    source_page: Optional[int] = Field(default=None, description="1-based page number if available")
    source_location: Optional[str] = Field(default=None, description="Section, heading, or paragraph location")
    order_index: int = Field(default=0, ge=0)

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


class Topic(BaseModel):
    """Course, subject, module, or unit within a semester."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    subtopics: List[Subtopic] = Field(default_factory=list)
    order_index: int = Field(default=0, ge=0)

    @field_validator("id", "title")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only")
        return s


class Semester(BaseModel):
    """Semester within an academic year."""
    model_config = ConfigDict(strict=False, extra="forbid")

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    topics: List[Topic] = Field(default_factory=list)
    order_index: int = Field(default=0, ge=0)

    @field_validator("id", "title")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field must not be empty or whitespace only")
        return s


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
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    source_filename: str = Field(..., min_length=1)
    schema_version: int = Field(default=1)

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


class BulkToggleRequest(BaseModel):
    """Payload to set completion state for an entire branch or node."""
    model_config = ConfigDict(strict=True)

    node_id: str = Field(..., min_length=1)
    is_completed: bool

    @field_validator("node_id")
    @classmethod
    def validate_node_id(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("node_id must not be empty")
        return s


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


class ExtractedTopic(BaseModel):
    """Topic or Course unit extracted by Instructor/LLM."""
    title: str = Field(..., description="Course, topic, subject, or unit title")
    subtopics: List[ExtractedSubtopic] = Field(default_factory=list)


class ExtractedSemester(BaseModel):
    """Semester extracted by Instructor/LLM."""
    title: str = Field(..., description="Semester title, e.g. 'Semester 1', 'Semester 2', 'Spring'")
    semester_number: Optional[int] = Field(default=None, description="Sequential integer number if applicable (e.g. 1, 2, 3)")
    topics: List[ExtractedTopic] = Field(default_factory=list)


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
