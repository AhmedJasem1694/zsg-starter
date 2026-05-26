import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { register } from "../lib/api";

type ErrorType = "already_exists" | "generic" | null;

export default function Register() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<ErrorType>(null);
  const [validationError, setValidationError] = useState("");

  const mut = useMutation({
    mutationFn: () => register({ name: form.name, email: form.email, password: form.password }),
    onSuccess: async () => {
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
            <div className="text-sm text-muted-foreground">Takes 30 seconds</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
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

          {/* Inline validation errors (password mismatch etc.) */}
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
        </form>

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
