import re


TEXT_DATE_PATTERN = re.compile(
    r"\b\d{1,2}\s+"
    r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)"
    r"\s+\d{4}\b",
    re.IGNORECASE,
)

NUMERIC_DATE_PATTERN = re.compile(
    r"\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b"
)

PASSPORT_NUMBER_PATTERN = re.compile(
    r"\b[A-Z]\d{7,8}\b"
)


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip()


def normalize_name(name: str) -> str:
    """
    Normalize OCR-extracted names.

    Removes common OCR punctuation while preserving
    alphabetic characters, spaces, apostrophes and hyphens.
    """
    name = re.sub(r"[^A-Za-z\s'-]", " ", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip().upper()


def normalize_numeric_date(value: str) -> str:
    """
    Normalize common OCR date errors.

    Examples:
        23/06/1976  -> 23/06/1976
        10/04/2007  -> 10/04/2007
        0904/2017   -> 09/04/2017
    """

    value = value.strip()

    # Normal DD/MM/YYYY
    if re.fullmatch(r"\d{2}/\d{2}/\d{4}", value):
        return value

    # OCR error: 0904/2017
    match = re.fullmatch(
        r"(\d{2})(\d{2})/(\d{4})",
        value,
    )

    if match:
        day = match.group(1)
        month = match.group(2)
        year = match.group(3)

        try:
            if (
                1 <= int(day) <= 31
                and 1 <= int(month) <= 12
            ):
                return f"{day}/{month}/{year}"
        except ValueError:
            pass

    return value


def extract_dates(lines: list[str]) -> list[str]:
    """
    Extract both normal and common OCR-corrupted dates.
    """

    dates = []

    for line in lines:

        # -----------------------------------------------------
        # Normal numeric dates
        # -----------------------------------------------------

        numeric_matches = NUMERIC_DATE_PATTERN.findall(
            line
        )

        for match in numeric_matches:
            dates.append(
                normalize_numeric_date(match)
            )

        # -----------------------------------------------------
        # OCR-corrupted date:
        #
        # 0904/2017 -> 09/04/2017
        # -----------------------------------------------------

        malformed_matches = re.findall(
            r"\b\d{4}/\d{4}\b",
            line,
        )

        for match in malformed_matches:

            normalized = normalize_numeric_date(match)

            if normalized != match:
                dates.append(normalized)

        # -----------------------------------------------------
        # Text dates
        # -----------------------------------------------------

        text_match = TEXT_DATE_PATTERN.search(line)

        if text_match:
            dates.append(
                text_match.group(0).upper()
            )

    return dates


def is_mrz_line(line: str) -> bool:
    """
    Detect likely MRZ lines.
    """

    upper = line.upper().replace(" ", "")

    return (
        upper.startswith("P<")
        or upper.startswith("G<")
        or (
            len(upper) >= 30
            and "<" in upper
        )
    )


def is_valid_name_line(line: str) -> bool:
    """
    Determine whether an OCR line looks like a person's name.

    Common OCR punctuation around a name is removed first.
    """

    if not line:
        return False

    if is_mrz_line(line):
        return False

    # Remove common OCR punctuation.
    cleaned = re.sub(
        r"[‘’“”'\"`.,:;|]+",
        " ",
        line,
    )

    cleaned = re.sub(
        r"\s+",
        " ",
        cleaned,
    ).strip()

    if not cleaned:
        return False

    # Names should not contain numbers.
    if any(char.isdigit() for char in cleaned):
        return False

    words = cleaned.split()

    if len(words) < 2 or len(words) > 5:
        return False

    for word in words:

        if not re.fullmatch(
            r"[A-Za-z][A-Za-z'-]*",
            word,
        ):
            return False

    rejected = {
        "PASSPORT",
        "INDIA",
        "INDIAN",
        "NATIONALITY",
        "SURNAME",
        "GIVEN",
        "NAME",
        "DATE",
        "BIRTH",
        "EXPIRY",
        "EXPIRATION",
        "PLACE",
        "ISSUE",
        "COUNTRY",
        "ADDRESS",
        "SIGNATURE",
        "REPUBLIC",
    }

    upper_words = {
        word.upper()
        for word in words
    }

    if upper_words.intersection(rejected):
        return False

    return True


def parse_ocr_text(text: str) -> dict:

    data = {
        "fullName": "",
        "dateOfBirth": "",
        "nationality": "",
        "documentNumber": "",
        "expiryDate": "",
    }

    # ---------------------------------------------------------
    # Prepare OCR lines
    # ---------------------------------------------------------

    lines = [
        clean_line(line)
        for line in text.splitlines()
        if clean_line(line)
    ]

    # ---------------------------------------------------------
    # 1. DOCUMENT NUMBER
    # ---------------------------------------------------------

    # Explicit passport-number pattern.
    for line in lines:

        match = re.search(
            r"\bP\s+IND\s+([A-Z]?\d{7,9})\b",
            line,
            re.IGNORECASE,
        )

        if match:
            data["documentNumber"] = (
                match.group(1).upper()
            )
            break

    # Standard passport number fallback.
    if not data["documentNumber"]:

        for line in lines:

            match = PASSPORT_NUMBER_PATTERN.search(
                line
            )

            if match:
                data["documentNumber"] = (
                    match.group(0).upper()
                )
                break

    # ---------------------------------------------------------
    # 2. NAME EXTRACTION
    # ---------------------------------------------------------
    # IMPORTANT:
    # Passport layouts may contain:
    #   Surname
    #   Given Name(s)
    #   Father's Name
    #
    # Father's name must never be merged into the passenger's
    # fullName. Prefer explicitly labelled fields and only use
    # conservative fallbacks when labels are unavailable.
    # ---------------------------------------------------------

    father_name = ""
    surname = ""
    given_name = ""

    FIELD_LABELS = (
        "SURNAME",
        "SURNAME /",
        "GIVEN NAME",
        "GIVEN NAMES",
        "GIVEN NAME(S)",
        "FATHER'S NAME",
        "FATHER NAME",
        "FATHER",
        "NAME OF FATHER",
        "PARENT'S NAME",
        "PARENT NAME",
        "MOTHER'S NAME",
        "MOTHER NAME",
    )

    def is_field_label(value: str) -> bool:
        upper = value.upper().strip()
        return any(label in upper for label in FIELD_LABELS)

    def value_after_label(line: str, label_patterns: tuple[str, ...]) -> str:
        upper = line.upper()
        for label in label_patterns:
            position = upper.find(label)
            if position >= 0:
                remainder = line[position + len(label):]
                remainder = re.sub(r"^[\s:.-]+", "", remainder).strip()
                if is_valid_name_line(remainder):
                    return remainder
        return ""

    def find_label_value(
        label_patterns: tuple[str, ...],
        start_index: int = 0,
    ) -> str:
        for index in range(start_index, len(lines)):
            line = lines[index]

            inline_value = value_after_label(line, label_patterns)
            if inline_value:
                return inline_value

            upper_line = line.upper()
            if any(label in upper_line for label in label_patterns):
                for offset in range(1, 4):
                    candidate_index = index + offset
                    if candidate_index >= len(lines):
                        break

                    candidate = lines[candidate_index]

                    # Stop when another semantic field starts.
                    if is_field_label(candidate):
                        break

                    if is_valid_name_line(candidate):
                        return candidate

        return ""

    # Father's/parent name is extracted separately first so it can
    # be explicitly excluded from all generic name candidates.
    father_name = find_label_value(
        (
            "FATHER'S NAME",
            "FATHER NAME",
            "NAME OF FATHER",
            "FATHER",
            "PARENT'S NAME",
            "PARENT NAME",
            "MOTHER'S NAME",
            "MOTHER NAME",
        )
    )

    surname = find_label_value(("SURNAME", "SURNAME /"))

    given_name = find_label_value(
        (
            "GIVEN NAME(S)",
            "GIVEN NAMES",
            "GIVEN NAME",
        )
    )

    # If both surname and given name are explicitly available,
    # construct the passenger's name from those fields only.
    if given_name and surname:
        data["fullName"] = f"{given_name} {surname}"

    elif given_name:
        # A labelled Given Name field is much safer than choosing
        # an arbitrary nearby line.
        data["fullName"] = given_name

    # ---------------------------------------------------------
    # 2B. Known passport layout fallback
    # ---------------------------------------------------------
    # Example:
    #
    # MANGIRE
    # ABHAY TRIMBAKAPPA
    # INDIAN 23/06/1976
    #
    # In this layout the passenger name is the valid name line
    # immediately before the nationality/DOB line.
    # ---------------------------------------------------------

    if not data["fullName"]:
        for index, line in enumerate(lines):
            if not is_valid_name_line(line):
                continue

            # Never use an explicitly identified father's name.
            if father_name and normalize_name(line) == normalize_name(father_name):
                continue

            if index + 1 >= len(lines):
                continue

            next_line = lines[index + 1].upper()

            if (
                "INDIAN" in next_line
                or "INDIA" in next_line
                or NUMERIC_DATE_PATTERN.search(next_line)
                or TEXT_DATE_PATTERN.search(next_line)
            ):
                data["fullName"] = line
                break

    # ---------------------------------------------------------
    # 2C. Conservative generic fallback
    # ---------------------------------------------------------
    if not data["fullName"]:
        candidates = []

        for index, line in enumerate(lines):
            if not is_valid_name_line(line):
                continue

            upper = line.upper()

            # Never select a father's/parent's name as passenger name.
            if father_name and normalize_name(line) == normalize_name(father_name):
                continue

            # Reject obvious place/location OCR.
            if any(
                token in upper
                for token in [
                    "NAGPUR",
                    "OSMANABAD",
                    "MAHARASHTRA",
                    "MURUM",
                ]
            ):
                continue

            score = 0
            word_count = len(line.split())

            if word_count == 2:
                score += 5
            elif word_count == 3:
                score += 8
            elif word_count == 4:
                score += 4

            # A name immediately before nationality/DOB is useful,
            # but only after explicitly labelled fields were checked.
            if index + 1 < len(lines):
                next_line = lines[index + 1]

                if (
                    NUMERIC_DATE_PATTERN.search(next_line)
                    or TEXT_DATE_PATTERN.search(next_line)
                    or "INDIAN" in next_line.upper()
                    or "INDIA" in next_line.upper()
                ):
                    score += 10

            candidates.append((score, index, line))

        if candidates:
            candidates.sort(
                key=lambda item: (item[0], len(item[2])),
                reverse=True,
            )
            data["fullName"] = candidates[0][2]

    # Final safety check: never return a known father/parent name
    # as the passenger's fullName.
    if father_name and normalize_name(data["fullName"]) == normalize_name(father_name):
        data["fullName"] = given_name or surname

    # ---------------------------------------------------------
    # 3. NATIONALITY
    # ---------------------------------------------------------

    for index, line in enumerate(lines):

        upper_line = line.upper()

        if "NATIONALITY" in upper_line:

            if "INDIAN" in upper_line:
                data["nationality"] = "IND"
                break

            if "INDIA" in upper_line:
                data["nationality"] = "IND"
                break

            if index + 1 < len(lines):

                candidate = lines[index + 1].upper()

                if candidate in {
                    "INDIAN",
                    "INDIA",
                    "IND",
                }:
                    data["nationality"] = "IND"
                    break

    # MRZ fallback.
    if not data["nationality"]:

        for line in lines:

            normalized = line.replace(
                " ",
                "",
            ).upper()

            if normalized.startswith("P<IND"):
                data["nationality"] = "IND"
                break

    # ---------------------------------------------------------
    # 4. EXTRACT ALL DATES
    # ---------------------------------------------------------

    dates = extract_dates(lines)

    # ---------------------------------------------------------
    # 5. DATE OF BIRTH
    # ---------------------------------------------------------

    # Explicit Date of Birth label.
    for index, line in enumerate(lines):

        upper_line = line.upper()

        if "DATE OF BIRTH" in upper_line:

            match = NUMERIC_DATE_PATTERN.search(
                line
            )

            if match:

                data["dateOfBirth"] = (
                    normalize_numeric_date(
                        match.group(0)
                    )
                )
                break

            match = TEXT_DATE_PATTERN.search(
                line
            )

            if match:

                data["dateOfBirth"] = (
                    match.group(0).upper()
                )
                break

            if index + 1 < len(lines):

                next_line = lines[index + 1]

                match = NUMERIC_DATE_PATTERN.search(
                    next_line
                )

                if match:

                    data["dateOfBirth"] = (
                        normalize_numeric_date(
                            match.group(0)
                        )
                    )
                    break

    # Format:
    #
    # INDIAN 23/06/1976
    #
    if not data["dateOfBirth"]:

        for line in lines:

            match = re.search(
                r"(?:INDIAN|INDIA)\s+"
                r"(\d{1,2}[/-]\d{1,2}[/-]\d{4})",
                line,
                re.IGNORECASE,
            )

            if match:

                data["dateOfBirth"] = (
                    normalize_numeric_date(
                        match.group(1)
                    )
                )
                break

    # Standard numeric fallback.
    if not data["dateOfBirth"]:

        for line in lines:

            matches = NUMERIC_DATE_PATTERN.findall(
                line
            )

            if matches:

                data["dateOfBirth"] = (
                    normalize_numeric_date(
                        matches[0]
                    )
                )
                break

    # ---------------------------------------------------------
    # 6. EXPIRY DATE
    # ---------------------------------------------------------

    # Explicit Date of Expiry label.
    for index, line in enumerate(lines):

        upper_line = line.upper()

        if "DATE OF EXPIRY" in upper_line:

            # Normal dates on same line.
            matches = NUMERIC_DATE_PATTERN.findall(
                line
            )

            if matches:

                data["expiryDate"] = (
                    normalize_numeric_date(
                        matches[-1]
                    )
                )
                break

            # OCR-corrupted date:
            #
            # 0904/2017
            #
            malformed = re.findall(
                r"\b\d{4}/\d{4}\b",
                line,
            )

            if malformed:

                data["expiryDate"] = (
                    normalize_numeric_date(
                        malformed[-1]
                    )
                )
                break

            # Check next line.
            if index + 1 < len(lines):

                next_line = lines[index + 1]

                matches = NUMERIC_DATE_PATTERN.findall(
                    next_line
                )

                if matches:

                    data["expiryDate"] = (
                        normalize_numeric_date(
                            matches[-1]
                        )
                    )
                    break

                malformed = re.findall(
                    r"\b\d{4}/\d{4}\b",
                    next_line,
                )

                if malformed:

                    data["expiryDate"] = (
                        normalize_numeric_date(
                            malformed[-1]
                        )
                    )
                    break

    # ---------------------------------------------------------
    # Numeric passport layout fallback
    # ---------------------------------------------------------
    #
    # Example:
    #
    # 10/04/2007 0904/2017
    #
    # First = issue date
    # Second = expiry date
    # ---------------------------------------------------------

    if not data["expiryDate"] and len(dates) >= 2:

        data["expiryDate"] = dates[-1]

    # ---------------------------------------------------------
    # 7. FINAL CLEANUP
    # ---------------------------------------------------------

    data["fullName"] = normalize_name(
        data["fullName"]
    )

    data["nationality"] = (
        data["nationality"]
        .strip()
        .upper()
    )

    data["documentNumber"] = (
        data["documentNumber"]
        .strip()
        .upper()
    )

    data["dateOfBirth"] = (
        data["dateOfBirth"]
        .strip()
    )

    data["expiryDate"] = (
        data["expiryDate"]
        .strip()
    )

    return data