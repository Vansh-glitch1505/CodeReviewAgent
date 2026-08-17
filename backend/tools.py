"""
Tools shared by all three specialist agents (security, performance, style).

All tools are scoped to a single repo_path so an LLM-directed search/read
can't walk outside the reviewed codebase.

NOTE on sandboxing: run_test uses subprocess + timeout + a stripped env.
That's a pragmatic baseline, NOT a real security boundary — it stops
accidents and lazy exploit code, not a determined attacker. Before
pointing this at untrusted/adversarial input, swap it for a Docker
container (--network=none, read-only rootfs, memory/pids limits).
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

# ruff natively reimplements these rule families, so one dependency
# (`pip install ruff`) covers all three categories:
#   S    -> flake8-bandit rules (injection, hardcoded secrets, unsafe eval, etc.)
#   PERF -> perflint rules (redundant work, inefficient comprehensions/lookups)
#   E,W,F,N -> pycodestyle + pyflakes + pep8-naming (unused imports, naming, style)
LINTER_RULE_MAP = {
    "security": "S",
    "performance": "PERF",
    "style": "E,W,F,N",
}


def _resolve_within_repo(repo_path: str, relative_path: str) -> Path:
    """Resolve relative_path against repo_path, refusing anything that
    escapes the repo root (blocks ../../etc/passwd style traversal)."""
    root = Path(repo_path).resolve()
    candidate = (root / relative_path).resolve()
    if root not in candidate.parents and candidate != root:
        raise ValueError(f"Path '{relative_path}' escapes repo root — refused.")
    return candidate


def make_agent_tools(repo_path: str):
    """Factory: binds all 4 tools to one repo_path so the LLM only ever
    passes relative paths/queries, never the absolute root itself.
    Used by security_agent, performance_agent, and style_agent alike."""

    @tool
    def search_code(query: str) -> str:
        """Search the repository for a literal string or regex pattern.
        Use this to trace where a variable, function, or import is
        defined or used elsewhere in the codebase before flagging it.
        Returns up to 30 matches as 'file:line: content'.
        """
        root = Path(repo_path).resolve()
        try:
            pattern = re.compile(query)
        except re.error:
            pattern = re.compile(re.escape(query))

        matches = []
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in {".git", "node_modules", "__pycache__"} for part in path.parts):
                continue
            if path.suffix not in {".py", ".js", ".ts", ".jsx", ".tsx", ".json", ".env", ".yaml", ".yml", ".txt"}:
                continue
            try:
                text = path.read_text(errors="ignore")
            except Exception:
                continue
            for lineno, line in enumerate(text.splitlines(), start=1):
                if pattern.search(line):
                    rel = path.relative_to(root)
                    matches.append(f"{rel}:{lineno}: {line.strip()}")
                    if len(matches) >= MAX_SEARCH_RESULTS:
                        break
            if len(matches) >= MAX_SEARCH_RESULTS:
                break

        return "\n".join(matches) if matches else "No matches found."

    @tool
    def read_file(filepath: str) -> str:
        """Read the full contents of a file in the repository, given a
        path relative to the repo root. Use this to check imports,
        config handling, or how a flagged function is called elsewhere.
        Truncated if the file is very large.
        """
        try:
            target = _resolve_within_repo(repo_path, filepath)
        except ValueError as e:
            return str(e)

        if not target.exists() or not target.is_file():
            return f"File '{filepath}' not found."

        try:
            data = target.read_bytes()
        except Exception as e:
            return f"Could not read file: {e}"

        truncated = len(data) > MAX_FILE_BYTES
        text = data[:MAX_FILE_BYTES].decode(errors="ignore")
        if truncated:
            text += f"\n\n...[truncated, file is {len(data)} bytes]"
        return text

    @tool
    def run_test(test_code: str) -> str:
        """Run a small, self-contained Python script to confirm or
        refute a suspected issue — e.g. a security PoC, or a timing
        micro-benchmark for a suspected performance bottleneck. The
        script must be fully self-contained (define any stubs/mocks it
        needs inline; repo imports are not on the path). Print a clear
        result line. Runs isolated, no network, 10s timeout.
        """
        with tempfile.TemporaryDirectory() as tmp:
            script_path = Path(tmp) / "poc_test.py"
            script_path.write_text(test_code)

            env = {
                "PATH": "/usr/bin:/bin",
                "PYTHONDONTWRITEBYTECODE": "1",
                "PYTHONPATH": "",
            }

            try:
                result = subprocess.run(
                    ["python3", str(script_path)],
                    cwd=tmp,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=TEST_TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                return f"TIMEOUT: script did not finish within {TEST_TIMEOUT_SECONDS}s."
            except Exception as e:
                return f"Execution error: {e}"

            output = f"exit_code={result.returncode}\nstdout:\n{result.stdout[-2000:]}"
            if result.stderr:
                output += f"\nstderr:\n{result.stderr[-1000:]}"
            return output

    @tool
    def run_linter(category: str, filepath: str = "") -> str:
        """Run static analysis (ruff) scoped to one category: 'security'
        (injection, hardcoded secrets, unsafe eval/exec, SSRF-prone
        calls), 'performance' (inefficient comprehensions, repeated
        lookups, redundant work), or 'style' (unused imports, naming,
        line length, docstrings). filepath is relative to repo root;
        leave empty to lint the whole repo. Use the category matching
        your own specialty.
        """
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
                capture_output=True,
                text=True,
                timeout=LINTER_TIMEOUT_SECONDS,
            )
        except FileNotFoundError:
            return "ruff is not installed. Run `pip install ruff` in the backend env."
        except subprocess.TimeoutExpired:
            return "Linter timed out."

        output = result.stdout.strip() or "No issues found."
        if result.stderr:
            output += f"\n(stderr: {result.stderr.strip()[:300]})"
        return output

    return [search_code, read_file, run_test, run_linter]