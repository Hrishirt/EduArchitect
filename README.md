# EduArchitect: Autonomous Course Generation Engine

EduArchitect is an AI-powered systems tool designed to bridge the gap between complex codebases and developer education. By leveraging Agentic Workflows and Static Analysis, it automatically transforms raw source code into structured, high-quality technical tutorials and learning modules.

### Executive Summary
Standard documentation is often stale or disconnected from the source of truth. Software engineers frequently spend a significant percentage of their onboarding time attempting to map out directory structures and logical flows. EduArchitect solves this by providing an automated, AI-driven layer that interprets code intent and synthesizes it into pedagogical content.

### Core Functionality
EduArchitect utilizes a Multi-Agent System (MAS) to perform the following:
1. **Source Discovery:** Crawls local repositories using optimized *nix shell utilities to map file hierarchies.
2. **Logic Analysis:** Identifies critical architectural paths, high-complexity functions, and technical debt.
3. **Content Synthesis:** Generates standardized technical tutorials, API documentation, and interactive labs.

---

## Technical Stack
* **Backend:** FastAPI (High-performance Python ASGI)
* **Frontend:** React 18 + Vite + Tailwind CSS
* **Intelligence:** Claude 3.5 Sonnet via an optimized Agentic Reasoning Loop
* **System Tooling:** grep, find, and awk for low-level filesystem indexing
* **Database:** PostgreSQL for tutorial persistence and metadata caching

---

## System Architecture & Agentic Workflow
The platform operates on a "Reviewer-Writer" feedback loop to ensure technical accuracy:

* **The Scout Agent:** Executes shell-level commands to map directory structures and extract specific code snippets for analysis.
* **The Architect Agent:** Evaluates code dependencies, determines the optimal learning path, and identifies prerequisites.
* **The Technical Writer Agent:** Synthesizes the final Markdown content, focusing on clarity, technical accuracy, and step-by-step instruction.



---

## Installation and Deployment

### 1. Prerequisites
* Python 3.10+
* Node.js 18+
* Anthropic API Key (Environment variable: ANTHROPIC_API_KEY)

### 2. Installation
```bash
# Clone the repository
git clone [https://github.com/Hrishirt/EduArchitect.git](https://github.com/Hrishirt/EduArchitect.git)

# Initialize Backend
pip install -r requirements.txt

# Initialize Frontend
cd frontend && npm install
