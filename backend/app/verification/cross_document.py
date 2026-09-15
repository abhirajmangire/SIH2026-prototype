import re


def normalize_text(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def normalize_nationality(value: str) -> str:
    value = normalize_text(value)

    aliases = {
        "INDIAN": "IND",
        "INDIA": "IND",
        "IND": "IND",
    }

    return aliases.get(value, value)


def compare_nationality(
    ocr_value: str,
    mrz_value: str,
) -> bool:

    if not ocr_value or not mrz_value:
        return False

    return (
        normalize_nationality(ocr_value)
        == normalize_nationality(mrz_value)
    )


def normalize_name(value: str) -> str:
    value = value.upper()
    value = value.replace("<", " ")
    value = re.sub(r"[^A-Z\s]", "", value)
    return re.sub(r"\s+", " ", value).strip()


def parse_mrz_name(mrz_line: str) -> str:
    if not mrz_line.startswith("P<"):
        return ""

    name_part = mrz_line[2:]

    # Keep the actual surname/given-name section.
    name_part = name_part.split("<<<<", 1)[0]

    parts = name_part.split("<<", 1)

    if len(parts) != 2:
        return ""

    surname = parts[0].replace("<", " ").strip()
    given_names = parts[1].replace("<", " ").strip()

    return f"{given_names} {surname}".strip()


def parse_mrz_data(mrz: list[str]) -> dict:

    if len(mrz) != 2:
        return {
            "name": "",
            "documentNumber": "",
            "dateOfBirth": "",
            "expiryDate": "",
            "nationality": "",
        }

    line1 = mrz[0]
    line2 = mrz[1]

    name = parse_mrz_name(line1)

    document_number = ""
    date_of_birth = ""
    expiry_date = ""
    nationality = ""

    if len(line2) >= 28:

        # TD3 passport MRZ positions:
        #
        # 0-8   Document number
        # 9     Document number check digit
        # 10-12 Nationality
        # 13-18 Date of birth
        # 19    DOB check digit
        # 20    Sex
        # 21-26 Expiry date
        # 27    Expiry check digit

        document_number = line2[0:9].replace("<", "")

        nationality = line2[10:13].replace("<", "")

        date_of_birth = line2[13:19]

        expiry_date = line2[21:27]

    return {
        "name": name,
        "documentNumber": document_number,
        "dateOfBirth": date_of_birth,
        "expiryDate": expiry_date,
        "nationality": nationality,
    }


def convert_mrz_date(value: str) -> str:

    if len(value) != 6 or not value.isdigit():
        return ""

    year = int(value[:2])
    month = value[2:4]
    day = value[4:6]

    if year >= 50:
        full_year = 1900 + year
    else:
        full_year = 2000 + year

    return f"{day}/{month}/{full_year}"


def compare_values(
    ocr_value: str,
    mrz_value: str,
) -> bool:

    if not ocr_value or not mrz_value:
        return False

    return normalize_text(ocr_value) == normalize_text(mrz_value)


def compare_names(
    ocr_name: str,
    mrz_name: str,
) -> bool:

    if not ocr_name or not mrz_name:
        return False

    return normalize_name(ocr_name) == normalize_name(mrz_name)


def cross_verify(
    ocr_data: dict,
    mrz: list[str],
) -> dict:

    mrz_data = parse_mrz_data(mrz)

    # ---------------------------------------------------------
    # OCR DATA
    # ---------------------------------------------------------

    ocr_name = ocr_data.get("fullName", "")
    ocr_document_number = ocr_data.get("documentNumber", "")
    ocr_dob = ocr_data.get("dateOfBirth", "")
    ocr_expiry = ocr_data.get("expiryDate", "")
    ocr_nationality = ocr_data.get("nationality", "")

    # ---------------------------------------------------------
    # MRZ DATA
    # ---------------------------------------------------------

    mrz_name = mrz_data.get("name", "")
    mrz_document_number = mrz_data.get("documentNumber", "")
    mrz_nationality = mrz_data.get("nationality", "")

    mrz_dob = convert_mrz_date(
        mrz_data.get("dateOfBirth", "")
    )

    mrz_expiry = convert_mrz_date(
        mrz_data.get("expiryDate", "")
    )

    # ---------------------------------------------------------
    # FIELD COMPARISONS
    # ---------------------------------------------------------

    name_match = compare_names(
        ocr_name,
        mrz_name,
    )

    passport_match = compare_values(
        ocr_document_number,
        mrz_document_number,
    )

    dob_match = compare_values(
        ocr_dob,
        mrz_dob,
    )

    expiry_match = compare_values(
        ocr_expiry,
        mrz_expiry,
    )

    # IMPORTANT:
    # INDIAN and IND are treated as equivalent.
    nationality_match = compare_nationality(
        ocr_nationality,
        mrz_nationality,
    )

    # ---------------------------------------------------------
    # CHECK RESULTS
    # ---------------------------------------------------------

    checks = {
        "name": name_match,
        "documentNumber": passport_match,
        "dateOfBirth": dob_match,
        "expiryDate": expiry_match,
        "nationality": nationality_match,
    }

    matched = sum(checks.values())
    total = len(checks)

    score = round(
        (matched / total) * 100,
        2,
    ) if total else 0

    return {
        "valid": matched == total,
        "match_count": matched,
        "total_checks": total,
        "score": score,
        "checks": checks,
        "mrz_data": mrz_data,
    }