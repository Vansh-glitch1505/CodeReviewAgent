# 🔎 CodeReviewAgent

### Multi-Agent AI Code Review System using LangGraph, Gemini & Groq

CodeReviewAgent is an **agentic AI-powered code review system** that analyzes a software repository using multiple specialized AI agents.

Instead of relying on a single LLM, the system uses three independent specialists:

* 🛡️ **Security Agent** — detects security vulnerabilities
* ⚡ **Performance Agent** — identifies performance bottlenecks
* 🎨 **Style Agent** — checks code quality and maintainability

A final **Synthesizer Agent** combines their findings into a structured code review report.

---

## ✨ Features

* 🤖 Multi-Agent Architecture
* 🧠 LangGraph orchestration
* 🔄 ReAct-style tool-calling
* 🛡️ Security analysis
* ⚡ Performance analysis
* 🎨 Code style analysis
* 🔍 Repository-wide code search
* 📄 File inspection
* 🧪 Test execution
* 🔧 Category-specific linting
* 📡 Real-time streaming using SSE
* 📊 Live agent execution traces
* 📝 Automated review reports
* 🔀 Gemini + Groq integration
* 🌐 FastAPI backend
* 🖥️ Gradio frontend

---

# 🏗️ Architecture

![](https://github.com/Vansh-glitch1505/CodeReviewAgent/blob/6a4b48c73f54ebe2618f208545656d5eaff8a31f/codeReview_Workflow.png)

---

# 🧠 How It Works

### 1. Repository Analysis

The user provides a local repository path.

The system creates a lightweight snapshot of supported source files:

```text
.py
.js
.ts
.jsx
.tsx
```

Large or unnecessary directories are excluded:

```text
.git
node_modules
__pycache__
dist
build
.venv
venv
```

The snapshot provides the initial context for the analyzer.

### 2. Initial Analyzer

The analyzer performs a high-level review focused on:

* Project purpose
* Code structure
* Potential concerns

It returns either:

```text
VERDICT: ISSUES
```

or

```text
VERDICT: CLEAN
```

If the repository is clean, the workflow can finish early. Otherwise, the review is routed to all three specialist agents.

---

# 🤖 Multi-Agent Review

### 🛡️ Security Agent

Investigates issues such as:

* Injection vulnerabilities
* Authentication flaws
* Hardcoded secrets
* Unsafe deserialization
* SSRF
* Other exploitable security issues

The agent uses security linting and repository tools to verify suspicious findings.

### ⚡ Performance Agent

Investigates:

* N+1 queries
* Blocking operations
* Unnecessary computation
* Redundant work
* Memory-related issues
* Expensive operations in loops or frequently executed paths

### 🎨 Style Agent

Focuses on:

* Naming conventions
* Code organization
* Documentation
* PEP8-style issues
* Duplication
* Magic numbers
* Repeated structural patterns

The specialists are instructed to investigate evidence before reporting an issue.

---

# 🔧 Agent Tools

The agents can use four tools:

| Tool          | Purpose                                     |
| ------------- | ------------------------------------------- |
| `search_code` | Search the repository for relevant patterns |
| `read_file`   | Inspect files in detail                     |
| `run_test`    | Run tests or verification scripts           |
| `run_linter`  | Perform category-specific linting           |

The important part is that **the LLM decides when and which tools to use**.

A typical investigation can look like:

```text
Specialist Agent
      ↓
   Run Linter
      ↓
Potential Issue
      ↓
  Search Code
      ↓
   Read File
      ↓
   Run Test
      ↓
Confirmed / Rejected
```

This allows the system to investigate findings rather than simply generating a review from a single prompt.

---

# 🔄 ReAct Workflow

Each specialist follows a ReAct-style loop:

```text
Analyze Evidence
      ↓
Choose Tool
      ↓
Execute Tool
      ↓
Analyze Result
      ↓
Investigate Further
      ↓
Conclude
```

Agents can repeatedly use tools based on what they discover, with a maximum number of iterations to prevent endless tool-calling loops.

---

# 🔀 LLM Provider Architecture

| Component         | Provider      |
| ----------------- | ------------- |
| Initial Analyzer  | Google Gemini |
| Security Agent    | Groq          |
| Performance Agent | Google Gemini |
| Style Agent       | Groq          |
| Final Synthesizer | Groq          |

Using multiple providers allows different parts of the pipeline to distribute workloads across different LLMs.

Configuration is handled through environment variables.

---

# 📡 Real-Time Streaming

The backend exposes:

```text
POST /review/stream
```

The review is streamed to the frontend using **Server-Sent Events (SSE)**.

Instead of waiting for the complete review, the UI receives updates such as:

```text
Security Agent
      ↓
run_linter
      ↓
search_code
      ↓
read_file
      ↓
concluded
```

This powers the **Live Trace** interface and allows users to see what each agent is doing in real time.

---

# 📊 Final Report

Once the specialist agents finish, their findings are passed to the Synthesizer:

```text
Security Findings
       +
Performance Findings
       +
Style Findings
       ↓
Final Synthesized Report
```

The final report includes:

* **Summary**
* **Issues by Category**
* **Recommendations**
* **Action Items**

![](https://github.com/Vansh-glitch1505/CodeReviewAgent/blob/main/WhatsApp%20Image%202026-09-12%20at%2012.58.39.jpeg)

![](https://github.com/Vansh-glitch1505/CodeReviewAgent/blob/main/WhatsApp%20Image%202026-09-12%20at%2013.01.37.jpeg)

![](https://github.com/Vansh-glitch1505/CodeReviewAgent/blob/main/WhatsApp%20Image%202026-09-12%20at%2013.00.30.jpeg)

---

# 🖥️ Frontend

The frontend provides a developer-tool interface for running and monitoring AI-powered code reviews.

### Features

* Repository path input
* Backend health status
* LangGraph workflow visualization
* Security, Performance & Style monitoring
* Live agent/tool traces
* Categorized findings
* Severity indicators
* Expandable finding details
* Final synthesized report
* Syntax-highlighted code viewing
* Responsive dark developer interface

### Workflow

```text
Enter Repository Path
        ↓
   Run Code Review
        ↓
   Initial Analyzer
        ↓
┌───────────┬─────────────┬───────────┐
│ Security  │ Performance │   Style   │
│   Agent   │    Agent    │   Agent   │
└───────────┴─────────────┴───────────┘
        ↓
 Live Agent Tool Traces
        ↓
 Findings by Category
        ↓
    Synthesizer
        ↓
 Final Review Report
```

---

# 📁 Project Structure

```text
CodeReviewAgent-LangGraph/
│
├── backend/
│   ├── .env
│   ├── app.py
│   └── tools.py
│
├── Frontend/
│   └── app_ui.py
│
├── .gitignore
└── README.md
```

### Backend

**`app.py`**

Contains:

* LangGraph workflow
* LLM configuration
* Specialist agents
* ReAct loops
* State management
* Synthesizer
* FastAPI endpoints
* SSE streaming

**`tools.py`**

Contains the repository search, file inspection, testing, and linting tools used by the agents.

### Frontend

**`app_ui.py`**

Contains the Gradio interface and communicates with the FastAPI backend.

---

# ⚙️ Tech Stack

### AI / LLM

* Google Gemini
* Groq
* LangChain
* LangGraph

### Backend

* Python
* FastAPI
* Pydantic
* Uvicorn

### Frontend

* Gradio

### Agent Tools

* Repository Search
* File Reading
* Test Execution
* Linting

### Communication

* REST API
* Server-Sent Events (SSE)

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd CodeReviewAgent-LangGraph
```

## 2. Create a Virtual Environment

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

## 3. Install Dependencies

```bash
pip install langgraph langchain langchain-core langchain-google-genai langchain-groq fastapi uvicorn python-dotenv pydantic gradio
```

Install any additional packages required by `tools.py` for linting or testing.

---

# 🔐 Environment Variables

Create:

```text
backend/.env
```

Add:

```env
GOOGLE_API_KEY=your_google_api_key
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b
```

⚠️ Never commit `.env` to GitHub.

Make sure it is included in `.gitignore`.

---

# ▶️ Running the Application

The application consists of:

```text
FastAPI Backend
      +
Gradio Frontend
```

### Start Backend

```bash
cd backend
python app.py
```

Backend:

```text
http://localhost:8000
```

### Start Frontend

Open another terminal:

```bash
cd Frontend
python app_ui.py
```

Open the Gradio URL shown in the terminal.

The frontend connects to:

```text
http://localhost:8000
```

---

# 🔌 API Endpoints

## `POST /review`

Runs the complete review and returns the final result.

Example request:

```json
{
  "repo_path": "C:\\path\\to\\your\\repository",
  "entry_summary": ""
}
```

Example response:

```json
{
  "analysis": "...",
  "security_findings": [],
  "performance_findings": [],
  "style_findings": [],
  "trace": {
    "security": [],
    "performance": [],
    "style": []
  },
  "report": "..."
}
```

## `POST /review/stream`

Runs the review while streaming LangGraph updates using SSE.

The stream includes nodes such as:

```text
analyzer
security_agent
security_tool_node
security_conclude
performance_agent
performance_tool_node
performance_conclude
style_agent
style_tool_node
style_conclude
synthesizer
```

---

# 🧩 LangGraph Workflow

```text
                    START
                      │
                      ▼
                 ┌─────────┐
                 │ Analyzer│
                 └────┬────┘
                      │
               Issues Found?
                 │         │
                YES       NO
                 │         │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
   Security  Performance  Style
       │         │         │
       ▼         ▼         ▼
   Tool Loop  Tool Loop  Tool Loop
       │         │         │
       ▼         ▼         ▼
    Conclude  Conclude  Conclude
       └─────────┼─────────┘
                 ▼
            Synthesizer
                 │
                 ▼
                END
```

The three specialist agents investigate independently before their findings are merged by the Synthesizer.

---

# 🛡️ Design Philosophy

The system follows one core principle:

> **Don't report a potential issue until there is enough evidence to support it.**

For example:

```text
Potential Issue
      ↓
Search Code
      ↓
Read Relevant File
      ↓
Verify Evidence
      ↓
Confirm / Reject
```

This helps reduce false positives compared with simply asking an LLM to find problems in a codebase.

---

# 🎯 Why This Project Is Agentic

The system goes beyond:

```text
Code → LLM → Review
```

Instead:

```text
Code
 ↓
Analyzer
 ↓
Specialist Agents
 ↓
LLM chooses tools
 ↓
Tool execution
 ↓
Tool results
 ↓
Further investigation
 ↓
Specialist conclusions
 ↓
Multi-Agent Synthesis
 ↓
Final Report
```

The key agentic behavior is that agents can **choose and repeatedly use tools based on the evidence they discover**.

---

# 🔮 Future Improvements

* GitHub repository integration
* Pull Request review automation
* GitHub Actions integration
* Automatic code-fix suggestions
* Patch generation
* Line-level findings
* Severity scoring
* Code quality metrics
* Test coverage analysis
* Dependency vulnerability scanning
* Persistent review history
* Review comparison across commits
* Additional programming languages
* Human approval before applying fixes

---

# 📌 Limitations

* Currently focused primarily on repositories available on the local filesystem.
* The initial repository snapshot is intentionally limited in size.
* Extremely large repositories may not fit entirely into the initial context.
* Repository tools allow agents to search and inspect specific files when additional context is required.

---

# 👨‍💻 Author

**Vansh Rotkar**

Built as an exploration of:

* Agentic AI
* Multi-Agent Systems
* LangGraph
* LLM Tool Calling
* ReAct Agents
* Code Analysis
* FastAPI
* Real-Time AI Interfaces

---

## ⭐ If you found this project interesting

Give the repository a ⭐ and feel free to explore the implementation!

