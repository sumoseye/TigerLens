"""
BrowseGraph & TigerLens — Application Configuration

Loads environment variables and exposes typed configuration
for every subsystem: TigerGraph, Groq, Gemini, and server.
"""

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend directory
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)


class GroqConfig:
    """Configuration for Groq LLM API."""
    API_KEY: str = os.getenv("GROQ_API_KEY", "")
    EXTRACTION_MODEL: str = "llama-3.3-70b-versatile"
    ROUTER_MODEL: str = "llama-3.1-8b-instant"
    MAX_TOKENS_EXTRACTION: int = 4096
    MAX_TOKENS_ROUTER: int = 256
    TEMPERATURE_EXTRACTION: float = 0.1
    TEMPERATURE_ROUTER: float = 0.0


class GeminiConfig:
    """Configuration for Google Gemini Vision API."""
    API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    VISION_MODEL: str = "gemini-2.5-flash"
    MAX_OUTPUT_TOKENS: int = 4096
    TEMPERATURE: float = 0.2


class TigerGraphConfig:
    """Configuration for TigerGraph Savanna or Mock."""
    HOST: str = os.getenv("TIGERGRAPH_HOST", "https://localhost")
    GRAPH: str = os.getenv("TIGERGRAPH_GRAPH", "BrowseGraph")
    SECRET: str = os.getenv("TIGERGRAPH_SECRET", "")
    TOKEN: str = os.getenv("TIGERGRAPH_TOKEN", "")


class ServerConfig:
    """Configuration for the FastAPI server."""
    HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("SERVER_PORT", "8741"))
    CORS_ORIGINS: list[str] = ["*"]


# Master toggle: when True, use MockTigerGraphDriver instead of live connection
USE_MOCK_TG: bool = os.getenv("USE_MOCK_TG", "true").lower() in ("true", "1", "yes")

# Theme colors (for backend-generated HTML reports if needed)
THEME = {
    "bg_primary": "#2A1810",
    "bg_secondary": "#3D2317",
    "accent_primary": "#FFF3B0",
    "accent_secondary": "#FFE680",
    "node_color": "#A2CFFE",
    "text_light": "#FAF6EE",
    "text_dark": "#1A0F0A",
}