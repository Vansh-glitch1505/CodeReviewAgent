import json
import time
from typing import TypedDict, List, Dict, Annotated
import os
import operator
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage, AIMessage

from tools import make_agent_tools

load_dotenv()

MAX_SPECIALIST_ITERS = 4
SPECIALISTS = ("security", "performance", "style")

# Groq's TPM (8000) is far smaller than Gemini's, so give each specialist
# its own snapshot budget instead of feeding everyone the full 40KB snapshot.
SPECIALIST_SNAPSHOT_CHARS = {
    "security": 10_000,     # groq
    "performance": 35_000,  # gemini — much higher limit, keep full snapshot
    "style": 10_000,        # groq
}

SPECIALIST_PROMPTS = {
    "security": (
        "You are a security reviewer investigating a codebase for real, confirmed "
        "vulnerabilities (injection, auth flaws, hardcoded secrets, unsafe "
        "deserialization, SSRF, etc). You have tools: search_code, read_file, "
        "run_test, run_linter. Use run_linter(category='security') as a starting "
        "signal, then confirm reachability/exploitability with search_code/read_file, "
        "and run_test for a PoC when needed. When done, respond with NO further tool "
        "calls and list 0-5 confirmed issues, each as '-issue'. If none: 'NONE CONFIRMED'."
    ),
    "performance": (
        "You are a performance reviewer investigating a codebase for real bottlenecks "
        "(N+1 queries, blocking/sync calls that should be async, redundant work, memory "
        "issues). You have tools: search_code, read_file, run_test, run_linter. Use "
        "run_linter(category='performance') as a starting signal, then check call "
        "frequency/context with search_code/read_file, and run_test for a quick timing "
        "comparison when it confirms a suspected bottleneck. When done, respond with NO "
        "further tool calls and list 0-5 confirmed issues, each as '-issue'. If none: "
        "'NONE CONFIRMED'."
    ),
    "style": (
        "You are a style/readability reviewer investigating a codebase (naming, structure, "
        "docstrings, PEP8, duplication, magic numbers). You have tools: search_code, "
        "read_file, run_linter. Use run_linter(category='style') as a starting signal, "
        "then check with search_code whether a pattern repeats before flagging it. Skip "
        "run_test unless you have a concrete reason. When done, respond with NO further "
        "tool calls and list 0-5 confirmed issues, each as '-issue'. If none: 'NONE CONFIRMED'."
    ),
}


class CodeReviewRequest(BaseModel):
    repo_path: str


class CodeReviewState(TypedDict):
    repo_path: str
    code: str
    initial_analysis: str
    has_issues: bool

    security_findings: List[str]
    performance_findings: List[str]
    style_findings: List[str]

    security_messages: Annotated[List, operator.add]
    security_iterations: int
    performance_messages: Annotated[List, operator.add]
    performance_iterations: int
    style_messages: Annotated[List, operator.add]
    style_iterations: int

    final_report: str


# ---------------------------------------------------------------------------
# Token-budget helpers (Groq TPM = 8000, so specialist message history must
# be trimmed before every invoke, not just at the start).
# ---------------------------------------------------------------------------

def _approx_tokens(text: str) -> int:
    return len(text) // 4  # rough heuristic, ~4 chars/token


def _msg_text(m) -> str:
    c = m.content
    return c if isinstance(c, str) else str(c)


def _trim_messages_to_budget(messages: List, budget_tokens: int = 5500) -> List:
    """Keep SystemMessage + as many recent messages as fit in budget_tokens.
    Older ToolMessages get truncated (not dropped) so context isn't lost entirely."""
    system = [m for m in messages if isinstance(m, SystemMessage)]
    rest = [m for m in messages if not isinstance(m, SystemMessage)]

    total = sum(_approx_tokens(_msg_text(m)) for m in system)
    kept = []
    for m in reversed(rest):  # newest first
        t = _approx_tokens(_msg_text(m))
        if total + t > budget_tokens:
            if isinstance(m, ToolMessage):
                truncated = _msg_text(m)[:600] + "\n...[truncated to fit token budget]"
                t2 = _approx_tokens(truncated)
                if total + t2 <= budget_tokens:
                    kept.append(ToolMessage(content=truncated, tool_call_id=m.tool_call_id))
                    total += t2
            continue  # drop if it still doesn't fit
        kept.append(m)
        total += t
    kept.reverse()
    return system + kept


def _invoke_with_backoff(llm, messages, retries: int = 3):
    """Invoke with retry + harder trimming if we still hit a 413/429."""
    for attempt in range(retries):
        try:
            return llm.invoke(messages)
        except Exception as e:
            msg = str(e)
            rate_limited = "429" in msg or "413" in msg or "rate_limit" in msg.lower()
            if rate_limited and attempt < retries - 1:
                messages = _trim_messages_to_budget(messages, budget_tokens=3500)
                time.sleep(2 ** attempt)
                continue
            raise


class SimpleCodeReviewAgent:
    def __init__(self):
        self.gemini_llm = ChatGoogleGenerativeAI(
            model="gemini-3.6-flash", google_api_key=os.getenv("GOOGLE_API_KEY"), temperature=0.3
        )
        self.groq_llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
            groq_api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.3,
        )
        # which provider handles each specialist
        self.specialist_llms = {"security": self.groq_llm, "performance": self.gemini_llm, "style": self.groq_llm}
        self.graph = self._build_graph()

    # ---- helpers ----

    @staticmethod
    def _snapshot_repo(repo_path: str, max_bytes: int = 40_000) -> str:
        skip_dirs = {".git", "node_modules", "__pycache__", "dist", "build", ".venv", "venv"}
        chunks, total = [], 0
        for root, dirnames, files in os.walk(repo_path):
            dirnames[:] = [d for d in dirnames if d not in skip_dirs]
            for f in files:
                if not f.endswith((".py", ".js", ".ts", ".jsx", ".tsx")):
                    continue
                path = os.path.join(root, f)
                try:
                    with open(path, errors="ignore") as fh:
                        content = fh.read()
                except Exception:
                    continue
                block = f"\n# ---- {os.path.relpath(path, repo_path)} ----\n{content}"
                if total + len(block) > max_bytes:
                    chunks.append("\n...[snapshot truncated]")
                    return "".join(chunks)
                chunks.append(block)
                total += len(block)
        return "".join(chunks)

    @staticmethod
    def _parse_findings(content: str) -> List[str]:
        if "NONE CONFIRMED" in content.upper():
            return []
        return [line.strip() for line in content.split("\n") if line.strip().startswith("-")]

    @staticmethod
    def _to_text(content) -> str:
        """Normalize AIMessage.content (sometimes a list of parts from Gemini) to plain text."""
        if content is None:
            return ""
        if isinstance(content, list):
            return "\n".join(
                p.get("text", "") if isinstance(p, dict) else str(p) for p in content
            )
        return str(content)

    # ---- entry node ----

    def _analysis_agent(self, state: CodeReviewState) -> Dict:
        code = self._snapshot_repo(state["repo_path"])
        prompt = (
            f"Analyse the code briefly:\n{code}\n"
            "Focus on: purpose, structure and concerns.\n"
            'End your response with exactly one line: "VERDICT: ISSUES" or "VERDICT: CLEAN"'
        )
        analysis = self._to_text(self.gemini_llm.invoke(prompt).content)
        return {"code": code, "initial_analysis": analysis, "has_issues": "VERDICT: ISSUES" in analysis.upper()}

    def _route_after_analysis(self, state: CodeReviewState) -> List[str]:
        return [f"{k}_agent" for k in SPECIALISTS] if state["has_issues"] else ["finish_clean"]

    # ---- generic ReAct specialist (shared by security / performance / style) ----

    def _specialist_agent_node(self, key: str, state: CodeReviewState) -> Dict:
        messages_key, iters_key = f"{key}_messages", f"{key}_iterations"
        tools = make_agent_tools(state["repo_path"])
        llm_with_tools = self.specialist_llms[key].bind_tools(tools)

        existing = state.get(messages_key)
        if not existing:
            snapshot = state["code"]
            limit = SPECIALIST_SNAPSHOT_CHARS.get(key)
            if limit and len(snapshot) > limit:
                snapshot = snapshot[:limit] + "\n...[snapshot truncated for token budget]"
            messages = [
                SystemMessage(content=SPECIALIST_PROMPTS[key]),
                HumanMessage(content=f"Repo snapshot for context:\n{snapshot}\n\nInvestigate now."),
            ]
        else:
            messages = existing

        trimmed = _trim_messages_to_budget(messages)
        response = _invoke_with_backoff(llm_with_tools, trimmed)
        delta = [response] if existing else messages + [response]
        return {messages_key: delta, iters_key: state.get(iters_key, 0) + 1}

    def _specialist_decide(self, key: str, state: CodeReviewState) -> str:
        last = state[f"{key}_messages"][-1]
        if state[f"{key}_iterations"] >= MAX_SPECIALIST_ITERS:
            return "conclude"
        if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
            return "use_tool"
        return "conclude"

    def _specialist_tool_node(self, key: str, state: CodeReviewState) -> Dict:
        messages_key = f"{key}_messages"
        tools = {t.name: t for t in make_agent_tools(state["repo_path"])}
        last = state[messages_key][-1]
        tool_messages = []
        for call in last.tool_calls:
            fn = tools.get(call["name"])
            try:
                result = fn.invoke(call["args"]) if fn else f"Unknown tool '{call['name']}'"
            except Exception as e:
                result = f"Tool error: {e}"
            tool_messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
        return {messages_key: tool_messages}

    def _specialist_conclude(self, key: str, state: CodeReviewState) -> Dict:
        last = state[f"{key}_messages"][-1]
        content = self._to_text(last.content) if isinstance(last, AIMessage) else str(last)
        if not content.strip():
            content = "NONE CONFIRMED (max investigation iterations reached without a clear answer)"
        return {f"{key}_findings": self._parse_findings(content)}

    # ---- Synthesizer (fan-in) ----

    def _synthesizer(self, state: CodeReviewState) -> Dict:
        prompt = (
            "Combine these findings from three specialist reviewers into one cohesive "
            "code review report with sections: Summary, Issues by Category "
            "(Security / Performance / Style), and Recommendations.\n\n"
            f"Security findings: {state['security_findings']}\n"
            f"Performance findings: {state['performance_findings']}\n"
            f"Style findings: {state['style_findings']}"
        )
        return {"final_report": self._to_text(self.groq_llm.invoke(prompt).content)}

    def _finish_clean(self, state: CodeReviewState) -> Dict:
        return {"final_report": f"Summary: Code reviewed, no significant issues found.\n\n{state['initial_analysis']}"}

    # ---- graph wiring ----

    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(CodeReviewState)
        workflow.add_node("analyzer", self._analysis_agent)
        workflow.add_node("synthesizer", self._synthesizer)
        workflow.add_node("finish_clean", self._finish_clean)

        for key in SPECIALISTS:
            workflow.add_node(f"{key}_agent", lambda s, k=key: self._specialist_agent_node(k, s))
            workflow.add_node(f"{key}_tool_node", lambda s, k=key: self._specialist_tool_node(k, s))
            workflow.add_node(f"{key}_conclude", lambda s, k=key: self._specialist_conclude(k, s))
            workflow.add_conditional_edges(
                f"{key}_agent",
                lambda s, k=key: self._specialist_decide(k, s),
                {"use_tool": f"{key}_tool_node", "conclude": f"{key}_conclude"},
            )
            workflow.add_edge(f"{key}_tool_node", f"{key}_agent")
            workflow.add_edge(f"{key}_conclude", "synthesizer")

        workflow.set_entry_point("analyzer")
        workflow.add_conditional_edges(
            "analyzer", self._route_after_analysis, [f"{k}_agent" for k in SPECIALISTS] + ["finish_clean"]
        )
        workflow.add_edge("synthesizer", END)
        workflow.add_edge("finish_clean", END)
        return workflow.compile()


def _build_initial_state(repo_path: str) -> Dict:
    state = {
        "repo_path": repo_path, "code": "", "initial_analysis": "", "has_issues": False,
        "security_findings": [], "performance_findings": [], "style_findings": [],
        "final_report": "",
    }
    for k in SPECIALISTS:
        state[f"{k}_messages"], state[f"{k}_iterations"] = [], 0
    return state


def _serialize_value(value):
    """Make LangGraph node-update payloads JSON-safe for SSE / API responses."""
    if isinstance(value, AIMessage):
        return {
            "type": "ai", "content": value.content,
            "tool_calls": [{"name": c["name"], "args": c["args"]} for c in (value.tool_calls or [])],
        }
    if isinstance(value, ToolMessage):
        return {"type": "tool", "content": value.content}
    if isinstance(value, (SystemMessage, HumanMessage)):
        return {"type": value.__class__.__name__, "content": value.content}
    if isinstance(value, list):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    return value


agent = SimpleCodeReviewAgent()
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])


@app.post("/review")
def review_code(request: CodeReviewRequest):
    if not os.path.isdir(request.repo_path):
        return {"error": f"repo_path '{request.repo_path}' is not a valid directory."}
    result = agent.graph.invoke(_build_initial_state(request.repo_path))
    return {
        "analysis": result["initial_analysis"],
        "security_findings": result["security_findings"],
        "performance_findings": result["performance_findings"],
        "style_findings": result["style_findings"],
        "report": result["final_report"],
    }


@app.post("/review/stream")
async def review_code_stream(request: CodeReviewRequest):
    if not os.path.isdir(request.repo_path):
        async def error_gen():
            yield f"event: error\ndata: {json.dumps({'error': f'repo_path {request.repo_path!r} is not a valid directory.'})}\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    async def event_generator():
        try:
            async for update in agent.graph.astream(_build_initial_state(request.repo_path), stream_mode="updates"):
                for node_name, node_delta in update.items():
                    yield f"data: {json.dumps({'node': node_name, 'update': _serialize_value(node_delta)})}\n\n"
            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)