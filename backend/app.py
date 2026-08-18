import json
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
TRACE_RESULT_PREVIEW_CHARS = 500  # keep SSE payloads / response bodies small

# Per-specialist config: what they investigate + which linter category is theirs.
SPECIALIST_CONFIG = {
    "security": {
        "findings_key": "security_findings",
        "messages_key": "security_messages",
        "iters_key": "security_iterations",
        "trace_key": "security_trace",
        "system_prompt": (
            "You are a security reviewer investigating a codebase for real, "
            "confirmed vulnerabilities (injection, auth flaws, hardcoded secrets, "
            "unsafe deserialization, SSRF, etc). You have tools: search_code, "
            "read_file, run_test, run_linter. Use run_linter(category='security') "
            "as a starting signal, then use search_code/read_file to confirm "
            "whether a flagged spot is actually reachable/exploitable, and "
            "run_test to write a minimal PoC when you need to confirm rather "
            "than guess. When you have enough evidence, respond with NO further "
            "tool calls and list 0-5 confirmed issues, each as '-issue'. If "
            "none, respond exactly 'NONE CONFIRMED'."
        ),
    },
    "performance": {
        "findings_key": "performance_findings",
        "messages_key": "performance_messages",
        "iters_key": "performance_iterations",
        "trace_key": "performance_trace",
        "system_prompt": (
            "You are a performance reviewer investigating a codebase for real "
            "bottlenecks (N+1 queries, blocking/sync calls that should be "
            "async, unnecessary complexity, redundant work, memory issues). "
            "You have tools: search_code, read_file, run_test, run_linter. Use "
            "run_linter(category='performance') as a starting signal, then use "
            "search_code/read_file to check call frequency and context (e.g. is "
            "this inside a loop or hot path elsewhere in the repo), and run_test "
            "for a quick timing comparison when it would confirm a suspected "
            "bottleneck. When you have enough evidence, respond with NO further "
            "tool calls and list 0-5 confirmed issues, each as '-issue'. If "
            "none, respond exactly 'NONE CONFIRMED'."
        ),
    },
    "style": {
        "findings_key": "style_findings",
        "messages_key": "style_messages",
        "iters_key": "style_iterations",
        "trace_key": "style_trace",
        "system_prompt": (
            "You are a style/readability reviewer investigating a codebase "
            "(naming conventions, structure, docstrings, PEP8, duplication, "
            "magic numbers). You have tools: search_code, read_file, "
            "run_linter. Use run_linter(category='style') as a starting "
            "signal, then use search_code to check whether a naming/structure "
            "pattern is repeated elsewhere before flagging it as a real issue "
            "vs. a one-off. run_test is rarely useful for style — skip it "
            "unless you have a concrete reason. When you have enough evidence, "
            "respond with NO further tool calls and list 0-5 confirmed issues, "
            "each as '-issue'. If none, respond exactly 'NONE CONFIRMED'."
        ),
    },
}


class CodeReviewRequest(BaseModel):
    repo_path: str          # directory on disk to review — tools need real files to act on
    entry_summary: str = ""


class CodeReviewState(TypedDict):
    repo_path: str
    code: str                      # flattened snapshot, used for initial analysis + context
    initial_analysis: str
    has_issues: bool

    security_findings: List[str]
    performance_findings: List[str]
    style_findings: List[str]

    security_messages: Annotated[List, operator.add]
    security_iterations: int
    security_trace: Annotated[List[Dict], operator.add]

    performance_messages: Annotated[List, operator.add]
    performance_iterations: int
    performance_trace: Annotated[List[Dict], operator.add]

    style_messages: Annotated[List, operator.add]
    style_iterations: int
    style_trace: Annotated[List[Dict], operator.add]

    final_report: str


class SimpleCodeReviewAgent:
    def __init__(self):
        # Keep both LLMs available so the workload is split across providers.
        self.gemini_llm = ChatGoogleGenerativeAI(
            model="gemini-3.6-flash",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=0.3,
        )

        self.groq_llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
            groq_api_key=os.getenv("GROQ_API_KEY"),
            temperature=0.3,
        )

        # Which provider handles each part of the existing pipeline.
        # The graph, tools, state, prompts and SSE output stay unchanged.
        self.specialist_llms = {
            "security": self.groq_llm,
            "performance": self.gemini_llm,
            "style": self.groq_llm,
        }

        self.graph = self._build_graph()

    # ---- helpers ----

    @staticmethod
    def _snapshot_repo(repo_path: str, max_bytes: int = 40_000) -> str:
        skip_dirs = {".git", "node_modules", "__pycache__", "dist", "build", ".venv", "venv"}
        chunks, total = [], 0
        for root, dirnames, files in os.walk(repo_path):
            # Prune in place so os.walk never descends into these — works on
            # Windows too (previous version matched "/node_modules" against
            # backslash-separated paths, which never matched).
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
                rel = os.path.relpath(path, repo_path)
                block = f"\n# ---- {rel} ----\n{content}"
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
    def _preview(text: str, limit: int = TRACE_RESULT_PREVIEW_CHARS) -> str:
        text = str(text)
        return text if len(text) <= limit else text[:limit] + f"...[{len(text) - limit} more chars]"

    @staticmethod
    def _to_text(content) -> str:
        """Gemini/langchain_google_genai sometimes returns AIMessage.content as
        a list of content-part dicts instead of a plain string (usually on the
        final answer after a tool-calling turn). Normalize to plain text so
        downstream code can safely call .strip()/.upper() on it."""
        if content is None:
            return ""
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, dict):
                    parts.append(part.get("text", ""))
                else:
                    parts.append(str(part))
            return "\n".join(p for p in parts if p)
        return str(content)

    # ---- entry node ----

    def _analysis_agent(self, state: CodeReviewState) -> Dict:
        code = self._snapshot_repo(state["repo_path"])
        prompt = f"""Analyse the code briefly:
            {code}
        Focus on: purpose, structure and concerns.
        End your response with exactly one line: "VERDICT: ISSUES" or "VERDICT: CLEAN"
"""
        response = self.gemini_llm.invoke(prompt)
        analysis = self._to_text(response.content)
        has_issues = "VERDICT: ISSUES" in analysis.upper()
        return {"code": code, "initial_analysis": analysis, "has_issues": has_issues}

    def _route_after_analysis(self, state: CodeReviewState) -> List[str]:
        if state["has_issues"]:
            return ["security_agent", "performance_agent", "style_agent"]
        return ["finish_clean"]

    # ---- generic ReAct specialist (shared by security / performance / style) ----

    def _specialist_agent_node(self, key: str, state: CodeReviewState) -> Dict:
        cfg = SPECIALIST_CONFIG[key]
        messages_key, iters_key, trace_key = cfg["messages_key"], cfg["iters_key"], cfg["trace_key"]

        tools = make_agent_tools(state["repo_path"])
        llm_with_tools = self.specialist_llms[key].bind_tools(tools)

        existing = state.get(messages_key)
        if not existing:
            system = SystemMessage(content=cfg["system_prompt"])
            human = HumanMessage(
                content=f"Repo snapshot for context:\n{state['code']}\n\nInvestigate now."
            )
            messages = [system, human]
        else:
            messages = existing

        response = llm_with_tools.invoke(messages)
        iterations = state.get(iters_key, 0)

        delta = [response] if existing else messages + [response]

        # trace: one entry per tool call the model decided to make, OR
        # a single "reasoning" entry when it's wrapping up with a final answer.
        tool_calls = getattr(response, "tool_calls", None) or []
        if tool_calls:
            trace_delta = [
                {
                    "node": key,
                    "iteration": iterations + 1,
                    "type": "tool_call",
                    "tool": call["name"],
                    "args": call["args"],
                }
                for call in tool_calls
            ]
        else:
            trace_delta = [
                {
                    "node": key,
                    "iteration": iterations + 1,
                    "type": "reasoning",
                    "content": self._preview(self._to_text(response.content)),
                }
            ]

        return {messages_key: delta, iters_key: iterations + 1, trace_key: trace_delta}

    def _specialist_decide(self, key: str, state: CodeReviewState) -> str:
        cfg = SPECIALIST_CONFIG[key]
        last = state[cfg["messages_key"]][-1]
        if state[cfg["iters_key"]] >= MAX_SPECIALIST_ITERS:
            return "conclude"
        if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
            return "use_tool"
        return "conclude"

    def _specialist_tool_node(self, key: str, state: CodeReviewState) -> Dict:
        cfg = SPECIALIST_CONFIG[key]
        messages_key, trace_key = cfg["messages_key"], cfg["trace_key"]

        tools = {t.name: t for t in make_agent_tools(state["repo_path"])}
        last = state[messages_key][-1]
        tool_messages = []
        trace_delta = []

        for call in last.tool_calls:
            fn = tools.get(call["name"])
            if fn is None:
                result = f"Unknown tool '{call['name']}'"
            else:
                try:
                    result = fn.invoke(call["args"])
                except Exception as e:
                    result = f"Tool error: {e}"
            tool_messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
            trace_delta.append(
                {
                    "node": key,
                    "type": "tool_result",
                    "tool": call["name"],
                    "result": self._preview(result),
                }
            )

        return {messages_key: tool_messages, trace_key: trace_delta}

    def _specialist_conclude(self, key: str, state: CodeReviewState) -> Dict:
        cfg = SPECIALIST_CONFIG[key]
        last = state[cfg["messages_key"]][-1]
        content = self._to_text(last.content) if isinstance(last, AIMessage) else str(last)
        if not content.strip():
            content = "NONE CONFIRMED (max investigation iterations reached without a clear answer)"
        return {cfg["findings_key"]: self._parse_findings(content)}

    # ---- Synthesizer (fan-in) ----

    def _synthesizer(self, state: CodeReviewState) -> Dict:
        prompt = f"""Combine these findings from three specialist reviewers into one
        cohesive code review report with sections: Summary, Issues by Category
        (Security / Performance / Style), and Recommendations.

        Security findings: {state['security_findings']}
        Performance findings: {state['performance_findings']}
        Style findings: {state['style_findings']}
"""
        response = self.groq_llm.invoke(prompt)
        return {"final_report": self._to_text(response.content)}

    def _finish_clean(self, state: CodeReviewState) -> Dict:
        return {
            "final_report": f"Summary: Code reviewed, no significant issues found.\n\n{state['initial_analysis']}"
        }

    # ---- graph wiring ----

    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(CodeReviewState)

        workflow.add_node("analyzer", self._analysis_agent)
        workflow.add_node("synthesizer", self._synthesizer)
        workflow.add_node("finish_clean", self._finish_clean)

        for key in ("security", "performance", "style"):
            # bind `key` as a default arg so each closure captures its own specialist
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
            "analyzer",
            self._route_after_analysis,
            ["security_agent", "performance_agent", "style_agent", "finish_clean"],
        )

        workflow.add_edge("synthesizer", END)
        workflow.add_edge("finish_clean", END)

        return workflow.compile()


def _build_initial_state(repo_path: str) -> Dict:
    return {
        "repo_path": repo_path,
        "code": "",
        "initial_analysis": "",
        "has_issues": False,
        "security_findings": [],
        "performance_findings": [],
        "style_findings": [],
        "security_messages": [],
        "security_iterations": 0,
        "security_trace": [],
        "performance_messages": [],
        "performance_iterations": 0,
        "performance_trace": [],
        "style_messages": [],
        "style_iterations": 0,
        "style_trace": [],
        "final_report": "",
    }


def _serialize_value(value):
    """Make LangGraph node-update payloads JSON-safe for SSE / API responses.
    Messages (AIMessage/ToolMessage/etc) carry LangChain objects that aren't
    directly JSON serializable — pull out just what a frontend needs.
    """
    if isinstance(value, AIMessage):
        return {
            "type": "ai",
            "content": value.content,
            "tool_calls": [
                {"name": c["name"], "args": c["args"]} for c in (value.tool_calls or [])
            ],
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        "trace": {
            "security": result["security_trace"],
            "performance": result["performance_trace"],
            "style": result["style_trace"],
        },
        "report": result["final_report"],
    }


@app.post("/review/stream")
async def review_code_stream(request: CodeReviewRequest):
    if not os.path.isdir(request.repo_path):
        async def error_gen():
            payload = {"error": f"repo_path '{request.repo_path}' is not a valid directory."}
            yield f"event: error\ndata: {json.dumps(payload)}\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    initial_state = _build_initial_state(request.repo_path)

    async def event_generator():
        try:
            async for update in agent.graph.astream(initial_state, stream_mode="updates"):
                # `update` looks like {"security_agent": {...state delta...}}
                for node_name, node_delta in update.items():
                    payload = {"node": node_name, "update": _serialize_value(node_delta)}
                    yield f"data: {json.dumps(payload)}\n\n"
            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)