#!/usr/bin/env python3
"""e2e frontend(playwright) Docker 설정 정합 가드.

`docker-compose.e2e.yml` 의 `playwright-runner` 는 사전 빌드 이미지
(`codebase/frontend/Dockerfile.playwright-e2e`)에 frontend deps + chromium 을 baking 한다.
두 종류의 **수동 동기화 목록**이 drift 하면 CI 가 조용히 잘못 돌 수 있어 fail-fast 로 잡는다:

  1. **playwright 버전 ↔ base 이미지 태그** — base 이미지
     (`mcr.microsoft.com/playwright:vX.Y.Z-jammy`)에 내장된 브라우저 바이너리·OS 라이브러리는
     설치되는 `@playwright/test` 와 major.minor 가 맞아야 호환된다. `@playwright/test` 의 SoT 는
     frontend package.json(→ lockfile 해소)인데, caret 상향으로 해소 버전이 올라가도 base 태그는
     자동으로 안 따라온다(예: `^1.59.1` → 1.62 해소인데 태그는 여전히 v1.61). 해소된 major.minor 와
     Dockerfile base 태그 major.minor 가 다르면 실패.

  2. **frontend `@workflow/*` 클로저 ↔ Dockerfile COPY** — Dockerfile 은 frontend 의 내부 패키지
     클로저 소스를 `COPY codebase/packages/<pkg>` 로 가져온다. 이 집합이 frontend 의 실제
     `@workflow/*` 의존과 어긋나면 실패.

  3. **playwright-runner 의 bind-mount 가 `codebase/packages` 를 덮지 않을 것** — 이미지는 각
     패키지의 `prepare`(=tsc)로 `dist` 를 만들어 두는데, 그 경로를 호스트에서 bind-mount 하면
     dist 없는 사본이 덮어써 `main: dist/index.js` 해석이 실패한다(`Module not found:
     Can't resolve '@workflow/*'`). 종전 검사는 "패키지별 `node_modules` 마스킹 목록 == 클로저"
     라는 **손으로 유지되는 목록 대조**였고, 정작 `dist` 는 마스킹 대상이 아니어서 `./codebase`
     통마운트를 통과시켰다 — 2026-08-06 CI 첫 실행에서 드러났다. 목록 대신 불변식을 본다.

종료 코드: 정상 0, 위반 1.

사용:
    python3 scripts/check-e2e-playwright-config.py [--root <repo-root>]

CI: `.github/workflows/e2e.yml` 의 `config-guard` job(e2e job 들의 `needs`) 및 harness unittest
`.claude/tests/test_check_e2e_playwright_config.py`. 의존성: Python 3 표준 라이브러리만.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

FRONTEND_PKG = Path("codebase/frontend/package.json")
PLAYWRIGHT_DOCKERFILE = Path("codebase/frontend/Dockerfile.playwright-e2e")
COMPOSE = Path("docker-compose.e2e.yml")
LOCKFILE = Path("pnpm-lock.yaml")
PACKAGES_DIR = Path("codebase") / "packages"

# 아래 세 정규식은 모두 **라인 시작 앵커(^) + re.MULTILINE** 을 쓴다 — 주석·changelog 등에
# 우연히 등장하는 동일 문자열을 실제 지시문/리스트 항목으로 오인(false match)하지 않기 위함.
# (가드의 존재 이유가 "누락을 조용히 통과시키지 않는 것" 이라, 주석 잔재를 실제 마스킹으로
# 오판하는 false-negative 를 특히 차단해야 한다.)
_BASE_TAG_RE = re.compile(
    r"^FROM\s+mcr\.microsoft\.com/playwright:v(\d+)\.(\d+)\.\d+-\w+",
    re.MULTILINE,
)
# 소스 전체 COPY (manifest `.../package.json` COPY 는 제외): `COPY codebase/packages/<x> ./...`
_DOCKERFILE_COPY_RE = re.compile(
    r"^COPY\s+codebase/packages/([A-Za-z0-9._-]+)\s+\./codebase/packages/",
    re.MULTILINE,
)
# 실제 YAML volumes 리스트의 **bind-mount** 항목(`- <host>:<container>[:opts]`)에만 매치.
# 익명 볼륨(`- /app/...`)은 콜론이 없어 걸리지 않는다 — 그쪽은 호스트를 들여오지 않으므로
# 패키지를 덮을 수 없다. 주석에 남은 경로는 라인 시작 앵커로 배제된다.
_COMPOSE_BIND_RE = re.compile(
    r"^\s*-\s*([^\s:#][^:]*):(/[^\s:]+)(?::[a-z,]+)?\s*(?:#.*)?$",
    re.MULTILINE,
)

# 이 경로 아래에 이미지가 `prepare`(=tsc)로 만든 `dist` 가 있다. 여기를 덮는 bind-mount 는
# dist 를 지운다 — 아래 `_mount_covers` 참조.
_PACKAGES_IN_CONTAINER = "/app/codebase/packages"


def _read(root: Path, rel: Path) -> str | None:
    p = root / rel
    return p.read_text(encoding="utf-8") if p.is_file() else None


def frontend_playwright_version(root: Path) -> str | None:
    """pnpm-lock.yaml 의 `codebase/frontend:` importer 블록에서 @playwright/test 해소 버전."""
    text = _read(root, LOCKFILE)
    if text is None:
        return None
    lines = text.splitlines()
    in_frontend = False
    saw_pw = False
    for line in lines:
        if re.match(r"^  codebase/frontend:\s*$", line):
            in_frontend = True
            continue
        if in_frontend and re.match(r"^  \S", line):
            # 다음 importer / 최상위 키 → frontend 블록 종료.
            break
        if not in_frontend:
            continue
        if re.search(r"['\"]?@playwright/test['\"]?:\s*$", line):
            saw_pw = True
            continue
        if saw_pw:
            m = re.match(r"\s*version:\s*(\S+)\s*$", line)
            if m:
                return m.group(1)
            # specifier: 라인 등은 건너뛰고 version 을 기다린다.
    return None


def base_tag_major_minor(root: Path) -> tuple[int, int] | None:
    text = _read(root, PLAYWRIGHT_DOCKERFILE)
    if text is None:
        return None
    m = _BASE_TAG_RE.search(text)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def dockerfile_copy_dirs(root: Path) -> set[str]:
    text = _read(root, PLAYWRIGHT_DOCKERFILE)
    if text is None:
        return set()
    return set(_DOCKERFILE_COPY_RE.findall(text))


def playwright_runner_block(text: str) -> str | None:
    """compose 문서에서 `playwright-runner:` 서비스 블록만 잘라낸다.

    스코프가 필요하다: `backend-e2e-runner` 는 `./codebase/backend:/app/codebase/backend` 를
    **정당하게** bind-mount 하므로, 문서 전체를 훑으면 그 줄을 위반으로 오인한다.
    """
    m = re.search(r"^(\s*)playwright-runner:\s*$", text, re.MULTILINE)
    if m is None:
        return None
    indent, start = len(m.group(1)), m.end()
    lines = text[start:].splitlines()
    out: list[str] = []
    for ln in lines:
        if ln.strip() and not ln.startswith(" " * (indent + 1)):
            break  # 같은(또는 더 얕은) 들여쓰기 = 다음 서비스
        out.append(ln)
    return "\n".join(out)


def compose_host_mount_targets(root: Path) -> list[str] | None:
    """playwright-runner 의 **bind-mount 컨테이너 경로** 목록. 블록이 없으면 None.

    익명 볼륨(`- /app/...`, 콜론 없음)은 호스트를 들여오지 않으므로 대상이 아니다.
    """
    text = _read(root, COMPOSE)
    if text is None:
        return None
    block = playwright_runner_block(text)
    if block is None:
        return None
    return [m.group(2) for m in _COMPOSE_BIND_RE.finditer(block)]


def _mount_covers(target: str, path: str = _PACKAGES_IN_CONTAINER) -> bool:
    """컨테이너 마운트 대상 `target` 이 `path` 를 덮는가 (자기 자신 또는 조상)."""
    t = "/" + target.strip("/")
    p = "/" + path.strip("/")
    return p == t or p.startswith(t.rstrip("/") + "/")


def pkgname_to_dir(root: Path) -> dict[str, str]:
    """codebase/packages/*/package.json 의 `name` → 디렉터리명 맵 (name≠dir 케이스 대응)."""
    out: dict[str, str] = {}
    base = root / PACKAGES_DIR
    if not base.is_dir():
        return out
    for entry in sorted(base.iterdir()):
        manifest = entry / "package.json"
        if manifest.is_file():
            try:
                name = json.loads(manifest.read_text(encoding="utf-8")).get("name")
            except json.JSONDecodeError:
                continue
            if name:
                out[name] = entry.name
    return out


def frontend_workflow_closure_dirs(root: Path) -> tuple[set[str], list[str]]:
    """frontend 의 @workflow/* 직접 의존을 패키지 디렉터리 집합으로. (내부 패키지 간 @workflow
    상호 의존은 없어 직접=클로저.) 두 번째 반환값은 dir 매핑 실패한 의존명(진단용)."""
    text = _read(root, FRONTEND_PKG)
    if text is None:
        return set(), []
    manifest = json.loads(text)
    deps = {
        **manifest.get("dependencies", {}),
        **manifest.get("devDependencies", {}),
    }
    name_map = pkgname_to_dir(root)
    dirs: set[str] = set()
    unmapped: list[str] = []
    for name in deps:
        if name.startswith("@workflow/"):
            d = name_map.get(name)
            if d:
                dirs.add(d)
            else:
                unmapped.append(name)
    return dirs, unmapped


def check(root: Path) -> list[str]:
    failures: list[str] = []

    # --- 검사 1: @playwright/test 해소 major.minor ↔ base 태그 ---
    resolved = frontend_playwright_version(root)
    base = base_tag_major_minor(root)
    if resolved is None:
        failures.append(
            f"[e2e-config-guard] FAIL: could not read @playwright/test resolved version from "
            f"{LOCKFILE} (codebase/frontend importer)."
        )
    if base is None:
        failures.append(
            f"[e2e-config-guard] FAIL: could not read playwright base image tag "
            f"(mcr.microsoft.com/playwright:vX.Y.Z-*) from {PLAYWRIGHT_DOCKERFILE}."
        )
    if resolved is not None and base is not None:
        rm = re.match(r"^(\d+)\.(\d+)\.", resolved)
        if not rm:
            failures.append(
                f"[e2e-config-guard] FAIL: unexpected @playwright/test version '{resolved}'."
            )
        else:
            r_mm = (int(rm.group(1)), int(rm.group(2)))
            if r_mm != base:
                failures.append(
                    "[e2e-config-guard] FAIL: playwright version ↔ base image tag mismatch.\n"
                    f"    @playwright/test resolved  = {resolved} (major.minor {r_mm[0]}.{r_mm[1]}) "
                    f"[{LOCKFILE} codebase/frontend]\n"
                    f"    base image tag             = v{base[0]}.{base[1]}.x [{PLAYWRIGHT_DOCKERFILE}]\n"
                    f"    → align the base tag to v{r_mm[0]}.{r_mm[1]}.x-<distro> (and the "
                    f"docker-compose.e2e.yml comment) when @playwright/test moves."
                )

    # --- 검사 2: frontend @workflow 클로저 ↔ Dockerfile COPY ---
    closure, unmapped = frontend_workflow_closure_dirs(root)
    copies = dockerfile_copy_dirs(root)
    if unmapped:
        failures.append(
            "[e2e-config-guard] FAIL: frontend @workflow dep(s) not resolvable to a "
            f"codebase/packages/<dir>: {', '.join(sorted(unmapped))}."
        )
    if not closure:
        failures.append(
            f"[e2e-config-guard] FAIL: no @workflow/* deps found in {FRONTEND_PKG}."
        )
    else:
        if closure != copies:
            failures.append(
                "[e2e-config-guard] FAIL: frontend @workflow closure ≠ Dockerfile COPY set.\n"
                f"    frontend @workflow closure = {sorted(closure)} [{FRONTEND_PKG}]\n"
                f"    Dockerfile COPY packages   = {sorted(copies)} [{PLAYWRIGHT_DOCKERFILE}]\n"
                f"    missing from Dockerfile: {sorted(closure - copies) or '—'}; "
                f"extra in Dockerfile: {sorted(copies - closure) or '—'}"
            )
    # --- 검사 3: playwright-runner 의 bind-mount 가 패키지를 덮지 않을 것 ---
    # 종전에는 "패키지별 node_modules 마스킹 목록 == 클로저" 를 대조했다. 그 목록은 손으로
    # 유지되는 것이었고, 정작 `dist` 는 마스킹 대상이 아니어서 `./codebase` 통마운트가
    # 이미지의 dist 를 덮어도 통과했다 — 2026-08-06 CI 첫 실행에서 next build 가
    # `Module not found: Can't resolve '@workflow/*'` 로 죽으며 드러났다. 목록 대조 대신
    # **불변식**(패키지 경로를 덮는 호스트 마운트가 없을 것)을 본다. 목록이 없으니
    # 신규 패키지가 추가돼도 갱신할 것이 없다.
    targets = compose_host_mount_targets(root)
    if targets is None:
        failures.append(
            f"[e2e-config-guard] FAIL: playwright-runner 서비스 블록을 {COMPOSE} 에서 "
            "찾지 못했다 (서비스명이 바뀌었다면 이 가드도 함께 갱신할 것)."
        )
    else:
        covering = [t for t in targets if _mount_covers(t)]
        if covering:
            failures.append(
                "[e2e-config-guard] FAIL: playwright-runner 의 bind-mount 가 "
                f"{_PACKAGES_IN_CONTAINER} 를 덮는다: {covering}.\n"
                "    이미지가 `prepare`(tsc)로 만든 codebase/packages/*/dist 가 호스트 사본으로\n"
                "    덮여 사라지고, 내부 패키지는 main: dist/index.js 라 next build 가\n"
                "    `Module not found: Can't resolve '@workflow/*'` 로 죽는다.\n"
                "    → frontend subtree 만 mount 할 것 "
                "(`./codebase/frontend:/app/codebase/frontend`), "
                "backend-e2e-runner 와 동형."
            )

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(
        description="e2e playwright base 태그·frontend 내부패키지 클로저 정합 가드."
    )
    parser.add_argument(
        "--root",
        default=None,
        help="repository 루트 (기본은 스크립트의 부모의 부모).",
    )
    args = parser.parse_args()
    root = Path(args.root).resolve() if args.root else Path(__file__).resolve().parent.parent

    failures = check(root)
    if failures:
        for msg in failures:
            print(msg)
        print(
            f"\n[e2e-config-guard] {len(failures)} violation(s). See "
            "codebase/frontend/Dockerfile.playwright-e2e / docker-compose.e2e.yml headers.",
            file=sys.stderr,
        )
        return 1

    resolved = frontend_playwright_version(root)
    closure, _ = frontend_workflow_closure_dirs(root)
    print(
        f"[e2e-config-guard] OK: @playwright/test {resolved} ↔ base tag aligned; "
        f"@workflow closure ({len(closure)}) synced with Dockerfile COPY; "
        f"playwright-runner mounts do not cover {_PACKAGES_IN_CONTAINER}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
