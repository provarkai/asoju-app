import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/asoju";
import type {
  CasePriority,
  CaseTier,
  ServiceType,
  Timeline,
} from "@/convex/schema";

export type CapturedScope = {
  serviceType: ServiceType;
  description: string;
  location: string;
  city?: string;
  state?: string;
  timeline: Timeline;
  priority: CasePriority;
  tier: CaseTier;
};

export type QuoteData = {
  serviceLabel: string;
  lines: { category: string; label: string; amount: number }[];
  baseAmount: number;
  nonServiceFeeAmount: number;
  discountAmount: number;
  discountPercent: number;
  discountLabel?: string;
  amount: number;
  regionZone?: string;
  fxRate?: number;
  fxLockExpiry?: number;
};

type UiMsg =
  | { id: number; kind: "text"; role: "user" | "assistant"; text: string; rated?: "up" | "down" }
  | {
      id: number;
      kind: "quote";
      role: "assistant";
      quote: QuoteData;
      captured: CapturedScope;
      rated?: "up" | "down";
    };

const GREETING =
  "Hi 👋 — I'm the ASOJU AI Concierge. Tell me, in your own words, what you need handled back home: a plot or property to verify, a building site to supervise, family errands, procurement… I'll ask a couple of quick questions, then get you a real quote.";

const QUICK_PROMPTS = [
  "Verify a plot of land in Ibeju-Lekki before I pay the balance",
  "Monitor my building project in Abuja",
  "Check my father's farm in Oyo",
  "Buy and deliver 10 bags of cement to Enugu",
];

const DRAFT_KEY = "asoju-concierge-draft";

export default function AiConciergeDemo({
  isAuthenticated,
  onNavigate,
}: {
  isAuthenticated: boolean;
  onNavigate: (path: string) => void;
}) {
  const conciergeChat = useAction(api.ai.conciergeChat);
  const createCase = useAction(api.ai.conciergeCreateCase);
  const recordFeedback = useMutation(api.concierge.recordConciergeFeedback);

  const [messages, setMessages] = useState<UiMsg[]>([
    { id: 0, kind: "text", role: "assistant", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [creating, setCreating] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const nextId = () => idRef.current++;

  const toHistory = (msgs: UiMsg[]) =>
    msgs
      .filter((m): m is Extract<UiMsg, { kind: "text" }> => m.kind === "text")
      .map((m) => ({ role: m.role, content: m.text }));

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || thinking) return;
    setInput("");
    const userMsg: UiMsg = { id: nextId(), kind: "text", role: "user", text: content };
    const next = [...messages, userMsg];
    setMessages(next);
    setThinking(true);
    try {
      const res = await conciergeChat({ messages: toHistory(next) });
      setMessages((m) => [
        ...m,
        { id: nextId(), kind: "text", role: "assistant", text: res.reply },
      ]);
      if (res.ready && res.captured && res.quote) {
        setMessages((m) => [
          ...m,
          {
            id: nextId(),
            kind: "quote",
            role: "assistant",
            quote: res.quote,
            captured: res.captured,
          },
        ]);
      }
    } catch (e) {
      console.error(e);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          kind: "text",
          role: "assistant",
          text: "Sorry — I hit a snag reaching the concierge. Please try again in a moment.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  /** Training loop: rate the last assistant reply (walk back to the user
   *  message that prompted it). Stored for the team to review and iterate. */
  const rateReply = async (msgId: number, rating: "up" | "down", hadQuote = false) => {
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;
    const ai = messages[idx];
    if (ai.role !== "assistant") return;
    let userMsg = "";
    for (let i = idx - 1; i >= 0; i--) {
      const prev = messages[i];
      if (prev.kind === "text" && prev.role === "user") {
        userMsg = prev.text;
        break;
      }
    }
    if (!userMsg) return;
    let aiReply = "[quote card]";
    if (ai.kind === "text") aiReply = ai.text;
    try {
      await recordFeedback({
        rating,
        userMessage: userMsg,
        aiReply,
        hadQuote,
      });
      setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, rated: rating } : x)));
    } catch {
      /* ratings are best-effort */
    }
  };

  const acceptQuote = async (captured: CapturedScope) => {
    if (!isAuthenticated) {
      // Carry the captured scope into the portal so the wizard is pre-filled
      // once the customer signs in.
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(captured));
      } catch {
        /* storage unavailable — just route */
      }
      onNavigate("/auth?returnTo=/dashboard/new");
      return;
    }
    setCreating(true);
    try {
      const res = await createCase({ captured });
      toast.success(`Case ${res.caseNumber} created — your quote is ready`);
      onNavigate(`/dashboard/cases/${res.caseId}`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not create your case");
      setCreating(false);
    }
  };

  const reset = () => {
    setMessages([{ id: nextId(), kind: "text", role: "assistant", text: GREETING }]);
    setThinking(false);
    setCreating(false);
    setInput("");
  };

  const showChips = !thinking && messages.length <= 2;

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-gold/25 via-transparent to-forest/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-forest/10 bg-white shadow-2xl shadow-forest/15">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-forest/8 bg-forest px-5 py-4">
          <span className="relative flex size-9 items-center justify-center rounded-xl bg-gold/20 text-gold-light">
            <Sparkles className="size-5" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-forest" />
          </span>
          <div className="flex-1">
            <p className="font-display text-sm font-semibold leading-tight text-ivory">
              AI Concierge
            </p>
            <p className="text-[11px] text-ivory/60">
              {thinking ? "Thinking…" : "ASOJU · captures your request"}
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            aria-label="Start a new conversation"
            title="New conversation"
            className="rounded-lg p-2 text-ivory/70 transition-colors hover:bg-ivory/10 hover:text-ivory"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        {/* conversation */}
        <div className="h-[400px] space-y-3 overflow-y-auto bg-ivory/40 px-4 py-5 sm:h-[430px]">
          {messages.map((msg) =>
            msg.kind === "quote" ? (
              <QuoteCard
                key={msg.id}
                quote={msg.quote}
                captured={msg.captured}
                creating={creating}
                isAuthenticated={isAuthenticated}
                rated={msg.rated}
                onAccept={() => acceptQuote(msg.captured)}
                onRate={(r) => rateReply(msg.id, r, true)}
              />
            ) : (
              <Bubble key={msg.id} user={msg.role === "user"} text={msg.text} />
            ),
          )}
          {messages.map((msg) =>
            msg.kind === "text" &&
            msg.role === "assistant" &&
            msg.text !== GREETING &&
            !thinking ? (
              <RatingRow
                key={`r-${msg.id}`}
                rated={msg.rated}
                onRate={(r) => rateReply(msg.id, r)}
              />
            ) : null,
          )}
          {thinking && <TypingDots />}
          <div ref={endRef} />
        </div>

        {/* quick prompts */}
        {showChips && (
          <div className="flex flex-wrap gap-2 border-t border-forest/8 bg-white px-4 pt-3">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                className="rounded-full border border-forest/15 bg-ivory/60 px-3 py-1.5 text-left text-[11px] font-medium text-forest/75 transition-colors hover:border-forest/35 hover:bg-white"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* input */}
        <div className="flex items-center gap-2 bg-white px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            disabled={thinking}
            placeholder="Describe what needs handling back home…"
            className="h-10 flex-1 rounded-xl border border-forest/15 bg-ivory/50 px-3.5 text-sm text-forest placeholder:text-forest/40 focus:border-forest/40 focus:outline-none focus:ring-2 focus:ring-forest/10 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => send()}
            aria-label="Send message"
            disabled={!input.trim() || thinking}
            className="flex size-10 items-center justify-center rounded-xl bg-forest text-ivory shadow-sm transition-colors hover:bg-forest-deep disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>

      {/* trust footnote */}
      <div className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-forest/55">
        <ShieldCheck className="size-4 shrink-0 text-forest" />
        AI Concierge captures &amp; recommends — a human team confirms scope,
        quote &amp; schedule.
      </div>

      {/* mobile-visible quick chips */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-white px-3.5 py-1.5 text-xs font-semibold text-forest/70 shadow-sm">
          <Sparkles className="size-3.5 text-gold" />
          AI Concierge — Request → Case in minutes
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-forest/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-forest/80 shadow-sm">
          <MapPin className="size-3.5 text-clay" />
          Serving Lagos &amp; environs first
        </span>
      </div>
    </div>
  );
}

function Bubble({ user, text }: { user: boolean; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex ${user ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
          user
            ? "rounded-br-md bg-forest text-ivory"
            : "rounded-bl-md border border-forest/10 bg-white text-forest/85"
        }`}
      >
        {text}
      </div>
    </motion.div>
  );
}

function RatingRow({
  rated,
  onRate,
}: {
  rated?: "up" | "down";
  onRate: (r: "up" | "down") => void;
}) {
  if (rated) {
    return (
      <div className="flex justify-start pl-4">
        <p className="text-[10px] text-forest/40">Thanks — this helps us improve.</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 pl-4">
      <span className="text-[10px] text-forest/45">Was this helpful?</span>
      <button
        type="button"
        aria-label="Good reply"
        title="Good reply"
        onClick={() => onRate("up")}
        className="rounded-full border border-forest/15 bg-white p-1 text-forest/55 transition-colors hover:border-forest/40 hover:text-forest"
      >
        <ThumbsUp className="size-3" />
      </button>
      <button
        type="button"
        aria-label="Poor reply"
        title="Poor reply"
        onClick={() => onRate("down")}
        className="rounded-full border border-forest/15 bg-white p-1 text-forest/55 transition-colors hover:border-clay/50 hover:text-clay"
      >
        <ThumbsDown className="size-3" />
      </button>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-forest/10 bg-white px-4 py-3.5 shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-forest/50"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

function QuoteCard({
  quote,
  captured,
  creating,
  isAuthenticated,
  rated,
  onAccept,
  onRate,
}: {
  quote: QuoteData;
  captured: CapturedScope;
  creating: boolean;
  isAuthenticated: boolean;
  rated?: "up" | "down";
  onAccept: () => void;
  onRate: (r: "up" | "down") => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex justify-end"
    >
      <div className="w-full max-w-[95%] overflow-hidden rounded-2xl border border-gold/35 bg-white shadow-md">
        <div className="flex items-center justify-between border-b border-gold/20 bg-gold/10 px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-clay">
            <Sparkles className="size-3.5 text-gold" />
            Quote ready
          </p>
          <span className="flex items-center gap-1 text-[11px] font-medium text-forest/60">
            <CheckCircle2 className="size-3.5 text-forest" />
            {quote.serviceLabel}
          </span>
        </div>

        <ul className="space-y-1.5 px-4 py-3">
          {quote.lines.map((line, i) => (
            <li
              key={i}
              className="flex items-baseline justify-between gap-3 text-[13px]"
            >
              <span className="text-forest/70">{line.label}</span>
              <span className="shrink-0 font-medium text-forest">
                {naira(line.amount)}
              </span>
            </li>
          ))}
          {quote.discountAmount > 0 && (
            <li className="flex items-baseline justify-between gap-3 text-[13px] text-forest/60">
              <span>{quote.discountLabel ?? `Plan discount (${quote.discountPercent}%)`}</span>
              <span className="shrink-0 font-medium text-forest">
                −{naira(quote.discountAmount)}
              </span>
            </li>
          )}
        </ul>

        <div className="flex items-baseline justify-between border-t border-forest/8 bg-ivory/60 px-4 py-2.5">
          <span className="text-sm font-semibold text-forest">Total</span>
          <span className="font-display text-lg font-bold text-forest">
            {naira(quote.amount)}
          </span>
        </div>

        <p className="flex items-start gap-1.5 px-4 pb-2 text-[11px] leading-snug text-forest/55">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-forest" />
          All-in service fee — representative transport &amp; logistics
          included. VAT and third-party costs itemized. Valid 7 days.
          {quote.fxRate
            ? ` · ≈ $${Math.round(quote.amount / quote.fxRate)} at ₦${quote.fxRate}/$ — rate locked 48h.`
            : ""}
        </p>

        <div className="px-4 pb-3.5">
          <Button
            size="sm"
            className="mt-1 w-full bg-forest text-ivory hover:bg-forest-deep"
            disabled={creating}
            onClick={onAccept}
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating your case…
              </>
            ) : (
              <>
                Accept &amp; create my case
                <Sparkles className="size-4 text-gold-light" />
              </>
            )}
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-forest/50">
            {isAuthenticated
              ? "Creates your case — you approve payment before we schedule."
              : "You'll be asked to sign in first — your request carries over."}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-forest/8 bg-ivory/40 px-4 py-2">
          <p className="text-[11px] text-forest/50">
            📍 {captured.location} · {quote.serviceLabel}
            {quote.regionZone === "OTHER"
              ? " · SC not available in this region"
              : quote.regionZone
                ? ` · ${quote.regionZone === "LAGOS" ? "Lagos zone" : "South-West zone"} — SC eligible`
                : ""}
          </p>
          {rated ? (
            <span className="text-[10px] text-forest/40">Thanks for the feedback</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-forest/45">Helpful?</span>
              <button
                type="button"
                aria-label="Good quote"
                title="Good quote"
                onClick={() => onRate("up")}
                className="rounded-full border border-forest/15 bg-white p-1 text-forest/55 transition-colors hover:border-forest/40 hover:text-forest"
              >
                <ThumbsUp className="size-3" />
              </button>
              <button
                type="button"
                aria-label="Poor quote"
                title="Poor quote"
                onClick={() => onRate("down")}
                className="rounded-full border border-forest/15 bg-white p-1 text-forest/55 transition-colors hover:border-clay/50 hover:text-clay"
              >
                <ThumbsDown className="size-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
