/**
 * CourseCard
 * ──────────
 * App Store–style card for a single learning module.
 * Displays: title, description, difficulty badge, language,
 * estimated time, tags, and a key concept preview.
 */

import { Clock, Code2, ChevronRight, Tag } from "lucide-react";

// ── Colour palettes per difficulty ───────────────────────────────────────────
const DIFFICULTY_STYLES = {
  Beginner:     "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  Intermediate: "bg-amber-400/10  text-amber-400  border-amber-400/20",
  Advanced:     "bg-rose-400/10   text-rose-400   border-rose-400/20",
};

// ── Card gradient per card index (cycles through a palette) ─────────────────
const CARD_GRADIENTS = [
  "from-brand-600  to-cyan-600",
  "from-violet-600 to-purple-600",
  "from-emerald-600 to-teal-600",
  "from-amber-600  to-orange-600",
  "from-rose-600   to-pink-600",
  "from-sky-600    to-indigo-600",
];

// ── Language icon label ───────────────────────────────────────────────────────
const LANGUAGE_ICONS = {
  Python:     "🐍",
  JavaScript: "⚡",
  TypeScript: "🔷",
  Go:         "🐹",
  Rust:       "🦀",
  Java:       "☕",
  Ruby:       "💎",
  PHP:        "🐘",
  Swift:      "🍎",
  Kotlin:     "🎯",
  "C++":      "⚙️",
  C:          "⚙️",
  "C#":       "🎵",
  default:    "📄",
};

function getLanguageIcon(lang) {
  return LANGUAGE_ICONS[lang] ?? LANGUAGE_ICONS.default;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CourseCard({ module: mod, index, onClick }) {
  const gradient   = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const difficulty = DIFFICULTY_STYLES[mod.difficulty] ?? DIFFICULTY_STYLES.Intermediate;
  const langIcon   = getLanguageIcon(mod.language);

  return (
    <article
      onClick={onClick}
      className="
        group cursor-pointer rounded-2xl overflow-hidden
        bg-gray-900 border border-gray-800
        card-hover
        animate-slide-up
      "
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      {/* ── Gradient header strip ─────────────────────────────────────── */}
      <div className={`h-2 w-full bg-gradient-to-r ${gradient}`} />

      {/* ── Card header ──────────────────────────────────────────────── */}
      <div className={`px-5 pt-5 pb-4 bg-gradient-to-br ${gradient} bg-opacity-5 relative`}
           style={{ background: "none" }}>
        <div className="flex items-start justify-between gap-3">
          {/* Language icon badge */}
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-xl shadow-inner">
            {langIcon}
          </div>

          {/* Difficulty badge */}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${difficulty}`}>
            {mod.difficulty}
          </span>
        </div>

        <h3 className="mt-3 text-base font-bold text-white leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors">
          {mod.title}
        </h3>
        <p className="mt-1 text-xs text-gray-400 leading-relaxed line-clamp-2">
          {mod.description}
        </p>
      </div>

      {/* ── Meta row ─────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {mod.estimated_time}
        </span>
        <span className="flex items-center gap-1">
          <Code2 className="w-3 h-3" />
          {mod.language}
        </span>
      </div>

      {/* ── Key concept pill ─────────────────────────────────────────── */}
      {mod.key_concept && (
        <div className="px-5 pb-3">
          <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-gray-800/60 border border-gray-700/50">
            <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider flex-shrink-0 mt-0.5">
              Key concept
            </span>
            <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">
              {mod.key_concept}
            </p>
          </div>
        </div>
      )}

      {/* ── Tags ─────────────────────────────────────────────────────── */}
      {mod.tags?.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          <Tag className="w-3 h-3 text-gray-600 mt-0.5 flex-shrink-0" />
          {mod.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-400 border border-gray-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── CTA footer ───────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
        <span className="text-xs text-gray-500 truncate font-mono">
          {mod.file_path?.split("/").slice(-2).join("/")}
        </span>
        <span className="flex items-center gap-1 text-xs text-brand-400 font-medium group-hover:gap-2 transition-all">
          Read module
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </article>
  );
}
