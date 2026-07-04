/**
 * Parse raw OCR text and extract structured receipt data.
 * Uses regex patterns to identify common receipt fields.
 */
export const parseReceiptText = (rawText) => {
  if (!rawText || rawText.trim().length === 0) {
    return {};
  }

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = rawText.toLowerCase();

  return {
    vendor: extractVendor(lines),
    amount: extractAmount(fullText),
    currency: extractCurrency(fullText),
    date: extractDate(fullText),
    invoiceNumber: extractInvoiceNumber(fullText),
    taxAmount: extractTax(fullText),
    items: extractItems(lines),
  };
};

// ─── Vendor ─────────────────────────────────────────────────────────────────
function extractVendor(lines) {
  // The vendor name is usually in the first few non-empty lines
  for (const line of lines.slice(0, 5)) {
    // Skip lines that look like dates, amounts, or addresses
    if (/^\d{1,2}[\/\-]/.test(line)) continue;
    if (/^[\d.,]+$/.test(line)) continue;
    if (/invoice|receipt|bill|tax|gst|date|tally/i.test(line)) continue;
    if (line.length >= 3 && line.length <= 80) {
      return line;
    }
  }
  return null;
}

// ─── Amount ─────────────────────────────────────────────────────────────────
function extractAmount(text) {
  // Try to find Grand Total / Total Amount / Amount Due first
  const grandTotalPatterns = [
    /grand\s*total\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/i,
    /total\s*amount\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/i,
    /amount\s*due\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/i,
    /net\s*total\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/i,
    /total\s*due\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of grandTotalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0) return amount;
    }
  }

  // Fallback to "total" (excluding subtotal)
  const totalMatch = text.match(/(?<!sub)total\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/i);
  if (totalMatch) {
    const amount = parseFloat(totalMatch[1].replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) return amount;
  }

  // Fallback to subtotal if nothing else
  const subtotalMatch = text.match(/subtotal\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/i);
  if (subtotalMatch) {
    const amount = parseFloat(subtotalMatch[1].replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) return amount;
  }

  return null;
}

// ─── Currency ───────────────────────────────────────────────────────────────
function extractCurrency(text) {
  if (/₹|rs\.?|inr|rupee/i.test(text)) return 'INR';
  if (/\$|usd|dollar/i.test(text)) return 'USD';
  if (/€|eur|euro/i.test(text)) return 'EUR';
  if (/£|gbp|pound/i.test(text)) return 'GBP';
  return 'INR'; // default
}

// ─── Date ───────────────────────────────────────────────────────────────────
function extractDate(text) {
  // DD/MM/YYYY or DD-MM-YYYY
  const ddMmYyyyMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddMmYyyyMatch) {
    const day = parseInt(ddMmYyyyMatch[1], 10);
    const month = parseInt(ddMmYyyyMatch[2], 10);
    const year = parseInt(ddMmYyyyMatch[3], 10);
    
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  // YYYY-MM-DD
  const yyyyMmDdMatch = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyyMmDdMatch) {
    const year = parseInt(yyyyMmDdMatch[1], 10);
    const month = parseInt(yyyyMmDdMatch[2], 10);
    const day = parseInt(yyyyMmDdMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  // DD Mon YYYY
  const ddMonYyyyMatch = text.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})/i);
  if (ddMonYyyyMatch) {
    const day = parseInt(ddMonYyyyMatch[1], 10);
    const monthStr = ddMonYyyyMatch[2].toLowerCase();
    const year = parseInt(ddMonYyyyMatch[3], 10);
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    return new Date(Date.UTC(year, months[monthStr], day));
  }

  return null;
}

// ─── Invoice Number ─────────────────────────────────────────────────────────
function extractInvoiceNumber(text) {
  const patterns = [
    /(?:invoice\s*no|invoice\s*number|inv\s*no|inv\s*#|bill\s*no|receipt\s*no|invoice|inv)\s*[:#\-]?\s*([a-z0-9\-\/]+)/i,
    /(?:invoice|inv|bill|receipt)\s*[:#\-]\s*([a-z0-9\-\/]+)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = match[1].trim();
      if (val && !/^(?:date|time|table|served|guest|total|subtotal)$/i.test(val)) {
        return val;
      }
    }
  }
  return null;
}

// ─── Tax ────────────────────────────────────────────────────────────────────
function extractTax(text) {
  const patterns = [
    /(?:gst|cgst|sgst|igst|tax|vat)\s*(?:@\s*\d+\.?\d*%)?\s*[:\-]?\s*(?:rs\.?|₹)?\s*([\d,]+\.?\d*)/i,
    /(?:cgst\s*\+\s*sgst|service\s*charge)\s*(?:\(\d+%\))?\s*(?:-?\s*-?\s*)?(?:rs\.?|₹)?\s*([\d,]+\.?\d*)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0) return amount;
    }
  }
  return null;
}

// ─── Line Items ─────────────────────────────────────────────────────────────
function extractItems(lines) {
  const items = [];
  const skipKeywords = /qty|quantity|rate|price|sr\.?\s*no|item|description|amount|subtotal|total|vat|gst|tax|payment/i;

  for (const line of lines) {
    if (skipKeywords.test(line)) continue;
    if (line.includes('===') || line.includes('---')) continue;

    // Match lines ending with amount
    const amountMatch = line.match(/(?:rs\.?|₹|inr|\$|€|£)?\s*([\d,]+\.\d{2})\s*$/i);
    if (amountMatch) {
      const amountStr = amountMatch[1];
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      
      if (amount > 0) {
        let rest = line.substring(0, line.lastIndexOf(amountMatch[0])).trim();
        rest = rest.replace(/[\-\s\.\:]+$/, '').trim();

        // Strip quantity/rate suffix
        rest = rest.replace(/\s+\d+\s+[\d,]+\.\d{2}\s*$/, '');
        rest = rest.replace(/\s+[\d,]+\.\d{2}\s*$/, '');
        rest = rest.replace(/\s+\d+\s*$/, '');
        
        // Strip item index prefix
        rest = rest.replace(/^\d+[\s\.\-\)]+/, '');

        const description = rest.trim();
        if (description.length >= 3 && description.length <= 100) {
          items.push({ description, amount });
        }
      }
    }
  }
  return items;
}
