export type CaseStatusKey =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "QUOTED"
  | "AWAITING_PAYMENT"
  | "SCHEDULED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "EVIDENCE_SUBMITTED"
  | "QUALITY_CONTROL"
  | "CUSTOMER_REVIEW"
  | "ADDITIONAL_WORK"
  | "APPROVED"
  | "COMPLETED"
  | "CLOSED"
  | "ON_HOLD";

export const STATUS_META: Record<
  CaseStatusKey,
  { label: string; human: string; tone: string; dot: string }
> = {
  SUBMITTED: {
    label: "Submitted",
    human: "Request received — our team is on it.",
    tone: "bg-sky-100 text-sky-800 border-sky-200",
    dot: "bg-sky-500",
  },
  UNDER_REVIEW: {
    label: "Under review",
    human: "We're verifying scope and preparing a quote.",
    tone: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  QUOTED: {
    label: "Quote ready",
    human: "A quote is ready for your review.",
    tone: "bg-violet-100 text-violet-800 border-violet-200",
    dot: "bg-violet-500",
  },
  AWAITING_PAYMENT: {
    label: "Awaiting payment",
    human: "Accept the invoice to schedule your representative.",
    tone: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
  },
  SCHEDULED: {
    label: "Scheduled",
    human: "Payment confirmed — we're scheduling your visit.",
    tone: "bg-teal-100 text-teal-800 border-teal-200",
    dot: "bg-teal-500",
  },
  ASSIGNED: {
    label: "Agent assigned",
    human: "Your representative has been assigned.",
    tone: "bg-teal-100 text-teal-800 border-teal-200",
    dot: "bg-teal-500",
  },
  IN_PROGRESS: {
    label: "In progress",
    human: "Your representative is on site now.",
    tone: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  EVIDENCE_SUBMITTED: {
    label: "Evidence captured",
    human: "Photos and observations captured — QC next.",
    tone: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  QUALITY_CONTROL: {
    label: "Quality check",
    human: "Our team is reviewing the evidence.",
    tone: "bg-lime-100 text-lime-800 border-lime-200",
    dot: "bg-lime-500",
  },
  CUSTOMER_REVIEW: {
    label: "Your review",
    human: "Your report is ready — please review and approve.",
    tone: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
  },
  ADDITIONAL_WORK: {
    label: "Additional work",
    human: "We've noted your request and are back on it.",
    tone: "bg-rose-100 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
  },
  APPROVED: {
    label: "Approved",
    human: "Thanks for confirming — closing this out.",
    tone: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-600",
  },
  COMPLETED: {
    label: "Completed",
    human: "This case has been completed.",
    tone: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-600",
  },
  CLOSED: {
    label: "Closed",
    human: "This case is closed. Thanks for trusting ASOJU.",
    tone: "bg-stone-200 text-stone-700 border-stone-300",
    dot: "bg-stone-400",
  },
  ON_HOLD: {
    label: "On hold",
    human: "This case is paused — we'll resume when you're ready.",
    tone: "bg-zinc-200 text-zinc-700 border-zinc-300",
    dot: "bg-zinc-400",
  },
};

export const SERVICE_LABELS: Record<string, string> = {
  PROPERTY_INSPECTION: "Property Inspection & Verification",
  CONSTRUCTION_SUPERVISION: "Construction / Project Supervision",
  ASSET_INSPECTION: "Asset / Project Inspection",
  FAMILY_SUPPORT: "Family Support Errands",
  PROCUREMENT: "Procurement & Delivery",
  BUSINESS_VERIFICATION: "Business Verification",
  INVESTMENT_SUPPORT: "Investment Support",
  BEREAVEMENT_SUPPORT: "Bereavement & Funeral Logistics",
};

export const SERVICE_SHORT: Record<string, string> = {
  PROPERTY_INSPECTION: "Property check",
  CONSTRUCTION_SUPERVISION: "Site supervision",
  ASSET_INSPECTION: "Asset check",
  FAMILY_SUPPORT: "Family errands",
  PROCUREMENT: "Procurement",
  BUSINESS_VERIFICATION: "Business check",
  INVESTMENT_SUPPORT: "Investment check",
  BEREAVEMENT_SUPPORT: "Funeral logistics",
};

export function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export const LEAD_TAG_META: Record<string, { label: string; tone: string }> = {
  HOT: { label: "Hot", tone: "bg-red-100 text-red-700" },
  WARM: { label: "Warm", tone: "bg-amber-100 text-amber-700" },
  COLD: { label: "Cold", tone: "bg-slate-200 text-slate-600" },
};

// ---------------------------------------------------------------------------
// PRD §2 — Commercial model (display mirrors of the Convex PLAN_META)
// ---------------------------------------------------------------------------

export type PlanKey = "ESSENTIAL" | "PRIORITY" | "PREMIUM";

export const PLAN_META: Record<
  PlanKey,
  { label: string; monthlyUsd: number; scUsd: number; discountPct: number; blurb: string }
> = {
  ESSENTIAL: {
    label: "Essential",
    monthlyUsd: 0,
    scUsd: 0,
    discountPct: 0,
    blurb: "Pay-per-service. No subscription, no credits.",
  },
  PRIORITY: {
    label: "Priority",
    monthlyUsd: 49,
    scUsd: 30,
    discountPct: 5,
    blurb: "Monthly SC voucher + 5% off out-of-pocket cases.",
  },
  PREMIUM: {
    label: "Premium",
    monthlyUsd: 99,
    scUsd: 50,
    discountPct: 10,
    blurb: "Bigger SC voucher + 10% off out-of-pocket cases.",
  },
};

export const PLAN_LABEL: Record<string, string> = {
  ESSENTIAL: "Essential",
  PRIORITY: "Priority",
  PREMIUM: "Premium",
};

export type RegionZoneKey = "LAGOS" | "SOUTH_WEST" | "OTHER";

export const REGION_META: Record<
  RegionZoneKey,
  { label: string; hint: string; multiplier: number; scEligible: boolean }
> = {
  LAGOS: { label: "Lagos zone", hint: "Optimised cost base — SC eligible", multiplier: 1.0, scEligible: true },
  SOUTH_WEST: { label: "South-West (excl. Lagos)", hint: "Oyo · Ogun · Osun · Ondo · Ekiti · Kwara — SC eligible", multiplier: 1.6, scEligible: true },
  OTHER: { label: "Other locations", hint: "Scoped by case manager — SC not available", multiplier: 2.0, scEligible: false },
};

export const REGION_LABEL: Record<string, string> = {
  LAGOS: "Lagos zone",
  SOUTH_WEST: "South-West (excl. Lagos)",
  OTHER: "Other locations",
};

// Demo parallel-market rate pinned at quote time (PRD §4.3).
export const FX_RATE_NGN_PER_USD = 1450;

export const VAULT_CATEGORY_LABEL: Record<string, string> = {
  TITLE_DEED: "Title deed",
  CAC_CERT: "CAC certificate",
  POWER_OF_ATTORNEY: "Power of attorney",
  IDENTITY: "Identity document",
  OTHER: "Other",
};

// PRD §3.3 — construction milestone tracker (groups the flat checklist).
export const CONSTRUCTION_MILESTONES: { key: string; label: string; items: string[] }[] = [
  {
    key: "FOUNDATION",
    label: "Foundation & ground works",
    items: ["Scheduled site visit", "Photograph current build stage"],
  },
  {
    key: "STRUCTURE",
    label: "Structure & blockwork",
    items: ["Verify materials on site", "Record contractor observations"],
  },
  {
    key: "ROOF_FINISH",
    label: "Roofing & finishing",
    items: ["Capture site video", "Note progress vs. schedule", "Identify exceptions"],
  },
];
