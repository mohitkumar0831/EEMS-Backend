/**
 * Generates a URL-safe slug from a company name.
 * e.g. "Acme Corp Pvt. Ltd." → "acme-corp-pvt-ltd"
 */
export const generateSlug = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // strip special chars except space & hyphen
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse consecutive hyphens
    .replace(/^-|-$/g, '');          // trim leading/trailing hyphens
