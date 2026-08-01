import { pb } from "../pb.js";
import { audit } from "./auditLogger.js";
import { sendApprovalRequestEmail, isEmailConfigured } from "./emailService.js";

// ── Approval request creation ─────────────────────────────────────────────────
// One PENDING approval_requests record per routed escalation. Called from the
// review pipeline (rule-based escalations), the feedback ESCALATED action, and
// the demo seed. Deduplicates so re-escalating the same clause to the same
// role never produces a second pending item, writes an escalation_triggered
// audit entry carrying the contract id, and attempts the approver
// notification email (a no-op until SMTP is configured).

export interface CreateApprovalParams {
  documentId:     string;
  resultId?:      string;
  clauseCategory?: string;
  role:           string;   // CFO | BOARD | GC | ...
  reason:         string;   // plain-English routing reason shown to the approver
  requestedBy?:   string;   // requester email
  /** Set false when the caller already sent its own escalation email. */
  notify?:        boolean;
}

export async function createApprovalRequest(p: CreateApprovalParams): Promise<string | null> {
  try {
    const doc = await pb.collection("uploaded_documents").getOne(p.documentId).catch(() => null);
    if (!doc) return null;
    const companyId = doc["company"] as string;
    if (!companyId) {
      console.warn(`[approvals] Document ${p.documentId} has no company, skipping approval request`);
      return null;
    }

    // clauseCategory can be user-authored text on custom playbook rules:
    // strip quote characters before interpolating into the filter so a quoted
    // category can neither break the query nor alter its scope.
    const safeCategory = (p.clauseCategory ?? "").replace(/["'\\]/g, "");
    const clauseFilter = safeCategory ? ` && clauseCategory = "${safeCategory}"` : "";
    const existing = await pb.collection("approval_requests").getFullList({
      filter: `document = "${p.documentId}" && routedToRole = "${p.role}" && status = "PENDING"${clauseFilter}`,
    }).catch(() => []);
    if (existing.length > 0) {
      // A pipeline-created request carries no requester; a later human
      // escalation of the same clause should still get the decision email.
      if (p.requestedBy && !existing[0]["requestedBy"]) {
        await pb.collection("approval_requests").update(existing[0].id, { requestedBy: p.requestedBy }).catch(() => null);
      }
      return existing[0].id;
    }

    const rec = await pb.collection("approval_requests").create({
      company:        companyId,
      document:       p.documentId,
      result:         p.resultId ?? "",
      clauseCategory: p.clauseCategory ?? "",
      routedToRole:   p.role,
      reason:         p.reason,
      requestedBy:    p.requestedBy ?? "",
      status:         "PENDING",
    });

    await audit({
      action: "escalation_triggered",
      entityType: "approval_request",
      entityId: rec.id,
      companyId,
      detail: {
        documentId: p.documentId,
        role: p.role,
        reason: p.reason,
        clauseCategory: p.clauseCategory ?? "",
        contractName: doc["originalName"] ?? "",
      },
    });

    if (p.notify === false) return rec.id;

    // Approver notification: resolve the configured contact for this role.
    const contacts = await pb.collection("approval_contacts").getFullList({
      filter: `company = "${companyId}" && role = "${p.role}"`,
    }).catch(() => []);
    const contact = contacts[0];
    if (contact?.["email"] && contact?.["name"]) {
      const sent = await sendApprovalRequestEmail({
        to: { name: contact["name"] as string, email: contact["email"] as string },
        role: p.role,
        contractName: (doc["originalName"] as string) ?? "Contract",
        counterpartyName: (doc["counterpartyName"] as string) ?? "",
        contractValue: (doc["contractValue"] as number) ?? null,
        currency: (doc["currency"] as string) ?? "GBP",
        reason: p.reason,
        approvalId: rec.id,
      });
      // Record the outcome either way. A silently undelivered approval request
      // is worse than a visible failure: the approver waits for an email that
      // never came and the audit trail implies nothing was ever attempted.
      await audit({
        action: sent ? "escalation_email_sent" : "escalation_email_failed",
        entityType: "approval_request",
        entityId: rec.id,
        companyId,
        detail: {
          documentId: p.documentId,
          role: p.role,
          recipient: contact["email"],
          ...(sent ? {} : { reason: isEmailConfigured() ? "send failed" : "SMTP not configured" }),
        },
      });
      if (!sent) {
        console.warn(`[approvals] Approval ${rec.id} created but the ${p.role} was NOT notified (${isEmailConfigured() ? "send failed" : "SMTP not configured"})`);
      }
    } else {
      console.warn(`[approvals] Approval ${rec.id} created but no ${p.role} contact is configured, so nobody was notified`);
    }

    return rec.id;
  } catch (err) {
    // Approval creation must never break the calling flow (review pipeline or
    // feedback save).
    console.error("[approvals] Failed to create approval request:", (err as Error)?.message);
    return null;
  }
}
