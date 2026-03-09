"""
Exams Router - CRUD operations for exams and questions (MongoDB).
"""

from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, HTTPException
from typing import List

from app.database import get_db
from app.schemas import ExamCreate, ExamUpdate, ExamResponse, ExamListResponse

router = APIRouter(prefix="/exams", tags=["Exams"])


def _exam_doc_to_response(doc: dict) -> dict:
    """Convert a MongoDB exam document to API response format."""
    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "subject": doc["subject"],
        "description": doc.get("description"),
        "total_marks": doc.get("total_marks", 0),
        "created_at": doc.get("created_at", datetime.utcnow()),
        "updated_at": doc.get("updated_at", datetime.utcnow()),
        "questions": doc.get("questions", []),
    }


@router.post("/", response_model=ExamResponse, status_code=201)
async def create_exam(exam_data: ExamCreate):
    """Create a new exam with questions."""
    db = get_db()

    questions = []
    total_marks = 0
    for q in exam_data.questions:
        questions.append({
            "question_number": q.question_number,
            "question_text": q.question_text,
            "expected_answer": q.expected_answer,
            "max_marks": q.max_marks,
            "keywords": q.keywords or [],
        })
        total_marks += q.max_marks

    doc = {
        "title": exam_data.title,
        "subject": exam_data.subject,
        "description": exam_data.description,
        "total_marks": total_marks,
        "questions": questions,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.exams.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _exam_doc_to_response(doc)


@router.get("/", response_model=List[ExamListResponse])
async def list_exams():
    """List all exams with summary info."""
    db = get_db()
    exams = await db.exams.find().sort("created_at", -1).to_list(1000)
    result = []
    for exam in exams:
        paper_count = await db.papers.count_documents({"exam_id": str(exam["_id"])})
        result.append({
            "id": str(exam["_id"]),
            "title": exam["title"],
            "subject": exam["subject"],
            "total_marks": exam.get("total_marks", 0),
            "question_count": len(exam.get("questions", [])),
            "paper_count": paper_count,
            "created_at": exam.get("created_at", datetime.utcnow()),
        })
    return result


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(exam_id: str):
    """Get exam details with all questions."""
    db = get_db()
    try:
        exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return _exam_doc_to_response(exam)


@router.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(exam_id: str, exam_data: ExamUpdate):
    """Update exam metadata."""
    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid exam ID")

    exam = await db.exams.find_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    update_fields = {"updated_at": datetime.utcnow()}
    if exam_data.title is not None:
        update_fields["title"] = exam_data.title
    if exam_data.subject is not None:
        update_fields["subject"] = exam_data.subject
    if exam_data.description is not None:
        update_fields["description"] = exam_data.description

    await db.exams.update_one({"_id": oid}, {"$set": update_fields})
    updated = await db.exams.find_one({"_id": oid})
    return _exam_doc_to_response(updated)


@router.delete("/{exam_id}", status_code=204)
async def delete_exam(exam_id: str):
    """Delete an exam and all associated data."""
    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid exam ID")

    exam = await db.exams.find_one({"_id": oid})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Delete associated papers and evaluations
    papers = await db.papers.find({"exam_id": exam_id}).to_list(10000)
    paper_ids = [str(p["_id"]) for p in papers]
    if paper_ids:
        await db.evaluations.delete_many({"paper_id": {"$in": paper_ids}})
    await db.papers.delete_many({"exam_id": exam_id})
    await db.exams.delete_one({"_id": oid})
