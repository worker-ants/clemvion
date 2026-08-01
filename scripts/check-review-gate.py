#!/usr/bin/env python3
"""리뷰 커버리지 게이트의 **훅-독립** 백스톱 (CI 용).

`plan/in-progress/harness-review-gate-ci-backstop.md` 의 본체.

## 왜 필요한가

로컬 `guard_review_before_push` 는 Bash 명령이 `git push` 인지 정규식으로 판정한다.
그 정규식이 push 를 놓치면 게이트는 조용히 skip 되고 — **놓쳤다는 사실 자체를 인지할 주체가
없다**. fail-open 배너조차 `_is_git_push` 가 True 여야 찍힌다. 그래서 사후 탐지 로직을 훅
안에 두면 같은 판정자에 의존해 같은 구멍으로 샌다(§문제).

CI 는 GitHub 이 PR 이벤트로 띄우므로 그 정규식을 공유하지 않는다. 이것이 이 층의 전부다.

## 판정자는 하나다

로컬 훅과 **같은** `review_guard.evaluate_review()` 를 호출한다. 두 번째 구현을 두면
로컬과 CI 판정이 갈리고, 그 drift 는 이 저장소가 `_shared/report_paths.py` 와
`_shared/retry_state.py` 로 이미 두 번 겪은 실패다.

성립하는 이유(착수 전 실측):
  - 리뷰 산출물은 gitignored 가 **아니다**. `.gitignore` 는 `review/**/_prompts/` 만 제외하고,
    `origin/main` 이 `review/code` 아래 8,851개를 추적한다 — PR 에 그대로 들어있다.
  - 게이트의 신선도 시계는 **checkout-immune** 하다. clean 파일은 마지막 커밋 시각을 쓰고,
    "리뷰가 언제 돌았나" 의 정본은 세션 **디렉토리 이름**이다. CI 체크아웃이 mtime 을 뭉개도
    판정이 성립한다.
  티켓은 이 둘 다 반대로 적고 있었고(그래서 "설계 선행" 으로 묶여 있었다), 실측으로 반증됐다.

## 왜 기본이 warn 인가

로컬 훅은 **미커밋** 파일도 본다(working tree). CI 는 커밋된 것만 본다. 그런데 이 저장소의
실제 관행은 리뷰 산출물이 그 코드의 PR 안에 커밋되지 **않는다**는 것이다 — 게이트 도입 이후
`codebase/**` PR 435건 중 **80건(18%)** 이 자기 PR 안에 해결된 리뷰를 담고 있지 않고, 표본을
추적해 보면 리뷰 자체는 돌았고 산출물만 다른 PR 로 들어갔다(예: `e96ef1b45` 는 review/ 파일을
0개 커밋했고 같은 날 세션 7개를 전부 다른 PR 이 커밋했다).

즉 지금 하드 차단으로 켜면 "리뷰를 안 했다" 가 아니라 "산출물을 이 PR 에 안 담았다" 를 막게
된다 — 워크플로 계약을 바꾸는 일이고, 그 결정은 실데이터로 해야 한다. 그래서 기본은 관측
모드이고, `--enforce` 로 뒤집는다. 켤 준비가 됐는지는 이 스크립트가 CI 에서 남긴 판정을 모아
보고 판단한다.

종료 코드: 정상/관측 0, `--enforce` 에서 위반 1, 내부 오류 0(fail-open — 백스톱이 CI 를
막아서는 안 된다. 이 층은 방어 심화이지 그 자체가 활성 게이트가 아니다).

사용:
    python3 scripts/check-review-gate.py [--enforce] [--root <repo-root>]
"""

from __future__ import annotations

import argparse
import os
import sys

# `review_guard` 는 `.claude/hooks/_lib/` 에 있고 형제 모듈을 이름으로 import 하므로
# (`from branch_guard import …`) 그 디렉터리 하나면 된다. 초판은 `hooks/` 도 얹으며 "둘 다
# 필요하다" 고 적었는데, 리뷰어가 격리 프로세스로 `_lib` 만으로 끝까지 도는 것을 실측해
# 반증했다 — 정본 소비자 `guard_review_before_push.py` 도 `_lib` 하나만 얹는다.
# 패키지로 import 하지 않는 이유는 `_lib` 라는 이름이 `.claude/skills/_lib` 와 겹치기 때문.
_ROOT_DEFAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_gate(root: str):
    """`review_guard.evaluate_review` 를 반환. 실패하면 None (fail-open)."""
    lib = os.path.join(root, ".claude", "hooks", "_lib")
    if lib not in sys.path:
        sys.path.insert(0, lib)
    try:
        import review_guard  # noqa: PLC0415 — 경로를 얹은 뒤라야 import 된다
        return review_guard.evaluate_review
    except Exception as exc:  # noqa: BLE001
        print(f"review-gate: 게이트를 불러오지 못했습니다 ({type(exc).__name__}: {exc})",
              file=sys.stderr)
        return None


def main(argv=None) -> int:
    # `allow_abbrev=False`: 기본값이면 `--enf` 가 `--enforce` 로 붙는다. 그러면 워크플로가
    # 축약형을 쓸 때 실제로는 enforce 인데 "리터럴 `--enforce` 부재" 를 보는 회귀
    # 테스트는 계속 관측 모드라고 보고한다 — 켜짐/꺼짐이 조용히 갈리는 자리다.
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0],
                                 allow_abbrev=False)
    ap.add_argument("--enforce", action="store_true",
                    help="위반 시 exit 1 (기본은 관측만 하고 0).")
    ap.add_argument("--root", default=_ROOT_DEFAULT, help="저장소 루트.")
    args = ap.parse_args(argv)

    root = os.path.abspath(args.root)
    evaluate = _load_gate(root)
    if evaluate is None:
        return 0

    # `try` 가 호출뿐 아니라 **반환값을 읽는 데까지** 걸쳐 있다. 초판은 호출만 감쌌는데,
    # 게이트가 예외 없이 형태만 다른 값(예: None)을 돌려주면 `decision.blocked` 에서
    # AttributeError 가 나 exit 1 로 CI 를 막는다 — fail-open 계약을 정확히 뒤집는 자리다.
    try:
        decision = evaluate(root)
        # advisory 는 판정과 무관하게 항상 낸다. 이걸 차단 시에만 내면, 거부되는 그 세션이
        # 바로 Critical 을 하향한 세션일 때 그 사실이 드러나는 유일한 자리를 잃는다 (#1057 4R).
        notes = list(getattr(decision, "notes", ()) or ())
        blocked = decision.blocked
        reason = decision.reason
    except Exception as exc:  # noqa: BLE001
        print(f"review-gate: 게이트가 예외를 던졌습니다 ({type(exc).__name__}: {exc})",
              file=sys.stderr)
        return 0

    for note in notes:
        print(note)

    if not blocked:
        print(f"review-gate: 통과 — {reason}")
        return 0

    print(f"review-gate: 미커버 — {reason}")
    if not args.enforce:
        print(
            "review-gate: 관측 모드라 실패시키지 않습니다. 이 층은 로컬 훅의 push 탐지\n"
            "             정규식과 독립인 백스톱이고, 켜는 판단은 여기 쌓이는 판정으로 합니다."
        )
        return 0
    print(
        "review-gate: 이 PR 의 codebase/** 변경을 커버하는 해결된 리뷰가 커밋돼 있지 않습니다.\n"
        "             `/ai-review` 후 발견을 처분하고 `review/` 산출물을 이 PR 에 커밋하세요."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
