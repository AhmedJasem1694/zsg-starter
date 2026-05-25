import { llmJsonCall } from "./llmJsonParse.js";

export interface AuditFinding {
  pass: "DEFINED_TERMS" | "CROSS_REFERENCES" | "NUMBERS_DATES" | "INTERNAL_CONSISTENCY";
  severity: "HIGH" | "MEDIUM" | "LOW";
  type: string;         // Brief type label
  description: string;  // What the issue is
  location: string;     // Where in the document (clause number or description)
  recommendation: string;
}

export interface DocumentAuditResult {
  definedTerms: AuditFinding[];
  crossReferences: AuditFinding[];
  numbersDates: AuditFinding[];
  internalConsistency: AuditFinding[];
  totalFindings: number;
  highSeverityCount: number;
}

export async function runDocumentAudit(
  documentText: string,
  companyName: string,
  contractType: string
): Promise<DocumentAuditResult> {
  const systemPrompt = `You are a meticulous contract drafting auditor for ${companyName}. You identify structural, drafting, and mechanical errors in contracts. You are not assessing commercial risk — you are finding errors that could undermine the legal effectiveness of the document.

RECOMMENDATION DISCIPLINE: Never give a conclusion that says it could go either way. Always commit to a finding. If you find an issue, state it precisely. If there is no issue, do not hallucinate one.`;

  // Run all 4 independent passes in parallel
  const [definedTermsResult, crossRefsResult, numbersResult, consistencyResult] = await Promise.allSettled([
    runDefinedTermsAudit(documentText, systemPrompt, contractType),
    runCrossReferenceAudit(documentText, systemPrompt),
    runNumbersDatesAudit(documentText, systemPrompt),
    runInternalConsistencyAudit(documentText, systemPrompt),
  ]);

  const definedTerms = definedTermsResult.status === "fulfilled" ? definedTermsResult.value : [];
  const crossReferences = crossRefsResult.status === "fulfilled" ? crossRefsResult.value : [];
  const numbersDates = numbersResult.status === "fulfilled" ? numbersResult.value : [];
  const internalConsistency = consistencyResult.status === "fulfilled" ? consistencyResult.value : [];

  if (definedTermsResult.status === "rejected") console.warn("[audit] Pass 2 (defined terms) failed:", definedTermsResult.reason);
  if (crossRefsResult.status === "rejected") console.warn("[audit] Pass 3 (cross-references) failed:", crossRefsResult.reason);
  if (numbersResult.status === "rejected") console.warn("[audit] Pass 4 (numbers/dates) failed:", numbersResult.reason);
  if (consistencyResult.status === "rejected") console.warn("[audit] Pass 5 (consistency) failed:", consistencyResult.reason);

  const allFindings = [...definedTerms, ...crossReferences, ...numbersDates, ...internalConsistency];
  return {
    definedTerms,
    crossReferences,
    numbersDates,
    internalConsistency,
    totalFindings: allFindings.length,
    highSeverityCount: allFindings.filter(f => f.severity === "HIGH").length,
  };
}

async function runDefinedTermsAudit(text: string, systemPrompt: string, contractType: string): Promise<AuditFinding[]> {
  // Truncate to 8000 chars to keep tokens manageable
  const excerpt = text.slice(0, 8000);
  const result = await llmJsonCall<{ findings: AuditFinding[] }>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Perform a defined terms audit on this ${contractType} contract excerpt.

Check:
1. Are all capitalised terms that appear to be defined terms (e.g. "the Services", "the Effective Date", "Confidential Information") actually defined somewhere in the document?
2. Are there capitalised terms used without a definition?
3. Are any defined terms used inconsistently between the main body and any schedule?

Return ONLY valid JSON:
{
  "findings": [
    {
      "pass": "DEFINED_TERMS",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "Undefined term" | "Inconsistent usage" | "Missing definition" | "Circular definition",
      "description": "Specific description of the issue with the exact term",
      "location": "Where in the document this occurs (clause number if visible, or description)",
      "recommendation": "Specific fix - what wording to add or change"
    }
  ]
}

Return an empty findings array if no issues found. Maximum 8 findings. Only flag genuine issues.

CONTRACT EXCERPT:
${excerpt}` },
    ],
    maxTokens: 1500,
    description: "defined terms audit",
  });
  return result.findings ?? [];
}

async function runCrossReferenceAudit(text: string, systemPrompt: string): Promise<AuditFinding[]> {
  const excerpt = text.slice(0, 8000);
  const result = await llmJsonCall<{ findings: AuditFinding[] }>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Perform a cross-reference audit on this contract excerpt.

Check:
1. Identify every cross-reference in the document (e.g. "as defined in clause 5.2", "subject to clause 8", "in accordance with Schedule 2").
2. For each one, check whether the referenced clause/schedule appears to exist in this document.
3. For each one, check whether the referenced clause appears to say what the cross-reference implies it says.
4. Flag any cross-reference that points to a non-existent clause or whose content does not match the implication.

Return ONLY valid JSON:
{
  "findings": [
    {
      "pass": "CROSS_REFERENCES",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "Dead reference" | "Mismatched reference" | "Ambiguous reference",
      "description": "The specific cross-reference and what is wrong with it",
      "location": "Where the cross-reference appears",
      "recommendation": "Specific fix"
    }
  ]
}

Return empty findings array if no issues. Maximum 8 findings.

CONTRACT EXCERPT:
${excerpt}` },
    ],
    maxTokens: 1500,
    description: "cross-reference audit",
  });
  return result.findings ?? [];
}

async function runNumbersDatesAudit(text: string, systemPrompt: string): Promise<AuditFinding[]> {
  const excerpt = text.slice(0, 8000);
  const result = await llmJsonCall<{ findings: AuditFinding[] }>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Perform a numbers, dates, and amounts audit on this contract excerpt.

Check:
1. Does any number, payment amount, date, or notice period appear in more than one place with different values? Flag every inconsistency.
2. Are any dates in numeric format only (e.g. "01/02/2025") in what appears to be an international contract? Flag as ambiguous.
3. Do notice periods in one clause contradict notice periods elsewhere?
4. Are payment amounts stated consistently (same currency, same figure) throughout?

Return ONLY valid JSON:
{
  "findings": [
    {
      "pass": "NUMBERS_DATES",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "Inconsistent amount" | "Inconsistent date" | "Ambiguous date format" | "Inconsistent notice period" | "Currency inconsistency",
      "description": "The specific inconsistency with the exact values",
      "location": "Where the conflicting values appear",
      "recommendation": "Specific fix"
    }
  ]
}

Return empty findings array if no issues. Maximum 8 findings.

CONTRACT EXCERPT:
${excerpt}` },
    ],
    maxTokens: 1500,
    description: "numbers/dates audit",
  });
  return result.findings ?? [];
}

async function runInternalConsistencyAudit(text: string, systemPrompt: string): Promise<AuditFinding[]> {
  const excerpt = text.slice(0, 8000);
  const result = await llmJsonCall<{ findings: AuditFinding[] }>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Perform an internal consistency audit on this contract excerpt.

Specifically check:
1. Do termination notice periods account for deemed receipt periods in the notices clause? (e.g. if notice is deemed received 2 days after posting, does the termination clause's notice period factor this in?)
2. Are payment terms consistent between the main body and any schedule?
3. Are service standards in the body consistent with any SLA in a schedule?
4. Is there an order of precedence clause? If yes, does it resolve conflicts between the body and schedules? If there are apparent conflicts between documents, flag them.
5. Are any obligations imposed on a party in one clause contradicted or undermined by a carve-out elsewhere?

Return ONLY valid JSON:
{
  "findings": [
    {
      "pass": "INTERNAL_CONSISTENCY",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "Termination/notice conflict" | "Payment inconsistency" | "SLA conflict" | "Missing precedence clause" | "Contradictory obligations" | "Schedule conflict",
      "description": "The specific inconsistency",
      "location": "Clauses involved",
      "recommendation": "Specific fix"
    }
  ]
}

Return empty findings array if no issues. Maximum 8 findings.

CONTRACT EXCERPT:
${excerpt}` },
    ],
    maxTokens: 1500,
    description: "internal consistency audit",
  });
  return result.findings ?? [];
}
