import Tesseract from 'tesseract.js';

/**
 * Extract text from an image file using Tesseract OCR.
 * Returns { text, confidence }.
 */
const ocrImage = async (buffer) => {
  const result = await Tesseract.recognize(buffer, 'eng', {
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
 * Reconstructs lines by sorting text items by their y-coordinates.
 */
const ocrPdf = async (buffer) => {
  const { getResolvedPDFJS } = await import('unpdf');
  const pdfjs = await getResolvedPDFJS();
  
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items;

    if (!items || items.length === 0) continue;

    // Sort items: top to bottom (descending Y), then left to right (ascending X)
    // In PDF space, Y=0 is the bottom, so higher Y means higher on the page.
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 5) {
        return yDiff; // Different line (top first)
      }
      return a.transform[4] - b.transform[4]; // Same line (left first)
    });

    let pageText = '';
    let lastY = null;
    let lastX = null;

    for (const item of items) {
      if (lastY === null) {
        pageText += item.str;
      } else {
        const yDiff = Math.abs(item.transform[5] - lastY);
        if (yDiff > 5) {
          pageText += '\n' + item.str; // New line
        } else {
          // Same line: add space if there's a gap between items
          const xDiff = item.transform[4] - (lastX || 0);
          if (xDiff > 3) {
            pageText += ' ' + item.str;
          } else {
            pageText += item.str;
          }
        }
      }
      lastY = item.transform[5];
      // Estimate end X coordinate of the item (current X + length of string approximated)
      lastX = item.transform[4] + (item.width || item.str.length * 5);
    }

    fullText += pageText + '\n';
  }

  if (fullText.trim().length > 20) {
    return {
      text: fullText.trim(),
      confidence: 95,
    };
  }

  return {
    text: '',
    confidence: 0,
  };
};

/**
 * Process a receipt file — routes to the right OCR handler based on mime type.
 */
export const processReceipt = async (buffer, mimeType) => {
  if (mimeType === 'application/pdf') {
    return ocrPdf(buffer);
  }
  // All image types
  return ocrImage(buffer);
};
