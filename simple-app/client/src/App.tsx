import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "./lib/api";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import DocumentFirstDashboard from "./pages/DocumentFirstDashboard";
import Dashboard from "./pages/Dashboard";
import ReviewDetail from "./pages/ReviewDetail";
import Playbook from "./pages/Playbook";
import Regulations from "./pages/Regulations";
import Security from "./pages/Security";
import Resources from "./pages/Resources";
import FirstPlaybook from "./pages/resources/FirstPlaybook";
import RagStatus from "./pages/resources/RagStatus";
import ReviewTimeCaseStudy from "./pages/resources/ReviewTimeCaseStudy";
import ApprovalMatrix from "./pages/resources/ApprovalMatrix";
import PortfolioDashboard from "./pages/resources/PortfolioDashboard";
import SraGuidance from "./pages/resources/SraGuidance";
import CaseStudy from "./pages/CaseStudy";
import ForFunds from "./pages/ForFunds";
import Portfolio from "./pages/Portfolio";
import ContractTimings from "./pages/ContractTimings";
// Litigation disabled, commercial contracts focus.
// import LitigationIntake from "./pages/LitigationIntake";
import BulkReview from "./pages/BulkReview";
import Patterns from "./pages/Patterns";
import AuditTrail from "./pages/AuditTrail";
import FounderDashboard from "./pages/founder/FounderDashboard";
import FounderReview from "./pages/founder/FounderReview";
import ContractLibrary from "./pages/ContractLibrary";
import LegacyReview from "./pages/LegacyReview";
import AdminMetrics from "./pages/AdminMetrics";
import TeamManagement from "./pages/TeamManagement";
import OutcomeConfirmation from "./pages/OutcomeConfirmation";
import Settings from "./pages/Settings";
import type { Persona } from "./lib/types";

// ── PersonaRouter - redirect /dashboard to the right persona path ─────────────

function PersonaRouter() {
  const { data: company, isPending } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    retry: false,
  });

  if (isPending) return null;
  if (!company) return <DocumentFirstDashboard />;

  const persona: Persona = (company as { persona?: Persona }).persona ?? "CORPORATE";
  if (persona === "FOUNDER") {
    return <Navigate to="/app/founder/dashboard" replace />;
  }
  return <Navigate to="/app/legal/dashboard" replace />;
}

//── Auth guard helper ─────────────────────────────────────────────────────────

function RequireAuth({ children, company }: { children: React.ReactNode; company: unknown }) {
  // No company → document-first dashboard instead of full onboarding wizard
  return company ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

// ── App routes ────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, isLoading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const { data: company, isPending: companyLoading } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    retry: false,
    enabled: !!user,
  });

  // Public paths that must never be blocked by auth loading.
  const publicPaths = ["/", "/login", "/signin", "/sign-in", "/register",
    "/security", "/case-study", "/for-funds"];
  const isPublicPath = publicPaths.includes(pathname) ||
    pathname.startsWith("/resources");

  // Only block rendering for authenticated-only routes while auth resolves.
  if (!isPublicPath && (authLoading || (user && companyLoading))) {
    return null;
  }

  const persona: Persona = (company as { persona?: Persona } | undefined)?.persona ?? "CORPORATE";
  const isFounderPersona = persona === "FOUNDER";

  return (
    <Routes>
      {/* ── Public routes, always render, no auth guard ── */}
      <Route path="/"        element={<Landing />} />
      <Route path="/login"   element={<Login />} />
      <Route path="/signin"  element={<Login />} />
      <Route path="/sign-in" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Auth-required: onboarding (manual / full wizard) */}
      <Route
        path="/onboarding"
        element={user ? <Onboarding /> : <Navigate to="/login" replace />}
      />

      {/* Smart redirect: /dashboard → persona-specific path.
          No company yet → onboarding (user must configure before uploading). */}
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
      {/* Documents list - same as founder dashboard for now */}
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
        path="/app/legal/patterns"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><Patterns /></RequireAuth>}
      />
      <Route
        path="/app/legal/audit"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><AuditTrail /></RequireAuth>}
      />
      <Route
        path="/app/legal/library"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><ContractLibrary /></RequireAuth>}
      />
      <Route
        path="/app/legal/legacy-review"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><LegacyReview /></RequireAuth>}
      />
      <Route
        path="/app/legal/team"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><TeamManagement /></RequireAuth>}
      />
      <Route
        path="/settings"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><Settings /></RequireAuth>}
      />
      {/* Admin-only (server-gated): internal compounding metrics dashboard */}
      <Route
        path="/admin/metrics"
        element={!user ? <Navigate to="/login" replace /> : <AdminMetrics />}
      />
      {/* Litigation disabled, commercial contracts focus.
      <Route
        path="/app/legal/litigation-intake/:id"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><LitigationIntake /></RequireAuth>}
      /> */}
      <Route
        path="/app/legal/:id/outcome"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><OutcomeConfirmation /></RequireAuth>}
      />

      {/* Legacy route aliases → redirect to /app/legal/* */}
      <Route path="/playbook"     element={<Navigate to="/app/legal/playbook"     replace />} />
      <Route path="/regulations"  element={<Navigate to="/app/legal/regulations"  replace />} />
      <Route path="/portfolio"    element={<Navigate to="/app/legal/portfolio"    replace />} />
      <Route path="/timings"      element={<Navigate to="/app/legal/timings"      replace />} />
      <Route path="/bulk-review"  element={<Navigate to="/app/legal/bulk-review"  replace />} />
      {/* Litigation disabled, commercial contracts focus.
      <Route path="/litigation-intake/:id" element={<RedirectReview base="/app/legal/litigation-intake" />} /> */}

      {/* Public info pages */}
      <Route path="/security"   element={<Security />} />
      <Route path="/resources"  element={<Resources />} />
      <Route path="/resources/first-playbook"         element={<FirstPlaybook />} />
      <Route path="/resources/rag-status"             element={<RagStatus />} />
      <Route path="/resources/review-time-case-study" element={<ReviewTimeCaseStudy />} />
      <Route path="/resources/approval-matrix"        element={<ApprovalMatrix />} />
      <Route path="/resources/portfolio-dashboard"    element={<PortfolioDashboard />} />
      <Route path="/resources/sra-guidance"           element={<SraGuidance />} />
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

// ── Scroll to top on route change ─────────────────────────────────────────────
// main.tsx sets scrollRestoration = "manual", so SPA navigations otherwise inherit
// the previous page's scroll position (landing at the bottom of case studies,
// resources, security, etc.). Reset to the top on every path change. In-page hash
// navigation (e.g. the landing page anchors) is left to handle its own scroll.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppRoutes />
    </BrowserRouter>
  );
}
