/**
 * ModuleModal
 * ──────────────────────────────────────────────────────────────────────────
 * Full-screen modal that renders the IBM-style Markdown tutorial for one
 * learning module, complete with syntax-highlighted code blocks.
 *
 * Libraries used
 * ─────────────
 *  react-markdown         – renders the Markdown content
 *  remark-gfm             – GitHub Flavored Markdown (tables, strikethrough …)
 *  react-syntax-highlighter – code block syntax highlighting
 */

import { useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  X,
  Clock,
  Code2,
  BookOpen,
  FileCode2,
  Tag,
  ChevronRight,
} from "lucide-react";

const DIFFICULTY_STYLES = {
  Beginner:     "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  Intermediate: "bg-amber-400/10  text-amber-400  border-amber-400/20",
  Advanced:     "bg-rose-400/10   text-rose-400   border-rose-400/20",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ModuleModal({ module: mod, onClose }) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e) => { if (e.key === "Escape") onClose(); },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const difficulty = DIFFICULTY_STYLES[mod.difficulty] ?? DIFFICULTY_STYLES.Intermediate;

  return (
    /* ── Backdrop ─────────────────────────────────────────────────────── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Panel ──────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl shadow-black/50 animate-slide-up overflow-hidden">

        {/* ── Modal header ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-gray-800 bg-gray-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                <BookOpen className="w-3 h-3" />
                <span>Learning Module</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-gray-400 font-medium truncate">{mod.language}</span>
              </div>

              <h2 className="text-xl font-bold text-white leading-snug">
                {mod.title}
              </h2>
              <p className="mt-1 text-sm text-gray-400">{mod.description}</p>

              {/* Meta badges row */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${difficulty}`}>
                  {mod.difficulty}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {mod.estimated_time}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Code2 className="w-3 h-3" />
                  {mod.language}
                </span>
                {mod.file_path && (
                  <span className="flex items-center gap-1 text-xs text-gray-500 font-mono max-w-xs truncate">
                    <FileCode2 className="w-3 h-3 flex-shrink-0" />
                    {mod.file_path.split("/").slice(-2).join("/")}
                  </span>
                )}
              </div>

              {/* Tags */}
              {mod.tags?.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Tag className="w-3 h-3 text-gray-600" />
                  {mod.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-800 text-gray-400 border border-gray-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="
                flex-shrink-0 w-8 h-8 rounded-lg
                flex items-center justify-center
                text-gray-500 hover:text-white
                bg-gray-800 hover:bg-gray-700
                transition-colors
              "
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* IBM-style Markdown tutorial */}
          <div className="tutorial-prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Syntax-highlighted code blocks
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        borderRadius: "0.75rem",
                        fontSize: "0.8rem",
                        margin: "0",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {mod.content}
            </ReactMarkdown>
          </div>

          {/* ── Raw snippet (collapsible) ─────────────────────────────── */}
          {mod.code_snippet && (
            <details className="mt-8 group">
              <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-300 transition-colors select-none">
                <FileCode2 className="w-3.5 h-3.5" />
                View original source snippet
                <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="mt-3">
                <SyntaxHighlighter
                  style={oneDark}
                  language={mod.language?.toLowerCase() ?? "text"}
                  PreTag="div"
                  customStyle={{
                    borderRadius: "0.75rem",
                    fontSize: "0.78rem",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {mod.code_snippet}
                </SyntaxHighlighter>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
