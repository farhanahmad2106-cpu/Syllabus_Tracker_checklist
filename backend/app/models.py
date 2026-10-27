"""SQLAlchemy / SQLModel persistence models for SQLite storage."""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


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
