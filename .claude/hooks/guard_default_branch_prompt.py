#!/usr/bin/env python3
"""UserPromptSubmit hook — soft reminder when the user submits work
on the default branch of the main worktree.

Registered in `.claude/settings.json` for the `UserPromptSubmit` event.
Anything this script prints to stdout is injected into the model's
context as additional system reminder text; the prompt itself is not
blocked. The script stays quiet when:

  - the guard policy says we're allowed to work here, or
  - the prompt does not look like a work request (small talk, queries,
    file reads), or
  - BYPASS_DEFAULT_BRANCH_GUARD=1 is set.

Intent: catch the "didn't notice I'm on main" mistake before the model
edits anything, without nagging on every conversational turn.
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, THIS_DIR)

try:
    from _lib.branch_guard import evaluate  # noqa: E402
except Exception:
    traceback.print_exc(file=sys.stderr)
    sys.exit(0)


# Work-intent signals. Matched case-insensitively against the prompt text.
# Skewed toward verbs that imply file modification so we don't fire on
# pure question / read-only turns.
_WORK_PATTERNS = [
    # Korean
    r"구현", r"수정", r"리팩토링", r"리팩터링", r"추가", r"고치",
    r"변경", r"개선", r"버그", r"기능", r"테스트\s*작성", r"테스트\s*추가",
    r"작성해", r"만들어", r"바꿔", r"고쳐", r"적용",
    # English
    r"\bimplement\b", r"\bfix\b", r"\brefactor\b", r"\badd\b", r"\bmodify\b",
    r"\bchange\b", r"\bedit\b", r"\bwrite\b", r"\bcreate\b", r"\bupdate\b",
    r"\bfeature\b", r"\bbug\b",
]
_WORK_RE = re.compile("|".join(_WORK_PATTERNS), re.IGNORECASE)


def _read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _looks_like_work(prompt: str) -> bool:
    if not prompt:
        return False
    return bool(_WORK_RE.search(prompt))


def main() -> int:
    if os.environ.get("BYPASS_DEFAULT_BRANCH_GUARD") == "1":
        return 0

    try:
        decision = evaluate()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 0

    if not decision.blocked:
        return 0  # safe location; stay silent.

    payload = _read_payload()
    prompt = payload.get("prompt") or ""
    if not _looks_like_work(prompt):
        return 0  # not a work request; don't nag.

    # Inject reminder via stdout. Wrap in a tag the model treats as a
    # system reminder so it doesn't look like part of the user's prompt.
    reminder = (
        "<system-reminder>\n"
        "⚠️ 현재 main 워크트리의 default branch — 작업 시작 전 worktree 필요.\n"
        "\n"
        "**규칙**: 이 turn 안에서 Write/Edit/mutating Bash 를 호출하기 전에\n"
        "worktree 를 만들고 그 안으로 cd 합니다. 그 전까지 spec/code Read 등\n"
        "context 누적 행위도 가능한 한 미룹니다 (사용자 질문에 대한 단순 답변·\n"
        "검색만 하는 turn 은 worktree 없이 진행 가능).\n"
        "\n"
        "**자주 발생하는 오해 (사례 기반)**:\n"
        "1. ❌ Write 의 file_path 를 .claude/worktrees/<name>/... 로 적으면 우회된다\n"
        "   → 우회되지 않습니다. hook 은 file_path 가 아니라 CWD 를 봅니다.\n"
        "      worktree 디렉토리가 실제로 존재해야 하고, CWD 도 그 안이어야 합니다.\n"
        "2. ❌ 일단 분석부터 시작하고 나중에 worktree 만들면 된다\n"
        "   → 분석 결과를 plan/* 에 기록해야 하는 순간이 옵니다. 그때 다시\n"
        "      setup 으로 돌아가면 누적된 컨텍스트가 낭비됩니다. 처음부터\n"
        "      worktree 안에서 시작하세요.\n"
        "\n"
        "**즉시 실행** (Bash tool 안에서):\n"
        "  .claude/tools/ensure-worktree.sh <task_name>\n"
        "  cd <printed path>\n"
        "\n"
        "Equivalent native flow:\n"
        "  TASK=<task>; SLUG=$(openssl rand -hex 3)\n"
        "  git worktree add \".claude/worktrees/${TASK}-${SLUG}\" \\\n"
        "                    -b \"claude/${TASK}-${SLUG}\"\n"
        "  cd \".claude/worktrees/${TASK}-${SLUG}\"\n"
        "\n"
        "일회성 우회 (release tag, 의식적 hotfix): BYPASS_DEFAULT_BRANCH_GUARD=1\n"
        "</system-reminder>"
    )
    print(reminder)
    return 0


if __name__ == "__main__":
    sys.exit(main())
