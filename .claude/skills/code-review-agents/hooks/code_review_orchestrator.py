#!/usr/bin/env python3
"""
Code Review Agents Orchestrator for Claude Code.

Runs 13 role-based AI reviewer agents in parallel after Write/Edit tool executions
(hook mode) or against a git diff / commit / range / branch / file set (CLI mode).
The actual parallel-execution machinery lives in `lib/` so other skills
(e.g. consistency-checker) can reuse it; this file holds only the code-review-specific
input collection (git diff / file content) and prompt assembly.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime

# Make sibling lib package importable when invoked as a standalone script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib import agent_runner, session, summary  # noqa: E402

DEBUG_LOG_FILE = "/tmp/code-review-agents-log.txt"
debug_log = session.make_debug_logger(DEBUG_LOG_FILE)

# Binary file extensions to skip by default
BINARY_EXTENSIONS = {
    # Images
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp", "tiff", "tif",
    "psd", "ai", "eps", "raw", "cr2", "nef", "heic", "heif", "avif",
    # Compiled / Archives
    "jar", "war", "ear", "class", "pyc", "pyo", "o", "obj", "so", "dylib",
    "dll", "exe", "bin", "a", "lib", "ko",
    "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "zst",
    # Fonts
    "woff", "woff2", "ttf", "otf", "eot",
    # Media
    "mp3", "mp4", "avi", "mov", "wmv", "flv", "mkv", "webm",
    "wav", "flac", "aac", "ogg", "m4a",
    # Documents (binary)
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    # Data / DB
    "sqlite", "db", "sqlite3",
    # Other
    "wasm", "map",
}

ALL_AGENTS = [
    "security",
    "performance",
    "architecture",
    "requirement",
    "scope",
    "side_effect",
    "maintainability",
    "testing",
    "documentation",
    "dependency",
    "database",
    "concurrency",
    "api_contract",
]


def is_binary_file(file_path):
    """Check if a file is binary by reading its first 8KB for null bytes."""
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(8192)
        return b"\x00" in chunk
    except Exception:
        return False


def is_binary_ext(file_path):
    """Check if a file has a known binary extension."""
    _, ext = os.path.splitext(file_path)
    return ext.lstrip(".").lower() in BINARY_EXTENSIONS


def should_skip_binary(file_path):
    """Return True if the file should be skipped as a binary file."""
    if is_binary_ext(file_path):
        return True
    if os.path.isfile(file_path) and is_binary_file(file_path):
        return True
    return False


def load_config():
    """Load configuration from environment variables."""
    agents_env = os.environ.get("REVIEW_AGENTS", "")
    if agents_env.strip():
        agents = [a.strip() for a in agents_env.split(",") if a.strip()]
    else:
        agents = list(ALL_AGENTS)

    skip_ext_env = os.environ.get("REVIEW_SKIP_EXTENSIONS", "")
    if skip_ext_env.strip():
        skip_extensions = {e.strip().lstrip(".") for e in skip_ext_env.split(",") if e.strip()}
    else:
        skip_extensions = set()

    return {
        "model": os.environ.get("REVIEW_MODEL", "sonnet"),
        "timeout": int(os.environ.get("REVIEW_TIMEOUT", "3600")),
        "output_dir": os.environ.get("REVIEW_OUTPUT_DIR", "./review"),
        "agents": agents,
        "max_file_size": int(os.environ.get("REVIEW_MAX_FILE_SIZE", "51200")),
        "max_prompt_size": int(os.environ.get("REVIEW_MAX_PROMPT_SIZE", "131072")),
        "max_summary_size": int(os.environ.get("REVIEW_MAX_SUMMARY_SIZE", "131072")),
        "batch_size": int(os.environ.get("REVIEW_BATCH_SIZE", "50")),
        "skip_extensions": skip_extensions,
    }


def extract_change_info(input_data):
    """Extract file path, change code, and full file content from tool input."""
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    file_path = tool_input.get("file_path", "")
    if not file_path:
        return None

    change_type = tool_name  # "Write" or "Edit"

    # Extract the changed code
    if tool_name == "Write":
        code = tool_input.get("content", "")
        old_code = ""
    elif tool_name == "Edit":
        code = tool_input.get("new_string", "")
        old_code = tool_input.get("old_string", "")
    else:
        return None

    # Get file extension
    _, ext = os.path.splitext(file_path)
    file_extension = ext.lstrip(".").lower() if ext else ""

    # Read full file content from disk
    full_file_content = ""
    try:
        if os.path.isfile(file_path):
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                full_file_content = f.read()
    except Exception as e:
        debug_log(f"Failed to read full file {file_path}: {e}")

    return {
        "file_path": file_path,
        "change_type": change_type,
        "file_extension": file_extension,
        "code": code,
        "old_code": old_code,
        "full_file_content": full_file_content,
    }


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------


def build_files_section(change_infos, max_file_size, max_total_size=0):
    """Build the {files_section} content for agent prompts from multiple change_infos.

    Truncation priority (preserves most important content):
    1. File headers (path, type, language) — never truncated
    2. Changed code / diff (code, old_code) — truncated only as last resort
    3. Full file context (full_file_content) — truncated first, smallest files preserved first

    Args:
        change_infos: List of change_info dicts.
        max_file_size: Max size for individual file content.
        max_total_size: Max total size for the entire section. 0 = unlimited.
    """
    separator = "\n---\n\n"

    # Phase 1: Build headers and diffs for each file (always included)
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

    # If no budget limit, build sections with all content
    if max_total_size <= 0:
        sections = []
        for fp in file_parts:
            section = fp["header"] + fp["diff"]
            if fp["full_content"]:
                section += f"\n#### 전체 파일 컨텍스트\n```\n{fp['full_content']}\n```\n"
            sections.append(section)
        result = separator.join(sections)
        debug_log(f"build_files_section: {len(file_parts)} files, total_size={len(result)}, no budget limit")
        return result

    # Phase 2: Calculate base size (headers + diffs only)
    base_sections = [fp["header"] + fp["diff"] for fp in file_parts]
    base_size = len(separator.join(base_sections))

    if base_size >= max_total_size:
        # Even headers+diffs exceed budget — first truncate large diffs
        debug_log(f"build_files_section: base_size={base_size} exceeds budget={max_total_size}, truncating diffs")
        # Sort by diff size descending so we truncate largest first
        indexed = [(i, fp) for i, fp in enumerate(file_parts)]
        indexed.sort(key=lambda x: len(x[1]["diff"]), reverse=True)

        # Calculate how much we need to cut
        overflow = base_size - max_total_size
        for idx, fp in indexed:
            if overflow <= 0:
                break
            diff_len = len(fp["diff"])
            if diff_len == 0:
                continue
            # Calculate how much to keep for this diff
            cut = min(overflow, diff_len)
            new_len = diff_len - cut
            if new_len > 0:
                fp["diff"] = fp["diff"][:new_len] + "\n\n... (truncated due to prompt size limit) ...\n"
            else:
                fp["diff"] = "\n\n... (diff omitted due to prompt size limit) ...\n"
            overflow -= cut

        sections = [fp["header"] + fp["diff"] for fp in file_parts]
        result = separator.join(sections)
        debug_log(f"build_files_section: {len(file_parts)} files, total_size={len(result)}, budget={max_total_size} (diffs truncated)")
        return result

    # Phase 3: Distribute remaining budget to full_file_content (smallest files first)
    remaining_budget = max_total_size - base_size
    # Overhead per file for the "#### 전체 파일 컨텍스트" wrapper
    content_wrapper_overhead = len("\n#### 전체 파일 컨텍스트\n```\n\n```\n")

    # Sort indices by full_content_size ascending (preserve small files first)
    content_indices = [
        i for i, fp in enumerate(file_parts) if fp["full_content"]
    ]
    content_indices.sort(key=lambda i: file_parts[i]["full_content_size"])

    include_content = {}  # index -> content string to include
    for i in content_indices:
        needed = file_parts[i]["full_content_size"] + content_wrapper_overhead
        if needed <= remaining_budget:
            include_content[i] = file_parts[i]["full_content"]
            remaining_budget -= needed
        else:
            # Partial inclusion if there's enough space for at least some content
            available = remaining_budget - content_wrapper_overhead
            if available > 200:  # only include if meaningful amount remains
                include_content[i] = (
                    file_parts[i]["full_content"][:available]
                    + "\n\n... (truncated due to prompt size limit) ..."
                )
                remaining_budget = 0
            break

    # Phase 4: Assemble final sections
    sections = []
    for i, fp in enumerate(file_parts):
        section = fp["header"] + fp["diff"]
        if i in include_content:
            section += f"\n#### 전체 파일 컨텍스트\n```\n{include_content[i]}\n```\n"
        sections.append(section)

    result = separator.join(sections)
    omitted = len(content_indices) - len(include_content)
    debug_log(
        f"build_files_section: {len(file_parts)} files, total_size={len(result)}, "
        f"budget={max_total_size}, full_content included={len(include_content)}, omitted={omitted}"
    )
    return result


def build_agent_prompt(agent_name, change_infos, prompt_dir, max_file_size, max_prompt_size=0):
    """Build prompt for an agent by reading template and substituting {files_section}."""
    template_path = os.path.join(prompt_dir, "agents", f"{agent_name}.md")

    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template = f.read()
    except Exception as e:
        debug_log(f"Failed to read template {template_path}: {e}")
        return None

    # Calculate files_section budget: total budget minus template size
    files_budget = 0
    if max_prompt_size > 0:
        template_size = len(template)
        files_budget = max(max_prompt_size - template_size, max_prompt_size // 2)

    files_section = build_files_section(change_infos, max_file_size, files_budget)
    prompt = template.replace("{files_section}", files_section)

    debug_log(f"build_agent_prompt({agent_name}): prompt_size={len(prompt)}, budget={max_prompt_size}")
    return prompt


# ---------------------------------------------------------------------------
# Summary preparation (code-review specific)
# ---------------------------------------------------------------------------


def build_summary_substitutions(results, change_infos, max_summary_size, template_size):
    """Build {files_info} and {review_results} for the summary template, respecting size budget."""
    files_info = ""
    for i, ci in enumerate(change_infos, 1):
        files_info += f"- 파일 {i}: {ci['file_path']} ({ci['change_type']}, {ci['file_extension']})\n"

    reviews_text = ""
    for r in results:
        reviews_text += f"\n## {r['agent']} Review (status: {r['status']}, {r['elapsed']}s)\n\n"
        reviews_text += r.get("output", "No output") + "\n"

    if max_summary_size > 0:
        base_size = template_size + len(files_info)
        reviews_budget = max(max_summary_size - base_size, max_summary_size // 2)

        if len(reviews_text) > reviews_budget:
            debug_log(
                f"build_summary_substitutions: reviews_text={len(reviews_text)} exceeds budget={reviews_budget}, truncating"
            )
            per_agent_budget = reviews_budget // max(len(results), 1)
            truncated_parts = []
            for r in results:
                header = f"\n## {r['agent']} Review (status: {r['status']}, {r['elapsed']}s)\n\n"
                output = r.get("output", "No output")
                content_budget = per_agent_budget - len(header)
                if content_budget > 0 and len(output) > content_budget:
                    output = output[:content_budget] + "\n\n... (truncated due to summary size limit) ..."
                truncated_parts.append(header + output + "\n")
            reviews_text = "".join(truncated_parts)

    return {"files_info": files_info, "review_results": reviews_text}


# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------


def get_git_diff_files(staged_only=False):
    """Get list of changed files from git diff."""
    files = []
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            files.extend(result.stdout.strip().splitlines())

        if not staged_only:
            result = subprocess.run(
                ["git", "diff", "--name-only"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0:
                files.extend(result.stdout.strip().splitlines())

            result = subprocess.run(
                ["git", "ls-files", "--others", "--exclude-standard"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0:
                files.extend(result.stdout.strip().splitlines())

    except Exception as e:
        debug_log(f"git diff failed: {e}")

    return list(dict.fromkeys(f for f in files if f))


def get_git_diff_content(file_path):
    """Get git diff content for a specific file (unstaged + staged)."""
    try:
        result = subprocess.run(
            ["git", "diff", "--no-color", file_path],
            capture_output=True, text=True, timeout=10,
        )
        diff = result.stdout.strip()
        if diff:
            return diff

        result = subprocess.run(
            ["git", "diff", "--cached", "--no-color", file_path],
            capture_output=True, text=True, timeout=10,
        )
        return result.stdout.strip()
    except Exception:
        return ""


def get_git_commit_files(commit_hash):
    """Get list of files changed in a specific commit."""
    try:
        result = subprocess.run(
            ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", commit_hash],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return [f for f in result.stdout.strip().splitlines() if f]
    except Exception as e:
        debug_log(f"git diff-tree failed: {e}")
    return []


def get_git_commit_diff(commit_hash, file_path=None):
    """Get diff content for a specific commit."""
    cmd = ["git", "diff", "--no-color", f"{commit_hash}~1", commit_hash]
    if file_path:
        cmd += ["--", file_path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception as e:
        debug_log(f"git commit diff failed: {e}")
    return ""


def get_git_range_files(range_spec):
    """Get files changed in a git range (e.g., abc123..def456)."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", range_spec],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return [f for f in result.stdout.strip().splitlines() if f]
    except Exception as e:
        debug_log(f"git diff range failed: {e}")
    return []


def get_git_range_diff(range_spec, file_path=None):
    """Get diff content for a git range."""
    cmd = ["git", "diff", "--no-color", range_spec]
    if file_path:
        cmd += ["--", file_path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception as e:
        debug_log(f"git range diff failed: {e}")
    return ""


def get_git_branch_diff_files(branch):
    """Get files changed compared to a branch (merge-base)."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", f"{branch}...HEAD"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return [f for f in result.stdout.strip().splitlines() if f]
    except Exception as e:
        debug_log(f"git diff branch failed: {e}")
    return []


def get_git_branch_diff(branch, file_path=None):
    """Get diff content compared to a branch (merge-base)."""
    cmd = ["git", "diff", "--no-color", f"{branch}...HEAD"]
    if file_path:
        cmd += ["--", file_path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception as e:
        debug_log(f"git branch diff failed: {e}")
    return ""


def get_file_at_commit(commit_hash, file_path):
    """Get file content at a specific commit."""
    try:
        result = subprocess.run(
            ["git", "show", f"{commit_hash}:{file_path}"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return result.stdout
    except Exception as e:
        debug_log(f"git show file at commit failed: {e}")
    return ""


def get_directory_files(dir_path):
    """Get all reviewable files under a directory."""
    dir_path = os.path.abspath(dir_path)

    try:
        result = subprocess.run(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
            capture_output=True, text=True, timeout=30, cwd=dir_path,
        )
        if result.returncode == 0 and result.stdout.strip():
            files = []
            for line in result.stdout.strip().split("\n"):
                if not line:
                    continue
                full_path = os.path.join(dir_path, line)
                if not os.path.isfile(full_path):
                    continue
                if should_skip_binary(full_path):
                    continue
                files.append(full_path)
            debug_log(f"get_directory_files: git ls-files returned {len(files)} files for {dir_path}")
            return files
    except Exception as e:
        debug_log(f"git ls-files failed, falling back to os.walk: {e}")

    files = []
    for root, dirs, filenames in os.walk(dir_path):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for fname in filenames:
            if fname.startswith("."):
                continue
            full_path = os.path.join(root, fname)
            if should_skip_binary(full_path):
                continue
            files.append(full_path)
    return files


# ---------------------------------------------------------------------------
# CLI change info builder
# ---------------------------------------------------------------------------


def build_cli_change_info(file_path, diff_content=None, file_content=None):
    """Build change_info dict for CLI mode from a file path."""
    file_path = os.path.abspath(file_path)
    _, ext = os.path.splitext(file_path)
    file_extension = ext.lstrip(".").lower() if ext else ""

    if file_content is not None:
        full_file_content = file_content
    else:
        full_file_content = ""
        try:
            if os.path.isfile(file_path):
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    full_file_content = f.read()
        except Exception as e:
            debug_log(f"Failed to read file {file_path}: {e}")

    if diff_content is None:
        diff_content = get_git_diff_content(file_path)
    code = diff_content if diff_content else full_file_content

    return {
        "file_path": file_path,
        "change_type": "Review",
        "file_extension": file_extension,
        "code": code,
        "old_code": "",
        "full_file_content": full_file_content,
    }


# ---------------------------------------------------------------------------
# Review session runner
# ---------------------------------------------------------------------------


def run_review_session(change_infos, config):
    """Run a review session for all files and return the session directory."""
    session_dir = session.create_session_dir(config["output_dir"])
    prompt_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prompts")

    file_paths = [ci["file_path"] for ci in change_infos]
    debug_log(f"Starting code review session: {session_dir}")
    debug_log(f"Files ({len(change_infos)}): {', '.join(file_paths)}")
    debug_log(f"Agents: {', '.join(config['agents'])}")

    total_start = time.time()

    def prompt_for(agent_name):
        return build_agent_prompt(
            agent_name, change_infos, prompt_dir,
            config["max_file_size"], config["max_prompt_size"],
        )

    results = agent_runner.run_agents_parallel(
        config["agents"], prompt_for,
        config["model"], session_dir, config["timeout"], log=debug_log,
    )

    summary_template_path = os.path.join(prompt_dir, "summary.md")
    try:
        with open(summary_template_path, "r", encoding="utf-8") as f:
            summary_template_size = len(f.read())
    except Exception:
        summary_template_size = 0

    substitutions = build_summary_substitutions(
        results, change_infos, config.get("max_summary_size", 0), summary_template_size,
    )
    summary.run_summary(
        summary_template_path, substitutions,
        config["model"], session_dir, config["timeout"], log=debug_log,
    )

    total_elapsed = time.time() - total_start

    meta = {
        "timestamp": datetime.now().isoformat(),
        "files": [
            {
                "file_path": ci["file_path"],
                "change_type": ci["change_type"],
                "file_extension": ci["file_extension"],
            }
            for ci in change_infos
        ],
        "total_elapsed_seconds": round(total_elapsed, 2),
        "agents": [
            {"name": r["agent"], "status": r["status"], "elapsed_seconds": r["elapsed"]}
            for r in results
        ],
    }
    session.save_metadata(session_dir, meta)

    debug_log(f"Code review session completed in {total_elapsed:.1f}s: {session_dir}")
    return session_dir


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main_cli(args):
    """CLI entry point for manual review invocation."""
    config = load_config()

    files = []
    diff_getter = None      # function(file_path) -> diff_content
    content_getter = None   # function(file_path) -> file_content (for non-disk cases)

    if args.commit:
        commit = args.commit
        files = get_git_commit_files(commit)
        diff_getter = lambda fp, c=commit: get_git_commit_diff(c, fp)
        content_getter = lambda fp, c=commit: get_file_at_commit(c, fp)
        if not files:
            print(f"No changed files found in commit {commit}.")
            sys.exit(0)
        print(f"Reviewing commit: {commit}")

    elif args.range:
        range_spec = args.range
        files = get_git_range_files(range_spec)
        diff_getter = lambda fp, r=range_spec: get_git_range_diff(r, fp)
        if not files:
            print(f"No changed files found in range {range_spec}.")
            sys.exit(0)
        print(f"Reviewing range: {range_spec}")

    elif args.branch:
        branch = args.branch
        files = get_git_branch_diff_files(branch)
        diff_getter = lambda fp, b=branch: get_git_branch_diff(b, fp)
        if not files:
            print(f"No changed files found compared to branch {branch}.")
            sys.exit(0)
        print(f"Reviewing changes against branch: {branch}")

    elif args.files:
        for f in args.files:
            if os.path.isdir(f):
                files.extend(get_directory_files(f))
            else:
                files.append(f)

    else:
        files = get_git_diff_files(staged_only=args.staged)
        if not files:
            mode = "staged changes" if args.staged else "git diff"
            print(f"No changed files found in {mode}.")
            sys.exit(0)
        if args.staged:
            print("Reviewing staged changes...")

    filtered_files = []
    for f in files:
        _, ext = os.path.splitext(f)
        ext_clean = ext.lstrip(".").lower()
        if ext_clean and ext_clean in config["skip_extensions"]:
            debug_log(f"Skipping review for extension: {ext_clean}")
            continue
        if is_binary_ext(f):
            debug_log(f"Skipping binary file (extension): {f}")
            continue
        if not args.commit and not args.range and not args.branch:
            if not os.path.isfile(f):
                debug_log(f"File not found, skipping: {f}")
                continue
            if is_binary_file(f):
                debug_log(f"Skipping binary file (content): {f}")
                continue
        filtered_files.append(f)

    if not filtered_files:
        print("No reviewable files found.")
        sys.exit(0)

    print(f"Collecting {len(filtered_files)} file(s)...")
    all_change_infos = []
    for file_path in filtered_files:
        diff = diff_getter(file_path) if diff_getter else None
        content = content_getter(file_path) if content_getter else None
        all_change_infos.append(
            build_cli_change_info(file_path, diff_content=diff, file_content=content)
        )

    batch_size = config["batch_size"]
    batches = [
        all_change_infos[i:i + batch_size]
        for i in range(0, len(all_change_infos), batch_size)
    ]
    total_batches = len(batches)

    if total_batches == 1:
        print(f"Reviewing {len(all_change_infos)} file(s)...")
        for ci in all_change_infos:
            print(f"  - {ci['file_path']}")
        session_dir = run_review_session(all_change_infos, config)
        print(f"\nReview complete. Results:")
        print(f"  {session_dir}/SUMMARY.md")
    else:
        print(f"Reviewing {len(all_change_infos)} file(s) in {total_batches} batches (batch size: {batch_size})...")
        session_dirs = []
        for batch_idx, batch in enumerate(batches, 1):
            print(f"\n--- Batch {batch_idx}/{total_batches} ({len(batch)} files) ---")
            for ci in batch:
                print(f"  - {ci['file_path']}")
            session_dir = run_review_session(batch, config)
            session_dirs.append(session_dir)
            print(f"  → {session_dir}/SUMMARY.md")

        print(f"\nReview complete. {total_batches} batches processed.")
        print(f"Results:")
        for i, sd in enumerate(session_dirs, 1):
            print(f"  Batch {i}: {sd}/SUMMARY.md")


# ---------------------------------------------------------------------------
# Hook entry point
# ---------------------------------------------------------------------------


def main_hook():
    """Hook entry point for PostToolUse events."""
    try:
        if os.environ.get("DISABLE_CODE_REVIEW", "0") == "1":
            sys.exit(0)

        try:
            raw_input = sys.stdin.read()
            input_data = json.loads(raw_input)
        except json.JSONDecodeError as e:
            debug_log(f"JSON decode error: {e}")
            sys.exit(0)

        tool_name = input_data.get("tool_name", "")
        if tool_name not in ("Write", "Edit"):
            sys.exit(0)

        config = load_config()

        file_path = input_data.get("tool_input", {}).get("file_path", "")
        if file_path:
            _, ext = os.path.splitext(file_path)
            ext_clean = ext.lstrip(".").lower()
            if ext_clean and ext_clean in config["skip_extensions"]:
                debug_log(f"Skipping review for extension: {ext_clean}")
                sys.exit(0)
            if should_skip_binary(file_path):
                debug_log(f"Skipping binary file: {file_path}")
                sys.exit(0)

        change_info = extract_change_info(input_data)
        if change_info is None:
            debug_log("No change info extracted")
            sys.exit(0)

        # Fork to background so the hook returns immediately.
        pid = os.fork()
        if pid > 0:
            sys.exit(0)

        os.setsid()
        run_review_session([change_info], config)

    except Exception as e:
        debug_log(f"Fatal error in orchestrator: {e}")

    os._exit(0)


# ---------------------------------------------------------------------------
# Main dispatcher
# ---------------------------------------------------------------------------


def main():
    """Main entry point: dispatch to CLI or hook mode."""
    parser = argparse.ArgumentParser(
        description="Code Review Agents Orchestrator",
        add_help=False,
    )
    parser.add_argument("--cli", action="store_true",
                        help="Run in CLI mode (manual invocation)")
    parser.add_argument("--commit", type=str, metavar="HASH",
                        help="Review changes from a specific git commit")
    parser.add_argument("--range", type=str, metavar="FROM..TO",
                        help="Review changes in a git range (e.g., abc123..def456)")
    parser.add_argument("--branch", type=str, metavar="BRANCH",
                        help="Review changes compared to a branch (e.g., main)")
    parser.add_argument("--staged", action="store_true",
                        help="Review only staged changes")
    parser.add_argument("files", nargs="*",
                        help="Files or directories to review (CLI mode only)")

    args, _ = parser.parse_known_args()

    if args.cli:
        main_cli(args)
    else:
        main_hook()


if __name__ == "__main__":
    main()
