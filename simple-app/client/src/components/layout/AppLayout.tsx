import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { ZaneLogo } from "../ZaneLogo";
import {
  LayoutDashboard, BookOpen, Settings, LogOut, Menu, Shield,
  PieChart, CalendarClock, LayoutGrid, Activity, ClipboardList, Library, Users,
  AlertTriangle, Archive, Brain, ChevronDown, FolderOpen, Sparkles, Building2,
} from "lucide-react";
import { useAuth, useLogout } from "../../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "../../lib/api";
import type { Persona } from "../../lib/types";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";

// ── Nav model ─────────────────────────────────────────────────────────────────

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string };
type NavGroup = { label: string; icon: typeof LayoutDashboard; items: NavItem[] };

// Legal nav, grouped into a few calm top-level sections with expandable
// sub-menus so nothing needs to scroll. Every destination is preserved.
const LEGAL_GROUPS: NavGroup[] = [
  {
    label: "Contracts", icon: FolderOpen, items: [
      { to: "/app/legal/dashboard",     icon: LayoutDashboard, label: "Dashboard" },
      { to: "/app/legal/library",       icon: Library,         label: "Library" },
      { to: "/app/legal/bulk-review",   icon: LayoutGrid,      label: "Bulk Review" },
      { to: "/app/legal/legacy-review", icon: Archive,         label: "Legacy Review" },
    ],
  },
  {
    label: "Intelligence", icon: Sparkles, items: [
      { to: "/app/legal/playbook",  icon: BookOpen,      label: "Playbook" },
      { to: "/app/legal/portfolio", icon: PieChart,      label: "Portfolio Risk" },
      { to: "/app/legal/patterns",  icon: Activity,      label: "Negotiation Intelligence" },
      { to: "/app/legal/timings",   icon: CalendarClock, label: "Timings and Obligations" },
    ],
  },
  {
    label: "Workspace", icon: Building2, items: [
      { to: "/app/legal/team",        icon: Users,         label: "Team" },
      { to: "/app/legal/briefing",    icon: Brain,         label: "Joiner Briefing" },
      { to: "/app/legal/audit",       icon: ClipboardList, label: "Audit Trail" },
      { to: "/app/legal/regulations", icon: Shield,        label: "Regulatory Profile" },
    ],
  },
];

// Founder nav is already short, so it stays a flat, calm list.
const FOUNDER_ITEMS: NavItem[] = [
  { to: "/app/founder/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/legal/playbook",    icon: BookOpen,        label: "Playbook" },
  { to: "/app/legal/portfolio",   icon: PieChart,        label: "Portfolio Risk" },
  { to: "/app/legal/timings",     icon: CalendarClock,   label: "Renewals" },
  { to: "/app/legal/bulk-review", icon: LayoutGrid,      label: "Bulk Review" },
];

const isPathActive = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(to + "/");
const groupHasActive = (pathname: string, g: NavGroup) =>
  g.items.some((it) => isPathActive(pathname, it.to));

// ── Trial countdown banner ────────────────────────────────────────────────────

function TrialBanner() {
  const { tier, trialDaysRemaining } = useFeatureFlags();
  if (tier !== "trial" || trialDaysRemaining === null) return null;
  if (trialDaysRemaining > 14) return null; // shouldn't happen but guard

  const urgent = trialDaysRemaining <= 3;
  return (
    <div className={`flex items-center justify-between gap-4 px-6 py-2.5 text-xs ${
      urgent ? "bg-[#1F0A0A] border-b border-[#450A0A]" : "bg-[#1C0F00] border-b border-[#431407]"
    }`}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={12} className={urgent ? "text-white" : "text-white"} />
        <span className="text-white">
          {trialDaysRemaining === 0
            ? "Your trial has ended. Upgrade to keep full access."
            : `Trial: ${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} remaining. Upgrade to keep full access.`}
        </span>
      </div>
      <a
        href="/#pricing"
        className="shrink-0 px-3 py-1 rounded-md bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
      >
        Upgrade
      </a>
    </div>
  );
}

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

  // Which sub-menus are expanded. Default: only the group containing the current
  // route is open (falls back to the first group on a fresh load).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of LEGAL_GROUPS) init[g.label] = groupHasActive(location.pathname, g);
    if (!Object.values(init).some(Boolean) && LEGAL_GROUPS[0]) init[LEGAL_GROUPS[0].label] = true;
    return init;
  });

  // Keep the active item visible: whenever the route changes, ensure its group is open.
  useEffect(() => {
    const g = LEGAL_GROUPS.find((gr) => groupHasActive(location.pathname, gr));
    if (g) setOpenGroups((prev) => (prev[g.label] ? prev : { ...prev, [g.label]: true }));
  }, [location.pathname]);

  const renderLeaf = ({ to, icon: Icon, label }: NavItem) => {
    const active = isPathActive(location.pathname, to);
    return (
      <Link
        key={to}
        to={to}
        onClick={() => setOpen(false)}
        className={`nav-item ${active ? "nav-item-active" : ""}`}
      >
        <Icon size={16} className="shrink-0" style={{ color: active ? "#3B82F6" : "#64748B" }} />
        {label}
      </Link>
    );
  };

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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {isFounder
            ? FOUNDER_ITEMS.map(renderLeaf)
            : LEGAL_GROUPS.map((group) => {
                const isOpen = !!openGroups[group.label];
                const hasActive = groupHasActive(location.pathname, group);
                const GIcon = group.icon;
                return (
                  <div key={group.label} className="space-y-0.5">
                    <button
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [group.label]: !prev[group.label] }))}
                      className="nav-item w-full justify-between"
                      aria-expanded={isOpen}
                    >
                      <span className="flex items-center gap-3">
                        <GIcon size={16} className="shrink-0" style={{ color: hasActive ? "#3B82F6" : "#64748B" }} />
                        {group.label}
                      </span>
                      <ChevronDown
                        size={14}
                        className="shrink-0 transition-transform"
                        style={{ color: "#64748B", transform: isOpen ? "none" : "rotate(-90deg)" }}
                      />
                    </button>
                    {isOpen && (
                      <div className="ml-4 pl-2 border-l border-sidebar-border space-y-0.5">
                        {group.items.map(renderLeaf)}
                      </div>
                    )}
                  </div>
                );
              })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
          <button
            className={`nav-item w-full ${isPathActive(location.pathname, "/settings") ? "nav-item-active" : ""}`}
            onClick={() => { setOpen(false); navigate("/settings"); }}
          >
            <Settings size={16} className="shrink-0" style={{ color: isPathActive(location.pathname, "/settings") ? "#3B82F6" : "#64748B" }} />
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
          <TrialBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
