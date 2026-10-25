/**
 * The ask, with the form inline.
 *
 * This replaces the modal that used to sit behind a button. A form a reader
 * can see is a form they can start; one behind a click is a decision before
 * the decision.
 *
 * Failure is loud on purpose. The server stores the submission before it tries
 * to notify anyone, so nothing is lost either way, but it answers 502 when the
 * email could not be sent. Showing "you will hear from us" when no notification
 * left the building is the exact failure this form was rebuilt to avoid, so the
 * error state is shown instead, with a mailto that does not depend on us.
 */

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CTA } from "../../content/homepage";
import { requestAccess } from "../../lib/api";
import { Section } from "./Section";
import { rise } from "./motion";

const F = CTA.form;

/** id of the error region, referenced by every field via aria-describedby. */
const ERROR_ID = "cta-error";

export function CtaSection() {
  const [form, setForm] = useState({ name: "", email: "", company: "", role: "", prompt: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const canSubmit =
    form.name.trim() !== "" &&
    form.email.trim().includes("@") &&
    form.company.trim() !== "" &&
    form.role !== "";

  const set = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || state === "sending") return;
    setState("sending");
    setError("");
    try {
      await requestAccess({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        // Send the label rather than the enum: whoever reads the notification
        // wants "General Counsel or legal", not "LEGAL".
        role: F.roleOptions.find((o) => o.value === form.role)?.label ?? form.role,
        contractsDescription: form.prompt.trim(),
        website: form.website,
      });
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "");
      setState("error");
    }
  }

  const input =
    "w-full rounded-lg border border-line-dark bg-white/5 px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder:text-slate-400 focus:outline-none focus-visible:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt transition-colors";
  const label = "block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1.5";

  return (
    <Section copy={CTA} tone="dark">
      <motion.div className="mt-10 max-w-xl" {...rise(0.12)}>
        {state === "sent" ? (
          <div className="flex items-start gap-3 rounded-xl border border-line-dark bg-navy-800 px-5 py-6">
            <CheckCircle2 size={18} className="text-cobalt-light shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-base text-[#F8FAFC]">{F.successHeading}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="cta-name">{F.fields.name}</label>
                <input id="cta-name" aria-describedby={state === "error" ? ERROR_ID : undefined} aria-invalid={state === "error" || undefined} className={input} placeholder={F.placeholders.name} value={form.name} onChange={set("name")} autoComplete="name" />
              </div>
              <div>
                <label className={label} htmlFor="cta-email">{F.fields.email}</label>
                <input id="cta-email" aria-describedby={state === "error" ? ERROR_ID : undefined} aria-invalid={state === "error" || undefined} type="email" className={input} placeholder={F.placeholders.email} value={form.email} onChange={set("email")} autoComplete="email" />
              </div>
              <div>
                <label className={label} htmlFor="cta-company">{F.fields.company}</label>
                <input id="cta-company" aria-describedby={state === "error" ? ERROR_ID : undefined} aria-invalid={state === "error" || undefined} className={input} placeholder={F.placeholders.company} value={form.company} onChange={set("company")} autoComplete="organization" />
              </div>
              <div>
                <label className={label} htmlFor="cta-role">{F.fields.role}</label>
                <select id="cta-role" aria-describedby={state === "error" ? ERROR_ID : undefined} aria-invalid={state === "error" || undefined} className={input} value={form.role} onChange={set("role")}>
                  <option value="">{F.rolePlaceholder}</option>
                  {F.roleOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={label} htmlFor="cta-prompt">{F.fields.prompt}</label>
              <input id="cta-prompt" aria-describedby={state === "error" ? ERROR_ID : undefined} aria-invalid={state === "error" || undefined} className={input} placeholder={F.placeholders.prompt} value={form.prompt} onChange={set("prompt")} />
            </div>

            {/* Honeypot. Hidden from people and from assistive technology, and
                never autofilled, so only a bot reaches it. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
              <label htmlFor="cta-website">{F.honeypotLabel}</label>
              <input id="cta-website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
            </div>

            {state === "error" && (
              <div id={ERROR_ID} role="alert" className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                <p>{F.errorPrefix} {error}</p>
                <a
                  href={`mailto:${CTA.contact.email}`}
                  className="mt-1 inline-block font-medium underline underline-offset-4 hover:text-white transition-colors"
                >
                  {F.errorFallbackLabel}: {CTA.contact.email}
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || state === "sending"}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-cobalt hover:bg-cobalt-hover text-white font-semibold rounded-lg text-sm transition-[background-color,box-shadow,transform] duration-150 ease-out hover:shadow-lg hover:shadow-cobalt/25 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {state === "sending" ? F.submittingLabel : F.submitLabel} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>
        )}

        {state !== "sent" && (
          <p className="mt-5 text-xs text-slate-400">
            {CTA.contact.before}{" "}
            <a
              href={`mailto:${CTA.contact.email}`}
              className="text-slate-400 hover:text-white transition-colors underline underline-offset-2 decoration-slate-600 hover:decoration-slate-300"
            >
              {CTA.contact.email}
            </a>{" "}
            {CTA.contact.after}
          </p>
        )}
      </motion.div>
    </Section>
  );
}
