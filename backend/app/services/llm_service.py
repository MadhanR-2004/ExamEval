"""
LLM Service - Evaluates student answers using Ollama language models.
"""

import json
import re
import logging
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def check_ollama_connection() -> bool:
    """Check if Ollama is reachable."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


async def list_available_models() -> list[dict]:
    """List all models available in Ollama."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            r.raise_for_status()
            return r.json().get("models", [])
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        return []


async def evaluate_answer(
    question_number: int,
    question_text: str,
    expected_answer: str,
    student_answer: str,
    max_marks: float,
    keywords: list[str] | None = None,
) -> dict:
    """
    Use an LLM to evaluate a student's answer against the expected answer and based on your knowledge as well. check the whole content based on the questions

    Returns dict with: score, max_score, feedback
    """
    if not student_answer or student_answer.strip() == "":
        return {
            "score": 0,
            "max_score": max_marks,
            "feedback": "No answer provided by the student.",
        }

    keyword_text = ""
    if keywords:
        keyword_text = f"\nKey concepts/keywords to look for: {', '.join(keywords)}"

    prompt = f"""You are an expert exam evaluator. Evaluate the student's answer against the expected answer for the following question.

**Question {question_number}:** {question_text}

**Expected Answer (Model Answer):**
{expected_answer}
{keyword_text}

**Student's Answer:**
{student_answer}

**Maximum Marks:** {max_marks}

**Evaluation Criteria:**
1. Compare the student's answer to the expected/model answer.
2. Check for correctness, completeness, and relevance.
3. Award partial marks for partially correct answers.
4. Consider key concepts and keywords if provided.
5. Minor spelling/grammar errors should not heavily penalize if the concept is correct.
6. If the student's answer demonstrates understanding of the core concept, award proportional marks.

**IMPORTANT:** You must respond ONLY with a valid JSON object (no markdown, no extra text) in this exact format:
{{
  "score": <number between 0 and {max_marks}>,
  "feedback": "<brief evaluation feedback explaining the score>"
}}"""

    url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": settings.LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.3,
            "num_predict": 1024,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                error_detail = response.text[:500]
                logger.error(
                    f"Ollama LLM error (model={settings.LLM_MODEL}): "
                    f"status={response.status_code}, body={error_detail}"
                )
                return {
                    "score": 0,
                    "max_score": max_marks,
                    "feedback": (
                        f"LLM model '{settings.LLM_MODEL}' returned {response.status_code}. "
                        f"Detail: {error_detail}"
                    ),
                }
            result = response.json()

        raw_response = result.get("response", "").strip()
        logger.info(f"LLM response for Q{question_number}: {raw_response[:200]}")

        parsed = _parse_llm_json(raw_response)

        score = float(parsed.get("score", 0))
        score = max(0, min(score, max_marks))  # Clamp to [0, max_marks]

        return {
            "score": score,
            "max_score": max_marks,
            "feedback": parsed.get("feedback", "Evaluation complete."),
        }
    except Exception as e:
        logger.error(f"LLM evaluation failed for Q{question_number}: {e}")
        return {
            "score": 0,
            "max_score": max_marks,
            "feedback": f"Evaluation error: {str(e)}",
        }


async def extract_answers_with_llm(
    extracted_text: str,
    questions: list[dict],
) -> dict[int, str]:
    """
    Use an LLM to intelligently extract each student answer from the full OCR
    text, based on the actual exam questions.

    This replaces the fragile regex splitter.  The model is told exactly which
    questions exist and asked to return only the relevant answer text for each.

    Returns dict  {question_number: answer_text}
    """
    if not extracted_text or not questions:
        return {}

    question_list = "\n".join(
        f"  Q{q['question_number']}: {q['question_text']}" for q in questions
    )

    # Build the prompt as a plain string (no f-string braces issues)
    prompt = (
        "You are an expert at reading handwritten exam answer sheets.\n\n"
        "I will give you:\n"
        "  1. The raw OCR text extracted from a student's answer sheet.\n"
        "  2. The list of questions on the exam.\n\n"
        "Your job: figure out which portion of the OCR text is the student's "
        "answer to EACH question and return it.\n\n"
        "CRITICAL RULES:\n"
        "- Students may answer questions in ANY order (e.g. they might write "
        "question 5 first, then question 2). Do NOT assume answers appear in "
        "question order.\n"
        "- A single answer may contain numbered sub-points, bullet lists, "
        "definitions, or examples. These are PART of that one answer, NOT "
        "separate question answers. For instance if the student writes "
        "'1. Adjacent vertices  2. Cycle graph' inside an answer about graphs, "
        "those are sub-points of ONE answer.\n"
        "- Match answers to questions by MEANING and CONTEXT, not just by "
        "numbers found in the text.\n"
        "- If the student did not answer a question, return an empty string "
        "for that question.\n"
        "- Return ONLY the student's own answer text. Do NOT include the "
        "question itself or any header/title text from the paper.\n"
        "- Preserve the student's original wording.\n\n"
        "--- OCR TEXT START ---\n"
        f"{extracted_text}\n"
        "--- OCR TEXT END ---\n\n"
        "Questions on this exam:\n"
        f"{question_list}\n\n"
        "Respond ONLY with a valid JSON object. Keys are question numbers as "
        "strings, values are the student's answer text. Example:\n"
        '{"1": "answer text for question 1", "2": "answer text for question 2"}\n'
    )

    url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": settings.LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2,
            "num_predict": 4096,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                logger.error(
                    f"LLM answer-extraction error: status={response.status_code}"
                )
                return {}
            result = response.json()

        raw = result.get("response", "").strip()
        logger.info(f"LLM answer-extraction response (first 300 chars): {raw[:300]}")

        parsed = _parse_llm_json(raw)

        # Normalise keys to int
        answers: dict[int, str] = {}
        for key, value in parsed.items():
            try:
                q_num = int(key)
                answers[q_num] = str(value).strip()
            except (ValueError, TypeError):
                continue
        return answers

    except Exception as e:
        logger.error(f"LLM answer-extraction failed: {e}")
        return {}


def _parse_llm_json(text: str) -> dict:
    """Attempt to parse JSON from LLM response, handling quirks."""
    # Strip markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned).strip()

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find the outermost JSON object (handles nested braces)
    # Find first '{' and last '}'
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        candidate = cleaned[first_brace : last_brace + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # Fallback: try the simple non-nested regex (works for flat objects)
    json_match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # Last resort: extract score/feedback keys (for evaluation responses)
    score_match = re.search(r'"score"\s*:\s*([\d.]+)', text)
    feedback_match = re.search(r'"feedback"\s*:\s*"([^"]*)"', text)

    return {
        "score": float(score_match.group(1)) if score_match else 0,
        "feedback": feedback_match.group(1) if feedback_match else "Could not parse evaluation.",
    }
