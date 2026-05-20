import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { ZaneLogo } from "../ZaneLogo";
import {
  LayoutDashboard, BookOpen, Settings, LogOut, Menu, Shield,
  Lock, PieChart, CalendarClock, LayoutGrid, Activity, ClipboardList, Library, Users,
} from "lucide-react";
import { useAuth, useLogout } from "../../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "../../lib/api";
import type { Persona } from "../../lib/types";

// ── Legal nav ─────────────────────────────────────────────────────────────────

const LEGAL_NAV = [
  { to: "/app/legal/dashboard",   icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/legal/library",     icon: Library,          label: "Library" },
  { to: "/app/legal/playbook",    icon: BookOpen,         label: "Playbook" },
  { to: "/app/legal/portfolio",   icon: PieChart,         label: "Portfolio Risk" },
  { to: "/app/legal/regulations", icon: Shield,           label: "Regulatory Profile" },
  { to: "/app/legal/bulk-review", icon: LayoutGrid,       label: "Bulk Review" },
];

// Items that require populated data — shown dimmer in secondary section
const LEGAL_NAV_DATA_DEPENDENT = [
  { to: "/app/legal/timings",  icon: CalendarClock, label: "Renewals" },
  { to: "/app/legal/patterns", icon: Activity,      label: "Patterns" },
];

const LEGAL_NAV_SECONDARY = [
  { to: "/app/legal/team",   icon: Users,         label: "Team" },
  { to: "/app/legal/audit",  icon: ClipboardList, label: "Audit Trail" },
  { to: "/security",         icon: Lock,          label: "Security" },
];

// ── Founder nav ───────────────────────────────────────────────────────────────

const FOUNDER_NAV = [
  { to: "/app/founder/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/legal/playbook",     icon: BookOpen,        label: "Playbook" },
  { to: "/app/legal/portfolio",    icon: PieChart,        label: "Portfolio Risk" },
  { to: "/app/legal/timings",      icon: CalendarClock,   label: "Renewals" },
  { to: "/app/legal/bulk-review",  icon: LayoutGrid,      label: "Bulk Review" },
];

const FOUNDER_NAV_SECONDARY = [
  { to: "/security", icon: Lock, label: "Security" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const logout = useLogout();
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany, retry: false });

  const persona: Persona = (company as { persona?: Persona } | undefined)?.persona ?? "CORPORATE";
  const isFounder = persona === "FOUNDER";

  const nav           = isFounder ? FOUNDER_NAV         : LEGAL_NAV;
  const navSecondary  = isFounder ? FOUNDER_NAV_SECONDARY : LEGAL_NAV_SECONDARY;
  const settingsTarget = isFounder ? "/onboarding" : "/onboarding";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-60 flex flex-col
          bg-sidebar text-sidebar-foreground border-r border-sidebar-border
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center px-5 py-4 border-b border-sidebar-border hover:opacity-80 transition-opacity">
          <ZaneLogo size="sm" light={true} />
        </Link>

        {/* Company chip */}
        {company && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-sidebar-accent/60 border border-sidebar-border">
            <div className="text-xs font-medium text-sidebar-foreground/90 truncate">{company.name}</div>
            <div className="text-[10px] text-sidebar-foreground/50 truncate">
              {isFounder ? (persona === "FOUNDER" ? "Founder" : "Investor") : company.sector}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`nav-item ${active ? "nav-item-active" : ""}`}
              >
                <Icon size={16} className="shrink-0" style={{ color: active ? "#60A5FA" : "#64748B" }} />
                {label}
              </Link>
            );
          })}

          {/* Data-dependent items — slightly dimmer, with hint */}
          {!isFounder && (
            <div className="pt-3 pb-1 space-y-0.5">
              <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-sidebar-foreground/20 font-medium">Analytics</div>
              {LEGAL_NAV_DATA_DEPENDENT.map(({ to, icon: Icon, label }) => {
                const active = location.pathname === to || location.pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={`nav-item ${active ? "nav-item-active" : "opacity-60 hover:opacity-100"}`}
                  >
                    <Icon size={16} className="shrink-0" style={{ color: active ? "#60A5FA" : "#64748B" }} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Secondary nav */}
        <div className="px-3 pb-2 space-y-0.5 border-t border-sidebar-border pt-3">
          <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-sidebar-foreground/20 font-medium">System</div>
          {navSecondary.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`nav-item opacity-60 hover:opacity-100 ${active ? "nav-item-active !opacity-100" : ""}`}
              >
                <Icon size={16} className="shrink-0" style={{ color: active ? "#60A5FA" : "#64748B" }} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
          <button
            className="nav-item w-full"
            onClick={() => { setOpen(false); navigate("/settings"); }}
          >
            <Settings size={16} className="shrink-0" />
            Settings
          </button>
          <button
            className="nav-item w-full text-red-400 hover:text-red-300"
            onClick={() => logout.mutate()}
          >
            <LogOut size={16} className="shrink-0" />
            Sign out
          </button>
          {user && (
            <div className="px-3 pt-3 text-[11px] text-sidebar-foreground/40 truncate">
              {user.email}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm">Zane</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
