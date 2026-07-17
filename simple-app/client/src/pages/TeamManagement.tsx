import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Mail, Plus, X, CheckCircle, Clock, AlertCircle,
  Shield, BookOpen, Upload, BarChart2, ChevronRight,
} from "lucide-react";
import { getTeamInvites, sendTeamInvites, cancelTeamInvite } from "../lib/api";
import { formatDateShort } from "../lib/dateUtils";
import AppLayout from "../components/layout/AppLayout";

// ── Role options ──────────────────────────────────────────────────────────────

const ROLES = [
  { value: "LEGAL",   label: "Legal team",     desc: "Full access - review, playbook, portfolio" },
  { value: "GC",      label: "General Counsel", desc: "Full access + governance approval" },
  { value: "CFO",     label: "CFO",             desc: "Finance-related escalations only" },
  { value: "BOARD",   label: "Board member",    desc: "Board-level escalation approvals" },
  { value: "VIEWER",  label: "Viewer",          desc: "Read-only access to reviews and portfolio" },
];

// ── Onboarding checklist ──────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  {
    icon: Shield,
    title: "Set up your company profile",
    desc: "Complete onboarding to set your sector, jurisdiction, risk appetite and workflow type.",
    href: "/onboarding",
  },
  {
    icon: BookOpen,
    title: "Calibrate your playbook",
    desc: "Define your preferred positions, acceptable fallbacks and red lines for each clause category.",
    href: "/app/legal/playbook",
  },
  {
    icon: Upload,
    title: "Upload your first contract",
    desc: "Upload a PDF or DOCX - Zane will review it against your playbook and return a structured risk report.",
    href: "/app/legal/dashboard",
  },
  {
    icon: BarChart2,
    title: "Review the portfolio dashboard",
    desc: "Once you have 3+ contracts, explore recurring risks across your estate.",
    href: "/app/legal/portfolio",
  },
];

// ── Invite status badge ───────────────────────────────────────────────────────

function InviteStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    pending:  { label: "Pending",  cls: "text-[#854F0B] bg-amber-500/10 border-amber-500/30",  icon: <Clock size={10} /> },
    accepted: { label: "Accepted", cls: "text-[#1B7A4B] bg-green-500/10 border-green-500/30",  icon: <CheckCircle size={10} /> },
    expired:  { label: "Expired",  cls: "text-muted-foreground bg-foreground/5 border-border",      icon: <AlertCircle size={10} /> },
  };
  const entry = map[status] ?? map["pending"];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${entry.cls}`}>
      {entry.icon}{entry.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TeamManagement() {
  const queryClient = useQueryClient();
  const [emailInput, setEmailInput] = useState("");
  const [pendingEmails, setPendingEmails] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState("LEGAL");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["team-invites"],
    queryFn: getTeamInvites,
  });

  const inviteMutation = useMutation({
    mutationFn: ({ emails, role }: { emails: string[]; role: string }) => sendTeamInvites(emails, role),
    onSuccess: () => {
      setPendingEmails([]);
      setEmailInput("");
      void queryClient.invalidateQueries({ queryKey: ["team-invites"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelTeamInvite,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["team-invites"] }),
  });

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (pendingEmails.includes(email)) return;
    setPendingEmails((prev) => [...prev, email]);
    setEmailInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail();
    }
  };

  const removePendingEmail = (email: string) => {
    setPendingEmails((prev) => prev.filter((e) => e !== email));
  };

  const sendInvites = () => {
    if (pendingEmails.length === 0) return;
    inviteMutation.mutate({ emails: pendingEmails, role: selectedRole });
  };

  const pendingInvites  = invites.filter((i) => i.status === "pending");
  const acceptedInvites = invites.filter((i) => i.status === "accepted");

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Users size={22} className="text-[#185FA5]" />
              <h1 className="text-2xl font-bold">Team</h1>
            </div>
            <p className="text-sm text-muted-foreground">Invite colleagues and track their access to Zane.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-foreground">{acceptedInvites.length}</div>
              <div className="text-[10px] text-muted-foreground">active members</div>
            </div>
            <div className="w-px h-8 bg-border mx-2" />
            <div className="text-center">
              <div className="text-xl font-bold text-[#854F0B]">{pendingInvites.length}</div>
              <div className="text-[10px] text-muted-foreground">pending invites</div>
            </div>
          </div>
        </div>

        {/* Invite form */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Mail size={14} className="text-[#185FA5]" />
            Invite team members
          </h2>

          {/* Email input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@company.com - press Enter or comma to add"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addEmail}
                className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-500 transition-colors"
              />
              <button className="btn-secondary gap-2 text-sm" onClick={addEmail}>
                <Plus size={14} />Add
              </button>
            </div>

            {pendingEmails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-[#185FA5] text-xs rounded-full"
                  >
                    {email}
                    <button className="hover:text-[#2563EB]" onClick={() => removePendingEmail(email)}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Role selector */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-foreground/70">Role</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    selectedRole === role.value
                      ? "border-blue-500 bg-blue-500/10 text-[#185FA5]"
                      : "border-border hover:border-blue-500/40 text-foreground/70"
                  }`}
                  onClick={() => setSelectedRole(role.value)}
                >
                  <div className="text-xs font-semibold">{role.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{role.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-primary gap-2"
            onClick={sendInvites}
            disabled={pendingEmails.length === 0 || inviteMutation.isPending}
          >
            <Mail size={14} />
            {inviteMutation.isPending
              ? "Sending…"
              : `Send invite${pendingEmails.length !== 1 ? "s" : ""} (${pendingEmails.length})`}
          </button>
          {inviteMutation.isSuccess && (
            <p className="text-xs text-[#1B7A4B] flex items-center gap-1">
              <CheckCircle size={11} />Invites sent successfully.
            </p>
          )}
        </div>

        {/* Invite list */}
        {!isLoading && invites.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold">Sent invites</h2>
            </div>
            <div className="divide-y divide-border/50">
              {invites.map((invite) => (
                <div key={invite.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-[#185FA5] text-xs font-bold shrink-0">
                    {invite.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{invite.email}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {ROLES.find((r) => r.value === invite.role)?.label ?? invite.role} ·
                      {" "}Invited {formatDateShort(invite.created)}
                    </div>
                  </div>
                  <InviteStatusBadge status={invite.status} />
                  {invite.status === "pending" && (
                    <button
                      className="text-muted-foreground hover:text-[#A32D2D] transition-colors ml-1"
                      title="Cancel invite"
                      onClick={() => cancelMutation.mutate(invite.id)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-sm text-muted-foreground text-center py-6">Loading invites…</div>
        )}

        {/* New hire onboarding guide */}
        <div className="card">
          <button
            className="card-header w-full text-left flex items-center justify-between"
            onClick={() => setShowOnboarding(!showOnboarding)}
          >
            <div>
              <h2 className="text-sm font-semibold">New hire onboarding guide</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Share this checklist with new team members to get them up to speed.</p>
            </div>
            <ChevronRight size={16} className={`text-muted-foreground transition-transform ${showOnboarding ? "rotate-90" : ""}`} />
          </button>

          {showOnboarding && (
            <div className="card-body space-y-3">
              {ONBOARDING_STEPS.map((step, i) => (
                <a
                  key={i}
                  href={step.href}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors group"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <step.icon size={13} className="text-[#185FA5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium group-hover:text-[#185FA5] transition-colors">
                      {i + 1}. {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-[#185FA5] transition-colors shrink-0 mt-1" />
                </a>
              ))}

              <div className="mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                <p>💡 <strong className="text-foreground/60">Tip:</strong> Share your playbook with new legal hires so they understand your negotiation positions before their first review.</p>
                <p>🔐 <strong className="text-foreground/60">Access:</strong> New members receive an email with a one-click login link (or a password to set).</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
