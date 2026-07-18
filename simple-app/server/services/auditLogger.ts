/**
 * Audit Logger
 *
 * Writes structured audit events to the `audit_log` PocketBase collection.
 * All calls are fire-and-forget - a logging failure never breaks the main flow.
 *
 * Action types follow the pattern: <entity>_<event>
 * e.g. "contract_uploaded", "clause_extracted", "rag_status_assigned"
 */

import { pb } from "../pb.js";

// ── Action type registry ──────────────────────────────────────────────────────

export type AuditAction =
  // Document lifecycle
  | "contract_uploaded"
  | "contract_deleted"
  // Review pipeline
  | "review_started"
  | "clause_extracted"
  | "rag_status_assigned"
  | "review_completed"
  | "review_failed"
  // PII pipeline
  | "pii_anonymisation_started"
  | "pii_anonymisation_completed"
  | "pii_entities_detected"
  // Escalation and approval
  | "escalation_triggered"
  | "escalation_email_sent"
  | "approval_granted"
  | "approval_rejected"
  // Feedback
  | "feedback_accepted"
  | "feedback_edited"
  | "feedback_escalated"
  | "feedback_dismissed"
  | "teach_zane_correction"
  | "false_positive_marked"
  // Playbook
  | "playbook_updated"
  | "playbook_rule_created"
  | "playbook_rule_deleted"
  // Onboarding
  | "company_created"
  | "company_updated"
  // Auth
  | "user_registered"
  | "user_login"
  | "user_logout"
  // Litigation
  | "litigation_intake_started"
  | "litigation_intake_completed"
  // Governance
  | "governance_thresholds_saved"
  | "governance_triggers_saved"
  | "team_invite_sent"
  // Regulatory profile
  | "regulatory_profile_updated"
  // Outcome capture
  | "contract_outcome_captured"
  // Contradiction detection
  | "contradiction_detected"
  // Pattern intelligence
  | "playbook_suggestion_generated"
  | "pattern_detected"
  // Data export
  | "audit_log_exported";

// ── Core log function ─────────────────────────────────────────────────────────

export interface AuditEntry {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  companyId?: string;
  userId?: string;
  /** Arbitrary structured detail - will be JSON-serialised */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detail?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Write an audit log entry. Never throws - failures are logged to console only.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    // Build the payload. `company` is the relation field (needs a valid record ID);
    // `companyId` is a compat text field kept for backwards compatibility.
    // Only set the relation when we actually have a company ID to avoid validation errors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      action: entry.action,
      entityType: entry.entityType ?? "",
      entityId: entry.entityId ?? "",
      companyId: entry.companyId ?? "",
      userId: entry.userId ?? "",
      detail: entry.detail ? JSON.stringify(entry.detail) : "{}",
      ipAddress: entry.ipAddress ?? "",
      // `created` is a plain date field (not autodate) so historical demo
      // entries could be backfilled; every writer goes through this function,
      // which stamps the real event time.
      created: new Date().toISOString().replace("T", " "),
    };
    if (entry.companyId) {
      payload.company = entry.companyId; // satisfy the relation field
    }
    await pb.collection("audit_log").create(payload);
  } catch (err) {
    // Non-fatal: audit logging must never break the main application flow
    console.error("[AUDIT] Failed to write audit log entry:", err);
  }
}

/**
 * Convenience wrapper for fire-and-forget audit calls in sync contexts.
 * Use when you don't want to await.
 */
export function auditSync(entry: AuditEntry): void {
  audit(entry).catch((err) => {
    console.error("[AUDIT] Unhandled audit error:", err);
  });
}
