import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FX_RATE_NGN_PER_USD, naira, PLAN_META } from "@/lib/asoju";

export function BillingView() {
  const data = useQuery(api.commercial.getSubscription);
  const subscribe = useMutation(api.commercial.subscribe);
  const cancel = useMutation(api.commercial.cancelSubscription);
  const [busy, setBusy] = useState<string | null>(null);

  const sub = data?.subscription ?? null;
  const plans = data?.plans ?? PLAN_META;

  const doSubscribe = async (plan: "PRIORITY" | "PREMIUM") => {
    setBusy(plan);
    try {
      await subscribe({ plan });
      toast.success(`You're on ${PLAN_META[plan].label} — a fresh SC voucher is ready`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const doCancel = async () => {
    setBusy("cancel");
    try {
      await cancel();
      toast.success("Subscription cancelled — active cases continue unaffected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const daysLeft = sub ? Math.max(0, Math.ceil((sub.cycleEndsAt - Date.now()) / 86400_000)) : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-clay">
            <CreditCard className="size-4" />
            Subscription &amp; billing
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-forest">
            Priority &amp; Premium — with a monthly Special Credit
          </h1>
          <p className="mt-1.5 text-sm text-forest/60">
            Subscription + overage: your SC voucher covers part of a case each
            cycle, and you pay the remainder out-of-pocket (with your tier
            discount).
          </p>
        </div>
        {sub && (
          <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
            Active · {PLAN_META[sub.plan].label} · {daysLeft}d left in cycle
          </Badge>
        )}
      </div>

      {/* Current SC status */}
      {sub && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
                <Sparkles className="size-5 text-gold" />
                Special Credit voucher
              </p>
              <p className="mt-1 text-sm text-forest/65">
                ${sub.scUsd} this cycle · ≈ {naira(Math.round(sub.scUsd * FX_RATE_NGN_PER_USD))} at
                the locked rate · valid until {new Date(sub.cycleEndsAt).toLocaleDateString("en-GB")}
              </p>
            </div>
            <div className="rounded-xl border border-forest/10 bg-white px-4 py-3 text-center">
              <p className="text-[11px] uppercase tracking-wide text-forest/45">Status</p>
              <p
                className={cn(
                  "mt-0.5 flex items-center gap-1.5 text-sm font-bold",
                  sub.scUsedThisCycle ? "text-clay" : "text-emerald-700",
                )}
              >
                {sub.scUsedThisCycle ? (
                  <>
                    <XCircle className="size-4" /> Used this cycle
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" /> Available
                  </>
                )}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-forest/50">
            Single-use per billing cycle. If a case costs less than the SC, the
            remainder is forfeited; if it costs more, you pay the difference.
            SC doesn't apply outside Lagos &amp; the South-West (margin
            protection). SC never rolls over.
          </p>
        </div>
      )}

      {/* Plans */}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {(Object.keys(plans) as (keyof typeof plans)[]).map((key) => {
          const p = plans[key];
          const isCurrent = sub?.plan === key;
          const isSubPlan = key !== "ESSENTIAL";
          return (
            <div
              key={key}
              className={cn(
                "flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all",
                key === "PREMIUM" ? "border-gold/50 shadow-lg shadow-gold/10" : "border-forest/10",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-forest">{p.label}</h3>
                {key === "PREMIUM" && (
                  <Badge className="border-gold/40 bg-gold/10 text-clay">Best value</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-forest/55">{p.blurb}</p>
              <p className="mt-4 font-display text-3xl font-semibold text-forest">
                {p.monthlyUsd > 0 ? `$${p.monthlyUsd}` : "Free"}
                <span className="text-sm font-medium text-forest/45">
                  {p.monthlyUsd > 0 ? " /mo" : ""}
                </span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-forest/70">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-forest" />
                  {p.scUsd > 0 ? `$${p.scUsd} Special Credit / month` : "No monthly credits"}
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-forest" />
                  {p.discountPct > 0 ? `${p.discountPct}% off out-of-pocket cases` : "No discount on overages"}
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-forest" />
                  AI Concierge intake &amp; case tracking
                </li>
              </ul>
              {isCurrent ? (
                <div className="mt-6">
                  <p className="rounded-xl bg-emerald-50 py-2.5 text-center text-sm font-semibold text-emerald-700">
                    Current plan
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-2 w-full text-forest/60 hover:text-forest"
                    disabled={busy === "cancel"}
                    onClick={doCancel}
                  >
                    {busy === "cancel" ? <Loader2 className="size-4 animate-spin" /> : null}
                    Cancel subscription
                  </Button>
                </div>
              ) : isSubPlan ? (
                <Button
                  className={cn(
                    "mt-6 w-full",
                    key === "PREMIUM"
                      ? "bg-gold font-semibold text-forest-deep hover:bg-gold-light"
                      : "bg-forest text-ivory hover:bg-forest-deep",
                  )}
                  disabled={busy !== null}
                  onClick={() => doSubscribe(key)}
                >
                  {busy === key ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  {sub ? "Switch to " : "Subscribe to "}
                  {p.label}
                </Button>
              ) : (
                <div className="mt-6 rounded-xl border border-forest/10 bg-ivory/60 py-2.5 text-center text-sm font-medium text-forest/55">
                  Pay-per-service — always available
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Terms */}
      <div className="mt-6 rounded-2xl border border-forest/10 bg-white p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-forest">
          <ShieldCheck className="size-4 text-forest" />
          Commercial terms
        </p>
        <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-forest/60">
          <li>· SC is a single-use voucher per billing cycle — unused balance never rolls over.</li>
          <li>· SC cannot be applied to cases scoped to "Other locations" (PRD §2.3 margin protection).</li>
          <li>· Service fees are quoted in ₦; the parallel-market rate is pinned at quote time and locked for 48 hours.</li>
          <li>· Demo checkout: subscribing simulates the monthly billing cycle — no real charge.</li>
        </ul>
      </div>
    </div>
  );
}
