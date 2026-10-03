"""Router safety: forced-include rules for review-router.

The router (`.claude/agents/review-router.md`) decides which of the
registered reviewers (default 14; `.claude.project.json`'s
``agents.reviewers`` map may disable some) should run for a given
change set, but certain file patterns *must* always trigger specific
reviewers regardless of the router's decision. This module enumerates those rules and is consumed by
`code_review_orchestrator.py` at prepare time — the resulting list is
written to `_retry_state.json.agents_forced[]` so the router cannot turn
them off.

Why force include and not let the router decide?
- High-blast-radius areas (DB migration, dependency upgrade, auth flow)
  have asymmetric cost: false-negative skip can hide a real issue, while
  false-positive include only costs one extra reviewer invocation.
- Lock the safety net at orchestrator level — outside the router's
  context — so a router mistake or model regression cannot drop these.

Patterns are matched against the **relative file paths** that the
orchestrator collected from git/disk. Match is case-insensitive on the
filename component for path-anchored rules and case-insensitive globbing
for component patterns. Keep the rule set small and well-justified —
every rule here costs one or more reviewer invocations on every
matching change set.

================================================================
Policy matrix (this module is the SSOT for the table below)
================================================================

본 docstring 의 표가 정책의 단일 진실 원천 (single source of truth) 이다.
`.claude/skills/code-review-agents/README.md` 의 "Router safety policy" 절
은 동일 내용을 미러링 — 표를 수정하면 양쪽을 같이 갱신한다.

| Trigger                                  | Forced reviewers                                                     | Source                       |
|------------------------------------------|----------------------------------------------------------------------|------------------------------|
| Source-code file (44 extensions below)   | security, requirement, scope, side_effect, maintainability, testing  | _SOURCE_FORCED_REVIEWERS     |
|   or any other changed file              |                                                                      | (NERV review_roles.code)     |
| Package manifest / lockfile              | dependency + documentation                                           | _RULES → _PACKAGE_PATTERNS   |
| Doc file (.md/.txt/.rst/.adoc/LICENSE/   | documentation                                                        | _RULES → _DOC_PATTERNS       |
|   NOTICE/AUTHORS/CHANGELOG/README/...)   |                                                                      |                              |
| Migration / *.sql / prisma schema        | database                                                             | _RULES → _DB_PATTERNS        |
| OpenAPI / Swagger spec                   | api_contract                                                         | _RULES → _API_SPEC_PATTERNS  |
| Dockerfile / docker-compose*.{yml,yaml}  | dependency + security                                                | _RULES → _DOCKER_PATTERNS    |
| .dockerignore                            | security                                                             | _RULES → _DOCKERIGNORE_PATTERNS |
| .env / .env.* / *.env / *.env.example    | security                                                             | _RULES → _ENV_PATTERNS       |
| Unclassified (.gitignore, binary 외)     | only the six of the first row                                        | —                            |

The "any other changed file" half of the first row: NERV's `review_roles.code` policy
requires all six roles in every code round, whatever the round changed (NERV cutover
stage 2). The push hook and the CI backstop read that round for `codebase/**`, and the
NERV done gate wants a passed code round for every Task — harness-only and docs-only
Tasks included. A change made only of JSON, YAML or Markdown would otherwise leave the
round `missing_roles`: the branch unpushable, or the Task impossible to close. An
explicit `REVIEW_AGENTS` selection still wins (rules drop unavailable reviewers).

The `spec/**/*.md` → requirement rule left in NERV cutover 4e. The first row
already forces `requirement` for every changed file, so the rule added nothing,
and it was the only rule that read `.claude.project.json` (`corpora.spec` ·
`corpora.conventions`). Without it this module imports nothing from the harness
and the push gate can load it by path to check the round's roles
(`.claude/hooks/_lib/review_guard.py`). A spec mirror file still forces
`documentation` through the doc rule.

Source-code extensions counted by `_SOURCE_FORCED_REVIEWERS`:
  ts tsx js jsx mjs cjs · py pyi · java kt kts scala groovy ·
  go rs · c cc cpp cxx h hh hpp hxx · swift m mm · rb php lua ·
  cs fs vb · ex exs erl hrl ml mli clj cljs · dart · sh bash zsh

Reviewer codes (default 14; `.claude.project.json` may disable some):
  security · performance · architecture · requirement · scope ·
  side_effect · maintainability · testing · documentation · dependency ·
  database · concurrency · api_contract · user_guide_sync

The user_guide_sync reviewer is intentionally NOT in any _RULES entry —
projects without a "PROJECT.md §변경 시 동반 갱신" matrix should
disable it via ``agents.reviewers.user_guide_sync: false`` rather than
have router_safety force it on every change.

When adding/removing a rule:
  1. Update _RULES / pattern constants below.
  2. Update the table in this docstring (PR diff colocates rule + table).
  3. Update README.md "Router safety policy" mirror.
  4. Add a sanity case to verify both match (see test scaffolds in PR #...).
"""

from __future__ import annotations

import fnmatch
import os
from typing import Iterable

# Standard library only, on purpose: the push gate loads this file by path
# (`review_guard._load_router_safety`) from a process whose `_lib` is the hooks
# package, so a harness import here would break the gate, not just this module.


# Reviewers that must always run when any file changes — source files by rule 2,
# every other file by rule 3 (NERV `review_roles.code`). The router cannot drop these. Decided with the user after observing that
# the router's pattern-only judgment misses domain areas whose path
# happens not to match any keyword (e.g. `account/`, `payment/`).
#
# - security        : false-negative risk on permission/role/crypto edits
#                     that share no obvious keyword with the safety
#                     patterns. Asymmetric cost — missing a security
#                     finding is far worse than running one extra agent.
# - requirement     : intent vs implementation drift is invisible to a
#                     path-only router.
# - scope           : detects "unrelated edits dragged in" — only visible
#                     after seeing the actual diff.
# - side_effect     : signature / global / fs / network changes can hide
#                     under any path.
# - maintainability : readability / duplication / complexity always
#                     accumulates with every code change.
# - testing         : missing test pairs is the most common defect in
#                     this project; treat every src change as needing a
#                     testing review.
_SOURCE_FORCED_REVIEWERS = (
    "security",
    "requirement",
    "scope",
    "side_effect",
    "maintainability",
    "testing",
)

# Extensions counted as "source code" for the purpose of the rule above.
# Markup, config, lockfiles, and docs are intentionally excluded — those
# already have targeted rules (or no rule, by design).
_SOURCE_CODE_EXTENSIONS = frozenset({
    # JS/TS family
    "ts", "tsx", "js", "jsx", "mjs", "cjs",
    # Python
    "py", "pyi",
    # JVM
    "java", "kt", "kts", "scala", "groovy",
    # Systems
    "go", "rs",
    "c", "cc", "cpp", "cxx", "h", "hh", "hpp", "hxx",
    # Apple
    "swift", "m", "mm",
    # Dynamic
    "rb", "php", "lua",
    # .NET
    "cs", "fs", "vb",
    # Functional
    "ex", "exs", "erl", "hrl", "ml", "mli", "clj", "cljs",
    # Mobile / cross
    "dart",
    # Shell
    "sh", "bash", "zsh",
})


# Common pattern sets, shared across rules so a single change can trigger
# multiple reviewers without duplicating the pattern list.
_PACKAGE_PATTERNS = [
    "package.json", "**/package.json",
    "package-lock.json", "**/package-lock.json",
    "yarn.lock", "**/yarn.lock",
    "pnpm-lock.yaml", "**/pnpm-lock.yaml",
    "requirements*.txt", "**/requirements*.txt",
    "Pipfile", "Pipfile.lock",
    "pyproject.toml", "**/pyproject.toml",
    "go.mod", "go.sum",
    "Cargo.toml", "Cargo.lock",
]

_DOC_PATTERNS = [
    # Generic doc text
    "*.md", "**/*.md",
    "*.txt", "**/*.txt",
    "*.rst", "**/*.rst",
    "*.adoc", "**/*.adoc",
    # Convention root-doc files (no extension)
    "LICENSE", "**/LICENSE",
    "LICENSE.*", "**/LICENSE.*",
    "NOTICE", "**/NOTICE",
    "AUTHORS", "**/AUTHORS",
    "CHANGELOG", "**/CHANGELOG",
    "CHANGELOG.*", "**/CHANGELOG.*",
    "README", "**/README",
    "README.*", "**/README.*",
]

_DB_PATTERNS = [
    "**/migrations/*", "**/migration/*",
    "*.sql", "**/*.sql",
    "**/prisma/schema*", "**/schema.prisma",
]

_API_SPEC_PATTERNS = [
    "**/openapi*.y*ml", "**/swagger*.y*ml",
    "**/openapi*.json", "**/swagger*.json",
]

# Docker build/runtime — image tag, package install, USER, port, secret
# COPY, privileged/host-network options. Both `dependency` (image/tag/
# package install) and `security` (root user, port exposure, secret
# handling) need to look.
_DOCKER_PATTERNS = [
    "Dockerfile", "**/Dockerfile",
    "Dockerfile.*", "**/Dockerfile.*",
    "docker-compose*.yml", "**/docker-compose*.yml",
    "docker-compose*.yaml", "**/docker-compose*.yaml",
]

# .dockerignore — wrong exclusion lets .env / .git / secrets enter the
# build context and end up baked into the image. Security only.
_DOCKERIGNORE_PATTERNS = [
    ".dockerignore", "**/.dockerignore",
]

# Env files — secrets, connection strings, API keys. Normally gitignored;
# when one shows up in a diff it's almost always either accidentally
# committed or an example with secret-shaped values. Security review is
# the right safety net either way. Covers:
#   .env, .env.local, .env.production, .env.example, ...
#   production.env, *.env.example (prefixed variants)
_ENV_PATTERNS = [
    ".env", "**/.env",
    ".env.*", "**/.env.*",
    "*.env", "**/*.env",
    "*.env.example", "**/*.env.example",
]


# Each rule: (reviewers_tuple, patterns, why)
# `reviewers_tuple` lists all reviewers a matching change forces; a single
# trigger can force multiple reviewers (e.g. package files force both
# `dependency` and `documentation` — package changes usually need a
# README/CHANGELOG update reviewed in the same PR).
#
# Decided with the user on 2026-05-16 after observing the router could
# drop reviewers in pure-docs / domain-specific paths. The `security`
# auth/* pattern from the old _RULES was retired — every source-code
# change now forces `security` via _SOURCE_FORCED_REVIEWERS below, so the
# auth keyword rule became redundant.
_RULES: list[tuple[tuple[str, ...], list[str], str]] = [
    (("dependency", "documentation"), _PACKAGE_PATTERNS,
     "패키지 매니페스트·lockfile 변경 — dependency 영향 + README/CHANGELOG 동반 갱신 점검"),

    (("documentation",), _DOC_PATTERNS,
     "문서 파일(.md/.txt/.rst/.adoc/LICENSE/CHANGELOG 등) 변경"),

    (("database",), _DB_PATTERNS,
     "마이그레이션·스키마·SQL 변경"),

    (("api_contract",), _API_SPEC_PATTERNS,
     "OpenAPI/Swagger 정의 변경"),

    (("dependency", "security"), _DOCKER_PATTERNS,
     "Dockerfile / docker-compose 변경 — base image·package install (dependency) + USER·secret·port·privileged (security)"),

    (("security",), _DOCKERIGNORE_PATTERNS,
     ".dockerignore 변경 — 잘못된 제외 시 .env/.git/secret 이 build context 에 포함될 위험"),

    (("security",), _ENV_PATTERNS,
     ".env 류 변경 — secret/connection string/API key 누설 가능. example 파일도 secret-shape 값 검토 필요"),
]


def _normalize(path: str) -> str:
    return path.replace(os.sep, "/")


def _file_matches(rel_path: str, pattern: str) -> bool:
    rel_norm = _normalize(rel_path)
    if fnmatch.fnmatch(rel_norm, pattern):
        return True
    # fnmatch's ** is not recursive by default; emulate the common case:
    # split into directory components and match prefix expansions.
    if "**" in pattern:
        parts = pattern.split("**")
        # crude but adequate: require each non-empty fragment to appear in order
        head = parts[0].rstrip("/")
        tail = parts[-1].lstrip("/")
        if head and not rel_norm.startswith(head):
            return False
        if tail and not fnmatch.fnmatch(rel_norm.rsplit("/", 1)[-1], tail) \
                and not fnmatch.fnmatch(rel_norm, "*" + tail):
            return False
        # middle fragments
        cursor = len(head)
        for mid in parts[1:-1]:
            mid = mid.strip("/")
            if not mid:
                continue
            idx = rel_norm.find(mid, cursor)
            if idx < 0:
                return False
            cursor = idx + len(mid)
        return True
    return False


def _is_source_file(path: str) -> bool:
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    return ext in _SOURCE_CODE_EXTENSIONS


def source_files(file_paths: Iterable[str]) -> list[str]:
    """The changed paths that are source code, by the same extension set the
    forced-reviewer rules use.

    Public because the router prompt states this list as a *fact* rather than
    leaving the router to infer it from filenames. Measured need: on
    2026-07-23 a changeset of 19 files — 16 docs and 3 code files, one of them
    a brand-new module — was routed with "소스 코드 변경 없음(문서만 변경)" and
    every reviewer deselected. The code was in the prompt; the router simply
    read the majority. Sharing the classifier keeps that statement and the
    forced-reviewer rules from ever disagreeing.
    """
    return [p for p in file_paths if _is_source_file(p)]


def compute_forced_agents(
    file_paths: Iterable[str],
    available_agents: Iterable[str],
) -> tuple[list[str], dict[str, list[str]]]:
    """Return (forced_agents_sorted, reasons_by_agent).

    - `file_paths`: relative paths of changed files in this review session.
    - `available_agents`: the set of reviewer names that the current session
      can actually invoke (usually ALL_AGENTS, but `REVIEW_AGENTS=...` may
      narrow this). Rules that target an unavailable reviewer are dropped
      silently — the user's explicit selection wins.

    No rule reads the project config (the corpus-dependent spec rule left in
    NERV cutover 4e), so the result depends on these two arguments only.

    Three rule kinds are folded together:
      1. Path-pattern rules in `_RULES` (e.g. lockfile → dependency).
      2. The source-code blanket rule: if any changed file has a source
         extension, the six reviewers in `_SOURCE_FORCED_REVIEWERS` are
         all included. Reason annotated with up to 3 sample paths.
      3. The NERV rule: any other changed file forces the same six
         (`review_roles.code`, see the module docstring).

    `reasons_by_agent[<reviewer>]` is a list of human-readable why-strings
    (one per matching rule), suitable for debug logging and SUMMARY.
    """
    paths = [p for p in file_paths if p]
    available = set(available_agents)
    forced: dict[str, list[str]] = {}

    # Rule kind 1 — path patterns. A single rule can name multiple
    # reviewers; each available reviewer in the tuple receives the note.
    for reviewers, patterns, why in _RULES:
        matched_files: list[str] = []
        for pattern in patterns:
            for p in paths:
                if _file_matches(p, pattern):
                    matched_files.append(p)
        if not matched_files:
            continue
        sample = sorted(set(matched_files))[:3]
        note = f"{why}: {', '.join(sample)}"
        if len(set(matched_files)) > 3:
            note += f" (외 {len(set(matched_files)) - 3}건)"
        for reviewer in reviewers:
            if reviewer in available:
                forced.setdefault(reviewer, []).append(note)

    # Rule kind 2 — any source-code file forces the six core reviewers.
    # Named `changed_source` rather than `source_files` so it does not shadow
    # the module-level function of that name.
    changed_source = sorted(set(source_files(paths)))
    if changed_source:
        sample = changed_source[:3]
        note = f"소스 코드 변경 — 코드 변경 시 항상 적용: {', '.join(sample)}"
        if len(changed_source) > 3:
            note += f" (외 {len(changed_source) - 3}건)"
        for reviewer in _SOURCE_FORCED_REVIEWERS:
            if reviewer in available:
                forced.setdefault(reviewer, []).append(note)

    # Rule kind 3 — every other changed file forces the same six, whatever its
    # extension or location (see the module docstring: NERV `review_roles.code`).
    others = sorted(set(paths) - set(changed_source))
    if others:
        sample = others[:3]
        note = f"NERV 필수 리뷰 역할(review_roles.code) — 비소스 변경: {', '.join(sample)}"
        if len(others) > 3:
            note += f" (외 {len(others) - 3}건)"
        for reviewer in _SOURCE_FORCED_REVIEWERS:
            if reviewer in available:
                forced.setdefault(reviewer, []).append(note)

    return sorted(forced.keys()), forced


#: Every reviewer some rule can force — the universe `conditional_forced_agents`
#: draws from. Derived from the rules so a reviewer added to a rule is covered here
#: without a second list to keep in step.
RULE_REVIEWERS: tuple[str, ...] = tuple(sorted(
    {r for reviewers, _patterns, _why in _RULES for r in reviewers}
    | set(_SOURCE_FORCED_REVIEWERS)
))

#: The six roles NERV's `review_roles.code` policy requires in every code round.
#: The server already holds a round at `missing_roles` without them.
NERV_REQUIRED_REVIEWERS: tuple[str, ...] = _SOURCE_FORCED_REVIEWERS


def conditional_forced_agents(
    file_paths: Iterable[str],
    available_agents: Iterable[str],
) -> list[str]:
    """The forced reviewers beyond the six NERV roles — the ones a change *kind* adds.

    NERV's policy cannot express "documentation when a doc changed, dependency
    when a manifest changed", so it requires only the six (NERV cutover stage 2).
    The push gate reads this to check the rest against the round's reported roles
    (`review_guard.evaluate_review`), closing the gap stage 2 left open.
    """
    forced, _ = compute_forced_agents(file_paths, available_agents)
    return [r for r in forced if r not in NERV_REQUIRED_REVIEWERS]
