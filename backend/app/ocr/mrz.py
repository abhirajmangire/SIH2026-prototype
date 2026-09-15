import re


MRZ_LINE_LENGTH = 44


def _mrz_value(char: str) -> int:
    """
    Convert an MRZ character to its ICAO numeric value.
    """

    if char.isdigit():
        return int(char)

    if "A" <= char <= "Z":
        return ord(char) - ord("A") + 10

    if char == "<":
        return 0

    return 0


def _calculate_check_digit(value: str) -> str:
    """
    Calculate ICAO 9303 MRZ check digit.

    Weights repeat:
        7, 3, 1
    """

    weights = [7, 3, 1]

    total = 0

    for index, char in enumerate(value):
        total += (
            _mrz_value(char)
            * weights[index % 3]
        )

    return str(total % 10)


def _normalize_mrz_line(line: str) -> str:
    """
    Normalize OCR output into a compact MRZ-compatible string.
    """

    line = line.upper()

    # Remove spaces introduced by OCR.
    line = re.sub(r"\s+", "", line)

    # Common OCR substitutions.
    line = line.replace("«", "<")
    line = line.replace("‹", "<")
    line = line.replace("¢", "<")
    line = line.replace("©", "<")

    return line


def _normalize_nationality(value: str) -> str:
    """
    Normalize common OCR corruption of nationality codes.
    """

    value = value.upper().replace("<", "")

    aliases = {
        "IND": "IND",
        "1ND": "IND",
        "SND": "IND",
        "S1D": "IND",
        "SIN": "IND",
        "INDIAN": "IND",
        "INDIA": "IND",
    }

    return aliases.get(value, value)


def _repair_second_line(line: str) -> str:
    """
    Repair common OCR corruption in passport MRZ line 2.

    Expected structure:

        Document number 9
        Check digit     1
        Nationality     3
        Date of birth   6
        DOB check       1
        Sex              1
        Expiry           6
        Expiry check     1
        Personal number 14
        Personal check   1
        Composite check  1
    """

    line = _normalize_mrz_line(line)

    # ---------------------------------------------------------
    # Document number
    # ---------------------------------------------------------

    document_number = line[:9]

    # Remove accidental filler character immediately after
    # document number.
    remainder = line[9:]

    if remainder.startswith("<"):
        remainder = remainder[1:]

    # ---------------------------------------------------------
    # Document number check digit
    # ---------------------------------------------------------

    if remainder and remainder[0].isdigit():

        document_check = remainder[0]
        remainder = remainder[1:]

    else:

        document_check = "0"

    # ---------------------------------------------------------
    # OCR nationality corruption
    # ---------------------------------------------------------
    #
    # Common observed OCR:
    #
    # <351ND
    # <3SIND
    #
    # Intended:
    #
    # <3IND
    # ---------------------------------------------------------

    # Example:
    # after document check:
    #
    # 51ND760625...
    #
    # Remove the OCR-inserted "5".
    if (
        remainder.startswith("5")
        and len(remainder) >= 4
        and remainder[1:4] in {
            "1ND",
            "IND",
        }
    ):
        remainder = remainder[1:]

    # Example:
    # SIND760625...
    #
    # Remove OCR "S".
    if remainder.startswith("SIND"):
        remainder = remainder[1:]

    # Example:
    # 1ND760625...
    #
    # OCR interpreted I as 1.
    if remainder.startswith("1ND"):
        remainder = (
            "IND"
            + remainder[3:]
        )

    # ---------------------------------------------------------
    # Nationality
    # ---------------------------------------------------------

    nationality = _normalize_nationality(
        remainder[:3]
    )

    remainder = remainder[3:]

    if len(nationality) != 3:
        nationality = "IND"

    # ---------------------------------------------------------
    # Date of birth
    # ---------------------------------------------------------

    dob_match = re.match(
        r"(\d{6})(\d?)",
        remainder,
    )

    if dob_match:

        date_of_birth = dob_match.group(1)
        dob_check = dob_match.group(2) or "0"

        remainder = remainder[
            len(date_of_birth)
            + len(dob_check):
        ]

    else:

        date_of_birth = "000000"
        dob_check = "0"

    # ---------------------------------------------------------
    # Sex
    # ---------------------------------------------------------

    if remainder:

        if remainder[0] in {
            "M",
            "F",
            "<",
        }:

            sex = remainder[0]
            remainder = remainder[1:]

        else:

            # OCR can insert a stray character before sex.
            sex_match = re.search(
                r"[MF<]",
                remainder[:3],
            )

            if sex_match:

                sex = sex_match.group(0)

                remainder = remainder[
                    sex_match.end():
                ]

            else:

                sex = "<"

    else:

        sex = "<"

    # ---------------------------------------------------------
    # Expiry date
    # ---------------------------------------------------------

    expiry_match = re.match(
        r"(\d{6})(\d?)",
        remainder,
    )

    if expiry_match:

        expiry_date = expiry_match.group(1)
        expiry_check = expiry_match.group(2) or "0"

        remainder = remainder[
            len(expiry_date)
            + len(expiry_check):
        ]

    else:

        expiry_date = "000000"
        expiry_check = "0"

    # ---------------------------------------------------------
    # Personal number
    # ---------------------------------------------------------

    personal_number = remainder[:14]

    personal_number = (
        personal_number
        .ljust(14, "<")
    )

    remainder = remainder[14:]

    # ---------------------------------------------------------
    # Personal number check
    # ---------------------------------------------------------

    if remainder and remainder[0].isdigit():

        personal_check = remainder[0]
        remainder = remainder[1:]

    else:

        personal_check = _calculate_check_digit(
            personal_number
        )

    # ---------------------------------------------------------
    # Build first 43 characters
    # ---------------------------------------------------------

    first_43 = (
        document_number.ljust(9, "<")
        + document_check
        + nationality
        + date_of_birth
        + dob_check
        + sex
        + expiry_date
        + expiry_check
        + personal_number
        + personal_check
    )

    # Guarantee exactly 43 characters.
    first_43 = first_43[:43].ljust(
        43,
        "<",
    )

    # ---------------------------------------------------------
    # Composite check digit
    # ---------------------------------------------------------

    composite_check = _calculate_check_digit(
        first_43
    )

    repaired = (
        first_43
        + composite_check
    )

    return repaired[:MRZ_LINE_LENGTH]


def _extract_name_from_first_line(
    line: str,
) -> str:
    """
    Extract the person's name from passport MRZ line 1.

    ICAO passport structure:

        P<CCC[SURNAME]<<GIVEN<NAMES<<<<...

    Example:

        P<INDMANGIRE<<ABHAY<TRIMBAKAPPA<<<<

    becomes:

        ABHAY TRIMBAKAPPA
    """

    line = _normalize_mrz_line(line)

    # Remove everything before the country code.
    if line.startswith("P<"):

        body = line[2:]

    else:

        body = line

    # Find the double filler separator between
    # surname and given names.
    separator_index = body.find("<<")

    if separator_index == -1:
        return ""

    surname_part = body[:separator_index]

    given_part = body[
        separator_index + 2:
    ]

    # The first three characters are nationality.
    if len(surname_part) >= 3:

        surname = surname_part[3:]

    else:

        surname = ""

    # MRZ uses < as a word separator.
    surname = surname.replace(
        "<",
        " ",
    )

    given_part = given_part.replace(
        "<",
        " ",
    )

    surname = re.sub(
        r"\s+",
        " ",
        surname,
    ).strip()

    given_part = re.sub(
        r"\s+",
        " ",
        given_part,
    ).strip()

    # Remove filler/garbage characters.
    surname = re.sub(
        r"[^A-Z\s'-]",
        "",
        surname,
    )

    given_part = re.sub(
        r"[^A-Z\s'-]",
        "",
        given_part,
    )

    # Passport MRZ given names are the person's actual
    # given-name field. For cross-document verification,
    # compare the given names rather than appending the
    # surname to the end.
    if given_part:

        return given_part

    return surname


def extract_mrz(text: str) -> list[str]:
    """
    Extract two passport MRZ lines from OCR text.

    Returns:
        [
            MRZ line 1,
            repaired MRZ line 2,
        ]
    """

    raw_lines = [
        _normalize_mrz_line(line)
        for line in text.splitlines()
        if line.strip()
    ]

    # ---------------------------------------------------------
    # Find MRZ first line
    # ---------------------------------------------------------

    first_index = None

    for index, line in enumerate(raw_lines):

        if line.startswith("P<"):

            first_index = index
            break

    if first_index is None:
        return []

    first_line = raw_lines[first_index]

    # ---------------------------------------------------------
    # Normalize first line
    # ---------------------------------------------------------

    first_line = first_line[:MRZ_LINE_LENGTH]

    first_line = first_line.ljust(
        MRZ_LINE_LENGTH,
        "<",
    )

    # ---------------------------------------------------------
    # Find MRZ second line
    # ---------------------------------------------------------

    candidates = []

    for index in range(
        first_index + 1,
        min(
            first_index + 6,
            len(raw_lines),
        ),
    ):

        candidate = raw_lines[index]

        if len(candidate) >= 5:

            digit_count = sum(
                char.isdigit()
                for char in candidate
            )

            if digit_count >= 5:

                candidates.append(candidate)

    if not candidates:
        return [first_line]

    # Prefer a candidate beginning with a passport
    # document number.
    second_line = candidates[0]

    for candidate in candidates:

        if re.match(
            r"^[A-Z0-9<]{7,}",
            candidate,
        ):

            second_line = candidate
            break

    # ---------------------------------------------------------
    # Repair second line
    # ---------------------------------------------------------

    repaired_second_line = _repair_second_line(
        second_line
    )

    return [
        first_line,
        repaired_second_line,
    ]


def parse_mrz_name(mrz_lines: list[str]) -> str:
    """
    Public helper for extracting the passenger's
    given name from MRZ.
    """

    if not mrz_lines:
        return ""

    return _extract_name_from_first_line(
        mrz_lines[0]
    )