import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import Portfolio from "./pages/Portfolio";
import ContractTimings from "./pages/ContractTimings";

function AppRoutes() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    retry: false,
    enabled: !!user,
  });

  if (authLoading || (user && companyLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center animate-pulse">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div className="text-sm text-muted-foreground">Loading…</div>
        </div>
      </div>
    );
  }

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

      {/* Auth-required routes */}
      <Route
        path="/onboarding"
        element={user ? <Onboarding /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/dashboard"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : company ? (
            <Dashboard />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />
      <Route
        path="/review/:id"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : company ? (
            <ReviewDetail />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />
      <Route
        path="/playbook"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : company ? (
            <Playbook />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />
      <Route
        path="/regulations"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : company ? (
            <Regulations />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />

      {/* Auth-required analytics pages */}
      <Route
        path="/portfolio"
        element={!user ? <Navigate to="/login" replace /> : company ? <Portfolio /> : <Navigate to="/onboarding" replace />}
      />
      <Route
        path="/timings"
        element={!user ? <Navigate to="/login" replace /> : company ? <ContractTimings /> : <Navigate to="/onboarding" replace />}
      />

      {/* Public info pages - accessible logged in or out */}
      <Route path="/security" element={<Security />} />
      <Route path="/resources" element={<Resources />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
