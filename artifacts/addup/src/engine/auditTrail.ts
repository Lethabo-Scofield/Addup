import type { CaseAuditEntry, CaseStatus } from "./types";

// ── Session-scoped audit trail ────────────────────────────────────────────────
//
// Logs every system and user action on a DiscrepancyCase.
// State is held in memory for the current browser session; exported to PDF/JSON
// when the user downloads the report.

class AuditTrailManager {
  private entries: CaseAuditEntry[] = [];

  log(
    caseId: string,
    actor: "system" | "user",
    action: string,
    beforeStatus?: CaseStatus,
    afterStatus?: CaseStatus,
    reason?: string,
    evidence?: string[],
  ): CaseAuditEntry {
    const entry: CaseAuditEntry = {
      ts: new Date().toISOString(),
      case_id: caseId,
      actor,
      action,
      before_status: beforeStatus,
      after_status: afterStatus,
      reason,
      evidence,
    };
    this.entries.push(entry);
    return entry;
  }

  getAll(): CaseAuditEntry[] {
    return [...this.entries];
  }

  getForCase(caseId: string): CaseAuditEntry[] {
    return this.entries.filter(e => e.case_id === caseId);
  }

  clear(): void {
    this.entries = [];
  }

  toJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}

export const caseAuditTrail = new AuditTrailManager();
