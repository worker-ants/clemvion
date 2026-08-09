#!/usr/bin/env python3
"""backend **전체 프로그램** 타입체크 ratchet — 새 타입 오류의 유입만 막는다.

## 왜 필요한가 — 테스트 코드는 어떤 게이트에서도 타입체크되지 않는다

`nest build` 는 `tsconfig.build.json` 을 쓰고 그 파일이 `test/`·`**/*spec.ts` 를
**exclude** 한다. jest 는 `ts-jest`/babel 경로라 타입을 **strip** 한다. 그래서
`*.spec.ts` 의 타입 오류는 로컬에서도 CI 에서도 아무도 보지 못한다.

실제로 그 사각에서 자란 것들(2026-08-09 실측, 이 스크립트를 넣은 PR 에서 수정):

- `ExecutionsService` 를 생성자 인자 7개로 생성(실제 8개) → 런타임에 의존 하나가
  `undefined`. 그 의존을 쓰는 분기가 추가되는 순간 타입 오류 대신
  `Cannot read properties of undefined` 로 터진다.
- 손으로 미러한 private 메서드 타입이 프로덕션 시그니처를 못 따라감 — **같은 파일에서
  두 번째 재발**이었다.

이 저장소가 이미 학습한 클래스이기도 하다 — 메모리 `feedback_type_guard_test_actually_runs`
("`vitest run` = 타입 strip 이라 타입 테스트가 no-op", "build 가 spec.ts exclude").
**타입 가드를 테스트로 고정해 두었는데 그 테스트가 타입체크되지 않으면 가드가 vacuous 하다.**

## 왜 전면 승격이 아니라 ratchet 인가

착수 시점 실측이 **209건 / 40파일**이었고 그중 진짜 stale 10건을 이 PR 이 고쳐 커밋된
baseline 은 **199건 / 38파일**이다. 나머지는 대부분 mock 캐스팅·부분 mock 의 **의도적**
느슨함이다. 전면 승격하려면 그 199건을 먼저 처분해야 해서 diff 가 통째로 커지고, 그
사이에도 **새 오류는 계속 들어온다**. ratchet 은 그 순서를 뒤집는다 — 바닥을 먼저 막고,
정리는 각자 자기 파일을 만질 때 점진적으로.

## 로컬에서 돌리는 법

`.claude/tools/run-test.sh` 의 4단계에는 **없다**(그 wrapper 는 lint/unit/build/e2e 고정).

    python3 scripts/check-backend-typecheck-ratchet.py            # 검사
    python3 scripts/check-backend-typecheck-ratchet.py --update   # 줄었을 때 baseline 낮추기

## 판정

파일별 진단 수를 baseline 과 대조해 **어느 쪽으로든 달라지면 실패**한다.

- **증가·신규 파일** → 새 타입 오류가 들어왔다. 고치거나(권장) 근거와 함께 baseline 상향.
- **감소** → 좋은 변화지만 baseline 을 낮춰야 한다. 낮추지 않으면 그 파일은 낮아진
  실제치와 높은 baseline 사이의 **차이만큼 새 오류를 조용히 받아들인다** — 이 저장소가
  반복해 데인 "게이트가 조용히 헐거워지는" 실패다. `--update` 로 재생성하면 된다.

tsc 를 못 돌리거나 출력을 못 읽으면 **exit 2(판단 불가)** 다 — "오류 0건" 과 구별되지
않는 성공으로 흘려보내지 않는다(`check-override-floors.py` 와 같은 fail-closed 관례).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys
from typing import NoReturn

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKEND = REPO_ROOT / "codebase" / "backend"
BASELINE = REPO_ROOT / "scripts" / "backend-typecheck-baseline.json"

# `src/foo/bar.spec.ts(12,34): error TS2554: ...`
DIAGNOSTIC = re.compile(r"^(?P<file>[^(\s][^(]*)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+)")

# tsc 가 물려 안 끝나는 경우를 끊는다. 전체 프로그램 체크가 로컬에서 ~60s 라 넉넉한 값.
_TSC_TIMEOUT_SEC = 900


def _undecidable(reason: str, detail: str = "") -> NoReturn:
    """판단 불가는 exit 2 로 고정한다 — "오류 0건" 과 같은 코드로 흘리지 않는다."""
    print(f"ERROR: {reason}", file=sys.stderr)
    if detail:
        print(detail, file=sys.stderr)
    sys.exit(2)


def run_tsc() -> str:
    """`tsc --noEmit` 을 돌려 stdout 을 준다.

    tsc 는 오류가 있으면 비-0 으로 끝나므로 returncode 로 성공을 판단할 수 없다.
    **출력이 기대 형태인지**로 판단한다.
    """
    try:
        proc = subprocess.run(
            ["npx", "tsc", "--noEmit", "-p", "tsconfig.json"],
            cwd=BACKEND,
            capture_output=True,
            text=True,
            timeout=_TSC_TIMEOUT_SEC,
        )
    except subprocess.TimeoutExpired:
        _undecidable(f"`tsc --noEmit` 이 {_TSC_TIMEOUT_SEC}초 안에 끝나지 않았다.")
    except OSError as exc:
        _undecidable(
            "`tsc --noEmit` 을 실행하지 못했다 — 의존이 설치돼 있는지 확인할 것 "
            "(`pnpm install --frozen-lockfile`).",
            f"  {type(exc).__name__}: {exc}",
        )
    out = proc.stdout
    # 진단이 하나도 없으면 tsc 는 **아무것도 출력하지 않고** exit 0 이다 — 정상이다.
    if proc.returncode != 0 and not out.strip():
        _undecidable(
            "`tsc --noEmit` 이 비-0 으로 끝났는데 stdout 이 비어 있다 — 진단이 아니라 "
            "설정/실행 오류로 보인다(취약점 0건과 구별할 수 없으므로 판단 불가).",
            f"  exit={proc.returncode} stderr={proc.stderr[:2000]}",
        )
    return out


def count_by_file(tsc_output: str) -> dict[str, int]:
    """파일별 진단 수. 진단 줄이 **하나도** 없으면 빈 dict(= 완전 clean)."""
    counts: dict[str, int] = {}
    for line in tsc_output.splitlines():
        m = DIAGNOSTIC.match(line)
        if m:
            counts[m.group("file")] = counts.get(m.group("file"), 0) + 1
    return counts


def load_baseline() -> dict[str, int]:
    if not BASELINE.exists():
        _undecidable(
            f"{BASELINE} 없음 — baseline 이 없으면 대조 대상이 0건이 되어 무엇도 "
            "걸리지 않는다(fail-closed). `--update` 로 생성할 것.",
        )
    try:
        data = json.loads(BASELINE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
        _undecidable(f"{BASELINE} 를 읽거나 파싱하지 못했다:", f"  {type(exc).__name__}: {exc}")
    files = data.get("files") if isinstance(data, dict) else None
    if not isinstance(files, dict):
        _undecidable(
            f"{BASELINE} 의 `files` 가 매핑이 아니다 — 대조 대상을 못 읽으면 무엇도 "
            "걸리지 않는다(fail-closed).",
            f"  실제: {type(files).__name__}",
        )
    bad = {k: v for k, v in files.items() if not isinstance(v, int)}
    if bad:
        _undecidable(f"{BASELINE} 의 값이 정수가 아닌 항목이 있다: {sorted(bad)[:10]}")
    return files


def write_baseline(counts: dict[str, int]) -> None:
    payload = {
        "//": (
            "backend 전체 프로그램(tsc --noEmit -p tsconfig.json) 타입 진단의 파일별 "
            "baseline. 손으로 고치지 말고 `python3 scripts/check-backend-typecheck-ratchet.py "
            "--update` 로 재생성할 것. 값을 **올리는** 변경은 새 타입 오류를 받아들이는 "
            "것이므로 PR 에 근거가 필요하다."
        ),
        "total": sum(counts.values()),
        "files": dict(sorted(counts.items())),
    }
    BASELINE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--update",
        action="store_true",
        help="현재 실측치로 baseline 을 재생성한다(줄었을 때 낮추는 정상 경로).",
    )
    args = parser.parse_args()

    counts = count_by_file(run_tsc())

    if args.update:
        write_baseline(counts)
        print(f"baseline 갱신: {len(counts)}파일 / 진단 {sum(counts.values())}건 → {BASELINE}")
        return 0

    baseline = load_baseline()
    increased = [
        (f, baseline.get(f, 0), n) for f, n in sorted(counts.items()) if n > baseline.get(f, 0)
    ]
    decreased = [
        (f, b, counts.get(f, 0)) for f, b in sorted(baseline.items()) if counts.get(f, 0) < b
    ]

    if not increased and not decreased:
        print(
            f"OK: backend 타입 진단 {sum(counts.values())}건 / {len(counts)}파일 — baseline 과 일치."
        )
        return 0

    if increased:
        print("\nERROR: 새 타입 오류가 들어왔다 (baseline 초과).", file=sys.stderr)
        print(
            "  `*.spec.ts` 는 `nest build` 가 exclude 하고 jest 가 타입을 strip 하므로 "
            "이 검사 말고는 아무도 못 본다.",
            file=sys.stderr,
        )
        for f, before, now in increased:
            print(f"    {f}: {before} → {now}", file=sys.stderr)
        print("\n  조치: 해당 오류를 고칠 것. 의도적으로 받아들인다면 PR 에 근거를 남기고 "
              "`--update` 로 baseline 을 올린다.", file=sys.stderr)

    if decreased:
        print("\nERROR: 타입 오류가 줄었는데 baseline 이 그대로다.", file=sys.stderr)
        print(
            "  좋은 변화지만 baseline 을 낮추지 않으면 그 파일은 차이만큼 **새 오류를 "
            "조용히 받아들인다** — 게이트가 헐거워지는 것이라 실패로 다룬다.",
            file=sys.stderr,
        )
        for f, before, now in decreased:
            print(f"    {f}: {before} → {now}", file=sys.stderr)
        print(
            "\n  조치: `python3 scripts/check-backend-typecheck-ratchet.py --update` 후 커밋.",
            file=sys.stderr,
        )

    return 1


if __name__ == "__main__":
    sys.exit(main())
