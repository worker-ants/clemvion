#!/usr/bin/env python3
"""Consistency Checker Orchestrator — prepare-only mode.

Modes:
  --spec <path>        spec draft 검토
  --plan <path>        plan draft 검토
  --impl-prep <scope>  구현 착수 전 검토 (scope = spec/<area>/ 경로)

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
import sys
from datetime import datetime

# Reuse the shared library from code-review-agents.
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(THIS_DIR)
CODE_REVIEW_SKILL = os.path.normpath(os.path.join(SKILL_DIR, "..", "code-review-agents"))
sys.path.insert(0, CODE_REVIEW_SKILL)

from lib import session  # noqa: E402

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
        agents = list(ALL_CHECKERS)

    return {
        "output_dir": os.environ.get("CONSISTENCY_OUTPUT_DIR", "./review/consistency"),
        "agents": agents,
        "max_context_size": int(os.environ.get("CONSISTENCY_MAX_CONTEXT_SIZE", "262144")),
    }


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
        scope_files = collect_markdown_files(target_abs)
        excluded.update(scope_files)
        target_doc = format_file_bundle(scope_files, root, f"구현 대상 영역: `{target_path_rel}`")
        mode_label = f"구현 착수 전 검토 (--impl-prep, scope={target_path_rel})"

    else:
        raise ValueError("Mode 가 지정되지 않았습니다: --spec / --plan / --impl-prep 중 하나가 필요합니다.")

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


def build_checker_prompt_body(checker_name, subs):
    """Compose the prompt body the sub-agent will read.

    The sub-agent's *system prompt* already defines the review aspects and
    output format (see .claude/agents/<checker>-checker.md). The body assembled
    here is just the target document and the supporting corpus the checker
    needs — split by checker so each agent receives only what it inspects.
    """
    parts = [
        "# Consistency Check Payload\n\n",
        "본 파일은 orchestrator 가 작성한 검토 대상 정보입니다.\n",
        "sub-agent 의 system prompt 에 정의된 검토 지침·등급 기준·출력 형식에 따라\n",
        "분석하고, 호출자가 `output_file` 인자로 지정한 경로에 review.md 를 작성하세요.\n",
        "호출자에게는 STATUS 한 줄만 반환합니다.\n\n",
        f"## 검토 모드\n{subs.get('mode', '')}\n\n",
        f"## Target 문서\n경로: `{subs.get('target_path', '')}`\n\n",
        f"```\n{subs.get('target_doc', '')}\n```\n\n",
    ]
    if checker_name == "cross_spec":
        parts.append("## 관련 spec 본문 (다른 영역 포함)\n\n")
        parts.append(subs.get("related_specs", ""))
        parts.append("\n")
    elif checker_name == "rationale_continuity":
        parts.append("## 관련 Rationale 발췌\n\n")
        parts.append(subs.get("rationale_excerpts", ""))
        parts.append("\n")
    elif checker_name == "convention_compliance":
        parts.append("## 정식 규약 모음 (spec/conventions/)\n\n")
        parts.append(subs.get("conventions", ""))
        parts.append("\n")
    elif checker_name == "plan_coherence":
        parts.append("## 진행 중 plan 문서 모음 (plan/in-progress/)\n\n")
        parts.append(subs.get("plan_in_progress", ""))
        parts.append("\n")
    elif checker_name == "naming_collision":
        parts.append("## 검색 대상 코퍼스 (spec/, plan/in-progress/, conventions/)\n\n")
        parts.append(subs.get("related_specs", ""))
        parts.append("\n\n")
        parts.append(subs.get("plan_in_progress", ""))
        parts.append("\n\n")
        parts.append(subs.get("conventions", ""))
        parts.append("\n")
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
        output_path = os.path.join(session_dir, checker, "review.md")
        os.makedirs(os.path.join(session_dir, checker), exist_ok=True)
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
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--spec", type=str, metavar="PATH",
                      help="spec draft path (e.g., plan/in-progress/spec-draft-foo.md)")
    mode.add_argument("--plan", type=str, metavar="PATH",
                      help="plan draft path")
    mode.add_argument("--impl-prep", type=str, dest="impl_prep", metavar="SCOPE",
                      help="pre-implementation check scope (spec/<area>/ path)")

    args = parser.parse_args()

    if os.environ.get("DISABLE_CONSISTENCY_CHECK", "0") == "1":
        print("DISABLE_CONSISTENCY_CHECK=1, skipping.", file=sys.stderr)
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
