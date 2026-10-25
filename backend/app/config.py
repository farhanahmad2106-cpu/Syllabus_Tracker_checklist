"""Application configuration settings."""

import json
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Hierarchical Syllabus Checklist & Progress Tracker"
    DATABASE_URL: str = "sqlite:///./data/syllabus_tracker.db"
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434/v1"
    OLLAMA_MODEL: str = "llama3.1:8b"
    OLLAMA_FALLBACK_MODEL: str = "qwen2.5:7b"
    LLM_TIMEOUT_SECONDS: int = 120
    EXTRACTION_RETRY_BUDGET: int = 2
    LLM_MAX_RETRIES: int = 2
    MAX_UPLOAD_SIZE_BYTES: int = 52428800  # 50 MiB
    MAX_PDF_PAGES: int = 300
    MAX_EXTRACTED_TEXT_CHARS: int = 1500000
    PARSER_TIMEOUT_SECONDS: int = 300
    ENABLE_DOCLING_FALLBACK: bool = False
    MAX_CONCURRENT_PARSING_JOBS: int = 2
    DOC_CONVERSION_TIMEOUT_SECONDS: int = 30
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )
    LOG_LEVEL: str = "INFO"


settings = Settings()
