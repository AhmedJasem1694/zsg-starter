import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, BookOpen, Settings, LogOut, Menu, X, Shield } from "lucide-react";
import { useAuth, useLogout } from "../../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "../../lib/api";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/playbook", icon: BookOpen, label: "Playbook" },
  { to: "/regulations", icon: Shield, label: "Regulations" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const logout = useLogout();
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany, retry: false });

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
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground">MIKE</div>
            <div className="text-[10px] text-sidebar-foreground/40 tracking-wide uppercase">Legal Decision Engine</div>
          </div>
        </div>

        {/* Company chip */}
        {company && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-sidebar-accent/60 border border-sidebar-border">
            <div className="text-xs font-medium text-sidebar-foreground/90 truncate">{company.name}</div>
            <div className="text-[10px] text-sidebar-foreground/50 truncate">{company.sector}</div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`nav-item ${active ? "nav-item-active" : ""}`}
              >
                <Icon size={16} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
          <button
            className="nav-item w-full"
            onClick={() => { setOpen(false); navigate("/onboarding"); }}
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
          <span className="font-semibold text-sm">MIKE</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
