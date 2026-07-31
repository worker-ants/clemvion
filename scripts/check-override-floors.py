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

`pnpm audit` 이 이것들을 **잡기는 한다** — 위 5건 중 `#1038` 에서 나온 4건은 그때
audit 이 보고한 17건 안에 섞여 있었다(`next>postcss` 는 앞선 `#1036` 건이라 그 목록 밖).
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
from typing import NoReturn

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

# fail-closed 진단 출력의 미리보기 길이. 원인 파악에 충분하면서 CI 로그를 덮지 않는 선.
_STDERR_PREVIEW = 500      # pnpm 의 오류 한 줄이 대개 이 안에 들어온다
_STDOUT_PREVIEW = 2000     # 파싱 실패는 앞부분만 봐도 형태를 알 수 있다
_KEY_PREVIEW = 10          # 오류 페이로드의 최상위 키 몇 개면 판별된다

# 레지스트리 조회 상한. `deps-security-checks.yml` 의 잡 타임아웃(10분)보다 넉넉히 짧아야
# 잡이 죽는 대신 이 스크립트가 사유를 남기고 끝낸다.
_AUDIT_TIMEOUT_SEC = 300

# override 키에서 **대상 패키지명** 을 뽑아야 audit advisory 의 `module_name` 과 맞출 수 있다.
# 키에 섞여 오는 것들:
#   `lodash` · `next>postcss` · `a>b>c`(다단 체인) · `undici@>=7.0.0 <7.28.0`(레인지) ·
#   `@grpc/grpc-js`(scope) · `next>@types/react`(scope 자식) · `a>@scope/b>c`(scope 중간)
#
# 어려운 지점은 하나뿐이다: `>` 가 **체인 구분자**일 때와 **레인지의 일부**(`@>=7.0.0`)일 때를
# 가르는 것. 앞 글자로 갈린다 — 구분자는 항상 패키지명 글자 뒤에 오고, 레인지의 `>` 는 `@` 나
# 공백 뒤에 온다(`foo@>=1`, `>=1 || >3`). 이 규칙은 레인지가 **어느 세그먼트에** 붙든 성립해서
# `@` 위치로 구간을 나누던 옛 방식이 못 풀던 두 형태를 함께 해결한다.
#
# 옛 방식이 틀렸던 이력(둘 다 "가드가 아무것도 안 잡는다" 로 나타났다):
#   - `>` 를 먼저 자르면 `undici@>=7.0.0` 의 `>=` 를 구분자로 오인 → `js-yaml` 스코프 override
#     2건이 통째로 매칭에서 빠졌다.
#   - `@` 이전 구간에서만 `>` 를 찾으면 `a>@scope/b>c` 의 마지막 `>` 를 못 봐 `@scope/b>c` 가
#     남았다(존재하지 않는 패키지명이라 어떤 advisory 와도 안 맞는다).
_NAME_CHAR = re.compile(r"[A-Za-z0-9._/-]")
# scope 패키지(`@grpc/grpc-js`)는 선두 `@` 가 이름의 일부라 버전 구분자로 세면 안 된다 —
# 두 번째 이후의 `@` 만 레인지 구분자다.
_RANGE_SUFFIX = re.compile(r"^(?P<name>@[^@/]+/[^@]+|[^@]+)@.+$")


def chain_segments(key: str) -> list[str]:
    """override 키를 `>` 체인 세그먼트로 가른다 (레인지 안의 `>` 는 건드리지 않는다)."""
    out: list[str] = []
    start = 0
    for i, ch in enumerate(key):
        if ch == ">" and i > 0 and _NAME_CHAR.match(key[i - 1]):
            out.append(key[start:i])
            start = i + 1
    out.append(key[start:])
    return out


def override_target(key: str) -> str:
    """override 키에서 제약 대상 패키지명을 뽑는다 — 체인의 **마지막** 항에서 레인지를 뗀다."""
    leaf = chain_segments(key.strip())[-1].strip()
    m = _RANGE_SUFFIX.match(leaf)
    return (m.group("name") if m else leaf).strip()


def load_override_targets(path: pathlib.Path) -> dict[str, list[str]]:
    """대상 패키지명 → 그 패키지를 제약하는 override 키 목록.

    **입력이 기대 형태가 아니면 전부 판단 불가(exit 2)** 다. 이 함수가 빈 dict 를 돌려주면
    어떤 advisory 도 대상에 안 걸려 `OK: 취약 재유입 0건` 이 나온다 — 설정이 깨졌는데 취약점
    0건과 구별되지 않는 성공, 이 스크립트가 존재하는 이유인 바로 그 실패 클래스다. 그래서
    "빈 결과로 조용히 흘려보낼 수 있는" 입력 형태를 하나씩 막지 않고 **한 자리에서** 가른다.
    """
    try:
        # `read_text` 도 같은 블록 안이다 — 유효하지 않은 UTF-8 이면 `UnicodeDecodeError` 가
        # 그대로 전파되어 파싱 오류와 똑같은 증상(traceback + exit 1)이 된다.
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (yaml.YAMLError, UnicodeDecodeError, OSError) as exc:
        # 안 잡으면 traceback 과 함께 exit 1 로 죽는다 — 이 스크립트 어휘에서 1 은 "침식 발견"
        # 이라 구문 오류가 정상 발견 신호와 같은 코드가 된다(exit code 만 보는 자동화가 혼동).
        _undecidable(f"{path} 를 읽거나 YAML 로 파싱하지 못했다:", f"  {type(exc).__name__}: {exc}")
    overrides = data.get("overrides") if isinstance(data, dict) else None
    if not isinstance(overrides, dict):
        # 키 부재·오타(`override:`)·값 없음(`overrides:` → None)·매핑 아닌 값(문자열/리스트)
        # 을 한 조건으로 막는다. 빈 매핑(`overrides: {}`)은 의도일 수 있으므로 허용 —
        # 판정 기준은 "비었는가" 가 아니라 **매핑인가** 다.
        # 진단의 `key=str` — PyYAML 1.1 리졸버가 `on`/`yes`/`no` 를 불리언으로 만들어 최상위
        # 키에 타입이 섞이면 그냥 `sorted()` 는 TypeError 로 죽는다(진단이 죽으면 exit 1).
        _undecidable(
            f"{path} 의 `overrides` 가 매핑이 아니다 — override 목록을 못 읽으면 대상이 0개가 "
            "되어 무엇도 걸리지 않는다(fail-closed). 키 오타(`override:`)나 값 누락인지 확인할 것.",
            f"  실제: {type(overrides).__name__}"
            f" · 최상위 키: {sorted(data, key=str)[:_KEY_PREVIEW] if isinstance(data, dict) else type(data).__name__}",
        )
    targets: dict[str, list[str]] = {}
    for key in overrides:
        targets.setdefault(override_target(str(key)), []).append(str(key))
    return targets


def _undecidable(reason: str, detail: str = "") -> NoReturn:
    """"판단 불가" 를 exit 2 로 고정한다.

    사유마다 손으로 `sys.exit(2)` 를 적으면 언젠가 하나를 빠뜨리고, 그 분기는 취약점 0건과
    구별되지 않는 성공으로 흘러간다 — 이 스크립트가 막으려는 바로 그 클래스다. 반환 타입이
    `NoReturn` 이라 빠뜨리면 타입 단계에서 드러난다.
    """
    print(f"ERROR: {reason}", file=sys.stderr)
    if detail:
        print(detail, file=sys.stderr)
    sys.exit(2)


def run_audit() -> dict:
    """`pnpm audit --json` 실행.

    audit 은 취약점이 있으면 비-0 으로 끝나므로 returncode 로 성공을 판단할 수 없다. 대신
    **출력이 기대 형태인지**로 판단하고, 아니면 fail-closed(exit 2) 한다 — 레지스트리 오류나
    인증 실패를 "취약점 0건" 으로 오해하면 본 가드가 정확히 자신이 막으려는 조용한 통과를
    재현한다.
    """
    try:
        proc = subprocess.run(
            ["pnpm", "audit", "--audit-level=moderate", "--json"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            # 위 세 분기는 "응답은 왔는데 형태가 이상함" 만 다룬다. **응답이 안 오는** 경우가
            # 남아 있었다 — 레지스트리가 물리면 CI 잡 타임아웃까지 매달린다. 여기서 끊고
            # 판단 불가로 돌린다.
            timeout=_AUDIT_TIMEOUT_SEC,
        )
    except subprocess.TimeoutExpired:
        _undecidable(
            f"`pnpm audit --json` 이 {_AUDIT_TIMEOUT_SEC}초 안에 끝나지 않았다 — "
            "레지스트리 지연으로 보고 판단 불가로 처리한다(fail-closed).",
        )
    out = proc.stdout.strip()
    if not out:
        _undecidable(
            "`pnpm audit --json` 이 아무것도 출력하지 않았다 — 취약점 0건과 구분할 수 "
            "없으므로 판단 불가로 처리한다(fail-closed).",
            f"  exit={proc.returncode} stderr={proc.stderr[:_STDERR_PREVIEW]}",
        )
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        _undecidable("`pnpm audit --json` 출력을 파싱하지 못했다:", out[:_STDOUT_PREVIEW])
    if not isinstance(data, dict) or "actions" not in data:
        # 정상 응답이면 `actions`/`advisories`/`metadata` 를 갖는다. 없으면 오류 페이로드다.
        _undecidable(
            "`pnpm audit --json` 응답이 기대 형태가 아니다(`actions` 없음) — "
            "레지스트리 오류로 보고 판단 불가로 처리한다(fail-closed).",
            f"  받은 키: {list(data)[:_KEY_PREVIEW] if isinstance(data, dict) else type(data).__name__}",
        )
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
    알 수 있다. `ignoreCves` 자체는 CVE ID 만 담고 수용 시점의 경로를 담지 않으므로, 그
    경로 집합을 `EXPECTED_SUPPRESSED_PATHS` 에 따로 고정해 두고 호출부가 대조한다 —
    **경로가 늘었을 때만** fail. "억제 항목이 있으면 fail" 로 짰다가 정상 상태(수용된 경로
    그대로)가 상시 빨간불이 되는 걸 실측했다. 판정 기준은 존재가 아니라 범위 확대다.
    """
    advisories = audit.get("advisories") or {}
    actions = audit.get("actions") or []

    reported: dict[str, str] = {}
    for name, adv in advisories.items():
        module = adv.get("module_name")
        if module:
            # `id` 는 정수로 오므로 str() 로 고정한다 — 선언 타입과 출력 형식 양쪽 때문.
            reported[module] = str(adv.get("github_advisory_id") or adv.get("id") or name)

    suppressed: dict[str, list[str]] = {}
    actions_with_module = [a for a in actions if a.get("module")]
    for action in actions_with_module:
        module = action["module"]
        if module not in reported:
            paths = [r.get("path", "?") for r in (action.get("resolves") or [])]
            suppressed.setdefault(module, []).extend(paths)

    # `run_audit()` 은 최상위 `actions` 키만 본다. 그 아래 필드명이 pnpm 메이저 상향으로
    # 바뀌면 `.get()` 이 전부 None 을 돌려주고 여기서 조용히 빈 dict 가 나온다 — "취약 0건"
    # 과 구별되지 않는 형태로. 항목이 있는데 **하나도** 기대 키를 안 갖는 건 데이터가 아니라
    # 스키마가 바뀐 것이므로 판단 불가로 처리한다.
    if advisories and not reported:
        _undecidable(
            "`advisories` 항목이 있는데 `module_name` 을 가진 것이 하나도 없다 — "
            "pnpm audit 스키마가 바뀐 것으로 보고 판단 불가로 처리한다(fail-closed).",
            f"  본 키: {sorted({k for adv in advisories.values() for k in adv})[:_KEY_PREVIEW]}",
        )
    # 판정은 `actions` 원소 자체로 한다. `suppressed` 는 `reported` 에 이미 있는 모듈을
    # 빼므로 "전부 reported 와 겹쳐서 비었다" 와 "필드명이 바뀌어 비었다" 를 구분 못 하고,
    # `not reported` 를 덧붙이면 **무관한 advisory 하나만 정상 파싱돼도** 이 검사가 통째로
    # 죽는다(실측: exit 0). 이 축의 유일한 관측 창구가 조용히 닫히는 형태였다.
    if actions and not actions_with_module:
        _undecidable(
            "`actions` 항목이 있는데 `module` 을 가진 것이 하나도 없다 — "
            "pnpm audit 스키마가 바뀐 것으로 보고 판단 불가로 처리한다(fail-closed).",
            f"  본 키: {sorted({k for a in actions for k in a})[:_KEY_PREVIEW]}",
        )
    return reported, suppressed


def main() -> int:
    if not WORKSPACE_YAML.exists():
        _undecidable(f"{WORKSPACE_YAML} 없음 — override 목록을 못 읽으면 "
                     "\"대상 0건\" 이 되어 무엇도 걸리지 않는다(fail-closed).")

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

    eroded: list[tuple[str, str, str, list[str]]] = []
    for module, advisory in reported.items():
        if module in targets:
            eroded.append((module, advisory, patched_by_module.get(module, "?"), targets[module]))

    if not widened and not eroded:
        print(
            f"OK: override 대상 {len(targets)}개 패키지 중 취약 재유입 0건 "
            "(audit 잔여가 있더라도 그건 override 미관리 패키지 — audit 잡이 담당)"
        )
        return 0

    # 둘 다 계산한 뒤 한 번에 보고한다. widened 에서 조기 return 하면 같은 실행에 존재하는
    # eroded 를 못 보고 고치고 다시 돌리는 왕복이 생긴다 (`check-pnpm-security-config.py` 의
    # "모두 모아 한 번에" 패턴과 맞춤).
    if widened:
        _report_widened(widened)
    if eroded:
        _report_eroded(eroded)
    return 1


def _report_widened(widened: list[tuple[str, set[str]]]) -> None:
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


def _report_eroded(eroded: list[tuple[str, str, str, list[str]]]) -> None:
    print("\nERROR: override 바닥이 낡아 취약 버전이 다시 해소됐다.", file=sys.stderr)
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


if __name__ == "__main__":
    sys.exit(main())
