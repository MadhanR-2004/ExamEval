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
    Use an LLM to evaluate a student's answer against the expected answer.

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


def _parse_llm_json(text: str) -> dict:
    """Attempt to parse JSON from LLM response, handling quirks."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON object in response
    json_match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # Extract score with regex fallback
    score_match = re.search(r'"score"\s*:\s*([\d.]+)', text)
    feedback_match = re.search(r'"feedback"\s*:\s*"([^"]*)"', text)

    return {
        "score": float(score_match.group(1)) if score_match else 0,
        "feedback": feedback_match.group(1) if feedback_match else "Could not parse evaluation.",
    }
