#!/usr/bin/env python3
"""Code Review Agents Orchestrator — prepare-only mode.

Collects diff/context for `/ai-review` and writes:
  - review/<timestamp>/_prompts/<agent>.md  (one prompt body per reviewer)
  - review/<timestamp>/_retry_state.json    (pending/success/fatal lists +
                                             subagent invocation contract)
  - review/<timestamp>/meta.json            (initial metadata)

Prints the session directory path to stdout (one line per batch).

This script **does not** call any model. The actual reviews are performed by
the main Claude session via the `Agent` tool — see
`.claude/skills/code-review-agents/SKILL.md` for the procedure. The reason is
a billing-policy change that disallows both `claude -p` and direct Anthropic
SDK calls from auxiliary processes.
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime

# Make sibling lib package importable when invoked as a standalone script,
# plus the harness-wide _lib at .claude/skills/_lib/.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_SKILL_DIR = os.path.dirname(_SCRIPT_DIR)
_SKILLS_DIR = os.path.dirname(_SKILL_DIR)  # .claude/skills/
_CLAUDE_DIR = os.path.dirname(_SKILLS_DIR)  # .claude/
sys.path.insert(0, _SKILL_DIR)
sys.path.insert(0, _SKILLS_DIR)
sys.path.insert(0, _CLAUDE_DIR)

from lib import line_anchors  # noqa: E402
from lib import router_safety  # noqa: E402
from lib import session  # noqa: E402
from lib.role_instructions import REVIEWER_INSTRUCTIONS  # noqa: E402
from lib.router_safety import compute_forced_agents  # noqa: E402
from _lib import project_config  # noqa: E402

# Report location/validity is shared with the push/stop gate — see
# `.claude/_shared/report_paths.py`. `--verify-coverage` and `review_guard` must answer
# "did this agent leave a report?" identically; each keeping its own copy behind a
# "change both" comment already diverged inside one PR.
from _shared import report_paths as _report_paths_lib  # noqa: E402

DEBUG_LOG_FILE = "/tmp/code-review-agents-log.txt"
debug_log = session.make_debug_logger(DEBUG_LOG_FILE)

# Size caps, in characters (not bytes — Korean text is 3 bytes/char in UTF-8,
# so a 131,072-char prompt is ~190 KB on disk).
#
# These were 51,200 / 131,072 before the payload grew a line-number gutter.
# The gutter is *metadata*, not reviewable content: measured over the last 40
# commits (2026-07-23) it adds 5.97% to diffs and 8.66% to whole-file context,
# 7.76% to the two combined. Holding the caps at their pre-gutter values would
# therefore have quietly reduced how much actual code each reviewer sees —
# measured on a budget-binding changeset (commit 860aad982, 17 files),
# whole-file context blocks fell from 4 to 1. The caps are raised by the same
# margin so what stays flat is the volume of reviewed code, not the byte count.
#
# 1.08 is the *combined* 7.76% rounded up, not the 8.66% whole-file figure: a
# real payload is mostly diff (that changeset was 121 KB of diff against 106 KB
# of whole-file context, and on a budget-binding one the whole-file blocks are
# the first thing dropped), so weighting by the worst single component would
# over-provision. Verified against the same changeset after the change:
# whole-file blocks 4 → 5 and total lines 2,629 → 2,618, i.e. truncation does
# not fire earlier than it did before the gutter existed.
#
# `REVIEW_MAX_FILE_SIZE` / `REVIEW_MAX_PROMPT_SIZE` still override both.
_GUTTER_OVERHEAD = 1.08
DEFAULT_MAX_FILE_SIZE = int(51200 * _GUTTER_OVERHEAD)      # 55,296
DEFAULT_MAX_PROMPT_SIZE = int(131072 * _GUTTER_OVERHEAD)   # 141,557

# Caller-side trust check for a routing decision: the router must honour the
# forced whitelist. Violating it discards the whole decision and runs every
# reviewer.
#
# Why (measured 2026-07-23, session 14_47_40): the router returned
# selected=false for **all 14** reviewers — the 7 forced ones included — with
# the rationale "소스 코드 변경 없음(문서만 변경)", on a 19-file changeset
# containing a brand-new Python module whose content was in the router's own
# prompt. `_apply_routing` silently re-added the forced reviewers and trusted
# everything else, so the run presented as a healthy 7-reviewer review while
# every judgement behind it was wrong.
#
# The forced list is stated to the router as `selected=true` 고정, so returning
# one as false is a contract breach rather than a judgement call. That makes it
# the sharpest signal available that the decision as a whole is untrustworthy,
# and — unlike any count-based threshold — it cannot fire on a legitimately
# narrow decision (a doc-only typo routing to `documentation` alone is correct
# and must stay cheap).
#
# Scope note: this does **not** revive the old "selected 수가 0 또는 1 이면 전체
# fallback" rule. That was deliberately retired in 6cd7376fc (#244) in favour of
# "0 명이면 fatal + minimal SUMMARY, 1명 이상이면 그대로 진행" — see
# `.claude/agents/review-router.md` step 4 and README's router-safety table
# ("전체 fallback 안 함"). Only the stale prose advertising the retired rule is
# corrected here; the zero-reviewer path keeps its documented fatal behaviour.

BINARY_EXTENSIONS = {
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp", "tiff", "tif",
    "psd", "ai", "eps", "raw", "cr2", "nef", "heic", "heif", "avif",
    "jar", "war", "ear", "class", "pyc", "pyo", "o", "obj", "so", "dylib",
    "dll", "exe", "bin", "a", "lib", "ko",
    "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "zst",
    "woff", "woff2", "ttf", "otf", "eot",
    "mp3", "mp4", "avi", "mov", "wmv", "flv", "mkv", "webm",
    "wav", "flac", "aac", "ogg", "m4a",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "sqlite", "db", "sqlite3",
    "wasm", "map",
}

# Agent name → sub-agent definition name in .claude/agents/.
# Order is significant: it determines the order in the router prompt's
# "<N> reviewer 후보와 관점" block and the SUMMARY display order. Keep
# project-specific opt-out reviewers (e.g. user_guide_sync) last so the
# default 13 core reviewer order matches legacy docs / tests.
ALL_AGENTS = [
    "security", "performance", "architecture", "requirement", "scope",
    "side_effect", "maintainability", "testing", "documentation",
    "dependency", "database", "concurrency", "api_contract",
    "user_guide_sync",
]


def _subagent_type(agent_name):
    """Map orchestrator agent key (snake_case) to sub-agent type slug (kebab-case)."""
    return agent_name.replace("_", "-") + "-reviewer"


# ---------------------------------------------------------------------------
# Filtering helpers
# ---------------------------------------------------------------------------


def is_binary_file(file_path):
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(8192)
        return b"\x00" in chunk
    except Exception:
        return False


def is_binary_ext(file_path):
    _, ext = os.path.splitext(file_path)
    return ext.lstrip(".").lower() in BINARY_EXTENSIONS


def should_skip_binary(file_path):
    if is_binary_ext(file_path):
        return True
    if os.path.isfile(file_path) and is_binary_file(file_path):
        return True
    return False


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def load_config(route_mode="auto"):
    agents_env = os.environ.get("REVIEW_AGENTS", "").strip()
    agents_explicit = bool(agents_env)
    if agents_explicit:
        agents = [a.strip() for a in agents_env.split(",") if a.strip()]
    else:
        # Apply project_config opt-out: missing key / true ⇒ enabled,
        # explicit false ⇒ disabled. Env-var override above takes
        # precedence (one-off override beats persistent project policy).
        cfg = project_config.load(os.getcwd())
        agents = project_config.filter_enabled_agents(cfg, "reviewers", list(ALL_AGENTS))

    skip_ext_env = os.environ.get("REVIEW_SKIP_EXTENSIONS", "").strip()
    if skip_ext_env:
        skip_extensions = {e.strip().lstrip(".") for e in skip_ext_env.split(",") if e.strip()}
    else:
        skip_extensions = set()

    return {
        "output_dir": os.environ.get("REVIEW_OUTPUT_DIR", "./review/code"),
        "agents": agents,
        "agents_explicit": agents_explicit,
        "route_mode": route_mode,
        "max_file_size": int(
            os.environ.get("REVIEW_MAX_FILE_SIZE", str(DEFAULT_MAX_FILE_SIZE))
        ),
        "max_prompt_size": int(
            os.environ.get("REVIEW_MAX_PROMPT_SIZE", str(DEFAULT_MAX_PROMPT_SIZE))
        ),
        "batch_size": int(os.environ.get("REVIEW_BATCH_SIZE", "50")),
        "skip_extensions": skip_extensions,
    }


# ---------------------------------------------------------------------------
# State helpers (used by --summary-state, --update, --apply-routing).
# Read/Write _retry_state.json on behalf of main so the JSON itself never
# enters main's context. The whole point of these helpers: main reads only
# a one-line summary from stdout.
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


def _reconcile_state_with_disk(session_dir):
    """Bring `_retry_state.json`'s buckets in line with the reports on disk. Returns
    `(state, changed)`. Quiet — callers decide what to say.

    Disk is the arbiter: a self-reported status with no file behind it is the fake
    success this whole contract exists to remove.

    Rate-limit bookkeeping (`rate_limit_episodes`, `last_reset_hint_sec`) is left alone —
    an agent that hit a limit has no file and stays pending, which is what /loop needs.

    Mirrors `consistency_orchestrator._reconcile_state_with_disk`. Change both.
    """
    sd = os.path.abspath(session_dir)
    state_file, state = _load_state(sd)
    known = [i["name"] for i in state.get("subagent_invocations", [])]
    if not known:
        return state, False
    skipped = set(state.get("agents_skipped", []))

    # `has_report` (shared with the gate) = present AND non-empty. Plain `isfile` here
    # would count a `touch`ed placeholder that the gate refuses — the two enforcement
    # points must not disagree.
    on_disk = [n for n in known if _report_paths_lib.has_report(sd, n, state)]
    missing = [n for n in known if n not in on_disk and n not in skipped]
    fatal = [n for n in state.get("agents_fatal", []) if n in missing]

    before = (
        state.get("agents_success"),
        state.get("agents_pending"),
        state.get("agents_fatal"),
    )
    state["agents_success"] = on_disk
    # An agent already recorded as fatal stays fatal — it is not merely "not run yet",
    # and listing it in both buckets would make `pending`/`fatal` counts disagree.
    state["agents_pending"] = [n for n in missing if n not in fatal]
    state["agents_fatal"] = fatal
    # `agents_fatal` belongs in the comparison: without it, a run that only changed the
    # fatal list fixed `state` in memory and then skipped the save.
    changed = before != (
        state["agents_success"],
        state["agents_pending"],
        state["agents_fatal"],
    )
    if changed:
        _save_state(state_file, state)
    return state, changed


def _emit_summary_state(session_dir):
    """One-line summary of _retry_state.json — kept terse for main ctx.

    Reconciles with disk first, so the numbers are true even when the session was fanned
    out with the Agent tool directly (that path never calls `--update`, which used to
    leave the state frozen at its prepare-time snapshot while the sibling SUMMARY.md
    reported real successes — two committed artifacts contradicting each other).
    Self-healing on read beats adding one more thing a caller must remember: the failure
    this addresses was itself an obligation that only lived in prose.

    Caveat: that makes this command a conditional writer, so auditing an old committed
    session can dirty the worktree. The write is announced on stderr rather than done
    silently.
    """
    state, changed = _reconcile_state_with_disk(session_dir)
    if changed:
        print("(reconciled _retry_state.json with reports on disk)", file=sys.stderr)
    pending = len(state.get("agents_pending", []))
    success = len(state.get("agents_success", []))
    fatal = len(state.get("agents_fatal", []))
    skipped = len(state.get("agents_skipped", []))
    routing = state.get("routing_status", "pending")
    last_reset = state.get("last_reset_hint_sec")
    last_reset_str = str(last_reset) if last_reset is not None else "null"
    print(
        f"pending={pending} success={success} fatal={fatal} "
        f"skipped={skipped} routing={routing} last_reset={last_reset_str}"
    )


def _sync_from_disk(session_dir):
    """Reconcile _retry_state.json with the reviewer files actually on disk.

    Needed because main may fan reviewers out with the Agent tool directly instead of
    going through the Workflow (a documented fallback — e.g. to dodge a router bug).
    That path skips `--update`, so the state stays frozen at its prepare-time snapshot
    (`pending=all, success=0`) and gets committed that way — while the sibling SUMMARY.md
    reports 8/14 success. Two committed artifacts then contradict each other, and this
    file is the SoT for `/loop --resume` and `--summary-state` branch decisions.

    Disk is the arbiter: an agent's self-reported status is worth nothing if it left no
    file. Only names in `subagent_invocations` are considered, so this cannot invent
    agents. Observed 2026-07-17 across 7 sessions of one branch.

    Mostly redundant now — `--summary-state` and `--resume` reconcile on read — but kept
    as the explicit, loud form for a caller who wants to fix a committed session on
    purpose (and for the SKILLs that already document it).
    """
    state, _ = _reconcile_state_with_disk(session_dir)
    success = state.get("agents_success", [])
    missing = state.get("agents_pending", [])
    skipped = state.get("agents_skipped", [])
    known = [i["name"] for i in state.get("subagent_invocations", [])]
    print(
        f"synced: success={len(success)} pending={len(missing)} "
        f"skipped={len(skipped)} total={len(known)}"
        + (f" | still missing: {', '.join(missing)}" if missing else "")
    )


def _verify_coverage(session_dir):
    """Exit non-zero when a `agents_forced` reviewer produced no report.

    `agents_forced` is the router_safety whitelist — the SKILL says a router "강제 포함
    화이트리스트는 override 하지 못한다". But nothing enforced it: the Workflow only
    logs the list, and `--apply-routing` honours it solely when consuming a router
    decision. When main hand-picks reviewers (fallback fan-out) the whitelist was pure
    documentation, and documentation is exactly what a "this diff is small" judgement
    call talks itself past. That happened on 2026-07-17: `security` was skipped for a
    diff that edited `buildWorkspaceHref` — the open-redirect defence boundary — and it
    only surfaced later, by accident, while reconciling state.

    Coverage is judged by files on disk, not by claimed status.
    """
    sd = os.path.abspath(session_dir)
    _, state = _load_state(sd)
    forced = state.get("agents_forced", [])
    if not forced:
        print("forced=(none) — nothing to verify")
        return
    missing = _report_paths_lib.missing_reports(sd, forced, state)
    if not missing:
        print(f"forced coverage OK — {len(forced)}/{len(forced)} on disk")
        return
    sys.stderr.write(
        "Error: agents_forced (router_safety 화이트리스트) 미이행 — 산출물이 없습니다.\n"
        f"  누락: {', '.join(missing)}\n"
        f"  강제 목록: {', '.join(forced)}\n"
        "\n이 목록은 router 도 override 하지 못합니다 (code-review-agents SKILL).\n"
        "'변경이 작아 보인다' 는 자가 판단으로 건너뛰지 마세요 — 그 판단을 막으려고\n"
        "존재하는 목록입니다. 누락된 reviewer 를 실행한 뒤 SUMMARY 를 확정하세요.\n"
    )
    sys.exit(1)


def _apply_status_update(session_dir, agent, status, reset_hint):
    """Move agent between pending/success/fatal buckets and record history."""
    state_file, state = _load_state(os.path.abspath(session_dir))
    for bucket in ("agents_pending", "agents_success", "agents_fatal"):
        if agent in state.get(bucket, []):
            state[bucket].remove(agent)

    if status == "success":
        state.setdefault("agents_success", []).append(agent)
    elif status == "fatal":
        state.setdefault("agents_fatal", []).append(agent)
    else:
        # rate_limit / network — keep in pending for retry
        state.setdefault("agents_pending", []).append(agent)
        if status == "rate_limit":
            state["rate_limit_episodes"] = state.get("rate_limit_episodes", 0) + 1
        if reset_hint is not None:
            prev = state.get("last_reset_hint_sec") or 0
            state["last_reset_hint_sec"] = max(prev, reset_hint)

    history_entry = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "status": status,
    }
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


def _routing_distrust_reason(decisions, forced):
    """Why this routing decision must not be trusted, or None if it is fine.

    Shared shape with `.claude/workflows/ai-review.js` — the two routing paths
    must answer this identically, and `test_router_decision_trust.py`
    pins them together (the workflow sandbox forbids importing this).
    """
    dropped_forced = sorted(
        d.get("name") for d in decisions
        if d.get("name") in forced and not d.get("selected")
    )
    if dropped_forced:
        return (
            f"router marked forced reviewer(s) selected=false: "
            f"{', '.join(dropped_forced)}"
        )

    # Omitting a forced reviewer entirely is the same contract breach wearing a
    # different hat, and it used to be worse than saying false: the apply loop
    # only ever walks `decisions`, so an absent agent was neither selected nor
    # skipped and simply fell out of `agents_pending`.
    missing_forced = sorted(set(forced) - {d.get("name") for d in decisions})
    if missing_forced:
        return (
            f"router omitted forced reviewer(s) from its decision: "
            f"{', '.join(missing_forced)}"
        )

    # No zero-reviewer check here on purpose: `agents_forced ∪ router_selected`
    # being empty is a documented *fatal*, not a fallback — the router reports
    # it and main writes a minimal SUMMARY (review-router.md step 4, README
    # router-safety table). Adding a run-all fallback would quietly reverse
    # 6cd7376fc (#244).
    return None


def _apply_routing(session_dir, fallback=False):
    """Consume _routing_decision.json and update _retry_state.json.

    Without --fallback: read decisions[], move selected=false agents from
    pending to skipped. Echo 'applied=<selected_count> skipped=<skipped_count>'.

    With --fallback: mark routing_status='skipped' with fallback reason,
    keep all reviewers in pending (router failure path).
    """
    sd = os.path.abspath(session_dir)
    state_file, state = _load_state(sd)

    if fallback:
        state["routing_status"] = "skipped"
        state["routing_skip_reason"] = "router fatal — fallback to all reviewers"
        _save_state(state_file, state)
        print(f"applied={len(state.get('agents_pending', []))} skipped=0 fallback=yes")
        return

    decision_file = os.path.join(sd, "_routing_decision.json")
    if not os.path.isfile(decision_file):
        print(f"Error: _routing_decision.json missing under {sd}", file=sys.stderr)
        sys.exit(1)
    with open(decision_file, "r", encoding="utf-8") as f:
        decision = json.load(f)

    forced = set(state.get("agents_forced", []))
    decisions = decision.get("decisions", [])

    distrust = _routing_distrust_reason(decisions, forced)
    if distrust:
        state["routing_status"] = "skipped"
        state["routing_skip_reason"] = f"{distrust} — decision discarded, running all"
        _save_state(state_file, state)
        print(
            f"applied={len(state.get('agents_pending', []))} skipped=0 "
            f"fallback=distrusted-decision"
        )
        return

    selected = []
    skipped = []
    for d in decisions:
        name = d.get("name")
        if d.get("selected") or name in forced:
            selected.append(name)
        else:
            skipped.append(name)

    # Build new pending list: keep only selected (or forced) agents.
    state["agents_pending"] = [a for a in state.get("agents_pending", []) if a in selected]
    state.setdefault("agents_skipped", []).extend(
        a for a in skipped if a not in state.get("agents_skipped", [])
    )
    state["routing_status"] = "done"
    _save_state(state_file, state)
    print(f"applied={len(state['agents_pending'])} skipped={len(state['agents_skipped'])}")


# ---------------------------------------------------------------------------
# Prompt body builder (role-specific — the sub-agent's system prompt also
# carries the same role, but the orchestrator embeds the perspective and
# checklist here so each `_prompts/<role>.md` is genuinely role-distinct).
# ---------------------------------------------------------------------------

DIFF_HEADING = "#### 변경된 코드 (unified diff)"
OLD_CODE_HEADING = "#### 이전 코드"
FULL_CONTEXT_HEADING = "#### 전체 파일 컨텍스트"

# Prepended to every reviewer/router payload. Without it the gutter is just
# unexplained digits; with it a reviewer knows the numbers are real source
# lines and that this document's own offsets are not.
LINE_ANCHOR_LEGEND = (
    "## 위치 표기 규약 (반드시 준수)\n\n"
    "아래 모든 코드 블록은 **왼쪽에 실제 소스 라인 번호 게이트**가 붙어 있습니다 "
    "(`  42|` 형식 — 숫자, `|`, 그다음이 원본 내용).\n\n"
    f"- `{DIFF_HEADING}` — 게이트 숫자는 **변경 후(new) 파일 기준** 줄 번호입니다. "
    "`+`(추가)·` `(문맥) 줄에 번호가 붙습니다. `-`(삭제) 줄은 새 파일에 존재하지 "
    "않으므로 게이트가 **비어 있습니다**.\n"
    f"- `{FULL_CONTEXT_HEADING}` — 게이트 숫자는 그 파일의 1-기준 실제 줄 번호입니다.\n"
    "- 게이트가 비어 있거나 없는 줄에는 인용할 수 있는 줄 번호가 **없습니다**.\n\n"
    "**발견사항의 `위치` 를 적을 때:**\n\n"
    "1. 반드시 게이트 숫자를 쓰세요. **이 문서(프롬프트) 안에서 몇 번째 줄인지를 세지 "
    "마세요** — 이 문서는 여러 파일을 이어붙인 조립물이라 그 오프셋은 소스 라인 번호와 "
    "아무 관계가 없습니다. (실제로 이 혼동이 존재하지 않는 줄 번호를 인용하는 사고를 "
    "냈습니다: 99줄짜리 파일에 대해 \"line 1362\" 로 기재.)\n"
    "2. 게이트 숫자를 쓸 수 없는 경우(잘린 블록·게이트 없는 줄)에는 **줄 번호를 지어내지 "
    "말고** 함수명·클래스명·블록 설명으로 기재하세요. 위치가 틀린 발견사항은 위치가 없는 "
    "발견사항보다 나쁩니다.\n"
    "3. 확신이 서지 않으면 `Read`/`Grep` 으로 해당 파일을 직접 열어 확인한 뒤 기재하세요. "
    "게이트 숫자는 원본 파일의 줄 번호와 일치하므로 그대로 대조됩니다.\n\n"
)


def _truncated_note(kept, total, reason):
    """Say exactly how much was cut, in lines — the unit the gutter speaks in.

    The old marker ("truncated due to size limit") left the reviewer unable to
    tell a short file from a clipped one.
    """
    return f"\n... ({reason}으로 {kept}/{total} 줄만 표시 — 나머지는 원본 파일 참조) ..."


def build_files_section(change_infos, max_file_size, max_total_size=0):
    """Compose the changed-files context, respecting per-file and total budgets.

    Both the diff and the whole-file context carry a line-number gutter (see
    `lib/line_anchors.py`). Without it a reviewer has no way to know a real line
    number and ends up citing offsets into this assembled document instead —
    measured, not hypothesised: see that module's docstring.
    """
    separator = "\n---\n\n"

    file_parts = []
    for i, ci in enumerate(change_infos, 1):
        header = f"### 파일 {i}: {ci['file_path']}\n"
        header += f"- 변경 유형: {ci['change_type']}\n"
        header += f"- 언어: {ci['file_extension']}\n"

        diff_section = ""
        if ci.get("code"):
            annotated = line_anchors.annotate_unified_diff(ci["code"])
            diff_section += f"\n{DIFF_HEADING}\n```\n{annotated}\n```\n"
        if ci.get("old_code"):
            diff_section += f"\n{OLD_CODE_HEADING}\n```\n{ci['old_code']}\n```\n"

        # Number first, then cut on a line boundary: slicing raw characters
        # could leave a half-written line number, which is exactly the kind of
        # untrustworthy anchor the gutter exists to eliminate.
        full_content = line_anchors.number_source_lines(
            ci.get("full_file_content", "")
        )
        if len(full_content) > max_file_size:
            full_content, kept, total = line_anchors.truncate_to_line_boundary(
                full_content, max_file_size
            )
            full_content += _truncated_note(kept, total, "파일 크기 제한")

        file_parts.append({
            "header": header,
            "diff": diff_section,
            "full_content": full_content,
            "full_content_size": len(full_content),
        })

    if max_total_size <= 0:
        sections = []
        for fp in file_parts:
            section = fp["header"] + fp["diff"]
            if fp["full_content"]:
                section += f"\n{FULL_CONTEXT_HEADING}\n```\n{fp['full_content']}\n```\n"
            sections.append(section)
        return separator.join(sections)

    base_sections = [fp["header"] + fp["diff"] for fp in file_parts]
    base_size = len(separator.join(base_sections))

    if base_size >= max_total_size:
        indexed = [(i, fp) for i, fp in enumerate(file_parts)]
        indexed.sort(key=lambda x: len(x[1]["diff"]), reverse=True)
        overflow = base_size - max_total_size
        for idx, fp in indexed:
            if overflow <= 0:
                break
            diff_len = len(fp["diff"])
            if diff_len == 0:
                continue
            cut = min(overflow, diff_len)
            new_len = diff_len - cut
            if new_len > 0:
                kept_text, kept, total = line_anchors.truncate_to_line_boundary(
                    fp["diff"], new_len
                )
                # Trailing "\n" only here (not at the other two truncation
                # sites): this branch's text is concatenated straight onto the
                # next section by `separator.join`, whereas the whole-file cuts
                # are already followed by a closing fence. Pre-existing shape,
                # kept as-is so the change stays behaviour-preserving.
                fp["diff"] = kept_text + _truncated_note(kept, total, "프롬프트 크기 제한") + "\n"
            else:
                fp["diff"] = "\n\n... (프롬프트 크기 제한으로 diff 생략 — 원본 파일 참조) ...\n"
            overflow -= cut
        sections = [fp["header"] + fp["diff"] for fp in file_parts]
        return separator.join(sections)

    remaining_budget = max_total_size - base_size
    content_wrapper_overhead = len(f"\n{FULL_CONTEXT_HEADING}\n```\n\n```\n")

    content_indices = [i for i, fp in enumerate(file_parts) if fp["full_content"]]
    content_indices.sort(key=lambda i: file_parts[i]["full_content_size"])

    include_content = {}
    for i in content_indices:
        needed = file_parts[i]["full_content_size"] + content_wrapper_overhead
        if needed <= remaining_budget:
            include_content[i] = file_parts[i]["full_content"]
            remaining_budget -= needed
        else:
            available = remaining_budget - content_wrapper_overhead
            if available > 200:
                kept_text, kept, total = line_anchors.truncate_to_line_boundary(
                    file_parts[i]["full_content"], available
                )
                include_content[i] = kept_text + _truncated_note(
                    kept, total, "프롬프트 크기 제한"
                )
                remaining_budget = 0
            break

    sections = []
    for i, fp in enumerate(file_parts):
        section = fp["header"] + fp["diff"]
        if i in include_content:
            section += f"\n{FULL_CONTEXT_HEADING}\n```\n{include_content[i]}\n```\n"
        sections.append(section)
    return separator.join(sections)


def build_agent_prompt_body(agent_name, change_infos, max_file_size, max_prompt_size):
    """Compose a role-specific prompt body for one reviewer.

    The sub-agent's system prompt already names the reviewer; we still embed
    the perspective and checklist here so the request itself is role-distinct
    and the file artefacts (`_prompts/<role>.md`) are not 13 copies of the
    same payload. See lib/role_instructions.py for the per-role data.
    """
    info = REVIEWER_INSTRUCTIONS.get(agent_name)
    if info is None:
        # Unknown reviewer key — keep going with a generic header so the
        # session still produces something useful, but make the gap visible.
        info = {
            "ko_title": agent_name,
            "perspective": "다음 코드 변경을 분석한다.",
            "checklist": (
                "(점검 항목이 정의되어 있지 않습니다. "
                "lib/role_instructions.py 에 항목을 추가하세요.)"
            ),
            "scope_optional": False,
        }

    scope_note = ""
    if info.get("scope_optional"):
        scope_note = (
            "> 변경 코드가 본 reviewer 의 영역과 무관하면 \"해당 없음\" 으로 응답하고\n"
            "> 위험도를 NONE 으로 설정해 `STATUS=success ISSUES=0` 으로 반환합니다.\n\n"
        )

    header = (
        f"# {info['ko_title']} Review Payload\n\n"
        f"본 파일은 orchestrator 가 {info['ko_title']} reviewer 용으로 작성한 입력입니다. "
        f"{info['perspective']}\n"
        "sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로\n"
        "따르되, 분석 시 아래 \"점검 관점\" 을 빠짐없이 적용하세요. 결과는 `output_file`\n"
        "인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.\n\n"
        f"{scope_note}"
        f"{LINE_ANCHOR_LEGEND}"
        f"## 점검 관점 ({info['ko_title']})\n\n"
        f"{info['checklist']}\n\n"
        "## 리뷰 대상 파일\n\n"
    )
    files_budget = 0
    if max_prompt_size > 0:
        files_budget = max(max_prompt_size - len(header), max_prompt_size // 2)
    return header + build_files_section(change_infos, max_file_size, files_budget)


def build_router_prompt_body(
    agents, agents_forced, agents_forced_reasons,
    change_infos, max_file_size, max_prompt_size,
):
    """Compose the review-router's prompt payload.

    The router used to read only headers of each reviewer prompt as a
    context-saving measure, then sample 1–2 files. That approach missed
    reviewers whose relevance was only visible inside diff bodies, so
    the router now receives the same change-file payload as a reviewer
    plus the forced list and the full perspective table (len(agents)
    rows — dynamic to allow project_config opt-outs and future
    additions like user_guide_sync) so it can decide on meaning, not
    filenames.
    """
    forced_block_lines = []
    if agents_forced:
        for name in agents_forced:
            info = REVIEWER_INSTRUCTIONS.get(name, {})
            title = info.get("ko_title", name)
            reasons = agents_forced_reasons.get(name) or []
            reason_text = " / ".join(reasons) if reasons else "(이유 미기재)"
            forced_block_lines.append(f"- **{name}** ({title}) — {reason_text}")
        forced_block = "\n".join(forced_block_lines)
    else:
        forced_block = "(이번 세션에서 router_safety 가 강제 포함한 reviewer 없음)"

    perspective_lines = []
    for name in agents:
        info = REVIEWER_INSTRUCTIONS.get(name, {})
        title = info.get("ko_title", name)
        perspective = info.get("perspective", "")
        scope_note = " (영역 무관 시 NONE 가능)" if info.get("scope_optional") else ""
        perspective_lines.append(f"- `{name}` — {title}{scope_note}: {perspective}")
    perspective_block = "\n".join(perspective_lines)

    # State the source/doc split as a fact instead of letting the router infer
    # it from filenames. On 2026-07-23 a 19-file changeset (15 docs, 4 code —
    # one a brand-new module) was routed "소스 코드 변경 없음(문서만 변경)" with
    # every reviewer deselected; the code was in the prompt, the router read the
    # majority. Same classifier as the forced rules, so the two cannot disagree.
    all_paths = [ci["file_path"] for ci in change_infos]
    src_paths = router_safety.source_files(all_paths)
    if src_paths:
        shown = "\n".join(f"  - `{p}`" for p in src_paths[:20])
        more = f"\n  - … 외 {len(src_paths) - 20}개" if len(src_paths) > 20 else ""
        composition_block = (
            f"변경 파일 {len(all_paths)}개 중 **소스 코드 파일 {len(src_paths)}개**:\n"
            f"{shown}{more}\n\n"
            "→ 이 변경은 **문서 전용이 아닙니다.** \"문서만 변경\" 을 사유로 "
            "reviewer 를 제외하지 마세요. 문서 파일 수가 많더라도 위 소스 파일의 "
            "실제 내용을 근거로 판단하세요.\n"
        )
    else:
        composition_block = (
            f"변경 파일 {len(all_paths)}개 중 소스 코드 파일 **0개** "
            "(문서·설정 전용 변경).\n"
        )

    candidate_count = len(agents)
    header = (
        "# Review Router Payload\n\n"
        "본 파일은 orchestrator 가 review-router 용으로 작성한 입력입니다. "
        f"아래 변경 코드를 보고, {candidate_count}명의 reviewer 후보 중 어떤 reviewer 를 실제로 실행할지 결정하세요.\n\n"
        "## 변경 구성 (orchestrator 가 확장자로 판정한 사실)\n\n"
        f"{composition_block}\n"
        "## 결정 규칙\n"
        "- 아래 **강제 포함** 목록은 router_safety 가 결정한 것으로, router 가 끄지 못합니다 "
        "— 목록의 reviewer 는 **반드시 항목을 포함해 `selected=true`** 로 반환하세요.\n"
        "- 그 외 reviewer 는 변경 코드의 실제 의미를 보고 판단. **확신 없으면 selected=true** (false-negative 가 false-positive 보다 위험).\n"
        "- **호출자가 코드로 검증합니다 (프롬프트 문구가 아니라 실제 강제):** 강제 포함 "
        "reviewer 를 하나라도 `selected=false` 로 반환하거나 결정에서 누락하면, 본 결정은 "
        f"신뢰할 수 없는 것으로 보아 통째로 폐기되고 전체 {candidate_count}명이 실행됩니다. "
        "즉 강제 목록을 어겨도 리뷰가 줄지 않고 오히려 전량 실행을 유발합니다.\n"
        "- 변경 코드 본문을 직접 분석할 수 있도록 변경 파일 컨텍스트가 함께 전달됩니다. 추가 탐색이 필요하면 Read/Grep/Glob/Bash 를 자유롭게 사용해도 됩니다.\n\n"
        "## 강제 포함 (router 가 끄지 못함)\n\n"
        f"{forced_block}\n\n"
        f"## {candidate_count} reviewer 후보와 관점\n\n"
        f"{perspective_block}\n\n"
        f"{LINE_ANCHOR_LEGEND}"
        "## 변경 파일 컨텍스트\n\n"
    )
    files_budget = 0
    if max_prompt_size > 0:
        files_budget = max(max_prompt_size - len(header), max_prompt_size // 2)
    return header + build_files_section(change_infos, max_file_size, files_budget)


# ---------------------------------------------------------------------------
# Git helpers (unchanged from previous version)
# ---------------------------------------------------------------------------


def _git(args, timeout=10):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def get_git_diff_files(staged_only=False):
    files = []
    try:
        r = _git(["git", "diff", "--cached", "--no-renames", "--name-only"])
        if r.returncode == 0:
            files.extend(r.stdout.strip().splitlines())
        if not staged_only:
            r = _git(["git", "diff", "--no-renames", "--name-only"])
            if r.returncode == 0:
                files.extend(r.stdout.strip().splitlines())
            r = _git(["git", "ls-files", "--others", "--exclude-standard"])
            if r.returncode == 0:
                files.extend(r.stdout.strip().splitlines())
    except Exception as e:
        debug_log(f"git diff failed: {e}")
    return list(dict.fromkeys(f for f in files if f))


def get_git_diff_content(file_path):
    chunks = []
    try:
        r = _git(["git", "diff", "--cached", "--", file_path])
        if r.returncode == 0 and r.stdout.strip():
            chunks.append(r.stdout)
        r = _git(["git", "diff", "--", file_path])
        if r.returncode == 0 and r.stdout.strip():
            chunks.append(r.stdout)
    except Exception as e:
        debug_log(f"git diff content failed for {file_path}: {e}")
    return "\n".join(chunks)


def get_git_commit_files(commit):
    try:
        r = _git(["git", "show", "--no-renames", "--name-only", "--pretty=format:", commit])
        if r.returncode == 0:
            return [f for f in r.stdout.strip().splitlines() if f]
    except Exception as e:
        debug_log(f"git show {commit} failed: {e}")
    return []


def get_git_commit_diff(commit, file_path=None):
    try:
        cmd = ["git", "show", commit]
        if file_path:
            cmd.extend(["--", file_path])
        r = _git(cmd, timeout=30)
        if r.returncode == 0:
            return r.stdout
    except Exception as e:
        debug_log(f"git show diff {commit} failed: {e}")
    return ""


def get_git_range_files(range_spec):
    try:
        r = _git(["git", "diff", "--no-renames", "--name-only", range_spec])
        if r.returncode == 0:
            return [f for f in r.stdout.strip().splitlines() if f]
    except Exception as e:
        debug_log(f"git diff range {range_spec} failed: {e}")
    return []


def get_git_range_diff(range_spec, file_path=None):
    try:
        cmd = ["git", "diff", range_spec]
        if file_path:
            cmd.extend(["--", file_path])
        r = _git(cmd, timeout=30)
        if r.returncode == 0:
            return r.stdout
    except Exception as e:
        debug_log(f"git diff range diff failed: {e}")
    return ""


def get_git_branch_diff_files(branch):
    try:
        r = _git(["git", "diff", "--no-renames", "--name-only", f"{branch}..."])
        if r.returncode == 0:
            return [f for f in r.stdout.strip().splitlines() if f]
    except Exception as e:
        debug_log(f"git diff branch failed: {e}")
    return []


def get_git_branch_diff(branch, file_path=None):
    try:
        cmd = ["git", "diff", f"{branch}..."]
        if file_path:
            cmd.extend(["--", file_path])
        r = _git(cmd, timeout=30)
        if r.returncode == 0:
            return r.stdout
    except Exception as e:
        debug_log(f"git diff branch diff failed: {e}")
    return ""


def get_file_at_commit(commit, file_path):
    try:
        r = _git(["git", "show", f"{commit}:{file_path}"], timeout=15)
        if r.returncode == 0:
            return r.stdout
    except Exception as e:
        debug_log(f"git show file {commit}:{file_path} failed: {e}")
    return ""


def get_directory_files(dir_path):
    out = []
    for root, _, names in os.walk(dir_path):
        if "/.git/" in root or root.endswith("/.git"):
            continue
        for n in names:
            out.append(os.path.join(root, n))
    return out


def build_cli_change_info(file_path, diff_content=None, file_content=None):
    _, ext = os.path.splitext(file_path)
    file_extension = ext.lstrip(".").lower() if ext else ""
    code = diff_content or ""
    full_file_content = file_content
    if full_file_content is None:
        full_file_content = ""
        try:
            if os.path.isfile(file_path):
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    full_file_content = f.read()
        except Exception as e:
            debug_log(f"Failed to read {file_path}: {e}")
    if not code and full_file_content:
        code = get_git_diff_content(file_path)
    return {
        "file_path": file_path,
        "change_type": "Review",
        "file_extension": file_extension,
        "code": code,
        "old_code": "",
        "full_file_content": full_file_content,
    }


# ---------------------------------------------------------------------------
# Session preparation — write prompts, init state, return path
# ---------------------------------------------------------------------------


def prepare_session(change_infos, config):
    """Create the session directory and write everything the main session needs.

    Returns absolute session_dir path.
    """
    session_dir = session.create_session_dir(config["output_dir"])
    prompts_dir = os.path.join(session_dir, "_prompts")
    os.makedirs(prompts_dir, exist_ok=True)

    invocations = []
    for agent in config["agents"]:
        body = build_agent_prompt_body(
            agent, change_infos,
            config["max_file_size"], config["max_prompt_size"],
        )
        prompt_path = os.path.join(prompts_dir, f"{agent}.md")
        output_path = os.path.join(session_dir, f"{agent}.md")
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(body)
        invocations.append({
            "name": agent,
            "subagent_type": _subagent_type(agent),
            "prompt_file": os.path.abspath(prompt_path),
            "output_file": os.path.abspath(output_path),
        })

    # Router safety: compute agents the router cannot drop.
    forced_agents, forced_reasons = compute_forced_agents(
        [ci["file_path"] for ci in change_infos],
        config["agents"],
    )

    # Routing decision: pending → router will run; skipped → bypass router.
    # Router is bypassed when:
    #   - REVIEW_AGENTS is explicitly set (user intent overrides router)
    #   - --route=all (escape hatch for full audit)
    if config["route_mode"] == "all" or config["agents_explicit"]:
        routing_status = "skipped"
        skip_reason = (
            "REVIEW_AGENTS explicitly set"
            if config["agents_explicit"] else "--route=all"
        )
    else:
        routing_status = "pending"
        skip_reason = None

    router_output_file = os.path.abspath(
        os.path.join(session_dir, "_routing_decision.json")
    )

    # Router-specific prompt body — same context budget as a reviewer so the
    # router can decide on meaning instead of filenames. Only written when
    # the router will actually be invoked (routing_status == "pending").
    router_prompt_file = None
    if routing_status == "pending":
        router_body = build_router_prompt_body(
            config["agents"], forced_agents, forced_reasons,
            change_infos, config["max_file_size"], config["max_prompt_size"],
        )
        router_prompt_path = os.path.join(prompts_dir, "_router.md")
        with open(router_prompt_path, "w", encoding="utf-8") as f:
            f.write(router_body)
        router_prompt_file = os.path.abspath(router_prompt_path)

    retry_state = {
        "session_dir": os.path.abspath(session_dir),
        "summary_subagent_type": "code-review-summary",
        "summary_output_file": os.path.abspath(os.path.join(session_dir, "SUMMARY.md")),
        "router_subagent_type": "review-router",
        "router_prompt_file": router_prompt_file,
        "router_output_file": router_output_file,
        "routing_status": routing_status,
        "routing_skip_reason": skip_reason,
        "agents_forced": forced_agents,
        "agents_forced_reasons": forced_reasons,
        "agents_skipped": [],
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
        "files": [
            {
                "file_path": ci["file_path"],
                "change_type": ci["change_type"],
                "file_extension": ci["file_extension"],
            } for ci in change_infos
        ],
        "agents": config["agents"],
        "route_mode": config["route_mode"],
        "agents_explicit": config["agents_explicit"],
        "agents_forced": forced_agents,
    }
    session.save_metadata(session_dir, meta)

    debug_log(
        f"Prepared session: {session_dir} ({len(change_infos)} files, "
        f"{len(invocations)} agents, route={config['route_mode']}, "
        f"forced={forced_agents}, routing_status={routing_status})"
    )
    return os.path.abspath(session_dir)


# ---------------------------------------------------------------------------
# File collection from CLI args
# ---------------------------------------------------------------------------


def collect_change_infos(args, config):
    """Resolve args into a flat list of change_info dicts. May return empty."""
    files = []
    diff_getter = None
    content_getter = None

    if args.commit:
        commit = args.commit
        files = get_git_commit_files(commit)
        diff_getter = lambda fp, c=commit: get_git_commit_diff(c, fp)
        content_getter = lambda fp, c=commit: get_file_at_commit(c, fp)
        print(f"Preparing review for commit: {commit}", file=sys.stderr)

    elif args.range:
        range_spec = args.range
        files = get_git_range_files(range_spec)
        diff_getter = lambda fp, r=range_spec: get_git_range_diff(r, fp)
        print(f"Preparing review for range: {range_spec}", file=sys.stderr)

    elif args.branch:
        branch = args.branch
        files = get_git_branch_diff_files(branch)
        diff_getter = lambda fp, b=branch: get_git_branch_diff(b, fp)
        print(f"Preparing review against branch: {branch}", file=sys.stderr)

    elif args.files:
        for f in args.files:
            if os.path.isdir(f):
                files.extend(get_directory_files(f))
            else:
                files.append(f)

    else:
        files = get_git_diff_files(staged_only=args.staged)
        if args.staged:
            print("Preparing review for staged changes", file=sys.stderr)
        else:
            print("Preparing review for git diff (staged + unstaged + untracked)", file=sys.stderr)

    filtered = []
    for f in files:
        _, ext = os.path.splitext(f)
        ext_clean = ext.lstrip(".").lower()
        if ext_clean and ext_clean in config["skip_extensions"]:
            debug_log(f"Skipping (ext): {f}")
            continue
        if is_binary_ext(f):
            debug_log(f"Skipping (binary ext): {f}")
            continue
        if not args.commit and not args.range and not args.branch:
            if not os.path.isfile(f):
                debug_log(f"File missing: {f}")
                continue
            if is_binary_file(f):
                debug_log(f"Skipping (binary content): {f}")
                continue
        filtered.append(f)

    change_infos = []
    for fp in filtered:
        diff = diff_getter(fp) if diff_getter else None
        content = content_getter(fp) if content_getter else None
        change_infos.append(build_cli_change_info(fp, diff_content=diff, file_content=content))
    return change_infos


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Code Review Agents Orchestrator (prepare-only).",
    )
    parser.add_argument("--prepare", action="store_true",
                        help="Prepare a review session (default behaviour).")
    parser.add_argument("--cli", action="store_true",
                        help="Deprecated alias for --prepare. Model calls are now performed "
                             "by the main Claude session via the Agent tool.")
    parser.add_argument("--resume", type=str, metavar="SESSION_DIR",
                        help="Resume an existing session: skip prepare, validate the "
                             "_retry_state.json, echo the absolute session_dir on stdout. "
                             "Used by /loop wake-ups to re-enter the same session.")
    parser.add_argument("--summary-state", type=str, metavar="SESSION_DIR",
                        help="Echo a one-line summary of _retry_state.json to stdout: "
                             "pending=N success=N fatal=N routing=<status> last_reset=<sec|null>. "
                             "Main uses this for branch decisions without loading full JSON.")
    parser.add_argument("--update", type=str, metavar="SESSION_DIR",
                        help="Update a single agent's status in _retry_state.json. "
                             "Requires --agent and --status. Optional --reset-hint <sec>.")
    parser.add_argument("--agent", type=str, metavar="NAME",
                        help="Agent name for --update.")
    parser.add_argument("--status", type=str, metavar="STATUS",
                        choices=["success", "rate_limit", "network", "fatal"],
                        help="Status value for --update.")
    parser.add_argument("--reset-hint", type=int, metavar="SEC",
                        help="reset_hint_sec for --update (used on rate_limit).")
    parser.add_argument("--apply-routing", type=str, metavar="SESSION_DIR",
                        help="Apply review-router decision from _routing_decision.json to "
                             "_retry_state.json. Moves un-selected agents from pending to "
                             "skipped. Echoes 'applied=N skipped=M' to stdout. "
                             "If --fallback, ignore router decision and mark routing skipped.")
    parser.add_argument("--sync-from-disk", type=str, metavar="SESSION_DIR",
                        help="Reconcile _retry_state.json with the reviewer files actually "
                             "on disk (disk wins). Use after fanning reviewers out with the "
                             "Agent tool directly, which bypasses --update and leaves the "
                             "state frozen at its prepare-time snapshot.")
    parser.add_argument("--verify-coverage", type=str, metavar="SESSION_DIR",
                        help="Exit 1 if any agents_forced (router_safety whitelist) reviewer "
                             "left no report on disk. Call before finalising SUMMARY.")
    parser.add_argument("--fallback", action="store_true",
                        help="With --apply-routing: treat as router failure (fallback to "
                             "all reviewers, routing_status=skipped + reason).")
    parser.add_argument("--commit", type=str, metavar="HASH")
    parser.add_argument("--range", type=str, metavar="FROM..TO")
    parser.add_argument("--branch", type=str, metavar="BRANCH")
    parser.add_argument("--staged", action="store_true")
    parser.add_argument(
        "--route", type=str, choices=["auto", "all"], default="auto",
        help="auto (default): review-router selects a subset of reviewers. "
             "all: bypass router and invoke every reviewer (legacy behavior). "
             "If REVIEW_AGENTS env var is set, the router is bypassed "
             "regardless of this flag (explicit user intent wins).",
    )
    parser.add_argument("files", nargs="*")

    args, _ = parser.parse_known_args()

    if args.cli:
        print(
            "[warning] --cli is deprecated. Orchestrator no longer invokes the model; "
            "see .claude/skills/code-review-agents/SKILL.md for the new procedure.",
            file=sys.stderr,
        )

    # Resume mode: caller already has a session_dir from an earlier --prepare run
    # (typically a /loop wake-up). We just validate and echo the path back so the
    # main session has a single uniform entry-point regardless of first/N-th cycle.
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
        # reviewers whose reports are already on disk.
        _, changed = _reconcile_state_with_disk(sd)
        if changed:
            debug_log(f"Resume: reconciled _retry_state.json with disk under {sd}")
        debug_log(f"Resuming session: {sd}")
        print(sd)
        sys.exit(0)

    # Summary-state mode: echo a single line so main does not need to Read
    # _retry_state.json into its own context.
    if args.summary_state:
        _emit_summary_state(args.summary_state)
        sys.exit(0)

    # Update mode: mutate _retry_state.json on behalf of main (move one agent
    # between pending/success/fatal buckets, optionally record reset_hint).
    if args.update:
        if not args.agent or not args.status:
            print("Error: --update requires --agent NAME and --status STATUS",
                  file=sys.stderr)
            sys.exit(2)
        _apply_status_update(args.update, args.agent, args.status, args.reset_hint)
        sys.exit(0)

    # Apply-routing mode: consume _routing_decision.json (or fallback) and
    # update _retry_state.json accordingly. Echoes one line: applied=N skipped=M.
    if args.apply_routing:
        _apply_routing(args.apply_routing, fallback=args.fallback)
        sys.exit(0)

    # Sync mode: disk → state, for sessions fanned out with the Agent tool directly.
    if args.sync_from_disk:
        _sync_from_disk(args.sync_from_disk)
        sys.exit(0)

    # Coverage gate: forced (router_safety) reviewers must have left a report.
    if args.verify_coverage:
        _verify_coverage(args.verify_coverage)
        sys.exit(0)

    config = load_config(route_mode=args.route)
    change_infos = collect_change_infos(args, config)
    if not change_infos:
        print("No reviewable files found.", file=sys.stderr)
        sys.exit(0)

    batch_size = config["batch_size"]
    batches = [
        change_infos[i:i + batch_size]
        for i in range(0, len(change_infos), batch_size)
    ]
    for batch_idx, batch in enumerate(batches, 1):
        print(f"--- Batch {batch_idx}/{len(batches)} ({len(batch)} files) ---", file=sys.stderr)
        for ci in batch:
            print(f"  - {ci['file_path']}", file=sys.stderr)
        session_dir = prepare_session(batch, config)
        # One session_dir per stdout line. Main parses these.
        print(session_dir)


if __name__ == "__main__":
    main()
