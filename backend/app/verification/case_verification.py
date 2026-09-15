import re
from typing import Any


IDENTITY_FIELDS = [
    "fullName",
    "documentNumber",
    "dateOfBirth",
    "nationality",
]


def normalize_text(value: Any) -> str:

    if value is None:
        return ""

    return re.sub(
        r"[^A-Z0-9]",
        "",
        str(value).upper(),
    )


def normalize_name(value: Any) -> str:

    if value is None:
        return ""

    value = str(value).upper()

    value = value.replace(
        "<",
        " ",
    )

    value = re.sub(
        r"[^A-Z\s]",
        "",
        value,
    )

    return re.sub(
        r"\s+",
        " ",
        value,
    ).strip()


def names_match(
    first: Any,
    second: Any,
) -> bool:

    first_name = normalize_name(first)
    second_name = normalize_name(second)

    if not first_name or not second_name:
        return False

    if first_name == second_name:
        return True

    # Compare token sets so that
    # "ABHAY TRIMBAKAPPA"
    # and
    # "TRIMBAKAPPA ABHAY"
    # are treated as the same identity name.
    first_tokens = set(
        first_name.split()
    )

    second_tokens = set(
        second_name.split()
    )

    return (
        first_tokens == second_tokens
        and len(first_tokens) > 0
    )


def values_match(
    first: Any,
    second: Any,
    field: str,
) -> bool:

    if field == "fullName":
        return names_match(
            first,
            second,
        )

    first_value = normalize_text(
        first
    )

    second_value = normalize_text(
        second
    )

    if not first_value or not second_value:
        return False

    return first_value == second_value


def get_documents_identity(
    documents: list[dict],
) -> dict:

    identity = {}

    for field in IDENTITY_FIELDS:

        values = []

        for document in documents:

            parsed_data = document.get(
                "parsed_data",
                {},
            )

            value = parsed_data.get(
                field
            )

            if value:

                values.append({
                    "filename": document.get(
                        "filename",
                        "Unknown",
                    ),
                    "value": value,
                })

        identity[field] = values

    return identity


def verify_case(
    documents: list[dict],
) -> dict:

    if not documents:

        return {
            "valid": False,
            "score": 0,
            "level": "HIGH",
            "identity_score": 0,
            "document_risk_score": 100,
            "passed_checks": 0,
            "total_checks": 0,
            "checks": {},
            "issues": [
                "No documents available"
            ],
            "document_risks": [],
            "recommended_action": "REJECT",
            "summary": (
                "No documents were provided "
                "for passenger verification."
            ),
        }

    # ---------------------------------------------------------
    # Cross-document identity verification
    # ---------------------------------------------------------

    checks = {}
    mismatches = []

    total_checks = 0
    passed_checks = 0

    if len(documents) < 2:

        for field in IDENTITY_FIELDS:
            checks[field] = {
                "status": "INSUFFICIENT_DATA",
                "documents": [],
            }

        identity_score = None

    else:

        identity = get_documents_identity(
            documents
        )

        for field in IDENTITY_FIELDS:

            values = identity[field]

            if len(values) < 2:

                checks[field] = {
                    "status": "INSUFFICIENT_DATA",
                    "documents": values,
                }

                continue

            total_checks += 1

            reference_value = values[0]["value"]

            all_match = all(
                values_match(
                    reference_value,
                    item["value"],
                    field,
                )
                for item in values[1:]
            )

            if all_match:

                checks[field] = {
                    "status": "PASS",
                    "documents": values,
                }

                passed_checks += 1

            else:

                checks[field] = {
                    "status": "FAIL",
                    "documents": values,
                }

                mismatches.append(
                    f"{field} mismatch across documents"
                )

        if total_checks:

            identity_score = round(
                (
                    passed_checks
                    / total_checks
                ) * 100
            )

        else:

            identity_score = None

    # ---------------------------------------------------------
    # Individual document risk
    # ---------------------------------------------------------

    document_risks = []
    risk_scores = []

    issues = []

    for mismatch in mismatches:

        if mismatch not in issues:
            issues.append(mismatch)

    for document in documents:

        risk = document.get(
            "risk",
            {},
        )

        risk_score = risk.get(
            "score",
            0,
        )

        try:
            risk_score = float(
                risk_score
            )
        except (
            TypeError,
            ValueError,
        ):
            risk_score = 0

        risk_score = max(
            0,
            min(
                100,
                risk_score,
            ),
        )

        risk_level = str(
            risk.get(
                "level",
                "UNKNOWN",
            )
        ).upper()

        reasons = risk.get(
            "reasons",
            [],
        )

        if not isinstance(
            reasons,
            list,
        ):
            reasons = [
                str(reasons)
            ]

        document_risks.append({
            "filename": document.get(
                "filename",
                "Unknown",
            ),
            "score": round(
                risk_score
            ),
            "level": risk_level,
            "reasons": reasons,
        })

        risk_scores.append(
            risk_score
        )

        for reason in reasons:

            if reason not in issues:
                issues.append(reason)

    document_risk_score = (
        round(
            sum(risk_scores)
            / len(risk_scores)
        )
        if risk_scores
        else 0
    )

    # ---------------------------------------------------------
    # Overall case score
    # ---------------------------------------------------------

    if identity_score is None:

        case_score = (
            100
            - document_risk_score
        )

    else:

        case_score = round(
            (
                identity_score
                * 0.40
            )
            + (
                (
                    100
                    - document_risk_score
                )
                * 0.60
            )
        )

    case_score = max(
        0,
        min(
            100,
            case_score,
        ),
    )

    # ---------------------------------------------------------
    # Risk level
    # ---------------------------------------------------------

    if case_score >= 80:

        level = "LOW"

    elif case_score >= 50:

        level = "MEDIUM"

    else:

        level = "HIGH"

    if (
        identity_score is not None
        and identity_score < 100
        and level == "LOW"
    ):
        level = "MEDIUM"

    # ---------------------------------------------------------
    # Validity
    # ---------------------------------------------------------

    identity_valid = (
        identity_score is None
        or identity_score == 100
    )

    document_valid = (
        document_risk_score < 40
    )

    valid = (
        identity_valid
        and document_valid
    )

    # ---------------------------------------------------------
    # Recommended action
    # ---------------------------------------------------------

    if level == "LOW":

        recommended_action = "APPROVE"

    elif level == "MEDIUM":

        recommended_action = "MANUAL_REVIEW"

    else:

        recommended_action = "REJECT"

    # ---------------------------------------------------------
    # Human-readable summary
    # ---------------------------------------------------------

    if level == "LOW":

        summary = (
            "No significant identity or "
            "document risk indicators were detected."
        )

    elif level == "MEDIUM":

        summary = (
            "Some verification inconsistencies "
            "require officer review."
        )

    else:

        summary = (
            "Multiple high-risk verification "
            "indicators require escalation."
        )

    return {
        "valid": valid,
        "score": case_score,
        "level": level,
        "identity_score": identity_score,
        "document_risk_score": document_risk_score,
        "passed_checks": passed_checks,
        "total_checks": total_checks,
        "checks": checks,
        "issues": issues,
        "document_risks": document_risks,
        "recommended_action": recommended_action,
        "summary": summary,
        "document_count": len(documents),
    }