import io

import fitz
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter, ImageOps


pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Prepare an image for OCR.
    """

    image = image.convert("L")

    # Increase contrast
    image = ImageEnhance.Contrast(image).enhance(2.0)

    # Sharpen text
    image = image.filter(ImageFilter.SHARPEN)

    # Improve readability
    image = ImageOps.autocontrast(image)

    return image


def extract_text(file_bytes: bytes, filename: str = "") -> str:
    """
    Extract OCR text from images and PDFs.

    Images are processed directly.
    PDFs are rendered using PyMuPDF.
    """

    try:
        filename_lower = filename.lower()

        if filename_lower.endswith(".pdf"):
            pdf = fitz.open(
                stream=file_bytes,
                filetype="pdf",
            )

            if pdf.page_count == 0:
                raise RuntimeError("PDF contains no pages.")

            # Render first page at high resolution
            page = pdf.load_page(0)

            pixmap = page.get_pixmap(
                matrix=fitz.Matrix(3, 3),
                alpha=False,
            )

            image = Image.open(
                io.BytesIO(
                    pixmap.tobytes("png")
                )
            )

            pdf.close()

        else:
            image = Image.open(
                io.BytesIO(file_bytes)
            )

        image = preprocess_image(image)

        # OCR with explicit page segmentation
        text = pytesseract.image_to_string(
            image,
            config="--psm 6",
        )

        return text.strip()

    except Exception as error:
        raise RuntimeError(
            f"OCR processing failed: {error}"
        )