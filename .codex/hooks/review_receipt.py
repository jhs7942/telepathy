#!/usr/bin/env python3
"""Codex 훅 입력을 바탕으로 작업 변경 영수증을 생성한다."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

SECRET_PATTERN = re.compile(r"(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,]+")
PATH_PATTERN = re.compile(r"(?:Add|Update|Delete) File: (.+)")


def read_event() -> dict[str, Any]:
    try:
        value = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return {}
    return value if isinstance(value, dict) else {}


def redact(value: str) -> str:
    return SECRET_PATTERN.sub(r"\1=[REDACTED]", value)


def git_root(cwd: Path) -> Path:
    result = subprocess.run(
        ["git", "-C", str(cwd), "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=False,
    )
    return Path(result.stdout.strip()) if result.returncode == 0 else cwd


def state_path(root: Path, session_id: str) -> Path:
    directory = root / ".codex" / "review-receipt"
    directory.mkdir(parents=True, exist_ok=True)
    safe_id = re.sub(r"[^A-Za-z0-9_.-]", "_", session_id or "local")
    return directory / f"{safe_id}.json"


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"events": [], "emitted": 0, "baseline": []}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"events": [], "emitted": 0, "baseline": []}
    return value if isinstance(value, dict) else {"events": [], "emitted": 0, "baseline": []}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def changed_files(root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "-C", str(root), "status", "--short"], capture_output=True, text=True, check=False
    )
    return [line[3:] for line in result.stdout.splitlines() if line[3:] != ".agent_history.md"]


def capture(root: Path, state: dict[str, Any], event: dict[str, Any]) -> None:
    name = str(event.get("hook_event_name", ""))
    tool_name = str(event.get("tool_name", ""))
    tool_input = event.get("tool_input")
    entry: dict[str, Any] = {"event": name, "tool": tool_name, "time": datetime.now().isoformat(timespec="seconds")}
    if name == "UserPromptSubmit":
        prompt = str(event.get("prompt", event.get("user_prompt", "")))
        entry["prompt"] = redact(prompt)
    elif tool_name in {"Bash", "apply_patch"} and isinstance(tool_input, dict):
        command = str(tool_input.get("command", ""))
        entry["command"] = redact(command)
        output = event.get("tool_output", event.get("tool_response", {}))
        exit_code = output.get("exit_code") if isinstance(output, dict) else None
        entry["result"] = "Success" if exit_code == 0 else "Fail" if isinstance(exit_code, int) else "기록됨"
        if tool_name == "apply_patch":
            entry["files"] = PATH_PATTERN.findall(command)
    else:
        return
    state.setdefault("events", []).append(entry)


def finalize(root: Path, state: dict[str, Any]) -> None:
    start = int(state.get("emitted", 0))
    events = state.get("events", [])[start:]
    if not events:
        return
    commands = [entry for entry in events if "command" in entry]
    baseline = set(state.get("baseline", []))
    files = sorted({item for entry in events for item in entry.get("files", [])} | (set(changed_files(root)) - baseline))
    if not commands and not files:
        state["emitted"] = len(state.get("events", []))
        return
    prompt = next((entry["prompt"] for entry in reversed(events) if entry.get("prompt")), "기록되지 않음")
    lines = [f"### 🧾 AI 작업 변경 영수증 ({datetime.now().strftime('%Y-%m-%d %H:%M')})", "", f"* **사용자 프롬프트**: {prompt}", "* **영향을 받은 파일 목록**:"]
    lines.extend([f"  - `변경 감지` `{path}`" for path in files] or ["  - 감지된 파일 없음"])
    lines.append("* **실행된 CLI 터미널 명령어**:")
    lines.extend([f"  - `{entry['command']}` (결과: {entry['result']})" for entry in commands] or ["  - 기록된 명령 없음"])
    lines.extend(["* **잔여 투두 및 리스크**:", "  - 훅은 지원되는 Codex 도구만 기록한다. 훅 신뢰 상태는 `/hooks`에서 확인한다.", ""])
    receipt = root / ".agent_history.md"
    previous = receipt.read_text(encoding="utf-8") if receipt.exists() else ""
    receipt.write_text("\n".join(lines) + previous, encoding="utf-8")
    state["emitted"] = len(state.get("events", []))


def main() -> None:
    action = sys.argv[1] if len(sys.argv) > 1 else "capture"
    event = read_event()
    root = git_root(Path(str(event.get("cwd", Path.cwd()))))
    path = state_path(root, str(event.get("session_id", "local")))
    state = load_state(path)
    if action == "baseline":
        state["baseline"] = changed_files(root)
    elif action == "finalize":
        finalize(root, state)
    else:
        capture(root, state, event)
    save_state(path, state)


if __name__ == "__main__":
    main()
