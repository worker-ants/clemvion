# 요구사항(Requirement) 리뷰 — `@nestjs/typeorm` 12 업그레이드 (deps-typeorm12)

## 검증 방법

정적 대조 외에, 다음을 실제로 재현해 plan 문서의 수치 주장을 검증했다 (저장소 트리에는
아무 잔여물도 남기지 않음 — 아래 "뮤테이션 원복" 참고):

- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js workspace.decorator.spec workspace-reflection-canary.spec roles.guard.spec` → **3 suites / 48 tests 통과** (plan 의 "reflection 3스위트 48 통과/48" 주장과 일치)
- `handlerConsumesWorkspaceId`(`codebase/backend/src/common/decorators/workspace.decorator.ts`)를 원본을 `mktemp -d` 스크래치로 `cp` 해 둔 뒤 `return false`로 뮤테이션하고 동일 3스위트 재실행 → **3 suites failed, 9 tests failed, 39 passed** (plan §C "판별자 MB → 항상 false: RED — 3스위트 전부, 9개 테스트" 주장과 정확히 일치). 원복은 `cp`로 완료, `git status --short`/`git diff --stat` 로 해당 파일이 clean 함을 확인.
- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --listTests | wc -l` → **473** (plan의 "backend unit 473스위트" 주장과 일치)
- `git diff origin/main --stat -- spec/` → 출력 없음 (`spec_impact: none` 및 naming_collision INFO #8 "diff 0" 주장과 일치)
- `spec/5-system/1-auth.md:807`의 `^11.0.1` 인용 문장 존재 확인 — 이 PR 이 `@nestjs/common`을 건드리지 않아(잠금파일 `@nestjs/typeorm@12.0.1` peer가 `@nestjs/common@11.1.27` 그대로) 문장이 여전히 참이라는 plan의 "후속" 판단은 타당
- pnpm-lock.yaml 상 `@nestjs/typeorm@12.0.1`의 `peerDependencies`가 `^10.0.0 || ^11.0.0 || ^12.0.0`(common/core 동일)로 박혀 있어, plan §A 표의 "Nest 11 위에서 돈다" 결론과 일치

뮤테이션 원복 상태: 재현 종료 후 `git status --short` 전체 확인 결과 `review/code/2026/09/24/18_22_23/`(이 리뷰 세션 자신의 산출물) 외 잔여 변경 없음.

## 발견사항

- **[WARNING]** `pnpm-lock.yaml`에 `@nestjs/typeorm` 범프와 무관해 보이는 `libc:` 필드 삭제가 63줄(추가 0줄) 섞여 있고, plan 문서는 이를 언급하지 않는다.
  - 위치: `pnpm-lock.yaml` — 예: `@@ -1241,28 +1241,24 @@ packages:` 부근(`@css-inline/css-inline-linux-*-gnu/musl@0.20.0`), `@@ -1798,105 +1794,89 @@`(`@img/sharp-libvips-linux-*`), `@@ -2348,35 +2328,30 @@`(`@napi-rs/canvas-linux-*`), `@@ -3362,42 +3334,36 @@`(`@parcel/watcher-linux-*`), `@@ -3997,42 +3963,36 @@`(`@rolldown/binding-linux-*`), `@@ -4173,28 +4133,24 @@`(`@tailwindcss/oxide-linux-*`), `@@ -4813,61 +4769,51 @@`(`@unrs/resolver-binding-linux-*`), `@@ -7692,56 +7638,48 @@`(`lightningcss-linux-*`) 등 — 삭제된 줄이라 새 파일 기준 게이트가 비어 있어 hunk 헤더 컨텍스트로 특정함.
  - 상세: `git diff origin/main -- pnpm-lock.yaml | grep -c '^-.*libc:'` = 63, `grep -c '^+.*libc:'` = 0. 직전 5개의 단일-의존성 범프 커밋(`85923ccda` next, `51c1a89c9` testing-library, `16902fd52` prettier, `b584d6948` tanstack-query, `6dcee50db` pg)은 모두 이 패턴이 **0건**이었다 — 이번 PR에서만 나타난 새로운 형태다. plan(`deps-typeorm12.md` §B)은 "그래서 이 PR 은 한 줄이다"라고 스코프를 서술하지만, 실제 lockfile 순변경은 `11 insertions(+), 73 deletions(-)`로 `@nestjs/typeorm` 자체 변경분(specifier/version/resolution/peerDependencies/snapshot, 약 10줄)을 크게 초과한다. 영향받는 패키지들(next/swc, tailwindcss/oxide, lightningcss, parcel-watcher 등)은 backend 의존 그래프가 아니라 대부분 frontend/툴체인 쪽으로 보이고, plan의 TEST WORKFLOW 체크리스트가 backend Docker 빌드(`--frozen-lockfile`)·e2e 통과를 주장하므로 **관측된 회귀는 없다**. 다만 원인(왜 이 특정 범프에서만 무관한 63줄이 같이 정리됐는지)이 plan에 설명돼 있지 않아, "한 줄"이라는 서술과 실제 diff 크기 사이에 괴리가 있다.
  - 제안: CRITICAL은 아니나, plan `deps-typeorm12.md` §B에 이 lockfile 부수 변경을 한 줄 언급(예: "pnpm이 재해석하며 무관 optionalDependency의 `libc` 메타데이터 63건도 함께 정리됨 — `--frozen-lockfile` 검증으로 무해함 확인")하거나, `pnpm install --frozen-lockfile`을 재실행해 idempotent함(추가 diff가 안 남)을 확인해 두면 향후 이 PR을 감사하는 사람이 놀라지 않는다.

- **[INFO]** `review/consistency/2026/09/24/17_31_27/_retry_state.json`이 실제 실행 결과(전 5개 checker 완료, `SUMMARY.md`/`meta.json`/각 checker `.md` 존재)와 달리 `agents_pending`에 5개 checker가 모두 남아 있고 `agents_success: []`로 커밋돼 있다.
  - 위치: `review/consistency/2026/09/24/17_31_27/_retry_state.json:37`~`44` (`agents_pending` 배열, `agents_success: []`)
  - 상세: 평문 Agent fan-out 경로(`code-review-agents`/`consistency-checker` fallback)를 쓴 경우 이 파일은 재시도 오케스트레이터 전용 상태 파일이라 갱신되지 않고 초기 스냅샷 그대로 남는 것이 알려진 동작(메모: "Agent fan-out consistency 는 meta.json 필수")과 일치하며, `meta.json`이 존재하므로 impl-done 게이트 집계 자체는 정상 작동한다. 코드/스펙 결함은 아니고 harness 아티팩트 수준의 사소한 불일치.
  - 제안: 조치 불요. 향후 이 파일만 보고 "체크가 안 돌았다"고 오판하지 않도록 참고.

## 요구사항 충족 관점 평가

이번 변경은 `@nestjs/typeorm`을 `^11.0.3` → `^12.0.1`로 올리는 단일 런타임 의존성 범프이며, 코드(TypeScript) 변경은 없다. 실측으로 다음을 직접 재현·확인했다: (1) peer 범위가 `^10||^11||^12`라 `@nestjs/common@11.1.27` 위에서 그대로 동작, (2) 저장소가 명문화한 "`@nestjs/*` 업그레이드 시 reflection 보안 회귀 우선조사" 트리거(§C)를 실제로 이행해 3개 reflection 스위트 48/48 통과 및 판별자 뮤턴트(`handlerConsumesWorkspaceId`→항상 false)로 동일하게 9/48 RED가 재현됨(fail-open 가드가 살아있음을 대체 증명), (3) unit 스위트 수(473) 일치, (4) `spec/` 변경이 전혀 없고(`spec_impact: none`과 정합), 유일하게 영향받을 수 있었던 spec 인용(`1-auth.md:807`의 `^11.0.1`)은 `@nestjs/common`을 건드리지 않아 여전히 참이므로 즉시 정정 불요라는 plan의 판단도 타당하다. consistency-check(`--impl-prep`)는 BLOCK:NO·Critical 0이며 남은 Warning 3건은 모두 이번 변경과 무관한 기존 문서 drift로 이미 후속 항목으로 추적 중이다. 유일한 흠은 `pnpm-lock.yaml`에 딸려온, 무관해 보이는 63줄의 `libc` 메타데이터 삭제가 plan 문서에 설명되지 않은 점(WARNING, 기능적 회귀 증거는 없음)이다. 전반적으로 기능 완전성·엣지 케이스·에러 시나리오·spec 정합성 모두 충족된 것으로 판단된다.

## 위험도

LOW
