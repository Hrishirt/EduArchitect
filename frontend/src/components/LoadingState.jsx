/**
 * LoadingState
 * ─────────────────────────────────────────────────────────────────────────
 * Animated progress overlay displayed while the agentic pipeline runs.
 * Steps advance forward-only (no looping) and an elapsed timer
 * reassures the user that the process is still alive.
 */

import { useEffect, useState } from "react";
import { Cpu, FolderSearch, Layers, BookOpen, Sparkles } from "lucide-react";

const STEPS = [
  { icon: FolderSearch, label: "Scanning repository structure",     color: "text-sky-400",     bg: "bg-sky-400" },
  { icon: Cpu,          label: "Claude is exploring key files",     color: "text-brand-400",   bg: "bg-brand-400" },
  { icon: Layers,       label: "Identifying teachable modules",     color: "text-violet-400",  bg: "bg-violet-400" },
  { icon: BookOpen,     label: "Writing IBM-style tutorials",       color: "text-emerald-400", bg: "bg-emerald-400" },
  { icon: Sparkles,     label: "Finalising course structure",       color: "text-amber-400",   bg: "bg-amber-400" },
];

// Advance one step every 20 seconds (matches average agent iteration time)
const STEP_INTERVAL_MS = 20_000;

export default function LoadingState() {
  const [stepIdx,  setStepIdx]  = useState(0);
  const [elapsed,  setElapsed]  = useState(0);   // seconds
  const [dots,     setDots]     = useState("");

  // Advance steps forward only — clamp at last step, never loop
  useEffect(() => {
    const timer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Elapsed seconds counter
  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Trailing dots for current step label
  useEffect(() => {
    const timer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (s) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const isLastStep  = stepIdx === STEPS.length - 1;
  const progressPct = ((stepIdx + 1) / STEPS.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center h-96 animate-fade-in select-none">

      {/* Pulsing icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
        {(() => {
          const { icon: Icon, color } = STEPS[stepIdx];
          return (
            <div className="relative w-20 h-20 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shadow-lg">
              <Icon className={`w-9 h-9 ${color} transition-all duration-700`} />
            </div>
          );
        })()}
      </div>

      {/* Progress bar */}
      <div className="w-72 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-gradient-to-r from-brand-600 to-cyan-500 rounded-full transition-all duration-[18s] ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Current step label */}
      <p className={`text-sm font-semibold ${STEPS[stepIdx].color} transition-colors duration-500`}>
        {STEPS[stepIdx].label}{isLastStep ? dots : dots}
      </p>

      {/* Step counter + elapsed */}
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span>Step {stepIdx + 1} of {STEPS.length}</span>
        <span className="w-px h-3 bg-gray-700" />
        <span className="font-mono tabular-nums">{formatElapsed(elapsed)} elapsed</span>
      </div>

      {/* Step timeline */}
      <div className="flex items-center gap-2 mt-5">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className={`
              rounded-full transition-all duration-500
              ${i === stepIdx
                ? `w-5 h-2 ${s.bg}`
                : i < stepIdx
                  ? "w-2 h-2 bg-gray-600"
                  : "w-2 h-2 bg-gray-800"
              }
            `}
          />
        ))}
      </div>

      {/* Rate-limit notice (shown after 30s) */}
      {elapsed >= 30 && (
        <p className="mt-6 text-xs text-gray-600 text-center max-w-xs animate-fade-in">
          Still running — the AI agent may be waiting on API rate limits.
          <br />This is normal for free-tier keys. Hang tight!
        </p>
      )}
      {elapsed < 30 && (
        <p className="mt-6 text-xs text-gray-600 text-center max-w-xs">
          The AI agent is autonomously exploring your codebase.
        </p>
      )}
    </div>
  );
}
