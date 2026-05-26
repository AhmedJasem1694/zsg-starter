import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../lib/api";

type ErrorType = "wrong_password" | "not_found" | "expired" | "generic" | null;

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errorType, setErrorType] = useState<ErrorType>(null);

  // Read the ?return= param so we can redirect back after login
  const searchParams = new URLSearchParams(window.location.search);
  const returnPath = searchParams.get("return");

  const mut = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      // refetchQueries waits for the data to arrive in cache before navigating.
      // invalidateQueries only marks stale — if the query was in error state the
      // cached value stays undefined and /dashboard redirects to /onboarding.
      await queryClient.refetchQueries({ queryKey: ["auth-me"] });
      await queryClient.refetchQueries({ queryKey: ["company"] }).catch(() => {
        // company 404 means no company yet → /dashboard will send to /onboarding
      });
      navigate(returnPath ?? "/dashboard");
    },
    onError: (e: Error) => {
      const msg = e.message;
      if (msg.includes("No account found")) {
        setErrorType("not_found");
      } else if (msg.includes("incorrect") || msg.includes("Invalid") || msg.includes("401")) {
        setErrorType("wrong_password");
      } else if (msg.includes("expired") || msg.includes("session")) {
        setErrorType("expired");
      } else {
        setErrorType("generic");
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorType(null);
    mut.mutate(form);
  }

  function clearError() {
    setErrorType(null);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <div>
            <div className="font-semibold text-lg">Sign in to Zane</div>
            <div className="text-sm text-muted-foreground">Your legal decision engine</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => { setForm({ ...form, email: e.target.value }); clearError(); }}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => { setForm({ ...form, password: e.target.value }); clearError(); }}
              required
            />
          </div>

          {errorType && (
            <div className="text-xs bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 space-y-1">
              {errorType === "wrong_password" && (
                <p className="text-destructive">Email or password is incorrect. Please try again.</p>
              )}
              {errorType === "not_found" && (
                <>
                  <p className="text-destructive">No account found with this email address.</p>
                  <Link to="/register" className="text-primary hover:underline font-medium block mt-1">
                    Register instead →
                  </Link>
                </>
              )}
              {errorType === "expired" && (
                <p className="text-destructive">Your session has expired. Please log in again.</p>
              )}
              {errorType === "generic" && (
                <p className="text-destructive">Sign-in failed. Please check your connection and try again.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={mut.isPending}
          >
            {mut.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Create one
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
