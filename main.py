"""
Course Architect – AI-Powered Learning Module Generator
========================================================
Production-grade FastAPI backend implementing a custom, LangChain-free
agentic loop that converts any local code repository into IBM-style
interactive learning modules.

Architecture
────────────
  ┌─────────────┐      ┌──────────────────────────┐      ┌────────────────────┐
  │  GrepTool   │──▶   │  CourseArchitectAgent     │──▶   │ DocumentationAgent │
  │  (subprocess│      │  (custom agentic loop)    │      │  (Claude / Anthropic│
  │   grep/find)│      │  Plan → Explore → Write   │      │   IBM-style prose)  │
  └─────────────┘      └──────────────────────────┘      └────────────────────┘
         │                          │                               │
    OS-level search           Anthropic API               Structured Markdown

Author : Course Architect Team
Python : 3.11+
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

# ─────────────────────────────────────────────────────────────────────────────
# Bootstrap
# ─────────────────────────────────────────────────────────────────────────────

load_dotenv()  # reads .env from the working directory

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  │  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("course_architect")

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

CLAUDE_MODEL = "claude-sonnet-4-5"            # Best price / quality balance

# Extensions the agent considers "source code worth teaching"
SOURCE_EXTENSIONS = [
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".go", ".rs", ".java", ".cpp", ".c",
    ".rb", ".php", ".swift", ".kt", ".cs",
]

# How many lines to show per file read (keeps context window manageable)
MAX_FILE_LINES = 120

# Maximum tool-call iterations before forcing a final answer
MAX_AGENT_ITERATIONS = 12


# ─────────────────────────────────────────────────────────────────────────────
# Tool Definitions  (passed verbatim to the Anthropic tool-use API)
# ─────────────────────────────────────────────────────────────────────────────

AGENT_TOOLS: list[dict] = [
    {
        "name": "find_files",
        "description": (
            "Recursively find all source-code files inside a directory. "
            "Optionally filter by file extension (e.g. '.py', '.js'). "
            "Returns a JSON list of relative file paths."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {
                    "type": "string",
                    "description": "Absolute path of the directory to search.",
                },
                "extensions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of extensions to include, e.g. [\".py\", \".js\"]. "
                                   "Omit or pass [] to include all source files.",
                },
            },
            "required": ["directory"],
        },
    },
    {
        "name": "grep_code",
        "description": (
            "Run grep to search for a regex pattern inside a directory. "
            "Returns up to 40 matching lines with surrounding context, "
            "along with the file path and line number for each hit."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Regular-expression pattern to grep for.",
                },
                "directory": {
                    "type": "string",
                    "description": "Directory (or file path) to search.",
                },
                "context_lines": {
                    "type": "integer",
                    "description": "Lines of context around each match (default 3).",
                },
            },
            "required": ["pattern", "directory"],
        },
    },
    {
        "name": "read_file",
        "description": (
            "Read a source file and return its contents (up to MAX_FILE_LINES lines). "
            "Use this to inspect a file discovered by find_files or grep_code."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "filepath": {
                    "type": "string",
                    "description": "Absolute path to the file.",
                },
                "max_lines": {
                    "type": "integer",
                    "description": f"Maximum lines to return (default {MAX_FILE_LINES}).",
                },
            },
            "required": ["filepath"],
        },
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# GrepTool
# ─────────────────────────────────────────────────────────────────────────────

class GrepTool:
    """
    Low-level wrapper around the operating system's ``find`` and ``grep``
    utilities.  All calls are made via ``subprocess`` with a strict timeout
    so that a runaway search can never block the server.

    Design principles
    -----------------
    * Pure I/O class – no AI calls here.
    * Every method returns plain Python types (list / str) so the agent
      layer can easily JSON-serialise results.
    * Shell injection is prevented by always passing args as a list and
      never via shell=True.
    """

    # Directories that are never useful to crawl
    SKIP_DIRS = {
        "node_modules", ".git", "__pycache__", ".venv", "venv",
        "dist", "build", ".mypy_cache", ".pytest_cache", ".tox",
        "coverage", ".next", ".nuxt",
    }

    def find_files(
        self,
        directory: str,
        extensions: list[str] | None = None,
    ) -> list[str]:
        """
        Recursively find source files under *directory*.

        Parameters
        ----------
        directory  : Root path to search.
        extensions : Optional whitelist of extensions (e.g. ``[".py"]``).
                     Defaults to ``SOURCE_EXTENSIONS``.

        Returns
        -------
        Sorted list of absolute file paths, capped at 200 entries.
        """
        target_exts = extensions if extensions else SOURCE_EXTENSIONS
        root = Path(directory).resolve()

        if not root.exists():
            raise FileNotFoundError(f"Directory not found: {root}")

        results: list[str] = []
        for path in root.rglob("*"):
            # Skip hidden directories and well-known junk folders
            if any(part in self.SKIP_DIRS or part.startswith(".") for part in path.parts):
                continue
            if path.is_file() and path.suffix in target_exts:
                results.append(str(path))
                if len(results) >= 200:
                    break

        logger.info("find_files: %d files found under %s", len(results), root)
        return sorted(results)

    def grep_code(
        self,
        pattern: str,
        directory: str,
        context_lines: int = 3,
    ) -> list[dict[str, Any]]:
        """
        Run ``grep -rn`` for *pattern* inside *directory*.

        Returns a list of match objects::

            {
                "file":    "/abs/path/to/file.py",
                "line":    42,
                "match":   "    def train(self, X, y):",
                "context": "...surrounding lines..."
            }

        Capped at 40 results to keep token usage reasonable.
        """
        # Exclude noisy directories from grep
        exclude_args: list[str] = []
        for skip in self.SKIP_DIRS:
            exclude_args += ["--exclude-dir", skip]

        cmd = [
            "grep",
            "-rn",                          # recursive, with line numbers
            "--include=*.*",
            f"--context={context_lines}",
            *exclude_args,
            pattern,
            str(Path(directory).resolve()),
        ]

        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
            )
        except subprocess.TimeoutExpired:
            logger.warning("grep timed out for pattern '%s'", pattern)
            return []
        except FileNotFoundError:
            logger.error("grep binary not found – is it installed?")
            return []

        matches: list[dict] = []
        current_file: str | None = None
        context_buffer: list[str] = []

        for raw_line in proc.stdout.splitlines():
            # grep --context uses "--" as group separator
            if raw_line == "--":
                if current_file and context_buffer:
                    matches.append({
                        "file": current_file,
                        "context": "\n".join(context_buffer),
                    })
                    context_buffer = []
                continue

            # Matched lines:  /path/to/file.py:42:  def train(...)
            if ":" in raw_line:
                parts = raw_line.split(":", 2)
                if len(parts) >= 2 and parts[1].isdigit():
                    current_file = parts[0]
                    context_buffer.append(raw_line)
                    continue

            context_buffer.append(raw_line)

        # Flush last group
        if current_file and context_buffer:
            matches.append({"file": current_file, "context": "\n".join(context_buffer)})

        logger.info("grep_code: %d matches for pattern '%s'", len(matches), pattern)
        return matches[:40]

    def read_file(
        self,
        filepath: str,
        max_lines: int = MAX_FILE_LINES,
    ) -> str:
        """
        Safely read *filepath* and return its text content.

        Parameters
        ----------
        filepath  : Absolute path to the file.
        max_lines : Maximum lines to return.  Long files are truncated with
                    a trailing notice.

        Returns
        -------
        Plain-text file content.
        """
        path = Path(filepath).resolve()
        if not path.exists():
            return f"[ERROR] File not found: {filepath}"
        if not path.is_file():
            return f"[ERROR] Not a file: {filepath}"

        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError as exc:
            return f"[ERROR] Could not read file: {exc}"

        if len(lines) > max_lines:
            truncated = lines[:max_lines]
            truncated.append(f"\n... [truncated – {len(lines) - max_lines} more lines] ...")
            return "\n".join(truncated)

        return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# DocumentationAgent
# ─────────────────────────────────────────────────────────────────────────────

class DocumentationAgent:
    """
    Converts raw code snippets / module descriptions into richly-formatted,
    IBM-style technical tutorials.

    IBM technical writing style
    ---------------------------
    * Start with a clear "What you will learn" objective.
    * Use numbered procedural steps for walkthroughs.
    * Provide annotated code blocks with every significant line explained.
    * End with a "Key Concepts" summary and a "Next Steps" section.
    * Tone: precise, confident, vendor-neutral.
    """

    SYSTEM_PROMPT = """You are a senior IBM technical writer and software architect.
Your task is to produce crystal-clear, IBM-style developer documentation.

Formatting rules
────────────────
1. Open with a ## Overview section (2–3 sentences, WHY this module matters).
2. Include a ## Learning Objectives section (3–5 bullet points using "You will…").
3. Use ## Prerequisites if relevant libraries/concepts are required.
4. Walk through the code in ## Step-by-Step Walkthrough with numbered steps.
   - Every code block must be followed by an explanation paragraph.
5. Include a ## Key Concepts section with bold term → plain-English definition pairs.
6. Close with ## Next Steps (2–3 logical follow-on activities).

Tone: concise, authoritative, no filler phrases like "In this tutorial we will…".
Code blocks: always annotate with the correct language tag (```python, ```javascript, etc.).
Length: 400–700 words per tutorial (deep enough to be useful, short enough to finish).
"""

    def __init__(self, client: anthropic.Anthropic) -> None:
        self._client = client

    def generate_tutorial(
        self,
        module_title: str,
        file_path: str,
        code_snippet: str,
        language: str,
        context_description: str,
    ) -> dict[str, Any]:
        """
        Generate a single IBM-style tutorial for one code module.

        Response format — two clearly delimited sections so that Markdown
        content never lives inside a JSON string (which always breaks):

            <META>
            { "title": "...", "description": "...", ... }
            </META>
            <CONTENT>
            ## Overview
            ...full IBM Markdown tutorial...
            </CONTENT>
        """
        logger.info("DocumentationAgent: generating tutorial for '%s'", module_title)

        user_prompt = f"""Generate an IBM-style technical tutorial for the following code module.

Module Title     : {module_title}
Source File      : {file_path}
Language         : {language}
Agent's Context  : {context_description}

Source Code
───────────
```{language.lower()}
{code_snippet}
```

Your response MUST have exactly this structure — two XML-style sections, nothing else:

<META>
{{
  "title":          "<concise module title>",
  "description":    "<one-sentence card preview>",
  "difficulty":     "<Beginner | Intermediate | Advanced>",
  "estimated_time": "<e.g. 12 min>",
  "language":       "<programming language>",
  "tags":           ["<tag1>", "<tag2>", "<tag3>"],
  "key_concept":    "<the single most important concept this module teaches>"
}}
</META>
<CONTENT>
<full IBM-style Markdown tutorial here — use ## headings, numbered steps, code blocks>
</CONTENT>

Do NOT put the Markdown inside the JSON. Do NOT add anything outside the two tags."""

        response = self._client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2048,
            system=self.SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text.strip()

        # ── Parse <META> block (small JSON, no Markdown inside) ───────────
        meta_start = raw_text.find("<META>")
        meta_end   = raw_text.find("</META>")
        if meta_start == -1 or meta_end == -1:
            raise ValueError("Response missing <META> block")

        meta_json = raw_text[meta_start + len("<META>"):meta_end].strip()
        tutorial_data = json.loads(meta_json)

        # ── Parse <CONTENT> block (raw Markdown, no JSON encoding) ────────
        content_start = raw_text.find("<CONTENT>")
        content_end   = raw_text.find("</CONTENT>")
        if content_start == -1 or content_end == -1:
            raise ValueError("Response missing <CONTENT> block")

        tutorial_data["content"] = raw_text[
            content_start + len("<CONTENT>"):content_end
        ].strip()

        # ── Enrich with server-side metadata ──────────────────────────────
        tutorial_data["id"]           = str(uuid.uuid4())
        tutorial_data["file_path"]    = file_path
        tutorial_data["code_snippet"] = code_snippet

        return tutorial_data


# ─────────────────────────────────────────────────────────────────────────────
# CourseArchitectAgent  –  The Custom Agentic Loop
# ─────────────────────────────────────────────────────────────────────────────

class CourseArchitectAgent:
    """
    Orchestrates the full pipeline via a hand-written agentic loop.

    Loop design
    ───────────
    Phase 1  PLAN     Claude receives the directory summary and decides which
                      patterns / files to investigate.
    Phase 2  EXPLORE  Tool-use loop: Claude iteratively calls find_files,
                      grep_code, and read_file until it has gathered enough
                      evidence to identify the key teachable modules.
    Phase 3  EXTRACT  Claude emits a structured JSON list of modules it wants
                      documented (title, file, snippet, language, context).
    Phase 4  WRITE    DocumentationAgent turns each module into an IBM tutorial.
    Phase 5  RETURN   The compiled course dict is returned to the API.

    No LangChain, no external orchestration library – just the Anthropic
    messages API with tool_use blocks and plain Python control flow.
    """

    EXPLORATION_SYSTEM_PROMPT = """You are an expert software architect and curriculum designer.
Your job is to explore a code repository and identify the 4–6 most *educational* modules
(functions, classes, or logical units) that a developer should understand.

Use the provided tools to:
1. Discover the file layout (find_files).
2. Search for key patterns: class definitions, main entry points, core algorithms (grep_code).
3. Read the most interesting files in detail (read_file).

After your exploration, respond with ONLY a JSON array of modules you want documented:
[
  {
    "module_title":         "<descriptive title>",
    "file_path":            "<absolute path>",
    "code_snippet":         "<the key code block, verbatim from the file>",
    "language":             "<Python | JavaScript | …>",
    "context_description":  "<1–2 sentences on why this module matters>"
  },
  …
]

Rules:
- Prefer concrete, non-trivial code (algorithms, data pipelines, API handlers).
- Avoid boilerplate (imports-only files, __init__.py with no logic, config files).
- Keep code_snippet under 60 lines.
- Return 4–6 modules. No more, no less.
- Return ONLY the JSON array — no surrounding text."""

    def __init__(self) -> None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "ANTHROPIC_API_KEY is not set. "
                "Copy env.example → .env and add your key."
            )
        self._client = anthropic.Anthropic(api_key=api_key)
        self._grep_tool = GrepTool()
        self._doc_agent = DocumentationAgent(self._client)

    # ── Tool dispatcher ────────────────────────────────────────────────────

    def _dispatch_tool(self, tool_name: str, tool_input: dict) -> str:
        """
        Route a Claude tool-use request to the appropriate GrepTool method.
        Returns a plain-text string (the tool result).
        """
        try:
            if tool_name == "find_files":
                files = self._grep_tool.find_files(
                    directory=tool_input["directory"],
                    extensions=tool_input.get("extensions"),
                )
                return json.dumps(files, indent=2)

            elif tool_name == "grep_code":
                matches = self._grep_tool.grep_code(
                    pattern=tool_input["pattern"],
                    directory=tool_input["directory"],
                    context_lines=tool_input.get("context_lines", 3),
                )
                return json.dumps(matches, indent=2)

            elif tool_name == "read_file":
                # Hard-cap max_lines regardless of what the model requests —
                # prevents runaway context growth and token burn.
                requested = tool_input.get("max_lines", MAX_FILE_LINES)
                content = self._grep_tool.read_file(
                    filepath=tool_input["filepath"],
                    max_lines=min(requested, MAX_FILE_LINES),
                )
                return content

            else:
                return f"[ERROR] Unknown tool: {tool_name}"

        except Exception as exc:  # noqa: BLE001
            logger.exception("Tool '%s' raised an exception", tool_name)
            return f"[ERROR] {tool_name} failed: {exc}"

    # ── Phase 2 – Analyse repository (single-shot, rate-limit-friendly) ──

    def _explore_repository(self, directory: str) -> list[dict]:
        """
        Two-step pipeline that avoids multi-turn tool-use loops entirely:

        Step A  (Python, zero API cost)
            GrepTool scans the directory, reads every source file, and
            assembles a compact repo-snapshot string.

        Step B  (ONE Claude call)
            The snapshot is passed in a single prompt.  Claude returns
            the module JSON immediately — no back-and-forth, no rate-limit
            roulette.

        This trades the autonomous "ReAct" loop for a "Plan-then-Execute"
        pattern that is far more reliable under low-quota API keys while
        still demonstrating custom agentic orchestration.
        """
        # ── Step A: gather file inventory with Python (no API calls) ──────
        logger.info("Step A: scanning files with GrepTool …")
        all_files = self._grep_tool.find_files(directory)
        logger.info("  found %d source files", len(all_files))

        if not all_files:
            raise RuntimeError(
                f"No source files found in '{directory}'. "
                "Check the path or file extensions."
            )

        # Build a compact snapshot: file path + first MAX_FILE_LINES lines
        snapshot_parts: list[str] = []
        for fp in all_files[:30]:          # cap at 30 files to stay within context
            content = self._grep_tool.read_file(fp)
            rel = Path(fp).relative_to(Path(directory).resolve()) if Path(directory).resolve() in Path(fp).parents or str(Path(fp)).startswith(directory) else Path(fp)
            snapshot_parts.append(f"### FILE: {fp}\n```\n{content}\n```")

        repo_snapshot = "\n\n".join(snapshot_parts)
        logger.info("Step A complete: snapshot built (%d chars)", len(repo_snapshot))

        # ── Step B: single Claude call to identify modules ─────────────────
        logger.info("Step B: asking Claude to identify teachable modules …")

        prompt = f"""You are reviewing the following code repository located at: {directory}

Below is the full content of every source file found.

{repo_snapshot}

Based on this code, identify the 3–5 most *educational* and *concrete* modules
(functions, classes, algorithms, or logical units) that a developer should learn from this repo.

Return ONLY a JSON array — no surrounding text, no markdown fences:
[
  {{
    "module_title":         "<descriptive title>",
    "file_path":            "<absolute path>",
    "code_snippet":         "<the key code block verbatim, under 60 lines>",
    "language":             "<Python | JavaScript | …>",
    "context_description":  "<1–2 sentences on why this module matters>"
  }}
]

Rules:
- Prefer algorithms, data pipelines, core logic — not boilerplate or config files.
- code_snippet must be actual code copied verbatim from the file above.
- Return 3–5 modules. ONLY the JSON array."""

        response = self._client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text.strip()

        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.rsplit("```", 1)[0].strip()

        modules = json.loads(raw)
        logger.info("Step B complete: %d modules identified", len(modules))
        return modules

    # ── Phase 1 – Validate directory ──────────────────────────────────────

    @staticmethod
    def _validate_directory(directory: str) -> Path:
        path = Path(directory).resolve()
        if not path.exists():
            raise FileNotFoundError(f"Directory not found: {path}")
        if not path.is_dir():
            raise NotADirectoryError(f"Not a directory: {path}")
        return path

    # ── Public entry point ────────────────────────────────────────────────

    def run(self, directory: str) -> dict[str, Any]:
        """
        Execute the full pipeline for *directory* and return a structured
        course dictionary.

        Returns
        -------
        ::

            {
                "course_title":       str,
                "course_description": str,
                "repository_path":    str,
                "modules":            list[CourseModule],
                "total_modules":      int,
                "generated_at":       ISO-8601 str,
            }
        """
        root = self._validate_directory(directory)
        logger.info("CourseArchitectAgent.run  ─  repository: %s", root)

        # ── Phase 2: Scan + Analyse ───────────────────────────────────────
        logger.info("Phase 2: Scanning & analysing repository …")
        raw_modules = self._explore_repository(str(root))
        logger.info("Phase 2 complete: %d modules identified", len(raw_modules))

        # ── Phase 4: Write tutorials ──────────────────────────────────────
        logger.info("Phase 4: Generating IBM-style tutorials …")
        tutorials: list[dict] = []
        for mod in raw_modules:
            try:
                tutorial = self._doc_agent.generate_tutorial(
                    module_title=mod["module_title"],
                    file_path=mod["file_path"],
                    code_snippet=mod["code_snippet"],
                    language=mod["language"],
                    context_description=mod["context_description"],
                )
                tutorials.append(tutorial)
                logger.info("  ✓ '%s'", tutorial.get("title", mod["module_title"]))
            except Exception as exc:  # noqa: BLE001
                logger.error("  ✗ Tutorial failed for '%s': %s", mod["module_title"], exc)

        # ── Phase 5: Compile ──────────────────────────────────────────────
        course_title = f"Understanding {root.name}"
        course_description = (
            f"An AI-generated learning path covering the key architectural "
            f"components of the '{root.name}' codebase. "
            f"{len(tutorials)} modules · IBM-style documentation."
        )

        return {
            "course_title": course_title,
            "course_description": course_description,
            "repository_path": str(root),
            "modules": tutorials,
            "total_modules": len(tutorials),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Course Architect API",
    description=(
        "Converts any local code repository into AI-generated, IBM-style "
        "interactive learning modules."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# In production, narrow this to your actual frontend origin.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response Models ─────────────────────────────────────────────────

class GenerateCourseRequest(BaseModel):
    """Request body for /generate-course."""

    directory: str

    @field_validator("directory")
    @classmethod
    def directory_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("'directory' must not be empty.")
        return v.strip()


class HealthResponse(BaseModel):
    status: str
    version: str
    model: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    """
    Liveness probe.
    Returns service status, API version, and the Claude model in use.
    """
    return HealthResponse(status="ok", version="1.0.0", model=CLAUDE_MODEL)


@app.post("/generate-course", tags=["Course Generation"])
async def generate_course(request: GenerateCourseRequest) -> dict:
    """
    **Core endpoint** — triggers the full agentic pipeline.

    1. Validates the supplied *directory* path.
    2. Runs ``CourseArchitectAgent``:
       - Explores the repo with ``GrepTool`` (via Claude tool-use).
       - Generates IBM-style tutorials with ``DocumentationAgent``.
    3. Returns a structured course payload ready for the React dashboard.

    ---
    **Request body**
    ```json
    { "directory": "/absolute/path/to/your/repo" }
    ```

    **Response** — see ``CourseArchitectAgent.run`` docstring for full schema.
    """
    logger.info("POST /generate-course  directory=%s", request.directory)

    try:
        agent = CourseArchitectAgent()
        course = agent.run(request.directory)
        logger.info(
            "Course generated: '%s'  (%d modules)",
            course["course_title"],
            course["total_modules"],
        )
        return course

    except (FileNotFoundError, NotADirectoryError) as exc:
        logger.warning("Bad directory: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except EnvironmentError as exc:
        logger.error("Configuration error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    except json.JSONDecodeError as exc:
        logger.error("JSON parse error from Claude: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="The AI model returned malformed JSON. Please try again.",
        ) from exc

    except RuntimeError as exc:
        logger.error("Agent runtime error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected error in /generate-course")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {exc}",
        ) from exc


# ─────────────────────────────────────────────────────────────────────────────
# Dev entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
