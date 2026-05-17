// ── Synonym map ───────────────────────────────────────────────────────────────
//
// Maps raw banking descriptions (lowercased) to canonical category labels.
// Keys are sorted longest-first so more specific phrases match before shorter ones.
//
// ENGINEERS: This is the primary place to extend description matching.
// Add entries here as new banking description patterns are discovered.
// The key must be lowercase; the value is the canonical category name.
// See docs/ENGINE.md and docs/KNOWN_ISSUES.md for full context.

export const SYNONYMS: Record<string, string> = {
  // Salary / payroll
  "sal apr pay":              "salary payment",
  "salary payment apr":       "salary payment",
  "salary payment":           "salary payment",

  // Equipment
  "eqp purch":                "equipment purchase",
  "equipment buy":            "equipment purchase",
  "equipment purchase":       "equipment purchase",

  // Internet / ISP
  "isp payment":              "internet subscription",
  "internet sub apr":         "internet subscription",
  "internet subscription":    "internet subscription",

  // Transfers
  "trf to sav":               "transfer savings",
  "transfer sav":             "transfer savings",
  "transfer to savings":      "transfer savings",

  // Bank fees
  "bank charges":             "bank charges",
  "bank fee":                 "bank charges",
  "monthly fee":              "bank charges",

  // Office / stationery
  "office supplies cpt":      "office supplies",
  "stationary purchase":      "office supplies",
  "stationery purchase":      "office supplies",
  "office supplies":          "office supplies",

  // Vendor refunds
  "refund vendor":            "vendor refund",
  "vendor refund":            "vendor refund",

  // Client payments
  "client inv 1001":          "client payment",
  "client payment ref a12":   "client payment",
  "client payment ref#a12":   "client payment",
  "client payment":           "client payment",
};

export const SYNONYM_KEYS = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length);

// ── OCR artifact detection ────────────────────────────────────────────────────

export function hasOcrArtifacts(s: string): boolean {
  return /[|\[\]]/.test(s) || /\.{3,}/.test(s) || / {3,}/.test(s);
}

// ── Description normalizer ────────────────────────────────────────────────────
//
// Produces a canonical form of a banking description for comparison.
// Pipeline:
//   1. Lowercase + trim
//   2. Strip OCR artifacts (pipes, brackets, ellipses, extra spaces)
//   3. Strip non-alphanumeric characters
//   4. Synonym lookup (exact, prefix, suffix, substring, partial-word overlap >= 80%)
//   5. Strip trailing 1–2 digit counter suffixes ("bank charges1" → "bank charges")

export function normalizeDesc(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/[|\[\]]+/g, " ").replace(/\.{3,}/g, " ").replace(/\s{2,}/g, " ").trim();
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s{2,}/g, " ").trim();

  // Exact / positional synonym match
  for (const key of SYNONYM_KEYS) {
    if (
      s === key ||
      s.startsWith(key + " ") ||
      s.endsWith(" " + key) ||
      s.includes(" " + key + " ")
    ) {
      return SYNONYMS[key];
    }
    // Handle digit-suffix variants: "vendor refund2" → matches key "vendor refund"
    if (s.startsWith(key) && s.length > key.length && /^\d/.test(s[key.length])) {
      return SYNONYMS[key];
    }
  }

  // Token-overlap synonym match (>= 80% of key tokens present in description)
  const sWords = s.split(/\s+/).filter(Boolean);
  for (const key of SYNONYM_KEYS) {
    const kWords = key.split(/\s+/).filter(Boolean);
    if (kWords.length < 2) continue;
    const overlap = kWords.filter(w => sWords.includes(w)).length;
    if (overlap >= Math.ceil(kWords.length * 0.8)) return SYNONYMS[key];
  }

  // Strip trailing 1–2 digit counter suffixes
  s = s.replace(/([a-z])\d{1,2}$/, "$1").trim();
  s = s.replace(/\s+\d{1,2}$/, "").trim();

  return s;
}
