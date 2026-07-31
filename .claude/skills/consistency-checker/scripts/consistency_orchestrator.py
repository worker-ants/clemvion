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
CLAUDE_DIR = os.path.dirname(SKILLS_DIR)  # .claude/
sys.path.insert(0, CODE_REVIEW_SKILL)
sys.path.insert(0, SKILLS_DIR)
sys.path.insert(0, CLAUDE_DIR)

from lib import session  # noqa: E402
from lib.role_instructions import CHECKER_INSTRUCTIONS  # noqa: E402
from _lib import project_config  # noqa: E402

# Report location/validity is shared with the push/stop gate and the code-review
# orchestrator — see `.claude/_shared/report_paths.py`. One rule, three consumers.
from _shared import block_integrity as _block_integrity  # noqa: E402
from _shared import retry_state as _retry_state_lib  # noqa: E402

DEBUG_LOG_FILE = "/tmp/consistency-checker-log.txt"
debug_log = session.make_debug_logger(DEBUG_LOG_FILE)

# Derived, not restated: `_shared/block_integrity` needs the same list to know
# which reports to cross-check, and a name added in one place only would make
# that backstop silently blind to the new checker.
ALL_CHECKERS = list(_block_integrity.ALL_CHECKERS)


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


# State bookkeeping lives in `.claude/_shared/retry_state.py` — both orchestrators
# used to carry byte-identical copies kept in step by a "Change both" comment,
# which is the arrangement `report_paths.py` was extracted to replace. Measured
# by AST before moving: four of the five were identical; only `_emit_summary_state`
# differed, and only in the fields it prints (the code-review side has a router; this one does not).
def _load_state(session_dir):
    return _retry_state_lib.load_state(session_dir)


def _save_state(state_file, state):
    return _retry_state_lib.save_state(state_file, state)


def _reconcile_state_with_disk(session_dir):
    return _retry_state_lib.reconcile_state_with_disk(session_dir)


def _apply_status_update(session_dir, agent, status, reset_hint):
    return _retry_state_lib.apply_status_update(session_dir, agent, status, reset_hint)


def _emit_summary_state(session_dir):
    _retry_state_lib.emit_summary_state(session_dir)


def repo_root():
    return os.getcwd()


def read_text_file(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        debug_log(f"Failed to read {path}: {e}")
        return ""


# ---------------------------------------------------------------------------
# File / corpus collection
# ---------------------------------------------------------------------------


def _neutralize_sentinel(text):
    """Defang a document that writes the boundary sentinel itself.

    "Content cannot produce this marker" is a claim about documents, not a
    property of the format — and this repository already came within one line
    break of falsifying it: the plan describing this very fix quotes the literal.
    Inline (as it does) it is harmless; on a line of its own it would forge a file
    boundary and bring back exactly the bug the sentinel was introduced to kill.
    Rather than ask every future writer to remember that, the writer neutralises
    the boundary form on its way in. Inline mentions are left alone, so prose that
    merely names the marker still reads normally.
    """
    return text.replace(_BUNDLE_FILE_SENTINEL,
                        "\n<!-- @bundle-file (본문 인용 — 경계 아님) -->\n")


def _natural_key(path):
    """Sort key where a run of digits compares as a number, not as text.

    Lexicographically `"1" < "10" < "11" < "2" < "4"`, so `10-graph-rag.md` and
    `11-mcp-client.md` sort ahead of `4-execution-engine.md` — and since the
    budget fills from the front and drops from the tail, the file nobody was
    working on kept the space. Measured on `spec/5-system/` (18 files):
    `4-execution-engine.md` sat at position 12 lexicographically and sits at 4
    here.

    `re.split` with a capturing group alternates non-digit / digit segments, so
    the type at each index is the same for every path and the lists compare
    without `int`-vs-`str` errors.
    """
    return [int(tok) if tok.isdigit() else tok.lower()
            for tok in re.split(r"(\d+)", path)]


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
    files.sort(key=_natural_key)
    return files


# Auto-generated per-resource reference dumps (`spec/conventions/
# <name>-api-catalog/<resource>/**`). `spec-impl-evidence.md` R-7 says these are
# not 정식 spec, yet alphabetically they land near the front of the conventions
# bundle and used to consume the whole budget before any document the target
# actually cites. Matched on the path shape so a relocated or newly added
# catalog inherits the demotion without a code change.
#
# The trailing `[^/]+/` is load-bearing: R-7 draws the line at "one or more path
# segments after the catalog directory", and says the top-level
# `<name>-api-catalog/<resource>.md` index files are 정식 spec that stay in
# scope. Measured here: 222 nested files demoted, 27 top-level indexes not.
# Without it this demoted those 27 too — the exact opposite of what R-7 asks.
_CATALOG_BULK_RE = re.compile(r"(^|/)[^/]*-api-catalog/[^/]+/")


def _is_catalog_bulk(rel):
    return bool(_CATALOG_BULK_RE.search(rel))


def _branch_changed_rels(diff_base, root):
    """Repo-relative paths this branch touched, as a set. Empty on any failure.

    Whole-repo on purpose: `collect_context` calls this ONCE and narrows it per
    bundle with a prefix filter, so a `subpath` parameter would only re-spawn
    git per bundle. (It had one; after the call sites moved to `_prioritized`
    nothing passed it.)

    THREE-DOT for the same reason as `_collect_code_diff` — see its docstring.

    Mirrors `code_review_orchestrator.get_git_branch_diff_files` (same flags,
    same three-dot rationale, different failure default) — change both.
    """
    cmd = ["git", "diff", "--no-renames", "--name-only",
           f"{diff_base}...HEAD", "--", "."]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=root, timeout=30.0)
        if r.returncode != 0:
            debug_log(f"branch-changed diff failed: {r.stderr.strip()[:200]}")
            return set()
        return {ln for ln in r.stdout.split("\n") if ln}
    except Exception as e:  # noqa: BLE001
        debug_log(f"branch-changed diff failed: {e}")
        return set()


def prioritize_bundle_files(file_paths, root, *, changed_rels=(), plan_text=""):
    """Order a bundle so the documents this task is actually about survive truncation.

    `truncate_file_bundle` drops whole files from the TAIL, and
    `collect_markdown_files` hands it natural order now, but ordering by name
    alone still says nothing about relevance. That combination
    is why `spec/5-system/4-execution-engine.md` — the work target — kept losing
    its budget to `1-auth.md` / `10-graph-rag.md` / `11-mcp-client.md`, eight
    times across separate sessions. Twice the checkers had no coverage of the
    target at all, so `BLOCK: NO` meant "never looked", not "looks fine".

    Tiers (stable, natural order inside each — see `_natural_key`):
      0. changed by this branch — the strongest available "this is the subject"
         signal, and it outranks the catalog demotion below
      1. named by an in-progress plan — covers `--impl-prep`, where the spec is
         typically NOT yet edited and tier 0 is therefore empty
      2. everything else
      3. catalog bulk — explicitly not 정식 spec; last. Outranked by tier 0 only:
         a plan that merely mentions one catalog page must not pull the whole
         generated dump forward, but a branch that actually edits one is about it.

    Reordering only. Nothing is dropped here; what does not fit is still dropped
    by `truncate_file_bundle`, which names the omissions.
    """
    changed = set(changed_rels)

    def tier(path):
        rel = os.path.relpath(path, root) if root else path
        # Branch-changed wins over the catalog demotion: a PR that edits a
        # catalog page IS about that page, and demoting it would reproduce this
        # function's own bug class for exactly those PRs. The demotion only
        # outranks the weaker plan-mention signal, where a passing reference
        # must not drag ~230 generated files forward.
        if rel in changed:
            return 0
        if _is_catalog_bulk(rel):
            return 3
        if plan_text and (rel in plan_text or os.path.basename(rel) in plan_text):
            return 1
        return 2

    # `sorted` is stable and the input already arrives in natural order, so the
    # secondary key is implicit — but spell it out rather than rely on the
    # caller having sorted it the same way.
    return sorted(file_paths, key=lambda p: (tier(p), _natural_key(p)))


def format_file_bundle(file_paths, root, label):
    if not file_paths:
        return f"### {label}\n(없음)\n"
    parts = [f"### {label}\n"]
    for path in file_paths:
        rel = os.path.relpath(path, root) if root else path
        content = _neutralize_sentinel(read_text_file(path))
        parts.append(f"{_BUNDLE_FILE_SENTINEL}#### `{rel}`\n```\n{content}\n```\n")
    return "".join(parts)


def _collect_code_diff(diff_base, root):
    """Return ``git diff <diff_base>...HEAD`` for the project's code areas.

    Used by ``--impl-done`` to bundle the implementation diff alongside
    the spec area files so checkers can compare both sides. Empty
    string on any failure (missing base ref, no diff, git error).

    THREE-DOT on purpose (harness-consistency-bundler-budget §H residual): ``A...B``
    diffs against ``merge-base(A, B)``, so when ``diff_base`` (e.g. a freshly
    fetched ``origin/main``) has advanced PAST this branch's fork point, changes
    that landed on the base but not here do NOT appear as reverse deletions. A
    two-dot ``git diff origin/main HEAD`` would inject that noise and let a
    checker read code the branch never touched as "removed". Do not switch to
    two-dot.
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
        blocks.append(
            f"{_BUNDLE_FILE_SENTINEL}#### `{rel}` 의 Rationale\n\n"
            f"{_neutralize_sentinel(section.strip())}\n"
        )
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

    # One diff base for the whole function — `--impl-done` reads it again below
    # for its diff section, and two variables computing the same expression is
    # how they drift apart later.
    diff_base = args.diff_base or "origin/main"

    # Ranking inputs for `prioritize_bundle_files`, resolved once.
    # `_rank_changed` is the WHOLE-repo change set; the per-scope subsets the
    # mode branches want are prefix filters of it, so one git call serves all
    # three bundles instead of one per bundle.
    # Plans are read WITHOUT `excluded` (still empty here anyway) because
    # ranking wants every in-progress plan, not just the ones that survive into
    # the plan bundle.
    _rank_changed = _branch_changed_rels(diff_base, root)
    _rank_plan_text = "\n".join(
        read_text_file(p) for p in collect_markdown_files(plan_dir)
    )

    def _prioritized(files, scope_abs=None):
        """Rank a bundle, narrowing the change set to `scope_abs` when given."""
        changed = _rank_changed
        if scope_abs:
            prefix = os.path.relpath(scope_abs, root).rstrip("/") + "/"
            changed = {r for r in _rank_changed if r.startswith(prefix)}
        return prioritize_bundle_files(
            files, root, changed_rels=changed, plan_text=_rank_plan_text
        )

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
        target_doc = _neutralize_sentinel(read_text_file(target_abs))
        mode_label = "spec draft 검토 (--spec)"

    elif args.plan:
        target_path_rel = args.plan
        target_abs = _require_target(args.plan, "--plan", want_dir=False)
        excluded.add(target_abs)
        target_doc = _neutralize_sentinel(read_text_file(target_abs))
        mode_label = "plan draft 검토 (--plan)"

    elif args.impl_prep:
        target_path_rel = args.impl_prep
        target_abs = _require_target(args.impl_prep, "--impl-prep", want_dir=True)
        scope_files = collect_markdown_files(target_abs)
        excluded.update(scope_files)
        # --impl-prep runs before the spec is edited, so tier 0 is usually empty
        # and the plan-name signal is what keeps the real target in budget.
        scope_files = _prioritized(scope_files, target_abs)
        target_doc = format_file_bundle(scope_files, root, f"구현 대상 영역: `{target_path_rel}`")
        mode_label = f"구현 착수 전 검토 (--impl-prep, scope={target_path_rel})"

    elif args.impl_done:
        target_path_rel = args.impl_done
        target_abs = _require_target(args.impl_done, "--impl-done", want_dir=True)
        scope_files = collect_markdown_files(target_abs)
        excluded.update(scope_files)
        scope_files = _prioritized(scope_files, target_abs)
        spec_bundle = format_file_bundle(
            scope_files, root, f"구현 대상 spec 영역: `{target_path_rel}`"
        )
        diff_text = _collect_code_diff(diff_base, root)
        # The diff gets a boundary and a name of its own. Without them it rode on
        # the last spec file's chunk, so a budget cut took the whole tail — diff
        # included — and the omission notice named only the spec file. A checker
        # then judged "spec vs implementation" with no implementation in front of
        # it and no way to notice. Named, it is dropped like any other entry.
        diff_label = f"<git diff {diff_base}...HEAD -- code_areas>"
        if diff_text.strip():
            diff_section = (
                f"{_BUNDLE_FILE_SENTINEL}#### `{diff_label}`\n\n"
                f"```diff\n{_neutralize_sentinel(diff_text)}\n```\n"
            )
        else:
            diff_section = (
                f"{_BUNDLE_FILE_SENTINEL}#### `{diff_label}`\n\n"
                "(변경 없음 또는 git diff 실패 — base ref 가 fetch 되어 있는지 확인)\n"
            )
        # HEAD-basis notice goes FIRST so it survives target_doc truncation —
        # `truncate_file_bundle` drops whole chunks from the tail, and the notice
        # sits in the head section that is never a drop candidate — and the
        # checker reads the current-code SoT before anything else.
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

    # Same treatment for the two big supporting bundles. For `conventions` this
    # is the fix for the observed case where ~230 auto-generated catalog files
    # pushed every convention the target actually cites (error-codes / node-output
    # / swagger / secret-store / migrations / execution-context) out of budget.
    other_spec_files = _prioritized(other_spec_files)
    convention_files = _prioritized(convention_files)
    # `plan_in_progress` needs this most, not least: it is `plan_coherence`'s ONLY
    # corpus. Measured on this repo it is ~10x its own budget share, so the
    # alphabetical tail-drop is not an edge case there — it is the normal case,
    # and the 4th recurrence recorded in the ticket was exactly this bundle with
    # this checker. It was left out by oversight; nothing documents an exclusion.
    plan_files = _prioritized(plan_files)

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


# Context budget, split for the payload a checker ACTUALLY receives.
#
# The previous split gave five corpora a fixed share each — as if one prompt
# carried them all. It does not: `build_checker_prompt_body` sends `target_doc`
# plus exactly ONE corpus (three, for naming_collision), so roughly half the
# window was reserved for text that checker would never read, while the target
# was cut to fit 30%. Measured 2026-07-24 on `--impl-prep spec/2-navigation/`:
# the target bundle is 376,294 chars, the budget handed it 78,643, and **9 of
# the area's 18 files never reached any checker**. `--impl-prep` is a blocking
# gate whose `BLOCK: NO` is read as "the area was examined", so that is a wrong
# answer to the question the caller thinks they asked.
#
# Budgeting per checker roughly doubles the target's share without raising the
# window. It does not make everything fit — `spec/4-nodes/` alone is 858KB — which
# is why the other half of the fix is that truncation now NAMES what it dropped.
CHECKER_BUDGET_RATIO = {
    "target_doc": 0.60,
    "corpus": 0.40,
}

# Marks the block that lists files left out of a bundle. Public because the
# tests assert on it and because a checker prompt that silently loses this
# heading is the failure mode, not a cosmetic change.
OMITTED_FILES_HEADING = "### ⚠️ 컨텍스트 예산 초과로 생략된 파일"

# Splitting a rendered bundle back into per-file chunks needs a boundary that
# file CONTENT cannot produce. ``\n#### `` alone cannot: spec bodies legitimately
# carry level-4 headings with inline code, and `spec/5-system/5-expression-
# language.md` really does define `#### `$trigger``, `#### `$env``,
# `#### `_selectedPort``. Measured on `--impl-prep spec/5-system/`: the omission
# notice listed 21 entries of which **3 were not files at all** — those headings.
#
# The count being wrong was the visible half. The dangerous half is that one
# file split into several chunks, so "drop a whole file" could drop only the
# TAIL of one and leave the head presented as if complete — the exact property
# `test_consistency_context_budget` exists to guarantee.
#
# A heuristic cannot separate the two cases: the marker a spec writes and the
# marker we write are the same characters, and "the path has a slash" fails the
# moment a spec documents a file path in a heading. So we emit a sentinel of our
# own instead. It renders as nothing in markdown and is not something a document
# writes by accident.
_BUNDLE_FILE_SENTINEL = "\n<!-- @bundle-file -->\n"


def _omitted_notice(rels):
    """Tell the checker what it is missing and what to do about it.

    A checker cannot tell "this area does not mention X" from "the part that
    mentions X was cut", and it answers the first while believing it answered
    the second. Checkers have `Read`, so a named omission is a directed
    instruction; an unnamed one is a wrong verdict.
    """
    listed = "".join(f"\n- `{rel}`" for rel in rels)
    return (
        f"\n\n{OMITTED_FILES_HEADING} {len(rels)}개\n\n"
        "아래 파일의 **본문은 이 프롬프트에 포함되지 않았다**. 여기 없다는 사실을 "
        "\"해당 내용이 없다\" 의 근거로 삼지 말 것 — 판정에 관련되면 `Read` 로 직접 열어라."
        f"{listed}\n"
    )


def truncate_file_bundle(text, budget):
    """Fit a `format_file_bundle` payload into `budget`, dropping WHOLE files.

    Cutting on characters left the last surviving file ending mid-sentence while
    looking complete, and said only "truncated due to size limit" — so the
    reader could neither trust what was there nor know what was not. Dropping on
    file boundaries makes both answerable: what is present is whole, and what is
    absent is listed by path.

    A budget of 0 or negative means unlimited, matching
    `session.truncate_to_budget`, which this replaces for bundles. Text with no
    file markers (a single `--spec`/`--plan` document, or `--impl-done`'s diff
    section) falls back to that function.
    """
    if budget <= 0 or len(text) <= budget:
        return text

    head, sep, rest = text.partition(_BUNDLE_FILE_SENTINEL)
    if not sep:
        return session.truncate_to_budget(text, budget)

    chunks = [_BUNDLE_FILE_SENTINEL + part for part in rest.split(_BUNDLE_FILE_SENTINEL)]

    def rel_of(chunk):
        # `\n#### \`path\`\n` — the path is between the first pair of backticks.
        parts = chunk.split("`")
        return parts[1] if len(parts) > 1 else "?"

    kept, dropped = list(chunks), []
    # The notice grows as more files are dropped, so the fit has to be
    # re-checked after each one rather than reserved for up front — the naive
    # version overshoots exactly when it drops the most.
    while kept:
        notice = _omitted_notice([rel_of(c) for c in dropped]) if dropped else ""
        if len(head) + sum(len(c) for c in kept) + len(notice) <= budget:
            return head + "".join(kept) + notice
        dropped.insert(0, kept.pop())

    # Nothing fits. Report the omission anyway and clip it to the budget —
    # an empty area would be the worst outcome, since it reads as "no content".
    notice = _omitted_notice([rel_of(c) for c in dropped])
    return session.truncate_to_budget(head + notice, budget)


def _corpus_keys(checker_name):
    """Which context keys end up in this checker's prompt."""
    if checker_name == "naming_collision":
        return ("related_specs", "plan_in_progress", "conventions")
    key = CHECKER_INSTRUCTIONS.get(checker_name, {}).get("context_key")
    return (key,) if key else ()


def budget_substitutions(context, max_context_size, checker_name):
    """Fit one checker's payload into the window.

    Keys that checker does not read are emptied rather than truncated: leaving
    them populated is what made the target pay for corpora nobody would see.
    """
    out = {"mode": context["mode"], "target_path": context["target_path"]}
    keys = _corpus_keys(checker_name)

    if max_context_size <= 0:
        out["target_doc"] = context.get("target_doc", "")
        for key in keys:
            out[key] = context.get(key, "")
        return out

    out["target_doc"] = truncate_file_bundle(
        context.get("target_doc", ""),
        int(max_context_size * CHECKER_BUDGET_RATIO["target_doc"]),
    )
    if keys:
        share = int(max_context_size * CHECKER_BUDGET_RATIO["corpus"] / len(keys))
        for key in keys:
            out[key] = truncate_file_bundle(context.get(key, ""), share)
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

    invocations = []
    for checker in config["agents"]:
        prompt_path = os.path.join(prompts_dir, f"{checker}.md")
        output_path = os.path.join(session_dir, f"{checker}.md")
        # Budgeted per checker, not once for everyone: each prompt carries only
        # the corpus that checker reads, so sizing the target against all five
        # corpora was spending a window nobody occupied.
        body = build_checker_prompt_body(
            checker, budget_substitutions(context, config["max_context_size"], checker)
        )
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
                        help="git ref to diff against (default: origin/main). Used by --impl-done "
                             "for its code-diff section, and by ALL modes to rank the "
                             "context bundles (files this branch changed come first).")
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
