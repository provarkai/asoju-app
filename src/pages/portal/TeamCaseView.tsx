import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EvidenceGrid,
  MessageThread,
  QuoteCard,
  ReportCard,
  Timeline,
} from "@/components/portal/CaseDetailParts";
import { StatusPill } from "@/components/portal/ui";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  Clock,
  Loader2,
  Lock,
  MapPin,
  Play,
  Receipt,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, naira } from "@/lib/asoju";

export function TeamCaseView({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const caseIdTyped = caseId as Id<"cases">;
  const kase = useQuery(api.cases.teamGetCase, { caseId: caseIdTyped });
  const advance = useMutation(api.cases.teamAdvanceCase);
  const sendMessage = useMutation(api.cases.teamSendMessage);
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  if (user && user.role !== "admin") {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-forest/20 bg-white/60 px-6 py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-forest/8 text-forest">
          <Lock className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold text-forest">
          Admin access required
        </h1>
        <p className="mt-2 max-w-sm text-sm text-forest/60">
          Customer cases are case-scoped. Sign in with an ASOJU admin account to
          review this case from the team side.
        </p>
        <Button
          variant="outline"
          className="mt-6 border-forest/20 text-forest hover:bg-forest hover:text-ivory"
          onClick={() => navigate("/dashboard")}
        >
          Back to my cases
        </Button>
      </div>
    );
  }

  if (!kase) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-3xl bg-forest/5" />
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="h-96 animate-pulse rounded-2xl bg-forest/5 lg:col-span-3" />
          <div className="h-96 animate-pulse rounded-2xl bg-forest/5 lg:col-span-2" />
        </div>
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(successMsg);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const status = kase.status as string;
  const quote = kase.quote;
  const report = kase.report;
  const overdue =
    kase.slaTargetAt && kase.slaTargetAt < now &&
    !["COMPLETED", "CLOSED", "APPROVED", "ON_HOLD"].includes(status);

  const advanceable = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "SCHEDULED",
    "ASSIGNED",
    "IN_PROGRESS",
    "EVIDENCE_SUBMITTED",
    "QUALITY_CONTROL",
    "APPROVED",
    "COMPLETED",
  ].includes(status);

  const advanceLabel: Record<string, string> = {
    SUBMITTED: "Advance → under review",
    UNDER_REVIEW: "Advance → issue quote",
    SCHEDULED: "Advance → assign agent",
    ASSIGNED: "Advance → agent check-in",
    IN_PROGRESS: "Advance → capture evidence",
    EVIDENCE_SUBMITTED: "Advance → QC review",
    QUALITY_CONTROL: "Advance → deliver report",
    APPROVED: "Advance → complete",
    COMPLETED: "Advance → close",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-forest p-6 text-ivory shadow-xl shadow-forest/20 sm:p-8">
        <div className="absolute inset-0 pattern-grid-dark" />
        <div className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative">
          <button
            onClick={() => navigate("/dashboard/team")}
            className="flex items-center gap-1.5 text-xs font-medium text-ivory/60 transition-colors hover:text-ivory"
          >
            <ArrowLeft className="size-3.5" />
            Team board
          </button>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-sm font-semibold tracking-wide text-gold-light">
                  {kase.caseNumber}
                </span>
                <Badge className="border-ivory/15 bg-ivory/10 text-ivory/80">
                  {kase.serviceLabel}
                </Badge>
                <StatusPill status={status} />
                {overdue && (
                  <Badge className="border-red-300/40 bg-red-500/20 text-red-200">
                    <AlertTriangle className="size-3" />
                    Overdue
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 font-display text-2xl font-semibold leading-snug sm:text-3xl">
                {kase.description}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ivory/70">
                <span className="flex items-center gap-1.5">
                  <UserRound className="size-4 text-gold-light" />
                  {kase.customer.fullName}
                  {kase.customer.email && (
                    <span className="text-ivory/50">· {kase.customer.email}</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-gold-light" />
                  {kase.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4 text-gold-light" />
                  Created {formatDate(kase.createdAt)}
                </span>
                {kase.assignedAgentName && (
                  <span className="flex items-center gap-1.5">
                    <UserRound className="size-4 text-gold-light" />
                    {kase.assignedAgentName}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-ivory/10 bg-ivory/5 px-5 py-4 text-right">
              <p className="text-[11px] uppercase tracking-wider text-ivory/50">Next action</p>
              <p className="mt-1 max-w-[220px] text-sm font-medium text-ivory/90">
                {kase.nextAction ?? "Awaiting next step"}
              </p>
              {kase.nextActionDueAt && (
                <p className="mt-1 text-[11px] text-ivory/50">
                  due {formatDateTime(kase.nextActionDueAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Team action bar */}
      {advanceable && (
        <section className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-forest">Team demo engine</p>
              <p className="text-xs text-forest/60">
                In production, trained staff drive these steps. Use the demo
                engine to walk this customer's case through the golden path.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-forest/25 text-forest hover:bg-forest hover:text-ivory"
              disabled={busy !== null}
              onClick={() =>
                run("advance", () => advance({ caseId: caseIdTyped }), "Advanced to the next stage")
              }
            >
              {busy === "advance" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {advanceLabel[status] ?? "Advance case"}
            </Button>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-3">
          <section className="rounded-2xl border border-forest/10 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-forest">Overview</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Priority", kase.priority],
                ["Tier", kase.tier === "CONCIERGE" ? "Concierge" : "Essential"],
                ["Risk level", `${kase.riskLevel}/4`],
                ["Payment", kase.paymentStatus],
              ].map(([l, val]) => (
                <div key={l} className="rounded-xl border border-forest/8 bg-ivory/50 p-3.5">
                  <p className="text-[11px] uppercase tracking-wide text-forest/45">{l}</p>
                  <p className="mt-0.5 text-sm font-semibold text-forest">{val}</p>
                </div>
              ))}
            </div>
            {kase.scheduledFor && (
              <p className="mt-4 flex items-center gap-2 text-sm text-forest/70">
                <CalendarCheck className="size-4 text-forest" />
                Scheduled visit: {formatDateTime(kase.scheduledFor)}
              </p>
            )}
            {kase.customer.country && (
              <p className="mt-2 flex items-center gap-2 text-sm text-forest/70">
                <UserRound className="size-4 text-forest" />
                Customer based in {kase.customer.country}
                {kase.customer.phone ? ` · ${kase.customer.phone}` : ""}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-forest/10 bg-white p-5 shadow-sm">
            <h2 className="mb-5 font-display text-lg font-semibold text-forest">Case timeline</h2>
            <Timeline history={kase.history} />
          </section>

          <MessageThread
            messages={kase.messages}
            busy={busy === "send"}
            asTeam
            onSend={(body) => {
              setBusy("send");
              sendMessage({ caseId: caseIdTyped, body })
                .then(() => toast.success("Reply sent to the customer"))
                .catch((e) => toast.error(e.message))
                .finally(() => setBusy(null));
            }}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-2">
          {quote && <QuoteCard quote={quote} accepted={Boolean(quote.acceptedAt)} />}

          {(kase.invoice || kase.payments.length > 0) && (
            <section className="rounded-2xl border border-forest/10 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
                <Receipt className="size-4.5 text-clay" />
                Invoice &amp; payment
              </h2>
              {kase.invoice && (
                <div className="mt-4 flex items-center justify-between rounded-xl border border-forest/8 bg-ivory/50 p-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-forest/45">
                      Invoice · {formatDate(kase.invoice.createdAt)}
                    </p>
                    <p className="font-display text-xl font-bold text-forest">
                      {naira(kase.invoice.amount)}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "border",
                      kase.payments.some((p) => p.status === "PAID")
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                        : "border-amber-200 bg-amber-100 text-amber-800",
                    )}
                  >
                    {kase.payments.some((p) => p.status === "PAID") ? "Paid" : "Pending"}
                  </Badge>
                </div>
              )}
              {kase.payments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {kase.payments.map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between rounded-xl border border-forest/8 p-3.5 text-sm"
                    >
                      <span className="text-forest/70">
                        {p.provider} · {p.providerReference}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          p.status === "PAID" ? "text-emerald-600" : "text-amber-600",
                        )}
                      >
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {kase.evidence.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-semibold text-forest">
                Evidence ({kase.evidence.length})
              </h2>
              <EvidenceGrid evidence={kase.evidence} />
            </section>
          )}

          {report && <ReportCard report={report} />}

          <div className="rounded-2xl border border-forest/10 bg-white/60 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-forest">
              <ShieldCheck className="size-4 text-forest" />
              Audit trail
            </p>
            <p className="mt-2 text-xs leading-relaxed text-forest/60">
              Every transition on this case is recorded in an append-only trail —
              who moved it, from where, to where, and when. Evidence is
              server-timestamped and QC-reviewed before the customer sees it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
