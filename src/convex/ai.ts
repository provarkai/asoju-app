"use node";

import axios from "axios";
import { getAuthUserId } from "@convex-dev/auth/server";
import { createVlyIntegrations } from "@vly-ai/integrations";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { buildQuoteLines, fxRate, inferRegion, SERVICE_META } from "./cases";
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

// The catalogue feeds the model the exact per-service checklist items so its
// clarifying questions are specific and expert (e.g. for a property: fence,
// encroachment, title docs) instead of generic. Stays in sync with the app's
// real checklists automatically.
const CATALOGUE = Object.entries(SERVICE_META)
  .map(
    ([key, meta]) =>
      `- ${key}: ${meta.label} — ${meta.tagline} From ₦${meta.baseFee.toLocaleString(
        "en-NG",
      )}. Typical things to check: ${meta.checklist.join("; ")}.`,
  )
  .join("\n");

const SYSTEM_PROMPT = `You are the ASOJU AI Concierge — the intelligent intake and sales agent for ASOJU, a diaspora support platform that puts a verified human on the ground in Nigeria for Nigerians abroad.

Services (use the exact enum keys — never invent new ones):
${CATALOGUE}

Your job: understand what the customer is trying to say, ask sharp clarifying questions until the scope is complete, then hand off with a structured capture so the platform can quote. You NEVER state a price total — the platform's pricing engine computes the quote deterministically from the captured scope (service fee, urgency multiplier, region, plan discount, VAT, 48h FX lock). Never promise outcomes or deadlines beyond what the platform guarantees (a human team confirms scope, quote and schedule).

Service selection guidance (choose the exact enum key carefully — this decides the whole quote):
- PROPERTY_INSPECTION = land, plots, houses, and real estate — verifying a physical plot (fence, survey match, encroachment, title documents). This is the most common diaspora request.
- BUSINESS_VERIFICATION = verifying an actual business/company — is it real, registered, operating at the address. NEVER for land or property.
- ASSET_INSPECTION = movable assets like vehicles, equipment, machinery.
- CONSTRUCTION_SUPERVISION = ongoing building projects — progress, milestones, materials quality.
- FAMILY_SUPPORT, BEREAVEMENT_SUPPORT, PROCUREMENT, INVESTMENT_SUPPORT = as their names describe.
If a customer says "plot", "land", "property", "house", or "estate", the answer is almost always PROPERTY_INSPECTION.

Required scope fields to capture before quoting:
- serviceType: one of the enum keys above
- description: 1-3 sentence plain-language summary of what they need and why
- location: full location string, e.g. "Ibeju-Lekki, Lagos"
- city and state: prefer to extract these from the location if mentioned
- timeline: "immediate" | "near_term" | "exploring"
- priority: "STANDARD" | "PRIORITY" | "URGENT" (URGENT only if the customer signals real urgency — it applies a 1.5x multiplier to the service fee; reflect their deadline back so they feel heard)
- tier: "ESSENTIAL" | "PRIORITY" | "PREMIUM" — default ESSENTIAL. Offer a plan only when it genuinely fits: recurring needs (construction supervision, family support, multiple properties), or if they ask about subscriptions, monthly credits, or discounts. Mention that a plan's Special Credit (SC) covers part of the cost — never pressure.

QUALIFICATION FRAMEWORK — move through a natural conversation arc:
1. OPEN — acknowledge what they told you warmly, restate the ONE thing you understood, then ask the single most important missing detail.
2. QUALIFY — one question per reply, always the highest-value missing piece. Scan the ENTIRE conversation history first: never re-ask anything already answered. Build each question on their last answer. The catalogue lists typical things to check per service — use them to ask specific, expert questions (for a property: is it fenced? what size? any encroachment? do they hold the title documents?).
3. VALUE — once the scope is nearly complete, connect the service to what matters to them: closing a deal safely, protecting a large payment, peace of mind for family back home. Use their own words. One sentence — never a pitch.
4. CLOSE — the MOMENT the scope is complete, emit the [SCOPE] block (format below) in the same reply as a 1-2 sentence confirmation inviting the next step. The platform shows the quote card automatically — do not state or summarize the price yourself, and do NOT wait for a yes before emitting [SCOPE]. If the customer then says yes, just confirm warmly — the case is created from the captured scope.

Sales principles:
- Urgency: if they have a deadline, treat it as a fact to serve, not a lever to squeeze ("A deal closing in days means verification should happen before your final payment — that's exactly what we're here for.").
- Value framing: help them see the cost of inaction (paying the balance on an unverified title) without fearmongering.
- Objections — handle honestly, never negotiate:
  - Price: explain what's included (verified human on the ground, photo/video evidence, QC-reviewed report, transport & logistics included in the fee, 48h FX rate lock). Subscribers' SC covers part of the cost.
  - Trust: every representative is vetted and trained; evidence is timestamped; a human team confirms scope, quote and schedule.
  - Time: scheduling follows payment confirmation; the platform sets realistic SLAs by region.
- Never use fake scarcity, countdowns, or guilt. Never invent statistics, testimonials, or claims.

Conversation rules:
- Warm, concise, professional. Keep replies short (1-4 sentences). Address the customer directly. No robotic lists.
- NEVER use internal field names in customer-facing replies: no "location string", "scope", "timeline", "tier", "priority", "service type", or "[SCOPE]". Ask naturally instead ("What area of Lagos is the plot in?", "When do you need it done?").
- Ask at most ONE question per reply (two only if both are quick), always the most important missing detail.
- Acknowledge what they told you, then ask only for what's missing. Never interrogate.
- If they mention something outside these services (legal opinions, title certification, surveys, valuations), explain honestly what ASOJU can and cannot do — never overpromise.
- Do not ask for BVN, NIN, passport numbers, or any sensitive ID.
- For bereavement requests, be gentle, brief and empathetic — no sales framing at all.
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
  if (!["ESSENTIAL", "PRIORITY", "PREMIUM"].includes(raw.tier as string)) return false;
  return true;
}

/** One chat-completion call against an OpenAI-compatible gateway. */
async function openAiCompatibleCompletion(
  base: string,
  apiKey: string,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
): Promise<string> {
  const res = await axios.post(
    `${base.replace(/\/+$/, "")}/chat/completions`,
    {
      model,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    },
  );
  const content = res.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`Empty response from ${model}`);
  }
  return content;
}

/** Tries a provider's model chain in order; returns null if no key or all fail. */
async function tryLlmChain(
  provider: string,
  base: string,
  apiKey: string | undefined,
  candidates: { model: string; maxTokens: number }[],
  messages: { role: "system" | "user" | "assistant"; content: string }[],
): Promise<string | null> {
  if (!apiKey) return null;
  const errors: string[] = [];
  for (const c of candidates) {
    try {
      return await openAiCompatibleCompletion(base, apiKey, c.model, messages, c.maxTokens);
    } catch (e: any) {
      const detail = e?.response?.data?.error?.message ?? e?.message ?? String(e);
      errors.push(`${c.model}: ${detail}`);
      console.error("[Concierge] candidate failed", { provider, model: c.model, detail });
    }
  }
  console.error(`[Concierge] ${provider} chain failed`, errors);
  return null;
}

/**
 * LLM call. Provider order: OpenRouter → BazaarLink → platform VLY gateway.
 * Each OpenAI-compatible provider tries a paid default first, then free models
 * (best-effort) when the account lacks credits. Keys are read from the
 * deployment env and never exposed to the client.
 */
async function callLlm(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
): Promise<string> {
  const chainErrors: string[] = [];

  // 1) OpenRouter (primary — user's key has balance).
  const orOverride = process.env.OPENROUTER_MODEL;
  const orReply = await tryLlmChain(
    "OpenRouter",
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    process.env.OPENROUTER_API_KEY,
    orOverride
      ? [{ model: orOverride, maxTokens: 1500 }]
      : [
          { model: "openai/gpt-4o-mini", maxTokens: 700 },
          { model: "google/gemma-4-26b-a4b-it:free", maxTokens: 1500 },
        ],
    messages,
  );
  if (orReply) return orReply;
  if (process.env.OPENROUTER_API_KEY) chainErrors.push("OpenRouter: all models failed");

  // 2) BazaarLink.
  const bzOverride = process.env.BAZAARLINK_MODEL;
  const bzReply = await tryLlmChain(
    "BazaarLink",
    process.env.BAZAARLINK_BASE_URL ?? "https://bazaarlink.ai/api/v1",
    process.env.BAZAARLINK_API_KEY,
    bzOverride
      ? [{ model: bzOverride, maxTokens: 1500 }]
      : [
          { model: "openai/gpt-4o-mini", maxTokens: 700 },
          { model: "deepseek/deepseek-v4-flash:free", maxTokens: 2000 },
          { model: "qwen/qwen3.7-flash:free", maxTokens: 1500 },
        ],
    messages,
  );
  if (bzReply) return bzReply;
  if (process.env.BAZAARLINK_API_KEY) chainErrors.push("BazaarLink: all models failed");

  // 3) Platform VLY gateway.
  const vly = createVlyIntegrations({ deploymentToken: process.env.VLY_INTEGRATION_KEY });
  const res = await vly.ai.completion({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.4,
    maxTokens: 700,
  });
  if (res.success && res.data?.choices?.[0]?.message?.content) {
    return res.data.choices[0].message.content;
  }
  console.error("[Concierge] VLY gateway failure", { error: res.error });

  throw new Error(
    chainErrors.length > 0 ? chainErrors.join(" | ") : "AI Concierge unavailable",
  );
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
        discountLabel?: string;
        amount: number;
        regionZone: string;
        fxRate: number;
        fxLockExpiry: number;
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

    const raw = await callLlm(messages);
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
    const regionZone = inferRegion(captured.location, captured.city);
    const quote = buildQuoteLines(
      captured.serviceType,
      captured.tier,
      captured.city,
      regionZone,
      captured.priority,
    );
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
        discountLabel: quote.discountLabel,
        amount: quote.amount,
        regionZone,
        fxRate: fxRate(),
        fxLockExpiry: Date.now() + 48 * 3600_000,
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
      regionZone: inferRegion(c.location, c.city),
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
