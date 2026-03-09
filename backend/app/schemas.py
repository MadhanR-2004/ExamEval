from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Question Schemas ──────────────────────────────────────

class QuestionCreate(BaseModel):
    question_number: int
    question_text: str
    expected_answer: str
    max_marks: float
    keywords: Optional[List[str]] = None


class QuestionResponse(BaseModel):
    question_number: int
    question_text: str
    expected_answer: str
    max_marks: float
    keywords: Optional[List[str]] = None


# ── Exam Schemas ──────────────────────────────────────────

class ExamCreate(BaseModel):
    title: str
    subject: str
    description: Optional[str] = None
    questions: List[QuestionCreate]


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None


class ExamResponse(BaseModel):
    id: str
    title: str
    subject: str
    description: Optional[str] = None
    total_marks: float
    created_at: datetime
    updated_at: datetime
    questions: List[QuestionResponse] = []


class ExamListResponse(BaseModel):
    id: str
    title: str
    subject: str
    total_marks: float
    question_count: int
    paper_count: int
    created_at: datetime


# ── Paper Schemas ─────────────────────────────────────────

class PaperResponse(BaseModel):
    id: str
    exam_id: str
    student_name: str
    student_id: Optional[str] = None
    image_paths: List[str] = []
    extracted_text: Optional[str] = None
    status: str
    total_score: Optional[float] = None
    max_score: Optional[float] = None
    percentage: Optional[float] = None
    uploaded_at: datetime
    evaluated_at: Optional[datetime] = None


# ── Evaluation Schemas ────────────────────────────────────

class EvaluationResponse(BaseModel):
    id: str
    paper_id: str
    question_number: int
    question_text: str
    expected_answer: str
    extracted_answer: Optional[str] = None
    score: float
    max_score: float
    feedback: Optional[str] = None
    keywords: Optional[List[str]] = None
    evaluated_at: datetime


class PaperDetailResponse(BaseModel):
    id: str
    exam_id: str
    student_name: str
    student_id: Optional[str] = None
    image_paths: List[str] = []
    extracted_text: Optional[str] = None
    status: str
    total_score: Optional[float] = None
    max_score: Optional[float] = None
    percentage: Optional[float] = None
    uploaded_at: datetime
    evaluated_at: Optional[datetime] = None
    evaluations: List[EvaluationResponse] = []
    exam: Optional[ExamResponse] = None


# ── Dashboard Schemas ─────────────────────────────────────

class DashboardStats(BaseModel):
    total_exams: int
    total_papers: int
    total_evaluated: int
    average_score: Optional[float] = None
    recent_evaluations: List[PaperResponse] = []


# ── Ollama Model Schemas ─────────────────────────────────

class OllamaModelInfo(BaseModel):
    name: str
    size: Optional[str] = None
    modified_at: Optional[str] = None


class SettingsUpdate(BaseModel):
    ocr_model: Optional[str] = None
    llm_model: Optional[str] = None
