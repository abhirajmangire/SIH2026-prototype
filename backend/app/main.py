import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.ocr.service import extract_text
from app.ocr.mrz import extract_mrz
from app.ocr.checksum import validate_passport_mrz
from app.validation.service import (
    validate_document,
    detect_document_type,
)
from app.ocr.parser import parse_ocr_text
from app.verification.cross_document import cross_verify
from app.tampering.service import analyze_tampering
from app.face.service import verify_faces
from app.risk.service import calculate_risk
from app.verification.case_verification import verify_case


# ============================================================
# Paths
# ============================================================

BASE_DIR = Path(
    __file__
).resolve().parent

TAMPERING_OUTPUT_DIR = (
    BASE_DIR
    / "tampering"
    / "outputs"
)

TAMPERING_OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# ============================================================
# Application
# ============================================================

app = FastAPI(
    title="AI Document Screening API",
    version="1.0.0",
    description=(
        "AI-powered multimodal identity and "
        "document screening API."
    ),
)


# ============================================================
# Static forensic evidence
# ============================================================

app.mount(
    "/tampering",
    StaticFiles(
        directory=str(
            TAMPERING_OUTPUT_DIR
        )
    ),
    name="tampering",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Prototype in-memory case history
# ============================================================

CASE_HISTORY: dict[str, dict] = {}


# ============================================================
# Constants
# ============================================================

MAX_FILE_SIZE = 15 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
}

ALLOWED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


# ============================================================
# Pydantic models
# ============================================================

class OfficerDecisionRequest(BaseModel):

    case_id: str = Field(
        min_length=1,
        max_length=100,
    )

    decision: str = Field(
        min_length=1,
        max_length=50,
    )

    officer_name: str = Field(
        default="Officer",
        max_length=100,
    )

    notes: str = Field(
        default="",
        max_length=2000,
    )


# ============================================================
# Helpers
# ============================================================

async def read_validated_file(
    file: UploadFile,
    allow_pdf: bool = True,
) -> bytes:

    filename = (
        file.filename
        or "uploaded_file"
    )

    extension = (
        Path(filename)
        .suffix
        .lower()
    )

    allowed = (
        ALLOWED_EXTENSIONS
        if allow_pdf
        else ALLOWED_IMAGE_EXTENSIONS
    )

    if extension not in allowed:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type: {extension}. "
                f"Allowed types: "
                f"{', '.join(sorted(allowed))}"
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:

        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    if len(file_bytes) > MAX_FILE_SIZE:

        raise HTTPException(
            status_code=413,
            detail=(
                "File exceeds the 15 MB prototype limit."
            ),
        )

    return file_bytes


def generate_case_id() -> str:

    timestamp = datetime.now(
        timezone.utc
    ).strftime(
        "%Y%m%d%H%M%S"
    )

    return (
        f"CASE-{timestamp}-"
        f"{uuid.uuid4().hex[:6].upper()}"
    )


# ============================================================
# Root
# ============================================================

@app.get("/")
def root():

    return {
        "message": (
            "AI Document Screening API is running"
        ),
        "version": "1.0.0",
        "status": "operational",
        "modules": [
            "OCR Extraction",
            "MRZ Processing",
            "Document Validation",
            "Cross-Document Verification",
            "Tampering Detection",
            "Face Verification",
            "Risk Assessment",
        ],
    }


# ============================================================
# Health
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "timestamp": datetime.now(
            timezone.utc
        ).isoformat(),
    }


# ============================================================
# OCR + complete document analysis
# ============================================================

@app.post("/ocr/extract")
async def extract_ocr(
    file: UploadFile = File(...),
):

    file_bytes = await read_validated_file(
        file,
        allow_pdf=False,
    )

    try:

        # -----------------------------------------------------
        # 1. OCR
        # -----------------------------------------------------

        text = extract_text(
            file_bytes,
            file.filename or "",
        )

        # -----------------------------------------------------
        # 2. OCR field extraction
        # -----------------------------------------------------

        parsed_data = parse_ocr_text(
            text
        )

        # -----------------------------------------------------
        # 3. MRZ extraction
        # -----------------------------------------------------

        mrz = extract_mrz(
            text
        )

        # -----------------------------------------------------
        # 4. MRZ checksum validation
        # -----------------------------------------------------

        mrz_validation = (
            validate_passport_mrz(
                mrz
            )
        )

        # -----------------------------------------------------
        # 5. Preserve OCR document number
        # -----------------------------------------------------

        if len(mrz) == 2:

            mrz_line2 = mrz[1]

            mrz_document_number = (
                mrz_line2[0:9]
                .replace(
                    "<",
                    "",
                )
                .strip()
            )

            if mrz_document_number:

                parsed_data[
                    "mrzDocumentNumber"
                ] = mrz_document_number

        # -----------------------------------------------------
        # 6. Determine document type
        # -----------------------------------------------------

        document_type = (
            detect_document_type(
                {
                    **parsed_data,
                    "mrz": mrz,
                }
            )
        )

        parsed_data[
            "documentType"
        ] = document_type

        # -----------------------------------------------------
        # 7. OCR ↔ MRZ verification
        # -----------------------------------------------------

        cross_verification = (
            cross_verify(
                parsed_data,
                mrz,
            )
        )

        # -----------------------------------------------------
        # 8. Document validation
        # -----------------------------------------------------

        document_validation = (
            validate_document(
                parsed_data,
                document_type,
            )
        )

        # -----------------------------------------------------
        # 9. Tampering detection
        # -----------------------------------------------------

        tampering_result = (
            analyze_tampering(
                file_bytes
            )
        )

        # -----------------------------------------------------
        # 10. Face verification
        #
        # A selfie is required for actual face matching.
        # Never fabricate a successful result here.
        # -----------------------------------------------------

        face_verification = {
            "status": "not_run",
            "match": False,
            "confidence": 0,
            "risk_level": "UNKNOWN",
            "reason": (
                "Selfie not provided. "
                "Use /face/verify for face comparison."
            ),
        }

        # -----------------------------------------------------
        # 11. Risk calculation
        # -----------------------------------------------------

        risk = calculate_risk(
            mrz_validation,
            cross_verification,
            document_validation,
            tampering_result,
            face_verification,
        )

        result = {
            "filename": file.filename,
            "status": "completed",
            "text": text,
            "parsed_data": parsed_data,
            "mrz": mrz,
            "mrz_validation": mrz_validation,
            "cross_verification": cross_verification,
            "document_validation": document_validation,
            "tampering": tampering_result,
            "face_verification": face_verification,
            "risk": risk,
        }

        return result

    except HTTPException:
        raise

    except Exception as error:

        return {
            "filename": file.filename,
            "status": "failed",
            "error": str(error),
        }


# ============================================================
# Case verification
# ============================================================

@app.post("/verification/case")
async def verify_passenger_case(
    documents: list[dict],
):

    if not documents:

        raise HTTPException(
            status_code=400,
            detail="At least one document is required.",
        )

    case_id = generate_case_id()

    result = verify_case(
        documents
    )

    case = {
        "case_id": case_id,
        "created_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "status": "PENDING_REVIEW",
        "decision": None,
        "officer": None,
        "notes": "",
        "documents": documents,
        "verification": result,
    }

    CASE_HISTORY[case_id] = case

    return case


# ============================================================
# Get case
# ============================================================

@app.get("/verification/case/{case_id}")
def get_case(
    case_id: str,
):

    case = CASE_HISTORY.get(
        case_id
    )

    if case is None:

        raise HTTPException(
            status_code=404,
            detail="Case not found.",
        )

    return case


# ============================================================
# Officer decision
# ============================================================

@app.post("/verification/decision")
def officer_decision(
    request: OfficerDecisionRequest,
):

    case = CASE_HISTORY.get(
        request.case_id
    )

    if case is None:

        raise HTTPException(
            status_code=404,
            detail="Case not found.",
        )

    decision = (
        request.decision
        .strip()
        .upper()
    )

    allowed_decisions = {
        "APPROVE",
        "VERIFIED",
        "CLEAR",
        "MANUAL_REVIEW",
        "REJECT",
        "SUSPICIOUS",
        "ESCALATE",
    }

    if decision not in allowed_decisions:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid decision. "
                "Use APPROVE, MANUAL_REVIEW, "
                "REJECT, VERIFIED, CLEAR, "
                "SUSPICIOUS or ESCALATE."
            ),
        )

    if decision in {
        "APPROVE",
        "VERIFIED",
        "CLEAR",
    }:

        status = "COMPLETED"

    elif decision in {
        "REJECT",
        "SUSPICIOUS",
        "ESCALATE",
    }:

        status = "ESCALATED"

    else:

        status = "MANUAL_REVIEW"

    case["decision"] = decision

    case["status"] = status

    case["officer"] = (
        request.officer_name
    )

    case["notes"] = request.notes

    case["completed_at"] = (
        datetime.now(
            timezone.utc
        ).isoformat()
    )

    return {
        "success": True,
        "case": case,
        "message": (
            "Officer decision recorded successfully."
        ),
    }


# ============================================================
# Case history
# ============================================================

@app.get("/verification/history")
def verification_history():

    cases = list(
        CASE_HISTORY.values()
    )

    cases.sort(
        key=lambda item: item.get(
            "created_at",
            "",
        ),
        reverse=True,
    )

    return {
        "count": len(cases),
        "cases": [
            {
                "case_id": case.get(
                    "case_id"
                ),
                "created_at": case.get(
                    "created_at"
                ),
                "status": case.get(
                    "status"
                ),
                "decision": case.get(
                    "decision"
                ),
                "officer": case.get(
                    "officer"
                ),
                "score": case.get(
                    "verification",
                    {},
                ).get(
                    "score",
                    0,
                ),
                "level": case.get(
                    "verification",
                    {},
                ).get(
                    "level",
                    "UNKNOWN",
                ),
                "recommended_action": case.get(
                    "verification",
                    {},
                ).get(
                    "recommended_action",
                    "MANUAL_REVIEW",
                ),
            }
            for case in cases
        ],
    }


# ============================================================
# Tampering
# ============================================================

@app.post("/tampering/analyze")
async def analyze_document_tampering(
    file: UploadFile = File(...),
):

    file_bytes = await read_validated_file(
        file,
        allow_pdf=False,
    )

    try:

        return analyze_tampering(
            file_bytes
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Tampering analysis failed: {error}"
            ),
        )


# ============================================================
# Face verification
# ============================================================

@app.post("/face/verify")
async def verify_face(
    document: UploadFile = File(...),
    selfie: UploadFile = File(...),
):

    document_bytes = (
        await read_validated_file(
            document,
            allow_pdf=False,
        )
    )

    selfie_bytes = (
        await read_validated_file(
            selfie,
            allow_pdf=False,
        )
    )

    try:

        return verify_faces(
            document_bytes,
            selfie_bytes,
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Face verification failed: {error}"
            ),
        )