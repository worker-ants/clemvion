#!/usr/bin/env python3
"""리뷰 커버리지 게이트의 **훅-독립** 백스톱 (CI 용).

## 왜 필요한가

로컬 `guard_review_before_push` 는 Bash 명령이 `git push` 인지 정규식으로 판정한다. 그 정규식이
push 를 놓치면 게이트는 조용히 skip 되고, **놓쳤다는 사실 자체를 인지할 주체가 없다**. CI 는
GitHub 이 PR 이벤트로 띄우므로 그 정규식을 공유하지 않는다. 이것이 이 층의 전부다.

## 판정자는 하나다

로컬 훅과 **같은** `review_guard.evaluate_review()` 를 부른다. 두 번째 구현을 두면 로컬과 CI 판정이
갈린다. NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)부터 그 판정은 저장소 `review/**` 파일이
아니라 NERV 리뷰 라운드(N1 `gates/reviews/check`)를 읽는다. 그래서 PR 에 산출물을 커밋할 필요도,
커밋한 가짜 SUMMARY 로 통과할 길도 없다. 판정 규칙은 `.claude/hooks/_lib/review_guard.py` 가 정본이다.

이 스크립트는 환경을 읽지 않는다. 입력은 인자뿐이고 NERV 접속 정보(`NERV_SERVER` · `NERV_TOKEN`)는
게이트 모듈이 읽는다. 워크플로가 PR 의 head 브랜치 · head 커밋 · 기준 ref 를 인자로 넘긴다
(`actions/checkout` 의 기본 체크아웃은 merge 커밋이라 HEAD 를 쓰면 라운드 이후 커밋에 main 의
커밋이 섞인다).

## 종료 코드

- 통과 0. 위반은 `--enforce` 면 1, 아니면 0(관측).
- 판정 불가는 둘로 나눈다.
  - 일시 장애(서버 불통 · 응답 형식 · git 실패 · 게이트를 못 불러옴) — 0(fail-open). 백스톱 자신의
    고장이나 NERV 장애가 무관한 PR 을 세우면 그건 방어가 아니라 새 장애다.
  - 설정 문제(`GateMisconfigured`: 토큰 · 서버 주소 없음, 401 · 403 · 404) — `--enforce` 면 1.
    secret 이 빠진 백스톱은 초록인 채로 영원히 꺼진다. 그 상태는 알려야 한다.

사용:
    python3 scripts/check-review-gate.py [--enforce] [--root <저장소 루트>]
        [--branch <PR head 브랜치>] [--head <PR head 커밋>] [--base <origin/기준 브랜치>]
"""

from __future__ import annotations

import argparse
import os
import sys

# `review_guard` 는 `.claude/hooks/_lib/` 에 있고 형제 모듈을 이름으로 import 한다. 패키지로
# import 하지 않는 이유는 `_lib` 라는 이름이 `.claude/skills/_lib` 와 겹치기 때문.
_ROOT_DEFAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_gate(root: str):
    """`(evaluate_review, GateMisconfigured)` 를 돌려준다. 실패하면 None (fail-open)."""
    lib = os.path.join(root, ".claude", "hooks", "_lib")
    if lib not in sys.path:
        sys.path.insert(0, lib)
    try:
        import review_guard  # noqa: PLC0415 — 경로를 얹은 뒤라야 import 된다
        return review_guard.evaluate_review, review_guard.GateMisconfigured
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
                    help="위반 · 설정 문제면 exit 1 (기본은 관측만 하고 0).")
    ap.add_argument("--root", default=_ROOT_DEFAULT, help="저장소 루트.")
    ap.add_argument("--branch", help="NERV 라운드를 찾을 브랜치. 없으면 체크아웃의 현재 브랜치.")
    ap.add_argument("--head", help="판정할 커밋. 없으면 HEAD.")
    ap.add_argument("--base", help="기준 브랜치 ref(예: origin/main). 없으면 기본 브랜치.")
    args = ap.parse_args(argv)

    root = os.path.abspath(args.root)
    gate = _load_gate(root)
    if gate is None:
        return 0
    evaluate, misconfigured = gate

    # `try` 가 호출뿐 아니라 **반환값을 읽는 데까지** 걸쳐 있다. 게이트가 예외 없이 형태만 다른
    # 값(예: None)을 돌려주면 `decision.blocked` 에서 AttributeError 가 나 exit 1 로 CI 를
    # 막는다 — fail-open 계약을 정확히 뒤집는 자리다.
    try:
        decision = evaluate(root, branch=args.branch, head=args.head, base_ref=args.base)
        notes = list(getattr(decision, "notes", ()) or ())
        blocked = decision.blocked
        reason = decision.reason
    except misconfigured as exc:
        print(f"review-gate: 설정 문제로 판정하지 못했습니다 — {exc}")
        if args.enforce:
            print("review-gate: secret `NERV_CI_TOKEN` · 변수 `NERV_SERVER` 를 확인하세요. "
                  "설정이 빠진 백스톱은 모든 PR 을 그냥 통과시키므로 실패로 둡니다.")
            return 1
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"review-gate: 판정하지 못했습니다 — 통과시킵니다 ({type(exc).__name__}: {exc})",
              file=sys.stderr)
        return 0

    for note in notes:
        print(note)

    if not blocked:
        print(f"review-gate: 통과 — {reason}")
        return 0

    print(f"review-gate: 미커버 — {reason}")
    if not args.enforce:
        print("review-gate: 관측 모드라 실패시키지 않습니다.")
        return 0
    print(
        "review-gate: 이 PR 의 codebase/** 변경을 덮는 passed 상태의 NERV 코드 리뷰 라운드가\n"
        "             없습니다. `/ai-review` 뒤 역할마다 `nerv_review_submit` 으로 제출하고\n"
        "             발견을 `nerv_finding_resolve` 로 처분한 뒤 이 잡을 다시 실행하세요."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
