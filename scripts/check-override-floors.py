#!/usr/bin/env python3
"""오버라이드 "바닥 침식" 검출 — 이미 관리 중인 패키지가 다시 취약해졌는지.

`pnpm-workspace.yaml` 의 `overrides` 는 "이 하한 아래로 내려가지 말라" 는 **보안 바닥**
선언이다. 그런데 그 패키지에 **새 CVE 가 공시되면** 바닥은 그대로인 채 취약 버전이 다시
해소된다. 실측 5건 (2026-07-31, `#1036`/`#1038`):

    next>postcss  ^8.5.14 → 필요 >=8.5.18
    liquidjs      ^10.27.0 → 필요 >=10.27.1
    protobufjs    ^7.6.3   → 필요 >=7.6.5
    fast-uri      ^3.1.2   → 필요 >=3.1.4
    hono          ^4.12.21 → 필요 >=4.12.27

`pnpm audit` 이 이것들을 **잡기는 한다** — 실제로 위 4건은 audit 17건 중에 섞여 보고됐다.
본 가드의 가치는 검출이 아니라 **분류**다:

  - 오버라이드가 **없는** 패키지가 취약  → 새로 발견. 상향 가능한지·수용할지 판단이 필요하다.
  - 오버라이드가 **있는데도** 취약        → 이미 "관리하겠다" 고 선언한 패키지의 바닥이 낡은 것.
                                            판단할 게 없다. 값만 올리면 된다.

둘이 한 목록에 섞이면 후자가 묻힌다(`#1038` 이 정확히 그 상태였다 — 17건 중 4건). 그래서
후자만 따로 세워 fail 시킨다. `deps-security-checks.yml` 의 audit 잡은 그대로 두고, 본 가드가
그 옆에서 "관리 중인데 낡은 것" 만 좁혀 보고한다.

`check-pnpm-security-config.py`(순수 로컬 스냅샷 대조)와 분리한 이유: 본 가드는 `pnpm audit`
레지스트리 조회를 **필요로 한다**. 성격이 다른 검사를 한 스크립트에 넣으면 네트워크 장애가
로컬 대조까지 죽인다.

동작 조건 — **본 가드는 `pnpm audit` 의 부분집합이다.** audit 이 보고하지 않으면 아무것도
잡지 않는다. 그래서 "override 값만 낮추면 잡힌다" 가 아니다: caret(`^10.27.0`)은 범위 안
최신을 허용하므로 lockfile 을 재계산하면 패치 버전이 그대로 설치되고 audit 도 조용하다
(실측). 침식이 **실제 위험이 되는 시점**은 lockfile 이 취약 버전에 고정돼 있을 때이고,
그 상태를 audit 이 보고하면 본 가드가 "이건 override 대상이니 값만 올리면 된다" 로 분류한다.

회귀 재현 방법(테스트 작성 시): override 를 caret 없이 취약 버전으로 **고정**(`liquidjs: 10.27.0`)
하고 `pnpm install --lockfile-only` — caret 을 남기면 재현되지 않는다.
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print('ERROR: PyYAML 필요 — CI 는 `pip install "pyyaml>=6,<7"` 후 실행한다.', file=sys.stderr)
    sys.exit(2)

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
WORKSPACE_YAML = REPO_ROOT / "pnpm-workspace.yaml"

# override 키는 세 형태다. 어느 쪽이든 **대상 패키지명** 을 뽑아야 audit advisory 와 맞출 수 있다.
#   1. `lodash`                      → lodash
#   2. `next>postcss`                → postcss   (부모>자식 — 제약 대상은 자식)
#   3. `undici@>=7.0.0 <7.28.0`      → undici    (버전-레인지 스코프)
#
# 순서가 중요하다. `>` 로 먼저 자르면 `undici@>=7.0.0` 의 `>=` 를 부모>자식 구분자로 오인해
# `=7.0.0 <7.28.0` 이 남는다(실측: 그 상태에서 `js-yaml` 스코프 override 2건이 통째로
# 매칭에서 빠져 가드가 조용히 통과했다). 따라서 **버전 레인지를 먼저 떼고** 부모 경로를 자른다.
#
# scope 패키지(`@grpc/grpc-js`)는 선두 `@` 가 이름의 일부라 버전 구분자로 세면 안 된다 —
# 두 번째 이후의 `@` 만 레인지 구분자다.
_RANGE_SUFFIX = re.compile(r"^(?P<name>@[^@/]+/[^@]+|[^@]+)@.+$")


def override_target(key: str) -> str:
    """override 키에서 제약 대상 패키지명을 뽑는다.

    부모 경로(`a>b`)와 버전 레인지(`pkg@>=1.0.0`)가 동시에 올 수 있고, 자식이 scope
    패키지(`next>@types/react`)일 수도 있다. `>` 를 먼저 자르면 `@>=` 의 `>` 에 걸리고,
    레인지를 먼저 떼면 scope 자식의 `/` 앞 `@` 를 잘못 문다. 그래서 **마지막 `>` 뒤부터
    다시 레인지를 떼는** 2단계로 간다 — 단, 레인지 안의 `>`(`>=1.0.0`)에 속지 않도록
    `@` 이전 구간에서만 부모 경로를 찾는다.
    """
    key = key.strip()
    # ① 부모 경로 해소 — `>` 탐색은 **레인지 시작 `@` 이전 구간**에서만. 그래야
    #    `undici@>=7.0.0` 의 `>=` 를 부모 구분자로 오인하지 않는다. scope 패키지는
    #    선두 `@` 가 이름의 일부라 그 다음 `@` 부터가 레인지다.
    at = key.find("@", 1) if key.startswith("@") else key.find("@")
    head = key if at < 0 else key[:at]
    if ">" in head:
        key = key.split(">", 1)[1].strip()
    # ② 남은 이름에서 버전 레인지 제거 (scope 패키지의 선두 `@` 는 보존)
    m = _RANGE_SUFFIX.match(key)
    return (m.group("name") if m else key).strip()


def load_override_targets(path: pathlib.Path) -> dict[str, list[str]]:
    """대상 패키지명 → 그 패키지를 제약하는 override 키 목록."""
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    overrides = data.get("overrides") or {}
    targets: dict[str, list[str]] = {}
    for key in overrides:
        targets.setdefault(override_target(str(key)), []).append(str(key))
    return targets


def run_audit() -> dict:
    """`pnpm audit --json` 실행. audit 은 취약점이 있으면 비-0 으로 끝나므로 코드로 판단하지 않는다."""
    proc = subprocess.run(
        ["pnpm", "audit", "--audit-level=moderate", "--json"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    out = proc.stdout.strip()
    if not out:
        # 취약점 0건이면 pnpm 이 JSON 을 내지 않을 수 있다 — 빈 결과로 취급(정상).
        return {}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        print("ERROR: `pnpm audit --json` 출력을 파싱하지 못했다:", file=sys.stderr)
        print(out[:2000], file=sys.stderr)
        sys.exit(2)


def main() -> int:
    if not WORKSPACE_YAML.exists():
        print(f"ERROR: {WORKSPACE_YAML} 없음", file=sys.stderr)
        return 2

    targets = load_override_targets(WORKSPACE_YAML)
    advisories = (run_audit().get("advisories") or {}).values()

    eroded: list[tuple[str, str, str, list[str]]] = []
    for adv in advisories:
        module = adv.get("module_name")
        if module in targets:
            eroded.append(
                (
                    module,
                    adv.get("github_advisory_id") or adv.get("id") or "?",
                    adv.get("patched_versions") or "?",
                    targets[module],
                )
            )

    if not eroded:
        print(
            f"OK: override 대상 {len(targets)}개 패키지 중 취약 재유입 0건 "
            "(audit 잔여가 있더라도 그건 override 미관리 패키지 — audit 잡이 담당)"
        )
        return 0

    print("ERROR: override 바닥이 낡아 취약 버전이 다시 해소됐다.", file=sys.stderr)
    print(
        "  이 패키지들은 이미 override 로 '관리하겠다' 고 선언한 대상이라 "
        "판단할 게 없다 — 값만 올리면 된다.",
        file=sys.stderr,
    )
    for module, advisory, patched, keys in sorted(eroded):
        print(f"\n  [{module}] {advisory}", file=sys.stderr)
        print(f"    필요 하한 : {patched}", file=sys.stderr)
        print(f"    현재 키   : {', '.join(keys)}", file=sys.stderr)
    print(
        "\n  조치: pnpm-workspace.yaml 의 해당 override 값을 올리고 "
        "`scripts/check-pnpm-security-config.py` 의 EXPECTED_OVERRIDES 도 **함께** 갱신한다"
        "(2-place 규약 — 한쪽만 고치면 스냅샷 가드가 실패한다).",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
