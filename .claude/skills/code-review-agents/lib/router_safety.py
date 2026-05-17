"""Router safety: forced-include rules for review-router.

The router (`.claude/agents/review-router.md`) decides which of the 13
reviewers should run for a given change set, but certain file patterns
*must* always trigger specific reviewers regardless of the router's
decision. This module enumerates those rules and is consumed by
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
| Source-code file (24 extensions below)   | security, requirement, scope, side_effect, maintainability, testing  | _SOURCE_FORCED_REVIEWERS     |
| Package manifest / lockfile              | dependency + documentation                                           | _RULES → _PACKAGE_PATTERNS   |
| Doc file (.md/.txt/.rst/.adoc/LICENSE/   | documentation                                                        | _RULES → _DOC_PATTERNS       |
|   NOTICE/AUTHORS/CHANGELOG/README/...)   |                                                                      |                              |
| Migration / *.sql / prisma schema        | database                                                             | _RULES → _DB_PATTERNS        |
| OpenAPI / Swagger spec                   | api_contract                                                         | _RULES → _API_SPEC_PATTERNS  |
| `spec/**/*.md`                           | requirement (+ documentation via doc rule above)                     | _RULES → _SPEC_MD_PATTERNS   |
| Dockerfile / docker-compose*.{yml,yaml}  | dependency + security                                                | _RULES → _DOCKER_PATTERNS    |
| .dockerignore                            | security                                                             | _RULES → _DOCKERIGNORE_PATTERNS |
| .env / .env.* / *.env / *.env.example    | security                                                             | _RULES → _ENV_PATTERNS       |
| Unclassified (.gitignore, binary 외)     | (none) → router fatal → main writes minimal SUMMARY                  | —                            |

Source-code extensions counted by `_SOURCE_FORCED_REVIEWERS`:
  ts tsx js jsx mjs cjs · py pyi · java kt kts scala groovy ·
  go rs · c cc cpp cxx h hh hpp hxx · swift m mm · rb php lua ·
  cs fs vb · ex exs erl hrl ml mli clj cljs · dart · sh bash zsh

Reviewer codes (13):
  security · performance · architecture · requirement · scope ·
  side_effect · maintainability · testing · documentation · dependency ·
  database · concurrency · api_contract

When adding/removing a rule:
  1. Update _RULES / pattern constants below.
  2. Update the table in this docstring (PR diff colocates rule + table).
  3. Update README.md "Router safety policy" mirror.
  4. Add a sanity case to verify both match (see test scaffolds in PR #...).
"""

from __future__ import annotations

import fnmatch
import os
import sys
from typing import Iterable

# Reach the harness-wide _lib so router_safety can read project_config too
# (forced rules that depend on corpus paths — e.g. spec/ glob — must respect
# the project's `.claude.project.json`).
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SKILL_DIR = os.path.dirname(_THIS_DIR)
_SKILLS_DIR = os.path.dirname(_SKILL_DIR)
if _SKILLS_DIR not in sys.path:
    sys.path.insert(0, _SKILLS_DIR)

from _lib import project_config  # noqa: E402


# Reviewers that must always run when any source-code file changes. The
# router cannot drop these. Decided with the user after observing that
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

def _build_spec_md_patterns(spec_dir: str, conventions_dir: str) -> list[str]:
    """Compose the glob patterns for the spec rule from corpora paths."""
    return [
        f"{spec_dir}/**/*.md",
        f"{conventions_dir}/*.md",
        f"{spec_dir}/**/_product-overview.md",
    ]


# Default patterns — used by ``_RULES`` at module load. ``compute_forced_agents``
# substitutes these with config-driven patterns when a non-default ``repo_root``
# is passed (or when ``.claude.project.json`` overrides ``corpora.spec`` /
# ``corpora.conventions``).
_DEFAULT_SPEC_DIR = project_config.DEFAULTS["corpora"]["spec"]
_DEFAULT_CONVENTIONS_DIR = project_config.DEFAULTS["corpora"]["conventions"]
_SPEC_MD_PATTERNS = _build_spec_md_patterns(_DEFAULT_SPEC_DIR, _DEFAULT_CONVENTIONS_DIR)

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

    (("requirement",), _SPEC_MD_PATTERNS,
     "spec 본문 변경 — documentation 외에도 요구사항 일관성 검증 필요"),

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


def compute_forced_agents(
    file_paths: Iterable[str],
    available_agents: Iterable[str],
    repo_root: str | None = None,
) -> tuple[list[str], dict[str, list[str]]]:
    """Return (forced_agents_sorted, reasons_by_agent).

    - `file_paths`: relative paths of changed files in this review session.
    - `available_agents`: the set of reviewer names that the current session
      can actually invoke (usually ALL_AGENTS, but `REVIEW_AGENTS=...` may
      narrow this). Rules that target an unavailable reviewer are dropped
      silently — the user's explicit selection wins.
    - `repo_root`: project root used to load ``.claude.project.json``. When
      omitted, defaults to ``os.getcwd()``. Non-default ``corpora.spec`` /
      ``corpora.conventions`` rebuild the spec-md rule's patterns; all other
      rules are repo-agnostic.

    Two rule kinds are folded together:
      1. Path-pattern rules in `_RULES` (e.g. lockfile → dependency).
      2. The source-code blanket rule: if any changed file has a source
         extension, the six reviewers in `_SOURCE_FORCED_REVIEWERS` are
         all included. Reason annotated with up to 3 sample paths.

    `reasons_by_agent[<reviewer>]` is a list of human-readable why-strings
    (one per matching rule), suitable for debug logging and SUMMARY.
    """
    paths = [p for p in file_paths if p]
    available = set(available_agents)
    forced: dict[str, list[str]] = {}

    # Resolve spec rule patterns from project config when the corpora paths
    # differ from defaults. Common case (default config) reuses _RULES as-is.
    cfg = project_config.load(repo_root or os.getcwd())
    cfg_spec = cfg["corpora"]["spec"]
    cfg_conv = cfg["corpora"]["conventions"]
    if (cfg_spec, cfg_conv) == (_DEFAULT_SPEC_DIR, _DEFAULT_CONVENTIONS_DIR):
        rules = _RULES
    else:
        configured_spec_patterns = _build_spec_md_patterns(cfg_spec, cfg_conv)
        rules = [
            (reviewers, configured_spec_patterns if patterns is _SPEC_MD_PATTERNS else patterns, why)
            for reviewers, patterns, why in _RULES
        ]

    # Rule kind 1 — path patterns. A single rule can name multiple
    # reviewers; each available reviewer in the tuple receives the note.
    for reviewers, patterns, why in rules:
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
    source_files = sorted({p for p in paths if _is_source_file(p)})
    if source_files:
        sample = source_files[:3]
        note = f"소스 코드 변경 — 코드 변경 시 항상 적용: {', '.join(sample)}"
        if len(source_files) > 3:
            note += f" (외 {len(source_files) - 3}건)"
        for reviewer in _SOURCE_FORCED_REVIEWERS:
            if reviewer in available:
                forced.setdefault(reviewer, []).append(note)

    return sorted(forced.keys()), forced
