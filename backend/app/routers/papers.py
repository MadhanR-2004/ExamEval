"""
Papers Router - Upload and manage exam papers (MongoDB).
"""

import os
import uuid
from datetime import datetime
from io import BytesIO

import fitz  # PyMuPDF
from bson import ObjectId
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from PIL import Image
from typing import List

from app.database import get_db
from app.config import settings
from app.models import PaperStatus
from app.schemas import PaperResponse

router = APIRouter(prefix="/papers", tags=["Papers"])


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


@router.post("/upload", response_model=PaperResponse, status_code=201)
async def upload_paper(
    background_tasks: BackgroundTasks,
    exam_id: str = Form(...),
    student_name: str = Form(...),
    student_id: str = Form(None),
    files: List[UploadFile] = File(...),
    auto_evaluate: bool = Form(True),
):
    """
    Upload exam paper images for a student.
    Supports multiple image files for multi-page papers.
    """
    db = get_db()

    # Verify exam exists
    try:
        exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Create upload directory
    upload_dir = os.path.join(settings.UPLOAD_DIR, f"exam_{exam_id}")
    os.makedirs(upload_dir, exist_ok=True)

    # Save uploaded files (images directly, PDFs converted to images)
    ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/tiff"}
    ALLOWED_PDF_TYPES = {"application/pdf"}
    saved_paths = []

    for file in files:
        content = await file.read()
        ctype = file.content_type or ""

        if ctype in ALLOWED_PDF_TYPES or (
            file.filename and file.filename.lower().endswith(".pdf")
        ):
            # Convert each PDF page to a PNG image
            try:
                pdf_doc = fitz.open(stream=content, filetype="pdf")
                for page_num in range(len(pdf_doc)):
                    page = pdf_doc[page_num]
                    # Render at 300 DPI for good OCR quality
                    pix = page.get_pixmap(dpi=300)
                    img_bytes = pix.tobytes("png")
                    filename = f"{uuid.uuid4().hex}_page{page_num + 1}.png"
                    filepath = os.path.join(upload_dir, filename)
                    with open(filepath, "wb") as f:
                        f.write(img_bytes)
                    saved_paths.append(filepath)
                pdf_doc.close()
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to process PDF '{file.filename}': {str(e)}",
                )
        elif ctype in ALLOWED_IMAGE_TYPES or ctype.startswith("image/"):
            ext = os.path.splitext(file.filename)[1] if file.filename else ".png"
            filename = f"{uuid.uuid4().hex}{ext}"
            filepath = os.path.join(upload_dir, filename)
            with open(filepath, "wb") as f:
                f.write(content)
            saved_paths.append(filepath)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {ctype}. Only images and PDFs are accepted.",
            )

    if not saved_paths:
        raise HTTPException(status_code=400, detail="No valid files were processed.")

    # Create paper document
    doc = {
        "exam_id": exam_id,
        "student_name": student_name,
        "student_id": student_id,
        "image_paths": saved_paths,
        "extracted_text": None,
        "status": PaperStatus.UPLOADED,
        "total_score": None,
        "max_score": None,
        "percentage": None,
        "uploaded_at": datetime.utcnow(),
        "evaluated_at": None,
    }

    result = await db.papers.insert_one(doc)
    doc["_id"] = result.inserted_id

    if auto_evaluate:
        background_tasks.add_task(run_evaluation_bg, str(result.inserted_id))

    return _paper_doc_to_response(doc)


async def run_evaluation_bg(paper_id: str):
    """Run evaluation as background task."""
    from app.services.evaluation_service import process_paper
    import logging

    try:
        await process_paper(paper_id)
    except Exception as e:
        err_msg = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
        logging.getLogger(__name__).error(
            f"Background evaluation failed for paper {paper_id}: {err_msg}",
            exc_info=True,
        )


@router.get("/exam/{exam_id}", response_model=List[PaperResponse])
async def get_papers_by_exam(exam_id: str):
    """Get all papers for a specific exam."""
    db = get_db()
    papers = await db.papers.find({"exam_id": exam_id}).sort("uploaded_at", -1).to_list(10000)
    return [_paper_doc_to_response(p) for p in papers]


@router.get("/{paper_id}", response_model=PaperResponse)
async def get_paper(paper_id: str):
    """Get paper details."""
    db = get_db()
    try:
        paper = await db.papers.find_one({"_id": ObjectId(paper_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid paper ID")
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return _paper_doc_to_response(paper)


@router.delete("/{paper_id}", status_code=204)
async def delete_paper(paper_id: str):
    """Delete a paper and its files."""
    db = get_db()
    try:
        paper = await db.papers.find_one({"_id": ObjectId(paper_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid paper ID")
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Delete files
    for path in paper.get("image_paths", []):
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

    # Delete evaluations and paper
    await db.evaluations.delete_many({"paper_id": paper_id})
    await db.papers.delete_one({"_id": ObjectId(paper_id)})
