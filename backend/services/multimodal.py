"""
Multimodal Pipeline — Google Gemini Flash

Provides screenshot analysis including:
- OCR text extraction
- Visual bounding box detection
- Image description generation
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from typing import Optional

from backend.config import GeminiConfig

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


@dataclass
class BoundingBox:
    """A detected visual region in the screenshot."""
    label: str
    x: float
    y: float
    width: float
    height: float
    confidence: float


@dataclass
class VisualAnalysisResult:
    """Complete result from the multimodal vision pipeline."""
    ocr_text: str
    description: str
    bounding_boxes: list[BoundingBox]
    entities_detected: list[str]
    processing_time_ms: float
    model_used: str
    token_count: int


class MultimodalService:
    """
    Handles all Gemini Flash vision pipeline operations.
    Falls back to a simulated response when the API key is missing
    or the google-genai SDK is unavailable.
    """

    def __init__(self) -> None:
        self._config = GeminiConfig()
        self._client: Optional[Any] = None
        if GENAI_AVAILABLE and self._config.API_KEY:
            self._client = genai.Client(api_key=self._config.API_KEY)

    async def analyze_screenshot(self, image_base64: str, context: str = "") -> VisualAnalysisResult:
        """
        Analyze a base64-encoded screenshot image.

        Args:
            image_base64: Base64-encoded PNG/JPEG image data.
            context: Optional context about what page/content the screenshot is from.

        Returns:
            VisualAnalysisResult with OCR text, description, bounding boxes, and entities.
        """
        start_time = time.time()

        if self._client is not None:
            return await self._analyze_with_gemini(image_base64, context, start_time)
        else:
            return self._generate_mock_analysis(image_base64, context, start_time)

    async def _analyze_with_gemini(self, image_base64: str, context: str, start_time: float) -> VisualAnalysisResult:
        """Use the real Gemini API for analysis."""
        prompt = f"""Analyze this screenshot and provide a JSON response with the following structure:
{{
    "ocr_text": "All readable text extracted from the image",
    "description": "A detailed description of what the screenshot shows",
    "bounding_boxes": [
        {{
            "label": "description of the UI element or content region",
            "x": 0.0,
            "y": 0.0,
            "width": 0.5,
            "height": 0.3,
            "confidence": 0.95
        }}
    ],
    "entities_detected": ["list", "of", "key", "entities", "or", "concepts"]
}}

All bounding box coordinates should be normalized (0.0 to 1.0).
{f"Context about this page: {context}" if context else ""}
Respond ONLY with valid JSON, no markdown fencing."""

        try:
            image_bytes = base64.b64decode(image_base64)
            image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")

            response = self._client.models.generate_content(
                model=self._config.VISION_MODEL,
                contents=[prompt, image_part],
                config=types.GenerateContentConfig(
                    max_output_tokens=self._config.MAX_OUTPUT_TOKENS,
                    temperature=self._config.TEMPERATURE,
                ),
            )

            response_text = response.text.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("\n", 1)[1]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]

            parsed = json.loads(response_text)
            elapsed_ms = (time.time() - start_time) * 1000

            bounding_boxes = []
            for bb in parsed.get("bounding_boxes", []):
                bounding_boxes.append(BoundingBox(
                    label=bb.get("label", "unknown"),
                    x=float(bb.get("x", 0)),
                    y=float(bb.get("y", 0)),
                    width=float(bb.get("width", 0)),
                    height=float(bb.get("height", 0)),
                    confidence=float(bb.get("confidence", 0.5)),
                ))

            token_count = 0
            if hasattr(response, "usage_metadata"):
                token_count = getattr(response.usage_metadata, "total_token_count", 0)

            return VisualAnalysisResult(
                ocr_text=parsed.get("ocr_text", ""),
                description=parsed.get("description", ""),
                bounding_boxes=bounding_boxes,
                entities_detected=parsed.get("entities_detected", []),
                processing_time_ms=round(elapsed_ms, 1),
                model_used=self._config.VISION_MODEL,
                token_count=token_count,
            )

        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            return VisualAnalysisResult(
                ocr_text=f"[Gemini error: {str(e)}]",
                description="Analysis failed due to API error.",
                bounding_boxes=[],
                entities_detected=[],
                processing_time_ms=round(elapsed_ms, 1),
                model_used=self._config.VISION_MODEL,
                token_count=0,
            )

    def _generate_mock_analysis(self, image_base64: str, context: str, start_time: float) -> VisualAnalysisResult:
        """Generate a realistic mock analysis when Gemini is unavailable."""
        import hashlib
        import random

        # Use image hash for deterministic but varied results
        img_hash = hashlib.md5(image_base64[:100].encode()).hexdigest()
        random.seed(img_hash)

        mock_texts = [
            "BrowseGraph - Knowledge Canvas\nSearch your browsing knowledge graph\nConnected entities: 47\nRecent captures: 12",
            "Documentation: FastAPI Framework\nBuild APIs with Python 3.8+\nAutomatic interactive docs\nAsync support built-in",
            "TigerGraph Cloud Dashboard\nGraph: BrowseGraph\nVertices: 2,847\nEdges: 15,392\nQueries running: 3",
            "React Component Library\nimport React from 'react'\nfunction App() {\n  return <div>Hello</div>\n}",
        ]

        mock_descriptions = [
            "A web application dashboard showing a knowledge graph visualization with interconnected nodes in ice blue color on a dark chocolate brown background.",
            "A documentation page for a Python web framework with code examples, API endpoint descriptions, and navigation sidebar.",
            "A cloud database management interface showing graph statistics, query performance metrics, and a visual schema editor.",
            "A code editor showing React component source code with syntax highlighting, file tree navigator, and terminal output.",
        ]

        mock_entities_sets = [
            ["BrowseGraph", "Knowledge Graph", "Search", "Entities"],
            ["FastAPI", "Python", "API", "Documentation"],
            ["TigerGraph", "Graph Database", "Cloud", "Query"],
            ["React", "JavaScript", "Component", "UI"],
        ]

        idx = random.randint(0, len(mock_texts) - 1)

        bounding_boxes = [
            BoundingBox(label="Header/Navigation", x=0.0, y=0.0, width=1.0, height=0.08, confidence=0.95),
            BoundingBox(label="Main Content Area", x=0.15, y=0.1, width=0.7, height=0.75, confidence=0.92),
            BoundingBox(label="Sidebar", x=0.0, y=0.08, width=0.15, height=0.92, confidence=0.88),
            BoundingBox(label="Primary Action Button", x=0.4, y=0.88, width=0.2, height=0.06, confidence=0.91),
        ]

        elapsed_ms = (time.time() - start_time) * 1000 + random.uniform(50, 150)

        return VisualAnalysisResult(
            ocr_text=mock_texts[idx],
            description=mock_descriptions[idx],
            bounding_boxes=bounding_boxes,
            entities_detected=mock_entities_sets[idx],
            processing_time_ms=round(elapsed_ms, 1),
            model_used="mock-gemini-2.5-flash",
            token_count=random.randint(400, 1200),
        )

    async def extract_entities_from_text(self, text: str) -> list[str]:
        """Extract entity names from OCR or page text using Gemini."""
        if self._client is not None:
            try:
                prompt = f"""Extract all named entities (people, organizations, technologies, concepts, products) from the following text.
Return ONLY a JSON array of strings, nothing else.

Text: {text}"""

                response = self._client.models.generate_content(
                    model=self._config.VISION_MODEL,
                    contents=[prompt],
                    config=types.GenerateContentConfig(
                        max_output_tokens=1024,
                        temperature=0.0,
                    ),
                )
                response_text = response.text.strip()
                if response_text.startswith("```"):
                    response_text = response_text.split("\n", 1)[1]
                    if response_text.endswith("```"):
                        response_text = response_text[:-3]
                return json.loads(response_text)
            except Exception:
                pass

        # Fallback: simple extraction
        words = text.split()
        entities = []
        for word in words:
            cleaned = word.strip(".,;:!?()[]{}\"'")
            if cleaned and cleaned[0].isupper() and len(cleaned) > 2:
                entities.append(cleaned)
        return list(set(entities))[:20]