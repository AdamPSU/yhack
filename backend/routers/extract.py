"""File ingestion endpoint — PDF only."""

from __future__ import annotations

import io
import logging

from fastapi import APIRouter, Form, HTTPException, UploadFile

from models.schemas import ContextSourceResponse
from services.context_store import create_source_record

logger = logging.getLogger(__name__)

router = APIRouter()


async def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(p.strip() for p in pages if p.strip())


def _pdf_summary(text: str) -> str:
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    if not paragraphs:
        return ""
    return " ".join(paragraphs[:2]).strip()[:600]


def _source_response(record: dict) -> ContextSourceResponse:
    return ContextSourceResponse(
        id=record["id"],
        kind=record["kind"],
        filename=record["filename"],
        label=record["label"],
        status=record["status"],
        preview_text=record["preview_text"],
        summary=record["summary"],
        metadata=record["metadata"],
    )


@router.post("/context/sources", response_model=ContextSourceResponse)
async def upload_context_source(
    file: UploadFile,
    label: str | None = Form(default=None),
) -> ContextSourceResponse:
    data = await file.read()
    filename = (file.filename or "source").lower()

    if not filename.endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only PDF files are supported.")

    logger.info("PDF upload: file=%s size=%d", filename, len(data))

    text = await _extract_pdf(data)
    if not text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the PDF.")

    summary = _pdf_summary(text)
    record = create_source_record(
        kind="pdf",
        filename=file.filename or "policy.pdf",
        label=label or file.filename or "Policy Document",
        preview_text=summary or text[:500],
        summary=summary or "Primary policy document ready.",
        metadata={"page_count_estimate": max(1, text.count("\n\n"))},
        content_text=text.strip(),
    )
    return _source_response(record)


@router.post("/extract")
async def extract_file(file: UploadFile) -> dict[str, str]:
    data = await file.read()
    filename = (file.filename or "").lower()

    if not filename.endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only PDF files are supported.")

    logger.info("extract: file=%s size=%d", filename, len(data))
    try:
        text = await _extract_pdf(data)
    except Exception as e:
        logger.exception("extract: failed for %s", filename)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}") from e

    if not text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the PDF.")

    logger.info("extract: extracted %d chars from %s", len(text), filename)
    return {"text": text.strip()}
