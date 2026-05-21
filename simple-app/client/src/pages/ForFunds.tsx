import { Navigate } from "react-router-dom";

// This page is no longer active - redirect to the case study
export default function ForFunds() {
  return <Navigate to="/case-study" replace />;
}
