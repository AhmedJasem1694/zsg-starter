import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { register } from "../lib/api";

type ErrorType = "already_exists" | "generic" | null;

const SECTORS = [
  "Financial Services",
  "Technology",
  "Healthcare",
  "Logistics and Supply Chain",
  "Legal Services",
  "Professional Services",
  "Charity and Non-profit",
  "Real Estate and Property",
  "Construction and Development",
  "Retail and Consumer",
  "Media and Entertainment",
  "Energy and Infrastructure",
  "Other",
];

export default function Register() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<ErrorType>(null);
  const [validationError, setValidationError] = useState("");

  // Progressive pre-steps
  const [preStep, setPreStep] = useState(1); // 1=persona, 2=sector, 3=risk, 4=account
  const [persona, setPersona] = useState('');
  const [sector, setSector] = useState('');
  const [customSector, setCustomSector] = useState('');
  const [riskAppetite, setRiskAppetite] = useState('');

  // The resolved sector value: if "Other" is selected, use the custom input
  const resolvedSector = sector === 'Other' ? customSector.trim() : sector;

  const mut = useMutation({
    mutationFn: () => register({ name: form.name, email: form.email, password: form.password }),
    onSuccess: async () => {
      // Store pre-step answers so Onboarding can pre-populate
      sessionStorage.setItem('onboarding_persona', persona);
      sessionStorage.setItem('onboarding_sector', resolvedSector);
      sessionStorage.setItem('onboarding_risk_appetite', riskAppetite);
      // Refetch auth so user is set before we navigate
      await queryClient.refetchQueries({ queryKey: ["auth-me"] });
      navigate("/onboarding");
    },
    onError: (e: Error) => {
      const msg = e.message;
      if (msg.includes("already exists") || msg.includes("409")) {
        setError("already_exists");
      } else {
        setError("generic");
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setValidationError("");
    if (form.password !== form.confirm) {
      setValidationError("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }
    mut.mutate();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto">
            <span className="text-white text-sm font-bold">Z</span>
          </div>
          <div>
            <div className="font-semibold text-lg">Create your Zane account</div>
            <div className="text-sm text-muted-foreground">Step {preStep} of 4</div>
          </div>
        </div>

        {/* Step 1: Persona */}
        {preStep === 1 && (
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold">What best describes you?</h2>
            </div>
            <div className="space-y-3">
              {[
                { value: "solo_gc", label: "Solo GC or first in-house hire" },
                { value: "small_team", label: "Small legal team of 2–5 lawyers" },
                { value: "founder", label: "Founder reviewing contracts" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setPersona(opt.value); setPreStep(2); }}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setPreStep(2)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Sector */}
        {preStep === 2 && (
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold">What sector is your company in?</h2>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sector</label>
              <select
                className="input"
                value={sector}
                onChange={(e) => { setSector(e.target.value); setCustomSector(''); }}
                autoFocus
              >
                <option value="">Select a sector…</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {sector === 'Other' && (
                <div className="space-y-1">
                  <input
                    type="text"
                    className="input"
                    placeholder="Please specify your industry"
                    value={customSector}
                    onChange={(e) => setCustomSector(e.target.value)}
                    autoFocus
                  />
                  {sector === 'Other' && customSector.trim() === '' && (
                    <p className="text-xs text-destructive">Please tell us your industry</p>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setPreStep(3)}
              disabled={!sector || (sector === 'Other' && !customSector.trim())}
            >
              Continue
            </button>
            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => setPreStep(1)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setPreStep(3)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Risk appetite */}
        {preStep === 3 && (
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold">What is your risk appetite?</h2>
            </div>
            <div className="space-y-3">
              {[
                { value: "CONSERVATIVE", label: "Conservative: we hold firm on positions" },
                { value: "BALANCED", label: "Balanced: we negotiate case by case" },
                { value: "COMMERCIAL", label: "Commercial: we accept risk for growth" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setRiskAppetite(opt.value); setPreStep(4); }}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => setPreStep(2)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setPreStep(4)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Create account */}
        {preStep === 4 && (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold">Create your account</h2>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Full name</label>
              <input
                type="text"
                className="input"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Work email</label>
              <input
                type="email"
                className="input"
                placeholder="jane@company.com"
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); setError(null); }}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                className="input"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Confirm password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </div>

            {/* Inline validation errors */}
            {validationError && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {validationError}
              </div>
            )}

            {/* API errors */}
            {error && (
              <div className="text-xs bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 space-y-1">
                {error === "already_exists" && (
                  <>
                    <p className="text-destructive">An account with this email already exists.</p>
                    <Link to="/login" className="text-primary hover:underline font-medium block mt-1">
                      Log in instead →
                    </Link>
                  </>
                )}
                {error === "generic" && (
                  <p className="text-destructive">Account creation failed. Please check your connection and try again.</p>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={mut.isPending}
            >
              {mut.isPending ? "Creating account…" : "Create account"}
            </button>

            <p className="text-[11px] text-muted-foreground text-center">
              After signing up you'll configure your company's legal playbook.
            </p>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setPreStep(3)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
        <p className="text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
