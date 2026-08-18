# 🔎 CodeReviewAgent

### Multi-Agent AI Code Review System using LangGraph, Gemini & Groq

CodeReviewAgent is an **agentic AI-powered code review system** that automatically analyzes a software repository using multiple specialized AI agents.

Instead of relying on a single LLM to review the entire codebase, the system creates **three independent specialist agents**:

* 🛡️ **Security Agent** — searches for security vulnerabilities
* ⚡ **Performance Agent** — investigates performance bottlenecks
* 🎨 **Style Agent** — checks code quality, readability, and consistency

Each specialist can independently decide which tools to use, inspect the repository, investigate potential problems, and verify findings before reporting them.

A final **Synthesizer Agent** combines the findings from all specialists into one structured code review report.

---

## ✨ Features

* 🤖 **Multi-Agent Architecture**
* 🧠 **LangGraph-based orchestration**
* 🔄 **ReAct-style tool-calling loop**
* 🛡️ Security vulnerability analysis
* ⚡ Performance bottleneck detection
* 🎨 Code style and readability analysis
* 🔍 Repository-wide code search
* 📄 File inspection
* 🧪 Test execution for verification
* 🔧 Category-specific linting
* 📡 Real-time streaming using Server-Sent Events (SSE)
* 📊 Live agent execution traces
* 📝 Automatically generated final review report
* 🔀 Gemini + Groq LLM integration
* 🌐 FastAPI backend
* 🖥️ Gradio frontend

---

# 🏗️ Architecture

```text
                    ┌──────────────────────┐
                    │     Repository       │
                    │    User's Codebase   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Initial Analyzer    │
                    │       Gemini          │
                    └──────────┬───────────┘
                               │
                         Issues Found?
                               │
                    ┌──────────┴──────────┐
                    │                     │
                   YES                    NO
                    │                     │
          ┌─────────┼─────────┐           ▼
          ▼         ▼         ▼      ┌────────────┐
      Security  Performance  Style   │ Clean      │
       Agent      Agent      Agent   │ Report     │
          │         │         │      └────────────┘
          │         │         │
          ▼         ▼         ▼
       ┌───────────────────────────────┐
       │          Tool Layer           │
       │                               │
       │  search_code                  │
       │  read_file                    │
       │  run_test                     │
       │  run_linter                   │
       └───────────────┬───────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │   ReAct Loop     │
              │                  │
              │ Think → Tool →   │
              │ Result → Think   │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │   Synthesizer    │
              │      Groq        │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │   Final Report   │
              │                  │
              │ Summary          │
              │ Issues           │
              │ Recommendations  │
              │ Action Items     │
              └──────────────────┘
```

---

# 🧠 How It Works

## 1. Repository Analysis

The user provides the path of a local repository.

The system creates a lightweight snapshot of supported source files such as:

```text
.py
.js
.ts
.jsx
.tsx
```

Large or unnecessary directories such as:

```text
.git
node_modules
__pycache__
dist
build
.venv
venv
```

are excluded from the snapshot.

The snapshot is used to give the initial analyzer context about the project.

---

## 2. Initial Analyzer

The first AI node performs a high-level analysis of the repository.

It focuses on:

* Project purpose
* Code structure
* Potential concerns

The analyzer finishes with one of two verdicts:

```text
VERDICT: ISSUES
```

or

```text
VERDICT: CLEAN
```

If the repository appears clean, the graph can finish early.

If issues are detected, the review is routed to all three specialist agents.

---

# 🤖 Multi-Agent Review

## 🛡️ Security Agent

The Security Agent focuses specifically on security-related problems such as:

* Injection vulnerabilities
* Authentication flaws
* Hardcoded secrets
* Unsafe deserialization
* SSRF
* Other exploitable security issues

It first uses the security linter and then investigates suspicious locations using repository tools.

The agent is instructed to report only **confirmed issues**, rather than simply guessing that something might be vulnerable.

---

## ⚡ Performance Agent

The Performance Agent investigates potential bottlenecks such as:

* N+1 queries
* Blocking synchronous operations
* Unnecessary computation
* Redundant work
* Memory-related issues
* Expensive operations inside loops or frequently executed paths

It can inspect surrounding code and use tests for quick performance verification when necessary.

---

## 🎨 Style Agent

The Style Agent focuses on maintainability and readability.

It investigates:

* Naming conventions
* Code organization
* Documentation
* PEP8-style issues
* Duplication
* Magic numbers
* Repeated structural patterns

Unlike the other specialists, the Style Agent generally does not need to execute tests because style issues can usually be verified through source inspection.

---

# 🔧 Agent Tools

The specialist agents have access to four tools:

| Tool          | Purpose                                          |
| ------------- | ------------------------------------------------ |
| `search_code` | Search the repository for relevant code patterns |
| `read_file`   | Read a specific file for deeper investigation    |
| `run_test`    | Execute a small test or verification script      |
| `run_linter`  | Run category-specific linting checks             |

The important part is that **the LLM decides when to use these tools**.

For example:

```text
Security Agent
      ↓
run_linter("security")
      ↓
Potential issue found
      ↓
search_code(...)
      ↓
read_file(...)
      ↓
run_test(...)
      ↓
Confirmed / rejected
```

This makes the system more than a simple prompt-based code reviewer.

---

# 🔄 ReAct Agent Loop

Each specialist follows a ReAct-style workflow:

```text
        ┌───────────────┐
        │   Specialist  │
        │     Agent     │
        └───────┬───────┘
                │
                ▼
          Decide what to do
                │
        ┌───────┴───────┐
        │               │
     Use Tool        Conclude
        │               │
        ▼               ▼
   Tool Result      Findings
        │
        └───────► Agent
                   │
                   ▼
              Use another
                 tool
```

The agent can repeatedly:

1. Analyze the available evidence
2. Select a tool
3. Receive the tool result
4. Analyze the result
5. Continue investigating
6. Conclude once enough evidence is available

Each specialist is limited to a maximum number of investigation iterations to prevent endless tool-calling loops.

---

# 🔀 LLM Provider Architecture

The project uses multiple LLM providers:

| Component         | Model Provider |
| ----------------- | -------------- |
| Initial Analyzer  | Google Gemini  |
| Security Agent    | Groq           |
| Performance Agent | Google Gemini  |
| Style Agent       | Groq           |
| Final Synthesizer | Groq           |

This demonstrates how an agentic pipeline can distribute different workloads across multiple LLM providers instead of depending on a single model.

The LLM configuration is handled through environment variables.

---

# 📡 Real-Time Streaming

The backend exposes a streaming endpoint:

```text
POST /review/stream
```

Instead of waiting for the entire review to finish, the frontend receives agent updates as they happen.

The backend uses:

```text
Server-Sent Events (SSE)
```

to stream information such as:

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

This is what powers the **Live Trace** section in the frontend.

The UI can therefore show what each specialist is doing while the review is running.

---

# 📊 Final Report

After the three specialists finish, their findings are passed to a final synthesizer.

The synthesizer combines:

```text
Security Findings
       +
Performance Findings
       +
Style Findings
       ↓
Final Synthesized Report
```

The report contains sections such as:

### Summary

A high-level overview of the review.

### Issues by Category

```text
Security
Performance
Style
```

### Recommendations

Suggested improvements based on the findings.

### Action Items

Practical tasks that can be assigned to owners with suggested deadlines.

---

# 🖥️ Frontend

The frontend is built with **Gradio** and communicates with the FastAPI backend.

It provides:

* Repository path input
* Backend URL configuration
* Review trigger
* Initial analysis
* Security live trace
* Performance live trace
* Style live trace
* Findings by category
* Final generated report

Example workflow:

```text
Enter Repository Path
        ↓
Run Review
        ↓
Initial Analysis
        ↓
┌───────────┬─────────────┬───────────┐
│ Security  │ Performance │   Style   │
│   Agent   │    Agent    │   Agent   │
└───────────┴─────────────┴───────────┘
        ↓
Live Tool Traces
        ↓
Final Report
```

---

# 📁 Project Structure

```text
agentic_ai/
│
├── .vscode/
│   └── settings.json
│
└── CodeReviewAgent-LangGraph/
    │
    ├── backend/
    │   ├── __pycache__/
    │   ├── .env
    │   ├── app.py
    │   └── tools.py
    │
    ├── Frontend/
    │   ├── __pycache__/
    │   └── app_ui.py
    │
    ├── .gitignore
    └── README.md
```

### Backend

`app.py`

Contains:

* LangGraph workflow
* LLM configuration
* Specialist agents
* ReAct loops
* State management
* Synthesizer
* FastAPI endpoints
* SSE streaming

`tools.py`

Contains the tools used by the specialist agents.

### Frontend

`app_ui.py`

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

* Repository search
* File reading
* Test execution
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

---

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

---

## 3. Install Dependencies

Install the required packages:

```bash
pip install langgraph langchain langchain-core langchain-google-genai langchain-groq fastapi uvicorn python-dotenv pydantic gradio
```

If your `tools.py` uses additional packages for linting or testing, install those as well.

---

# 🔐 Environment Variables

Create a `.env` file inside:

```text
backend/.env
```

Add your API credentials:

```env
GOOGLE_API_KEY=your_google_api_key
GROQ_API_KEY=your_groq_api_key

GROQ_MODEL=openai/gpt-oss-20b
```

> ⚠️ Never commit your `.env` file to GitHub.

Make sure `.env` is included in `.gitignore`.

---

# ▶️ Running the Application

The application consists of two parts:

```text
FastAPI Backend
      +
Gradio Frontend
```

## Start the Backend

From the backend directory:

```bash
cd backend
python app.py
```

The FastAPI server runs on:

```text
http://localhost:8000
```

---

## Start the Frontend

Open another terminal:

```bash
cd Frontend
python app_ui.py
```

Then open the Gradio URL displayed in your terminal.

The frontend should use:

```text
Backend URL:
http://localhost:8000
```

---

# 🔌 API Endpoints

## `POST /review`

Runs the complete review and returns the final result after processing.

Example request:

```json
{
  "repo_path": "C:\\path\\to\\your\\repository",
  "entry_summary": ""
}
```

Example response structure:

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

---

## `POST /review/stream`

Runs the review while streaming graph updates using SSE.

This endpoint is used by the frontend to display the live agent trace.

The stream contains updates from nodes such as:

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

The underlying workflow can be represented as:

```text
                    START
                      │
                      ▼
                 ┌─────────┐
                 │ Analyzer│
                 └────┬────┘
                      │
              ┌───────┴───────┐
              │               │
         Issues Found?       Clean
              │               │
             YES              ▼
              │         finish_clean
      ┌───────┼───────┐
      ▼       ▼       ▼
   Security Performance Style
      │       │       │
      ▼       ▼       ▼
   Tool Loop Tool Loop Tool Loop
      │       │       │
      ▼       ▼       ▼
   Conclude Conclude Conclude
      └───────┼───────┘
              ▼
         Synthesizer
              │
              ▼
             END
```

This graph allows the three specialist agents to investigate independently before their results are merged.

---

# 🛡️ Design Philosophy

The system is designed around one important principle:

> **Don't report a potential issue until there is enough evidence to support it.**

For example, the Security Agent may find something that looks like a secret:

```text
Potential secret found
        ↓
search surrounding code
        ↓
read relevant file
        ↓
determine whether it is actually sensitive
        ↓
confirm or reject finding
```

This reduces false positives compared with simply asking an LLM:

```text
"Find security problems in this code."
```

---

# 📈 Example Output

A completed review can produce:

```text
Code Review Report

Summary
-------
The codebase was reviewed by three specialist agents.

Issues by Category
------------------
Security:
None confirmed

Performance:
None confirmed

Style:
None confirmed

Recommendations
---------------
• Run dependency audits regularly
• Add automated testing to CI
• Maintain consistent code style
• Keep project documentation updated

Action Items
------------
• Set up automated dependency audit
• Add performance profiling
• Update PR review checklist
• Review documentation
```

The frontend also displays the intermediate investigation process through the live traces.

---

# 🎯 Why This Project Is Agentic

This project is not simply:

```text
Code → LLM → Review
```

Instead, it follows an agentic workflow:

```text
Code
 ↓
Planner / Analyzer
 ↓
Specialist Agents
 ↓
LLM decides which tool to use
 ↓
Tool execution
 ↓
Tool result
 ↓
Further investigation
 ↓
Specialist conclusion
 ↓
Multi-agent synthesis
 ↓
Final report
```

The key agentic behavior is that the specialists can **choose and repeatedly use tools based on what they discover**.

---

# 🔮 Future Improvements

Possible extensions include:

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
* Support for additional programming languages
* Human approval before applying fixes

---

# 📌 Limitations

Currently, the system primarily works with repositories available on the local filesystem.

The initial repository snapshot is also intentionally limited in size, meaning extremely large repositories may not have their entire contents included in the initial context.

The specialist agents compensate for this by using repository tools to search and inspect specific files during their investigation.

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

