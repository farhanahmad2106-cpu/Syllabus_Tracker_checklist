"""Application configuration settings supporting dual-provider LLM extraction and limits."""

import os
from typing import List, Optional, Union
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Hierarchical Syllabus Checklist & Progress Tracker"
    DATABASE_URL: str = "sqlite:///./data/syllabus_tracker.db"

    # Dual-provider LLM settings
    EXTRACTION_PROVIDER: str = "ollama"  # "ollama" or "openai"

    # Ollama settings
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434/v1"
    OLLAMA_MODEL: str = "llama3.1:8b"
    OLLAMA_FALLBACK_MODEL: str = "qwen2.5:7b"

    # OpenAI / OpenAI-compatible settings (including Groq, Together, DeepSeek)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    GROQ_API_KEY: Optional[str] = None

    @model_validator(mode="after")
    def resolve_cloud_llm_credentials(self) -> "Settings":
        """Auto-populate OpenAI credentials from GROQ_API_KEY if Groq is supplied."""
        if self.GROQ_API_KEY and not self.OPENAI_API_KEY:
            self.OPENAI_API_KEY = self.GROQ_API_KEY
        if self.GROQ_API_KEY and not self.OPENAI_BASE_URL:
            self.OPENAI_BASE_URL = "https://api.groq.com/openai/v1"
        return self

    # Extraction budgets and timeouts
    EXTRACTION_TIMEOUT_SECONDS: int = 180
    LLM_TIMEOUT_SECONDS: int = 180
    EXTRACTION_MAX_RETRIES: int = 2
    LLM_MAX_RETRIES: int = 2
    EXTRACTION_RETRY_BUDGET: int = 2
    EXTRACTION_MAX_CHUNK_TOKENS: int = 6000

    # Ingestion limits
    MAX_UPLOAD_SIZE_MB: int = 50
    MAX_UPLOAD_SIZE_BYTES: int = 52428800  # 50 MiB
    MAX_PDF_PAGES: int = 300
    MAX_EXTRACTED_TEXT_CHARS: int = 1500000
    PARSER_TIMEOUT_SECONDS: int = 300
    ENABLE_DOCLING_FALLBACK: bool = False
    MAX_CONCURRENT_PARSING_JOBS: int = 2
    DOC_CONVERSION_TIMEOUT_SECONDS: int = 30

    CORS_ORIGINS: Union[str, List[str]] = (
        "http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS origins as a list of strings, splitting comma-separated entries and stripping whitespace.

        Supports comma-separated strings (e.g. 'https://app.vercel.app,https://localhost'),
        JSON array strings (e.g. '["https://app.vercel.app"]'), or raw Python lists.
        """
        if isinstance(self.CORS_ORIGINS, list):
            return [str(origin).strip() for origin in self.CORS_ORIGINS if str(origin).strip()]
        val = str(self.CORS_ORIGINS).strip()
        if val.startswith("[") and val.endswith("]"):
            try:
                import json
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            except Exception:
                pass
        return [origin.strip() for origin in val.split(",") if origin.strip()]
    LOG_LEVEL: str = "INFO"

    @field_validator("EXTRACTION_PROVIDER")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        prov = v.strip().lower()
        if prov not in {"ollama", "openai"}:
            raise ValueError(f"Unsupported EXTRACTION_PROVIDER '{v}'. Must be 'ollama' or 'openai'.")
        return prov


settings = Settings()
