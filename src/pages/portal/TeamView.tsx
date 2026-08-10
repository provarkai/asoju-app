import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, StatCard, StatusPill } from "@/components/portal/ui";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertTriangle,
  ArrowUpRight,
  CircleDollarSign,
  Clock,
  FolderOpen,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { naira, timeAgo } from "@/lib/asoju";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { key: "ALL", label: "All statuses" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "UNDER_REVIEW", label: "Under review" },
  { key: "QUOTED", label: "Quote ready" },
  { key: "AWAITING_PAYMENT", label: "Awaiting payment" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "QUALITY_CONTROL", label: "Quality check" },
  { key: "CUSTOMER_REVIEW", label: "Customer review" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CLOSED", label: "Closed" },
  { key: "ON_HOLD", label: "On hold" },
];

const SERVICE_FILTERS = [
  { key: "ALL", label: "All services" },
  { key: "PROPERTY_INSPECTION", label: "Property inspection" },
  { key: "CONSTRUCTION_SUPERVISION", label: "Construction supervision" },
  { key: "ASSET_INSPECTION", label: "Asset inspection" },
  { key: "FAMILY_SUPPORT", label: "Family support" },
  { key: "PROCUREMENT", label: "Procurement" },
  { key: "BUSINESS_VERIFICATION", label: "Business verification" },
  { key: "INVESTMENT_SUPPORT", label: "Investment support" },
  { key: "BEREAVEMENT_SUPPORT", label: "Bereavement support" },
];

interface TeamCaseRow {
  _id: string;
  caseNumber: string;
  serviceType: string;
  serviceLabel: string;
  customerName: string;
  description: string;
  location: string;
  priority: string;
  paymentStatus: string;
  status: string;
  nextAction?: string;
  slaTargetAt?: number;
  createdAt: number;
}

export function TeamView() {
  const navigate = useNavigate();
  const board = useQuery(api.cases.teamGetCases);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [service, setService] = useState("ALL");

  const rows = useMemo(() => {
    if (!board) return [];
    const q = search.trim().toLowerCase();
    return (board.cases as TeamCaseRow[]).filter((k) => {
      if (status !== "ALL" && k.status !== status) return false;
      if (service !== "ALL" && k.serviceType !== service) return false;
      if (!q) return true;
      return (
        k.caseNumber.toLowerCase().includes(q) ||
        k.customerName.toLowerCase().includes(q) ||
        k.description.toLowerCase().includes(q) ||
        k.location.toLowerCase().includes(q)
      );
    });
  }, [board, search, status, service]);

  if (!board) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-forest/5" />
        ))}
      </div>
    );
  }

  const stats = board.stats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl bg-forest p-7 text-ivory shadow-xl shadow-forest/20 sm:p-9">
        <div className="absolute inset-0 pattern-grid-dark" />
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-sm text-gold-light">
            <ShieldCheck className="size-4" />
            ASOJU team operations
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">
            Every customer case, one board
          </h1>
          <p className="mt-3 max-w-xl text-sm text-ivory/70">
            Triage queue, SLA watch and the full golden path across all
            customers. Drill into any case to review evidence, quotes and the
            conversation.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Badge className="border-gold/40 bg-gold/15 text-gold-light">
              Admin access
            </Badge>
            <span className="text-xs text-ivory/55">
              {stats.total} total · {stats.active} active · {stats.overdue} overdue
            </span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={FolderOpen}
          label="Total cases"
          value={stats.total}
          hint="All customers"
        />
        <StatCard
          icon={UsersRound}
          label="Active"
          value={stats.active}
          hint="Not completed or on hold"
        />
        <StatCard
          icon={Clock}
          label="Awaiting action"
          value={stats.awaitingAction}
          hint="Quote, payment, approval"
          accent="bg-gold/15 text-clay"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue SLA"
          value={stats.overdue}
          hint="Past target time"
          accent="bg-red-100 text-red-700"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Confirmed revenue"
          value={naira(stats.grossValue)}
          hint="Paid invoices only"
          accent="bg-emerald-100 text-emerald-700"
        />
      </section>

      {/* Filters */}
      <section className="flex flex-col gap-3 rounded-2xl border border-forest/10 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-forest/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case number, customer, description…"
            className="w-full rounded-xl border border-forest/15 bg-ivory/50 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-forest/40 focus:bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-forest/15 bg-ivory/50 px-3 py-2.5 text-sm outline-none focus:border-forest/40"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="rounded-xl border border-forest/15 bg-ivory/50 px-3 py-2.5 text-sm outline-none focus:border-forest/40"
          >
            {SERVICE_FILTERS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-forest/10 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No cases match"
            copy="Try widening the status or service filters, or clearing the search."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-forest/8 bg-ivory/60 text-[11px] uppercase tracking-wider text-forest/50">
                  <th className="px-5 py-3 font-semibold">Case</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Next action</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => {
                  const now = Date.now();
                  const overdue =
                    k.slaTargetAt &&
                    k.slaTargetAt < now &&
                    !["COMPLETED", "CLOSED", "APPROVED", "ON_HOLD"].includes(k.status);
                  return (
                    <tr
                      key={k._id}
                      onClick={() => navigate(`/dashboard/team/cases/${k._id}`)}
                      className="group cursor-pointer border-b border-forest/6 transition-colors last:border-0 hover:bg-ivory/60"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs font-semibold text-forest/60">
                          {k.caseNumber}
                        </p>
                        <p className="mt-0.5 line-clamp-1 max-w-[220px] text-forest/85">
                          {k.description}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-forest">{k.customerName}</p>
                        <p className="text-xs text-forest/50">{k.location}</p>
                      </td>
                      <td className="px-4 py-3.5 text-forest/70">
                        <span className="line-clamp-1 max-w-[180px]">{k.serviceLabel}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <StatusPill status={k.status} />
                          {overdue && (
                            <Badge className="border-red-300 bg-red-50 text-red-700">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          className={cn(
                            "border",
                            k.priority === "URGENT"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : k.priority === "PRIORITY"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-slate-200 bg-slate-50 text-slate-600",
                          )}
                        >
                          {k.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            k.paymentStatus === "PAID" ? "text-emerald-600" : "text-amber-600",
                          )}
                        >
                          {k.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="line-clamp-1 max-w-[200px] text-xs text-forest/70">
                          {k.nextAction ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-forest/50">
                        {timeAgo(k.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <ArrowUpRight className="size-4 text-forest/30 transition-colors group-hover:text-forest" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-forest/8 bg-ivory/40 px-5 py-3 text-xs text-forest/50">
          <span>
            Showing {rows.length} of {stats.total} cases
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-forest hover:bg-forest/5"
            onClick={() => navigate("/dashboard")}
          >
            Back to my cases
          </Button>
        </div>
      </section>
    </div>
  );
}
