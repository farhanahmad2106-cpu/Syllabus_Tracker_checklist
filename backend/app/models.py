"""SQLAlchemy / SQLModel persistence models for SQLite storage."""

from datetime import date, datetime, timezone
from typing import Optional
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import declarative_base, relationship
from sqlmodel import SQLModel, Field as DBField, Relationship

Base = declarative_base(metadata=SQLModel.metadata)


class TargetDeadline(SQLModel, table=True):
    """Tracks target completion/exam deadlines for subjects and semesters."""
    __tablename__ = "target_deadlines"
    __table_args__ = (
        UniqueConstraint("syllabus_id", "node_id", name="uq_target_deadlines_syllabus_node"),
        CheckConstraint("node_type IN ('subject', 'semester')", name="ck_target_deadlines_node_type"),
    )

    id: Optional[int] = DBField(
        default=None,
        primary_key=True,
    )

    syllabus_id: str = DBField(
        index=True,
        foreign_key="syllabi.id",
        ondelete="CASCADE",
    )

    node_id: str = DBField(
        index=True,
    )

    node_type: str = DBField(
        description="subject or semester",
    )

    target_date: date

    created_at: datetime = DBField(
        default_factory=lambda: datetime.now(timezone.utc),
    )

    updated_at: datetime = DBField(
        default_factory=lambda: datetime.now(timezone.utc),
    )


class SyllabusRecord(Base):
    """Stores the canonical syllabus metadata and serialized hierarchy JSON."""
    __tablename__ = "syllabi"

    id = Column(String(64), primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    source_filename = Column(String(255), nullable=False)
    content_hash = Column(String(64), nullable=True, index=True)
    schema_version = Column(Integer, default=2, nullable=False)
    hierarchy_json = Column(Text, nullable=False)
    warnings_json = Column(Text, nullable=True, default="[]")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    completions = relationship(
        "LeafCompletionRecord",
        back_populates="syllabus",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    deadlines = relationship(
        TargetDeadline,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class LeafCompletionRecord(Base):
    """Tracks completed leaf subtopics for a syllabus."""
    __tablename__ = "leaf_completions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    syllabus_id = Column(
        String(64),
        ForeignKey("syllabi.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    leaf_id = Column(String(128), nullable=False, index=True)
    completed_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    syllabus = relationship("SyllabusRecord", back_populates="completions")

    __table_args__ = (
        UniqueConstraint("syllabus_id", "leaf_id", name="uq_syllabus_leaf"),
    )

