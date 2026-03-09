"""
Evaluations Router - Trigger evaluations and view results (MongoDB).
"""

from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List

from app.database import get_db
from app.models import PaperStatus
from app.schemas import (
    EvaluationResponse,
    PaperDetailResponse,
    DashboardStats,
    PaperResponse,
    OllamaModelInfo,
    SettingsUpdate,
)
from app.services.llm_service import check_ollama_connection, list_available_models
from app.config import settings

router = APIRouter(prefix="/evaluations", tags=["Evaluations"])


def _paper_doc_to_response(doc: dict) -> dict:
    """Convert a MongoDB paper document to API response format."""
    return {
        "id": str(doc["_id"]),
        "exam_id": doc["exam_id"],
        "student_name": doc["student_name"],
        "student_id": doc.get("student_id"),
        "image_paths": doc.get("image_paths", []),
        "extracted_text": doc.get("extracted_text"),
        "status": doc.get("status", PaperStatus.UPLOADED),
        "total_score": doc.get("total_score"),
        "max_score": doc.get("max_score"),
        "percentage": doc.get("percentage"),
        "uploaded_at": doc.get("uploaded_at", datetime.utcnow()),
        "evaluated_at": doc.get("evaluated_at"),
    }


def _eval_doc_to_response(doc: dict) -> dict:
    """Convert a MongoDB evaluation document to API response format."""
    return {
        "id": str(doc["_id"]),
        "paper_id": doc["paper_id"],
        "question_number": doc["question_number"],
        "question_text": doc.get("question_text", ""),
        "expected_answer": doc.get("expected_answer", ""),
        "extracted_answer": doc.get("extracted_answer"),
        "score": doc.get("score", 0),
        "max_score": doc.get("max_score", 0),
        "feedback": doc.get("feedback"),
        "keywords": doc.get("keywords"),
        "evaluated_at": doc.get("evaluated_at", datetime.utcnow()),
    }


@router.post("/process/{paper_id}", response_model=PaperResponse)
async def trigger_evaluation(paper_id: str, background_tasks: BackgroundTasks):
    """Trigger OCR + evaluation for a specific paper."""
    db = get_db()
    try:
        paper = await db.papers.find_one({"_id": ObjectId(paper_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid paper ID")
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if paper.get("status") in [PaperStatus.OCR_PROCESSING, PaperStatus.EVALUATING]:
        raise HTTPException(status_code=400, detail="Paper is already being processed")

    from app.routers.papers import run_evaluation_bg

    background_tasks.add_task(run_evaluation_bg, paper_id)

    await db.papers.update_one(
        {"_id": ObjectId(paper_id)}, {"$set": {"status": PaperStatus.OCR_PROCESSING}}
    )
    paper["status"] = PaperStatus.OCR_PROCESSING
    return _paper_doc_to_response(paper)


@router.post("/re-evaluate/{paper_id}", response_model=PaperResponse)
async def trigger_re_evaluation(paper_id: str, background_tasks: BackgroundTasks):
    """Re-evaluate a paper (keeps OCR text, re-runs LLM evaluation)."""
    db = get_db()
    try:
        paper = await db.papers.find_one({"_id": ObjectId(paper_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid paper ID")
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    async def run_re_eval():
        from app.services.evaluation_service import re_evaluate_paper
        import logging

        try:
            await re_evaluate_paper(paper_id)
        except Exception as e:
            logging.getLogger(__name__).error(f"Re-evaluation failed: {e}")

    background_tasks.add_task(run_re_eval)

    await db.papers.update_one(
        {"_id": ObjectId(paper_id)}, {"$set": {"status": PaperStatus.EVALUATING}}
    )
    paper["status"] = PaperStatus.EVALUATING
    return _paper_doc_to_response(paper)


@router.get("/paper/{paper_id}", response_model=PaperDetailResponse)
async def get_paper_evaluations(paper_id: str):
    """Get detailed evaluation results for a paper."""
    db = get_db()
    try:
        paper = await db.papers.find_one({"_id": ObjectId(paper_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid paper ID")
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    evaluations = (
        await db.evaluations.find({"paper_id": paper_id})
        .sort("question_number", 1)
        .to_list(1000)
    )

    exam = None
    try:
        exam_doc = await db.exams.find_one({"_id": ObjectId(paper["exam_id"])})
        if exam_doc:
            exam = {
                "id": str(exam_doc["_id"]),
                "title": exam_doc["title"],
                "subject": exam_doc["subject"],
                "description": exam_doc.get("description"),
                "total_marks": exam_doc.get("total_marks", 0),
                "created_at": exam_doc.get("created_at", datetime.utcnow()),
                "updated_at": exam_doc.get("updated_at", datetime.utcnow()),
                "questions": exam_doc.get("questions", []),
            }
    except Exception:
        pass

    return {
        "id": str(paper["_id"]),
        "exam_id": paper["exam_id"],
        "student_name": paper["student_name"],
        "student_id": paper.get("student_id"),
        "image_paths": paper.get("image_paths", []),
        "extracted_text": paper.get("extracted_text"),
        "status": paper.get("status"),
        "total_score": paper.get("total_score"),
        "max_score": paper.get("max_score"),
        "percentage": paper.get("percentage"),
        "uploaded_at": paper.get("uploaded_at", datetime.utcnow()),
        "evaluated_at": paper.get("evaluated_at"),
        "evaluations": [_eval_doc_to_response(e) for e in evaluations],
        "exam": exam,
    }


@router.get("/results/exam/{exam_id}", response_model=List[PaperResponse])
async def get_exam_results(exam_id: str):
    """Get all evaluated papers for an exam."""
    db = get_db()
    papers = await db.papers.find({"exam_id": exam_id}).sort("percentage", -1).to_list(10000)
    return [_paper_doc_to_response(p) for p in papers]


# ── Dashboard & System Routes ────────────────────────────

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    """Get dashboard statistics."""
    db = get_db()
    total_exams = await db.exams.count_documents({})
    total_papers = await db.papers.count_documents({})
    total_evaluated = await db.papers.count_documents({"status": PaperStatus.EVALUATED})

    # Average score
    pipeline = [
        {"$match": {"percentage": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$percentage"}}},
    ]
    avg_result = await db.papers.aggregate(pipeline).to_list(1)
    avg_score = round(avg_result[0]["avg"], 2) if avg_result else None

    recent = (
        await db.papers.find({"status": PaperStatus.EVALUATED})
        .sort("evaluated_at", -1)
        .limit(10)
        .to_list(10)
    )

    return {
        "total_exams": total_exams,
        "total_papers": total_papers,
        "total_evaluated": total_evaluated,
        "average_score": avg_score,
        "recent_evaluations": [_paper_doc_to_response(p) for p in recent],
    }


@router.get("/system/status")
async def system_status():
    """Check system status including Ollama connection."""
    ollama_ok = await check_ollama_connection()
    models = await list_available_models() if ollama_ok else []

    return {
        "ollama_connected": ollama_ok,
        "ollama_url": settings.OLLAMA_BASE_URL,
        "ocr_model": settings.OCR_MODEL,
        "llm_model": settings.LLM_MODEL,
        "available_models": [m.get("name", "") for m in models],
    }


@router.get("/system/models", response_model=List[OllamaModelInfo])
async def get_available_models_route():
    """List all available Ollama models."""
    models = await list_available_models()
    return [
        OllamaModelInfo(
            name=m.get("name", ""),
            size=str(m.get("size", "")),
            modified_at=m.get("modified_at", ""),
        )
        for m in models
    ]


@router.post("/system/settings")
async def update_settings(update: SettingsUpdate):
    """Update model settings (runtime only, does not persist to .env)."""
    if update.ocr_model:
        settings.OCR_MODEL = update.ocr_model
    if update.llm_model:
        settings.LLM_MODEL = update.llm_model

    return {
        "ocr_model": settings.OCR_MODEL,
        "llm_model": settings.LLM_MODEL,
    }
