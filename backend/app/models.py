"""
MongoDB document helpers and status enum.
No ORM models needed — documents are plain dicts stored in MongoDB collections.

Collections:
  - exams: { _id, title, subject, description, total_marks, questions: [...], created_at, updated_at }
  - papers: { _id, exam_id, student_name, student_id, image_paths: [...], extracted_text, status, total_score, max_score, percentage, uploaded_at, evaluated_at }
  - evaluations: { _id, paper_id, question_number, question_text, expected_answer, extracted_answer, score, max_score, feedback, keywords, evaluated_at }
"""

import enum


class PaperStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    OCR_PROCESSING = "ocr_processing"
    OCR_COMPLETED = "ocr_completed"
    EVALUATING = "evaluating"
    EVALUATED = "evaluated"
    FAILED = "failed"
