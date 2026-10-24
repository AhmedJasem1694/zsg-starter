/**
 * Access request modal.
 *
 * Lifted out of Landing.tsx unchanged in behaviour so the page itself is only
 * an assembler. This is the one lead capture on the site, and it posts to
 * requestAccess(), which writes to PocketBase.
 *
 * Known gap, carried over and not introduced here: a submission notifies
 * nobody. RESEND_API_KEY and APP_URL are unset, so the request lands in the
 * access_requests collection and sits there until someone looks. The form
 * promises no response time for that reason.
 */

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { requestAccess } from "../../lib/api";
import { REQUEST_ACCESS as C } from "../../content/homepage";

export function RequestAccessModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", role: "", contractsDescription: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    form.name.trim().length > 0 &&
    form.email.trim().includes("@") &&
    form.company.trim().length > 0 &&
    form.role.trim().length > 0;

  function set(field: keyof typeof form) {
    return (e: { target: { value: string } }) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await requestAccess({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        role: form.role.trim(),
        contractsDescription: form.contractsDescription.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : C.errorFallback);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line-dark bg-white/5 px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder:text-slate-600 focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/15 transition-colors";
  const labelCls = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-xl border border-line-dark bg-navy-800 p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-lg">
        <button
          onClick={onClose}
          aria-label={C.closeLabel}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={16} />
        </button>

        {submitted ? (
          <div className="py-10 text-center space-y-4">
            <h3 className="text-lg font-bold text-[#F8FAFC] tracking-tight leading-snug">{C.successHeading}</h3>
            <button
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
            >
              {C.closeLabel}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 pr-6">
              <h3 className="text-lg font-bold text-[#F8FAFC] tracking-tight">{C.heading}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{C.body}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="ra-name">{C.fields.name}</label>
                <input id="ra-name" type="text" className={inputCls} placeholder={C.placeholders.name} value={form.name} onChange={set("name")} autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="ra-email">{C.fields.email}</label>
                <input id="ra-email" type="email" className={inputCls} placeholder={C.placeholders.email} value={form.email} onChange={set("email")} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="ra-company">{C.fields.company}</label>
                <input id="ra-company" type="text" className={inputCls} placeholder={C.placeholders.company} value={form.company} onChange={set("company")} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="ra-role">{C.fields.role}</label>
                <input id="ra-role" type="text" className={inputCls} placeholder={C.placeholders.role} value={form.role} onChange={set("role")} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="ra-contracts">{C.fields.contracts}</label>
                <textarea id="ra-contracts" className={`${inputCls} min-h-[80px] resize-y`} placeholder={C.placeholders.contracts} value={form.contractsDescription} onChange={set("contractsDescription")} />
              </div>

              {error && (
                <div className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cobalt hover:bg-cobalt-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? C.submittingLabel : C.submitLabel}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
