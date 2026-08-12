import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/asoju";

type TextMsg = { role: "user" | "ai"; text: string };
type Msg = TextMsg | { role: "ai"; summary: true };

const SCRIPT: Msg[] = [
  {
    role: "user",
    text: "I need a plot of land inspected in Ibeju-Lekki before I pay the balance.",
  },
  { role: "ai", text: "On it. Here's what I understood from your request:" },
  { role: "ai", summary: true },
  {
    role: "ai",
    text: "A human concierge confirms the scope and sends a line-item quote — usually within hours. Want me to set it up?",
  },
];

const AUTO_REPLY =
  "Got it — captured. A human concierge will confirm the scope and follow up with your line-item quote in the portal.";

const SUMMARY_ROWS = [
  { label: "Service", value: "Property Inspection & Verification" },
  { label: "Location", value: "Ibeju-Lekki, Lagos" },
  { label: "Estimate", value: `${naira(91375)} all-in (fee + VAT)` },
  { label: "First visit target", value: "Within 48 hours" },
];

function Bubble({ msg }: { msg: TextMsg }) {
  const user = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`flex ${user ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
          user
            ? "rounded-br-md bg-forest text-ivory"
            : "rounded-bl-md border border-forest/10 bg-white text-forest/85"
        }`}
      >
        {msg.text}
      </div>
    </motion.div>
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

function SummaryCard({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex justify-end"
    >
      <div className="w-full max-w-[92%] overflow-hidden rounded-2xl border border-gold/35 bg-white shadow-md">
        <div className="flex items-center justify-between border-b border-gold/20 bg-gold/10 px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-clay">
            <Sparkles className="size-3.5 text-gold" />
            Request captured
          </p>
          <span className="text-[11px] font-medium text-forest/50">ASJ draft</span>
        </div>
        <ul className="space-y-2 px-4 py-3.5">
          {SUMMARY_ROWS.map((row) => (
            <li key={row.label} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="shrink-0 text-forest/50">{row.label}</span>
              <span className="text-right font-medium text-forest">{row.value}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-forest/8 bg-ivory/60 px-4 py-2.5">
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-forest/60">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-forest" />
            AI recommends — a human team confirms scope, quote &amp; schedule.
          </p>
        </div>
        <div className="px-4 pb-3.5">
          <Button
            size="sm"
            className="mt-2.5 w-full bg-forest text-ivory hover:bg-forest-deep"
            onClick={onStart}
          >
            Start this request
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function AiConciergeDemo({ onStart }: { onStart: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [scriptOn, setScriptOn] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const scriptOnRef = useRef(true);

  useEffect(() => {
    scriptOnRef.current = scriptOn;
  }, [scriptOn]);

  // Auto-play the scripted conversation, one message at a time.
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(fn, ms));
    };

    const step = (i: number) => {
      if (cancelled || !scriptOnRef.current) return;
      if (i >= SCRIPT.length) return;
      const msg = SCRIPT[i];
      if (msg.role === "ai" && "summary" in msg) {
        setMessages((m) => [...m, msg]);
        later(() => step(i + 1), 900);
      } else if (msg.role === "ai") {
        setTyping(true);
        later(() => {
          if (cancelled || !scriptOnRef.current) return;
          setTyping(false);
          setMessages((m) => [...m, msg]);
          later(() => step(i + 1), 500);
        }, 1100);
      } else {
        setMessages((m) => [...m, msg]);
        later(() => step(i + 1), 950);
      }
    };

    later(() => step(0), 300);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [replayKey]);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setScriptOn(false);
    setTyping(false);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }, { role: "ai", text: AUTO_REPLY }]);
  };

  const replay = () => {
    setScriptOn(true);
    setTyping(false);
    setMessages([]);
    setReplayKey((k) => k + 1);
  };

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
            <p className="text-[11px] text-ivory/60">ASOJU · capturing your request</p>
          </div>
          <button
            type="button"
            onClick={replay}
            aria-label="Replay conversation"
            title="Replay"
            className="rounded-lg p-2 text-ivory/70 transition-colors hover:bg-ivory/10 hover:text-ivory"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        {/* conversation */}
        <div className="h-[380px] space-y-3 overflow-y-auto bg-ivory/40 px-4 py-5 sm:h-[420px]">
          {messages.map((msg, i) =>
            "summary" in msg ? (
              <SummaryCard key={i} onStart={onStart} />
            ) : (
              <Bubble key={i} msg={msg} />
            ),
          )}
          {typing && <TypingDots />}
          <div ref={endRef} />
        </div>

        {/* input */}
        <div className="flex items-center gap-2 border-t border-forest/8 bg-white px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Describe what needs handling back home…"
            className="h-10 flex-1 rounded-xl border border-forest/15 bg-ivory/50 px-3.5 text-sm text-forest placeholder:text-forest/40 focus:border-forest/40 focus:outline-none focus:ring-2 focus:ring-forest/10"
          />
          <button
            type="button"
            onClick={send}
            aria-label="Send message"
            className="flex size-10 items-center justify-center rounded-xl bg-forest text-ivory shadow-sm transition-colors hover:bg-forest-deep disabled:opacity-40"
            disabled={!input.trim()}
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
