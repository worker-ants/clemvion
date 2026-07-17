#!/usr/bin/env python3
"""Consistency Checker Orchestrator — prepare-only mode.

Modes:
  --spec <path>        spec draft 검토
  --plan <path>        plan draft 검토
  --impl-prep <scope>  구현 착수 전 검토 (scope = spec/<area>/ 경로)
  --impl-done <scope>  구현 완료 후 검토 — spec 영역 + 코드 diff(vs --diff-base) 를
                       함께 묶어 5 checker 가 사후 검증. 기본 diff-base = origin/main.
                       `--diff-base <ref>` 로 override.

The orchestrator no longer calls a model. It collects context, writes
per-checker prompt bodies plus a retry-state file, and prints the session
directory path on stdout. The main Claude session then invokes 5 checker
sub-agents via the `Agent` tool and decides BLOCK based on the
`consistency-summary` sub-agent's SUMMARY.md output. See
`.claude/skills/consistency-checker/SKILL.md` for the full procedure.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime

# Reuse the shared library from code-review-agents, plus the harness-wide _lib.
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(THIS_DIR)
SKILLS_DIR = os.path.dirname(SKILL_DIR)  # .claude/skills/
CODE_REVIEW_SKILL = os.path.normpath(os.path.join(SKILLS_DIR, "code-review-agents"))
sys.path.insert(0, CODE_REVIEW_SKILL)
sys.path.insert(0, SKILLS_DIR)

from lib import session  # noqa: E402
from lib.role_instructions import CHECKER_INSTRUCTIONS  # noqa: E402
from _lib import project_config  # noqa: E402

DEBUG_LOG_FILE = "/tmp/consistency-checker-log.txt"
debug_log = session.make_debug_logger(DEBUG_LOG_FILE)

ALL_CHECKERS = [
    "cross_spec",
    "rationale_continuity",
    "convention_compliance",
    "plan_coherence",
    "naming_collision",
]


def _subagent_type(checker_name):
    return checker_name.replace("_", "-") + "-checker"


def load_config():
    agents_env = os.environ.get("CONSISTENCY_AGENTS", "").strip()
    if agents_env:
        agents = [a.strip() for a in agents_env.split(",") if a.strip()]
    else:
        # Apply project_config opt-out for checkers (symmetric with
        # code_review_orchestrator's reviewer toggle). Missing key /
        # true ⇒ enabled, explicit false ⇒ disabled. Env-var override
        # above takes precedence.
        cfg = project_config.load(os.getcwd())
        agents = project_config.filter_enabled_agents(cfg, "checkers", list(ALL_CHECKERS))

    return {
        "output_dir": os.environ.get("CONSISTENCY_OUTPUT_DIR", "./review/consistency"),
        "agents": agents,
        "max_context_size": int(os.environ.get("CONSISTENCY_MAX_CONTEXT_SIZE", "262144")),
    }


# ---------------------------------------------------------------------------
# State helpers (--summary-state / --update). Mirror code_review_orchestrator
# so main never has to Read _retry_state.json into its context.
# ---------------------------------------------------------------------------


def _load_state(session_dir):
    state_file = os.path.join(session_dir, "_retry_state.json")
    if not os.path.isfile(state_file):
        print(f"Error: _retry_state.json missing under {session_dir}", file=sys.stderr)
        sys.exit(1)
    with open(state_file, "r", encoding="utf-8") as f:
        return state_file, json.load(f)


def _save_state(state_file, state):
    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def _report_paths(session_dir, state):
    """Map checker name → where its report lives **in this session dir**.

    NOT `output_file` from the state: that records the worktree the session was prepared
    in, and worktrees are deleted when their task ends while `review/**` is committed —
    so the same session is later read from a different worktree at a different absolute
    path. Trusting the recorded path reports "no report" for every session whose worktree
    is gone (537 of 575 committed code-review sessions when measured, 2026-07-17).

    Mirrors `code_review_orchestrator._report_paths` — the two orchestrators keep their
    state machines in lockstep by duplication (see this module's header). Change both.
    """
    sd = os.path.abspath(session_dir)
    out = {}
    for inv in state.get("subagent_invocations", []):
        recorded = inv.get("output_file") or f"{inv['name']}.md"
        out[inv["name"]] = os.path.join(sd, os.path.basename(recorded))
    return out


def _reconcile_state_with_disk(session_dir):
    """Bring `_retry_state.json`'s buckets in line with the reports on disk. Returns
    `(state, changed)`. Quiet — callers decide what to say.

    Disk is the arbiter: a self-reported status with no file behind it is the fake
    success this contract exists to remove. Rate-limit bookkeeping is left alone — a
    checker that hit a limit has no file and stays pending, which is what /loop needs.

    Mirrors `code_review_orchestrator._reconcile_state_with_disk`. Change both.
    """
    sd = os.path.abspath(session_dir)
    state_file, state = _load_state(sd)
    known = [i["name"] for i in state.get("subagent_invocations", [])]
    if not known:
        return state, False
    outputs = _report_paths(sd, state)
    skipped = set(state.get("agents_skipped", []))

    on_disk = [n for n in known if os.path.isfile(outputs[n])]
    missing = [n for n in known if n not in on_disk and n not in skipped]
    fatal = [n for n in state.get("agents_fatal", []) if n in missing]

    before = (
        state.get("agents_success"),
        state.get("agents_pending"),
        state.get("agents_fatal"),
    )
    state["agents_success"] = on_disk
    # A checker already recorded as fatal stays fatal — it is not merely "not run yet",
    # and listing it in both buckets would make `pending`/`fatal` counts disagree.
    state["agents_pending"] = [n for n in missing if n not in fatal]
    state["agents_fatal"] = fatal
    changed = before != (
        state["agents_success"],
        state["agents_pending"],
        state["agents_fatal"],
    )
    if changed:
        _save_state(state_file, state)
    return state, changed


def _emit_summary_state(session_dir):
    """One-line state summary.

    Reconciles with disk first, so the numbers are true even when the session was fanned
    out with the Agent tool directly — that path never calls `--update`, which used to
    leave the state frozen at its prepare-time snapshot while the sibling SUMMARY.md
    reported real successes. Self-healing on read beats adding one more thing a caller
    must remember: the failure this addresses was itself an obligation living only in prose.
    """
    state, changed = _reconcile_state_with_disk(session_dir)
    if changed:
        print("(reconciled _retry_state.json with reports on disk)", file=sys.stderr)
    pending = len(state.get("agents_pending", []))
    success = len(state.get("agents_success", []))
    fatal = len(state.get("agents_fatal", []))
    last_reset = state.get("last_reset_hint_sec")
    last_reset_str = str(last_reset) if last_reset is not None else "null"
    print(f"pending={pending} success={success} fatal={fatal} last_reset={last_reset_str}")


def _apply_status_update(session_dir, agent, status, reset_hint):
    state_file, state = _load_state(os.path.abspath(session_dir))
    for bucket in ("agents_pending", "agents_success", "agents_fatal"):
        if agent in state.get(bucket, []):
            state[bucket].remove(agent)

    if status == "success":
        state.setdefault("agents_success", []).append(agent)
    elif status == "fatal":
        state.setdefault("agents_fatal", []).append(agent)
    else:
        state.setdefault("agents_pending", []).append(agent)
        if status == "rate_limit":
            state["rate_limit_episodes"] = state.get("rate_limit_episodes", 0) + 1
        if reset_hint is not None:
            prev = state.get("last_reset_hint_sec") or 0
            state["last_reset_hint_sec"] = max(prev, reset_hint)

    history_entry = {"ts": datetime.utcnow().isoformat() + "Z", "status": status}
    if reset_hint is not None:
        history_entry["reset_hint_sec"] = reset_hint
    state.setdefault("agent_history", {}).setdefault(agent, []).append(history_entry)

    _save_state(state_file, state)
    print(
        f"agent={agent} status={status} "
        f"pending={len(state.get('agents_pending', []))} "
        f"success={len(state.get('agents_success', []))} "
        f"fatal={len(state.get('agents_fatal', []))}"
    )


# ---------------------------------------------------------------------------
# File / corpus collection
# ---------------------------------------------------------------------------


def repo_root():
    return os.getcwd()


def read_text_file(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        debug_log(f"Failed to read {path}: {e}")
        return ""


def collect_markdown_files(root_dir, exclude_paths=None):
    if exclude_paths is None:
        exclude_paths = set()
    else:
        exclude_paths = {os.path.abspath(p) for p in exclude_paths}

    if not os.path.isdir(root_dir):
        return []

    files = []
    for current, dirs, filenames in os.walk(root_dir):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for fname in filenames:
            if not fname.endswith(".md"):
                continue
            full = os.path.abspath(os.path.join(current, fname))
            if full in exclude_paths:
                continue
            files.append(full)
    files.sort()
    return files


def format_file_bundle(file_paths, root, label):
    if not file_paths:
        return f"### {label}\n(없음)\n"
    parts = [f"### {label}\n"]
    for path in file_paths:
        rel = os.path.relpath(path, root) if root else path
        content = read_text_file(path)
        parts.append(f"\n#### `{rel}`\n```\n{content}\n```\n")
    return "".join(parts)


def _collect_code_diff(diff_base, root):
    """Return ``git diff <diff_base>...HEAD`` for the project's code areas.

    Used by ``--impl-done`` to bundle the implementation diff alongside
    the spec area files so checkers can compare both sides. Empty
    string on any failure (missing base ref, no diff, git error).
    """
    cfg = project_config.load(root)
    code_areas = cfg.get("code_areas") or []
    cmd = ["git", "diff", f"{diff_base}...HEAD", "--"]
    if code_areas:
        cmd.extend(code_areas)
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30, cwd=root,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        debug_log(f"git diff for --impl-done failed: {e}")
        return ""
    if proc.returncode != 0:
        debug_log(
            f"git diff for --impl-done returned {proc.returncode}: "
            f"{proc.stderr.strip()[:200]}"
        )
        return ""
    return proc.stdout


def _head_basis_notice(root, diff_base):
    """Prominent ``--impl-done`` preamble pinning *current code* to HEAD.

    Root cause this guards against: consistency checker sub-agents (cross_spec,
    naming_collision, …) run with a working directory that is the
    *default-branch* checkout (≈ ``diff_base``), NOT this task's worktree where
    the implementation lives. So a checker that inspects code via a relative
    Read/Grep/Bash sees the PRE-change code and falsely reports "spec declares
    X but code lacks X" as CRITICAL — blocking legitimate PRs that add code and
    spec together (PR #738: checker counted ``MONITORED_QUEUES`` as 15 from the
    base checkout while HEAD had 17). The orchestrator already runs *inside* the
    worktree (``root == os.getcwd()``), so it can hand the checker the one
    authoritative path and forbid missing-from-code conclusions drawn from the
    sub-agent's own CWD. A relative read is stale; an absolute read under
    ``root`` (or ``git -C root``) is HEAD-correct regardless of the CWD.
    """
    return (
        "## ⚠️ 현재 구현 코드의 기준 (impl-done — 먼저 읽을 것)\n\n"
        "본 검토에서 \"현재 구현\" 의 단일 진실(SoT)은 아래 **HEAD 워킹트리**다:\n\n"
        f"    {root}\n\n"
        f"(diff-base `{diff_base}` 대비 신규·변경 코드가 모두 반영된 working tree.)\n\n"
        "당신(checker sub-agent)의 기본 작업 디렉토리(CWD)는 이 워킹트리가 **아닐 수 있으며**, "
        f"`{diff_base}`(변경 전) 상태의 별도 체크아웃일 수 있다. 따라서:\n\n"
        "- 코드의 존재·내용을 확인할 때 **상대경로 Read/Grep/Bash(=CWD 기준)를 신뢰하지 말 것.** "
        "CWD 는 변경 전 코드라 \"신규 식별자가 코드에 없다\" 는 거짓 결론을 만든다 (과거 오탐: "
        "checker 가 큐 상수를 변경 전 개수로 세어 신규 큐 미구현이라 단언 → 정당한 PR BLOCK).\n"
        "- 코드를 직접 확인해야 하면 반드시 위 워킹트리를 **절대경로**로 지목하라:\n"
        f"    - `Read(\"{root}/codebase/.../file.ts\")` — 절대경로 Read\n"
        f"    - `git -C \"{root}\" grep -n \"<식별자>\"`\n"
        f"    - `git -C \"{root}\" show HEAD:codebase/.../file.ts`\n"
        "- 아래 `## 구현 변경 사항` 의 diff 는 위 워킹트리에서 산출된 것이라 신규·변경 코드의 1차 "
        "근거다. diff 의 `+` 라인 또는 위 워킹트리에 식별자가 있으면 그것은 **구현된 것**이다.\n"
        "- **\"spec 이 선언한 X 가 코드에 미구현·누락\" 류의 CRITICAL 은**, 위 절대경로 또는 "
        f"`git -C \"{root}\"` 로 재확인하기 전에는 보고하지 말 것.\n\n"
    )


RATIONALE_HEADER_RE = re.compile(r"^##\s+Rationale\b.*$", re.MULTILINE)


def extract_rationale_sections(file_paths, root):
    blocks = []
    for path in file_paths:
        text = read_text_file(path)
        match = RATIONALE_HEADER_RE.search(text)
        if not match:
            continue
        start = match.start()
        rest = text[match.end():]
        end_match = re.search(r"^(#{1,2})\s+", rest, re.MULTILINE)
        if end_match:
            section = text[start:match.end() + end_match.start()]
        else:
            section = text[start:]
        rel = os.path.relpath(path, root) if root else path
        blocks.append(f"\n#### `{rel}` 의 Rationale\n\n{section.strip()}\n")
    if not blocks:
        return "### Rationale 발췌\n(관련 Rationale 섹션 없음)\n"
    return "### Rationale 발췌\n" + "".join(blocks)


def collect_context(args, root):
    cfg = project_config.load(root)
    corpora = cfg["corpora"]
    spec_dir = os.path.join(root, corpora["spec"])
    conventions_dir = os.path.join(root, corpora["conventions"])
    plan_dir = os.path.join(root, corpora["plan_in_progress"])

    excluded = set()
    target_path_rel = ""
    target_doc = ""
    mode_label = ""

    def _require_target(value, flag, want_dir):
        """Fail fast when a mode argument is not the path it must be.

        Every mode arg is interpolated verbatim into each checker prompt's
        `## Target 문서 / 경로:` field. Without this check a non-path (e.g. a task
        description pasted into the scope slot) sails through: `collect_markdown_files`
        just returns [] for a missing dir, the bundle renders `(없음)`, and all five
        checkers then report the corrupted payload as a CRITICAL — a BLOCK: YES with
        zero real conflicts. Measured 2026-07-17; the run cost a full 5-checker fan-out
        before the mistake surfaced. Cheap to catch here, expensive to catch there.
        """
        path = os.path.abspath(value)
        ok = os.path.isdir(path) if want_dir else os.path.isfile(path)
        if ok:
            return path
        kind = "디렉토리" if want_dir else "파일"
        hint = ""
        if os.path.exists(path):
            hint = f"\n  → 경로는 존재하지만 {kind} 가 아닙니다."
        elif " " in value.strip() or "\n" in value:
            # Repo paths have no spaces; a space almost always means prose landed here.
            hint = (
                "\n  → 설명문을 넣은 것 같습니다. 이 인자는 **경로만** 받습니다.\n"
                "     작업 배경·수정 계획은 plan/in-progress/<task>.md 에 쓰세요 —\n"
                "     checker 가 그 파일을 알아서 읽습니다."
            )
        sys.stderr.write(
            f"Error: {flag} 의 인자가 실존하는 {kind} 경로가 아닙니다.{hint}\n"
            f"  받은 값: {value!r}\n"
            f"  해석된 경로: {path}\n"
            f"\n사용법: {flag} <{kind} 경로>\n"
            f"  예) --spec plan/in-progress/spec-draft-foo.md\n"
            f"      --plan plan/in-progress/my-task.md\n"
            f"      --impl-prep spec/2-navigation/\n"
            f"      --impl-done spec/2-navigation/\n"
        )
        sys.exit(2)

    if args.spec:
        target_path_rel = args.spec
        target_abs = _require_target(args.spec, "--spec", want_dir=False)
        excluded.add(target_abs)
        target_doc = read_text_file(target_abs)
        mode_label = "spec draft 검토 (--spec)"

    elif args.plan:
        target_path_rel = args.plan
        target_abs = _require_target(args.plan, "--plan", want_dir=False)
        excluded.add(target_abs)
        target_doc = read_text_file(target_abs)
        mode_label = "plan draft 검토 (--plan)"

    elif args.impl_prep:
        target_path_rel = args.impl_prep
        target_abs = _require_target(args.impl_prep, "--impl-prep", want_dir=True)
        scope_files = collect_markdown_files(target_abs)
        excluded.update(scope_files)
        target_doc = format_file_bundle(scope_files, root, f"구현 대상 영역: `{target_path_rel}`")
        mode_label = f"구현 착수 전 검토 (--impl-prep, scope={target_path_rel})"

    elif args.impl_done:
        target_path_rel = args.impl_done
        target_abs = _require_target(args.impl_done, "--impl-done", want_dir=True)
        scope_files = collect_markdown_files(target_abs)
        excluded.update(scope_files)
        spec_bundle = format_file_bundle(
            scope_files, root, f"구현 대상 spec 영역: `{target_path_rel}`"
        )
        diff_base = args.diff_base or "origin/main"
        diff_text = _collect_code_diff(diff_base, root)
        if diff_text.strip():
            diff_section = (
                f"\n\n## 구현 변경 사항 (git diff {diff_base}...HEAD -- "
                f"<code_areas>)\n\n```diff\n{diff_text}\n```\n"
            )
        else:
            diff_section = (
                f"\n\n## 구현 변경 사항 (git diff {diff_base}...HEAD -- "
                "<code_areas>)\n\n(변경 없음 또는 git diff 실패 — base ref 가 fetch 되어 있는지 확인)\n"
            )
        # HEAD-basis notice goes FIRST so it survives target_doc truncation
        # (truncate_to_budget trims the tail) and the checker reads the
        # current-code SoT before anything else.
        target_doc = _head_basis_notice(root, diff_base) + spec_bundle + diff_section
        mode_label = (
            f"구현 완료 후 검토 (--impl-done, scope={target_path_rel}, "
            f"diff-base={diff_base})"
        )

    else:
        raise ValueError(
            "Mode 가 지정되지 않았습니다: --spec / --plan / --impl-prep / --impl-done 중 하나가 필요합니다."
        )

    all_spec_files = collect_markdown_files(spec_dir, exclude_paths=excluded)
    # Conventions may live under spec_dir (default) or be relocated by
    # .claude.project.json — handle both. When relocated, collect the
    # conventions corpus separately so the convention-compliance checker
    # still sees its source files.
    if conventions_dir == spec_dir or conventions_dir.startswith(spec_dir + os.sep):
        convention_files = [p for p in all_spec_files if conventions_dir in p]
        other_spec_files = [p for p in all_spec_files if conventions_dir not in p]
    else:
        convention_files = collect_markdown_files(conventions_dir, exclude_paths=excluded)
        other_spec_files = all_spec_files
    plan_files = collect_markdown_files(plan_dir, exclude_paths=excluded)

    related_specs = format_file_bundle(other_spec_files, root, "관련 spec 본문")
    conventions = format_file_bundle(convention_files, root, "spec/conventions 정식 규약")
    plan_in_progress = format_file_bundle(plan_files, root, "plan/in-progress 진행 중 문서")
    rationale_excerpts = extract_rationale_sections(other_spec_files, root)

    return {
        "mode": mode_label,
        "target_path": target_path_rel,
        "target_doc": target_doc,
        "related_specs": related_specs,
        "rationale_excerpts": rationale_excerpts,
        "conventions": conventions,
        "plan_in_progress": plan_in_progress,
    }


# ---------------------------------------------------------------------------
# Prompt body builder
# ---------------------------------------------------------------------------


# Per-key context budget. Keeps each checker's prompt body within
# max_context_size. target_doc gets the biggest slice; supporting corpora
# share the rest. Same ratios as the previous implementation.
CHECKER_BUDGET_RATIO = {
    "target_doc": 0.30,
    "related_specs": 0.30,
    "rationale_excerpts": 0.15,
    "conventions": 0.10,
    "plan_in_progress": 0.15,
}


def budget_substitutions(context, max_context_size):
    if max_context_size <= 0:
        return dict(context)
    out = {"mode": context["mode"], "target_path": context["target_path"]}
    for key, ratio in CHECKER_BUDGET_RATIO.items():
        text = context.get(key, "")
        budget = int(max_context_size * ratio)
        out[key] = session.truncate_to_budget(text, budget)
    return out


def _checker_corpus(checker_name, subs):
    """Return the supplementary corpus a given checker consumes."""
    if checker_name == "naming_collision":
        # naming_collision combines three sub-corpora.
        return "\n\n".join([
            subs.get("related_specs", ""),
            subs.get("plan_in_progress", ""),
            subs.get("conventions", ""),
        ])
    info = CHECKER_INSTRUCTIONS.get(checker_name, {})
    key = info.get("context_key")
    if not key:
        return ""
    return subs.get(key, "")


def build_checker_prompt_body(checker_name, subs):
    """Compose a role-specific prompt body for one checker.

    The sub-agent's system prompt already names the checker; we also embed
    the perspective and checklist here so each `_prompts/<checker>.md` is
    genuinely role-distinct rather than the same payload routed to N agents.
    Each checker only receives the supplementary corpus it needs.
    """
    info = CHECKER_INSTRUCTIONS.get(checker_name)
    if info is None:
        info = {
            "ko_title": checker_name,
            "perspective": "target 문서를 검토한다.",
            "checklist": (
                "(점검 항목이 정의되어 있지 않습니다. "
                "lib/role_instructions.py 에 항목을 추가하세요.)"
            ),
            "context_label": "보조 코퍼스",
        }

    corpus = _checker_corpus(checker_name, subs)
    parts = [
        f"# {info['ko_title']} Check Payload\n\n",
        f"본 파일은 orchestrator 가 {info['ko_title']} checker 용으로 작성한 입력입니다. "
        f"{info['perspective']}\n",
        "sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로\n",
        "따르되, 분석 시 아래 \"점검 관점\" 을 빠짐없이 적용하세요. 결과는 `output_file`\n",
        "인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.\n\n",
        f"## 점검 관점 ({info['ko_title']})\n\n",
        f"{info['checklist']}\n\n",
        f"## 검토 모드\n{subs.get('mode', '')}\n\n",
        f"## Target 문서\n경로: `{subs.get('target_path', '')}`\n\n",
        f"```\n{subs.get('target_doc', '')}\n```\n\n",
        f"## {info.get('context_label', '보조 코퍼스')}\n\n",
        corpus,
        "\n",
    ]
    return "".join(parts)


# ---------------------------------------------------------------------------
# Session preparation
# ---------------------------------------------------------------------------


def prepare_session(context, config):
    session_dir = session.create_session_dir(config["output_dir"])
    prompts_dir = os.path.join(session_dir, "_prompts")
    os.makedirs(prompts_dir, exist_ok=True)

    substitutions = budget_substitutions(context, config["max_context_size"])

    invocations = []
    for checker in config["agents"]:
        prompt_path = os.path.join(prompts_dir, f"{checker}.md")
        output_path = os.path.join(session_dir, f"{checker}.md")
        body = build_checker_prompt_body(checker, substitutions)
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(body)
        invocations.append({
            "name": checker,
            "subagent_type": _subagent_type(checker),
            "prompt_file": os.path.abspath(prompt_path),
            "output_file": os.path.abspath(output_path),
        })

    retry_state = {
        "session_dir": os.path.abspath(session_dir),
        "summary_subagent_type": "consistency-summary",
        "summary_output_file": os.path.abspath(os.path.join(session_dir, "SUMMARY.md")),
        "subagent_invocations": invocations,
        "agents_pending": [inv["name"] for inv in invocations],
        "agents_success": [],
        "agents_fatal": [],
        "agent_history": {},
        "rate_limit_episodes": 0,
        "total_wait_sec": 0,
        "wake_history": [],
        "last_reset_hint_sec": None,
        "loop_mode": os.environ.get("AI_REVIEW_LOOP", "0") == "1",
    }
    state_path = os.path.join(session_dir, "_retry_state.json")
    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(retry_state, f, indent=2, ensure_ascii=False)

    meta = {
        "timestamp": datetime.now().isoformat(),
        "mode": context["mode"],
        "target_path": context["target_path"],
        "checkers": config["agents"],
    }
    session.save_metadata(session_dir, meta)

    debug_log(
        f"Prepared consistency session: {session_dir} "
        f"(mode={context['mode']}, checkers={len(invocations)})"
    )
    return os.path.abspath(session_dir)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Consistency Checker Orchestrator (prepare).")
    mode = parser.add_mutually_exclusive_group(required=False)
    mode.add_argument("--spec", type=str, metavar="PATH",
                      help="spec draft path (e.g., plan/in-progress/spec-draft-foo.md)")
    mode.add_argument("--plan", type=str, metavar="PATH",
                      help="plan draft path")
    mode.add_argument("--impl-prep", type=str, dest="impl_prep", metavar="SCOPE",
                      help="pre-implementation check scope (spec/<area>/ path)")
    mode.add_argument("--impl-done", type=str, dest="impl_done", metavar="SCOPE",
                      help="post-implementation check scope (spec/<area>/ path). "
                           "Bundles spec area + code diff (vs --diff-base, default origin/main).")
    parser.add_argument("--diff-base", type=str, dest="diff_base", metavar="REF",
                        default=None,
                        help="git ref to diff against for --impl-done (default: origin/main).")
    parser.add_argument("--resume", type=str, metavar="SESSION_DIR",
                        help="Resume an existing session: skip prepare, validate the "
                             "_retry_state.json, echo the absolute session_dir on stdout. "
                             "Used by /loop wake-ups to re-enter the same session.")
    parser.add_argument("--summary-state", type=str, metavar="SESSION_DIR",
                        help="Echo a one-line summary of _retry_state.json to stdout: "
                             "pending=N success=N fatal=N last_reset=<sec|null>. "
                             "Main uses this for branch decisions without loading full JSON.")
    parser.add_argument("--update", type=str, metavar="SESSION_DIR",
                        help="Update a single checker's status. Requires --agent --status. "
                             "Optional --reset-hint <sec>.")
    parser.add_argument("--agent", type=str, metavar="NAME")
    parser.add_argument("--status", type=str, metavar="STATUS",
                        choices=["success", "rate_limit", "network", "fatal"])
    parser.add_argument("--reset-hint", type=int, metavar="SEC")

    args = parser.parse_args()

    if os.environ.get("DISABLE_CONSISTENCY_CHECK", "0") == "1":
        print("DISABLE_CONSISTENCY_CHECK=1, skipping.", file=sys.stderr)
        sys.exit(0)

    # Resume mode mirrors code_review_orchestrator: validate + echo the path.
    if args.resume:
        sd = os.path.abspath(args.resume)
        state_file = os.path.join(sd, "_retry_state.json")
        if not os.path.isfile(state_file):
            print(
                f"Error: cannot resume — _retry_state.json missing under {sd}",
                file=sys.stderr,
            )
            sys.exit(1)
        # Reconcile before handing the session back: a /loop wake-up decides what to
        # re-run from these buckets, and a fallback fan-out (which never calls --update)
        # leaves them frozen at the prepare-time snapshot — resuming from that re-runs
        # checkers whose reports are already on disk.
        _, changed = _reconcile_state_with_disk(sd)
        if changed:
            debug_log(f"Resume: reconciled _retry_state.json with disk under {sd}")
        debug_log(f"Resuming consistency session: {sd}")
        print(sd)
        sys.exit(0)

    # Summary-state mode: echo a single line so main does not Read the JSON itself.
    if args.summary_state:
        _emit_summary_state(args.summary_state)
        sys.exit(0)

    # Update mode: mutate _retry_state.json on behalf of main.
    if args.update:
        if not args.agent or not args.status:
            print("Error: --update requires --agent NAME and --status STATUS",
                  file=sys.stderr)
            sys.exit(2)
        _apply_status_update(args.update, args.agent, args.status, args.reset_hint)
        sys.exit(0)

    if not (args.spec or args.plan or args.impl_prep or args.impl_done):
        parser.error(
            "--spec / --plan / --impl-prep / --impl-done 중 하나가 필요합니다 "
            "(또는 --resume <SESSION_DIR>)."
        )

    config = load_config()
    root = repo_root()

    try:
        context = collect_context(args, root)
    except Exception as e:
        print(f"Error collecting context: {e}", file=sys.stderr)
        debug_log(f"collect_context failed: {e}")
        sys.exit(1)

    if not context["target_doc"].strip():
        print(f"Error: target document is empty or unreadable: {context['target_path']}",
              file=sys.stderr)
        sys.exit(1)

    print(f"Mode: {context['mode']}", file=sys.stderr)
    print(f"Target: {context['target_path']}", file=sys.stderr)
    print(f"Checkers: {', '.join(config['agents'])}", file=sys.stderr)

    try:
        session_dir = prepare_session(context, config)
    except Exception as e:
        print(f"Error preparing session: {e}", file=sys.stderr)
        debug_log(f"prepare_session failed: {e}")
        sys.exit(1)

    # stdout: session_dir absolute path. Main parses this.
    print(session_dir)
    sys.exit(0)


if __name__ == "__main__":
    main()
