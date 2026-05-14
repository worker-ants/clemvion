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

# Make sibling lib package importable when invoked as a standalone script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib import session  # noqa: E402

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
ALL_AGENTS = [
    "security", "performance", "architecture", "requirement", "scope",
    "side_effect", "maintainability", "testing", "documentation",
    "dependency", "database", "concurrency", "api_contract",
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


def load_config():
    agents_env = os.environ.get("REVIEW_AGENTS", "").strip()
    if agents_env:
        agents = [a.strip() for a in agents_env.split(",") if a.strip()]
    else:
        agents = list(ALL_AGENTS)

    skip_ext_env = os.environ.get("REVIEW_SKIP_EXTENSIONS", "").strip()
    if skip_ext_env:
        skip_extensions = {e.strip().lstrip(".") for e in skip_ext_env.split(",") if e.strip()}
    else:
        skip_extensions = set()

    return {
        "output_dir": os.environ.get("REVIEW_OUTPUT_DIR", "./review/code"),
        "agents": agents,
        "max_file_size": int(os.environ.get("REVIEW_MAX_FILE_SIZE", "51200")),
        "max_prompt_size": int(os.environ.get("REVIEW_MAX_PROMPT_SIZE", "131072")),
        "batch_size": int(os.environ.get("REVIEW_BATCH_SIZE", "50")),
        "skip_extensions": skip_extensions,
    }


# ---------------------------------------------------------------------------
# Prompt body builder (no system prompt — that lives in the sub-agent
# definition under .claude/agents/<role>-reviewer.md).
# ---------------------------------------------------------------------------


PROMPT_HEADER = (
    "# Review Payload\n\n"
    "본 파일은 orchestrator 가 작성한 리뷰 대상 정보입니다.\n"
    "sub-agent 의 system prompt 에 정의된 리뷰 관점·등급 기준·출력 형식에 따라\n"
    "아래 변경 내용을 분석하고, 호출자가 `output_file` 인자로 지정한 경로에\n"
    "review.md 를 작성하세요. 호출자에게 반환하는 값은 STATUS 한 줄입니다.\n\n"
    "## 리뷰 대상 파일\n\n"
)


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


def build_agent_prompt_body(change_infos, max_file_size, max_prompt_size):
    files_budget = 0
    if max_prompt_size > 0:
        files_budget = max(max_prompt_size - len(PROMPT_HEADER), max_prompt_size // 2)
    return PROMPT_HEADER + build_files_section(change_infos, max_file_size, files_budget)


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

    body = build_agent_prompt_body(
        change_infos, config["max_file_size"], config["max_prompt_size"],
    )

    invocations = []
    for agent in config["agents"]:
        prompt_path = os.path.join(prompts_dir, f"{agent}.md")
        output_path = os.path.join(session_dir, agent, "review.md")
        os.makedirs(os.path.join(session_dir, agent), exist_ok=True)
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(body)
        invocations.append({
            "name": agent,
            "subagent_type": _subagent_type(agent),
            "prompt_file": os.path.abspath(prompt_path),
            "output_file": os.path.abspath(output_path),
        })

    retry_state = {
        "session_dir": os.path.abspath(session_dir),
        "summary_subagent_type": "code-review-summary",
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
        "files": [
            {
                "file_path": ci["file_path"],
                "change_type": ci["change_type"],
                "file_extension": ci["file_extension"],
            } for ci in change_infos
        ],
        "agents": config["agents"],
    }
    session.save_metadata(session_dir, meta)

    debug_log(
        f"Prepared session: {session_dir} ({len(change_infos)} files, "
        f"{len(invocations)} agents)"
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
    parser.add_argument("--commit", type=str, metavar="HASH")
    parser.add_argument("--range", type=str, metavar="FROM..TO")
    parser.add_argument("--branch", type=str, metavar="BRANCH")
    parser.add_argument("--staged", action="store_true")
    parser.add_argument("files", nargs="*")

    args, _ = parser.parse_known_args()

    if args.cli:
        print(
            "[warning] --cli is deprecated. Orchestrator no longer invokes the model; "
            "see .claude/skills/code-review-agents/SKILL.md for the new procedure.",
            file=sys.stderr,
        )

    config = load_config()
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
