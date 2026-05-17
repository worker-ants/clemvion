#!/usr/bin/env python3
"""Merge Coordinator Orchestrator — prepare + resume.

Collects branch / PR metadata for `/merge-coordinate` and writes:
  - review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_prompts/<analyzer>.md
        per-analyzer role-specific input (perspective + checklist + branches)
  - review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/_retry_state.json
        same schema as code-review-agents / consistency-checker:
          {session_dir, summary_subagent_type, summary_output_file,
           subagent_invocations[], agents_pending/success/fatal,
           agent_history, rate_limit_episodes, total_wait_sec,
           wake_history, last_reset_hint_sec, loop_mode}
  - review/merge/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/meta.json
        {branches[], base_hint, mode, timestamp}

Prints the session directory absolute path on stdout.

The orchestrator **never calls a model** — analyzer prompts are consumed by
the main Claude session via the `Agent` tool (subagent_type=<analyzer>).
The conflict-resolver agent is invoked dynamically by main during Phase 3
on a per-conflict basis (not registered here).
"""

import argparse
import json
import os
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
from lib.role_instructions import ANALYZER_INSTRUCTIONS  # noqa: E402
from _lib import project_config  # noqa: E402

DEBUG_LOG_FILE = "/tmp/merge-coordinator-log.txt"
debug_log = session.make_debug_logger(DEBUG_LOG_FILE)

# Analyzers registered up-front (summary is the last entry, handled separately
# via summary_subagent_type). The resolver is *not* listed here — it is called
# ad-hoc by main during Phase 3 with a per-conflict prompt.
ANALYZERS = [
    "merge_conflict_analyzer",
    "semantic_conflict_analyzer",
    "integration_order_planner",
    "cross_branch_spec_analyzer",
]
SUMMARY_AGENT = "integration_risk_summary"


def _subagent_type(name):
    return name.replace("_", "-")


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def load_config():
    return {
        "output_dir": os.environ.get("MERGE_OUTPUT_DIR", "./review/merge"),
        "base_hint": os.environ.get("MERGE_BASE_HINT", ""),
        "auto_apply_patch": os.environ.get("MERGE_AUTO_APPLY_PATCH", "0") == "1",
        "max_prompt_size": int(os.environ.get("MERGE_MAX_PROMPT_SIZE", "131072")),
    }


# ---------------------------------------------------------------------------
# Git / gh helpers
# ---------------------------------------------------------------------------


def _git(args, timeout=15):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def _gh(args, timeout=30):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def resolve_pr(pr_number):
    """Resolve a PR number to {name, head, base, title, state, sha}.

    Returns None if gh is unavailable or the PR can't be resolved.
    """
    try:
        r = _gh([
            "gh", "pr", "view", str(pr_number),
            "--json", "headRefName,baseRefName,title,state,headRefOid",
        ])
        if r.returncode != 0:
            debug_log(f"gh pr view {pr_number} failed: {r.stderr.strip()}")
            return None
        data = json.loads(r.stdout)
        return {
            "name": data.get("headRefName", ""),
            "base": data.get("baseRefName", "main"),
            "title": data.get("title", ""),
            "state": data.get("state", ""),
            "sha": data.get("headRefOid", ""),
            "source": f"PR#{pr_number}",
        }
    except FileNotFoundError:
        debug_log("gh CLI not found; PR resolution skipped")
        return None
    except Exception as e:
        debug_log(f"gh pr view {pr_number} exception: {e}")
        return None


def resolve_branch(name):
    """Resolve a branch name to {name, sha, source}. Uses `git rev-parse`."""
    # Try local first, then origin/<name>.
    for ref in (name, f"origin/{name}"):
        r = _git(["git", "rev-parse", "--verify", ref])
        if r.returncode == 0 and r.stdout.strip():
            return {
                "name": name,
                "base": "",
                "title": "",
                "state": "",
                "sha": r.stdout.strip(),
                "source": f"branch:{ref}",
            }
    debug_log(f"Branch {name} not found locally or on origin")
    return None


def branch_diff_stat(base, head):
    """Return `git diff --stat <base>...<head>` as a single string."""
    r = _git(["git", "diff", "--stat", f"{base}...{head}"])
    if r.returncode != 0:
        return f"(diff --stat failed: {r.stderr.strip()})"
    return r.stdout


def branch_touched_files(base, head):
    """Return the list of files touched between base and head."""
    r = _git(["git", "diff", "--name-only", f"{base}...{head}"])
    if r.returncode != 0:
        return []
    return [f for f in r.stdout.strip().splitlines() if f]


def categorise_paths(paths, repo_root=None):
    """Group paths by top-level area.

    Fixed groups: ``spec``, ``plan``, ``.claude``, ``other``.
    Code areas come from ``.claude.project.json`` ``code_areas`` (default:
    ``["codebase"]``). Each path is matched against:
      1. ``spec/`` → ``spec``
      2. ``plan/`` → ``plan``
      3. ``.claude/`` → ``.claude``
      4. ``<area>/`` for each entry of ``code_areas`` → that area
      5. Otherwise → ``other``
    """
    cfg = project_config.load(repo_root or os.getcwd())
    code_areas = cfg.get("code_areas") or ["codebase"]

    groups = {"spec": [], "plan": []}
    for area in code_areas:
        groups[area] = []
    groups[".claude"] = []
    groups["other"] = []

    for p in paths:
        if p.startswith("spec/"):
            groups["spec"].append(p)
            continue
        if p.startswith("plan/"):
            groups["plan"].append(p)
            continue
        if p.startswith(".claude/"):
            groups[".claude"].append(p)
            continue
        matched = False
        for area in code_areas:
            if p.startswith(f"{area}/"):
                groups[area].append(p)
                matched = True
                break
        if not matched:
            groups["other"].append(p)
    return groups


def infer_default_base(branches_info):
    """Pick a default base when MERGE_BASE_HINT is empty.

    Strategy: if every PR points at the same base, use that. Otherwise fall
    back to `main` if it exists, else the merge-base of the first two heads.
    """
    pr_bases = {b["base"] for b in branches_info if b.get("base")}
    if len(pr_bases) == 1:
        return next(iter(pr_bases))
    if _git(["git", "rev-parse", "--verify", "main"]).returncode == 0:
        return "main"
    if _git(["git", "rev-parse", "--verify", "origin/main"]).returncode == 0:
        return "origin/main"
    return "HEAD"


# ---------------------------------------------------------------------------
# Prompt body builders
# ---------------------------------------------------------------------------


HEADER_TEMPLATE = """# {title} Payload

본 파일은 orchestrator 가 `{title}` analyzer 용으로 작성한 입력입니다. {perspective}

sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로 따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file` 인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 ({title})

{checklist}

## 통합 대상 branch
"""


def format_branches_section(branches_info, base):
    lines = [f"\nbase: `{base}`\n"]
    for i, b in enumerate(branches_info, 1):
        lines.append(f"\n### {i}. `{b['name']}`  (source: {b['source']}, sha: {b['sha'][:8]})")
        if b.get("title"):
            lines.append(f"- title: {b['title']}")
        if b.get("base"):
            lines.append(f"- declared base: `{b['base']}`")
        if b.get("state"):
            lines.append(f"- state: {b['state']}")
        lines.append(f"- diff stat (against base `{base}`):")
        lines.append("\n```\n" + branch_diff_stat(base, b["name"]) + "\n```")
        groups = categorise_paths(branch_touched_files(base, b["name"]))
        lines.append("- touched areas:")
        for k, v in groups.items():
            if v:
                shown = ", ".join(v[:10])
                more = "" if len(v) <= 10 else f" (+{len(v)-10} more)"
                lines.append(f"  - **{k}** ({len(v)}): {shown}{more}")
    return "\n".join(lines) + "\n"


def file_intersection_section(branches_info, base):
    """For merge_conflict_analyzer: branches that touched the same file."""
    touched_by = {}
    for b in branches_info:
        for f in branch_touched_files(base, b["name"]):
            touched_by.setdefault(f, []).append(b["name"])
    overlap = {f: bs for f, bs in touched_by.items() if len(bs) >= 2}
    if not overlap:
        return "\n## 동시 수정 파일\n\n(없음 — 모든 branch 가 서로 다른 파일만 손댔습니다.)\n"
    lines = ["\n## 동시 수정 파일 (2개 이상 branch 가 동일 파일 수정)\n"]
    for f, bs in sorted(overlap.items()):
        lines.append(f"- `{f}` ← {', '.join('`'+b+'`' for b in bs)}")
    return "\n".join(lines) + "\n"


def spec_plan_overlap_section(branches_info, base):
    """For cross_branch_spec_analyzer: spec/plan-level overlap."""
    spec_by = {}
    plan_by = {}
    for b in branches_info:
        for f in branch_touched_files(base, b["name"]):
            if f.startswith("spec/"):
                spec_by.setdefault(f, []).append(b["name"])
            elif f.startswith("plan/"):
                plan_by.setdefault(f, []).append(b["name"])
    lines = ["\n## spec/ 영역 변경\n"]
    if not spec_by:
        lines.append("\n(없음)\n")
    else:
        for f, bs in sorted(spec_by.items()):
            marker = " ⚠️ overlap" if len(bs) >= 2 else ""
            lines.append(f"- `{f}` ← {', '.join('`'+b+'`' for b in bs)}{marker}")
    lines.append("\n## plan/ 영역 변경\n")
    if not plan_by:
        lines.append("\n(없음)\n")
    else:
        for f, bs in sorted(plan_by.items()):
            marker = " ⚠️ overlap" if len(bs) >= 2 else ""
            lines.append(f"- `{f}` ← {', '.join('`'+b+'`' for b in bs)}{marker}")
    return "\n".join(lines) + "\n"


def order_hint_section(branches_info, base):
    """For integration_order_planner: PR-declared bases + commit graph hint."""
    lines = ["\n## 의존성 힌트\n"]
    for b in branches_info:
        decl = b.get("base") or "(unknown)"
        lines.append(f"- `{b['name']}` declared base = `{decl}`")
    lines.append("")
    lines.append("merge-base 정보:")
    for b in branches_info:
        r = _git(["git", "merge-base", base, b["name"]])
        mb = r.stdout.strip() if r.returncode == 0 else "(unavailable)"
        lines.append(f"- `{b['name']}` ⟂ `{base}` → {mb[:12] if mb else '?'}")
    return "\n".join(lines) + "\n"


ANALYZER_EXTRA_SECTION = {
    "merge_conflict_analyzer": file_intersection_section,
    "semantic_conflict_analyzer": file_intersection_section,
    "cross_branch_spec_analyzer": spec_plan_overlap_section,
    "integration_order_planner": order_hint_section,
}


def build_analyzer_prompt(analyzer_name, branches_info, base, base_hint, max_prompt_size):
    info = ANALYZER_INSTRUCTIONS[analyzer_name]
    header = HEADER_TEMPLATE.format(
        title=info["ko_title"],
        perspective=info["perspective"],
        checklist=info["checklist"],
    )
    branches_section = format_branches_section(branches_info, base)
    extra_fn = ANALYZER_EXTRA_SECTION.get(analyzer_name)
    extra = extra_fn(branches_info, base) if extra_fn else ""
    hint_line = ""
    if base_hint:
        hint_line = f"\n> 사용자 힌트: 가능하면 base 로 `{base_hint}` 검토.\n"
    body = header + branches_section + extra + hint_line
    if max_prompt_size > 0 and len(body) > max_prompt_size:
        body = session.truncate_to_budget(body, max_prompt_size)
    return body


# ---------------------------------------------------------------------------
# Session preparation
# ---------------------------------------------------------------------------


def prepare_session(branches_info, base, config):
    session_dir = session.create_session_dir(config["output_dir"])
    prompts_dir = os.path.join(session_dir, "_prompts")
    os.makedirs(prompts_dir, exist_ok=True)

    invocations = []
    for analyzer in ANALYZERS:
        body = build_analyzer_prompt(
            analyzer, branches_info, base, config.get("base_hint", ""),
            config["max_prompt_size"],
        )
        prompt_path = os.path.join(prompts_dir, f"{analyzer}.md")
        output_path = os.path.join(session_dir, f"{analyzer}.md")
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(body)
        invocations.append({
            "name": analyzer,
            "subagent_type": _subagent_type(analyzer),
            "prompt_file": os.path.abspath(prompt_path),
            "output_file": os.path.abspath(output_path),
        })

    retry_state = {
        "session_dir": os.path.abspath(session_dir),
        "summary_subagent_type": _subagent_type(SUMMARY_AGENT),
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
        # Merge-coordinator specific fields. The resolver is invoked dynamically
        # by main during Phase 3 — main appends its invocation records here.
        "resolver_invocations": [],
        "auto_apply_patch": config["auto_apply_patch"],
        "branches": branches_info,
        "base": base,
    }
    state_path = os.path.join(session_dir, "_retry_state.json")
    with open(state_path, "w", encoding="utf-8") as f:
        json.dump(retry_state, f, indent=2, ensure_ascii=False)

    meta = {
        "timestamp": datetime.now().isoformat(),
        "branches": [{"name": b["name"], "sha": b["sha"], "source": b["source"], "title": b["title"]} for b in branches_info],
        "base": base,
        "base_hint": config.get("base_hint", ""),
        "auto_apply_patch": config["auto_apply_patch"],
    }
    session.save_metadata(session_dir, meta)

    debug_log(
        f"Prepared merge-coordinator session: {session_dir} "
        f"({len(branches_info)} branches, base={base})"
    )
    return os.path.abspath(session_dir)


# ---------------------------------------------------------------------------
# Input collection
# ---------------------------------------------------------------------------


def collect_branches(args):
    """Resolve --prs, --branches, and positional args into a unified list.

    PR numbers (purely digits) → gh pr view.
    Other tokens → branch refs.
    """
    tokens = []
    if args.prs:
        for tok in args.prs.split(","):
            tok = tok.strip()
            if tok:
                tokens.append(("pr", tok))
    if args.branches:
        for tok in args.branches.split(","):
            tok = tok.strip()
            if tok:
                tokens.append(("branch", tok))
    for tok in args.positional:
        tok = tok.strip()
        if not tok:
            continue
        kind = "pr" if tok.isdigit() else "branch"
        tokens.append((kind, tok))

    branches = []
    seen = set()
    for kind, tok in tokens:
        info = resolve_pr(tok) if kind == "pr" else resolve_branch(tok)
        if info is None:
            print(f"[warning] could not resolve {kind}={tok}; skipping",
                  file=sys.stderr)
            continue
        key = info["name"] + info["sha"]
        if key in seen:
            continue
        seen.add(key)
        branches.append(info)
    return branches


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Merge Coordinator Orchestrator (prepare + resume).",
    )
    parser.add_argument("--prepare", action="store_true",
                        help="Prepare a merge-coordination session (default).")
    parser.add_argument("--resume", type=str, metavar="SESSION_DIR",
                        help="Resume an existing session: validate _retry_state.json, echo path.")
    parser.add_argument("--prs", type=str, default="",
                        metavar="N1,N2,...", help="Comma-separated PR numbers (gh CLI).")
    parser.add_argument("--branches", type=str, default="",
                        metavar="b1,b2,...", help="Comma-separated branch names.")
    parser.add_argument("--base-hint", type=str, default="",
                        dest="base_hint", metavar="REF",
                        help="Optional hint for the integration base. Sets MERGE_BASE_HINT env override.")
    parser.add_argument("positional", nargs="*",
                        help="PR numbers or branch names (mixed; numeric = PR).")
    args, _ = parser.parse_known_args()

    if args.resume:
        sd = os.path.abspath(args.resume)
        state_file = os.path.join(sd, "_retry_state.json")
        if not os.path.isfile(state_file):
            print(f"Error: cannot resume — _retry_state.json missing under {sd}",
                  file=sys.stderr)
            sys.exit(1)
        debug_log(f"Resuming merge-coordinator session: {sd}")
        print(sd)
        sys.exit(0)

    config = load_config()
    if args.base_hint:
        config["base_hint"] = args.base_hint

    branches_info = collect_branches(args)
    if not branches_info:
        print("Error: no resolvable branches/PRs provided.", file=sys.stderr)
        sys.exit(1)
    if len(branches_info) < 2:
        print(
            "Warning: only one branch resolved. merge-coordinator is intended for "
            "multi-branch integration, but the session will still be prepared so "
            "the analyzers can run against a single-branch scenario.",
            file=sys.stderr,
        )

    base = config.get("base_hint") or infer_default_base(branches_info)
    print(
        f"Preparing merge-coordinator session: base=`{base}`, "
        f"branches={[b['name'] for b in branches_info]}",
        file=sys.stderr,
    )
    session_dir = prepare_session(branches_info, base, config)
    print(session_dir)


if __name__ == "__main__":
    main()
