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
import CaseStudy from "./pages/CaseStudy";
import ForFunds from "./pages/ForFunds";
import Portfolio from "./pages/Portfolio";
import ContractTimings from "./pages/ContractTimings";
import LitigationIntake from "./pages/LitigationIntake";
import BulkReview from "./pages/BulkReview";

function AppRoutes() {
  const { user } = useAuth();
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    retry: false,
    enabled: !!user,
  });

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

      <Route
        path="/litigation-intake/:id"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : company ? (
            <LitigationIntake />
          ) : (
            <Navigate to="/onboarding" replace />
          )
        }
      />
      <Route
        path="/bulk-review"
        element={!user ? <Navigate to="/login" replace /> : company ? <BulkReview /> : <Navigate to="/onboarding" replace />}
      />

      {/* Public info pages - accessible logged in or out */}
      <Route path="/security" element={<Security />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/case-study" element={<CaseStudy />} />
      <Route path="/for-funds" element={<ForFunds />} />

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
