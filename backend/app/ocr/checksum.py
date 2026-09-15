MRZ_WEIGHTS = [7, 3, 1]


def mrz_value(char: str) -> int:
    if char == "<":
        return 0

    if char.isdigit():
        return int(char)

    return ord(char) - ord("A") + 10


def calculate_check_digit(data: str) -> int:
    total = 0

    for index, char in enumerate(data):
        total += mrz_value(char) * MRZ_WEIGHTS[index % 3]

    return total % 10


def validate_check_digit(data: str, check_digit: str) -> bool:
    if not check_digit.isdigit():
        return False

    return calculate_check_digit(data) == int(check_digit)


def validate_passport_mrz(mrz: list[str]) -> dict:
    if len(mrz) != 2:
        return {
            "valid": False,
            "error": "Passport MRZ must contain exactly two lines",
        }

    line1, line2 = mrz

    if len(line1) != 44 or len(line2) != 44:
        return {
            "valid": False,
            "error": "Passport MRZ lines must contain 44 characters",
        }

    passport_number_valid = validate_check_digit(
        line2[0:9],
        line2[9],
    )

    birth_date_valid = validate_check_digit(
        line2[13:19],
        line2[19],
    )

    expiry_date_valid = validate_check_digit(
        line2[21:27],
        line2[27],
    )

    personal_number_valid = validate_check_digit(
        line2[28:42],
        line2[42],
    )

    composite_data = (
        line2[0:10]
        + line2[13:20]
        + line2[21:28]
        + line2[28:43]
    )

    overall_valid = validate_check_digit(
        composite_data,
        line2[43],
    )

    return {
        "valid": all(
            [
                passport_number_valid,
                birth_date_valid,
                expiry_date_valid,
                personal_number_valid,
                overall_valid,
            ]
        ),
        "checks": {
            "passport_number": passport_number_valid,
            "birth_date": birth_date_valid,
            "expiry_date": expiry_date_valid,
            "personal_number": personal_number_valid,
            "overall": overall_valid,
        },
    }