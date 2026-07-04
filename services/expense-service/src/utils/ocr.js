import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import fs from 'fs';

/**
 * Extract text from an image file using Tesseract OCR.
 * Returns { text, confidence }.
 */
const ocrImage = async (filePath) => {
  const result = await Tesseract.recognize(filePath, 'eng', {
    logger: (info) => {
      if (info.status === 'recognizing text') {
        // eslint-disable-next-line no-console
        console.log(`[OCR] Progress: ${(info.progress * 100).toFixed(1)}%`);
      }
    },
  });

  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
};

/**
 * Extract text from a PDF file.
 * Tries text extraction first; if the PDF is scanned (no text), returns empty.
 */
const ocrPdf = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  // If the PDF has embedded text, use it directly
  if (data.text && data.text.trim().length > 20) {
    return {
      text: data.text,
      confidence: 95, // embedded text is high confidence
    };
  }

  // Scanned PDF with no text — return empty (future: convert to image + OCR)
  return {
    text: '',
    confidence: 0,
  };
};

/**
 * Process a receipt file — routes to the right OCR handler based on mime type.
 */
export const processReceipt = async (filePath, mimeType) => {
  if (mimeType === 'application/pdf') {
    return ocrPdf(filePath);
  }
  // All image types
  return ocrImage(filePath);
};
