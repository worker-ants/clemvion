#!/usr/bin/env python3
"""Consistency Checker Orchestrator — prepare-only mode.

Modes:
  --spec <path>        스펙 초안 검토 (NERV 초안 본문을 둔 파일)
  --impl-prep <scope>  구현 착수 전 검토
  --impl-done <scope>  구현 완료 후 검토 — 대상 스펙 + 코드 diff(vs --diff-base) 를
                       함께 묶어 checker 가 사후 검증. 기본 diff-base = origin/main.
                       `--diff-base <ref>` 로 override.

<scope> 는 NERV 스펙 미러를 가리킨다(NERV 정본 전환 4e). 쉼표로 여럿을 준다. 항목은 NERV 키
(`CLE-ENG-SPECEVIDENCE`), 미러 영역 폴더(`spec/CLE-ENG/`), 미러 파일 중 하나다. 동결된 옛 트리
(`spec/<번호>-<영역>/` · `spec/conventions/`)는 받지 않는다. 대조 코퍼스도 미러다. 구현할 때
`pull.py --task` 로 받은 스펙이 미러에 있으므로 미러가 그 작업의 기준 버전이다.

  --focus <keys>       랭킹에서 앞세울 NERV 키(쉼표). 보통 클레임 scope 의 spec_ids.
  --diff-path <path>   `--impl-done` 구현 diff 의 경로(여럿이면 반복). 기본은 `code_areas`.
                       하네스만 바꾼 작업은 `--diff-path .claude` 처럼 준다.

`--impl-done` 은 미러 문서의 `## 구현 위치` 가 이 브랜치가 바꾼 파일을 덮으면 그 문서를 대상에
더한다. 옛 push 게이트의 spec-linked 검사가 하던 대조를 `--impl-done` 을 돌릴 때 되살린다. 강제는
아니다. NERV done 게이트는 consistency 라운드가 있고 통과했는지만 보고 어떤 문서를 대상으로 했는지는
보지 않는다.

The orchestrator no longer calls a model. It collects context, writes
per-checker prompt bodies plus a retry-state file, and prints the session
directory path on stdout. The main Claude session then invokes 5 checker
sub-agents via the `Agent` tool and decides BLOCK based on the
`consistency-summary` sub-agent's SUMMARY.md output. See
`.claude/skills/consistency-checker/SKILL.md` for the full procedure.
"""

import argparse
import fnmatch
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

# `block_integrity` holds the downgrade backstop (and the canonical checker list
# this file derives from); `retry_state` holds the `_retry_state.json` bookkeeping
# the three orchestrators share.
#
# `report_paths` is no longer imported here — it used to be, and the comment that
# described it outlived the import by one refactor. It is still the single rule
# for "did this agent leave a report", reached now through
# `retry_state.reconcile_state_with_disk`; the direct consumers are
# `code_review_orchestrator.py` and `.claude/tools/nerv_review_payload.py`.
from _shared import block_integrity as _block_integrity  # noqa: E402
from _shared import git_probe as _git_probe  # noqa: E402
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
        "output_dir": os.environ.get("CONSISTENCY_OUTPUT_DIR", "./.review/consistency"),
        "agents": agents,
        "max_context_size": int(os.environ.get("CONSISTENCY_MAX_CONTEXT_SIZE", "262144")),
    }


# ---------------------------------------------------------------------------
# State helpers (--summary-state / --update). The bodies used to mirror
# `code_review_orchestrator` by hand; they now delegate to
# `_shared/retry_state.py` (see the note above the delegations below).
# What stays local is this orchestrator's own CLI output shape — exposed as a
# CLI so main never has to Read _retry_state.json into its context.
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


# 경로 → 내용. `read_text_file` 이 한 실행 안에서 같은 파일을 두 번 읽지 않게 한다.
# 모듈 전역인 이유는 이 orchestrator 가 단명 CLI 라서다 — 프로세스가 곧 끝나므로
# 무효화 시점을 설계할 필요가 없고, 테스트는 `_READ_CACHE.clear()` 로 격리한다.
_READ_CACHE: dict[str, str] = {}


def read_text_file(path):
    """파일을 읽되 **한 실행 안에서는 한 번만** 읽는다 (백로그 §7).

    `collect_context` 는 미러 문서를 종류(`mirror_doc_type`) · 구현 위치 · 키 언급을 보려고 한 번
    읽고, 곧이어 `format_file_bundle` 이 같은 파일을 다시 읽는다. 처음 이 캐시를 둔 이유는 옛 plan
    코퍼스의 같은 이중 읽기였다(30개 430,929 bytes, ≈3.5ms). 호출부를 고쳐 없애는 것보다 읽기
    자체를 기억하는 편이 **다른 이중 읽기까지 함께** 닫는다.

    캐시가 안전한 이유: 이 orchestrator 는 세션을 준비하고 끝나는 **단명 CLI** 다. 한 실행
    안에서 같은 경로의 내용이 바뀌면 그건 입력이 도중에 바뀐 것이고, 그때 두 번째 읽기가
    첫 번째와 달라지는 편이 오히려 진단하기 어렵다 — 번들과 랭킹이 서로 다른 문서를 보게
    된다. 실패(권한·인코딩)도 그대로 기억한다: 같은 실행 안에서 두 번 시도해도 결과가
    달라질 이유가 없고, `debug_log` 가 두 번 우는 것만 막는다.
    """
    cached = _READ_CACHE.get(path)
    if cached is not None:
        return cached
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except Exception as e:
        debug_log(f"Failed to read {path}: {e}")
        text = ""
    _READ_CACHE[path] = text
    return text


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


# NERV 스펙 미러(`spec/CLE-*.md` · `spec/CLE-*/**` · `spec/README.md`, NERV 전환 단계 1).
# 전환 4e(NERV Task `CLE-T-VP5KDJ`)부터 검토 대상과 대조 코퍼스는 이 미러다. 동결된 옛 트리는
# 단계 5 에서 지우므로 대상으로도 코퍼스로도 쓰지 않는다. 같은 판정이 `pull.py` 와 frontend
# `spec-links.ts` 에도 있고, 세 곳이 같은 파일을 고르는지 `.claude/tests/test_nerv_mirror_pull.py` 의
# `MirrorPredicateParityTest` 가 본다.
_NERV_MIRROR_REL = re.compile(r"^(?:README\.md|CLE-[A-Z0-9-]+\.md|CLE-[A-Z0-9-]+/)")


def is_nerv_mirror(path, spec_dir):
    rel = os.path.relpath(os.path.abspath(path), os.path.abspath(spec_dir)).replace(os.sep, "/")
    return bool(_NERV_MIRROR_REL.match(rel))


def collect_markdown_files(root_dir, exclude_paths=None):
    if exclude_paths is None:
        exclude_paths = set()
    else:
        exclude_paths = {os.path.abspath(p) for p in exclude_paths}

    if not root_dir or not os.path.isdir(root_dir):
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


# NERV 키 문법. `pull.py` 의 `KEY_RE` 와 같다. 두 정규식을 이 한 문자열에서 만들고, 문법이 도구와 같은지는
# `test_nerv_mirror_pull.py` 의 `MirrorPredicateParityTest` 가 본다. 미러 파일 이름이 곧 키다.
_KEY_BODY = r"CLE-[A-Z0-9]+(?:-[A-Z0-9]+)*(?:--[A-Z0-9]+(?:-[A-Z0-9]+)*)*"
_MIRROR_KEY_RE = re.compile(_KEY_BODY)  # `fullmatch` 로만 쓴다
# 본문이 키를 부르는 자리. 더 긴 키의 앞부분(`CLE-ENG` ⊂ `CLE-ENG-MIGRATION`)과 미러 폴더 이름
# (`../CLE-ENG/…` 의 `CLE-ENG`)은 그 키의 언급이 아니다.
_KEY_MENTION_RE = re.compile(rf"(?<![A-Za-z0-9-])({_KEY_BODY})(?![A-Za-z0-9/-])")

# 대조 코퍼스에서 빼는 미러 영역. 리서치 문서는 요구사항을 정하지 않는다(`CLAUDE.md` 「정보 저장 위치」).
_NON_SPEC_AREAS = ("CLE-RESEARCH",)

# 미러 frontmatter 의 문서 종류. NERV 는 값을 JSON 인용 표기로 준다(`pull.py` docstring).
_FM_TYPE_RE = re.compile(r'^type:\s*"([^"\n]*)"\s*$', re.MULTILINE)
CONVENTION_TYPE = "convention"


def mirror_key(path):
    return os.path.splitext(os.path.basename(path))[0]


def _is_mirror_document(path, spec_dir):
    """`spec/<키>.md` 이거나 `spec/<키 폴더>/<키>.md` 인 파일. `pull.mirror_files` 와 같은 판정이다.

    `is_nerv_mirror` 는 미러 폴더 아래 전부를 미러 자리로 보는 느슨한 판정이라(옛 트리 검사에서 빼는
    용도) 하위 폴더 · 키가 아닌 이름까지 고른다. 대상 · 코퍼스는 도구가 쓴 파일만 읽는다."""
    if os.path.islink(path):
        return False
    parts = os.path.relpath(path, spec_dir).replace(os.sep, "/").split("/")
    if not _MIRROR_KEY_RE.fullmatch(mirror_key(path)):
        return False
    return len(parts) == 1 or (len(parts) == 2 and bool(_MIRROR_KEY_RE.fullmatch(parts[0])))


def collect_mirror_files(spec_dir):
    """미러 문서를 자연 순서로. 미러 안내 `README.md` 는 문서가 아니라서 뺀다."""
    return [p for p in collect_markdown_files(spec_dir) if _is_mirror_document(p, spec_dir)]


_FM_OPEN = "---\n"
_FM_CLOSE = "\n---\n"


def _split_frontmatter(text):
    """(frontmatter, 본문). 여는 줄이나 닫는 줄이 없으면 frontmatter 는 "" 이고 본문은 전체다."""
    if text.startswith(_FM_OPEN):
        end = text.find(_FM_CLOSE, len(_FM_OPEN))
        if end >= 0:
            return text[len(_FM_OPEN):end], text[end + len(_FM_CLOSE):]
    return "", text


def mirror_doc_type(path):
    """미러 frontmatter 의 `type`(vision · area · feature · design · convention …). 못 읽으면 ""."""
    m = _FM_TYPE_RE.search(_split_frontmatter(read_text_file(path))[0])
    return m.group(1) if m else ""


def _mirror_area(path, spec_dir):
    rel = os.path.relpath(path, spec_dir).replace(os.sep, "/")
    return rel.split("/", 1)[0] if "/" in rel else ""


def mentioned_keys(text, keys):
    """`text` 가 부르는 미러 키 중 `keys` 에 있는 것."""
    return {k for k in _KEY_MENTION_RE.findall(text or "") if k in keys}


def body_of(text):
    """미러 frontmatter 를 걷은 본문. 키 언급은 본문에서만 센다.

    frontmatter 의 `parent` · `ancestors` · `area` 는 모든 문서가 영역 문서와 비전을 부르는 것처럼
    만든다. 그 신호는 문서마다 같아서 순서를 가르지 못한다.
    """
    return _split_frontmatter(text)[1]


# --- `## 구현 위치` ---------------------------------------------------------------------
#
# NERV 로 옮긴 스펙은 옛 frontmatter `code:` 대신 본문 `## 구현 위치` 절에 구현 파일을 적는다. 2026-10-03
# 실측(`pull.mirror_files` 기준 미러 문서 181편): 136편에 이 절이 있고, 절 안 불릿 946개 중 931개가 백틱
# 경로로 시작한다. 옛 push 게이트는 `code:` 에 걸린 파일을 고친 브랜치에 `--impl-done` 을 요구했다.
# 전환 단계 2 에서 그 검사가 걷히며 보장의 단위가 파일에서 Task 로 바뀌었다(`CLE-ENG-SPECEVIDENCE`
# «NERV 이전 영향»). `--impl-done` 을 돌리면 바뀐 파일을 덮는 문서가 대상에 들어가 그 문서와 대조된다.
# 이 실행을 강제하는 것은 없다. NERV done 게이트는 Task 에 묶인 consistency 라운드가 있고 통과했는지만
# 보고 그 라운드가 어떤 문서를 대상으로 했는지는 보지 않는다.

_IMPL_HEADING_RE = re.compile(r"^## 구현 위치[ \t]*$", re.MULTILINE)
_SECTION_END_RE = re.compile(r"^#{1,2}\s", re.MULTILINE)
_BACKTICK_RE = re.compile(r"`([^`\n]+)`")
_LINE_SUFFIX_RE = re.compile(r":\d+(?:[-~]\d+)?$")
_GLOB_CHARS = frozenset("*?[")


def impl_location_patterns(text, root, spec_rel="spec"):
    """`## 구현 위치` 절이 백틱으로 적은 저장소 경로 · glob.

    첫 경로 조각이 저장소 최상위 폴더(`codebase` · `scripts` · `.github` · `.claude` …)인 것만 센다.
    함수 이름 · 식별자(`recoverStuckExecutions`)와 스펙 미러 자신은 경로가 아니다. 줄 번호 접미
    (`a.ts:12`)는 걷는다.
    """
    m = _IMPL_HEADING_RE.search(text or "")
    if not m:
        return []
    rest = text[m.end():]
    end = _SECTION_END_RE.search(rest)
    section = rest[: end.start()] if end else rest
    out = []
    for token in _BACKTICK_RE.findall(section):
        token = _LINE_SUFFIX_RE.sub("", token.strip())
        token = token[2:] if token.startswith("./") else token
        if not token or " " in token or "/" not in token:
            continue
        first = token.split("/", 1)[0]
        if not first or first == spec_rel or not os.path.isdir(os.path.join(root, first)):
            continue
        out.append(token)
    return out


def impl_pattern_matches(pattern, rel):
    """구현 위치 항목 하나가 저장소 상대 경로 `rel` 을 덮는가.

    - `dir/` · `dir/**`: 그 아래 전부
    - glob(`*` `?` `[`): `fnmatch`. `*` 가 `/` 도 넘으므로 실제보다 넓게 맞는다. 넓은 쪽 오류는 문서를
      하나 더 싣는 비용이고, 좁은 쪽 오류는 대조를 빠뜨린다.
    - 그 밖: 같은 파일이거나 그 폴더 아래
    """
    if pattern.endswith("/"):
        return rel.startswith(pattern)
    if pattern.endswith("/**"):
        return rel.startswith(pattern[:-2])
    if _GLOB_CHARS & set(pattern):
        return fnmatch.fnmatchcase(rel, pattern)
    return rel == pattern or rel.startswith(pattern + "/")


def docs_covering_changes(files, changed_rels, root, spec_rel="spec"):
    """`## 구현 위치` 가 `changed_rels` 중 하나라도 덮는 문서 → `{경로: [덮인 파일, …]}`.

    스펙 미러 자신의 변경은 구현 변경이 아니라서 보지 않는다.
    """
    prefix = spec_rel.rstrip("/") + "/"
    code_changed = sorted(r for r in changed_rels if not r.startswith(prefix))
    if not code_changed:
        return {}
    hits = {}
    for path in files:
        patterns = impl_location_patterns(read_text_file(path), root, spec_rel)
        if not patterns:
            continue
        matched = [r for r in code_changed if any(impl_pattern_matches(p, r) for p in patterns)]
        if matched:
            hits[path] = matched
    return hits


def _branch_changed_rels(diff_base, root):
    """Repo-relative paths this branch touched, as a set. Empty on any failure.

    Whole-repo on purpose: `collect_context` calls this ONCE and every bundle
    reads the same set.

    The git call itself now lives in `_shared/git_probe.branch_diff_files`,
    shared verbatim with `code_review_orchestrator.get_git_branch_diff_files`.
    The two used to be kept in step by a "change both" comment on each and had
    already drifted — see that function's docstring for the measurements. What
    stays here is this orchestrator's own contract: a **set**, and a `debug_log`
    on failure.
    """
    return set(_git_probe.branch_diff_files(
        diff_base, root,
        on_error=lambda reason: debug_log(f"branch-changed diff failed: {reason}"),
    ))


def _edited_rels(diff_base, root):
    """Files this task touched — committed on the branch OR still uncommitted.

    Ranking needs both, and the committed half alone is blind exactly when it
    matters: `--impl-prep` runs before the work lands, so what it is about is
    often uncommitted. Measured 2026-08-10: an uncommitted edit ranked 8th of 18
    inside a directory's drop zone — the reported "the bundle drops the document
    being reviewed" symptom.

    The union is deliberate rather than a replacement: a branch that already
    committed its edits keeps its tier-0 signal after `git commit`, which a
    working-tree-only probe would lose.
    """
    return _branch_changed_rels(diff_base, root) | set(
        _git_probe.worktree_changed_files(
            root,
            on_error=lambda reason: debug_log(f"worktree status failed: {reason}"),
        )
    )


def prioritize_bundle_files(
    file_paths, root, *, changed_rels=(), focus_rels=(), mentioned_rels=()
):
    """Order a bundle so the documents this task is actually about survive truncation.

    `truncate_file_bundle` drops whole files from the TAIL, so order decides
    which files a checker never sees. Ordering by name alone is how the work
    target lost its budget to alphabetically earlier files, eight times across
    separate sessions — twice the checkers had no coverage of the target at all,
    so `BLOCK: NO` meant "never looked", not "looks fine".

    Tiers (stable, natural order inside each — see `_natural_key`):
      0. changed by this branch — a pulled spec is the work's own basis
      1. named by the task — `--focus` keys (the claim's scope) and, for
         `--impl-done`, documents whose `## 구현 위치` covers a changed file
      2. mentioned by the target documents (a key in their text)
      3. everything else

    The plan-name tiers this replaced read `plan/in-progress/**`, which left the
    repository in NERV cutover stage 3. Tier 1 is their successor: the task's
    own statement of what it targets, now the claim's `spec_ids`.

    Reordering only. Nothing is dropped here; what does not fit is still dropped
    by `truncate_file_bundle`, which names the omissions.
    """
    changed, focus, mentioned = set(changed_rels), set(focus_rels), set(mentioned_rels)

    def tier(path):
        rel = os.path.relpath(path, root) if root else path
        if rel in changed:
            return 0
        if rel in focus:
            return 1
        if rel in mentioned:
            return 2
        return 3

    return sorted(file_paths, key=lambda p: (tier(p), _natural_key(p)))


def _splice_chunk(bundle, chunk, after_n):
    """Insert `chunk` after the first `after_n` file chunks of `bundle`.

    Splitting on the same sentinel `truncate_file_bundle` drops on is what makes
    the insert land on a real boundary — anything else could split a file body
    and hand the truncator a chunk that is half of one file and half of another.

    An empty bundle (`(없음)`) has no sentinel and no chunks; appending is then
    the only placement, and it is also the right one.
    """
    head, sep, rest = bundle.partition(_BUNDLE_FILE_SENTINEL)
    if not sep:
        return bundle + chunk
    chunks = [_BUNDLE_FILE_SENTINEL + part for part in rest.split(_BUNDLE_FILE_SENTINEL)]
    return head + "".join(chunks[:after_n]) + chunk + "".join(chunks[after_n:])


def format_file_bundle(file_paths, root, label):
    if not file_paths:
        return f"### {label}\n(없음)\n"
    parts = [f"### {label}\n"]
    for path in file_paths:
        rel = os.path.relpath(path, root) if root else path
        content = _neutralize_sentinel(read_text_file(path))
        parts.append(f"{_BUNDLE_FILE_SENTINEL}#### `{rel}`\n```\n{content}\n```\n")
    return "".join(parts)


# API 카탈로그의 필드 문서(`codebase/api-catalogs/<vendor>/<resource>/**/*.md`, 전환 4a 에서 옮겼다).
# 생성기가 만드는 참조 덤프라 정식 스펙이 아니다(`CLE-ENG-SPECEVIDENCE` R-7). 최상위 색인
# `<vendor>/<resource>.md` 와 생성기 입력 데이터(MakeShop `openapi/*.openapi.json`)는 남긴다. 카탈로그를
# 다시 생성한 PR 은 필드 문서 수백 개를 바꾸므로 구현 diff 에 실으면 그 예산을 다 쓴다. diff 에서 빼고
# 실제로 뺀 수만 census 에 적는다.
CATALOG_FIELD_GLOB = "codebase/api-catalogs/*/*/**/*.md"
_CATALOG_FIELD_RE = re.compile(r"^codebase/api-catalogs/[^/]+/[^/]+/(?:.*/)?[^/]*\.md$")


def is_catalog_field_file(rel):
    return bool(_CATALOG_FIELD_RE.match(rel))


def _collect_code_diff(diff_base, root, paths=None):
    """Return ``git diff <diff_base>...HEAD`` for the given paths (default: code areas).

    Used by ``--impl-done`` to bundle the implementation diff alongside the
    target specs so checkers can compare both sides. Empty string on any
    failure (missing base ref, no diff, git error). Catalog field files are
    left out (`CATALOG_FIELD_GLOB`).

    THREE-DOT on purpose (harness-consistency-bundler-budget §H residual): ``A...B``
    diffs against ``merge-base(A, B)``, so when ``diff_base`` (e.g. a freshly
    fetched ``origin/main``) has advanced PAST this branch's fork point, changes
    that landed on the base but not here do NOT appear as reverse deletions. A
    two-dot ``git diff origin/main HEAD`` would inject that noise and let a
    checker read code the branch never touched as "removed". Do not switch to
    two-dot.
    """
    if not paths:
        cfg = project_config.load(root)
        paths = cfg.get("code_areas") or []
    pathspecs = list(paths) + [f":(exclude,glob){CATALOG_FIELD_GLOB}"]
    # Through `_shared/git_probe`, not a private `subprocess.run`. The private
    # copy decoded with plain `text=True`, so an undecodable byte anywhere in
    # the diff body raised `UnicodeDecodeError` — a `ValueError`, which the old
    # `except (OSError, TimeoutExpired)` did not catch — and the crash escaped
    # this function's own "empty on failure" contract. The shared probe already
    # carried `errors="surrogateescape"` for exactly that; this call site was
    # the sibling that never got it.
    return _git_probe.diff_text(
        diff_base, root, pathspecs,
        on_error=lambda reason: debug_log(f"git diff for --impl-done failed: {reason}"),
    )


def _catalog_files_left_out(diff_base, root, paths=None):
    """`_collect_code_diff` 가 같은 경로에서 뺀 카탈로그 필드 문서 수. git 이 실패하면 0.

    census 의 수는 diff 에서 실제로 뺀 파일이어야 한다. 저장소 전체 변경에서 세면 diff 경로 밖이나
    커밋하지 않은 카탈로그 변경까지 "뺐다" 고 적는다."""
    if not paths:
        paths = project_config.load(root).get("code_areas") or []
    try:
        rc, out, _err = _git_probe._run_git_raw(
            ["diff", "--no-renames", "--name-only", f"{diff_base}...HEAD", "--", *paths],
            root, timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001 — census 보조 수치라 실패해도 0 으로 둔다
        debug_log(f"catalog count for --impl-done failed: {type(exc).__name__}: {exc}")
        return 0
    if rc != 0:
        return 0
    return sum(1 for line in out.split("\n") if line and is_catalog_field_file(line))


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


#: `_scope_delta_census` 가 나열하는 경로 목록의 상한. 넘으면 "… 외 N건" 으로 접는다.
#: head 구역은 절단 대상이 아니므로(그게 census 의 존재 이유다) 여기서 스스로 유계화해야
#: 한다 — 대형 scope 에서 수백 줄이 본문 예산을 잠식하는 것을 막는다.
_SCOPE_HITS_DISPLAY_LIMIT = 20
# 구현 위치 대조로 더한 문서마다 census 에 보이는 덮인 파일 수. 나머지는 수로만 적는다.
_COVERING_FILES_SHOWN = 3


def _count_diff_files(diff_text):
    """Number of files in a unified diff — `diff --git` headers, not `+++` lines.

    `+++` would double-count nothing but miscount renames and `/dev/null`
    entries; the `diff --git` header is emitted exactly once per file.
    """
    if not diff_text:
        return 0
    return diff_text.count("\ndiff --git ") + (
        1 if diff_text.startswith("diff --git ") else 0
    )


def _folded(items):
    """`- \`x\`` 줄들. `_SCOPE_HITS_DISPLAY_LIMIT` 를 넘으면 정확한 나머지 수로 접는다."""
    shown = "".join(f"    - {x}\n" for x in items[:_SCOPE_HITS_DISPLAY_LIMIT])
    if len(items) > _SCOPE_HITS_DISPLAY_LIMIT:
        shown += f"    - … 외 {len(items) - _SCOPE_HITS_DISPLAY_LIMIT}건\n"
    return shown


def _scope_delta_census(root, scope_rels, changed_rels, diff_text, *,
                        covering=None, catalog_skipped=0):
    """``--impl-done`` head census: what delta EXISTS, measured before budgeting.

    Root cause this guards against (re-observed 2026-08-06 across three
    sessions): the implementation diff is a named chunk in the BODY, so
    `truncate_file_bundle` can drop its content while the label survives.
    Measured then: 15 prompts (5 checkers x 3 sessions) with ` ```diff ` fences
    = 0 and the 28 changed files appearing 0 times — five checkers judged "spec
    vs implementation" having seen no implementation, and one misdiagnosed the
    surviving label as an unsubstituted placeholder.

    A census in the body would be dropped by the same cut. This block is
    concatenated into the HEAD section, which `truncate_file_bundle` never
    treats as a drop candidate, so the checker can always tell **"the diff was
    cut"** apart from **"there is no diff"** — two states that look identical
    from inside a truncated prompt and lead to opposite conclusions.

    It also states the target-side delta. A branch that legitimately changes
    code only (spec delta 0) has been read as *"the review premise is void"* and
    reported CRITICAL, with the same input producing YES/NO in four rounds.
    Naming the number, with its meaning, removes the inference.

    `covering` lists the documents `--impl-done` added because their
    `## 구현 위치` covers a changed file, with the files that matched. A
    checker that does not know why a document is in its target reads it as the
    task's own scope. Documents the caller already put in the scope are not
    listed: they were not added, and saying so would invert the reason.
    """
    scope = set(scope_rels)
    scope_hits = sorted(r for r in changed_rels if r in scope)
    diff_files = _count_diff_files(diff_text)
    diff_lines = diff_text.count("\n") if diff_text.strip() else 0

    if scope_hits:
        scope_line = (
            f"- **대상 스펙 델타: {len(scope_hits)}개 파일** — 이 브랜치가 받은(pull) 스펙이다\n"
            + _folded([f"`{r}`" for r in scope_hits])
        )
    else:
        scope_line = (
            "- **대상 스펙 델타: 0개 파일** — 이 브랜치는 대상 스펙의 미러를 바꾸지 않았다. "
            "**이것은 정상이며 검토 전제가 무효라는 뜻이 아니다** "
            "(코드 전용 PR 이면 스펙 델타 0이 당연하다). 델타 0 자체를 근거로 "
            "CRITICAL 을 내지 말 것.\n"
        )

    covering_line = ""
    if covering:
        rows = []
        for rel in sorted(covering):
            files = covering[rel]
            more = f" 외 {len(files) - _COVERING_FILES_SHOWN}개" if len(files) > _COVERING_FILES_SHOWN else ""
            rows.append(f"`{rel}` ← {', '.join(f'`{f}`' for f in files[:_COVERING_FILES_SHOWN])}{more}")
        covering_line = (
            f"- **구현 위치 대조로 더한 문서: {len(covering)}개** — 각 문서의 `## 구현 위치` 가 이 "
            "브랜치가 바꾼 파일을 덮는다. 그 파일의 변경이 문서와 맞는지 본다.\n"
            + _folded(rows)
        )

    if diff_files:
        diff_line = (
            f"- **구현 diff: {diff_files}개 파일 / {diff_lines}줄** — 아래 "
            "`## 구현 변경 사항` 에 실려야 한다.\n"
            "  - **아래에 diff 본문이 보이지 않으면 그것은 \"구현이 없다\" 가 아니라 "
            "\"예산에 잘렸다\" 는 뜻이다.** 그 경우 구현 유무를 이 프롬프트로 판정하지 말고, "
            f"위 워킹트리를 절대경로로 직접 읽어라 (`git -C \"{root}\" diff` 등).\n"
        )
    else:
        diff_line = (
            "- **구현 diff: 0개 파일** — diff 경로에 변경이 없거나 git diff 가 실패했다"
            "(base ref fetch 여부 확인). 스펙 전용 PR 이면 정상이다.\n"
        )
    if catalog_skipped:
        diff_line += (
            f"  - API 카탈로그 필드 파일 {catalog_skipped}개의 변경은 diff 에서 뺐다"
            f"(`{CATALOG_FIELD_GLOB}`, 생성된 참조 덤프). 필요하면 워킹트리에서 직접 읽는다.\n"
        )

    return (
        "### 이 검토가 실제로 다루는 델타 (예산 절단 전 실측)\n\n"
        + scope_line
        + covering_line
        + diff_line
        + "\n"
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


def _usage_exit(flag, value, problem, hint=""):
    """대상 인자 오류. 세션을 만들기 전에 exit 2 로 멈춘다.

    모든 대상 인자는 checker 프롬프트의 `## Target 문서 / 경로:` 에 그대로 들어간다. 경로가 아닌 값이
    통과하면 번들이 `(없음)` 이 되고 checker 가 그 빈 입력을 CRITICAL 로 보고한다 — 실제 충돌 0건의
    BLOCK: YES 다(2026-07-17 실측, 5 checker fan-out 한 번을 쓰고 나서야 드러났다).
    """
    sys.stderr.write(
        f"Error: {flag} 의 인자 — {problem}{hint}\n"
        f"  받은 값: {value!r}\n"
        f"\n사용법:\n"
        f"  --spec <파일>                  예) --spec <scratchpad>/CLE-XXX-FOO.md (NERV 초안 본문)\n"
        f"  --impl-prep <scope>            예) --impl-prep CLE-ENG-SPECEVIDENCE,CLE-API-SWAGGER\n"
        f"  --impl-done <scope>            예) --impl-done spec/CLE-ENG/\n"
        f"  scope 항목: NERV 키 · 미러 영역 폴더(spec/CLE-…/) · 미러 파일. 쉼표로 여럿.\n"
    )
    sys.exit(2)


def _prose_hint(value):
    # 저장소 경로와 NERV 키에는 공백이 없다. 공백이 있으면 거의 언제나 설명문이 들어온 것이다.
    if " " in value.strip() or "\n" in value:
        return (
            "\n  → 설명문을 넣은 것 같습니다. 이 인자는 **경로 · 키만** 받습니다.\n"
            "     작업 배경·수정 계획은 NERV Task 에 적습니다(nerv_task_update ·\n"
            "     heartbeat progress). 이 인자에는 검토할 경로 · 키만 줍니다."
        )
    return ""


def _require_file(value, flag):
    path = os.path.abspath(value)
    if os.path.isfile(path):
        return path
    if os.path.isdir(path):
        _usage_exit(flag, value, "파일이 아니라 디렉토리다.")
    _usage_exit(flag, value, "실존하는 파일 경로가 아니다.", _prose_hint(value))


def resolve_scope(value, flag, spec_dir, by_key, root):
    """`--impl-prep` · `--impl-done` 의 SCOPE → 미러 문서 절대 경로(자연 순서, 중복 없음).

    항목은 쉼표로 나눈다. NERV 키, 미러 영역 폴더, 미러 파일 중 하나다. 옛 트리는 동결됐고(전환 단계
    5 에서 지운다) 대조 코퍼스가 미러라서 받지 않는다. 옛 트리를 대상으로 미러와 대조하면 같은 내용의
    다른 판끼리 부딪친다.
    """
    items = [x.strip() for x in (value or "").split(",") if x.strip()]
    if not items:
        _usage_exit(flag, value, "비어 있다.")
    mirror_set = set(by_key.values())
    out = []
    for item in items:
        if _MIRROR_KEY_RE.fullmatch(item):
            path = by_key.get(item)
            if path is None:
                _usage_exit(flag, value, f"미러에 없는 키다 — {item}",
                            "\n  → `pull.py --task <Task> --spec <키>` 로 받았는지 확인한다.")
            out.append(path)
            continue
        # 상대 경로는 저장소 루트 기준이다(CLI 에서는 루트가 곧 작업 디렉터리다).
        path = os.path.abspath(item if os.path.isabs(item) else os.path.join(root, item))
        if not os.path.exists(path):
            _usage_exit(flag, value, f"실존하는 경로도 NERV 키도 아니다 — {item}", _prose_hint(item))
        # `is_nerv_mirror` 는 폴더를 `CLE-…/` 모양으로 알아본다. `abspath` 가 끝 `/` 를 걷으므로 폴더면
        # 다시 붙인다(파일 하나를 폴더 안에 넣어 판정하면 빈 폴더를 놓친다).
        rel_item = os.path.relpath(path, spec_dir).replace(os.sep, "/")
        if os.path.isdir(path):
            rel_item += "/"
        if not _NERV_MIRROR_REL.match(rel_item) or rel_item.startswith("../"):
            _usage_exit(
                flag, value, f"NERV 스펙 미러가 아니다 — {item}",
                "\n  → 옛 트리(spec/<번호>-<영역>/ · spec/conventions/)는 동결됐다. 미러 경로"
                "\n     (spec/CLE-…/) 나 NERV 키를 준다.",
            )
        if os.path.isdir(path):
            found = [p for p in collect_markdown_files(path) if p in mirror_set]
            if not found:
                _usage_exit(flag, value, f"미러 문서가 없는 폴더다 — {item}")
            out.extend(found)
        elif path in mirror_set:
            out.append(path)
        else:
            _usage_exit(flag, value, f"미러 문서가 아니다 — {item}")
    seen, ordered = set(), []
    for p in out:
        if p not in seen:
            seen.add(p)
            ordered.append(p)
    return sorted(ordered, key=_natural_key)


def resolve_focus(value, by_key):
    """`--focus` 키 목록 → 미러 파일. 미러에 없는 키는 오류다(오타가 랭킹을 조용히 바꾸지 않게)."""
    items = [x.strip() for x in (value or "").split(",") if x.strip()]
    out = []
    for key in items:
        if key not in by_key:
            _usage_exit("--focus", value, f"미러에 없는 NERV 키다 — {key}")
        out.append(by_key[key])
    return out


def collect_context(args, root):
    cfg = project_config.load(root)
    spec_rel = cfg["corpora"]["spec"].rstrip("/")
    spec_dir = os.path.join(root, spec_rel)

    # One diff base for the whole function — `--impl-done` reads it again below
    # for its diff section, and two variables computing the same expression is
    # how they drift apart later.
    diff_base = args.diff_base or "origin/main"

    mirror = collect_mirror_files(spec_dir)
    by_key = {mirror_key(p): p for p in mirror}
    focus_files = resolve_focus(getattr(args, "focus", None), by_key)

    # The WHOLE-repo change set, resolved once. Every bundle ranks against it.
    rank_changed = _edited_rels(diff_base, root)

    def rel(path):
        return os.path.relpath(path, root)

    target_files = []      # mirror docs that ARE the target (impl modes)
    covering = {}          # --impl-done: doc → changed files its `## 구현 위치` covers
    added = {}             # --impl-done: the covering docs that were not already in the scope
    target_text = ""
    rationale_extra = []   # --spec: the current mirror version of the draft's key

    if args.spec:
        target_path_rel = args.spec
        target_abs = _require_file(args.spec, "--spec")
        target_text = body_of(read_text_file(target_abs))
        target_doc = _neutralize_sentinel(read_text_file(target_abs))
        mode_label = "스펙 초안 검토 (--spec)"
        # A draft named after its key replaces that key's mirror version. Comparing
        # the draft with its own previous text reads every edit as a conflict, so
        # the old version leaves the corpora — but its Rationale stays, because a
        # draft that drops a past decision is exactly what rationale continuity is for.
        same_key = by_key.get(mirror_key(target_abs))
        if same_key:
            rationale_extra = [same_key]

    elif args.impl_prep or args.impl_done:
        flag = "--impl-prep" if args.impl_prep else "--impl-done"
        target_path_rel = args.impl_prep or args.impl_done
        target_files = resolve_scope(target_path_rel, flag, spec_dir, by_key, root)
        if args.impl_done:
            covering = docs_covering_changes(mirror, rank_changed, root, spec_rel)
            added = {p: files for p, files in covering.items() if p not in target_files}
            target_files += sorted(added, key=_natural_key)
        target_text = "\n".join(body_of(read_text_file(p)) for p in target_files)

    else:
        raise ValueError(
            "Mode 가 지정되지 않았습니다: --spec / --impl-prep / --impl-done 중 하나가 필요합니다."
        )

    target_set = set(target_files) | (set(rationale_extra) if args.spec else set())
    focus_rels = {rel(p) for p in focus_files} | {rel(p) for p in covering}
    mentioned_rels = {
        rel(by_key[k]) for k in mentioned_keys(target_text, by_key)
        if by_key[k] not in target_set
    }

    def ranked(files):
        return prioritize_bundle_files(
            files, root, changed_rels=rank_changed, focus_rels=focus_rels,
            mentioned_rels=mentioned_rels,
        )

    if target_files:
        target_files = ranked(target_files)
        bundle = format_file_bundle(target_files, root, f"검토 대상 스펙: `{target_path_rel}`")

    if args.impl_prep:
        target_doc = bundle
        mode_label = f"구현 착수 전 검토 (--impl-prep, scope={target_path_rel})"

    elif args.impl_done:
        diff_paths = getattr(args, "diff_paths", None) or None
        diff_text = _collect_code_diff(diff_base, root, diff_paths)
        # The diff gets a boundary and a name of its own. Without them it rode on
        # the last spec file's chunk, so a budget cut took the whole tail — diff
        # included — and the omission notice named only the spec file. A checker
        # then judged "spec vs implementation" with no implementation in front of
        # it and no way to notice. Named, it is dropped like any other entry.
        shown_paths = " ".join(diff_paths or cfg.get("code_areas") or [])
        diff_label = f"<git diff {diff_base}...HEAD -- {shown_paths}>"
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
        # The diff goes after the ON-TOPIC documents (tier 0/1) and BEFORE the
        # rest. Appended at the end it was the last chunk and therefore the FIRST
        # one dropped: measured 2026-08-09 on a 1,215,279 B folder dump, the diff
        # was omitted at every budget tried, so five checkers judged "spec vs
        # implementation" having seen no implementation.
        on_topic = 0
        for path in target_files:
            if rel(path) in rank_changed or rel(path) in focus_rels:
                on_topic += 1
            else:
                break
        catalog_skipped = _catalog_files_left_out(diff_base, root, diff_paths)
        # HEAD-basis notice and census go FIRST: `truncate_file_bundle` never
        # drops the head section, so the checker always reads the current-code
        # SoT and the measured delta before anything else.
        target_doc = (
            _head_basis_notice(root, diff_base)
            + _scope_delta_census(
                root, [rel(p) for p in target_files], rank_changed, diff_text,
                covering={rel(p): files for p, files in added.items()},
                catalog_skipped=catalog_skipped,
            )
            + _splice_chunk(bundle, diff_section, on_topic)
        )
        mode_label = (
            f"구현 완료 후 검토 (--impl-done, scope={target_path_rel}, "
            f"diff-base={diff_base})"
        )

    corpus = [
        p for p in mirror
        if p not in target_set and _mirror_area(p, spec_dir) not in _NON_SPEC_AREAS
    ]
    convention_files = ranked([p for p in corpus if mirror_doc_type(p) == CONVENTION_TYPE])
    other_spec_files = ranked([p for p in corpus if mirror_doc_type(p) != CONVENTION_TYPE])

    return {
        "mode": mode_label,
        "target_path": target_path_rel,
        "target_doc": target_doc,
        "related_specs": format_file_bundle(other_spec_files, root, "관련 스펙 본문 (NERV 미러)"),
        "rationale_excerpts": extract_rationale_sections(rationale_extra + other_spec_files, root),
        "conventions": format_file_bundle(
            convention_files, root, "정식 규약 (NERV 미러, type=convention)"),
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
    file markers (a single `--spec` document, or `--impl-done`'s diff
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

    def stub_of(chunk):
        """드롭된 청크가 **있던 자리**에 남기는 표식.

        말미 이름 목록만으로는 "예산에 잘렸다" 와 "조립이 실패해 placeholder 가 남았다"
        가 구분되지 않는다 — 실제로 한 checker 가 살아남은 이름표(`<git diff ...>`)를
        "미치환 placeholder" 로 **오진해 CRITICAL 을 냈다**(2026-08-06). 자리에 잘린
        사실과 원래 크기가 남아 있으면 그 오진이 불가능하다.

        표식이 자기가 대체하는 청크보다 **크면 빈 문자열**을 준다. 그 경우 표식을 남기는
        게 본문을 남기는 것보다 비싸서, 드롭이 총량을 오히려 **늘린다** — 루프가 역행해
        결국 아무것도 안 맞는 fallback 으로 떨어진다. 이름은 말미 목록이 SoT 이므로
        표식을 생략해도 "kept-whole 아니면 named" 보장은 유지된다.
        """
        stub = (
            f"{_BUNDLE_FILE_SENTINEL}#### `{rel_of(chunk)}`\n\n"
            f"> ⚠️ **본문 생략됨 — 컨텍스트 예산 초과** (원래 {len(chunk):,} 자). "
            "조립 실패가 아니라 **의도된 절단**이다.\n"
        )
        return stub if len(stub) < len(chunk) else ""

    kept, dropped = list(chunks), []
    dropped_rels, dropped_stubs = [], []
    # Running totals, not re-derived sums. The fit HAS to be re-checked after
    # every drop — the notice and the stubs both grow as more files go, so a
    # budget reserved up front overshoots exactly when it drops the most — but
    # the naive form recomputed `sum(len(c) for c in kept)` and re-rendered
    # every stub on each pass, which is quadratic. Measured before this change:
    # doubling the chunk count multiplied the time by 3.9-4.0x (64/128/256/512
    # chunks → 1.7/6.9/26.9/105.9 ms), and the real `spec/conventions` bundle
    # (270 chunks, 2.6 MB) took 688 ms — per corpus, per checker. After: the
    # same bundle takes 26.7 ms.
    #
    # It is NOT linear even now, and saying so is cheaper than pretending: the
    # ratio is ~3.2x per doubling because `_omitted_notice` still re-renders the
    # whole name list every pass. Making that incremental means computing the
    # rendered length without rendering, i.e. a second copy of the notice's
    # format — the drift trap this repo keeps paying for. 26.7 ms on the largest
    # real bundle does not buy that risk.
    kept_len = sum(len(c) for c in chunks)
    stubs_len = 0
    while kept:
        notice = _omitted_notice(dropped_rels) if dropped_rels else ""
        if len(head) + kept_len + stubs_len + len(notice) <= budget:
            # 드롭은 항상 꼬리에서 일어나므로 dropped 는 연속된 suffix 다 — kept 뒤에
            # 이어 붙이는 것이 곧 "있던 자리" 다.
            return head + "".join(kept) + "".join(dropped_stubs) + notice
        victim = kept.pop()
        kept_len -= len(victim)
        stub = stub_of(victim)
        stubs_len += len(stub)
        dropped_stubs.insert(0, stub)
        dropped_rels.insert(0, rel_of(victim))
        dropped.insert(0, victim)

    # Nothing fits. Report the omission anyway and clip it to the budget —
    # an empty area would be the worst outcome, since it reads as "no content".
    notice = _omitted_notice([rel_of(c) for c in dropped])
    return session.truncate_to_budget(head + notice, budget)


def _corpus_keys(checker_name):
    """Which context keys end up in this checker's prompt."""
    if checker_name == "naming_collision":
        return ("related_specs", "conventions")
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
        # naming_collision combines two sub-corpora (the plan corpus left in NERV
        # cutover stage 3; work in progress is a NERV Task, not a file).
        return "\n\n".join([
            subs.get("related_specs", ""),
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


def _preserve_spec_draft(session_dir, context):
    """`--spec` 의 target draft 원본을 세션 산출물로 남긴다.

    **draft 는 임시 파일이 아니라 산출물이다** — `developer` 가 `spec/` 을 직접 못 고치는
    CLAUDE.md 경계는 "planner 턴을 밟았다" 로만 정당화되고, draft 가 그 유일한 증거다.
    그런데 planner 턴 끝에 draft 를 지우는 일이 두 턴 연속 벌어졌고(`#1242`·`#1243`),
    머지된 뒤 main 이 **존재하지 않는 파일**을 6곳에서 인용하는 상태가 됐다
    (ai-review `19_26_58` requirement W1).

    복원은 두 번 다 `_prompts/*.md` 의 코드펜스에서 원문을 떠서 했다. 그건 **부수 효과**다 —
    프롬프트는 예산에 따라 `truncate_file_bundle` 로 **잘리고**(`budget_substitutions`),
    포맷이 바뀌면 사라진다. 우연히 남던 것을 계약으로 바꾼다.

    **차단하지 않는다.** 이 저장소는 push 가드를 정밀화했다가 3라운드 회귀 끝에 철회한
    이력이 있다(`#970`) — "유한한 문제를 무한한 문제와 바꾸지 말 것". 여기서 고르는 것은
    *증거 보존*이다. 지금 초안의 정본은 NERV 버전이고 이 사본은 로컬 세션의 증거로만 남는다.

    Returns: 남긴 파일의 세션 상대 경로, 또는 `--spec` 이 아니거나 읽지 못하면 `None`.
    """
    target_rel = context.get("target_path") or ""
    if "--spec" not in (context.get("mode") or ""):
        return None
    if not target_rel:
        return None

    src = target_rel if os.path.isabs(target_rel) else os.path.join(repo_root(), target_rel)
    try:
        with open(src, "r", encoding="utf-8") as f:
            body = f.read()
    except OSError as exc:  # 읽기 실패가 세션 준비를 막지는 않는다.
        debug_log(f"spec draft 보존 실패({target_rel}): {exc}")
        return None

    snapshot_dir = os.path.join(session_dir, "_target")
    os.makedirs(snapshot_dir, exist_ok=True)
    dest = os.path.join(snapshot_dir, os.path.basename(target_rel))
    with open(dest, "w", encoding="utf-8") as f:
        f.write(body)
    return os.path.relpath(dest, session_dir)


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

    preserved = _preserve_spec_draft(session_dir, context)

    meta = {
        "timestamp": datetime.now().isoformat(),
        "mode": context["mode"],
        "target_path": context["target_path"],
        "checkers": config["agents"],
    }
    if preserved:
        meta["target_snapshot"] = preserved
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
                      help="spec draft body file (NERV draft body saved to a scratchpad file)")
    mode.add_argument("--impl-prep", type=str, dest="impl_prep", metavar="SCOPE",
                      help="pre-implementation check scope: NERV keys, mirror area folders "
                           "(spec/CLE-…/) or mirror files, comma-separated")
    mode.add_argument("--impl-done", type=str, dest="impl_done", metavar="SCOPE",
                      help="post-implementation check scope (same forms as --impl-prep). "
                           "Bundles the target specs, every mirror doc whose `## 구현 위치` "
                           "covers a changed file, and the code diff (vs --diff-base, default "
                           "origin/main).")
    parser.add_argument("--focus", type=str, metavar="KEYS",
                        help="NERV keys to rank first in every bundle (comma-separated) — "
                             "usually the claim's scope spec_ids")
    parser.add_argument("--diff-path", type=str, dest="diff_paths", action="append",
                        metavar="PATH",
                        help="path for the --impl-done code diff (repeatable). Default: the "
                             "project's code_areas. A harness-only task passes .claude.")
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
                             "Optional --reset-hint <sec>. Calls for DIFFERENT agents may "
                             "run in parallel; two calls for the SAME agent must not "
                             "overlap (unlocked read-modify-write — a lost `fatal` "
                             "transition is unrecoverable).")
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

    if not (args.spec or args.impl_prep or args.impl_done):
        parser.error(
            "--spec / --impl-prep / --impl-done 중 하나가 필요합니다 "
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
