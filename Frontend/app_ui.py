"""
Gradio frontend for CodeReviewAgent.

Talks to the FastAPI backend's /review/stream SSE endpoint (see app.py) and
renders the live multi-agent trace: what each specialist (security /
performance / style) is searching, reading, or testing, as it happens —
plus findings per category and the final synthesized report.

Run:
    1. Start the backend:  python app.py            (defaults to :8000)
    2. Start this UI:      python gradio_app.py      (defaults to :7860)
"""

import json
import requests
import gradio as gr

DEFAULT_BACKEND_URL = "http://localhost:8000"

AGENT_KEYS = ("security", "performance", "style")

AGENT_META = {
    "security": {"icon": "🛡️", "label": "Security"},
    "performance": {"icon": "⚡", "label": "Performance"},
    "style": {"icon": "🎨", "label": "Style"},
}


def _node_to_agent(node: str) -> str | None:
    for key in AGENT_KEYS:
        if node.startswith(key):
            return key
    return None


def format_trace_entry(entry: dict) -> str:
    entry_type = entry.get("type")
    if entry_type == "tool_call":
        args = entry.get("args", {}) or {}
        args_str = ", ".join(f"{k}={v!r}" for k, v in args.items())
        return f"→ {entry.get('tool')}({args_str})"
    if entry_type == "tool_result":
        return f"   ⤷ {entry.get('result')}"
    if entry_type == "reasoning":
        return f"… {entry.get('content')}"
    return json.dumps(entry)


def format_findings(items: list, concluded: bool) -> str:
    if not concluded:
        return "_pending…_"
    if not items:
        return "✅ No confirmed issues."
    return "\n".join(f"- {str(i).lstrip('- ').strip()}" for i in items)


def parse_sse(response):
    """Yield (event_type, payload_dict) pairs from a requests streaming response."""
    event_type = "message"
    for raw_line in response.iter_lines(decode_unicode=True):
        if raw_line is None:
            continue
        line = raw_line.strip()
        if line == "":
            event_type = "message"
            continue
        if line.startswith("event:"):
            event_type = line.split(":", 1)[1].strip()
            continue
        if line.startswith("data:"):
            data_str = line.split(":", 1)[1].strip()
            try:
                payload = json.loads(data_str)
            except json.JSONDecodeError:
                continue
            yield event_type, payload


def run_review(repo_path: str, backend_url: str):
    repo_path = (repo_path or "").strip()
    backend_url = (backend_url or DEFAULT_BACKEND_URL).strip().rstrip("/")

    logs = {k: [] for k in AGENT_KEYS}
    findings = {k: [] for k in AGENT_KEYS}
    concluded = {k: False for k in AGENT_KEYS}
    analysis_text = ""
    final_report = ""
    status = ""

    def snapshot():
        return (
            status,
            "\n".join(logs["security"]) or "waiting…",
            "\n".join(logs["performance"]) or "waiting…",
            "\n".join(logs["style"]) or "waiting…",
            format_findings(findings["security"], concluded["security"]),
            format_findings(findings["performance"], concluded["performance"]),
            format_findings(findings["style"], concluded["style"]),
            analysis_text or "_waiting for analysis…_",
            final_report or "_report will appear here once all agents finish._",
        )

    if not repo_path:
        status = "⚠️ Enter a repo path first."
        yield snapshot()
        return

    status = f"🚀 Sending repo to {backend_url} ..."
    yield snapshot()

    try:
        resp = requests.post(
            f"{backend_url}/review/stream",
            json={"repo_path": repo_path},
            stream=True,
            timeout=600,
        )
    except requests.exceptions.RequestException as e:
        status = f"❌ Could not reach backend at {backend_url}: {e}"
        yield snapshot()
        return

    if resp.status_code != 200:
        status = f"❌ Backend returned HTTP {resp.status_code}"
        yield snapshot()
        return

    for event_type, payload in parse_sse(resp):
        if event_type == "error":
            status = f"❌ {payload.get('error', 'unknown error')}"
            yield snapshot()
            return

        if event_type == "done":
            status = "✅ Review complete."
            yield snapshot()
            return

        node = payload.get("node", "")
        update = payload.get("update", {}) or {}

        if node == "analyzer":
            analysis_text = update.get("initial_analysis", analysis_text)
            status = (
                "🔎 Initial analysis complete — dispatching specialists..."
                if update.get("has_issues")
                else "🔎 Initial analysis complete — nothing flagged."
            )

        elif node == "finish_clean":
            final_report = update.get("final_report", final_report)
            status = "✅ No significant issues found — review complete."

        elif node == "synthesizer":
            final_report = update.get("final_report", final_report)
            status = "🧩 Synthesizing final report..."

        else:
            agent = _node_to_agent(node)
            if agent:
                trace_key = f"{agent}_trace"
                for entry in update.get(trace_key, []):
                    logs[agent].append(format_trace_entry(entry))

                findings_key = f"{agent}_findings"
                if findings_key in update:
                    findings[agent] = update[findings_key]
                    concluded[agent] = True
                    n = len(findings[agent])
                    logs[agent].append(
                        f"✅ concluded — {n} issue(s) confirmed" if n else "✅ concluded — none confirmed"
                    )

                meta = AGENT_META[agent]
                status = (
                    f"{meta['icon']} {meta['label']} agent concluded."
                    if concluded[agent]
                    else f"{meta['icon']} {meta['label']} agent investigating..."
                )

        yield snapshot()

    status = "✅ Stream ended."
    yield snapshot()


CUSTOM_CSS = """
.trace-box textarea {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace !important;
    font-size: 12.5px !important;
    background-color: #0d1117 !important;
    color: #c9d1d9 !important;
    border: 1px solid #30363d !important;
}
.agent-header h3 { margin-bottom: 2px !important; }
#security-header h3 { color: #f85149; }
#performance-header h3 { color: #d29922; }
#style-header h3 { color: #3fb950; }
#status-line { text-align: center; font-size: 15px; padding: 6px 0; }
"""

with gr.Blocks(title="CodeReviewAgent", theme=gr.themes.Soft(primary_hue="indigo"), css=CUSTOM_CSS) as demo:
    gr.Markdown(
        "# 🔍 CodeReviewAgent\n"
        "Three specialist agents — **security**, **performance**, and **style** — independently "
        "investigate your repo using tool calls (`search_code`, `read_file`, `run_test`, `run_linter`) "
        "in a ReAct loop, then a synthesizer merges their findings into one report."
    )

    with gr.Row():
        repo_path_in = gr.Textbox(
            label="Repo path",
            placeholder="/absolute/path/to/your/repo",
            scale=4,
        )
        backend_url_in = gr.Textbox(
            label="Backend URL",
            value=DEFAULT_BACKEND_URL,
            scale=2,
        )
        run_btn = gr.Button("Run Review", variant="primary", scale=1)

    status_out = gr.Markdown("Enter a repo path and click **Run Review**.", elem_id="status-line")

    with gr.Accordion("Initial analysis", open=False):
        analysis_out = gr.Markdown()

    with gr.Row():
        with gr.Column():
            gr.Markdown("### 🛡️ Security", elem_id="security-header", elem_classes="agent-header")
            security_log = gr.Textbox(
                label="Live trace", lines=14, max_lines=14, interactive=False, elem_classes="trace-box"
            )
            security_findings_out = gr.Markdown("_pending…_")
        with gr.Column():
            gr.Markdown("### ⚡ Performance", elem_id="performance-header", elem_classes="agent-header")
            performance_log = gr.Textbox(
                label="Live trace", lines=14, max_lines=14, interactive=False, elem_classes="trace-box"
            )
            performance_findings_out = gr.Markdown("_pending…_")
        with gr.Column():
            gr.Markdown("### 🎨 Style", elem_id="style-header", elem_classes="agent-header")
            style_log = gr.Textbox(
                label="Live trace", lines=14, max_lines=14, interactive=False, elem_classes="trace-box"
            )
            style_findings_out = gr.Markdown("_pending…_")

    gr.Markdown("---\n## 📋 Final Report")
    final_report_out = gr.Markdown("_report will appear here once all agents finish._")

    run_btn.click(
        fn=run_review,
        inputs=[repo_path_in, backend_url_in],
        outputs=[
            status_out,
            security_log,
            performance_log,
            style_log,
            security_findings_out,
            performance_findings_out,
            style_findings_out,
            analysis_out,
            final_report_out,
        ],
    )

if __name__ == "__main__":
    demo.queue().launch()