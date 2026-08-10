import { Badge } from "@/components/ui/badge";
import {
  CaseStatusKey,
  SERVICE_SHORT,
  STATUS_META,
  formatDate,
  timeAgo,
} from "@/lib/asoju";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.label]),
);
const STATUS_TONE: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.tone]),
);
const STATUS_DOT: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.dot]),
);

export interface CaseSummary {
  _id: string;
  caseNumber: string;
  serviceType: string;
  serviceLabel: string;
  description: string;
  location: string;
  status: string;
  priority: string;
  tier: string;
  paymentStatus: string;
  nextAction?: string;
  nextActionDueAt?: number;
  slaTargetAt?: number;
  createdAt: number;
  updatedAt: number;
}

const PRIORITY_TONE: Record<string, string> = {
  URGENT: "bg-red-50 text-red-700 border-red-200",
  PRIORITY: "bg-amber-50 text-amber-700 border-amber-200",
  STANDARD: "bg-slate-100 text-slate-600 border-slate-200",
};

const TIER_TONE: Record<string, string> = {
  CONCIERGE: "bg-gold/15 text-clay border-gold/40",
  ESSENTIAL: "bg-forest/8 text-forest border-forest/15",
};

export function CaseCard({ kase }: { kase: CaseSummary }) {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const overdue =
    kase.slaTargetAt && kase.slaTargetAt < now &&
    !["COMPLETED", "CLOSED", "APPROVED", "ON_HOLD"].includes(kase.status);

  return (
    <button
      onClick={() => navigate(`/dashboard/cases/${kase._id}`)}
      className="group w-full rounded-2xl border border-forest/10 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-lg"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-semibold tracking-wide text-forest/60">
            {kase.caseNumber}
          </span>
          <Badge className="border-forest/10 bg-forest/5 text-forest/80">
            {SERVICE_SHORT[kase.serviceType] ?? kase.serviceLabel}
          </Badge>
          <Badge className={cn("border", TIER_TONE[kase.tier] ?? "")}>
            {kase.tier === "CONCIERGE" ? "Concierge" : "Essential"}
          </Badge>
          <Badge className={cn("border", PRIORITY_TONE[kase.priority] ?? "")}>
            {kase.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {overdue && (
            <Badge className="border-red-300 bg-red-50 text-red-700">Overdue</Badge>
          )}
          <span className="flex items-center gap-1.5 text-xs text-forest/55">
            <Clock className="size-3.5" />
            {timeAgo(kase.updatedAt)}
          </span>
          <ArrowUpRight className="size-4 text-forest/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-forest" />
        </div>
      </div>

      <div className="mt-3.5 flex items-start gap-2">
        <span
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
            STATUS_TONE[kase.status as CaseStatusKey] ?? "",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              STATUS_DOT[kase.status as CaseStatusKey] ?? "",
            )}
          />
          {STATUS_LABEL[kase.status as CaseStatusKey] ?? kase.status}
        </span>
        <p className="line-clamp-1 flex-1 text-sm text-forest/80">{kase.description}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-forest/8 pt-3.5">
        <span className="flex items-center gap-1.5 text-xs text-forest/50">
          <MapPin className="size-3.5" />
          {kase.location}
        </span>
        <span className="text-xs text-forest/50">
          {kase.nextAction ? (
            <>
              Next: <span className="font-medium text-forest/70">{kase.nextAction}</span>
            </>
          ) : (
            <>Created {formatDate(kase.createdAt)}</>
          )}
        </span>
      </div>
    </button>
  );
}
