import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "./lib/api";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import ReviewDetail from "./pages/ReviewDetail";
import Playbook from "./pages/Playbook";
import Regulations from "./pages/Regulations";
import Security from "./pages/Security";
import Resources from "./pages/Resources";
import CaseStudy from "./pages/CaseStudy";
import ForFunds from "./pages/ForFunds";
import Portfolio from "./pages/Portfolio";
import ContractTimings from "./pages/ContractTimings";
import LitigationIntake from "./pages/LitigationIntake";
import BulkReview from "./pages/BulkReview";
import FounderDashboard from "./pages/founder/FounderDashboard";
import FounderReview from "./pages/founder/FounderReview";
import type { Persona } from "./lib/types";

// ── PersonaRouter — redirect /dashboard to the right persona path ─────────────

function PersonaRouter() {
  const { data: company, isPending } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    retry: false,
  });

  if (isPending) return null;
  if (!company) return <Navigate to="/onboarding" replace />;

  const persona: Persona = (company as { persona?: Persona }).persona ?? "CORPORATE";
  if (persona === "FOUNDER") {
    return <Navigate to="/app/founder/dashboard" replace />;
  }
  return <Navigate to="/app/legal/dashboard" replace />;
}

//── Auth guard helper ─────────────────────────────────────────────────────────

function RequireAuth({ children, company }: { children: React.ReactNode; company: unknown }) {
  return company ? <>{children}</> : <Navigate to="/onboarding" replace />;
}

// ── App routes ────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: company, isPending: companyLoading } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    retry: false,
    enabled: !!user,
  });

  if (authLoading || (user && companyLoading)) {
    return null;
  }

  const persona: Persona = (company as { persona?: Persona } | undefined)?.persona ?? "CORPORATE";
  const isFounderPersona = persona === "FOUNDER";

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/dashboard" replace /> : <Register />}
      />

      {/* Auth-required: onboarding */}
      <Route
        path="/onboarding"
        element={user ? <Onboarding /> : <Navigate to="/login" replace />}
      />

      {/* Smart redirect: /dashboard → persona-specific path */}
      <Route
        path="/dashboard"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : company ? (
            <PersonaRouter />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />

      {/* Legacy /review/:id redirect to persona-specific path */}
      <Route
        path="/review/:id"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : company ? (
            isFounderPersona ? (
              <RedirectReview base="/app/founder/review" />
            ) : (
              <RedirectReview base="/app/legal/review" />
            )
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />

      {/* ── FOUNDER ROUTES ─────────────────────────────────────────────────── */}
      <Route
        path="/app/founder/dashboard"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><FounderDashboard /></RequireAuth>}
      />
      <Route
        path="/app/founder/review/:id"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><FounderReview /></RequireAuth>}
      />
      {/* Documents list — same as founder dashboard for now */}
      <Route
        path="/app/founder/documents"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><FounderDashboard /></RequireAuth>}
      />

      {/* ── LEGAL ROUTES ───────────────────────────────────────────────────── */}
      <Route
        path="/app/legal/dashboard"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><Dashboard /></RequireAuth>}
      />
      <Route
        path="/app/legal/review/:id"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><ReviewDetail /></RequireAuth>}
      />
      <Route
        path="/app/legal/playbook"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><Playbook /></RequireAuth>}
      />
      <Route
        path="/app/legal/regulations"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><Regulations /></RequireAuth>}
      />
      <Route
        path="/app/legal/portfolio"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><Portfolio /></RequireAuth>}
      />
      <Route
        path="/app/legal/timings"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><ContractTimings /></RequireAuth>}
      />
      <Route
        path="/app/legal/bulk-review"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><BulkReview /></RequireAuth>}
      />
      <Route
        path="/app/legal/litigation-intake/:id"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><LitigationIntake /></RequireAuth>}
      />

      {/* Legacy route aliases → redirect to /app/legal/* */}
      <Route path="/playbook"     element={<Navigate to="/app/legal/playbook"     replace />} />
      <Route path="/regulations"  element={<Navigate to="/app/legal/regulations"  replace />} />
      <Route path="/portfolio"    element={<Navigate to="/app/legal/portfolio"    replace />} />
      <Route path="/timings"      element={<Navigate to="/app/legal/timings"      replace />} />
      <Route path="/bulk-review"  element={<Navigate to="/app/legal/bulk-review"  replace />} />
      <Route path="/litigation-intake/:id" element={<RedirectReview base="/app/legal/litigation-intake" />} />

      {/* Public info pages */}
      <Route path="/security"   element={<Security />} />
      <Route path="/resources"  element={<Resources />} />
      <Route path="/case-study" element={<CaseStudy />} />
      <Route path="/for-funds"  element={<ForFunds />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ── Redirect helper that preserves :id param ──────────────────────────────────

function RedirectReview({ base }: { base: string }) {
  return <ReviewRedirectInner base={base} />;
}

function ReviewRedirectInner({ base }: { base: string }) {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`${base}/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
