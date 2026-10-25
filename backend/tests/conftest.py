"""Pytest fixtures for backend tests."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.schemas import (
    AcademicYear,
    HierarchicalSyllabus,
    Semester,
    Subtopic,
    Topic,
)


from sqlalchemy.pool import StaticPool
from sqlalchemy import event


@pytest.fixture
def test_engine():
    """Create an isolated in-memory SQLite database engine for testing with StaticPool."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_engine):
    """Provide an isolated database session rolled back after test."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    """FastAPI test client with database dependency overridden to test in-memory db."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_syllabus() -> HierarchicalSyllabus:
    """Fixture providing a standard 5-level hierarchical syllabus."""
    return HierarchicalSyllabus(
        id="syl_cs101",
        title="B.Sc. Computer Science",
        source_filename="cs_syllabus.pdf",
        schema_version=1,
        years=[
            AcademicYear(
                id="yr_1",
                title="Year 1",
                order_index=0,
                semesters=[
                    Semester(
                        id="sem_1",
                        title="Semester 1",
                        order_index=0,
                        topics=[
                            Topic(
                                id="top_algo",
                                title="Data Structures and Algorithms",
                                order_index=0,
                                subtopics=[
                                    Subtopic(
                                        id="sub_arr",
                                        title="Arrays and Linked Lists",
                                        source_text="Study arrays and singly linked lists",
                                        source_page=1,
                                        source_location="Unit 1.1",
                                        order_index=0,
                                    ),
                                    Subtopic(
                                        id="sub_stack",
                                        title="Stacks and Queues",
                                        source_text="Study LIFO stacks and FIFO queues",
                                        source_page=2,
                                        source_location="Unit 1.2",
                                        order_index=1,
                                    ),
                                ],
                            ),
                            Topic(
                                id="top_db",
                                title="Database Systems",
                                order_index=1,
                                subtopics=[
                                    Subtopic(
                                        id="sub_sql",
                                        title="Relational Algebra & SQL",
                                        source_text="Basic SQL queries and relational algebra",
                                        source_page=5,
                                        source_location="Section 2",
                                        order_index=0,
                                    ),
                                ],
                            ),
                        ],
                    ),
                    Semester(
                        id="sem_2",
                        title="Semester 2",
                        order_index=1,
                        topics=[
                            Topic(
                                id="top_os",
                                title="Operating Systems",
                                order_index=0,
                                subtopics=[
                                    Subtopic(
                                        id="sub_proc",
                                        title="Processes and Threads",
                                        source_text="Process lifecycle and concurrency threads",
                                        source_page=10,
                                        source_location="Chapter 3",
                                        order_index=0,
                                    ),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )
