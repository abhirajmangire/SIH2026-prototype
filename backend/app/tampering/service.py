import io
import os
import uuid

import cv2
import numpy as np
from PIL import Image


OUTPUT_DIR = os.path.join(
    os.path.dirname(__file__),
    "outputs",
)

os.makedirs(OUTPUT_DIR, exist_ok=True)


def _save_image(filename: str, image: np.ndarray, analysis_id: str) -> str:
    """
    Save an analysis image inside a unique per-analysis directory.
    This prevents one document from overwriting another document's
    forensic outputs.
    """

    analysis_dir = os.path.join(
        OUTPUT_DIR,
        analysis_id,
    )
    os.makedirs(analysis_dir, exist_ok=True)

    path = os.path.join(
        analysis_dir,
        filename,
    )

    success = cv2.imwrite(path, image)

    if not success:
        raise RuntimeError(f"Failed to save forensic output: {path}")

    return f"/tampering/{analysis_id}/{filename}"


def _normalize_map(values: np.ndarray) -> np.ndarray:
    """
    Normalize an anomaly map to 0-255.
    """

    values = values.astype(np.float32)

    minimum = float(values.min())
    maximum = float(values.max())

    if maximum - minimum < 1e-6:
        return np.zeros_like(
            values,
            dtype=np.uint8,
        )

    normalized = (
        (values - minimum)
        / (maximum - minimum)
        * 255.0
    )

    return np.clip(
        normalized,
        0,
        255,
    ).astype(np.uint8)


def analyze_tampering(file_bytes: bytes) -> dict:

    # Unique namespace for THIS document analysis.
    analysis_id = uuid.uuid4().hex[:12]

    try:

        # =====================================================
        # 1. LOAD IMAGE
        # =====================================================

        image = Image.open(
            io.BytesIO(file_bytes)
        )

        image_format = (
            image.format or "UNKNOWN"
        )

        width, height = image.size

        image_array = np.array(
            image.convert("RGB")
        )

        # OpenCV uses BGR
        bgr = cv2.cvtColor(
            image_array,
            cv2.COLOR_RGB2BGR,
        )

        gray = cv2.cvtColor(
            bgr,
            cv2.COLOR_BGR2GRAY,
        )

        # =====================================================
        # 2. RGB CHANNEL FORENSICS
        # =====================================================
        #
        # Edited regions can sometimes create unusual
        # disagreement between RGB channels.
        #
        # We calculate local channel differences instead
        # of using only the global image statistics.
        # =====================================================

        r = image_array[:, :, 0].astype(
            np.float32
        )

        g = image_array[:, :, 1].astype(
            np.float32
        )

        b = image_array[:, :, 2].astype(
            np.float32
        )

        rg = np.abs(r - g)
        rb = np.abs(r - b)
        gb = np.abs(g - b)

        rgb_anomaly = (
            rg + rb + gb
        ) / 3.0

        # Remove isolated pixel noise.
        rgb_anomaly = cv2.GaussianBlur(
            rgb_anomaly,
            (5, 5),
            0,
        )

        rgb_map = _normalize_map(
            rgb_anomaly
        )

        # =====================================================
        # 3. NOISE RESIDUAL FORENSICS
        # =====================================================
        #
        # High-frequency residuals can expose areas with
        # different compression / editing characteristics.
        # =====================================================

        blurred = cv2.GaussianBlur(
            gray,
            (5, 5),
            0,
        )

        residual = cv2.absdiff(
            gray,
            blurred,
        )

        noise_mean = float(
            np.mean(residual)
        )

        noise_std = float(
            np.std(residual)
        )

        residual_float = residual.astype(
            np.float32
        )

        residual_smooth = cv2.GaussianBlur(
            residual_float,
            (7, 7),
            0,
        )

        noise_map = _normalize_map(
            residual_smooth
        )

        # =====================================================
        # 4. EDGE / STRUCTURAL ANALYSIS
        # =====================================================

        edges = cv2.Canny(
            gray,
            100,
            200,
        )

        edge_ratio = float(
            np.count_nonzero(edges)
            / edges.size
        )

        # Convert edge map to a smoothed structural map.
        edge_float = (
            edges.astype(np.float32)
            / 255.0
        )

        edge_blur = cv2.GaussianBlur(
            edge_float,
            (9, 9),
            0,
        )

        edge_map = _normalize_map(
            edge_blur
        )

        # =====================================================
        # 5. MULTI-FORENSIC FUSION
        # =====================================================
        #
        # Combine independent forensic signals.
        #
        # RGB       → channel inconsistency
        # Noise     → local residual anomalies
        # Structure → edge discontinuities
        # =====================================================

        rgb_score_map = (
            rgb_map.astype(np.float32)
            / 255.0
        )

        noise_score_map = (
            noise_map.astype(np.float32)
            / 255.0
        )

        edge_score_map = (
            edge_map.astype(np.float32)
            / 255.0
        )

        combined_anomaly = (
            0.40 * rgb_score_map
            + 0.40 * noise_score_map
            + 0.20 * edge_score_map
        )

        combined_anomaly = cv2.GaussianBlur(
            combined_anomaly,
            (9, 9),
            0,
        )

        # =====================================================
        # 6. LOCALIZED SUSPICIOUS REGION
        # =====================================================

        anomaly_uint8 = _normalize_map(
            combined_anomaly
        )

        # Adaptive threshold identifies unusually
        # anomalous regions relative to this document.
        threshold_value = float(
            np.percentile(
                anomaly_uint8,
                97,
            )
        )

        suspicious_mask = (
            anomaly_uint8 >= threshold_value
        ).astype(np.uint8) * 255

        # Remove tiny isolated regions.
        kernel = np.ones(
            (5, 5),
            np.uint8,
        )

        suspicious_mask = cv2.morphologyEx(
            suspicious_mask,
            cv2.MORPH_OPEN,
            kernel,
        )

        suspicious_mask = cv2.morphologyEx(
            suspicious_mask,
            cv2.MORPH_CLOSE,
            kernel,
        )

        # =====================================================
        # 7. LOCALIZATION STATISTICS
        # =====================================================

        suspicious_pixels = int(
            np.count_nonzero(
                suspicious_mask
            )
        )

        total_pixels = int(
            suspicious_mask.size
        )

        suspicious_ratio = (
            suspicious_pixels
            / total_pixels
            if total_pixels
            else 0.0
        )

        # Find connected suspicious regions.
        contours, _ = cv2.findContours(
            suspicious_mask,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE,
        )

        regions = []

        image_area = width * height

        for contour in contours:

            area = cv2.contourArea(
                contour
            )

            # Ignore tiny artifacts.
            if area < image_area * 0.001:
                continue

            x, y, w, h = cv2.boundingRect(
                contour
            )

            regions.append({
                "x": int(x),
                "y": int(y),
                "width": int(w),
                "height": int(h),
                "area": round(float(area), 2),
            })

        # Sort largest regions first.
        regions.sort(
            key=lambda item: item["area"],
            reverse=True,
        )

        regions = regions[:10]

        # =====================================================
        # 8. HEATMAP
        # =====================================================

        heatmap_color = cv2.applyColorMap(
            anomaly_uint8,
            cv2.COLORMAP_JET,
        )

        # Overlay heatmap on original image.
        heatmap_overlay = cv2.addWeighted(
            bgr,
            0.55,
            heatmap_color,
            0.45,
            0,
        )

        # Draw suspicious-region boxes.
        for region in regions:

            x = region["x"]
            y = region["y"]
            w = region["width"]
            h = region["height"]

            cv2.rectangle(
                heatmap_overlay,
                (x, y),
                (x + w, y + h),
                (0, 0, 255),
                2,
            )

        # =====================================================
        # 9. FORENSIC SCORES
        # =====================================================

        rgb_mean = float(
            np.mean(rgb_anomaly)
        )

        rgb_high_ratio = float(
            np.mean(
                rgb_map > 220
            )
        )

        noise_high_ratio = float(
            np.mean(
                noise_map > 220
            )
        )

        # Local anomaly score.
        anomaly_mean = float(
            np.mean(combined_anomaly)
        )

        anomaly_high_ratio = float(
            np.mean(
                anomaly_uint8 > 220
            )
        )

        # =====================================================
        # 10. TAMPERING SCORE
        # =====================================================
        #
        # This is deliberately conservative.
        # The system is a screening aid, not proof of fraud.
        # =====================================================

        score = 0.0

        # RGB inconsistency
        if rgb_high_ratio > 0.08:
            score += 25
        elif rgb_high_ratio > 0.04:
            score += 12

        # Noise anomaly
        if noise_high_ratio > 0.08:
            score += 25
        elif noise_high_ratio > 0.04:
            score += 12

        # Localized combined anomaly
        if anomaly_high_ratio > 0.06:
            score += 30
        elif anomaly_high_ratio > 0.03:
            score += 15

        # Suspicious region evidence
        if len(regions) >= 3:
            score += 10
        elif len(regions) >= 1:
            score += 5

        # Image quality penalty
        if width < 500 or height < 350:
            score += 5

        score = min(
            round(score),
            100,
        )

        # =====================================================
        # 11. RISK CLASSIFICATION
        # =====================================================

        if score >= 70:

            risk_level = "HIGH"
            tampering_detected = True

        elif score >= 40:

            risk_level = "MEDIUM"
            tampering_detected = True

        else:

            risk_level = "LOW"
            tampering_detected = False

        # =====================================================
        # 12. CONFIDENCE
        # =====================================================

        evidence_count = 0

        if rgb_high_ratio > 0.04:
            evidence_count += 1

        if noise_high_ratio > 0.04:
            evidence_count += 1

        if anomaly_high_ratio > 0.03:
            evidence_count += 1

        if regions:
            evidence_count += 1

        if evidence_count >= 3:
            confidence = min(
                max(score, 70),
                95,
            )

        elif evidence_count == 2:
            confidence = min(
                max(score, 50),
                80,
            )

        elif evidence_count == 1:
            confidence = min(
                max(score, 30),
                60,
            )

        else:
            confidence = 10

        # =====================================================
        # 13. EXPLANATION
        # =====================================================

        if risk_level == "HIGH":

            explanation = (
                "Multiple localized forensic anomalies were "
                "detected across RGB-channel consistency, "
                "noise residuals and structural analysis. "
                "The document should be referred for manual "
                "inspection."
            )

        elif risk_level == "MEDIUM":

            explanation = (
                "The forensic pipeline detected moderate "
                "localized anomalies. RGB, noise-residual and "
                "structural evidence should be reviewed "
                "manually before accepting the document."
            )

        else:

            explanation = (
                "RGB-channel consistency, noise residual and "
                "structural edge analysis completed. No "
                "significant localized forensic anomaly was "
                "detected."
            )

        # =====================================================
        # 14. SAVE FORENSIC OUTPUTS
        # =====================================================

        original_path = _save_image(
            "original.png",
            bgr,
            analysis_id,
        )

        rgb_output = cv2.applyColorMap(
            rgb_map,
            cv2.COLORMAP_JET,
        )

        rgb_path = _save_image(
            "rgb_anomaly.png",
            rgb_output,
            analysis_id,
        )

        noise_output = cv2.applyColorMap(
            noise_map,
            cv2.COLORMAP_JET,
        )

        noise_path = _save_image(
            "noise_residual.png",
            noise_output,
            analysis_id,
        )

        heatmap_path = _save_image(
            "tampering_heatmap.png",
            heatmap_overlay,
            analysis_id,
        )

        # =====================================================
        # 15. RETURN RESULT
        # =====================================================

        return {

            "status": "completed",

            "analysis_id": analysis_id,

            "tampering_detected":
                tampering_detected,

            "risk_level":
                risk_level,

            "confidence":
                confidence,

            "analysis": {

                "image_format":
                    image_format,

                "width":
                    width,

                "height":
                    height,

                "noise_mean":
                    round(
                        noise_mean,
                        2,
                    ),

                "noise_std":
                    round(
                        noise_std,
                        2,
                    ),

                "edge_ratio":
                    round(
                        edge_ratio,
                        4,
                    ),

                "rgb_mean":
                    round(
                        rgb_mean,
                        2,
                    ),

                "anomaly_mean":
                    round(
                        anomaly_mean,
                        4,
                    ),

                "suspicious_ratio":
                    round(
                        suspicious_ratio,
                        4,
                    ),

                "suspicious_regions":
                    len(regions),
            },

            "forensics": {

                "rgb_channel_anomaly":
                    round(
                        rgb_high_ratio * 100,
                        2,
                    ),

                "noise_anomaly":
                    round(
                        noise_high_ratio * 100,
                        2,
                    ),

                "localized_anomaly":
                    round(
                        anomaly_high_ratio * 100,
                        2,
                    ),

                "evidence_count":
                    evidence_count,
            },

            "regions":
                regions,

            "outputs": {

                "original":
                    original_path,

                "rgb_anomaly":
                    rgb_path,

                "noise_residual":
                    noise_path,

                "tampering_heatmap":
                    heatmap_path,
            },

            "explanation":
                explanation,
        }

    except Exception as error:

        return {

            "status": "failed",

            "analysis_id": analysis_id,

            "tampering_detected":
                False,

            "risk_level":
                "UNKNOWN",

            "confidence":
                0,

            "error":
                str(error),
        }