import type { TxStatus, ActionType } from "./types";

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmt(n: number): string {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : "+"}R ${abs}`;
}

export function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function now(): string {
  return new Date().toISOString();
}

// ── Status display config ─────────────────────────────────────────────────────

export const STATUS_CFG: Record<
  TxStatus,
  { label: string; short: string; bg: string; text: string; border: string; dot: string }
> = {
  matched:          { label: "Matched",          short: "Matched",   bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500"  },
  possible_match:   { label: "Possible Match",   short: "Possible",  bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500"     },
  manual_review:    { label: "Manual Review",    short: "Manual",    bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"    },
  invalid_row:      { label: "Invalid Row",      short: "Invalid",   bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     dot: "bg-red-500"      },
  unmatched_bank:   { label: "Unmatched Bank",   short: "No Ledger", bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-500"   },
  unmatched_ledger: { label: "Unmatched Ledger", short: "No Bank",   bg: "bg-purple-50",   text: "text-purple-700",  border: "border-purple-200",  dot: "bg-purple-500"   },
};

export const ACTION_LABELS: Record<ActionType, string> = {
  approve_match: "Approved match",
  reject_match:  "Rejected match",
  mark_manual:   "Marked manual review",
  edit_field:    "Edited field",
  export_json:   "Exported JSON report",
  export_pdf:    "Exported PDF report",
};
