"""
Gradio frontend for CodeReviewAgent.

Talks to the FastAPI backend's /review/stream SSE endpoint (see app.py) and
renders the live multi-agent trace: what each specialist (security /
performance / style) is searching, reading, or testing, as it happens —
plus findings per category and the final synthesized report.

Run:
    1. Start the backend:  python app.py            (defaults to :8000)
    2. Start this UI:      python app_ui.py          (defaults to :7860)
"""

import json
import requests
import gradio as gr

DEFAULT_BACKEND_URL = "http://localhost:8000"
AGENT_META = {
    "security": {"icon": "🛡️", "label": "Security", "color": "#f85149"},
    "performance": {"icon": "⚡", "label": "Performance", "color": "#d29922"},
    "style": {"icon": "🎨", "label": "Style", "color": "#3fb950"},
}
AGENT_KEYS = tuple(AGENT_META)


def _node_to_agent(node: str):
    return next((k for k in AGENT_KEYS if node.startswith(k)), None)


def format_findings(items: list, concluded: bool) -> str:
    if not concluded:
        return "_pending…_"
    if not items:
        return "✅ No confirmed issues."
    return "\n".join(f"- {str(i).lstrip('- ').strip()}" for i in items)


def parse_sse(response):
    """Yield (event_type, payload_dict) pairs from a requests streaming response."""
    event_type = "message"
    for raw in response.iter_lines(decode_unicode=True):
        line = (raw or "").strip()
        if line == "":
            event_type = "message"
        elif line.startswith("event:"):
            event_type = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            try:
                yield event_type, json.loads(line.split(":", 1)[1].strip())
            except json.JSONDecodeError:
                continue


def run_review(repo_path: str, backend_url: str):
    repo_path = (repo_path or "").strip()
    backend_url = (backend_url or DEFAULT_BACKEND_URL).strip().rstrip("/")

    findings = {k: [] for k in AGENT_KEYS}
    concluded = {k: False for k in AGENT_KEYS}
    analysis_text, final_report, status = "", "", ""

    def snapshot():
        return (
            status,
            *(format_findings(findings[k], concluded[k]) for k in AGENT_KEYS),
            analysis_text or "_waiting for analysis…_",
            final_report or "_report will appear here once all agents finish._",
        )

    if not repo_path:
        status = "⚠️ Enter a repo path first."
        yield snapshot()
        return

    status = f"🚀 Sending repo to backend ..."
    yield snapshot()

    try:
        resp = requests.post(f"{backend_url}/review/stream", json={"repo_path": repo_path}, stream=True, timeout=600)
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

        node, update = payload.get("node", ""), payload.get("update", {}) or {}

        if node == "analyzer":
            analysis_text = update.get("initial_analysis", analysis_text)
            status = "🔎 Initial analysis complete — " + (
                "dispatching specialists..." if update.get("has_issues") else "nothing flagged."
            )
        elif node in ("finish_clean", "synthesizer"):
            final_report = update.get("final_report", final_report)
            status = "✅ No significant issues found — review complete." if node == "finish_clean" else "🧩 Synthesizing final report..."
        else:
            agent = _node_to_agent(node)
            if agent:
                findings_key = f"{agent}_findings"
                if findings_key in update:
                    findings[agent] = update[findings_key]
                    concluded[agent] = True
                meta = AGENT_META[agent]
                status = f"{meta['icon']} {meta['label']} agent " + ("concluded." if concluded[agent] else "investigating...")

        yield snapshot()

    yield snapshot()


CUSTOM_CSS = """
.agent-header h3 { margin-bottom: 2px !important; }
""" + "\n".join(f"#{k}-header h3 {{ color: {m['color']}; }}" for k, m in AGENT_META.items()) + """
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
        repo_path_in = gr.Textbox(label="Repo path", placeholder="/absolute/path/to/your/repo", scale=4)
        backend_url_in = gr.Textbox(label="Backend URL", value=DEFAULT_BACKEND_URL, scale=2)
        run_btn = gr.Button("Run Review", variant="primary", scale=1)

    status_out = gr.Markdown("Enter a repo path and click **Run Review**.", elem_id="status-line")

    with gr.Accordion("Initial analysis", open=False):
        analysis_out = gr.Markdown()

    findings_outs = {}
    with gr.Row():
        for key, meta in AGENT_META.items():
            with gr.Column():
                gr.Markdown(f"### {meta['icon']} {meta['label']}", elem_id=f"{key}-header", elem_classes="agent-header")
                findings_outs[key] = gr.Markdown("_pending…_")

    gr.Markdown("---\n## 📋 Final Report")
    final_report_out = gr.Markdown("_report will appear here once all agents finish._")

    run_btn.click(
        fn=run_review,
        inputs=[repo_path_in, backend_url_in],
        outputs=[status_out, *(findings_outs[k] for k in AGENT_KEYS), analysis_out, final_report_out],
    )

if __name__ == "__main__":
    demo.queue().launch()