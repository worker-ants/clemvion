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
sys.path.insert(0, _SKILL_DIR)
sys.path.insert(0, _SKILLS_DIR)

from lib import session  # noqa: E402
from lib.role_instructions import REVIEWER_INSTRUCTIONS  # noqa: E402
from lib.router_safety import compute_forced_agents  # noqa: E402
from _lib import project_config  # noqa: E402

DEBUG_LOG_FILE = "/tmp/code-review-agents-log.txt"
debug_log = session.make_debug_logger(DEBUG_LOG_FILE)

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
        "max_file_size": int(os.environ.get("REVIEW_MAX_FILE_SIZE", "51200")),
        "max_prompt_size": int(os.environ.get("REVIEW_MAX_PROMPT_SIZE", "131072")),
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


def _emit_summary_state(session_dir):
    """One-line summary of _retry_state.json — kept terse for main ctx."""
    _, state = _load_state(os.path.abspath(session_dir))
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
    selected = []
    skipped = []
    for d in decision.get("decisions", []):
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


def build_files_section(change_infos, max_file_size, max_total_size=0):
    """Compose the changed-files context, respecting per-file and total budgets."""
    separator = "\n---\n\n"

    file_parts = []
    for i, ci in enumerate(change_infos, 1):
        header = f"### 파일 {i}: {ci['file_path']}\n"
        header += f"- 변경 유형: {ci['change_type']}\n"
        header += f"- 언어: {ci['file_extension']}\n"

        diff_section = ""
        if ci.get("code"):
            diff_section += f"\n#### 변경된 코드\n```\n{ci['code']}\n```\n"
        if ci.get("old_code"):
            diff_section += f"\n#### 이전 코드\n```\n{ci['old_code']}\n```\n"

        full_content = ci.get("full_file_content", "")
        if len(full_content) > max_file_size:
            full_content = (
                full_content[:max_file_size]
                + "\n\n... (truncated due to size limit) ..."
            )

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
                section += f"\n#### 전체 파일 컨텍스트\n```\n{fp['full_content']}\n```\n"
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
                fp["diff"] = fp["diff"][:new_len] + "\n\n... (truncated due to prompt size limit) ...\n"
            else:
                fp["diff"] = "\n\n... (diff omitted due to prompt size limit) ...\n"
            overflow -= cut
        sections = [fp["header"] + fp["diff"] for fp in file_parts]
        return separator.join(sections)

    remaining_budget = max_total_size - base_size
    content_wrapper_overhead = len("\n#### 전체 파일 컨텍스트\n```\n\n```\n")

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
                include_content[i] = (
                    file_parts[i]["full_content"][:available]
                    + "\n\n... (truncated due to prompt size limit) ..."
                )
                remaining_budget = 0
            break

    sections = []
    for i, fp in enumerate(file_parts):
        section = fp["header"] + fp["diff"]
        if i in include_content:
            section += f"\n#### 전체 파일 컨텍스트\n```\n{include_content[i]}\n```\n"
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

    candidate_count = len(agents)
    header = (
        "# Review Router Payload\n\n"
        "본 파일은 orchestrator 가 review-router 용으로 작성한 입력입니다. "
        f"아래 변경 코드를 보고, {candidate_count}명의 reviewer 후보 중 어떤 reviewer 를 실제로 실행할지 결정하세요.\n\n"
        "## 결정 규칙\n"
        "- 아래 **강제 포함** 목록은 router_safety 가 결정한 것으로, router 가 끄지 못합니다 (selected=true 고정).\n"
        "- 그 외 reviewer 는 변경 코드의 실제 의미를 보고 판단. **확신 없으면 selected=true** (false-negative 가 false-positive 보다 위험).\n"
        "- selected 수가 0 또는 1 이면 호출자가 본 결정을 폐기하고 전체 reviewer fallback 합니다 (역시 false-negative 방어).\n"
        "- 변경 코드 본문을 직접 분석할 수 있도록 변경 파일 컨텍스트가 함께 전달됩니다. 추가 탐색이 필요하면 Read/Grep/Glob/Bash 를 자유롭게 사용해도 됩니다.\n\n"
        "## 강제 포함 (router 가 끄지 못함)\n\n"
        f"{forced_block}\n\n"
        f"## {candidate_count} reviewer 후보와 관점\n\n"
        f"{perspective_block}\n\n"
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
        r = _git(["git", "diff", "--cached", "--name-only"])
        if r.returncode == 0:
            files.extend(r.stdout.strip().splitlines())
        if not staged_only:
            r = _git(["git", "diff", "--name-only"])
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
        r = _git(["git", "show", "--name-only", "--pretty=format:", commit])
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
        r = _git(["git", "diff", "--name-only", range_spec])
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
        r = _git(["git", "diff", "--name-only", f"{branch}..."])
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
