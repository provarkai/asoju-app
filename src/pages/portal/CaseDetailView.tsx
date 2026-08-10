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
  Play,
  Receipt,
  RotateCcw,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, naira } from "@/lib/asoju";

export function CaseDetailView({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const caseIdTyped = caseId as Id<"cases">;
  const kase = useQuery(api.cases.getCase, { caseId: caseIdTyped });
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const acceptQuote = useMutation(api.cases.acceptQuote);
  const payInvoice = useMutation(api.cases.payInvoice);
  const demoAdvance = useMutation(api.cases.demoAdvance);
  const approveReport = useMutation(api.cases.approveReport);
  const requestAdditionalWork = useMutation(api.cases.requestAdditionalWork);
  const sendMessage = useMutation(api.cases.sendMessage);

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
  };

  const checkoutDone = (kase.payments ?? []).some((p) => p.status === "PAID");

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
            </div>
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
          <p className="text-sm text-forest/70">
            This case is on hold — we'll resume when you're ready.
          </p>
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
                ["Tier", kase.tier === "CONCIERGE" ? "Concierge" : "Essential"],
                ["Risk level", `${kase.riskLevel}/4`],
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

          {/* Checklist */}
          <section className="rounded-2xl border border-forest/10 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-forest">Field checklist</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {kase.checklist.map((item: string, i: number) => {
                const done = kase.evidence.some((e) =>
                  item.toLowerCase().startsWith(e.title.toLowerCase().split(" ")[0]) ||
                  e.title.toLowerCase().includes(item.toLowerCase().split(" ")[0]),
                );
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
              onAccept={() =>
                run("accept", () => acceptQuote({ caseId: caseIdTyped }), "Quote accepted — invoice created")
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
    </div>
  );
}
