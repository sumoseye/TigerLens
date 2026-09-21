"""
Convenience runner for the BrowseGraph backend.
Run with: python run.py
"""

import uvicorn
from backend.config import ServerConfig

if __name__ == "__main__":
    print("=" * 50)
    print("  BrowseGraph & TigerLens Backend")
    print(f"  Starting on http://{ServerConfig.HOST}:{ServerConfig.PORT}")
    print("  Docs: http://localhost:8741/docs")
    print("=" * 50)
    uvicorn.run(
        "backend.main:app",
        host=ServerConfig.HOST,
        port=ServerConfig.PORT,
        reload=True,
    )