/**
 * Course Architect – Main Application Shell
 *
 * Layout
 * ──────
 *  ┌──────────────────────────────────────────────────────┐
 *  │  Header (logo + status badge)                        │
 *  ├──────────────┬───────────────────────────────────────┤
 *  │  Sidebar     │  Main content area                    │
 *  │  (config     │  ┌─────────────────────────────────┐  │
 *  │   panel)     │  │  Empty state / Loading / Cards  │  │
 *  │              │  └─────────────────────────────────┘  │
 *  └──────────────┴───────────────────────────────────────┘
 */

import { useState, useCallback } from "react";
import axios from "axios";
import {
  BookOpen,
  Cpu,
  FolderSearch,
  Layers,
  Zap,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

import CourseCard   from "./components/CourseCard.jsx";
import ModuleModal  from "./components/ModuleModal.jsx";
import LoadingState from "./components/LoadingState.jsx";

// The Vite proxy maps /generate-course → http://localhost:8000/generate-course
const API_BASE = "";

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [directory,     setDirectory]     = useState("");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [course,        setCourse]        = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);

  // ── API call ────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!directory.trim()) return;

    setLoading(true);
    setError(null);
    setCourse(null);

    try {
      const { data } = await axios.post(
        `${API_BASE}/generate-course`,
        { directory: directory.trim() },
        { timeout: 300_000 }, // 5 min – AI generation takes time
      );
      setCourse(data);
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        "An unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [directory]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleGenerate();
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-950">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white leading-none">
                Course Architect
              </h1>
              <p className="text-xs text-gray-400 leading-none mt-0.5">
                AI-Powered Learning Modules
              </p>
            </div>
          </div>

          {/* Status pill */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono">claude-3-5-sonnet</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 max-w-screen-xl mx-auto w-full px-6 py-8 gap-8">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0">
          <div className="glass rounded-2xl p-6 sticky top-24">

            <div className="flex items-center gap-2 mb-5">
              <FolderSearch className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-gray-200">
                Repository Config
              </h2>
            </div>

            {/* Path input */}
            <label className="block mb-1 text-xs font-medium text-gray-400">
              Local Folder Path
            </label>
            <input
              type="text"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="/absolute/path/to/repo"
              className="
                w-full px-3 py-2.5 rounded-xl text-sm font-mono
                bg-gray-800 border border-gray-700 text-gray-100
                placeholder-gray-500 outline-none
                focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
                transition-all
              "
            />

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !directory.trim()}
              className="
                mt-4 w-full flex items-center justify-center gap-2
                px-4 py-3 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-brand-600 to-brand-500
                text-white shadow-lg shadow-brand-500/20
                hover:from-brand-500 hover:to-cyan-500
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Generate Course
                </>
              )}
            </button>

            {/* Divider */}
            <div className="my-5 border-t border-gray-800" />

            {/* How it works */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
              How it works
            </p>
            <ul className="space-y-3">
              {[
                { icon: FolderSearch, text: "Scans repo with grep/find" },
                { icon: Cpu,          text: "Claude explores codebase" },
                { icon: Layers,       text: "Identifies key modules" },
                { icon: BookOpen,     text: "Writes IBM-style tutorials" },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-gray-400">
                  <span className="flex-shrink-0 w-5 h-5 rounded-md bg-gray-800 flex items-center justify-center mt-0.5">
                    <Icon className="w-3 h-3 text-brand-400" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            {/* Course stats (shown after generation) */}
            {course && (
              <>
                <div className="my-5 border-t border-gray-800" />
                <div className="space-y-2">
                  <StatRow
                    icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    label="Modules"
                    value={course.total_modules}
                  />
                  <StatRow
                    icon={<Clock className="w-3.5 h-3.5 text-amber-400" />}
                    label="Generated"
                    value={new Date(course.generated_at).toLocaleTimeString()}
                  />
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

          {/* Error banner */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">Generation failed</p>
                <p className="text-xs text-red-400/80 mt-0.5 font-mono">{error}</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && <LoadingState />}

          {/* Empty state */}
          {!loading && !course && !error && <EmptyState />}

          {/* Course output */}
          {!loading && course && (
            <div className="animate-fade-in">
              {/* Course header */}
              <div className="mb-8">
                <div className="flex items-center gap-2 text-xs text-brand-400 font-medium mb-2">
                  <Layers className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider">Generated Course</span>
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight">
                  {course.course_title}
                </h2>
                <p className="mt-1 text-sm text-gray-400 max-w-prose">
                  {course.course_description}
                </p>
                <p className="mt-2 text-xs font-mono text-gray-600 truncate">
                  {course.repository_path}
                </p>
              </div>

              {/* Module grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {course.modules.map((mod, idx) => (
                  <CourseCard
                    key={mod.id}
                    module={mod}
                    index={idx}
                    onClick={() => setSelectedModule(mod)}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Module detail modal ─────────────────────────────────────────── */}
      {selectedModule && (
        <ModuleModal
          module={selectedModule}
          onClose={() => setSelectedModule(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-gray-500">
        {icon}
        {label}
      </span>
      <span className="text-gray-300 font-medium">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-96 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-800/40 to-cyan-800/20 flex items-center justify-center mb-6 border border-brand-700/30">
        <BookOpen className="w-10 h-10 text-brand-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-300 mb-2">
        No course generated yet
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-xs">
        Enter a local repository path in the sidebar and click{" "}
        <span className="text-brand-400 font-medium">Generate Course</span> to
        create AI-powered learning modules.
      </p>
    </div>
  );
}
