import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "./lib/api";
import Landing from "./pages/Landing";
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const DocumentFirstDashboard = lazy(() => import("./pages/DocumentFirstDashboard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ReviewDetail = lazy(() => import("./pages/ReviewDetail"));
const Playbook = lazy(() => import("./pages/Playbook"));
const Security = lazy(() => import("./pages/Security"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Resources = lazy(() => import("./pages/Resources"));
const FirstPlaybook = lazy(() => import("./pages/resources/FirstPlaybook"));
const RagStatus = lazy(() => import("./pages/resources/RagStatus"));
const ReviewTimeCaseStudy = lazy(() => import("./pages/resources/ReviewTimeCaseStudy"));
const ApprovalMatrix = lazy(() => import("./pages/resources/ApprovalMatrix"));
const PortfolioDashboard = lazy(() => import("./pages/resources/PortfolioDashboard"));
const SraGuidance = lazy(() => import("./pages/resources/SraGuidance"));
const CaseStudy = lazy(() => import("./pages/CaseStudy"));
const ForFunds = lazy(() => import("./pages/ForFunds"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const ContractTimings = lazy(() => import("./pages/ContractTimings"));
// Litigation disabled, commercial contracts focus.
// import LitigationIntake from "./pages/LitigationIntake";
const BulkReview = lazy(() => import("./pages/BulkReview"));
const Patterns = lazy(() => import("./pages/Patterns"));
const AuditTrail = lazy(() => import("./pages/AuditTrail"));
const Approvals = lazy(() => import("./pages/Approvals"));
const ApprovalDecision = lazy(() => import("./pages/ApprovalDecision"));
const FounderDashboard = lazy(() => import("./pages/founder/FounderDashboard"));
const FounderReview = lazy(() => import("./pages/founder/FounderReview"));
const ContractLibrary = lazy(() => import("./pages/ContractLibrary"));
const VendorIntelligence = lazy(() => import("./pages/VendorIntelligence"));
const LegacyReview = lazy(() => import("./pages/LegacyReview"));
const AdminMetrics = lazy(() => import("./pages/AdminMetrics"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const JoinerBriefing = lazy(() => import("./pages/JoinerBriefing"));
const OutcomeConfirmation = lazy(() => import("./pages/OutcomeConfirmation"));
const Settings = lazy(() => import("./pages/Settings"));
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

/**
 * Shown while a route chunk loads. Deliberately blank: every page below is a
 * separate chunk now, and a spinner that appears and vanishes inside 100ms
 * reads as a flicker rather than as progress. The aria-busy region tells a
 * screen reader that something is happening without drawing a box.
 */
function RouteFallback() {
  return <div aria-busy="true" aria-live="polite" className="min-h-screen" />;
}

/**
 * Pages that render the same thing signed in or out, and whose route elements
 * never read `user`. The session probe is skipped on these: it would answer
 * 401 for a visitor, which is correct behaviour but logs a console error and
 * costs a request on the page most people land on first.
 */
const MARKETING_PATHS = ["/", "/privacy", "/terms", "/security", "/case-study", "/for-funds"];

function AppRoutes() {
  const { pathname } = useLocation();
  const isMarketing =
    MARKETING_PATHS.includes(pathname) || pathname.startsWith("/resources");
  const { user, isLoading: authLoading } = useAuth({ enabled: !isMarketing });
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
    <Suspense fallback={<RouteFallback />}>
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
      {/* Regulatory Profile removed from the product surface. The Regulations
          page component is kept in the codebase for easy restoration. */}
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
        path="/app/legal/approvals"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><Approvals /></RequireAuth>}
      />
      <Route
        path="/app/legal/approvals/:id"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><ApprovalDecision /></RequireAuth>}
      />
      <Route
        path="/app/legal/library"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><ContractLibrary /></RequireAuth>}
      />
      <Route
        path="/app/legal/vendor/:name"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><VendorIntelligence /></RequireAuth>}
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
        path="/app/legal/briefing"
        element={!user ? <Navigate to="/login" replace /> : <RequireAuth company={company}><JoinerBriefing /></RequireAuth>}
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
      <Route path="/portfolio"    element={<Navigate to="/app/legal/portfolio"    replace />} />
      <Route path="/timings"      element={<Navigate to="/app/legal/timings"      replace />} />
      <Route path="/bulk-review"  element={<Navigate to="/app/legal/bulk-review"  replace />} />
      {/* Litigation disabled, commercial contracts focus.
      <Route path="/litigation-intake/:id" element={<RedirectReview base="/app/legal/litigation-intake" />} /> */}

      {/* Public info pages */}
      <Route path="/security"   element={<Security />} />
      <Route path="/privacy"    element={<Privacy />} />
      <Route path="/terms"      element={<Terms />} />
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
      {/* A real 404 rather than a silent redirect home: a redirect hides the
          broken link from the reader and tells crawlers the URL was valid. */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
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
      {/* Inside the router on purpose: the provider skips its fetch on public
          pages, which means it has to know the current path, and it must keep
          knowing it across client-side navigation. */}
      <FeatureFlagsProvider>
        <ScrollToTop />
        <AppRoutes />
      </FeatureFlagsProvider>
    </BrowserRouter>
  );
}
