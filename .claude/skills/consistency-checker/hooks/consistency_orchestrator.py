#!/usr/bin/env python3
"""
Consistency Checker Orchestrator.

Runs 5 spec/plan-consistency checkers in parallel via `claude -p`, using the
shared agent-runner library from `code-review-agents/lib/`.

Modes:
  --spec <path>        spec draft (typically plan/in-progress/spec-draft-*.md)
  --plan <path>        plan draft
  --impl-prep <scope>  pre-implementation check; scope = spec/<area>/ path

Exit codes:
  0  no violations / warnings only
  2  Critical violations found (caller must block)
  1  orchestrator-level error
"""

import argparse
import os
import re
import sys
import time
from datetime import datetime

# Reuse the shared library from code-review-agents.
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(THIS_DIR)
CODE_REVIEW_SKILL = os.path.normpath(os.path.join(SKILL_DIR, "..", "code-review-agents"))
sys.path.insert(0, CODE_REVIEW_SKILL)

from lib import agent_runner, session, summary  # noqa: E402

DEBUG_LOG_FILE = "/tmp/consistency-checker-log.txt"
debug_log = session.make_debug_logger(DEBUG_LOG_FILE)

ALL_CHECKERS = [
    "cross_spec",
    "rationale_continuity",
    "convention_compliance",
    "plan_coherence",
    "naming_collision",
]


def load_config():
    """Load configuration from environment variables."""
    agents_env = os.environ.get("CONSISTENCY_AGENTS", "")
    if agents_env.strip():
        agents = [a.strip() for a in agents_env.split(",") if a.strip()]
    else:
        agents = list(ALL_CHECKERS)

    return {
        "model": os.environ.get("CONSISTENCY_MODEL", "sonnet"),
        "timeout": int(os.environ.get("CONSISTENCY_TIMEOUT", "1800")),
        "output_dir": os.environ.get("CONSISTENCY_OUTPUT_DIR", "./review/consistency"),
        "agents": agents,
        "max_context_size": int(os.environ.get("CONSISTENCY_MAX_CONTEXT_SIZE", "262144")),
    }


# ---------------------------------------------------------------------------
# File / corpus collection
# ---------------------------------------------------------------------------


def repo_root():
    """Return the current working directory (caller is expected to invoke from repo root)."""
    return os.getcwd()


def read_text_file(path):
    """Read a UTF-8 text file. Returns empty string on failure."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        debug_log(f"Failed to read {path}: {e}")
        return ""


def collect_markdown_files(root_dir, exclude_paths=None):
    """Walk root_dir and return all *.md files, sorted, excluding any in exclude_paths."""
    if exclude_paths is None:
        exclude_paths = set()
    else:
        exclude_paths = {os.path.abspath(p) for p in exclude_paths}

    if not os.path.isdir(root_dir):
        return []

    files = []
    for current, dirs, filenames in os.walk(root_dir):
        # Skip hidden directories
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
    """Concatenate files with a header per file. Returns the assembled string."""
    if not file_paths:
        return f"### {label}\n(없음)\n"
    parts = [f"### {label}\n"]
    for path in file_paths:
        rel = os.path.relpath(path, root) if root else path
        content = read_text_file(path)
        parts.append(f"\n#### `{rel}`\n```\n{content}\n```\n")
    return "".join(parts)


RATIONALE_HEADER_RE = re.compile(r"^##\s+Rationale\b.*$", re.MULTILINE)


def extract_rationale_sections(file_paths, root):
    """Extract `## Rationale` sections from each file and concatenate with citations."""
    blocks = []
    for path in file_paths:
        text = read_text_file(path)
        match = RATIONALE_HEADER_RE.search(text)
        if not match:
            continue
        start = match.start()
        # Find next top-level heading (## or #) after the Rationale heading to bound the section.
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
    """Resolve the target doc and gather all supporting corpora.

    Returns a dict suitable for prompt substitution.
    """
    spec_dir = os.path.join(root, "spec")
    conventions_dir = os.path.join(spec_dir, "conventions")
    plan_dir = os.path.join(root, "plan", "in-progress")

    excluded = set()
    target_path_rel = ""
    target_doc = ""
    mode_label = ""

    if args.spec:
        target_path_rel = args.spec
        target_abs = os.path.abspath(target_path_rel)
        excluded.add(target_abs)
        target_doc = read_text_file(target_abs)
        mode_label = "spec draft 검토 (--spec)"

    elif args.plan:
        target_path_rel = args.plan
        target_abs = os.path.abspath(target_path_rel)
        excluded.add(target_abs)
        target_doc = read_text_file(target_abs)
        mode_label = "plan draft 검토 (--plan)"

    elif args.impl_prep:
        target_path_rel = args.impl_prep
        target_abs = os.path.abspath(target_path_rel)
        # impl-prep: target is the scope folder. Bundle all md files inside.
        scope_files = collect_markdown_files(target_abs)
        excluded.update(scope_files)
        target_doc = format_file_bundle(scope_files, root, f"구현 대상 영역: `{target_path_rel}`")
        mode_label = f"구현 착수 전 검토 (--impl-prep, scope={target_path_rel})"

    else:
        raise ValueError("Mode 가 지정되지 않았습니다: --spec / --plan / --impl-prep 중 하나가 필요합니다.")

    # Collect related corpora.
    all_spec_files = collect_markdown_files(spec_dir, exclude_paths=excluded)
    convention_files = [p for p in all_spec_files if conventions_dir in p]
    other_spec_files = [p for p in all_spec_files if conventions_dir not in p]
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
# Prompt assembly
# ---------------------------------------------------------------------------


# Each checker only uses a subset of context keys, but we substitute all of them
# (unused placeholders simply don't appear in the template). The budget split
# avoids ballooning the prompt: target_doc keeps its full budget, supporting
# corpora share the remainder.
CHECKER_BUDGET_RATIO = {
    "target_doc": 0.30,
    "related_specs": 0.30,
    "rationale_excerpts": 0.15,
    "conventions": 0.10,
    "plan_in_progress": 0.15,
}


def budget_substitutions(context, max_context_size):
    """Apply per-key truncation so each checker prompt stays within the size budget."""
    if max_context_size <= 0:
        return dict(context)

    truncated = {"mode": context["mode"], "target_path": context["target_path"]}
    for key, ratio in CHECKER_BUDGET_RATIO.items():
        text = context.get(key, "")
        budget = int(max_context_size * ratio)
        truncated[key] = session.truncate_to_budget(text, budget)
    return truncated


def build_checker_prompt(checker_name, prompt_dir, substitutions):
    """Build the prompt for a single checker by rendering its template."""
    template_path = os.path.join(prompt_dir, "checkers", f"{checker_name}.md")
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template = f.read()
    except Exception as e:
        debug_log(f"Failed to read checker template {template_path}: {e}")
        return None
    return summary.render_template(template, substitutions)


# ---------------------------------------------------------------------------
# BLOCK decision
# ---------------------------------------------------------------------------


def parse_block_decision(summary_text):
    """Detect whether the summary marks this as a BLOCK.

    Recognizes `BLOCK: YES` in the first ~30 lines (case-insensitive).
    """
    if not summary_text:
        return False
    head = "\n".join(summary_text.splitlines()[:30]).upper()
    return "BLOCK: YES" in head


# ---------------------------------------------------------------------------
# Session runner
# ---------------------------------------------------------------------------


def run_session(context, config):
    """Run a consistency-check session and return (session_dir, block_flag)."""
    base_output = config["output_dir"]
    # When output_dir already ends with /consistency we don't add a subdir;
    # otherwise create the timestamped dir directly under it.
    session_dir = session.create_session_dir(base_output)
    prompt_dir = os.path.join(SKILL_DIR, "prompts")

    debug_log(f"Starting consistency-check session: {session_dir}")
    debug_log(f"Mode: {context['mode']}")
    debug_log(f"Checkers: {', '.join(config['agents'])}")

    total_start = time.time()
    substitutions = budget_substitutions(context, config["max_context_size"])

    def prompt_for(checker_name):
        return build_checker_prompt(checker_name, prompt_dir, substitutions)

    results = agent_runner.run_agents_parallel(
        config["agents"], prompt_for,
        config["model"], session_dir, config["timeout"], log=debug_log,
    )

    summary_template_path = os.path.join(prompt_dir, "summary.md")

    target_info = (
        f"- 모드: {context['mode']}\n"
        f"- target: `{context['target_path']}`\n"
        f"- 실행된 checker: {', '.join(config['agents'])}\n"
    )

    reviews_text = ""
    for r in results:
        reviews_text += f"\n## {r['agent']} (status: {r['status']}, {r['elapsed']}s)\n\n"
        reviews_text += r.get("output", "No output") + "\n"

    summary_text = summary.run_summary(
        summary_template_path,
        {"target_info": target_info, "review_results": reviews_text},
        config["model"], session_dir, config["timeout"], log=debug_log,
    ) or ""

    blocked = parse_block_decision(summary_text)
    total_elapsed = time.time() - total_start

    meta = {
        "timestamp": datetime.now().isoformat(),
        "mode": context["mode"],
        "target_path": context["target_path"],
        "blocked": blocked,
        "total_elapsed_seconds": round(total_elapsed, 2),
        "checkers": [
            {"name": r["agent"], "status": r["status"], "elapsed_seconds": r["elapsed"]}
            for r in results
        ],
    }
    session.save_metadata(session_dir, meta)

    debug_log(f"Consistency-check completed in {total_elapsed:.1f}s, blocked={blocked}: {session_dir}")
    return session_dir, blocked


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Consistency Checker Orchestrator")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--spec", type=str, metavar="PATH",
                      help="spec draft path (e.g., plan/in-progress/spec-draft-foo.md)")
    mode.add_argument("--plan", type=str, metavar="PATH",
                      help="plan draft path")
    mode.add_argument("--impl-prep", type=str, dest="impl_prep", metavar="SCOPE",
                      help="pre-implementation check scope (spec/<area>/ path)")

    args = parser.parse_args()

    if os.environ.get("DISABLE_CONSISTENCY_CHECK", "0") == "1":
        print("DISABLE_CONSISTENCY_CHECK=1, skipping.")
        sys.exit(0)

    config = load_config()
    root = repo_root()

    try:
        context = collect_context(args, root)
    except Exception as e:
        print(f"Error collecting context: {e}", file=sys.stderr)
        debug_log(f"collect_context failed: {e}")
        sys.exit(1)

    if not context["target_doc"].strip():
        print(f"Error: target document is empty or unreadable: {context['target_path']}", file=sys.stderr)
        sys.exit(1)

    print(f"Mode: {context['mode']}")
    print(f"Target: {context['target_path']}")
    print(f"Checkers: {', '.join(config['agents'])}")
    print("Running checks in parallel...")

    try:
        session_dir, blocked = run_session(context, config)
    except Exception as e:
        print(f"Error running session: {e}", file=sys.stderr)
        debug_log(f"run_session failed: {e}")
        sys.exit(1)

    print(f"\nSession: {session_dir}")
    print(f"Summary: {session_dir}/SUMMARY.md")

    if blocked:
        print("\n*** BLOCK: Critical violations found. Caller must stop and resolve. ***")
        sys.exit(2)

    print("\nNo critical violations. (Review Warnings/Info in SUMMARY.md before proceeding.)")
    sys.exit(0)


if __name__ == "__main__":
    main()
