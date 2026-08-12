import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Concierge training loop — customers rate the AI's replies (thumbs up/down).
// The team reviews the ratings alongside the exact exchange that produced them
// and iterates on the concierge system prompt (src/convex/ai.ts).
// ---------------------------------------------------------------------------

export const recordConciergeFeedback = mutation({
  args: {
    rating: v.union(v.literal("up"), v.literal("down")),
    userMessage: v.string(),
    aiReply: v.string(),
    hadQuote: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false };
    await ctx.db.insert("conciergeFeedback", {
      userId,
      rating: args.rating,
      userMessage: args.userMessage.slice(0, 500),
      aiReply: args.aiReply.slice(0, 500),
      hadQuote: args.hadQuote,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Admin review: recent concierge ratings + the exact exchange that produced
 *  them, so the team can spot weak questions and tighten the prompt. */
export const listConciergeFeedback = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return null;
    return ctx.db.query("conciergeFeedback").order("desc").take(100);
  },
});
