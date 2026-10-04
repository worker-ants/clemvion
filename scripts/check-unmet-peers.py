#!/usr/bin/env python3
"""미충족 peer 관측 — frozen 게이트가 구조적으로 못 보는 사각지대.

## 왜 필요한가 (2026-08-28 실측)

이 저장소는 `pnpm install --strict-peer-dependencies` 를 **설치 호출부 5곳 전부**에
넣어 뒀다(옛 plan `deps-peer-gating-and-eslint10.md` §1, git 이력). 그런데 그 5곳이
**전부 `--frozen-lockfile` 과 함께** 쓴다. frozen 은 해소를 다시 하지 않으므로 pnpm 이
peer 를 재계산할 일이 없고, 따라서 **이미 lockfile 에 박혀 있는 미충족 peer 는 영원히
보고되지 않는다.**

실측표 — 같은 저장소 상태에서 명령만 바꿔 잰 것:

    조건                                                          결과
    ─────────────────────────────────────────────────────────────────────
    fresh 체크아웃(node_modules 없음)                             exit 0
      + `install --frozen-lockfile --strict-peer-dependencies`    보고 0건
      ← **CI 5곳이 실제로 도는 형태**
    node_modules 있음 + `install --strict-peer-dependencies`      exit 0
      (매니페스트 무변경 → 재해소 자체가 일어나지 않는다)          보고 0건
    `install --lockfile-only --strict-peer-dependencies`          exit 0
      (lockfile 이 최신이면 no-op)                                보고 0건
    **lockfile 제거 후** `--lockfile-only --strict-peer-…`        **exit 1, 2건**

즉 **재해소가 일어날 때만** peer 가 계산된다. 마지막 줄이 이 스크립트가 쓰는 트리거다.

## 이 가드가 답하는 질문 — 정확히 이것 하나다

> "지금 매니페스트로 **새로 해소하면** 미충족 peer 가 생기는가?"

`--frozen-lockfile` 게이트가 답하는 "지금 lockfile 로 설치가 되는가" 와 **다른 질문**이다.
전자가 넓다 — 누군가 매니페스트를 건드려 재해소가 일어나는 순간 드러날 것을 미리 본다.

**한계를 정직하게 적는다**: 재해소는 lockfile 핀을 무시하고 범위 내 최신을 고른다. 그래서
우리 lockfile 이 실제로는 고르지 않을 조합이 보고될 수 있다. 그건 오탐이 아니라 **선행
경고**다 — 다음 매니페스트 변경이 그 조합을 실제로 끌어온다.

## 왜 차단이 아니라 관측인가

미충족 peer 는 대개 **상류 사정**이다(우리가 고칠 수 없다). PR 을 막으면 남의 릴리스가
이 저장소의 main 을 빨갛게 만든다. 그래서 주간 스케줄로만 돌린다
(`.github/workflows/deps-peer-observe.yml`) — PR 체크가 아니다.

## 왜 baseline 이 있는가 — 없으면 이 잡은 죽은 신호다

착수 시점에 이미 2건이 있다. baseline 없이 돌리면 **첫 주부터 영구 빨간불**이고, 영구
빨간불은 한 달 안에 아무도 안 본다. 그래서 `ACCEPTED` 에 등재된 것만 통과시키고 **새로
생긴 것**에서만 실패한다 — `check-pnpm-security-config.py` 의 `EXPECTED_*` 스냅샷 규약과
같은 형태다.

**양방향 fail-closed**: 등재된 항목이 **사라져도** 실패한다. 이 저장소가 반복해 배운 것이
"막을 대상이 없는 억제는 죽은 설정이고 나중에 진짜 문제를 조용히 덮는다" 이기 때문이다
(§1 이 `peerDependencyRules` 를 넣었다 되돌린 이유가 정확히 그것). 해소된 항목은 등재에서
지워야 하고, 이 가드가 그 시점을 알려준다.
"""
from __future__ import annotations

import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from typing import NoReturn

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

# 재해소에 필요한 루트 파일. lockfile 은 일부러 뺀다 — 없어야 재해소가 일어난다.
# `.npmrc` 는 해소 결과를 바꾸는 설정(node-linker 등)이라 있으면 함께 옮긴다.
_ROOT_FILES_REQUIRED = ("package.json", "pnpm-workspace.yaml")
_ROOT_FILES_OPTIONAL = (".npmrc",)

# 재해소가 걸리는 상한. 워크스페이스 12개 · 의존성 ~2,000개 해소가 로컬에서 ~40초였고,
# CI 러너는 그보다 느리며 레지스트리 지연도 탄다. 넉넉히 준다 — 이 잡은 주간 1회다.
_RESOLVE_TIMEOUT_SEC = 900

_STDERR_PREVIEW = 2000

# ── 수용된 미충족 peer 등재부 ──────────────────────────────────────────────────
#
# 키는 `(부모 패키지, peer 이름)`. 값은 **왜 무해한가** 의 근거다.
#
# 등재 기준은 이 저장소가 peer 억제에 요구하는 것과 같다 — "동작할 것이다" 가 아니라
# **"그 코드에 도달하지 않는다"** (`pnpm-workspace.yaml` §peer dependency 게이트).
# 그 수준의 실측 없이 여기 넣지 말 것. 넣으면 이 가드는 그 순간부터 거짓말을 한다.
ACCEPTED: dict[tuple[str, str], str] = {
    ("typeorm", "ioredis"): (
        "typeorm 의 ioredis peer 는 **Redis query cache** 전용인데 이 저장소는 그 기능을 "
        "켜지 않는다 — 루트 옵션 `codebase/backend/src/database/typeorm-options.ts` 의 "
        "`buildRootTypeOrmOptions` 에 `cache` 키가 없다(2026-08-28 실측, 2026-10-04 옵션 이동 뒤 재확인). 즉 typeorm 이 ioredis 를 로드하는 "
        "코드 경로에 **도달하지 않는다**. backend 가 실제로 쓰는 ioredis 는 직접 의존 "
        "`^6.0.0` 이고 BullMQ·rate limiter·dedup·seq allocator·continuation bus·health "
        "경로다 — typeorm 과 겹치지 않는 별개 소비자다. "
        "해제 조건: `buildRootTypeOrmOptions` 에 `cache` 옵션이 생기면 그 즉시 재심사."
    ),
    # (묘비) `("nunjucks", "chokidar")` 는 2026-10-04 에 지웠다. nunjucks 는
    # `@nestjs-modules/mailer` 의 optionalDependencies 로 들어오던 전이 의존이었고, NestJS 12
    # 상향(NERV Task CLE-T-3X627J)에서 mailer 를 걷어 내면서 트리에서 빠졌다.
}

# `✕ unmet peer <이름>@<범위>: found <버전>` — pnpm 10 의 실제 출력에서 딴 것.
#
# `✕` 는 U+2715 다. 이 저장소는 박스 문자를 ASCII 로 착각해 측정 명령이 틀렸던 전례가
# 있어(U+2502 vs `|`), **마커 문자에 기대지 않고** `unmet peer` 라는 ASCII 단어에 건다.
_UNMET_RE = re.compile(r"unmet peer\s+(?P<peer>@?[^@\s]+(?:/[^@\s]+)?)@(?P<range>[^:]+):")

# 부모 패키지 줄 — `├─┬ typeorm 0.3.31` / `└─┬ nunjucks 3.2.4`.
# 여기도 트리 아트(U+251C·U+2500·U+252C…)에 기대지 않는다: 줄 끝의 `<이름> <버전>` 만 본다.
_PARENT_RE = re.compile(r"(?P<name>@?[\w.-]+(?:/[\w.-]+)?)\s+(?P<version>\d[\w.+-]*)\s*$")


def _die(msg: str) -> NoReturn:
    print(f"\nERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def _workspace_globs(repo_root: pathlib.Path) -> list[str]:
    """`pnpm-workspace.yaml` 의 `packages` 글로브를 읽는다. 못 읽으면 실패한다.

    목록을 못 읽은 채 루트 매니페스트만으로 재해소하면 워크스페이스 패키지의 의존이 통째로
    빠져 "미충족 0건" 이 나온다. 그것은 통과가 아니라 측정 실패다(fail-closed).
    """
    try:
        import yaml
    except ImportError:
        _die('PyYAML 이 필요하다 — `pip install "pyyaml>=6,<7"`.')
    try:
        data = yaml.safe_load((repo_root / "pnpm-workspace.yaml").read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as exc:
        _die(f"pnpm-workspace.yaml 을 읽지 못했다: {exc}")
    globs = data.get("packages") if isinstance(data, dict) else None
    if not isinstance(globs, list) or not globs or not all(isinstance(g, str) and g for g in globs):
        _die("pnpm-workspace.yaml 의 packages 가 비었거나 문자열 목록이 아니다 — 재해소할 워크스페이스를 알 수 없다.")
    return globs


def stage_manifests(repo_root: pathlib.Path, dest: pathlib.Path) -> list[str]:
    """재해소에 필요한 파일만 `dest` 로 복사하고 복사한 상대 경로를 돌려준다.

    루트 `package.json` · `pnpm-workspace.yaml` · `.npmrc` 와 워크스페이스 글로브에 걸리는
    디렉터리의 `package.json` 만 옮긴다. `!` 로 시작하는 제외 글로브는 복사한
    `pnpm-workspace.yaml` 안에 그대로 남아 pnpm 이 적용하므로 여기서 따로 다루지 않는다.
    """
    copied: list[str] = []

    def _copy(rel: pathlib.Path) -> None:
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(repo_root / rel, target)
        copied.append(rel.as_posix())

    for name in _ROOT_FILES_REQUIRED:
        if not (repo_root / name).is_file():
            _die(f"{name} 이 없다: {repo_root / name}")
        _copy(pathlib.Path(name))
    for name in _ROOT_FILES_OPTIONAL:
        if (repo_root / name).is_file():
            _copy(pathlib.Path(name))

    for pattern in _workspace_globs(repo_root):
        if pattern.startswith("!"):
            continue
        for pkg_dir in sorted(repo_root.glob(pattern)):
            manifest = pkg_dir / "package.json"
            rel = manifest.relative_to(repo_root)
            if manifest.is_file() and "node_modules" not in rel.parts and rel.as_posix() not in copied:
                _copy(rel)
    return copied


def resolve_fresh(repo_root: pathlib.Path = REPO_ROOT) -> tuple[int, str]:
    """lockfile 없이 매니페스트만으로 재해소하고 (exit code, 출력) 을 돌려준다.

    **저장소 밖 임시 디렉터리에서 돈다.** 매니페스트만 그곳으로 복사하고(`stage_manifests`)
    거기서 `pnpm install --lockfile-only` 를 부르므로 저장소의 어떤 파일도 쓰거나 지우지 않는다.

    예전에는 저장소의 `pnpm-lock.yaml` 을 임시 위치로 옮기고 그 자리에서 재해소한 뒤 `finally` 로
    되돌렸다. 원복은 지켜졌지만 실행 중에는 작업 트리의 lockfile 이 없거나 새로 해소된 판이었다.
    2026-10-04 같은 worktree 에서 리뷰어 넷이 이 스크립트를 동시에 돌리는 동안 테스트(Docker 이미지가
    lockfile 을 COPY)가 돌았고 lockfile 부재가 관측됐다(NERV Task `CLE-T-DDA7V4`).
    """
    with tempfile.TemporaryDirectory(prefix="unmet-peers-") as tmp:
        work = pathlib.Path(tmp)
        stage_manifests(repo_root, work)
        try:
            proc = subprocess.run(
                ["pnpm", "install", "--lockfile-only", "--strict-peer-dependencies"],
                cwd=work,
                capture_output=True,
                text=True,
                timeout=_RESOLVE_TIMEOUT_SEC,
            )
        except FileNotFoundError:
            _die("pnpm 을 찾을 수 없다 — PATH 를 확인하라.")
        except subprocess.TimeoutExpired:
            _die(f"재해소가 {_RESOLVE_TIMEOUT_SEC}s 안에 끝나지 않았다.")
        return proc.returncode, proc.stdout + proc.stderr


def parse_unmet(output: str) -> set[tuple[str, str]]:
    """출력에서 `(부모 패키지, 미충족 peer 이름)` 집합을 뽑는다.

    부모는 `unmet peer` 줄 **위쪽**에서 가장 가까운 패키지 노드 줄이다. pnpm 은 부모마다
    한 번 찍고 그 아래에 미충족들을 나열하므로 이 방향이 맞다.
    """
    found: set[tuple[str, str]] = set()
    parent = ""
    for raw in output.splitlines():
        line = raw.rstrip()
        m = _UNMET_RE.search(line)
        if m:
            found.add((parent, m.group("peer")))
            continue
        p = _PARENT_RE.search(line)
        if p and "unmet peer" not in line:
            parent = p.group("name")
    return found


def main() -> int:
    code, output = resolve_fresh()
    found = parse_unmet(output)

    # fail-closed — 종료 코드는 미충족을 알리는데 파서가 아무것도 못 뽑았다면, 출력 형태가
    # 바뀐 것이지 "문제 없음" 이 아니다. 조용히 통과시키면 이 가드는 그 순간부터 무의미하다.
    if code != 0 and not found:
        print(output[-_STDERR_PREVIEW:], file=sys.stderr)
        _die(
            "pnpm 이 비영(非零)으로 끝났는데 미충족 peer 를 하나도 파싱하지 못했다.\n"
            "  출력 형태가 바뀌었거나(파서 갱신 필요) 재해소 자체가 실패한 것이다.\n"
            "  위 출력 꼬리를 보고 판단하라 — 통과시키지 않는다."
        )

    accepted = set(ACCEPTED)
    new = sorted(found - accepted)
    gone = sorted(accepted - found)

    for parent, peer in sorted(found & accepted):
        print(f"  [수용됨] {parent} → {peer}")

    if not new and not gone:
        print(f"\nOK — 미충족 peer {len(found)}건, 전부 등재된 수용 항목이다.")
        return 0

    if new:
        print("\nERROR: 등재되지 않은 미충족 peer 가 새로 생겼다.", file=sys.stderr)
        print("  상류 사정일 수 있다 — 고치기 전에 **도달 가능한 코드 경로인지** 먼저 재라.", file=sys.stderr)
        for parent, peer in new:
            print(f"    {parent} → {peer}", file=sys.stderr)
        print(
            "\n  조치: (1) 해소 가능하면 해소한다. (2) 도달 불가임을 실측했다면\n"
            "  `scripts/check-unmet-peers.py` 의 `ACCEPTED` 에 **근거와 함께** 등재한다.\n"
            "  근거 기준은 '동작할 것이다' 가 아니라 '그 코드에 도달하지 않는다' 다.",
            file=sys.stderr,
        )

    if gone:
        print("\nERROR: 수용 등재돼 있는데 더 이상 보고되지 않는 항목이 있다.", file=sys.stderr)
        for parent, peer in gone:
            print(f"    {parent} → {peer}", file=sys.stderr)
        print(
            "\n  상류가 고쳤거나 그 의존이 트리에서 사라진 것이다. **등재에서 지워라** —\n"
            "  막을 대상이 없는 수용은 죽은 설정이고, 나중에 같은 이름의 진짜 문제를\n"
            "  조용히 덮는다(§1 이 `peerDependencyRules` 를 넣었다 되돌린 이유).",
            file=sys.stderr,
        )

    return 1


if __name__ == "__main__":
    sys.exit(main())
