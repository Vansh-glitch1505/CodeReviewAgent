"""
Tools shared by the security / performance / style specialist agents.
All tools are scoped to one repo_path so an LLM-directed search/read can't
walk outside the reviewed codebase.

NOTE: run_test's subprocess+timeout+stripped-env sandbox is a pragmatic
baseline, not a real security boundary. Swap for Docker (--network=none,
read-only rootfs, memory/pids limits) before pointing this at untrusted input.
"""

import re
import subprocess
import tempfile
from pathlib import Path
from langchain_core.tools import tool

MAX_FILE_BYTES = 50_000
MAX_SEARCH_RESULTS = 30
TEST_TIMEOUT_SECONDS = 10
LINTER_TIMEOUT_SECONDS = 15
CODE_EXT = {".py", ".js", ".ts", ".jsx", ".tsx"}
SEARCH_EXT = CODE_EXT | {".json", ".env", ".yaml", ".yml", ".txt"}
SKIP_DIRS = {".git", "node_modules", "__pycache__"}

# ruff reimplements these rule families, so one dep covers all 3 categories:
# S = flake8-bandit (injection/secrets/eval); PERF = perflint; E,W,F,N = pep8/pyflakes/naming
LINTER_RULE_MAP = {"security": "S", "performance": "PERF", "style": "E,W,F,N"}


def _resolve_within_repo(repo_path: str, relative_path: str) -> Path:
    """Resolve relative_path under repo_path; refuse anything that escapes the root."""
    root = Path(repo_path).resolve()
    candidate = (root / relative_path).resolve()
    if root not in candidate.parents and candidate != root:
        raise ValueError(f"Path '{relative_path}' escapes repo root — refused.")
    return candidate


def make_agent_tools(repo_path: str):
    """Factory: binds all 4 tools to one repo_path so the LLM only ever passes
    relative paths/queries, never the absolute root itself."""

    @tool
    def search_code(query: str) -> str:
        """Search the repo for a literal string or regex. Use to trace where a
        variable/function/import is defined or used before flagging it.
        Returns up to 30 'file:line: content' matches."""
        root = Path(repo_path).resolve()
        try:
            pattern = re.compile(query)
        except re.error:
            pattern = re.compile(re.escape(query))

        matches = []
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix not in SEARCH_EXT:
                continue
            if any(p in SKIP_DIRS for p in path.parts):
                continue
            try:
                text = path.read_text(errors="ignore")
            except Exception:
                continue
            for lineno, line in enumerate(text.splitlines(), start=1):
                if pattern.search(line):
                    matches.append(f"{path.relative_to(root)}:{lineno}: {line.strip()}")
                    if len(matches) >= MAX_SEARCH_RESULTS:
                        return "\n".join(matches)
        return "\n".join(matches) if matches else "No matches found."

    @tool
    def read_file(filepath: str) -> str:
        """Read a file (path relative to repo root). Use to check imports,
        config handling, or how a flagged function is called elsewhere.
        Truncated if very large."""
        try:
            target = _resolve_within_repo(repo_path, filepath)
        except ValueError as e:
            return str(e)
        if not target.is_file():
            return f"File '{filepath}' not found."
        try:
            data = target.read_bytes()
        except Exception as e:
            return f"Could not read file: {e}"
        text = data[:MAX_FILE_BYTES].decode(errors="ignore")
        if len(data) > MAX_FILE_BYTES:
            text += f"\n\n...[truncated, file is {len(data)} bytes]"
        return text

    @tool
    def run_test(test_code: str) -> str:
        """Run a small, self-contained Python script to confirm/refute a
        suspected issue (security PoC or perf micro-benchmark). Must be fully
        self-contained — repo imports aren't on the path. Print a clear result
        line. Isolated, no network, 10s timeout."""
        with tempfile.TemporaryDirectory() as tmp:
            script = Path(tmp) / "poc_test.py"
            script.write_text(test_code)
            env = {"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1", "PYTHONPATH": ""}
            try:
                result = subprocess.run(
                    ["python3", str(script)], cwd=tmp, env=env,
                    capture_output=True, text=True, timeout=TEST_TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                return f"TIMEOUT: script did not finish within {TEST_TIMEOUT_SECONDS}s."
            except Exception as e:
                return f"Execution error: {e}"
            out = f"exit_code={result.returncode}\nstdout:\n{result.stdout[-2000:]}"
            if result.stderr:
                out += f"\nstderr:\n{result.stderr[-1000:]}"
            return out

    @tool
    def run_linter(category: str, filepath: str = "") -> str:
        """Run ruff scoped to one category: 'security' (injection, hardcoded
        secrets, unsafe eval/exec, SSRF-prone calls), 'performance' (inefficient
        comprehensions/lookups, redundant work), or 'style' (unused imports,
        naming, line length, docstrings). filepath is relative to repo root;
        empty lints the whole repo. Use the category matching your specialty."""
        select = LINTER_RULE_MAP.get(category)
        if select is None:
            return f"Unknown category '{category}'. Use security, performance, or style."
        target = repo_path
        if filepath:
            try:
                target = str(_resolve_within_repo(repo_path, filepath))
            except ValueError as e:
                return str(e)
        try:
            result = subprocess.run(
                ["ruff", "check", target, "--select", select, "--output-format=concise", "--no-cache"],
                capture_output=True, text=True, timeout=LINTER_TIMEOUT_SECONDS,
            )
        except FileNotFoundError:
            return "ruff is not installed. Run `pip install ruff` in the backend env."
        except subprocess.TimeoutExpired:
            return "Linter timed out."
        out = result.stdout.strip() or "No issues found."
        if result.stderr:
            out += f"\n(stderr: {result.stderr.strip()[:300]})"
        return out

    return [search_code, read_file, run_test, run_linter]