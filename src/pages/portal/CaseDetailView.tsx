import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  FileCheck2,
  Loader2,
  MapPin,
  Pause,
  Play,
  Receipt,
  RotateCcw,
  Scale,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CONSTRUCTION_MILESTONES,
  formatDate,
  formatDateTime,
  naira,
  PLAN_LABEL,
  REGION_LABEL,
} from "@/lib/asoju";

const DISPUTE_REASONS = [
  "Evidence missing or unclear",
  "Facts in the report are incorrect",
  "Photos don't match what I know",
  "Unresolved issues were not flagged",
  "Something else",
];

export function CaseDetailView({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const caseIdTyped = caseId as Id<"cases">;
  const kase = useQuery(api.cases.getCase, { caseId: caseIdTyped });
  const sub = useQuery(api.commercial.getSubscription);
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const acceptQuote = useMutation(api.cases.acceptQuote);
  const payInvoice = useMutation(api.cases.payInvoice);
  const demoAdvance = useMutation(api.cases.demoAdvance);
  const approveReport = useMutation(api.cases.approveReport);
  const requestAdditionalWork = useMutation(api.cases.requestAdditionalWork);
  const raiseDispute = useMutation(api.cases.raiseDispute);
  const holdCase = useMutation(api.cases.holdCase);
  const resumeCase = useMutation(api.cases.resumeCase);
  const sendMessage = useMutation(api.cases.sendMessage);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReasons, setDisputeReasons] = useState<string[]>([]);
  const [disputeNotes, setDisputeNotes] = useState("");

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

  const teamActionAvailable = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "SCHEDULED",
    "ASSIGNED",
    "IN_PROGRESS",
    "EVIDENCE_SUBMITTED",
    "QUALITY_CONTROL",
    "APPROVED",
    "COMPLETED",
    "DISPUTED",
  ].includes(status);

  const canHold = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "QUOTED",
    "AWAITING_PAYMENT",
    "SCHEDULED",
    "ASSIGNED",
    "IN_PROGRESS",
    "EVIDENCE_SUBMITTED",
    "QUALITY_CONTROL",
    "ADDITIONAL_WORK",
  ].includes(status);

  const teamActionLabel: Record<string, string> = {
    SUBMITTED: "Simulate triage → under review",
    UNDER_REVIEW: "Simulate quote preparation",
    SCHEDULED: "Simulate agent assignment",
    ASSIGNED: "Simulate agent check-in",
    IN_PROGRESS: "Simulate evidence capture",
    EVIDENCE_SUBMITTED: "Simulate QC review",
    QUALITY_CONTROL: "Simulate report delivery",
    APPROVED: "Simulate completion",
    COMPLETED: "Simulate closure",
    DISPUTED: "Simulate dispute resolution → rework",
  };

  const checkoutDone = (kase.payments ?? []).some((p) => p.status === "PAID");

  // PRD §3.3 — milestone completion for construction supervision.
  const taskDone = (item: string) =>
    kase.evidence.some(
      (e) =>
        item.toLowerCase().startsWith(e.title.toLowerCase().split(" ")[0]) ||
        e.title.toLowerCase().includes(item.toLowerCase().split(" ")[0]),
    );
  const milestones =
    kase.serviceType === "CONSTRUCTION_SUPERVISION"
      ? CONSTRUCTION_MILESTONES.map((m) => {
          const total = m.items.length;
          const done = m.items.filter(taskDone).length;
          return { ...m, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
        })
      : [];
  const milestoneDone = milestones.reduce((s, m) => s + m.done, 0);
  const milestoneTotal = milestones.reduce((s, m) => s + m.total, 0);
  const overallPct = milestoneTotal ? Math.round((milestoneDone / milestoneTotal) * 100) : 0;

  const submitDispute = async () => {
    if (disputeReasons.length === 0) {
      toast.error("Select at least one disputed item");
      return;
    }
    setBusy("dispute");
    try {
      await raiseDispute({
        caseId: caseIdTyped,
        reasons: disputeReasons,
        notes: disputeNotes.trim() || undefined,
      });
      toast.success("Dispute filed — report locked, rework scheduled");
      setDisputeOpen(false);
      setDisputeReasons([]);
      setDisputeNotes("");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------ Header */}
      <div className="relative overflow-hidden rounded-3xl bg-forest p-6 text-ivory shadow-xl shadow-forest/20 sm:p-8">
        <div className="absolute inset-0 pattern-grid-dark" />
        <div className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-xs font-medium text-ivory/60 transition-colors hover:text-ivory"
          >
            <ArrowLeft className="size-3.5" />
            All cases
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
              <p className="text-[11px] uppercase tracking-wider text-ivory/50">
                Next action
              </p>
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

      {/* ------------------------------ Action bar */}
      <section className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
        {status === "QUOTED" && quote && !quote.acceptedAt && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-forest">Your quote is ready</p>
              <p className="text-xs text-forest/60">
                Review the line items below and accept to create your invoice.
              </p>
            </div>
            <Button
              className="bg-forest text-ivory hover:bg-forest-deep"
              disabled={busy !== null}
              onClick={() =>
                run("accept", () => acceptQuote({ caseId: caseIdTyped }), "Quote accepted — invoice created")
              }
            >
              {busy === "accept" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Accept quote
            </Button>
          </div>
        )}

        {status === "AWAITING_PAYMENT" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-forest">Awaiting payment</p>
              <p className="text-xs text-forest/60">
                Complete checkout to schedule your representative. Demo checkout
                simulates the Paystack provider webhook.
              </p>
            </div>
            <Button
              className="bg-gold font-semibold text-forest-deep hover:bg-gold-light"
              disabled={busy !== null}
              onClick={() =>
                run("pay", () => payInvoice({ caseId: caseIdTyped }), "Payment confirmed — scheduling your representative")
              }
            >
              {busy === "pay" ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
              Pay {quote ? naira(quote.amount) : ""}
            </Button>
          </div>
        )}

        {status === "CUSTOMER_REVIEW" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-forest">
              Your report is ready — review the evidence &amp; findings below
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button
                className="bg-forest text-ivory hover:bg-forest-deep"
                disabled={busy !== null}
                onClick={() =>
                  run("approve", () => approveReport({ caseId: caseIdTyped }), "Report approved — case completing")
                }
              >
                {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                Approve report
              </Button>
              <Button
                variant="outline"
                className="border-forest/20 text-forest hover:bg-forest/5"
                disabled={busy !== null}
                onClick={() => {
                  const reason = window.prompt("What additional work do you need?");
                  if (!reason) return;
                  run("rework", () => requestAdditionalWork({ caseId: caseIdTyped, reason }), "Requested — we're on it");
                }}
              >
                <RotateCcw className="size-4" />
                Request changes
              </Button>
              <Button
                variant="outline"
                className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                disabled={busy !== null}
                onClick={() => setDisputeOpen(true)}
              >
                <Scale className="size-4" />
                Dispute report
              </Button>
            </div>
          </div>
        )}

        {status === "DISPUTED" && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Scale className="size-4" />
              Report disputed — rework scheduled
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              The report is locked. Our team is addressing the disputed items and
              will return with updated evidence for your review.
            </p>
          </div>
        )}

        {teamActionAvailable && !["QUOTED", "AWAITING_PAYMENT"].includes(status) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-forest">Demo: ASOJU team engine</p>
              <p className="text-xs text-forest/60">
                In production, trained staff &amp; vetted representatives drive
                these steps. Use the demo engine to walk this case through the
                golden path.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-forest/25 text-forest hover:bg-forest hover:text-ivory"
              disabled={busy !== null}
              onClick={() =>
                run("advance", () => demoAdvance({ caseId: caseIdTyped }), "Advanced to the next stage")
              }
            >
              {busy === "advance" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {teamActionLabel[status] ?? "Advance case"}
            </Button>
          </div>
        )}

        {status === "ON_HOLD" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-forest">Case is on hold</p>
              <p className="text-xs text-forest/60">
                Paused at your request. We'll pick up exactly where we left off
                when you resume.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-forest/25 text-forest hover:bg-forest hover:text-ivory"
              disabled={busy !== null}
              onClick={() =>
                run("resume", () => resumeCase({ caseId: caseIdTyped }), "Hold lifted — case resumed")
              }
            >
              {busy === "resume" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Resume case
            </Button>
          </div>
        )}

        {canHold && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/25 pt-3.5">
            <div>
              <p className="text-xs text-forest/60">
                Need to pause this case? You can put it on hold and resume
                anytime — nothing is lost.
              </p>
            </div>
            <Button
              variant="ghost"
              className="text-forest/70 hover:bg-gold/10 hover:text-forest"
              disabled={busy !== null}
              onClick={() => {
                const reason = window.prompt("Why are you putting this case on hold?");
                if (reason === null) return;
                run("hold", () => holdCase({ caseId: caseIdTyped, reason: reason.trim() || "Customer requested hold" }), "Case put on hold");
              }}
            >
              {busy === "hold" ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
              Put on hold
            </Button>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ------------------------------ Left column */}
        <div className="space-y-6 lg:col-span-3">
          {/* Key facts */}
          <section className="rounded-2xl border border-forest/10 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-forest">Overview</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Priority", kase.priority],
                ["Plan", PLAN_LABEL[kase.tier] ?? kase.tier],
                ["Region", REGION_LABEL[kase.regionZone ?? "OTHER"] ?? kase.regionZone],
                ["Payment", checkoutDone ? "Paid" : kase.paymentStatus],
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
          </section>

          {/* Checklist / PRD §3.3 milestone tracker */}
          <section className="rounded-2xl border border-forest/10 bg-white p-5 shadow-sm">
            <h2 className="flex items-center justify-between font-display text-lg font-semibold text-forest">
              {kase.serviceType === "CONSTRUCTION_SUPERVISION"
                ? "Construction progress"
                : "Field checklist"}
              {milestones.length > 0 && (
                <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-clay">
                  {overallPct}% complete
                </span>
              )}
            </h2>
            {milestones.length > 0 ? (
              <div className="mt-4 space-y-4">
                {milestones.map((m) => (
                  <div key={m.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-forest">{m.label}</span>
                      <span className="text-xs font-semibold text-forest/55">
                        {m.done}/{m.total} · {m.pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-forest/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-forest to-gold transition-all duration-500"
                        style={{ width: `${m.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[11px] leading-relaxed text-forest/50">
                  Percentages are computed from the confirmed case scope and
                  completed field tasks — updated in real time as evidence lands.
                </p>
              </div>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {kase.checklist.map((item: string, i: number) => {
                  const done = taskDone(item);
                  return (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-forest/70">
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border",
                          done
                            ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                            : "border-forest/20 text-transparent",
                        )}
                      >
                        <CheckCircle2 className="size-3.5" />
                      </span>
                      {item}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Timeline */}
          <section className="rounded-2xl border border-forest/10 bg-white p-5 shadow-sm">
            <h2 className="mb-5 font-display text-lg font-semibold text-forest">
              Case timeline
            </h2>
            <Timeline history={kase.history} />
          </section>

          {/* Messages */}
          <MessageThread
            messages={kase.messages}
            busy={busy === "send"}
            onSend={(body) => {
              setBusy("send");
              sendMessage({ caseId: caseIdTyped, body })
                .then(() => toast.success("Message sent"))
                .catch((e) => toast.error(e.message))
                .finally(() => setBusy(null));
            }}
          />
        </div>

        {/* ------------------------------ Right column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Quote */}
          {quote && (
            <QuoteCard
              quote={quote}
              accepted={Boolean(quote.acceptedAt)}
              busy={busy === "accept"}
              regionZone={kase.regionZone}
              subActive={Boolean(sub?.subscription)}
              scEligible={(kase.regionZone ?? "OTHER") !== "OTHER"}
              scUsd={sub?.subscription?.scUsd ?? 0}
              onAccept={(useSC) =>
                run(
                  "accept",
                  () => acceptQuote({ caseId: caseIdTyped, useSC }),
                  useSC ? "Quote accepted — Special Credit applied" : "Quote accepted — invoice created",
                )
              }
            />
          )}

          {/* Invoice & payment */}
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
                      checkoutDone
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                        : "border-amber-200 bg-amber-100 text-amber-800",
                    )}
                  >
                    {checkoutDone ? "Paid" : "Pending"}
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
                      <span className="flex items-center gap-2 text-forest/70">
                        <CircleDollarSign className="size-4 text-forest" />
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
                  <p className="text-[11px] text-forest/45">
                    Payment status is driven only by the provider's verified
                    webhook — never by screenshots.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Evidence */}
          {kase.evidence.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-forest">
                <ClipboardCheck className="size-4.5 text-clay" />
                Evidence ({kase.evidence.length})
              </h2>
              <EvidenceGrid evidence={kase.evidence} />
            </section>
          )}

          {/* Report */}
          {report && <ReportCard report={report} />}

          {/* Trust footer */}
          <div className="rounded-2xl border border-forest/10 bg-white/60 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-forest">
              <ShieldCheck className="size-4 text-forest" />
              Why you can trust this case
            </p>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-forest/60">
              <li>· Every transition is recorded in an append-only audit trail.</li>
              <li>· Evidence is server-timestamped and QC-reviewed before you see it.</li>
              <li>· No report ships with unresolved issues hidden.</li>
              <li>
                · Professional opinions come only from licensed professionals
                coordinated through ASOJU.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* PRD §3.1 — formal dispute form */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="size-5 text-clay" />
              Dispute this report
            </DialogTitle>
            <DialogDescription>
              The report will be locked and a rework scheduled on the disputed
              items. Select everything that's wrong:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {DISPUTE_REASONS.map((r) => {
              const on = disputeReasons.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    setDisputeReasons((cur) => (on ? cur.filter((x) => x !== r) : [...cur, r]))
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                    on
                      ? "border-clay bg-clay/10 text-clay"
                      : "border-forest/10 bg-white text-forest hover:border-forest/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      on ? "border-clay bg-clay text-white" : "border-forest/25",
                    )}
                  >
                    {on && <CheckCircle2 className="size-3.5" />}
                  </span>
                  {r}
                </button>
              );
            })}
            <textarea
              value={disputeNotes}
              onChange={(e) => setDisputeNotes(e.target.value)}
              rows={3}
              placeholder="Add details — what did you expect, and what did you find?"
              className="w-full resize-none rounded-xl border border-forest/15 bg-ivory/50 px-4 py-3 text-sm outline-none transition-colors focus:border-forest/40 focus:bg-white"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisputeOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-clay text-ivory hover:bg-clay/90"
              disabled={busy === "dispute"}
              onClick={submitDispute}
            >
              {busy === "dispute" ? <Loader2 className="size-4 animate-spin" /> : <Scale className="size-4" />}
              File dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
