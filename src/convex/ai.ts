"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { createVlyIntegrations } from "@vly-ai/integrations";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { buildQuoteLines, SERVICE_META } from "./cases";
import {
  CasePriority,
  CaseTier,
  ServiceType,
  Timeline,
  casePriorityValidator,
  caseTierValidator,
  serviceTypeValidator,
  timelineValidator,
} from "./schema";

// ---------------------------------------------------------------------------
// ASOJU AI Concierge — conversational intake front door (PRD 5.2 / 7)
//
// The AI understands what the customer is trying to say, asks clarifying
// questions until the scope is complete, then hands the captured scope to the
// deterministic pricing engine (buildQuoteLines) for the quote. It never sets
// prices itself and never decides for the customer — a human team confirms
// scope, quote and schedule (Non-Negotiable: "AI may recommend — it never
// decides for you").
// ---------------------------------------------------------------------------

const CATALOGUE = Object.entries(SERVICE_META)
  .map(
    ([key, meta]) =>
      `- ${key}: ${meta.label} — ${meta.tagline} From ₦${meta.baseFee.toLocaleString(
        "en-NG",
      )}.`,
  )
  .join("\n");

const SYSTEM_PROMPT = `You are the ASOJU AI Concierge — the intelligent intake agent for ASOJU, a diaspora support platform that puts a verified human on the ground in Nigeria for Nigerians abroad.

Services (use the exact enum keys — never invent new ones):
${CATALOGUE}

Your job: understand what the customer needs, ask clarifying questions until the scope is complete, then hand off with a structured capture. You NEVER state a price total yourself — the platform's pricing engine computes the quote from the captured scope. You never promise outcomes or deadlines beyond what the platform guarantees (a human team confirms scope, quote and schedule).

Required scope fields to capture before quoting:
- serviceType: one of the enum keys above
- description: 1-3 sentence plain-language summary of what they need and why
- location: full location string, e.g. "Ibeju-Lekki, Lagos"
- city and state: prefer to extract these from the location if mentioned
- timeline: "immediate" | "near_term" | "exploring"
- priority: "STANDARD" | "PRIORITY" | "URGENT" (URGENT only if the customer signals real urgency)
- tier: "ESSENTIAL" | "CONCIERGE" (recommend ESSENTIAL for a one-off; only use CONCIERGE if they ask about membership or subscriptions)

Conversation rules:
- Warm, concise, professional. Keep replies short (1-4 sentences). Address the customer directly.
- Ask at most ONE question per reply (two only if both are quick), focusing on what is genuinely missing.
- Acknowledge what they told you, then ask only for what's missing. Never interrogate.
- If they mention something outside these services (legal opinions, title certification, surveys, valuations), explain what ASOJU can and cannot do — never overpromise.
- Do not ask for BVN, NIN, passport numbers, or any sensitive ID.
- For bereavement requests, be gentle, brief and empathetic.
- Do not repeat the full catalogue back to the customer.

When the scope is complete (all required fields captured with reasonable confidence), reply with a short confirmation of what you understood, then append a JSON block on its own line in EXACTLY this format (no markdown fences, no trailing text):

[SCOPE]{"serviceType":"...","description":"...","location":"...","city":"...","state":"...","timeline":"...","priority":"...","tier":"..."}

Everything before the [SCOPE] line is the reply shown to the customer. Never include the [SCOPE] block unless the scope is truly complete.`;

// Message history sent from the client (system prompt is added here).
const chatArgsValidator = v.array(
  v.object({
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  }),
);

const capturedScopeValidator = v.object({
  serviceType: serviceTypeValidator,
  description: v.string(),
  location: v.string(),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  timeline: timelineValidator,
  priority: casePriorityValidator,
  tier: caseTierValidator,
});

type CapturedScope = {
  serviceType: ServiceType;
  description: string;
  location: string;
  city?: string;
  state?: string;
  timeline: Timeline;
  priority: CasePriority;
  tier: CaseTier;
};

function isValidScope(raw: Record<string, unknown>): raw is CapturedScope {
  if (typeof raw.serviceType !== "string" || !(raw.serviceType in SERVICE_META)) return false;
  if (typeof raw.description !== "string" || raw.description.trim().length < 5) return false;
  if (typeof raw.location !== "string" || raw.location.trim().length < 2) return false;
  if (!["immediate", "near_term", "exploring"].includes(raw.timeline as string)) return false;
  if (!["STANDARD", "PRIORITY", "URGENT"].includes(raw.priority as string)) return false;
  if (!["ESSENTIAL", "CONCIERGE"].includes(raw.tier as string)) return false;
  return true;
}

type ChatReply =
  | { reply: string; ready: false }
  | {
      reply: string;
      ready: true;
      captured: CapturedScope;
      quote: {
        serviceLabel: string;
        lines: { category: string; label: string; amount: number }[];
        baseAmount: number;
        nonServiceFeeAmount: number;
        discountAmount: number;
        discountPercent: number;
        amount: number;
      };
    };

/** One turn of the Concierge conversation. Returns the reply plus, when the
 *  scope is complete, a deterministic quote computed by the pricing engine. */
export const conciergeChat = action({
  args: { messages: chatArgsValidator },
  handler: async (ctx, args): Promise<ChatReply> => {
    const history = args.messages.slice(-24);
    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    const vly = createVlyIntegrations({
      deploymentToken: process.env.VLY_INTEGRATION_KEY,
    });
    const res = await vly.ai.completion({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.4,
      maxTokens: 700,
    });

    if (!res.success || !res.data?.choices?.[0]?.message?.content) {
      console.error("[Concierge] gateway failure", {
        error: res.error,
        keyPresent: Boolean(process.env.VLY_INTEGRATION_KEY),
        baseUrl: process.env.VLY_INTEGRATION_BASE_URL ?? "unset",
      });
      throw new Error(res.error ?? "AI Concierge unavailable");
    }

    const raw = res.data.choices[0].message.content;
    const scopeMatch = raw.match(/\[SCOPE\]\s*(\{[\s\S]*\})/);
    const reply = scopeMatch ? raw.slice(0, scopeMatch.index).trim() : raw.trim();

    if (!scopeMatch) {
      return { reply, ready: false as const };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(scopeMatch[1]);
    } catch {
      return { reply, ready: false };
    }
    const rawScope = parsed as Record<string, unknown>;
    if (!isValidScope(rawScope)) {
      return { reply, ready: false };
    }
    const captured = {
      serviceType: rawScope.serviceType,
      description: rawScope.description,
      location: rawScope.location,
      city: rawScope.city,
      state: rawScope.state,
      timeline: rawScope.timeline,
      priority: rawScope.priority,
      tier: rawScope.tier,
    } satisfies CapturedScope;

    // Prices are computed by the engine — never by the model.
    const quote = buildQuoteLines(captured.serviceType, captured.tier, captured.city);
    return {
      reply,
      ready: true,
      captured,
      quote: {
        serviceLabel: SERVICE_META[captured.serviceType].label,
        lines: quote.lines,
        baseAmount: quote.baseAmount,
        nonServiceFeeAmount: quote.nonServiceFeeAmount,
        discountAmount: quote.discountAmount,
        discountPercent: quote.discountPercent,
        amount: quote.amount,
      },
    };
  },
});

/** Creates the case from the captured scope, issues the quote immediately,
 *  and records the concierge handoff in the case thread. */
export const conciergeCreateCase = action({
  args: { captured: capturedScopeValidator },
  handler: async (
    ctx,
    args,
  ): Promise<{ caseId: string; caseNumber: string; quoteId: string }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Please sign in to create your case");

    const c = args.captured;
    const created = await ctx.runMutation(api.cases.createServiceRequest, {
      serviceType: c.serviceType,
      description: c.description,
      location: c.location,
      city: c.city,
      state: c.state,
      timeline: c.timeline,
      priority: c.priority,
      tier: c.tier,
      conciergeSummary: `Scope captured by the AI Concierge: ${c.description} (${c.location}).`,
    });

    // SUBMITTED → UNDER_REVIEW (triage) → QUOTED via the state machine.
    await ctx.runMutation(api.cases.triageCase, { caseId: created.caseId });
    const quoted = await ctx.runMutation(api.cases.issueQuote, {
      caseId: created.caseId,
    });

    return {
      caseId: created.caseId,
      caseNumber: created.caseNumber,
      quoteId: quoted.quoteId,
    };
  },
});
