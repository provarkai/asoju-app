import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CaseCard, CaseSummary } from "@/components/portal/CaseCard";
import { EmptyState, StatCard, StatusPill } from "@/components/portal/ui";
import { useAuth } from "@/hooks/use-auth";
import {
  BellRing,
  CheckCircle2,
  CircleDollarSign,
  FilePlus2,
  FolderOpen,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { naira, timeAgo } from "@/lib/asoju";
import { cn } from "@/lib/utils";

export function HomeView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboard = useQuery(api.cases.getDashboard);

  if (!dashboard) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-forest/5" />
        ))}
      </div>
    );
  }

  const firstName = dashboard.profile?.fullName?.split(" ")[0] ?? user?.name ?? "friend";
  const active = dashboard.activeCases ?? [];
  const needsAction = dashboard.actionRequired ?? [];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-forest p-7 text-ivory shadow-xl shadow-forest/20 sm:p-9">
        <div className="absolute inset-0 pattern-grid-dark" />
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-sm text-gold-light">
            <Sparkles className="size-4" />
            Welcome back, {firstName}
          </p>
          <h1 className="mt-2 max-w-lg font-display text-3xl font-semibold leading-tight sm:text-4xl">
            What would you like us to handle for you in Nigeria?
          </h1>
          <p className="mt-3 max-w-xl text-sm text-ivory/70">
            Tell us in plain words — a property, a build, an asset, a family
            errand. We'll take it from request to evidence-backed report.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              className="h-11 bg-gold px-6 font-semibold text-forest-deep shadow-lg shadow-gold/20 transition-transform hover:-translate-y-0.5 hover:bg-gold-light"
              onClick={() => navigate("/dashboard/new")}
            >
              <FilePlus2 className="size-4" />
              Start a request
            </Button>
            <Button
              variant="outline"
              className="h-11 border-ivory/25 bg-transparent px-6 text-ivory hover:bg-ivory/10"
              onClick={() => navigate("/dashboard/profile")}
            >
              <MessageSquare className="size-4" />
              Set preferences
            </Button>
          </div>
        </div>
      </section>

      {/* Needs action */}
      {needsAction.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <BellRing className="size-4.5 text-clay" />
            <h2 className="font-display text-lg font-semibold text-forest">
              Needs your action
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {needsAction.map((k) => (
              <button
                key={k._id}
                onClick={() => navigate(`/dashboard/cases/${k._id}`)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gold/5 px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:bg-gold/10 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-forest/50">
                    {k.caseNumber}
                  </p>
                  <p className="truncate text-sm font-semibold text-forest">
                    {k.description}
                  </p>
                  <p className="mt-0.5 text-[11px] text-clay">
                    {k.nextAction ?? "Action required"}
                  </p>
                </div>
                <StatusPill status={k.status} className="shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={FolderOpen}
          label="Active cases"
          value={active.length}
          hint="In motion right now"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={dashboard.completedCount ?? 0}
          hint="Delivered with reports"
          accent="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Total spend"
          value={naira(dashboard.totalSpend ?? 0)}
          hint="Confirmed payments only"
          accent="bg-gold/15 text-clay"
        />
        <StatCard
          icon={BellRing}
          label="Unread updates"
          value={dashboard.unread ?? 0}
          hint="Quotes, reports & more"
          accent="bg-sky-100 text-sky-700"
        />
      </section>

      {/* Latest activity */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-forest">
            Your cases
          </h2>
          {dashboard.cases.length > 4 && (
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm font-medium text-forest/60 hover:text-forest"
            >
              View all
            </button>
          )}
        </div>
        {dashboard.cases.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No cases yet"
            copy="When you start a request, it becomes a tracked case with a timeline, evidence and reports — all in one place."
            action={
              <Button
                className="bg-forest text-ivory hover:bg-forest-deep"
                onClick={() => navigate("/dashboard/new")}
              >
                <FilePlus2 className="size-4" />
                Start your first request
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {dashboard.cases.slice(0, 6).map((k) => (
              <CaseCard key={k._id} kase={k as unknown as CaseSummary} />
            ))}
          </div>
        )}
      </section>

      {/* Notifications strip */}
      {dashboard.notifications.length > 0 && (
        <section className="rounded-2xl border border-forest/10 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-forest">
            Recent updates
          </h2>
          <div className="mt-3 space-y-2.5">
            {dashboard.notifications.slice(0, 4).map((n) => (
              <button
                key={n._id}
                onClick={() => n.caseId && navigate(`/dashboard/cases/${n.caseId}`)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border border-forest/8 bg-ivory/50 p-3 text-left",
                  n.caseId && "transition-colors hover:border-forest/25 hover:bg-ivory",
                )}
              >
                <Badge className="mt-0.5 border-gold/40 bg-gold/10 text-clay">
                  <Sparkles className="size-3" />
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-forest">{n.title}</p>
                  <p className="line-clamp-1 text-xs text-forest/60">{n.body}</p>
                </div>
                <span className="shrink-0 text-[10px] text-forest/40">
                  {timeAgo(n.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
