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

# `ignoreCves` 로 수용된 CVE 가 걸린 override 대상 패키지의 **수용 시점 경로 집합**.
#
# `ignoreCves` 는 CVE-ID 단위 전역 억제라 그 자체로는 "어느 경로를 수용했는지" 를 담지 못한다.
# 그래서 경로를 여기 고정해 **경로가 늘어나면**(= 수용 범위 밖 재유입) fail 시킨다.
# 수용을 늘리거나 줄일 때 `pnpm-workspace.yaml` 의 `auditConfig.ignoreCves` 와 **함께** 갱신한다
# — 이 2-place 편집이 리뷰 게이트다(`check-pnpm-security-config.py` 와 같은 방식).
EXPECTED_SUPPRESSED_PATHS: dict[str, set[str]] = {
    # CVE-2026-14257 (brace-expansion DoS). 1.x 는 백포트가 없고 이 경로는 dev 전용
    # (@eslint/eslintrc → lint 툴체인)이라 수용했다. 2.x/5.x 는 override 로 해소돼 있다.
    "brace-expansion": {
        "codebase__backend>@eslint/eslintrc>minimatch>brace-expansion",
    },
}

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
    cut = head.rfind(">")  # 첫 `>` 가 아니라 **마지막** — `a>b>c` 의 대상은 `c` 다.
    if cut >= 0:
        key = key[cut + 1:].strip()
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
    """`pnpm audit --json` 실행.

    audit 은 취약점이 있으면 비-0 으로 끝나므로 returncode 로 성공을 판단할 수 없다. 대신
    **출력이 기대 형태인지**로 판단하고, 아니면 fail-closed(exit 2) 한다 — 레지스트리 오류나
    인증 실패를 "취약점 0건" 으로 오해하면 본 가드가 정확히 자신이 막으려는 조용한 통과를
    재현한다.
    """
    proc = subprocess.run(
        ["pnpm", "audit", "--audit-level=moderate", "--json"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    out = proc.stdout.strip()
    if not out:
        print(
            "ERROR: `pnpm audit --json` 이 아무것도 출력하지 않았다 — 취약점 0건과 구분할 수 "
            "없으므로 판단 불가로 처리한다(fail-closed).",
            file=sys.stderr,
        )
        print(f"  exit={proc.returncode} stderr={proc.stderr[:500]}", file=sys.stderr)
        sys.exit(2)
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        print("ERROR: `pnpm audit --json` 출력을 파싱하지 못했다:", file=sys.stderr)
        print(out[:2000], file=sys.stderr)
        sys.exit(2)
    if not isinstance(data, dict) or "actions" not in data:
        # 정상 응답이면 `actions`/`advisories`/`metadata` 를 갖는다. 없으면 오류 페이로드다.
        print(
            "ERROR: `pnpm audit --json` 응답이 기대 형태가 아니다(`actions` 없음) — "
            "레지스트리 오류로 보고 판단 불가로 처리한다(fail-closed).",
            file=sys.stderr,
        )
        print(f"  받은 키: {list(data)[:10] if isinstance(data, dict) else type(data).__name__}", file=sys.stderr)
        sys.exit(2)
    return data


def classify_vulnerable(audit: dict) -> tuple[dict[str, str], dict[str, list[str]]]:
    """취약 패키지를 **자동 판정 가능한 것**과 **수용되어 억제된 것**으로 가른다.

    반환: `(reported, suppressed)`
      - `reported`  — `advisories` 에 살아있는 것. 패키지 → advisory id. 자동 fail 대상.
      - `suppressed`— `actions[]` 에만 있는 것(= `auditConfig.ignoreCves` 로 수용됨).
                      패키지 → 경로 목록. **자동 판정 불가** — 아래 설명 참조.

    `ignoreCves` 는 CVE-ID 단위 **전역** 억제라 `advisories` 에서 통째로 사라진다(경로·버전
    무관). 그런데 수용은 **그때 확인한 경로**에 대한 판단이었다 — 같은 CVE 가 다른 경로나
    버전으로 재유입되면 수용 범위 밖인데도 함께 억제된다.

    실측(2026-08-01): `brace-expansion` 은 override 3키 + `CVE-2026-14257` 수용을 동시에
    갖는다. 2.x 스코프를 취약 버전(`2.1.4`)으로 되돌리자 그 버전이 **실제로 설치됐는데**
    `advisories` 는 0건이었다.

    pnpm 은 억제된 항목도 `actions[]`(module + `resolves[].path`)에는 남기므로 **존재는**
    알 수 있다. 그러나 거기엔 "수용된 그 경로인지, 새로 늘어난 경로인지" 를 가릴 기준이 없다 —
    `ignoreCves` 가 CVE ID 만 담고 수용 시점의 경로를 담지 않기 때문이다. 그래서 이 부류는
    **fail 시키지 않고 수동 점검 대상으로 보고**한다. fail 시키면 정상 상태(수용된 경로 그대로)
    에서도 매번 빨간불이 되어 가드가 무시당한다(실측: 그 상태를 한 번 만들었다).

    경로 집합까지 baseline 으로 고정하는 것이 근본 해결이며 plan 에 후속으로 등재했다.
    """
    reported: dict[str, str] = {}
    for name, adv in (audit.get("advisories") or {}).items():
        module = adv.get("module_name")
        if module:
            reported[module] = adv.get("github_advisory_id") or adv.get("id") or name

    suppressed: dict[str, list[str]] = {}
    for action in audit.get("actions") or []:
        module = action.get("module")
        if module and module not in reported:
            paths = [r.get("path", "?") for r in (action.get("resolves") or [])]
            suppressed.setdefault(module, []).extend(paths)
    return reported, suppressed


def main() -> int:
    if not WORKSPACE_YAML.exists():
        print(f"ERROR: {WORKSPACE_YAML} 없음", file=sys.stderr)
        return 2

    targets = load_override_targets(WORKSPACE_YAML)
    audit = run_audit()
    reported, suppressed = classify_vulnerable(audit)
    patched_by_module = {
        adv.get("module_name"): adv.get("patched_versions") or "?"
        for adv in (audit.get("advisories") or {}).values()
        if adv.get("module_name")
    }

    # 수용(ignoreCves)되어 억제된 것 중 override 대상 — baseline 경로 집합과 대조한다.
    # advisory 가 억제돼 있어도 **경로가 늘면** 수용 범위 밖 재유입이므로 fail 이다.
    widened: list[tuple[str, set[str]]] = []
    for module, paths in sorted(suppressed.items()):
        if module not in targets:
            continue
        actual = set(paths)
        allowed = EXPECTED_SUPPRESSED_PATHS.get(module, set())
        extra = actual - allowed
        if extra:
            widened.append((module, extra))

    if widened:
        print(
            "ERROR: `ignoreCves` 로 수용된 CVE 가 **수용 범위 밖 경로**로 재유입됐다.",
            file=sys.stderr,
        )
        print(
            "  수용은 그때 확인한 경로에 대한 판단이었다 — 경로가 늘었다면 다시 판단해야 한다.",
            file=sys.stderr,
        )
        for module, extra in widened:
            print(f"\n  [{module}] 신규 경로 {len(extra)}건", file=sys.stderr)
            for path in sorted(extra):
                print(f"    - {path}", file=sys.stderr)
        print(
            "\n  조치: override 로 해소하거나, 수용이 타당하면 "
            "`EXPECTED_SUPPRESSED_PATHS` 에 경로를 추가하고 근거를 "
            "`pnpm-workspace.yaml` 의 `auditConfig` 주석에 남긴다.",
            file=sys.stderr,
        )
        return 1

    eroded: list[tuple[str, str, str, list[str]]] = []
    for module, advisory in reported.items():
        if module in targets:
            eroded.append((module, advisory, patched_by_module.get(module, "?"), targets[module]))

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
