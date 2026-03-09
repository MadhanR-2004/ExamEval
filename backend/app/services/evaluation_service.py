"""
Evaluation Service - Full pipeline: OCR → Parse → Evaluate via LLM → Store (MongoDB).
"""

import logging
from datetime import datetime
from bson import ObjectId

from app.database import get_db
from app.models import PaperStatus
from app.services.ocr_service import extract_text_from_images, parse_extracted_answers
from app.services.llm_service import evaluate_answer, extract_answers_with_llm

logger = logging.getLogger(__name__)


async def process_paper(paper_id: str):
    """
    Full pipeline for a single paper:
      1. OCR all images
      2. Parse extracted answers
      3. Match answers to exam questions
      4. Evaluate each answer with LLM
      5. Store evaluations & update paper scores
    """
    db = get_db()

    paper = await db.papers.find_one({"_id": ObjectId(paper_id)})
    if not paper:
        logger.error(f"Paper {paper_id} not found")
        return

    exam = await db.exams.find_one({"_id": ObjectId(paper["exam_id"])})
    if not exam:
        logger.error(f"Exam {paper['exam_id']} not found for paper {paper_id}")
        await _set_paper_failed(db, paper_id, "Associated exam not found")
        return

    try:
        # ── Step 1: OCR ───────────────────────────────────
        await db.papers.update_one(
            {"_id": ObjectId(paper_id)}, {"$set": {"status": PaperStatus.OCR_PROCESSING}}
        )

        image_paths = paper.get("image_paths", [])
        if not image_paths:
            await _set_paper_failed(db, paper_id, "No images to process")
            return

        logger.info(f"Starting OCR for paper {paper_id} ({len(image_paths)} images)")
        extracted_text = await extract_text_from_images(image_paths)

        await db.papers.update_one(
            {"_id": ObjectId(paper_id)},
            {"$set": {"extracted_text": extracted_text, "status": PaperStatus.OCR_COMPLETED}},
        )

        # ── Step 2: Parse answers (LLM-based, regex fallback) ─
        questions = exam.get("questions", [])
        student_answers = await extract_answers_with_llm(extracted_text, questions)
        if not student_answers:
            logger.warning(
                f"LLM extraction returned nothing for paper {paper_id}, "
                "falling back to regex parser"
            )
            student_answers = parse_extracted_answers(extracted_text)
        logger.info(f"Parsed {len(student_answers)} answers from paper {paper_id}")

        # ── Step 3: Evaluate against exam questions ──────
        await db.papers.update_one(
            {"_id": ObjectId(paper_id)}, {"$set": {"status": PaperStatus.EVALUATING}}
        )

        # Delete any previous evaluations for re-processing
        await db.evaluations.delete_many({"paper_id": paper_id})

        total_score = 0
        max_score = 0

        for q in questions:
            q_num = q["question_number"]
            student_answer = student_answers.get(q_num, "")

            result = await evaluate_answer(
                question_number=q_num,
                question_text=q["question_text"],
                expected_answer=q["expected_answer"],
                student_answer=student_answer,
                max_marks=q["max_marks"],
                keywords=q.get("keywords"),
            )

            eval_doc = {
                "paper_id": paper_id,
                "question_number": q_num,
                "question_text": q["question_text"],
                "expected_answer": q["expected_answer"],
                "extracted_answer": student_answer if student_answer else None,
                "score": result["score"],
                "max_score": result["max_score"],
                "feedback": result.get("feedback"),
                "keywords": q.get("keywords"),
                "evaluated_at": datetime.utcnow(),
            }
            await db.evaluations.insert_one(eval_doc)

            total_score += result["score"]
            max_score += result["max_score"]

        # ── Step 4: Update paper totals ──────────────────
        percentage = round((total_score / max_score * 100), 2) if max_score > 0 else 0

        await db.papers.update_one(
            {"_id": ObjectId(paper_id)},
            {
                "$set": {
                    "status": PaperStatus.EVALUATED,
                    "total_score": total_score,
                    "max_score": max_score,
                    "percentage": percentage,
                    "evaluated_at": datetime.utcnow(),
                }
            },
        )

        logger.info(
            f"Paper {paper_id} evaluated: {total_score}/{max_score} ({percentage}%)"
        )

    except Exception as e:
        err_msg = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
        logger.error(f"Evaluation pipeline failed for paper {paper_id}: {err_msg}", exc_info=True)
        await _set_paper_failed(db, paper_id, err_msg)
        raise


async def re_evaluate_paper(paper_id: str):
    """
    Re-evaluate a paper using existing OCR text (skip OCR step).
    Useful when switching LLM models or updating questions.
    """
    db = get_db()

    paper = await db.papers.find_one({"_id": ObjectId(paper_id)})
    if not paper:
        logger.error(f"Paper {paper_id} not found for re-evaluation")
        return

    if not paper.get("extracted_text"):
        logger.info(f"No OCR text for paper {paper_id}, running full pipeline")
        await process_paper(paper_id)
        return

    exam = await db.exams.find_one({"_id": ObjectId(paper["exam_id"])})
    if not exam:
        await _set_paper_failed(db, paper_id, "Associated exam not found")
        return

    try:
        await db.papers.update_one(
            {"_id": ObjectId(paper_id)}, {"$set": {"status": PaperStatus.EVALUATING}}
        )

        # Delete old evaluations
        await db.evaluations.delete_many({"paper_id": paper_id})

        questions = exam.get("questions", [])
        student_answers = await extract_answers_with_llm(
            paper["extracted_text"], questions
        )
        if not student_answers:
            logger.warning(
                f"LLM extraction returned nothing for paper {paper_id}, "
                "falling back to regex parser"
            )
            student_answers = parse_extracted_answers(paper["extracted_text"])

        total_score = 0
        max_score = 0

        for q in questions:
            q_num = q["question_number"]
            student_answer = student_answers.get(q_num, "")

            result = await evaluate_answer(
                question_number=q_num,
                question_text=q["question_text"],
                expected_answer=q["expected_answer"],
                student_answer=student_answer,
                max_marks=q["max_marks"],
                keywords=q.get("keywords"),
            )

            eval_doc = {
                "paper_id": paper_id,
                "question_number": q_num,
                "question_text": q["question_text"],
                "expected_answer": q["expected_answer"],
                "extracted_answer": student_answer if student_answer else None,
                "score": result["score"],
                "max_score": result["max_score"],
                "feedback": result.get("feedback"),
                "keywords": q.get("keywords"),
                "evaluated_at": datetime.utcnow(),
            }
            await db.evaluations.insert_one(eval_doc)

            total_score += result["score"]
            max_score += result["max_score"]

        percentage = round((total_score / max_score * 100), 2) if max_score > 0 else 0

        await db.papers.update_one(
            {"_id": ObjectId(paper_id)},
            {
                "$set": {
                    "status": PaperStatus.EVALUATED,
                    "total_score": total_score,
                    "max_score": max_score,
                    "percentage": percentage,
                    "evaluated_at": datetime.utcnow(),
                }
            },
        )

        logger.info(
            f"Paper {paper_id} re-evaluated: {total_score}/{max_score} ({percentage}%)"
        )

    except Exception as e:
        err_msg = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
        logger.error(f"Re-evaluation failed for paper {paper_id}: {err_msg}", exc_info=True)
        await _set_paper_failed(db, paper_id, err_msg)
        raise


async def _set_paper_failed(db, paper_id: str, reason: str):
    """Mark a paper as failed."""
    await db.papers.update_one(
        {"_id": ObjectId(paper_id)},
        {"$set": {"status": PaperStatus.FAILED, "extracted_text": f"Error: {reason}"}},
    )
