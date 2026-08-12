import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  HardHat,
  HeartHandshake,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  PackageSearch,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { naira } from "@/lib/asoju";
import type { CasePriority, CaseTier, ServiceType, Timeline } from "@/convex/schema";

const SERVICES: {
  type: ServiceType;
  icon: typeof Home;
  name: string;
  desc: string;
  from: number;
  popular: boolean;
}[] = [
  { type: "PROPERTY_INSPECTION", icon: Home, name: "Property Inspection & Verification", desc: "Found a land or property? We go and check it.", from: 85000, popular: true },
  { type: "CONSTRUCTION_SUPERVISION", icon: HardHat, name: "Construction / Project Supervision", desc: "You're building — we watch the site.", from: 125000, popular: false },
  { type: "ASSET_INSPECTION", icon: PackageSearch, name: "Asset / Project Inspection", desc: "House, farm, equipment — we check it.", from: 60000, popular: false },
  { type: "FAMILY_SUPPORT", icon: Building2, name: "Family Support Errands", desc: "Help for the family back home.", from: 45000, popular: false },
  { type: "PROCUREMENT", icon: PackageSearch, name: "Procurement & Delivery", desc: "Buy it there, deliver it, prove it.", from: 30000, popular: false },
  { type: "BUSINESS_VERIFICATION", icon: Building2, name: "Business Verification", desc: "Check that business actually exists.", from: 90000, popular: false },
  { type: "INVESTMENT_SUPPORT", icon: TrendingUp, name: "Investment Support", desc: "Eyes on the ground for your investment.", from: 100000, popular: false },
  { type: "BEREAVEMENT_SUPPORT", icon: HeartHandshake, name: "Bereavement & Funeral Logistics", desc: "We handle the hardest day with care.", from: 150000, popular: false },
];

const TIMELINES: { key: Timeline; label: string; hint: string }[] = [
  { key: "immediate", label: "As soon as possible", hint: "Urgent — within days" },
  { key: "near_term", label: "Within a couple of weeks", hint: "Steady, no rush" },
  { key: "exploring", label: "Just exploring for now", hint: "Plan & price first" },
];

const PRIORITIES: { key: CasePriority; label: string; hint: string }[] = [
  { key: "STANDARD", label: "Standard", hint: "72h SLA" },
  { key: "PRIORITY", label: "Priority", hint: "48h SLA" },
  { key: "URGENT", label: "Urgent", hint: "24h SLA" },
];

const TIERS: { key: CaseTier; label: string; desc: string; icon: typeof ClipboardCheck }[] = [
  {
    key: "ESSENTIAL",
    label: "Essential",
    desc: "Pay-per-service. AI intake, verified representative, evidence & report.",
    icon: ClipboardCheck,
  },
  {
    key: "CONCIERGE",
    label: "Concierge",
    desc: "Subscription-tier pricing with relationship management. 15% off service fees.",
    icon: Sparkles,
  },
];

export function NewRequestView() {
  const navigate = useNavigate();
  const createRequest = useMutation(api.cases.createServiceRequest);

  const [step, setStep] = useState(0);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [timeline, setTimeline] = useState<Timeline>("near_term");
  const [priority, setPriority] = useState<CasePriority>("STANDARD");
  const [tier, setTier] = useState<CaseTier>("ESSENTIAL");
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from a Concierge chat draft (carried via sessionStorage when the
  // customer accepted a quote before signing in).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("asoju-concierge-draft");
      if (!raw) return;
      sessionStorage.removeItem("asoju-concierge-draft");
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.serviceType === "string" && SERVICES.some((s) => s.type === d.serviceType)) {
        setServiceType(d.serviceType as ServiceType);
      }
      if (typeof d.description === "string") setDescription(d.description);
      if (typeof d.location === "string") setLocation(d.location);
      if (typeof d.city === "string") setCity(d.city);
      if (typeof d.state === "string") setState(d.state);
      if (typeof d.timeline === "string" && TIMELINES.some((t) => t.key === d.timeline)) {
        setTimeline(d.timeline as Timeline);
      }
      if (typeof d.priority === "string" && PRIORITIES.some((p) => p.key === d.priority)) {
        setPriority(d.priority as CasePriority);
      }
      if (typeof d.tier === "string" && TIERS.some((t) => t.key === d.tier)) {
        setTier(d.tier as CaseTier);
      }
      toast.info("Pre-filled from your Concierge chat — review and submit.");
    } catch {
      /* malformed draft — ignore */
    }
  }, []);

  const canNext =
    step === 0
      ? serviceType !== null
      : step === 1
        ? description.trim().length >= 10 && location.trim().length > 0
        : true;

  const submit = async () => {
    if (!serviceType) return;
    setSubmitting(true);
    try {
      const res = await createRequest({
        serviceType,
        description: description.trim(),
        location: location.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        timeline,
        priority,
        tier,
      });
      toast.success(`Request received — ${res.caseNumber} created`);
      navigate(`/dashboard/cases/${res.caseId}`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-clay">
            <MessageCircle className="size-4" />
            ASOJU Concierge
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-forest">
            What would you like us to handle?
          </h1>
          <p className="mt-1.5 text-sm text-forest/60">
            A few quick questions — about 2 minutes. Our team takes it from here.
          </p>
        </div>
        <Badge className="hidden border-gold/40 bg-gold/10 text-clay sm:inline-flex">
          <Sparkles className="size-3" />
          AI-assisted intake
        </Badge>
      </div>

      {/* Progress */}
      <div className="mt-6 flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-forest/10">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r from-forest to-gold transition-all duration-500",
                i <= step ? "w-full" : "w-0",
              )}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs font-medium text-forest/50">
        {step === 0
          ? "Step 1 of 3 · What do you need handled?"
          : step === 1
            ? "Step 2 of 3 · Tell us where & what's happening"
            : "Step 3 of 3 · Timeline & plan"}
      </p>

      <div className="mt-6 rounded-3xl border border-forest/10 bg-white p-6 shadow-lg shadow-forest/5 sm:p-8">
        {/* STEP 1 — service */}
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {SERVICES.map((s) => (
              <button
                key={s.type}
                onClick={() => setServiceType(s.type)}
                className={cn(
                  "group relative flex flex-col rounded-2xl border p-5 text-left transition-all",
                  serviceType === s.type
                    ? "border-forest bg-forest text-ivory shadow-lg shadow-forest/20"
                    : "border-forest/10 bg-white hover:-translate-y-0.5 hover:border-forest/30 hover:shadow-md",
                )}
              >
                {s.popular && (
                  <Badge
                    className={cn(
                      "absolute right-4 top-4 border text-[10px]",
                      serviceType === s.type
                        ? "border-gold/40 bg-gold/15 text-gold-light"
                        : "border-gold/40 bg-gold/10 text-clay",
                    )}
                  >
                    Most popular
                  </Badge>
                )}
                <s.icon
                  className={cn(
                    "size-6",
                    serviceType === s.type ? "text-gold-light" : "text-forest",
                  )}
                />
                <p className="mt-3 font-display text-base font-semibold">{s.name}</p>
                <p className="mt-1 text-xs opacity-70">{s.desc}</p>
                <p className="mt-3 text-xs font-medium opacity-60">
                  from {naira(s.from)}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* STEP 2 — details */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-forest">
                What's happening? Describe it in your own words
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder='e.g. "I found a plot for sale in Ibeju-Lekki and I&apos;m not sure it&apos;s genuine. Please check the location, condition and surroundings."'
                className="w-full resize-none rounded-xl border border-forest/15 bg-ivory/50 px-4 py-3 text-sm outline-none transition-colors focus:border-forest/40 focus:bg-white"
              />
              <p className="mt-1 text-[11px] text-forest/45">
                {description.trim().length < 10
                  ? "Please give us at least a sentence."
                  : "Thanks — that's enough to triage."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-forest">
                  <MapPin className="mr-1 inline size-3.5 text-clay" />
                  Location in Nigeria
                </label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Ibeju-Lekki, Lagos"
                  className="w-full rounded-xl border border-forest/15 bg-ivory/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest/40 focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-forest">City</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Lekki"
                    className="w-full rounded-xl border border-forest/15 bg-ivory/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest/40 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-forest">State</label>
                  <input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Lagos"
                    className="w-full rounded-xl border border-forest/15 bg-ivory/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest/40 focus:bg-white"
                  />
                </div>
              </div>
            </div>
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-800">
              <Camera className="mt-0.5 size-4 shrink-0" />
              Note: our Property Inspection verifies physical location, condition
              and surroundings with dated photo evidence. It is not a legal title
              certification, survey or valuation — those require a licensed
              professional coordinated through the platform.
            </p>
          </div>
        )}

        {/* STEP 3 — timeline & plan */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-forest">
                What's your ideal timeline?
              </label>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {TIMELINES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTimeline(t.key)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      timeline === t.key
                        ? "border-forest bg-forest text-ivory shadow-md"
                        : "border-forest/10 bg-white hover:border-forest/30",
                    )}
                  >
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className={cn("mt-0.5 text-[11px]", timeline === t.key ? "opacity-70" : "text-forest/50")}>
                      {t.hint}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-forest">
                Priority — how fast do we need to move?
              </label>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPriority(p.key)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      priority === p.key
                        ? "border-forest bg-forest text-ivory shadow-md"
                        : "border-forest/10 bg-white hover:border-forest/30",
                    )}
                  >
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className={cn("mt-0.5 text-[11px]", priority === p.key ? "opacity-70" : "text-forest/50")}>
                      {p.hint}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-forest">
                Which plan is right for this request?
              </label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {TIERS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTier(t.key)}
                    className={cn(
                      "flex gap-3 rounded-xl border p-4 text-left transition-all",
                      tier === t.key
                        ? "border-forest bg-forest text-ivory shadow-md"
                        : "border-forest/10 bg-white hover:border-forest/30",
                    )}
                  >
                    <t.icon className={cn("mt-0.5 size-5 shrink-0", tier === t.key ? "text-gold-light" : "text-forest")} />
                    <div>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className={cn("mt-0.5 text-[11px] leading-relaxed", tier === t.key ? "opacity-70" : "text-forest/55")}>
                        {t.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-forest/8 pt-5">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-forest"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {step < 2 ? (
            <Button
              className="bg-forest text-ivory hover:bg-forest-deep"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              className="bg-gold font-semibold text-forest-deep hover:bg-gold-light"
              disabled={submitting}
              onClick={submit}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <FilePlus2 className="size-4" />
                  Submit request
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Trust note */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-forest/50">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-forest" />
          No sensitive IDs (BVN, NIN, passport) requested here
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-forest" />
          Humans confirm scope &amp; pricing before anything is scheduled
        </span>
      </div>
    </div>
  );
}
