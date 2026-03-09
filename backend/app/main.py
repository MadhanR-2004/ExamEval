"""
FastAPI application entry point with MongoDB lifespan events.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import connect_db, close_db
from app.routers import exams, papers, evaluations

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    logger.info("Connecting to MongoDB...")
    await connect_db()
    logger.info(f"Connected to MongoDB at {settings.MONGODB_URL}")

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    yield

    logger.info("Closing MongoDB connection...")
    await close_db()


app = FastAPI(
    title="ExamEval - OCR + LLM Exam Evaluator",
    description="Automated exam paper evaluation using OCR and LLM models via Ollama",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploaded images
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Routers
app.mount_prefix = "/api"
app.include_router(exams.router, prefix="/api")
app.include_router(papers.router, prefix="/api")
app.include_router(evaluations.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": "ExamEval API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}
