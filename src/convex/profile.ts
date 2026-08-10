import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  buildQuoteLines,
  evidenceForService,
  nextCaseNumber,
  reportForService,
  SERVICE_META,
} from "./cases";
import { ServiceType } from "./schema";

// ---------------------------------------------------------------------------
// Onboarding — progressive disclosure (PRD 5.1) + demo portfolio seed
// ---------------------------------------------------------------------------

/**
 * Called on first dashboard visit. Creates the customer profile if missing and,
 * the very first time, seeds a realistic demo portfolio so the golden path
 * (request → case → quote → payment → evidence → report) is visible end-to-end.
 * The demo cases are owned by this user and fully interactive.
 */
export const ensureOnboarded = mutation({
  args: { fullName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const now = Date.now();

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const user = await ctx.db.get(userId);
    const emailName = user?.email?.split("@")[0] ?? "";
    const fallback = emailName
      ? emailName.charAt(0).toUpperCase() + emailName.slice(1)
      : "Friend";

    if (!existing) {
      await ctx.db.insert("profiles", {
        userId,
        fullName: args.fullName || fallback,
        countryOfResidence: "United Kingdom",
        preferredChannel: "whatsapp",
        onboarded: false,
        onboardedAt: now,
        updatedAt: now,
      });
    }

    // Seed demo portfolio only once — detect via any existing case
    const existingCases = await ctx.db
      .query("cases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existingCases.length > 0) {
      return { seeded: false };
    }

    await seedDemoPortfolio(ctx, userId, now);
    return { seeded: true };
  },
});

async function seedDemoPortfolio(ctx: any, userId: string, now: number) {
  // 1. Property inspection — QUOTED, waiting for customer to accept
  const case1 = await insertSeededCase(ctx, userId, now, {
    serviceType: "PROPERTY_INSPECTION",
    description:
      "I found a piece of land in Ibeju-Lekki for sale and I'm not sure whether it's genuine. Please go and check it — confirm the location, condition and surroundings.",
    location: "Ibeju-Lekki, Lagos",
    city: "Ibeju-Lekki",
    state: "Lagos",
    priority: "PRIORITY",
    riskLevel: 3,
    tier: "ESSENTIAL",
    status: "QUOTED",
    nextAction: "Customer to review the quote",
    nextActionDueAt: now + 7 * 24 * 3600_000,
    ageDays: 2,
  });
  const quote1 = buildQuoteLines("PROPERTY_INSPECTION", "ESSENTIAL", "Ibeju-Lekki");
  const quoteId1 = await ctx.db.insert("quotes", {
    caseId: case1,
    userId,
    currency: "NGN",
    amount: quote1.amount,
    baseAmount: quote1.baseAmount,
    nonServiceFeeAmount: quote1.nonServiceFeeAmount,
    discountAmount: quote1.discountAmount,
    discountLabel: quote1.discountPercent > 0 ? `Concierge membership (${quote1.discountPercent}%)` : undefined,
    lines: quote1.lines,
    expiresAt: now + 7 * 24 * 3600_000,
    createdAt: now - 2 * 24 * 3600_000,
  });
  await ctx.db.patch(case1, { quoteId: quoteId1, updatedAt: now });
  await seedHistory(ctx, case1, [
    { from: "SUBMITTED", to: "UNDER_REVIEW", at: now - 2 * 24 * 3600_000, actor: "ASOJU Concierge" },
    { from: "UNDER_REVIEW", to: "QUOTED", at: now - 2 * 24 * 3600_000, actor: "ASOJU Team" },
  ]);

  // 2. Construction supervision — IN_PROGRESS with evidence captured
  const case2 = await insertSeededCase(ctx, userId, now, {
    serviceType: "CONSTRUCTION_SUPERVISION",
    description:
      "I'm building a 4-bedroom duplex in Ajah and I need someone to monitor the project. Contractors claim they're on schedule — I want proof.",
    location: "Ajah, Lagos",
    city: "Ajah",
    state: "Lagos",
    priority: "URGENT",
    riskLevel: 2,
    tier: "CONCIERGE",
    status: "IN_PROGRESS",
    assignedAgentName: "Kelechi Okafor",
    scheduledFor: now + 1 * 24 * 3600_000,
    nextAction: "Site visit in progress — evidence capture",
    nextActionDueAt: now + 1 * 24 * 3600_000,
    ageDays: 5,
  });
  for (const ev of evidenceForService("CONSTRUCTION_SUPERVISION", case2, userId, now - 4 * 3600_000)) {
    await ctx.db.insert("evidence", ev);
  }
  await seedHistory(ctx, case2, [
    { from: "SUBMITTED", to: "UNDER_REVIEW", at: now - 5 * 24 * 3600_000, actor: "ASOJU Concierge" },
    { from: "UNDER_REVIEW", to: "QUOTED", at: now - 5 * 24 * 3600_000, actor: "ASOJU Team" },
    { from: "QUOTED", to: "AWAITING_PAYMENT", at: now - 4 * 24 * 3600_000, actor: "You" },
    { from: "AWAITING_PAYMENT", to: "SCHEDULED", at: now - 4 * 24 * 3600_000, actor: "Paystack" },
    { from: "SCHEDULED", to: "ASSIGNED", at: now - 3 * 24 * 3600_000, actor: "ASOJU Team" },
    { from: "ASSIGNED", to: "IN_PROGRESS", at: now - 4 * 3600_000, actor: "Kelechi Okafor" },
  ]);
  await ctx.db.insert("messages", {
    caseId: case2,
    senderName: "Kelechi Okafor",
    senderRole: "asoju-team",
    body: "Good afternoon! I'm on site now at Ajah. The deck formwork is in progress — uploading photos shortly.",
    createdAt: now - 4 * 3600_000,
  });

  // 3. Asset inspection — COMPLETED with report delivered
  const case3 = await insertSeededCase(ctx, userId, now, {
    serviceType: "ASSET_INSPECTION",
    description:
      "I rent out my farmland in Oyo to a cooperative. Please confirm the farm is still intact and crops are being maintained.",
    location: "Oyo, Oyo State",
    city: "Oyo",
    state: "Oyo",
    priority: "STANDARD",
    riskLevel: 2,
    tier: "ESSENTIAL",
    status: "COMPLETED",
    assignedAgentName: "Bisi Adeyemi",
    paymentStatus: "PAID",
    nextAction: "None — case complete",
    ageDays: 22,
  });
  const quote3 = buildQuoteLines("ASSET_INSPECTION", "ESSENTIAL", "Oyo");
  const quoteId3 = await ctx.db.insert("quotes", {
    caseId: case3,
    userId,
    currency: "NGN",
    amount: quote3.amount,
    baseAmount: quote3.baseAmount,
    nonServiceFeeAmount: quote3.nonServiceFeeAmount,
    discountAmount: quote3.discountAmount,
    lines: quote3.lines,
    expiresAt: now + 7 * 24 * 3600_000,
    createdAt: now - 21 * 24 * 3600_000,
  });
  const invoiceId3 = await ctx.db.insert("invoices", {
    caseId: case3,
    userId,
    quoteId: quoteId3,
    amount: quote3.amount,
    currency: "NGN",
    createdAt: now - 20 * 24 * 3600_000,
  });
  await ctx.db.insert("payments", {
    caseId: case3,
    userId,
    invoiceId: invoiceId3,
    amount: quote3.amount,
    currency: "NGN",
    provider: "paystack",
    providerReference: "PSK-DEMO-88231",
    status: "PAID",
    paidAt: now - 20 * 24 * 3600_000,
    createdAt: now - 20 * 24 * 3600_000,
  });
  const report3 = reportForService("ASSET_INSPECTION", case3);
  const reportId3 = await ctx.db.insert("reports", {
    caseId: case3,
    userId,
    summary: report3.summary,
    findings: report3.findings,
    confidence: report3.confidence,
    qcOutcome: "APPROVED",
    deliveredAt: now - 14 * 24 * 3600_000,
    createdAt: now - 14 * 24 * 3600_000,
  });
  await ctx.db.patch(case3, {
    quoteId: quoteId3,
    invoiceId: invoiceId3,
    reportId: reportId3,
    updatedAt: now,
  });
  for (const ev of evidenceForService("ASSET_INSPECTION", case3, userId, now - 15 * 24 * 3600_000)) {
    await ctx.db.insert("evidence", ev);
  }
  await seedHistory(ctx, case3, [
    { from: "SUBMITTED", to: "UNDER_REVIEW", at: now - 22 * 24 * 3600_000, actor: "ASOJU Concierge" },
    { from: "UNDER_REVIEW", to: "QUOTED", at: now - 21 * 24 * 3600_000, actor: "ASOJU Team" },
    { from: "QUOTED", to: "AWAITING_PAYMENT", at: now - 20 * 24 * 3600_000, actor: "You" },
    { from: "AWAITING_PAYMENT", to: "SCHEDULED", at: now - 20 * 24 * 3600_000, actor: "Paystack" },
    { from: "SCHEDULED", to: "ASSIGNED", at: now - 19 * 24 * 3600_000, actor: "ASOJU Team" },
    { from: "ASSIGNED", to: "IN_PROGRESS", at: now - 15 * 24 * 3600_000, actor: "Bisi Adeyemi" },
    { from: "IN_PROGRESS", to: "EVIDENCE_SUBMITTED", at: now - 15 * 24 * 3600_000, actor: "Bisi Adeyemi" },
    { from: "EVIDENCE_SUBMITTED", to: "QUALITY_CONTROL", at: now - 14 * 24 * 3600_000, actor: "ASOJU Team" },
    { from: "QUALITY_CONTROL", to: "CUSTOMER_REVIEW", at: now - 14 * 24 * 3600_000, actor: "ASOJU Team" },
    { from: "CUSTOMER_REVIEW", to: "APPROVED", at: now - 13 * 24 * 3600_000, actor: "You" },
    { from: "APPROVED", to: "COMPLETED", at: now - 13 * 24 * 3600_000, actor: "ASOJU Team" },
  ]);

  // Seeded properties + beneficiaries (P1)
  await ctx.db.insert("properties", {
    userId,
    address: "Lekki Phase 1, Lagos",
    city: "Lekki",
    state: "Lagos",
    description: "3-bedroom apartment — family home",
    createdAt: now - 30 * 24 * 3600_000,
  });
  await ctx.db.insert("properties", {
    userId,
    address: "Farm plot, Awe, Oyo State",
    city: "Awe",
    state: "Oyo",
    description: "2-hectare cassava farm managed by a cooperative",
    createdAt: now - 30 * 24 * 3600_000,
  });
  await ctx.db.insert("beneficiaries", {
    userId,
    fullName: "Mrs. Adaeze Okonkwo",
    relationship: "Mother",
    phone: "+234 803 555 0102",
    notes: "Lives in Enugu — family support cases",
    hasPortalAccess: false,
    createdAt: now - 30 * 24 * 3600_000,
  });
  await ctx.db.insert("beneficiaries", {
    userId,
    fullName: "Chinedu Okonkwo",
    relationship: "Brother",
    phone: "+234 805 555 0144",
    notes: "Handles on-ground coordination in Lagos",
    hasPortalAccess: false,
    createdAt: now - 30 * 24 * 3600_000,
  });
}

async function insertSeededCase(
  ctx: any,
  userId: string,
  now: number,
  data: {
    serviceType: ServiceType;
    description: string;
    location: string;
    city: string;
    state: string;
    priority: "STANDARD" | "PRIORITY" | "URGENT";
    riskLevel: number;
    tier: "ESSENTIAL" | "CONCIERGE";
    status: string;
    assignedAgentName?: string;
    scheduledFor?: number;
    paymentStatus?: "PENDING" | "PAID";
    nextAction?: string;
    nextActionDueAt?: number;
    ageDays?: number;
  },
) {
  const caseNumber = await nextCaseNumber(ctx);
  const slaHours = data.priority === "URGENT" ? 24 : data.priority === "PRIORITY" ? 48 : 72;
  return ctx.db.insert("cases", {
    userId,
    caseNumber,
    serviceType: data.serviceType,
    description: data.description,
    location: data.location,
    city: data.city,
    state: data.state,
    priority: data.priority,
    riskLevel: data.riskLevel,
    tier: data.tier,
    status: data.status,
    paymentStatus: data.paymentStatus ?? "PENDING",
    assignedAgentName: data.assignedAgentName,
    scheduledFor: data.scheduledFor,
    nextAction: data.nextAction,
    nextActionDueAt: data.nextActionDueAt,
    slaTargetAt: now + slaHours * 3600_000,
    createdAt: now - (data.ageDays ?? 22) * 24 * 3600_000,
    updatedAt: now,
  });
}

async function seedHistory(
  ctx: any,
  caseId: string,
  steps: { from: string; to: string; at: number; actor: string }[],
) {
  for (const s of steps) {
    await ctx.db.insert("caseStatusHistory", {
      caseId,
      fromStatus: s.from,
      toStatus: s.to,
      actorName: s.actor,
      createdAt: s.at,
    });
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const [profile, properties, beneficiaries] = await Promise.all([
      ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
      ctx.db
        .query("properties")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("beneficiaries")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
    ]);
    return { profile, properties, beneficiaries };
  },
});

export const updateProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    countryOfResidence: v.optional(v.string()),
    phone: v.optional(v.string()),
    preferredChannel: v.optional(v.string()),
    city: v.optional(v.string()),
    onboarded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Profile not found — onboard first");
    await ctx.db.patch(profile._id, {
      ...(args.fullName !== undefined ? { fullName: args.fullName } : {}),
      ...(args.countryOfResidence !== undefined ? { countryOfResidence: args.countryOfResidence } : {}),
      ...(args.phone !== undefined ? { phone: args.phone } : {}),
      ...(args.preferredChannel !== undefined ? { preferredChannel: args.preferredChannel } : {}),
      ...(args.city !== undefined ? { city: args.city } : {}),
      ...(args.onboarded !== undefined ? { onboarded: args.onboarded } : {}),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const addProperty = mutation({
  args: {
    address: v.string(),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    await ctx.db.insert("properties", {
      userId,
      address: args.address,
      city: args.city,
      state: args.state,
      description: args.description,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const addBeneficiary = mutation({
  args: {
    fullName: v.string(),
    relationship: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    await ctx.db.insert("beneficiaries", {
      userId,
      fullName: args.fullName,
      relationship: args.relationship,
      phone: args.phone,
      notes: args.notes,
      hasPortalAccess: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const listNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return notifications;
  },
});

export const markNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("readAt"), undefined))
      .collect();
    for (const n of notifications) {
      await ctx.db.patch(n._id, { readAt: Date.now() });
    }
    return { ok: true };
  },
});
