import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  CaseStatus,
  ServiceType,
  casePriorityValidator,
  caseTierValidator,
  serviceTypeValidator,
  timelineValidator,
} from "./schema";

// ---------------------------------------------------------------------------
// Deterministic state machine (PRD 5.2 / Non-Negotiable #9)
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "ON_HOLD"],
  UNDER_REVIEW: ["QUOTED", "ON_HOLD", "CLOSED"],
  QUOTED: ["AWAITING_PAYMENT", "ON_HOLD"],
  AWAITING_PAYMENT: ["SCHEDULED", "ON_HOLD"],
  SCHEDULED: ["ASSIGNED", "ON_HOLD"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD"],
  IN_PROGRESS: ["EVIDENCE_SUBMITTED", "ON_HOLD"],
  EVIDENCE_SUBMITTED: ["QUALITY_CONTROL", "ON_HOLD"],
  QUALITY_CONTROL: ["CUSTOMER_REVIEW", "ADDITIONAL_WORK", "ON_HOLD"],
  CUSTOMER_REVIEW: ["APPROVED", "ADDITIONAL_WORK"],
  ADDITIONAL_WORK: ["IN_PROGRESS", "ON_HOLD"],
  APPROVED: ["COMPLETED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
  ON_HOLD: [],
};

// ---------------------------------------------------------------------------
// Service catalogue (PRD Section 6)
// ---------------------------------------------------------------------------

export const SERVICE_META: Record<
  ServiceType,
  {
    label: string;
    tagline: string;
    baseFee: number;
    checklist: string[];
    slaHours: number;
  }
> = {
  PROPERTY_INSPECTION: {
    label: "Property Inspection & Verification",
    tagline: "Found a land or property? Go and check it.",
    baseFee: 85000,
    slaHours: 72,
    checklist: [
      "Confirm physical location",
      "Photograph entrance / access road",
      "Photograph surrounding development",
      "Photograph the property",
      "Capture site video",
      "Record observations",
      "Collect available documents",
      "Identify exceptions",
    ],
  },
  CONSTRUCTION_SUPERVISION: {
    label: "Construction / Project Supervision",
    tagline: "You're building in Nigeria — we watch the site.",
    baseFee: 125000,
    slaHours: 72,
    checklist: [
      "Scheduled site visit",
      "Photograph current build stage",
      "Verify materials on site",
      "Record contractor observations",
      "Capture site video",
      "Note progress vs. schedule",
      "Identify exceptions",
    ],
  },
  ASSET_INSPECTION: {
    label: "Asset / Project Inspection",
    tagline: "House, farm, equipment — we check it for you.",
    baseFee: 60000,
    slaHours: 72,
    checklist: [
      "Confirm asset presence",
      "Photograph asset condition",
      "Capture video walkthrough",
      "Record observations",
      "Collect available documents",
      "Identify exceptions",
    ],
  },
  FAMILY_SUPPORT: {
    label: "Family Support Errands",
    tagline: "Help for the family back home.",
    baseFee: 45000,
    slaHours: 48,
    checklist: [
      "Confirm beneficiary contact",
      "Complete errand per instructions",
      "Capture evidence of completion",
      "Record observations",
      "Identify exceptions",
    ],
  },
  PROCUREMENT: {
    label: "Procurement & Delivery",
    tagline: "Buy it there, deliver it, prove it.",
    baseFee: 30000,
    slaHours: 72,
    checklist: [
      "Confirm item & vendor",
      "Verify purchase receipt",
      "Photograph item",
      "Arrange delivery",
      "Confirm delivery",
      "Identify exceptions",
    ],
  },
  BUSINESS_VERIFICATION: {
    label: "Business Verification",
    tagline: "Check that business actually exists.",
    baseFee: 90000,
    slaHours: 72,
    checklist: [
      "Confirm business location",
      "Verify CAC / registration docs",
      "Photograph premises",
      "Record observations",
      "Identify exceptions",
    ],
  },
  INVESTMENT_SUPPORT: {
    label: "Investment Support",
    tagline: "Eyes on the ground for your investment.",
    baseFee: 100000,
    slaHours: 72,
    checklist: [
      "Confirm asset location",
      "Inspect condition",
      "Photograph & video evidence",
      "Record observations",
      "Identify exceptions",
    ],
  },
  BEREAVEMENT_SUPPORT: {
    label: "Bereavement & Funeral Logistics",
    tagline: "We handle the hardest day with care.",
    baseFee: 150000,
    slaHours: 24,
    checklist: [
      "Coordinate with family contact",
      "Verify mortuary / venue",
      "Coordinate permits & vendors",
      "Photograph arrangements",
      "Record observations",
    ],
  },
};

const SLA_HOURS: Record<string, number> = {
  STANDARD: 72,
  PRIORITY: 48,
  URGENT: 24,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

export async function nextCaseNumber(ctx: any): Promise<string> {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q: any) => q.eq("name", "cases"))
    .first();
  const next = (counter?.value ?? 0) + 1;
  if (counter) {
    await ctx.db.patch(counter._id, { value: next });
  } else {
    await ctx.db.insert("counters", { name: "cases", value: next });
  }
  return `ASJ-${String(next).padStart(6, "0")}`;
}

async function transitionCase(
  ctx: any,
  caseId: string,
  to: CaseStatus,
  reason?: string,
  actorName = "ASOJU Team",
) {
  const kase = await ctx.db.get(caseId);
  if (!kase) throw new Error("Case not found");
  const allowed = TRANSITIONS[kase.status as CaseStatus];
  if (!allowed?.includes(to)) {
    throw new Error(
      `Invalid transition ${kase.status} → ${to} (Non-Negotiable #9: only the workflow engine moves cases)`,
    );
  }
  const now = Date.now();
  await ctx.db.patch(caseId, {
    status: to,
    updatedAt: now,
    ...(to === "ON_HOLD" ? { heldFromStatus: kase.status } : {}),
    ...(kase.heldFromStatus && to !== "ON_HOLD"
      ? { heldFromStatus: undefined }
      : {}),
  });
  await ctx.db.insert("caseStatusHistory", {
    caseId,
    fromStatus: kase.status as CaseStatus,
    toStatus: to,
    reason,
    actorName,
    createdAt: now,
  });
  return ctx.db.get(caseId);
}

async function notify(ctx: any, userId: string, title: string, body: string, caseId?: string) {
  await ctx.db.insert("notifications", {
    userId,
    title,
    body,
    caseId,
    createdAt: Date.now(),
  });
}

function leadScore(
  serviceType: ServiceType,
  timeline: string,
  description: string,
): { score: number; tag: "HOT" | "WARM" | "COLD" } {
  // PRD 7.4 — deterministic, auditable, not an LLM call
  let score = 0;
  if (timeline === "immediate") score += 30;
  else if (timeline === "near_term") score += 18;
  else score += 5;
  // value fit — property/investment/construction imply higher value
  if (
    serviceType === "PROPERTY_INSPECTION" ||
    serviceType === "CONSTRUCTION_SUPERVISION" ||
    serviceType === "INVESTMENT_SUPPORT" ||
    serviceType === "BUSINESS_VERIFICATION"
  ) {
    score += 35;
  } else {
    score += 20;
  }
  score += 20; // payment method: cash_ready
  score += 15; // engagement subscore (demo: complete intake = engaged)
  const tag = score >= 75 ? "HOT" : score >= 45 ? "WARM" : "COLD";
  return { score, tag };
}

// ---------------------------------------------------------------------------
// Intake — the AI Concierge front door (PRD 5.2 / 7)
// ---------------------------------------------------------------------------

export const createServiceRequest = mutation({
  args: {
    serviceType: serviceTypeValidator,
    description: v.string(),
    location: v.string(),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    timeline: timelineValidator,
    priority: casePriorityValidator,
    tier: caseTierValidator,
    // Optional — set when the request came through the AI Concierge so the
    // handoff is visible in the case thread.
    conciergeSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const now = Date.now();
    const { score, tag } = leadScore(args.serviceType, args.timeline, args.description);

    // Request → Case: deterministic triage converts the request into a case
    // (vertical slice 1 — a real conversation becomes a structured case).
    const caseNumber = await nextCaseNumber(ctx);
    const slaHours =
      args.priority === "URGENT"
        ? SLA_HOURS.URGENT
        : args.priority === "PRIORITY"
          ? SLA_HOURS.PRIORITY
          : SERVICE_META[args.serviceType].slaHours;

    const caseId = await ctx.db.insert("cases", {
      userId,
      caseNumber,
      serviceType: args.serviceType,
      description: args.description,
      location: args.location,
      city: args.city,
      state: args.state,
      priority: args.priority,
      riskLevel: args.serviceType === "BEREAVEMENT_SUPPORT" ? 4 : args.serviceType === "PROPERTY_INSPECTION" ? 3 : 2,
      tier: args.tier,
      status: "SUBMITTED",
      paymentStatus: "PENDING",
      slaTargetAt: now + slaHours * 3600_000,
      nextAction: "Triage and confirm scope",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("serviceRequests", {
      userId,
      serviceType: args.serviceType,
      rawDescription: args.description,
      location: args.location,
      channel: "web",
      leadScore: score,
      leadTag: tag,
      timeline: args.timeline,
      convertedCaseId: caseId,
      createdAt: now,
    });

    await ctx.db.insert("caseStatusHistory", {
      caseId,
      toStatus: "SUBMITTED",
      reason: "Request received via the ASOJU Concierge",
      actorName: "ASOJU Concierge",
      createdAt: now,
    });

    await notify(
      ctx,
      userId,
      "Request received",
      `We've received your ${SERVICE_META[args.serviceType].label} request (${caseNumber}). Our team will triage it shortly.`,
      caseId,
    );

    if (args.conciergeSummary) {
      await ctx.db.insert("messages", {
        caseId,
        senderName: "ASOJU Concierge",
        senderRole: "asoju-team",
        body: args.conciergeSummary,
        createdAt: now,
      });
    }

    return { caseId, caseNumber, leadTag: tag, leadScore: score };
  },
});

/** SUBMITTED → UNDER_REVIEW — the Concierge confirms the captured scope. */
export const triageCase = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("Case not found");
    if (kase.status !== "SUBMITTED") throw new Error("Case is not waiting for triage");
    await transitionCase(
      ctx,
      args.caseId,
      "UNDER_REVIEW",
      "Triage complete — scope confirmed by AI Concierge",
      "ASOJU Concierge",
    );
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Quotes (PRD P0 Quote Line Categories)
// ---------------------------------------------------------------------------

export function buildQuoteLines(
  serviceType: ServiceType,
  tier: string,
  city?: string,
) {
  const baseFee = SERVICE_META[serviceType].baseFee;
  const lines: {
    category: "ASOJU_SERVICE_FEE" | "EXTERNAL_COST" | "THIRD_PARTY_PROFESSIONAL" | "TAX_STATUTORY";
    label: string;
    amount: number;
  }[] = [];
  // Pricing model: transport & logistics are covered out of the ASOJU service
  // fee — there is deliberately no separate transport line item.
  lines.push({
    category: "ASOJU_SERVICE_FEE",
    label: `${SERVICE_META[serviceType].label} — service fee (includes representative transport & logistics)`,
    amount: baseFee,
  });
  if (serviceType === "CONSTRUCTION_SUPERVISION") {
    lines.push({
      category: "THIRD_PARTY_PROFESSIONAL",
      label: "Civil engineer site review",
      amount: 35000,
    });
  }
  // External (non-service) costs stay itemized and are never hidden inside ASOJU fees
  const baseAmount = lines
    .filter((l) => l.category === "ASOJU_SERVICE_FEE")
    .reduce((s, l) => s + l.amount, 0);
  const nonServiceFeeAmount = lines
    .filter((l) => l.category !== "ASOJU_SERVICE_FEE")
    .reduce((s, l) => s + l.amount, 0);
  const tax = Math.round(baseAmount * 0.075); // 7.5% VAT on service fee only
  lines.push({
    category: "TAX_STATUTORY",
    label: "VAT (7.5%) on ASOJU service fee",
    amount: tax,
  });
  const discountPercent = tier === "CONCIERGE" ? 15 : 0;
  const discountAmount = Math.round((baseAmount * discountPercent) / 100);
  const amount = baseAmount + nonServiceFeeAmount + tax - discountAmount;
  return { lines, baseAmount, nonServiceFeeAmount, discountAmount, amount, discountPercent };
}

export const issueQuote = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    const user = await ctx.db.get(userId);
    const isAdmin = user?.role === "admin";
    // Owners accept; admins/team may issue a quote on any case.
    if (!kase || (kase.userId !== userId && !isAdmin)) throw new Error("Case not found");

    const { lines, baseAmount, nonServiceFeeAmount, discountAmount, amount, discountPercent } =
      buildQuoteLines(kase.serviceType, kase.tier, kase.city);

    const quoteId = await ctx.db.insert("quotes", {
      caseId: args.caseId,
      userId: kase.userId, // commercial records stay owned by the customer
      currency: "NGN",
      amount,
      baseAmount,
      nonServiceFeeAmount,
      discountAmount,
      discountLabel:
        discountPercent > 0 ? `Concierge membership (${discountPercent}%)` : undefined,
      lines,
      expiresAt: Date.now() + 7 * 24 * 3600_000, // QUOTE_VALIDITY_HOURS — 7 days
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.caseId, { quoteId, updatedAt: Date.now() });
    await transitionCase(ctx, args.caseId, "QUOTED", "Quote prepared and sent to customer", "ASOJU Team");
    await notify(
      ctx,
      kase.userId,
      "Your quote is ready",
      `A quote of ₦${amount.toLocaleString()} is ready for your review. It's valid for 7 days.`,
      args.caseId,
    );
    return { quoteId };
  },
});

export const acceptQuote = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("Case not found");
    if (!kase.quoteId) throw new Error("No quote on this case");
    const quote = await ctx.db.get(kase.quoteId);
    if (!quote) throw new Error("Quote not found");
    if (quote.expiresAt < Date.now()) throw new Error("This quote has expired");
    if (quote.acceptedAt) throw new Error("Quote already accepted");

    await ctx.db.patch(kase.quoteId, { acceptedAt: Date.now() });
    const invoiceId = await ctx.db.insert("invoices", {
      caseId: args.caseId,
      userId,
      quoteId: kase.quoteId,
      amount: quote.amount,
      currency: "NGN",
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.caseId, { invoiceId, updatedAt: Date.now() });
    await transitionCase(ctx, args.caseId, "AWAITING_PAYMENT", "Customer accepted the quote", "You");
    return { invoiceId };
  },
});

export const payInvoice = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("Case not found");
    if (!kase.invoiceId) throw new Error("No invoice on this case");
    const invoice = await ctx.db.get(kase.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Demo: simulates the payment provider's verified webhook (Non-Negotiable
    // #4 — status only ever driven by the provider, never a screenshot).
    const ref = `PSK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    await ctx.db.insert("payments", {
      caseId: args.caseId,
      userId,
      invoiceId: kase.invoiceId,
      amount: invoice.amount,
      currency: "NGN",
      provider: "paystack",
      providerReference: ref,
      status: "PAID",
      paidAt: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.caseId, { paymentStatus: "PAID", updatedAt: Date.now() });
    await transitionCase(ctx, args.caseId, "SCHEDULED", "Payment confirmed via provider webhook", "Paystack");
    await notify(
      ctx,
      userId,
      "Payment confirmed",
      `Payment of ₦${invoice.amount.toLocaleString()} received. We're scheduling your representative.`,
      args.caseId,
    );

    // Hand off to case management: notify admins (case managers) that the case
    // is paid and ready to schedule, and note it in the case thread.
    const admins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
    for (const admin of admins) {
      await notify(
        ctx,
        admin._id,
        "Payment confirmed — case ready for scheduling",
        `${kase.caseNumber} (${SERVICE_META[kase.serviceType as ServiceType].label}) · ₦${invoice.amount.toLocaleString()} paid. Hand off to a case manager to schedule the representative.`,
        args.caseId,
      );
    }
    await ctx.db.insert("messages", {
      caseId: args.caseId,
      senderName: "ASOJU System",
      senderRole: "asoju-team",
      body: `Payment of ₦${invoice.amount.toLocaleString()} confirmed (${ref}). Handed off to the case manager for scheduling.`,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.caseId, {
      nextAction: "Case manager to schedule representative",
      updatedAt: Date.now(),
    });
    return { reference: ref };
  },
});

// ---------------------------------------------------------------------------
// Evidence & reports
// ---------------------------------------------------------------------------

const MEDIA: Record<string, string> = {
  property: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80",
  property2: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80",
  road: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=900&q=80",
  construction: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80",
  construction2: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=900&q=80",
  land: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  farm: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=900&q=80",
  warehouse: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80",
};

type EvidenceInput = {
  type: "PHOTO" | "VIDEO" | "DOCUMENT" | "NOTE";
  title: string;
  description: string;
  mediaUrl?: string;
};

type EvidenceRow = EvidenceInput & {
  caseId: Id<"cases">;
  userId: string;
  trustLabel: "ASOJU_VERIFIED";
  evidenceLevel: "OBSERVED";
  reviewStatus: "APPROVED";
  capturedAt: number;
};

export function evidenceForService(
  serviceType: ServiceType,
  caseId: Id<"cases">,
  userId: string,
  when: number,
): EvidenceRow[] {
  const rows: EvidenceInput[] = [];
  switch (serviceType) {
    case "PROPERTY_INSPECTION":
      rows.push(
        { type: "PHOTO", title: "Property — front elevation", description: "Observed condition of the building frontage.", mediaUrl: MEDIA.property },
        { type: "PHOTO", title: "Surrounding development", description: "Adjacent plots and built-up areas within view.", mediaUrl: MEDIA.property2 },
        { type: "PHOTO", title: "Access road", description: "Road condition at the entrance to the plot.", mediaUrl: MEDIA.road },
        { type: "NOTE", title: "Site observations", description: "Plot is fenced with a 6ft wall, gate locked. No visible encroachment. Neighbouring plot under construction." },
      );
      break;
    case "CONSTRUCTION_SUPERVISION":
      rows.push(
        { type: "PHOTO", title: "Site — current stage", description: "Ground floor columns cast; deck formwork in progress.", mediaUrl: MEDIA.construction },
        { type: "PHOTO", title: "Materials on site", description: "Cement, rods and blocks verified on site.", mediaUrl: MEDIA.construction2 },
        { type: "NOTE", title: "Contractor observations", description: "Work progressing per schedule. Concrete mix ratio observed as specified." },
      );
      break;
    case "ASSET_INSPECTION":
    case "INVESTMENT_SUPPORT":
      rows.push(
        { type: "PHOTO", title: "Asset condition", description: "Current physical state of the asset.", mediaUrl: MEDIA.farm },
        { type: "PHOTO", title: "Site surroundings", description: "Access and boundary conditions.", mediaUrl: MEDIA.land },
        { type: "NOTE", title: "Observations", description: "Asset present and in the condition described by the customer. Minor wear consistent with age." },
      );
      break;
    default:
      rows.push(
        { type: "PHOTO", title: "Field evidence", description: "Captured on site by the ASOJU representative.", mediaUrl: MEDIA.warehouse },
        { type: "NOTE", title: "Observations", description: "Task completed per instructions; no exceptions noted." },
      );
  }
  return rows.map((r, i) => ({
    ...r,
    caseId,
    userId,
    trustLabel: "ASOJU_VERIFIED",
    evidenceLevel: "OBSERVED",
    reviewStatus: "APPROVED",
    capturedAt: when + i * 3600_000,
  }));
}

export function reportForService(serviceType: ServiceType, description: string) {
  const base = {
    PROPERTY_INSPECTION: {
      summary:
        "Our representative physically inspected the property and its surroundings. Location confirmed, condition documented, and all observations recorded with photo evidence. No third-party documents were presented on site.",
      findings: [
        { label: "Location", detail: "Property located and GPS-confirmed at the stated address." },
        { label: "Physical condition", detail: "Structure in good condition; fenced, gated, no visible encroachment." },
        { label: "Access road", detail: "Motorable laterite road; accessible by car in dry weather." },
        { label: "Documents", detail: "None presented on site — title verification requires a licensed professional." },
      ],
    },
    CONSTRUCTION_SUPERVISION: {
      summary:
        "Scheduled site visit completed. Construction is progressing per schedule; materials verified on site and current build stage documented with photo and video evidence.",
      findings: [
        { label: "Progress", detail: "Ground floor columns cast; deck formwork in progress — on schedule." },
        { label: "Materials", detail: "Cement, reinforcement rods and blocks verified on site." },
        { label: "Workmanship", detail: "Concrete mix and formwork observed as per specification." },
        { label: "Exceptions", detail: "None noted at this visit." },
      ],
    },
    ASSET_INSPECTION: {
      summary:
        "Asset inspected on site. Present and in the condition described; physical state documented with photo evidence and observations recorded.",
      findings: [
        { label: "Presence", detail: "Asset confirmed present at the stated location." },
        { label: "Condition", detail: "Consistent with description; minor wear consistent with age." },
        { label: "Access", detail: "Site accessible; no access issues encountered." },
        { label: "Exceptions", detail: "None noted." },
      ],
    },
    BEREAVEMENT_SUPPORT: {
      summary:
        "Arrangements coordinated with the family contact. Vendors and venue confirmed; logistics in motion with sensitive handling.",
      findings: [
        { label: "Family contact", detail: "Coordinated directly with the named family contact." },
        { label: "Vendors", detail: "Mortuary and venue arrangements confirmed." },
        { label: "Permits", detail: "Required permits being processed." },
        { label: "Status", detail: "Chain moving; next update at the agreed checkpoint." },
      ],
    },
  };
  const meta = base[serviceType as keyof typeof base] ?? base.ASSET_INSPECTION;
  return {
    summary: meta.summary,
    findings: meta.findings.map((f) => ({ label: f.label, detail: f.detail })),
    confidence: [
      { label: "Identity", state: "Complete" },
      { label: "Physical inspection", state: "Complete" },
      { label: "Documents", state: "Partial" },
      { label: "Professional review", state: "Pending" },
      { label: "Outstanding issues", state: "0" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Demo engine — simulates the ASOJU team walking a case through the golden path
// ---------------------------------------------------------------------------

/** Shared golden-path simulation used by the owner (demoAdvance) and by
 *  admins from the Team view (teamAdvanceCase). */
async function runTeamDemoStep(
  ctx: MutationCtx,
  caseId: Id<"cases">,
  evidenceOwnerId: string,
): Promise<{ ok: boolean; quoteId?: string }> {
  const kase = await ctx.db.get(caseId);
  if (!kase) throw new Error("Case not found");
  const now = Date.now();

  switch (kase.status) {
    case "SUBMITTED":
      await transitionCase(ctx, caseId, "UNDER_REVIEW", "Triage complete — scope confirmed", "ASOJU Team");
      break;
    case "UNDER_REVIEW": {
      const res = await ctx.runMutation(api.cases.issueQuote, { caseId });
      return { ok: true, quoteId: res.quoteId };
    }
    case "SCHEDULED":
      await ctx.db.patch(caseId, {
        assignedAgentName: "Kelechi Okafor",
        assignedAgentPhone: "+234 801 234 5678",
        scheduledFor: now + 2 * 24 * 3600_000,
        nextAction: "Agent to visit site and complete checklist",
        updatedAt: now,
      });
      await transitionCase(ctx, caseId, "ASSIGNED", "Representative assigned to the case", "ASOJU Team");
      break;
    case "ASSIGNED":
      await transitionCase(ctx, caseId, "IN_PROGRESS", "Representative checked in on site", "Kelechi Okafor");
      await ctx.db.insert("messages", {
        caseId,
        senderName: "Kelechi Okafor",
        senderRole: "asoju-team",
        body: "Hi! I've arrived at the site and am starting the inspection now. I'll upload photos and observations as I go.",
        createdAt: now,
      });
      break;
    case "IN_PROGRESS":
      for (const ev of evidenceForService(kase.serviceType, caseId, evidenceOwnerId, now)) {
        await ctx.db.insert("evidence", ev);
      }
      await transitionCase(ctx, caseId, "EVIDENCE_SUBMITTED", "Checklist completed, evidence captured", "Kelechi Okafor");
      break;
    case "EVIDENCE_SUBMITTED":
      await transitionCase(ctx, caseId, "QUALITY_CONTROL", "Evidence package under QC review", "ASOJU Team");
      break;
    case "QUALITY_CONTROL": {
      const report = reportForService(kase.serviceType, kase.description);
      const reportId = await ctx.db.insert("reports", {
        caseId,
        userId: kase.userId,
        summary: report.summary,
        findings: report.findings,
        confidence: report.confidence,
        qcOutcome: "APPROVED",
        deliveredAt: now,
        createdAt: now,
      });
      await ctx.db.patch(caseId, { reportId, updatedAt: now });
      await transitionCase(ctx, caseId, "CUSTOMER_REVIEW", "Report delivered — awaiting customer approval", "ASOJU Team");
      await notify(
        ctx,
        kase.userId,
        "Your report is ready",
        `The report for ${kase.caseNumber} is ready for your review. Please approve or request changes.`,
        caseId,
      );
      break;
    }
    case "APPROVED":
      await transitionCase(ctx, caseId, "COMPLETED", "Case completed", "ASOJU Team");
      break;
    case "COMPLETED":
      await transitionCase(ctx, caseId, "CLOSED", "Case closed", "ASOJU Team");
      break;
    default:
      throw new Error("No demo team action available for this state");
  }
  return { ok: true };
}

export const demoAdvance = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args): Promise<{ ok: boolean; quoteId?: string }> => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("Case not found");
    return runTeamDemoStep(ctx, args.caseId, userId);
  },
});

export const teamAdvanceCase = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args): Promise<{ ok: boolean; quoteId?: string }> => {
    const userId = await getAuthUser(ctx);
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Admin access required");
    const kase = await ctx.db.get(args.caseId);
    if (!kase) throw new Error("Case not found");
    return runTeamDemoStep(ctx, args.caseId, kase.userId);
  },
});

// ---------------------------------------------------------------------------
// Customer actions
// ---------------------------------------------------------------------------

export const approveReport = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("Case not found");
    await transitionCase(ctx, args.caseId, "APPROVED", "Customer approved the report", "You");
    return { ok: true };
  },
});

export const requestAdditionalWork = mutation({
  args: { caseId: v.id("cases"), reason: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("Case not found");
    await transitionCase(ctx, args.caseId, "ADDITIONAL_WORK", args.reason, "You");
    return { ok: true };
  },
});

export const holdCase = mutation({
  args: { caseId: v.id("cases"), reason: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("Case not found");
    await transitionCase(ctx, args.caseId, "ON_HOLD", args.reason, "You");
    return { ok: true };
  },
});

export const resumeCase = mutation({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("Case not found");
    if (kase.status !== "ON_HOLD" || !kase.heldFromStatus) throw new Error("Case is not on hold");
    await transitionCase(ctx, args.caseId, kase.heldFromStatus, "Hold lifted", "You");
    return { ok: true };
  },
});

export const sendMessage = mutation({
  args: { caseId: v.id("cases"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("Case not found");
    const user = await ctx.db.get(userId);
    const name = user?.name ?? "You";
    await ctx.db.insert("messages", {
      caseId: args.caseId,
      senderId: userId,
      senderName: name,
      senderRole: "customer",
      body: args.body,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Queries — case-scoped access only (Non-Negotiable #6)
// ---------------------------------------------------------------------------

export const listCases = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return cases.map((k) => ({
      ...k,
      serviceLabel: SERVICE_META[k.serviceType as ServiceType].label,
    }));
  },
});

async function fetchCaseDetail(ctx: QueryCtx, caseId: Id<"cases">) {
  const kase = await ctx.db.get(caseId);
  if (!kase) throw new Error("Case not found");
  const [history, quote, invoice, payments, evidence, report, messages] =
    await Promise.all([
      ctx.db
        .query("caseStatusHistory")
        .withIndex("by_case", (q) => q.eq("caseId", caseId))
        .order("asc")
        .collect(),
      kase.quoteId ? ctx.db.get(kase.quoteId) : null,
      kase.invoiceId ? ctx.db.get(kase.invoiceId) : null,
      ctx.db
        .query("payments")
        .withIndex("by_case", (q) => q.eq("caseId", caseId))
        .collect(),
      ctx.db
        .query("evidence")
        .withIndex("by_case", (q) => q.eq("caseId", caseId))
        .order("asc")
        .collect(),
      kase.reportId ? ctx.db.get(kase.reportId) : null,
      ctx.db
        .query("messages")
        .withIndex("by_case", (q) => q.eq("caseId", caseId))
        .order("asc")
        .collect(),
    ]);
  return {
    ...kase,
    serviceLabel: SERVICE_META[kase.serviceType as ServiceType].label,
    checklist: SERVICE_META[kase.serviceType as ServiceType].checklist,
    history,
    quote,
    invoice,
    payments,
    evidence,
    report,
    messages,
  };
}

export const getCase = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) {
      // Non-Negotiable #6 — role/case scoping: even the owner check is explicit
      throw new Error("You don't have access to this case");
    }
    return fetchCaseDetail(ctx, args.caseId);
  },
});

/** Team (admin) view of a single customer's case — read + team actions. */
export const teamGetCase = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Admin access required");
    const kase = await ctx.db.get(args.caseId);
    if (!kase) throw new Error("Case not found");
    const detail = await fetchCaseDetail(ctx, args.caseId);
    const customer = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", kase.userId))
      .first();
    const owner = await ctx.db.get(kase.userId as Id<"users">);
    return {
      ...detail,
      customer: {
        fullName: customer?.fullName ?? "Customer",
        email: owner?.email ?? undefined,
        country: customer?.countryOfResidence ?? undefined,
        phone: customer?.phone ?? undefined,
      },
    };
  },
});

/** Team (admin) board — every customer's case plus headline stats. */
export const teamGetCases = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Admin access required");

    const cases = await ctx.db.query("cases").order("desc").collect();
    const now = Date.now();
    const terminal = ["COMPLETED", "CLOSED", "APPROVED"];

    let grossValue = 0;
    for (const k of cases) {
      if (k.paymentStatus === "PAID" && k.invoiceId) {
        const inv = await ctx.db.get(k.invoiceId);
        if (inv) grossValue += inv.amount;
      }
    }

    const owners = [...new Set(cases.map((k) => k.userId))];
    const nameByOwner: Record<string, string> = {};
    for (const oid of owners) {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", oid))
        .first();
      nameByOwner[oid] = p?.fullName ?? "Customer";
    }

    const stats = {
      total: cases.length,
      active: cases.filter(
        (k) => !terminal.includes(k.status as string) && k.status !== "ON_HOLD",
      ).length,
      awaitingAction: cases.filter((k) =>
        ["QUOTED", "AWAITING_PAYMENT", "CUSTOMER_REVIEW"].includes(k.status as string),
      ).length,
      overdue: cases.filter(
        (k) =>
          k.slaTargetAt &&
          k.slaTargetAt < now &&
          !terminal.includes(k.status as string) &&
          k.status !== "ON_HOLD",
      ).length,
      completed: cases.filter((k) => terminal.includes(k.status as string)).length,
      grossValue,
    };

    return {
      stats,
      cases: cases.map((k) => ({
        ...k,
        serviceLabel: SERVICE_META[k.serviceType as ServiceType].label,
        customerName: nameByOwner[k.userId] ?? "Customer",
      })),
    };
  },
});

/** Team (admin) conversation — replies from the ASOJU team side. */
export const teamSendMessage = mutation({
  args: { caseId: v.id("cases"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUser(ctx);
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Admin access required");
    const kase = await ctx.db.get(args.caseId);
    if (!kase) throw new Error("Case not found");
    await ctx.db.insert("messages", {
      caseId: args.caseId,
      senderId: userId,
      senderName: user.name ?? "ASOJU Team",
      senderRole: "asoju-team",
      body: args.body,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const getDashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const [cases, profile, notifications] = await Promise.all([
      ctx.db
        .query("cases")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
      ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
    ]);
    const activeCases = cases.filter((k) =>
      !["COMPLETED", "CLOSED", "APPROVED"].includes(k.status as string),
    );
    const actionRequired = cases.filter((k) =>
      ["QUOTED", "AWAITING_PAYMENT", "CUSTOMER_REVIEW"].includes(k.status as string),
    );
    const completedCount = cases.filter((k) =>
      ["COMPLETED", "CLOSED", "APPROVED"].includes(k.status as string),
    ).length;
    let totalSpend = 0;
    for (const k of cases) {
      if (k.paymentStatus !== "PAID" || !k.invoiceId) continue;
      const invoice = await ctx.db.get(k.invoiceId);
      if (invoice) totalSpend += invoice.amount;
    }
    const unread = notifications.filter((n) => !n.readAt).length;
    return {
      cases,
      activeCases,
      actionRequired,
      completedCount,
      totalSpend,
      unread,
      profile,
      notifications: notifications.slice(0, 8),
    };
  },
});

export const getChecklist = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("No access");
    const evidence = await ctx.db
      .query("evidence")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    const done = new Set(evidence.map((e) => e.title.toLowerCase().split(" ")[0]));
    return SERVICE_META[kase.serviceType as ServiceType].checklist.map((item) => ({
      label: item,
      done: done.has(item.toLowerCase().split(" ")[0]),
    }));
  },
});
