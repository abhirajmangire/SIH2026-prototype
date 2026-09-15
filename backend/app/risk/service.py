def calculate_risk(
    mrz_validation: dict,
    cross_verification: dict,
    document_validation: dict,
    tampering: dict,
    face_verification: dict,
) -> dict:

    score = 0
    reasons = []

    # -----------------------------------------------------
    # 1. MRZ validation
    # -----------------------------------------------------

    if not mrz_validation.get("valid", False):
        score += 20
        reasons.append("MRZ checksum validation failed")

    # -----------------------------------------------------
    # 2. Cross-document verification
    # -----------------------------------------------------

    cross_score = cross_verification.get("score", 0)

    if cross_score < 80:
        score += 20
        reasons.append(
            "Cross-document verification mismatch"
        )

    # -----------------------------------------------------
    # 3. Document validation
    # -----------------------------------------------------

    if not document_validation.get("valid", False):
        score += 25

        for error in document_validation.get(
            "errors",
            []
        ):
            reasons.append(error)

    # -----------------------------------------------------
    # 4. Tampering detection
    # -----------------------------------------------------

    tampering_level = tampering.get(
        "risk_level",
        "UNKNOWN"
    )

    if tampering_level == "HIGH":
        score += 25
        reasons.append(
            "High tampering risk detected"
        )

    elif tampering_level == "MEDIUM":
        score += 15
        reasons.append(
            "Medium tampering risk detected"
        )

    # -----------------------------------------------------
    # 5. Face verification
    # -----------------------------------------------------

    face_status = face_verification.get(
        "status",
        "unknown"
    )

    # Face verification was actually performed
    if face_status == "completed":

        if not face_verification.get(
            "match",
            False
        ):
            score += 20
            reasons.append(
                "Face verification failed"
            )

    # Face verification was not performed
    elif face_status == "not_run":

        # Do NOT add risk.
        # The absence of a selfie is not evidence
        # that the face does not match.
        pass

    # Backward compatibility with the old
    # face result structure.
    elif "match" in face_verification:

        if not face_verification["match"]:
            score += 20
            reasons.append(
                "Face verification failed"
            )

    # -----------------------------------------------------
    # 6. Cap score
    # -----------------------------------------------------

    score = min(score, 100)

    # -----------------------------------------------------
    # 7. Determine risk level
    # -----------------------------------------------------

    if score >= 70:
        level = "HIGH"

    elif score >= 40:
        level = "MEDIUM"

    else:
        level = "LOW"

    # -----------------------------------------------------
    # 8. Return result
    # -----------------------------------------------------

    return {
        "score": score,
        "level": level,
        "reasons": reasons,
    }