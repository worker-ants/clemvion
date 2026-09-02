"""타입체크 ratchet 의 **공유 코어** — backend·frontend 두 엔트리포인트가 함께 쓴다.

## 왜 공유하나

이 저장소는 "같은 목적의 독립 사본이 조용히 갈리는" 실패를 반복했다 — 가장 최근에는
`plan_guard.py` 의 체크박스 정규식과 `plan-stale-audit.sh` 의 사본이 **세 번째로** 갈렸다.
ratchet 은 그 사본을 하나 더 만들기에 특히 나쁜 자리다: 판정 규칙(증가·감소 둘 다 실패,
판단 불가는 exit 2)이 미묘한데 **틀리는 방향이 조용한 통과**이기 때문이다.

그래서 규칙은 여기 하나만 두고, 패키지별로 다른 것(디렉터리·tsconfig·baseline 경로·사각지대
설명)만 `RatchetConfig` 로 주입한다.

## 판정

파일별 진단 수를 baseline 과 대조해 **어느 쪽으로든 달라지면 실패**한다.

- **증가·신규 파일** → 새 타입 오류가 들어왔다. 고치거나(권장) 근거와 함께 baseline 상향.
- **감소** → 좋은 변화지만 baseline 을 낮춰야 한다. 낮추지 않으면 그 파일은 낮아진 실제치와
  높은 baseline 사이의 **차이만큼 새 오류를 조용히 받아들인다** — 이 저장소가 반복해 데인
  "게이트가 조용히 헐거워지는" 실패다.

tsc 를 못 돌리거나 출력을 못 읽으면 **exit 2(판단 불가)** 다 — "오류 0건" 과 구별되지 않는
성공으로 흘려보내지 않는다(`check-override-floors.py` 와 같은 fail-closed 관례).
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import NoReturn, Sequence

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

# `src/foo/bar.spec.ts(12,34): error TS2554: ...`
#
# **경로에 `(` 가 들어갈 수 있다.** 종전 패턴은 파일 부분을 `[^(]*` 로 잡아 첫 여는 괄호에서
# 끊었는데, Next.js App Router 의 route group 이 정확히 그 형태다 — `src/app/(main)/…` 의
# 진단이 **한 건도 세어지지 않았다.** 게이트가 조용히 통과하기 시작하는, 이 파일이 스스로
# 경고하는 바로 그 실패다(리뷰 requirement CRITICAL).
#
# 이제 파일 부분을 non-greedy 로 두고 **`(숫자,숫자): error TS` 라는 앵커**로 끝을 잡는다.
# `(main)` 은 숫자가 아니라 backtrack 되고 진짜 위치 괄호에서 멈춘다. 첫 문자를 non-space 로
# 요구하는 것은 유지한다 — 들여쓴 상세 줄을 진단으로 세면 baseline 이 부풀기 때문이다.
DIAGNOSTIC = re.compile(
    r"^(?P<file>[^\s].*?)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+)"
)

# tsc 가 물려 안 끝나는 경우를 끊는다. 전체 프로그램 체크가 로컬에서 ~60s 라 넉넉한 값.
TSC_TIMEOUT_SEC = 900


@dataclass(frozen=True)
class RatchetConfig:
    """패키지 하나의 ratchet 설정 — 판정 규칙은 담지 않는다."""

    label: str
    """메시지에 쓰는 이름 (`backend` / `frontend`)."""

    package_dir: pathlib.Path
    """`tsc` 를 돌릴 디렉터리."""

    tsconfig: str
    """`package_dir` 기준 tsconfig 경로. **테스트 파일을 포함하는** 것이어야 한다."""

    baseline: pathlib.Path
    """커밋되는 baseline JSON."""

    script: str
    """사용자에게 안내할 엔트리포인트 경로(저장소 루트 기준)."""

    blind_spot: str
    """이 게이트가 **유일한 관측 지점**인 이유. 실패 메시지에 그대로 실린다."""


def undecidable(reason: str, detail: str = "") -> NoReturn:
    """판단 불가는 exit 2 로 고정한다 — "오류 0건" 과 같은 코드로 흘리지 않는다."""
    print(f"ERROR: {reason}", file=sys.stderr)
    if detail:
        print(detail, file=sys.stderr)
    sys.exit(2)


def run_tsc(cfg: RatchetConfig) -> str:
    """`tsc --noEmit` 을 돌려 stdout 을 준다.

    tsc 는 오류가 있으면 비-0 으로 끝나므로 returncode 로 성공을 판단할 수 없다.
    **출력이 기대 형태인지**로 판단한다.
    """
    try:
        proc = subprocess.run(
            ["npx", "tsc", "--noEmit", "-p", cfg.tsconfig],
            cwd=cfg.package_dir,
            capture_output=True,
            text=True,
            timeout=TSC_TIMEOUT_SEC,
        )
    except subprocess.TimeoutExpired:
        undecidable(f"`tsc --noEmit` 이 {TSC_TIMEOUT_SEC}초 안에 끝나지 않았다.")
    except OSError as exc:
        undecidable(
            "`tsc --noEmit` 을 실행하지 못했다 — 의존이 설치돼 있는지 확인할 것 "
            "(`pnpm install --frozen-lockfile`).",
            f"  {type(exc).__name__}: {exc}",
        )
    out = proc.stdout
    # 진단이 하나도 없으면 tsc 는 **아무것도 출력하지 않고** exit 0 이다 — 정상이다.
    if proc.returncode != 0 and not out.strip():
        undecidable(
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


def load_baseline(cfg: RatchetConfig) -> dict[str, int]:
    if not cfg.baseline.exists():
        undecidable(
            f"{cfg.baseline} 없음 — baseline 이 없으면 대조 대상이 0건이 되어 무엇도 "
            "걸리지 않는다(fail-closed). `--update` 로 생성할 것.",
        )
    try:
        data = json.loads(cfg.baseline.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as exc:
        undecidable(f"{cfg.baseline} 를 읽거나 파싱하지 못했다:", f"  {type(exc).__name__}: {exc}")
    files = data.get("files") if isinstance(data, dict) else None
    if not isinstance(files, dict):
        undecidable(
            f"{cfg.baseline} 의 `files` 가 매핑이 아니다 — 대조 대상을 못 읽으면 무엇도 "
            "걸리지 않는다(fail-closed).",
            f"  실제: {type(files).__name__}",
        )
    bad = {k: v for k, v in files.items() if not isinstance(v, int)}
    if bad:
        undecidable(f"{cfg.baseline} 의 값이 정수가 아닌 항목이 있다: {sorted(bad)[:10]}")
    return files


def write_baseline(cfg: RatchetConfig, counts: dict[str, int]) -> None:
    payload = {
        "//": (
            f"{cfg.label} 전체 프로그램(tsc --noEmit -p {cfg.tsconfig}) 타입 진단의 파일별 "
            f"baseline. 손으로 고치지 말고 `python3 {cfg.script} --update` 로 재생성할 것. "
            "값을 **올리는** 변경은 새 타입 오류를 받아들이는 것이므로 PR 에 근거가 필요하다."
        ),
        "total": sum(counts.values()),
        "files": dict(sorted(counts.items())),
    }
    cfg.baseline.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def verdict(
    baseline: dict[str, int], counts: dict[str, int]
) -> tuple[list[tuple[str, int, int]], list[tuple[str, int, int]]]:
    """(증가, 감소) — 각 항목은 `(파일, baseline, 실측)`."""
    increased = [
        (f, baseline.get(f, 0), n) for f, n in sorted(counts.items()) if n > baseline.get(f, 0)
    ]
    decreased = [
        (f, b, counts.get(f, 0)) for f, b in sorted(baseline.items()) if counts.get(f, 0) < b
    ]
    return increased, decreased


def main(cfg: RatchetConfig, argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=f"{cfg.label} 타입체크 ratchet")
    parser.add_argument(
        "--update",
        action="store_true",
        help="현재 실측치로 baseline 을 재생성한다(줄었을 때 낮추는 정상 경로).",
    )
    args = parser.parse_args(argv)

    counts = count_by_file(run_tsc(cfg))

    if args.update:
        write_baseline(cfg, counts)
        print(
            f"baseline 갱신: {len(counts)}파일 / 진단 {sum(counts.values())}건 → {cfg.baseline}"
        )
        return 0

    baseline = load_baseline(cfg)
    increased, decreased = verdict(baseline, counts)

    if not increased and not decreased:
        print(
            f"OK: {cfg.label} 타입 진단 {sum(counts.values())}건 / {len(counts)}파일 — "
            "baseline 과 일치."
        )
        return 0

    if increased:
        print("\nERROR: 새 타입 오류가 들어왔다 (baseline 초과).", file=sys.stderr)
        print(f"  {cfg.blind_spot}", file=sys.stderr)
        for f, before, now in increased:
            print(f"    {f}: {before} → {now}", file=sys.stderr)
        print(
            "\n  조치: 해당 오류를 고칠 것. 의도적으로 받아들인다면 PR 에 근거를 남기고 "
            "`--update` 로 baseline 을 올린다.",
            file=sys.stderr,
        )

    if decreased:
        print("\nERROR: 타입 오류가 줄었는데 baseline 이 그대로다.", file=sys.stderr)
        print(
            "  좋은 변화지만 baseline 을 낮추지 않으면 그 파일은 차이만큼 **새 오류를 "
            "조용히 받아들인다** — 게이트가 헐거워지는 것이라 실패로 다룬다.",
            file=sys.stderr,
        )
        for f, before, now in decreased:
            print(f"    {f}: {before} → {now}", file=sys.stderr)
        print(f"\n  조치: `python3 {cfg.script} --update` 후 커밋.", file=sys.stderr)

    return 1
