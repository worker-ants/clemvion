#!/usr/bin/env python3
"""backend **전체 프로그램** 타입체크 ratchet — 새 타입 오류의 유입만 막는다.

판정 규칙·fail-closed 관례는 [`_typecheck_ratchet.py`](./_typecheck_ratchet.py) 에 있다.
이 파일은 backend 설정만 담는다.

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
"""

from __future__ import annotations

import pathlib
import sys

# 이 파일을 다른 디렉터리에서 부르거나(`python3 scripts/…`) 테스트가 경로로 로드해도
# 옆의 공유 코어를 찾을 수 있게 한다.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from _typecheck_ratchet import REPO_ROOT, RatchetConfig, main  # noqa: E402

CONFIG = RatchetConfig(
    label="backend",
    package_dir=REPO_ROOT / "codebase" / "backend",
    # backend 는 `tsconfig.json` 자체가 테스트를 포함한다 — 제외하는 쪽은
    # `tsconfig.build.json`(= `nest build`) 이고, 그 차이가 이 게이트의 존재 이유다.
    tsconfig="tsconfig.json",
    baseline=REPO_ROOT / "scripts" / "backend-typecheck-baseline.json",
    script="scripts/check-backend-typecheck-ratchet.py",
    blind_spot=(
        "`*.spec.ts` 는 `nest build` 가 exclude 하고 jest 가 타입을 strip 하므로 "
        "이 검사 말고는 아무도 못 본다."
    ),
)


if __name__ == "__main__":
    sys.exit(main(CONFIG))
