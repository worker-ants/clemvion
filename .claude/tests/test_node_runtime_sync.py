"""Node 런타임 메이저와 corepack 핀은 여러 파일에 손으로 적혀 있고, 서로 맞는지 대조한다.

**왜 이 가드가 있는가.** Node 24 → 26 상향(NERV Task `CLE-T-DC8BY0`)이 메이저를 적은 곳을 한 번에
고쳤지만 그 일치를 지키는 장치는 주석 문장뿐이었다. 세 가지가 리뷰에서 지적됐다.

- 메이저가 `.nvmrc`, backend · frontend Dockerfile 의 `FROM node:<N>-alpine`, playwright e2e
  Dockerfile 의 `node-runtime` 스테이지, CI `setup-node` 의 `node-version` 에 따로 적혀 있다.
  `check-e2e-playwright-config.py` 는 `playwright:vX.Y.Z-*` 태그만 읽으므로 `node-runtime`
  스테이지는 가드 시야 밖이었다. 다음 상향에서 한 곳만 남으면 frontend e2e 만 운영과 다른
  Node 로 돌고 어떤 테스트도 잡지 못한다.
- `corepack@0.36.0` 핀이 Dockerfile 두 개에 세 번 들어 있고 "frontend Dockerfile 과 같은 버전을
  쓴다" 는 주석만 서로를 가리켰다. 한 곳만 올리면 이미지마다 corepack 이 갈린다.
- playwright e2e 이미지는 jammy 이미지의 `/usr/bin/node` 를 덮어쓴다. 덮을 경로가 PATH 에서 실제로
  먼저 잡히는 node 와 다르면 덮어쓰기가 조용히 효과를 잃고 e2e 가 다시 Node 24 로 돈다. 빌드도
  e2e 도 초록이라 아무도 모른다. 그래서 Dockerfile 이 COPY 바로 뒤에서 빌드 때 단언하고, 이 파일은
  그 단언이 지워지지 않았는지 고정한다.

네 번째는 `@types/node` 다(NERV Task `CLE-T-8AHC63`). dependabot 은 `@types/node` 의 major 를 올리지
않게 막혀 있다(`.github/dependabot.yml` 의 `ignore`). 그래서 앱의 `@types/node` major 는 런타임 상향
PR 에서 사람이 함께 올려야만 오르는데, 빠뜨려도 잡는 곳이 없었다. 외부 배포 SDK(`@workflow/sdk`)의
`@types/node` 는 반대로 `engines.node` 하한(`>=20`)과 같은 major 에 머물러야 하고, 어긋나면
Node 20 소비자에게 없는 API 를 SDK 코드가 써도 타입 검사가 잡지 못한다.

**정적 대조인 이유.** 매체가 Dockerfile · workflow YAML · 점 파일이라 한 변수로 합칠 수 없다.
`test_install_gate_flags.py` 가 `pnpm install` 플래그를 묶는 것과 같은 형태로 "한 메이저인가" 만 본다.

**한계를 적는다.** 값이 맞는지만 본다. 이미지 안에서 실제로 어떤 node 가 도는지는 Dockerfile 의
빌드 시점 단언(`RUN test ...`)과 e2e 가 본다. 이 파일은 그 단언이 남아 있는지까지만 본다.
`engines.node` 를 `.nvmrc` 와 대조하지는 않는다. 외부 배포 SDK 의 floor(`>=20`)가 일부러 낮기 때문이다.
`@types/node` 는 앱 세 곳이 `.nvmrc` 와, 선언한 매니페스트마다 자기 `engines.node` 하한과 맞는지만 본다.
"""

from __future__ import annotations

import json
import re
import unittest

from _harness import REPO_ROOT
from test_dependabot_npm_coverage import _tracked_package_jsons
from test_harness_checks_paths_coverage import filter_covers_file, parse_pathspecs_block

NVMRC = REPO_ROOT / ".nvmrc"
BACKEND_DOCKERFILE = REPO_ROOT / "codebase" / "backend" / "Dockerfile"
FRONTEND_DOCKERFILE = REPO_ROOT / "codebase" / "frontend" / "Dockerfile"
PLAYWRIGHT_DOCKERFILE = REPO_ROOT / "codebase" / "frontend" / "Dockerfile.playwright-e2e"
HARNESS_CHECKS = REPO_ROOT / ".github" / "workflows" / "harness-checks.yml"
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"
ACTIONS_DIR = REPO_ROOT / ".github" / "actions"

#: 운영 런타임과 같은 메이저의 `@types/node` 를 쓰는 내부 앱 세 곳.
APP_MANIFESTS = (
    REPO_ROOT / "codebase" / "backend" / "package.json",
    REPO_ROOT / "codebase" / "frontend" / "package.json",
    REPO_ROOT / "codebase" / "channel-web-chat" / "package.json",
)

#: 소비자 하한(`engines.node >=20`)과 같은 메이저의 `@types/node` 를 써야 하는 외부 배포 SDK.
SDK_MANIFEST = REPO_ROOT / "codebase" / "packages" / "sdk" / "package.json"

TYPES_NODE = "@types/node"
DEP_SECTIONS = ("dependencies", "devDependencies", "optionalDependencies")

#: `FROM node:<N>` 스테이지 수의 하한. 앱 Dockerfile 은 deps · runner 두 스테이지가 node 이미지에서 시작한다.
APP_DOCKERFILES = (
    (BACKEND_DOCKERFILE, 2),
    (FRONTEND_DOCKERFILE, 2),
)

#: `setup-node` 의 `node-version` 이 적힌 곳의 하한. 줄면 파서가 헛도는 것이므로 실패시킨다.
MIN_SETUP_NODE_SITES = 5

#: `npm install -g corepack@<ver>` 가 적힌 곳의 하한(backend 2 + frontend 1).
MIN_COREPACK_SITES = 3


def _code_lines(text: str) -> list[str]:
    """주석을 뺀 줄. 이 저장소는 주석에서도 같은 문자열을 자주 인용해서 거르지 않으면 헛통과한다."""
    return [ln for ln in text.splitlines() if not ln.lstrip().startswith("#")]


def nvmrc_major(text: str) -> int | None:
    match = re.match(r"\s*v?(\d+)", text)
    return int(match.group(1)) if match else None


def from_node_majors(text: str) -> list[int]:
    """`FROM node:<tag>` 줄마다 메이저. 태그가 `${NODE_MAJOR}` 로 시작하면 `ARG NODE_MAJOR=<N>` 기본값을 쓴다."""
    lines = _code_lines(text)
    default: int | None = None
    for ln in lines:
        arg = re.match(r"\s*ARG\s+NODE_MAJOR=(\d+)\s*$", ln)
        if arg:
            default = int(arg.group(1))
            break
    out: list[int] = []
    for ln in lines:
        m = re.match(r"\s*FROM\s+node:(\S+)", ln)
        if not m:
            continue
        tag = m.group(1)
        if tag.startswith("${NODE_MAJOR}"):
            if default is not None:
                out.append(default)
            continue
        digits = re.match(r"(\d+)", tag)
        if digits:
            out.append(int(digits.group(1)))
    return out


def setup_node_majors(text: str) -> list[int]:
    """`node-version: '26'` 형태. 값이 숫자로 시작하지 않으면(예: 표현식) 세지 않는다."""
    out: list[int] = []
    for ln in _code_lines(text):
        m = re.match(r"\s*(?:-\s+)?node-version:\s*['\"]?(\d+)", ln)
        if m:
            out.append(int(m.group(1)))
    return out


def corepack_pins(text: str) -> list[str]:
    out: list[str] = []
    for ln in _code_lines(text):
        out.extend(re.findall(r"\bcorepack@([^\s&;|]+)", ln))
    return out


def has_build_time_node_assertion(text: str) -> bool:
    """`COPY --from=node-runtime` 뒤에, PATH 의 node 메이저를 `${NODE_MAJOR}` 와 대조하는 `RUN` 이 있는가."""
    lines = _code_lines(text)
    copy_at = next(
        (i for i, ln in enumerate(lines) if re.match(r"\s*COPY\s+--from=node-runtime\b", ln)),
        None,
    )
    if copy_at is None:
        return False
    return any(
        re.match(r"\s*RUN\b", ln)
        and "process.versions.node" in ln
        and "${NODE_MAJOR}" in ln
        for ln in lines[copy_at + 1:]
    )


_RANGE_FLOOR = re.compile(r"\s*(?:\^|~|>=|=)?\s*v?(\d+)(?:\.(?:\d+|[xX*])){0,2}\s*")


def range_floor_major(spec: str) -> int | None:
    """`^26` · `>=20.0.0` · `~26.1` · `26.x` 처럼 하나의 하한만 적은 범위에서 메이저를 읽는다.

    `||` · 상한(`<27`) · `*` · `workspace:` 같은 형태는 하한을 하나로 정할 수 없어 None 이다.
    추측해서 맞는 척하지 않고, 대조가 실패해 사람이 형태를 보게 한다.
    """
    match = _RANGE_FLOOR.fullmatch(spec)
    return int(match.group(1)) if match else None


def types_node_specs(data: dict) -> list[str]:
    """매니페스트가 `@types/node` 에 적은 버전 범위들."""
    out: list[str] = []
    for section in DEP_SECTIONS:
        spec = (data.get(section) or {}).get(TYPES_NODE)
        if spec is not None:
            out.append(spec)
    return out


def types_node_problems(data: dict) -> list[str]:
    """한 매니페스트의 `@types/node` 가 자기 `engines.node` 하한과 같은 메이저가 아닌 이유. 맞으면 []."""
    specs = types_node_specs(data)
    if not specs:
        return []
    engines = (data.get("engines") or {}).get("node")
    if engines is None:
        return [f"{TYPES_NODE} 를 선언했지만 engines.node 가 없다 — 어느 메이저에 맞출지 정할 수 없다"]
    floor = range_floor_major(engines)
    if floor is None:
        return [f"engines.node {engines!r} 에서 하한 메이저를 읽지 못했다"]
    problems: list[str] = []
    for spec in specs:
        major = range_floor_major(spec)
        if major != floor:
            problems.append(
                f"{TYPES_NODE} {spec!r}(메이저 {major}) 가 engines.node {engines!r} 하한({floor}) 과 다르다"
            )
    return problems


def _types_node_manifests() -> dict[str, dict]:
    """`@types/node` 를 선언한 추적 매니페스트. `.claude/` 아래 하네스 트리는 별도 npm 트리라 뺀다."""
    found: dict[str, dict] = {}
    for rel in _tracked_package_jsons():
        if rel.startswith(".claude/"):
            continue
        data = json.loads(_read(REPO_ROOT / rel))
        if types_node_specs(data):
            found[rel] = data
    return found


def _read(path) -> str:
    return path.read_text(encoding="utf-8")


def _rel(path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


class ParserTest(unittest.TestCase):
    """파서가 아무것도 못 읽으면 아래 대조가 전부 헛통과한다. 입력의 가장자리를 고정한다."""

    def test_nvmrc_accepts_a_bare_or_v_prefixed_major(self):
        self.assertEqual(nvmrc_major("26\n"), 26)
        self.assertEqual(nvmrc_major("v26.12.0\n"), 26)
        self.assertIsNone(nvmrc_major("lts/*\n"))

    def test_from_node_ignores_comments_and_other_images(self):
        text = "\n".join([
            "# FROM node:20-alpine  (주석이다)",
            "FROM node:26-alpine AS deps",
            "FROM deps AS builder",
            "FROM mcr.microsoft.com/playwright:v1.64.1-jammy",
        ])
        self.assertEqual(from_node_majors(text), [26])

    def test_from_node_resolves_the_arg_default(self):
        text = "\n".join([
            "ARG NODE_MAJOR=26",
            "FROM node:${NODE_MAJOR}-bookworm-slim AS node-runtime",
        ])
        self.assertEqual(from_node_majors(text), [26])

    def test_from_node_drops_an_unresolvable_arg_instead_of_guessing(self):
        # 기본값이 없으면 메이저를 알 수 없다. 추측해서 맞는 척하지 않고 빈 목록이 되어 하한 단언이 실패한다.
        self.assertEqual(from_node_majors("FROM node:${NODE_MAJOR}-slim"), [])

    def test_setup_node_reads_quoted_and_list_item_forms(self):
        text = "\n".join([
            "        with:",
            "          node-version: '26'",
            "      - node-version: \"26\"",
            "          # node-version: '20'",
            "          node-version: ${{ matrix.node }}",
        ])
        self.assertEqual(setup_node_majors(text), [26, 26])

    def test_corepack_pins_skip_comments_and_stop_at_shell_operators(self):
        text = "\n".join([
            "# corepack@9.9.9 는 주석",
            "RUN npm install -g corepack@0.36.0 && corepack enable",
            "RUN npm install -g corepack@0.36.0",
        ])
        self.assertEqual(corepack_pins(text), ["0.36.0", "0.36.0"])

    def test_build_time_assertion_is_recognised_only_after_the_copy(self):
        good = "\n".join([
            "COPY --from=node-runtime /usr/local/bin/node /usr/bin/node",
            "RUN test \"$(node -p 'process.versions.node.split(\".\")[0]')\" = \"${NODE_MAJOR}\"",
        ])
        before_copy = "\n".join(reversed(good.split("\n")))
        no_major = good.replace("${NODE_MAJOR}", "26")
        commented = "\n".join(["COPY --from=node-runtime /a /b", "# " + good.split("\n")[1]])
        self.assertTrue(has_build_time_node_assertion(good))
        self.assertFalse(has_build_time_node_assertion(before_copy))
        self.assertFalse(has_build_time_node_assertion(no_major))
        self.assertFalse(has_build_time_node_assertion(commented))
        self.assertFalse(has_build_time_node_assertion("RUN true"))


class TypesNodeParserTest(unittest.TestCase):
    """`@types/node` 대조의 파서 가장자리. 읽지 못한 값은 None 으로 남겨 대조가 실패하게 한다."""

    def test_range_floor_reads_single_lower_bounds(self):
        for spec, major in (
            ("^26", 26), ("^20.0.0", 20), (">=20", 20), (">=20.0.0", 20),
            ("~26.1", 26), ("26.x", 26), ("v26", 26), ("26", 26),
        ):
            with self.subTest(spec=spec):
                self.assertEqual(range_floor_major(spec), major)

    def test_range_floor_refuses_shapes_with_no_single_floor(self):
        for spec in (">=20 <27", "20 || 22", "*", "latest", "workspace:*", ""):
            with self.subTest(spec=spec):
                self.assertIsNone(range_floor_major(spec))

    def test_matching_major_has_no_problems(self):
        data = {"engines": {"node": ">=26"}, "devDependencies": {TYPES_NODE: "^26"}}
        self.assertEqual(types_node_problems(data), [])

    def test_sdk_shaped_manifest_matches_its_own_lower_floor(self):
        data = {"engines": {"node": ">=20.0.0"}, "devDependencies": {TYPES_NODE: "^20.0.0"}}
        self.assertEqual(types_node_problems(data), [])

    def test_a_different_major_is_reported(self):
        # #1533 이 SDK 에 시도한 변경: 소비자 하한은 20 인데 타입만 26.
        data = {"engines": {"node": ">=20.0.0"}, "devDependencies": {TYPES_NODE: "^26.6.5"}}
        self.assertEqual(len(types_node_problems(data)), 1)

    def test_a_manifest_without_engines_or_with_unreadable_engines_is_reported(self):
        self.assertEqual(len(types_node_problems({"devDependencies": {TYPES_NODE: "^26"}})), 1)
        unreadable = {"engines": {"node": ">=20 <27"}, "devDependencies": {TYPES_NODE: "^20"}}
        self.assertEqual(len(types_node_problems(unreadable)), 1)

    def test_a_manifest_that_does_not_declare_the_types_is_skipped(self):
        self.assertEqual(types_node_problems({"engines": {"node": ">=20"}}), [])

    def test_every_dependency_section_is_read(self):
        data = {
            "engines": {"node": ">=26"},
            "dependencies": {TYPES_NODE: "^26"},
            "devDependencies": {TYPES_NODE: "^24"},
        }
        self.assertEqual(len(types_node_problems(data)), 1)


class NodeMajorAgreesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.major = nvmrc_major(_read(NVMRC))

    def test_nvmrc_is_readable(self):
        self.assertIsNotNone(self.major, ".nvmrc 에서 메이저를 읽지 못했다")

    def test_app_dockerfiles_start_from_the_nvmrc_major(self):
        for path, minimum in APP_DOCKERFILES:
            with self.subTest(file=_rel(path)):
                majors = from_node_majors(_read(path))
                self.assertGreaterEqual(
                    len(majors), minimum,
                    f"{_rel(path)}: `FROM node:<N>` 스테이지를 {minimum}개 이상 찾지 못했다 — "
                    "스테이지 구성이 바뀌었거나 파서가 헛돈다",
                )
                self.assertEqual(
                    set(majors), {self.major},
                    f"{_rel(path)}: `FROM node:` 메이저 {majors} 가 .nvmrc({self.major}) 와 다르다",
                )

    def test_playwright_image_overwrites_node_with_the_nvmrc_major(self):
        text = _read(PLAYWRIGHT_DOCKERFILE)
        majors = from_node_majors(text)
        self.assertEqual(
            majors, [self.major],
            f"{_rel(PLAYWRIGHT_DOCKERFILE)}: node-runtime 스테이지의 메이저 {majors} 가 "
            f".nvmrc({self.major}) 와 다르다 — frontend e2e 만 운영과 다른 Node 로 돈다",
        )

    def test_playwright_image_asserts_the_node_it_runs_at_build_time(self):
        self.assertTrue(
            has_build_time_node_assertion(_read(PLAYWRIGHT_DOCKERFILE)),
            f"{_rel(PLAYWRIGHT_DOCKERFILE)}: COPY --from=node-runtime 뒤에 PATH 의 node 메이저를 "
            "`${NODE_MAJOR}` 와 대조하는 RUN 이 없다 — base 이미지가 node 위치를 바꾸면 "
            "덮어쓰기가 조용히 효과를 잃고 e2e 가 다시 이전 메이저로 돈다",
        )

    def test_ci_setup_node_uses_the_nvmrc_major(self):
        found: dict[str, list[int]] = {}
        for base in (WORKFLOWS_DIR, ACTIONS_DIR):
            for path in sorted(list(base.rglob("*.yml")) + list(base.rglob("*.yaml"))):
                majors = setup_node_majors(_read(path))
                if majors:
                    found[_rel(path)] = majors
        total = sum(len(v) for v in found.values())
        self.assertGreaterEqual(
            total, MIN_SETUP_NODE_SITES,
            f"`node-version` 을 {MIN_SETUP_NODE_SITES}곳 이상 찾지 못했다({total}곳) — 파서가 헛돌거나 "
            "setup-node 사용처가 줄었다. 줄었다면 MIN_SETUP_NODE_SITES 를 함께 낮춘다",
        )
        for rel, majors in found.items():
            with self.subTest(file=rel):
                self.assertEqual(
                    set(majors), {self.major},
                    f"{rel}: setup-node 의 node-version {majors} 가 .nvmrc({self.major}) 와 다르다",
                )


class CorepackPinAgreesTest(unittest.TestCase):
    def test_every_dockerfile_installs_the_same_corepack(self):
        pins: dict[str, list[str]] = {}
        for path in (BACKEND_DOCKERFILE, FRONTEND_DOCKERFILE, PLAYWRIGHT_DOCKERFILE):
            found = corepack_pins(_read(path))
            if found:
                pins[_rel(path)] = found
        total = sum(len(v) for v in pins.values())
        self.assertGreaterEqual(
            total, MIN_COREPACK_SITES,
            f"`corepack@<ver>` 설치를 {MIN_COREPACK_SITES}곳 이상 찾지 못했다({total}곳) — 파서가 헛돈다",
        )
        distinct = {v for vs in pins.values() for v in vs}
        self.assertEqual(
            len(distinct), 1,
            f"Dockerfile 사이 corepack 핀이 갈렸다: {pins} — 이미지마다 corepack 이 달라진다",
        )


class TypesNodeAgreesTest(unittest.TestCase):
    """`@types/node` major 는 dependabot 이 올리지 않으므로 사람이 맞춘다. 그 일치를 여기서 고정한다.

    dependabot 의 `ignore`(`test_dependabot_npm_coverage.py::DependabotIgnoreTest` 가 고정)는 "자동으로
    올리지 않는다" 까지만 약속한다. 런타임을 올리는 PR 이 앱의 `@types/node` 를 함께 올렸는지는 여기가 본다.
    """

    @classmethod
    def setUpClass(cls):
        cls.major = nvmrc_major(_read(NVMRC))
        cls.declaring = _types_node_manifests()

    def test_discovery_finds_the_manifests_it_is_meant_to_guard(self):
        wanted = [_rel(p) for p in (*APP_MANIFESTS, SDK_MANIFEST)]
        for rel in wanted:
            with self.subTest(file=rel):
                self.assertIn(
                    rel, self.declaring,
                    f"{rel} 가 {TYPES_NODE} 를 선언한 매니페스트로 잡히지 않는다 — 선언이 사라졌거나 "
                    "탐색이 헛돈다. 사라진 것이 맞다면 APP_MANIFESTS · SDK_MANIFEST 에서도 뺀다",
                )

    def test_apps_use_the_runtime_major(self):
        for path in APP_MANIFESTS:
            rel = _rel(path)
            with self.subTest(file=rel):
                specs = types_node_specs(json.loads(_read(path)))
                self.assertTrue(specs, f"{rel}: {TYPES_NODE} 선언을 찾지 못했다")
                self.assertEqual(
                    {range_floor_major(spec) for spec in specs}, {self.major},
                    f"{rel}: {TYPES_NODE} {specs} 의 메이저가 .nvmrc({self.major}) 와 다르다 — "
                    "dependabot 이 major 를 올리지 않으므로 런타임을 올리는 PR 에서 함께 올려야 한다",
                )

    def test_every_declaring_manifest_matches_its_own_engines_floor(self):
        for rel, data in sorted(self.declaring.items()):
            with self.subTest(file=rel):
                self.assertEqual(types_node_problems(data), [], f"{rel}: 위 사유를 본다")


class TriggerCoverageTest(unittest.TestCase):
    """이 파일이 읽는 파일을 **혼자** 고친 PR 에서도 harness-checks 가 돌아야 한다.

    `.nvmrc` 는 `test_harness_checks_paths_coverage.py` 가 강제한다. Dockerfile 은 `codebase/` 아래라
    그 가드가 제품 경로로 빼므로 여기서 직접 본다. Node 상향 PR 은 거의 이 파일들만 고친다.
    """

    def test_every_file_read_here_triggers_the_workflow(self):
        pathspecs = parse_pathspecs_block(_read(HARNESS_CHECKS))
        self.assertTrue(pathspecs, f"{_rel(HARNESS_CHECKS)}: pathspecs 블록을 읽지 못했다")
        for path in (NVMRC, BACKEND_DOCKERFILE, FRONTEND_DOCKERFILE, PLAYWRIGHT_DOCKERFILE):
            rel = _rel(path)
            with self.subTest(file=rel):
                self.assertTrue(
                    any(filter_covers_file(spec, rel) for spec in pathspecs),
                    f"{rel} 는 {_rel(HARNESS_CHECKS)} 의 pathspecs 에 없다 — 이 파일만 고친 PR 에서 "
                    "Node 메이저 대조가 돌지 않는다",
                )

    def test_every_manifest_read_here_triggers_the_workflow(self):
        """`@types/node` 대조가 읽는 매니페스트. 런타임을 올리는 PR 은 이 파일들도 고친다."""
        pathspecs = parse_pathspecs_block(_read(HARNESS_CHECKS))
        self.assertTrue(pathspecs, f"{_rel(HARNESS_CHECKS)}: pathspecs 블록을 읽지 못했다")
        manifests = sorted(
            {_rel(p) for p in (*APP_MANIFESTS, SDK_MANIFEST)} | set(_types_node_manifests())
        )
        for rel in manifests:
            with self.subTest(file=rel):
                self.assertTrue(
                    any(filter_covers_file(spec, rel) for spec in pathspecs),
                    f"{rel} 는 {_rel(HARNESS_CHECKS)} 의 pathspecs 에 없다 — 이 파일만 고친 PR 에서 "
                    f"{TYPES_NODE} 대조가 돌지 않는다",
                )


if __name__ == "__main__":
    unittest.main()
