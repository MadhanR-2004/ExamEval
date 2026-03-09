"""
OCR Service - Extracts handwritten text from exam paper images using Ollama vision model.
"""

import base64
import asyncio
import gc
import os
import re
import logging
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


OCR_TIMEOUT = 600.0  # 10 minutes per image
OCR_MAX_RETRIES = 2  # retry once on timeout


async def extract_text_from_image(image_path: str) -> str:
    """
    Send an image to Ollama vision model for OCR-style handwriting recognition.
    Returns extracted raw text.  Retries automatically on timeout.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    file_size = os.path.getsize(image_path)
    logger.info(
        f"Reading image {os.path.basename(image_path)} ({file_size / 1024:.1f} KB)"
    )

    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    prompt = (
        "You are an expert OCR system for handwritten exam answer sheets. "
        "Extract ALL written text from this image as accurately as possible. "
    )

    url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": settings.OCR_MODEL,
        "prompt": prompt,
        "images": [image_data],
        "stream": False,
        "keep_alive": "2m",  # free model from VRAM after 2 min idle
        "options": {
            "temperature": 0.1,
            "num_predict": 4096,
        },
    }

    last_err: Exception | None = None
    for attempt in range(1, OCR_MAX_RETRIES + 1):
        try:
            logger.info(
                f"OCR attempt {attempt}/{OCR_MAX_RETRIES} for "
                f"{os.path.basename(image_path)} (timeout={OCR_TIMEOUT}s)"
            )
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(OCR_TIMEOUT, connect=30.0)
            ) as client:
                response = await client.post(url, json=payload)

            if response.status_code != 200:
                error_detail = response.text[:500]
                logger.error(
                    f"Ollama OCR error (model={settings.OCR_MODEL}): "
                    f"status={response.status_code}, body={error_detail}"
                )
                raise RuntimeError(
                    f"OCR model '{settings.OCR_MODEL}' returned {response.status_code}. "
                    f"Make sure it is a vision model (e.g. llava, minicpm-v). "
                    f"Detail: {error_detail}"
                )
            result = response.json()
            extracted = result.get("response", "").strip()
            logger.info(
                f"OCR extracted {len(extracted)} chars from "
                f"{os.path.basename(image_path)}"
            )

            # Free large objects from memory immediately
            del image_data, payload, response, result
            gc.collect()

            return extracted

        except (httpx.TimeoutException, httpx.ReadTimeout) as e:
            last_err = e
            logger.warning(
                f"OCR timeout on attempt {attempt}/{OCR_MAX_RETRIES} for "
                f"{os.path.basename(image_path)}: {type(e).__name__}"
            )
            if attempt < OCR_MAX_RETRIES:
                await asyncio.sleep(2)  # small backoff before retry

    # Clean up even on failure
    del image_data, payload
    gc.collect()

    raise RuntimeError(
        f"OCR timed out after {OCR_MAX_RETRIES} attempts "
        f"({OCR_TIMEOUT}s each) for {os.path.basename(image_path)}. "
        f"The image may be too large or the model too slow. "
        f"Last error: {type(last_err).__name__}"
    )


async def extract_text_from_images(image_paths: list[str]) -> str:
    """
    Extract text from multiple images (multi-page paper) and merge results.
    Clears memory between pages to avoid accumulation.
    """
    all_text = []
    for i, path in enumerate(image_paths):
        logger.info(f"Processing image {i + 1}/{len(image_paths)}: {path}")
        text = await extract_text_from_image(path)
        if text:
            all_text.append(f"--- Page {i + 1} ---\n{text}")

        # Force garbage collection between pages to free VRAM-related
        # Python-side buffers (base64 strings, response dicts, etc.)
        gc.collect()

        # Small pause between pages so Ollama can release GPU context
        if i + 1 < len(image_paths):
            logger.info("Pausing 3s between pages to let GPU memory settle...")
            await asyncio.sleep(3)

    return "\n\n".join(all_text)


def parse_extracted_answers(text: str) -> dict[int, str]:
    """
    Parse OCR extracted text into a dict of {question_number: answer_text}.
    Handles various formats: Q1:, 1., 1), Question 1:, etc.
    """
    answers: dict[int, str] = {}
    if not text:
        return answers

    # Remove page separators
    clean = re.sub(r"---\s*Page\s*\d+\s*---", "", text)

    # Patterns for question numbers
    patterns = [
        r"Q\.?\s*(\d+)\s*[:.\-)]\s*",
        r"Question\.?\s*(\d+)\s*[:.\-)]\s*",
        r"(?:^|\n)\s*(\d+)\s*[).\-:]\s*",
        r"Ans(?:wer)?\.?\s*(\d+)\s*[:.\-)]\s*",
    ]

    combined = "|".join(f"(?:{p})" for p in patterns)

    splits = re.split(combined, clean, flags=re.IGNORECASE | re.MULTILINE)

    # Find all question numbers and their positions to pair with answers
    matches = list(re.finditer(combined, clean, flags=re.IGNORECASE | re.MULTILINE))

    for i, match in enumerate(matches):
        # Extract question number from whichever group matched
        q_num = None
        for g in match.groups():
            if g and g.isdigit():
                q_num = int(g)
                break
        if q_num is None:
            continue

        # Get the text between this match end and the next match start
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(clean)
        answer_text = clean[start:end].strip()

        if answer_text:
            answers[q_num] = answer_text

    return answers
