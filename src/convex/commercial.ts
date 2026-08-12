import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { PLAN_META } from "./cases";
import { subscriptionPlanValidator, vaultCategoryValidator } from "./schema";

const MONTH_MS = 30 * 24 * 3600_000;

/** PRD §2.1 — activate (or re-activate) a Priority / Premium subscription.
 *  Demo: no real billing; a new billing cycle starts with a fresh SC voucher. */
export const subscribe = mutation({
  args: { plan: subscriptionPlanValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const now = Date.now();
    const meta = PLAN_META[args.plan];

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing && existing.status === "active") {
      throw new Error(`You're already on the ${meta.label} plan`);
    }
    const cycle = { cycleStartedAt: now, cycleEndsAt: now + MONTH_MS };
    if (existing) {
      await ctx.db.patch(existing._id, {
        plan: args.plan,
        status: "active",
        monthlyFeeUsd: meta.monthlyUsd,
        scUsd: meta.scUsd,
        scUsedThisCycle: false,
        scUsedOnCaseId: undefined,
        ...cycle,
        createdAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId,
        plan: args.plan,
        status: "active",
        monthlyFeeUsd: meta.monthlyUsd,
        scUsd: meta.scUsd,
        scUsedThisCycle: false,
        ...cycle,
        createdAt: now,
      });
    }
    return { plan: args.plan };
  },
});

export const cancelSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!sub) throw new Error("No active subscription");
    await ctx.db.patch(sub._id, { status: "cancelled" });
    return { ok: true };
  },
});

export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!sub || sub.status !== "active") return { subscription: null, plans: PLAN_META };
    return { subscription: sub, plans: PLAN_META };
  },
});

// ---------------------------------------------------------------------------
// PRD §4.1 — Digital document vault ("My Nigeria" locker)
// ---------------------------------------------------------------------------

export const addVaultDocument = mutation({
  args: {
    name: v.string(),
    category: vaultCategoryValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    await ctx.db.insert("vaultDocuments", {
      userId,
      name: args.name,
      category: args.category,
      notes: args.notes,
      isVerified: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// PRD §4.2 — Power of Attorney repository & verification
// ---------------------------------------------------------------------------

export const addVerifiedAsset = mutation({
  args: {
    type: vaultCategoryValidator,
    name: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    await ctx.db.insert("verifiedAssets", {
      userId,
      type: args.type,
      name: args.name,
      verified: false, // staff verification completes this (demo: flagged for review)
      notes: args.notes,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const getVault = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const [documents, assets] = await Promise.all([
      ctx.db
        .query("vaultDocuments")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("verifiedAssets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
    ]);
    return { documents, assets };
  },
});
