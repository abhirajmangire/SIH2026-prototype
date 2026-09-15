from datetime import datetime
from typing import Optional


DATE_FORMATS = [
    "%d %b %Y",
    "%d %B %Y",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
]


SUPPORTED_DOCUMENT_TYPES = {
    "passport",
    "national_id",
    "driving_license",
    "visa",
    "identity_card",
    "unknown",
}


def parse_date(date_value: str) -> Optional[datetime]:
    if not date_value:
        return None

    value = str(date_value).strip()

    for date_format in DATE_FORMATS:
        try:
            return datetime.strptime(
                value,
                date_format,
            )
        except ValueError:
            continue

    return None


def normalize_document_type(
    document_type: Optional[str],
) -> str:

    if not document_type:
        return "unknown"

    value = (
        str(document_type)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )

    aliases = {
        "passport": "passport",
        "pass": "passport",
        "national_id": "national_id",
        "nationalid": "national_id",
        "aadhaar": "national_id",
        "aadhar": "national_id",
        "id_card": "identity_card",
        "identity_card": "identity_card",
        "identity": "identity_card",
        "driving_license": "driving_license",
        "driver_license": "driving_license",
        "drivers_license": "driving_license",
        "drivinglicence": "driving_license",
        "license": "driving_license",
        "licence": "driving_license",
        "visa": "visa",
    }

    return aliases.get(
        value,
        "unknown",
    )


def detect_document_type(data: dict) -> str:
    """
    Infer the document type from available verification evidence.

    The presence of MRZ data is treated as passport evidence.
    Explicit document_type always takes priority.
    """

    explicit_type = data.get(
        "documentType"
    )

    if explicit_type:
        return normalize_document_type(
            explicit_type
        )

    mrz = data.get("mrz")

    if isinstance(mrz, list) and len(mrz) >= 2:
        return "passport"

    if data.get("mrzDocumentNumber"):
        return "passport"

    return "unknown"


def validate_required_fields(
    data: dict,
    required_fields: list[str],
) -> list[str]:

    errors = []

    for field in required_fields:

        value = data.get(field)

        if value is None:
            errors.append(
                f"Missing field: {field}"
            )
            continue

        if not str(value).strip():
            errors.append(
                f"Missing field: {field}"
            )

    return errors


def validate_name(
    full_name: str,
) -> Optional[str]:

    if not full_name:
        return "Missing field: fullName"

    normalized = (
        str(full_name)
        .strip()
    )

    if len(normalized) < 2:
        return "Invalid name"

    return None


def validate_nationality(
    nationality: str,
) -> Optional[str]:

    if not nationality:
        return "Missing field: nationality"

    value = (
        str(nationality)
        .strip()
        .upper()
    )

    if len(value) < 2:
        return "Invalid nationality"

    return None


def validate_document_number(
    document_number: str,
) -> Optional[str]:

    if not document_number:
        return "Missing field: documentNumber"

    value = (
        str(document_number)
        .strip()
        .upper()
    )

    if len(value) < 4:
        return "Invalid document number"

    return None


def validate_date_field(
    data: dict,
    field: str,
    label: str,
) -> tuple[list[str], list[str]]:

    errors = []
    warnings = []

    value = data.get(field)

    if not value:
        errors.append(
            f"Missing field: {field}"
        )
        return errors, warnings

    parsed = parse_date(
        str(value)
    )

    if parsed is None:

        warnings.append(
            f"{label} format could not be verified"
        )

        return errors, warnings

    return errors, warnings


def validate_document(
    data: dict,
    document_type: Optional[str] = None,
) -> dict:

    errors = []
    warnings = []

    normalized_type = normalize_document_type(
        document_type
        or data.get("documentType")
        or detect_document_type(data)
    )

    # ---------------------------------------------------------
    # Basic identity fields
    # ---------------------------------------------------------

    required_fields = [
        "fullName",
        "dateOfBirth",
        "nationality",
        "documentNumber",
    ]

    errors.extend(
        validate_required_fields(
            data,
            required_fields,
        )
    )

    name_error = validate_name(
        data.get("fullName", "")
    )

    if name_error and name_error not in errors:
        errors.append(name_error)

    nationality_error = validate_nationality(
        data.get("nationality", "")
    )

    if (
        nationality_error
        and nationality_error not in errors
    ):
        errors.append(
            nationality_error
        )

    number_error = validate_document_number(
        data.get("documentNumber", "")
    )

    if (
        number_error
        and number_error not in errors
    ):
        errors.append(
            number_error
        )

    # ---------------------------------------------------------
    # Date of birth
    # ---------------------------------------------------------

    dob_errors, dob_warnings = validate_date_field(
        data,
        "dateOfBirth",
        "Date of birth",
    )

    errors.extend(dob_errors)
    warnings.extend(dob_warnings)

    # ---------------------------------------------------------
    # Document-specific validation
    # ---------------------------------------------------------

    if normalized_type == "passport":

        expiry = data.get(
            "expiryDate"
        )

        if not expiry:

            errors.append(
                "Missing field: expiryDate"
            )

        else:

            parsed_expiry = parse_date(
                str(expiry)
            )

            if parsed_expiry is None:

                warnings.append(
                    "Expiry date format could not be verified"
                )

            elif (
                parsed_expiry.date()
                < datetime.now().date()
            ):

                errors.append(
                    "Document is expired"
                )

        # Passport MRZ evidence.
        mrz = data.get("mrz")

        if not mrz and not data.get(
            "mrzDocumentNumber"
        ):

            warnings.append(
                "Passport MRZ evidence was not detected"
            )

    elif normalized_type == "driving_license":

        expiry = data.get(
            "expiryDate"
        )

        if expiry:

            parsed_expiry = parse_date(
                str(expiry)
            )

            if parsed_expiry is None:

                warnings.append(
                    "Driving licence expiry format "
                    "could not be verified"
                )

            elif (
                parsed_expiry.date()
                < datetime.now().date()
            ):

                errors.append(
                    "Driving licence is expired"
                )

        else:

            warnings.append(
                "Driving licence expiry date not detected"
            )

    elif normalized_type in {
        "national_id",
        "identity_card",
    }:

        expiry = data.get(
            "expiryDate"
        )

        if expiry:

            parsed_expiry = parse_date(
                str(expiry)
            )

            if parsed_expiry is None:

                warnings.append(
                    "Identity document expiry format "
                    "could not be verified"
                )

            elif (
                parsed_expiry.date()
                < datetime.now().date()
            ):

                errors.append(
                    "Identity document is expired"
                )

    elif normalized_type == "visa":

        expiry = data.get(
            "expiryDate"
        )

        if expiry:

            parsed_expiry = parse_date(
                str(expiry)
            )

            if parsed_expiry is None:

                warnings.append(
                    "Visa expiry format "
                    "could not be verified"
                )

            elif (
                parsed_expiry.date()
                < datetime.now().date()
            ):

                errors.append(
                    "Visa is expired"
                )

        else:

            warnings.append(
                "Visa expiry date not detected"
            )

    else:

        warnings.append(
            "Document type could not be determined"
        )

        expiry = data.get(
            "expiryDate"
        )

        if expiry:

            parsed_expiry = parse_date(
                str(expiry)
            )

            if parsed_expiry is None:

                warnings.append(
                    "Expiry date format could not be verified"
                )

            elif (
                parsed_expiry.date()
                < datetime.now().date()
            ):

                errors.append(
                    "Document is expired"
                )

    # ---------------------------------------------------------
    # Internal consistency
    # ---------------------------------------------------------

    mrz_document_number = data.get(
        "mrzDocumentNumber"
    )

    document_number = data.get(
        "documentNumber"
    )

    if (
        mrz_document_number
        and document_number
    ):

        ocr_number = (
            str(document_number)
            .strip()
            .upper()
        )

        mrz_number = (
            str(mrz_document_number)
            .strip()
            .upper()
        )

        if ocr_number != mrz_number:

            errors.append(
                "Document number mismatch "
                "between OCR and MRZ"
            )

    # ---------------------------------------------------------
    # Final result
    # ---------------------------------------------------------

    return {
        "valid": len(errors) == 0,
        "document_type": normalized_type,
        "errors": errors,
        "warnings": warnings,
        "checks": {
            "required_fields": len(
                validate_required_fields(
                    data,
                    required_fields,
                )
            ) == 0,
            "name": name_error is None,
            "nationality": nationality_error is None,
            "document_number": number_error is None,
            "date_of_birth": (
                len(dob_errors) == 0
            ),
            "expiry": (
                not any(
                    "expired" in error.lower()
                    for error in errors
                )
            ),
            "ocr_mrz_document_number": (
                not any(
                    "Document number mismatch"
                    in error
                    for error in errors
                )
            ),
        },
    }