import os

import cv2
import numpy as np


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(__file__)
    )
)

DETECTOR_MODEL = os.path.join(
    BASE_DIR,
    "models",
    "face_detection_yunet_2023mar.onnx",
)

RECOGNIZER_MODEL = os.path.join(
    BASE_DIR,
    "models",
    "face_recognition_sface_2021dec.onnx",
)


detector = cv2.FaceDetectorYN.create(
    DETECTOR_MODEL,
    "",
    (320, 320),
    0.6,
    0.3,
    5000,
)

recognizer = cv2.FaceRecognizerSF.create(
    RECOGNIZER_MODEL,
    "",
)


def load_image(file_bytes: bytes):
    array = np.frombuffer(
        file_bytes,
        dtype=np.uint8,
    )

    return cv2.imdecode(
        array,
        cv2.IMREAD_COLOR,
    )


def extract_face(image):
    if image is None:
        return None, None

    height, width = image.shape[:2]

    detector.setInputSize(
        (width, height)
    )

    _, faces = detector.detect(image)

    if faces is None or len(faces) == 0:
        return None, None

    if len(faces) > 1:
        return None, faces

    face = faces[0]

    aligned = recognizer.alignCrop(
        image,
        face,
    )

    feature = recognizer.feature(
        aligned
    )

    return feature, faces


def verify_faces(
    document_bytes: bytes,
    selfie_bytes: bytes,
) -> dict:

    try:
        document_image = load_image(
            document_bytes
        )

        selfie_image = load_image(
            selfie_bytes
        )

        if document_image is None:
            return {
                "status": "failed",
                "error": "Unable to decode document image.",
            }

        if selfie_image is None:
            return {
                "status": "failed",
                "error": "Unable to decode selfie image.",
            }

        document_feature, document_faces = extract_face(
            document_image
        )

        selfie_feature, selfie_faces = extract_face(
            selfie_image
        )

        document_count = (
            0
            if document_faces is None
            else len(document_faces)
        )

        selfie_count = (
            0
            if selfie_faces is None
            else len(selfie_faces)
        )

        # Document face missing
        if document_feature is None:
            return {
                "status": "completed",
                "document_face_detected": False,
                "selfie_face_detected": selfie_count > 0,
                "document_face_count": document_count,
                "selfie_face_count": selfie_count,
                "match": False,
                "confidence": 0,
                "risk_level": "HIGH",
                "explanation": (
                    "No usable face was detected "
                    "in the identity document."
                ),
            }

        # Selfie face missing
        if selfie_feature is None:
            return {
                "status": "completed",
                "document_face_detected": True,
                "selfie_face_detected": False,
                "document_face_count": document_count,
                "selfie_face_count": selfie_count,
                "match": False,
                "confidence": 0,
                "risk_level": "HIGH",
                "explanation": (
                    "No usable face was detected "
                    "in the passenger selfie."
                ),
            }

        # Multiple faces
        if document_count != 1 or selfie_count != 1:
            return {
                "status": "completed",
                "document_face_detected": True,
                "selfie_face_detected": True,
                "document_face_count": document_count,
                "selfie_face_count": selfie_count,
                "match": False,
                "confidence": 0,
                "risk_level": "HIGH",
                "explanation": (
                    "Exactly one face is required "
                    "in both images."
                ),
            }

        # SFace cosine similarity
        similarity = recognizer.match(
            document_feature,
            selfie_feature,
            cv2.FaceRecognizerSF_FR_COSINE,
        )

        similarity = float(similarity)

        confidence = round(
            max(
                0.0,
                min(
                    similarity * 100.0,
                    100.0,
                ),
            ),
            2,
        )

        # Prototype threshold
        if similarity >= 0.363:
            match = True
            risk_level = "LOW"
        elif similarity >= 0.250:
            match = False
            risk_level = "MEDIUM"
        else:
            match = False
            risk_level = "HIGH"

        return {
            "status": "completed",
            "document_face_detected": True,
            "selfie_face_detected": True,
            "document_face_count": document_count,
            "selfie_face_count": selfie_count,
            "match": match,
            "confidence": confidence,
            "similarity": round(
                similarity,
                4,
            ),
            "risk_level": risk_level,
            "explanation": (
                "YuNet detected the passenger faces "
                "and SFace compared their facial embeddings."
            ),
        }

    except Exception as error:
        return {
            "status": "failed",
            "document_face_detected": False,
            "selfie_face_detected": False,
            "document_face_count": 0,
            "selfie_face_count": 0,
            "match": False,
            "confidence": 0,
            "risk_level": "UNKNOWN",
            "error": str(error),
        }