#!/usr/bin/env python3
"""frontend **전체 프로그램** 타입체크 ratchet — 새 타입 오류의 유입만 막는다.

판정 규칙·fail-closed 관례는 [`_typecheck_ratchet.py`](./_typecheck_ratchet.py) 에 있다.
이 파일은 frontend 설정만 담는다.

## 왜 필요한가 — backend 와 **같은 병에 한쪽만 약을 먹고 있었다**

`codebase/frontend/tsconfig.json` 은 `src/test/**` · `*.test.ts(x)` · `*.spec.ts(x)` ·
`**/__tests__/**` 를 **exclude** 하고, `vitest run` 은 타입을 **strip** 한다. 그래서
프론트엔드 테스트 코드의 타입 오류는 lint·build·vitest 어디에서도 보이지 않는다.

backend 는 2026-08-09 에 이 사각을 ratchet 으로 막았는데(`check-backend-typecheck-ratchet.py`),
frontend 에는 대응 게이트가 없었다. 실제로 그 사각으로 하나가 들어왔다 —
`walkTree(root, SCAN_ROOTS)` 가 `readonly string[]` 을 `string[]` 파라미터에 넘겨 **TS2345**
인데 lint·build·vitest 가 전부 초록이었다(`#1262` 에서 수정).

## 착수 시 실측 (2026-09-02)

전체 프로그램 체크의 첫 수치는 **1,414건**이었는데 그중 **1,256건**이 진짜 오류가 아니라
`src/test/jest-axe.d.ts` 하나에서 나온 연쇄였다 — 그 파일의 `declare module "vitest"` 가
augmentation 의도였지만 파일에 top-level import/export 가 없어 **global script** 였고, 그
문맥의 `declare module` 은 augmentation 이 아니라 **shadowing** 이다. vitest 의 실제 타입이
통째로 덮여 `import { describe } from "vitest"` 가 전부 깨졌다.

**그 선언이 의도대로 동작한 적이 한 번도 없다** — `toHaveNoViolations()` 의 타입 보장은
죽어 있었고 런타임 matcher 만 살아 있었다. 아무도 못 본 이유가 바로 이 게이트의 부재다.

분리해 고친 뒤 실측은 **52건 / 15파일**이고 그것이 커밋된 baseline 이며 **전부 테스트
파일, 프로덕션 0건**이다(backend 와 같은 성질). 대부분 mock 캐스팅과 **의도적으로 잘못된
negative fixture**(예: `"weird-type"` 를 `EntityType` 에 넣어 런타임 처리를 보는 테스트)라,
전면 승격하려면 그 52건을 먼저 처분해야 하고 그 사이에도 새 오류는 계속 들어온다.
backend 와 같은 순서를 택한다 — 바닥을 먼저 막고, 정리는 각자 자기
파일을 만질 때 점진적으로.

## 로컬에서 돌리는 법

`.claude/tools/run-test.sh` 의 4단계에는 **없다**(그 wrapper 는 lint/unit/build/e2e 고정).

    python3 scripts/check-frontend-typecheck-ratchet.py            # 검사
    python3 scripts/check-frontend-typecheck-ratchet.py --update   # 줄었을 때 baseline 낮추기
"""

from __future__ import annotations

import pathlib
import sys

# 이 파일을 다른 디렉터리에서 부르거나(`python3 scripts/…`) 테스트가 경로로 로드해도
# 옆의 공유 코어를 찾을 수 있게 한다.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from _typecheck_ratchet import REPO_ROOT, RatchetConfig, main  # noqa: E402

CONFIG = RatchetConfig(
    label="frontend",
    package_dir=REPO_ROOT / "codebase" / "frontend",
    # backend 와 달리 frontend 는 `tsconfig.json` **자신이** 테스트를 exclude 한다.
    # 그래서 전용 config 가 따로 있어야 한다 — 근거는 그 파일의 `//` 주석.
    tsconfig="tsconfig.typecheck.json",
    baseline=REPO_ROOT / "scripts" / "frontend-typecheck-baseline.json",
    script="scripts/check-frontend-typecheck-ratchet.py",
    blind_spot=(
        "테스트 파일은 `tsconfig.json` 이 exclude 하고 `vitest run` 이 타입을 strip 하므로 "
        "이 검사 말고는 아무도 못 본다."
    ),
)


if __name__ == "__main__":
    sys.exit(main(CONFIG))
