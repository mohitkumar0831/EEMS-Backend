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
    if (/invoice|receipt|bill|tax|gst|date/i.test(line)) continue;
    if (line.length >= 3 && line.length <= 80) {
      return line;
    }
  }
  return null;
}

// ─── Amount ─────────────────────────────────────────────────────────────────
function extractAmount(text) {
  // Match patterns like: Total: 2,500.00 | Grand Total ₹1500 | Amount: Rs. 3,000
  const patterns = [
    /(?:grand\s*total|total\s*amount|net\s*total|total\s*due|amount\s*due|total)\s*[:\-]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/i,
    /(?:rs\.?|₹|inr)\s*([\d,]+\.?\d*)/i,
    /\$([\d,]+\.?\d*)/i,
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
  const patterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // YYYY-MM-DD
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    // DD Mon YYYY (e.g. 15 Jan 2024)
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const dateStr = match[0];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed;
      } catch {
        continue;
      }
    }
  }
  return null;
}

// ─── Invoice Number ─────────────────────────────────────────────────────────
function extractInvoiceNumber(text) {
  const match = text.match(/(?:invoice|inv|bill|receipt)\s*(?:no\.?|number|#|:)\s*([a-z0-9\-\/]+)/i);
  return match ? match[1].trim() : null;
}

// ─── Tax ────────────────────────────────────────────────────────────────────
function extractTax(text) {
  const patterns = [
    /(?:gst|cgst|sgst|igst|tax|vat)\s*[:\-]?\s*(?:rs\.?|₹)?\s*([\d,]+\.?\d*)/i,
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
  // Look for lines with a description followed by an amount
  const itemPattern = /^(.{3,50}?)\s+([\d,]+\.?\d{0,2})$/;
  
  for (const line of lines) {
    const match = line.match(itemPattern);
    if (match) {
      const description = match[1].trim();
      const amount = parseFloat(match[2].replace(/,/g, ''));
      // Skip header-like lines and zero amounts
      if (amount > 0 && !/qty|quantity|rate|price|sr\.?\s*no/i.test(description)) {
        items.push({ description, amount });
      }
    }
  }
  return items;
}
