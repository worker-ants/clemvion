# Scope Review — 2026/08/29 12:23:45

## 방법

`git log --oneline origin/main..HEAD` 로 이 브랜치의 3개 커밋(`3e2360db0`, `58806c380`,
`89e9b5d53`)을 확인하고, 각 커밋의 실제 diff(`git show`)를 프롬프트의 unified diff/전체
파일 컨텍스트와 대조했다. `git diff --stat origin/main...`(15개 파일, +787/-27)가 프롬프트가
나열한 15개 파일과 정확히 일치함을 확인했다 — 프롬프트에 없는 파일이나 프롬프트에는 있는데
실제 diff에 없는 파일이 없다. 저장소에 대한 뮤테이션은 수행하지 않았다(`git status --short`
는 이 세션의 `review/code/2026/08/29/12_23_45/` 미추적 디렉터리 하나만 보고 — 스코프 리뷰는
가설 검증용 코드 뮤테이션이 필요 없는 문서/테스트 diff라 생략).

## 배경 — 이 diff 가 대응하는 대상

`plan/in-progress/deps-peer-gating-and-eslint10.md` §2 후속 트래커(파일 4)와
`review/code/2026/08/29/11_58_35/` 리뷰 라운드(파일 5~15, 이 diff로 새로 커밋됨)가 명시한
두 갈래 작업이다:

1. C2 캐너리를 "주석"에서 "단언"으로 승격 (`3e2360db0`) + `secret-resolver.service.ts`
   주석 보강.
2. 그 라운드가 낸 Warning 3건(캐너리가 실제로는 syntax 1종만 지나감·plan 뮤테이션표 M3
   누락·캡처 보일러플레이트 반복) 수정 (`89e9b5d53`) + TEST WORKFLOW 기록 (`58806c380`).

## 발견사항

- **[INFO]** `review/code/2026/08/29/11_58_35/*`(RESOLUTION.md·SUMMARY.md·`_retry_state.json`·
  `meta.json`·`documentation.md`·`maintainability.md`·`requirement.md`·`scope.md`·`security.md`·
  `side_effect.md`·`testing.md`, 11개 파일)가 이번 diff 로 신규 커밋됐다. 스코프 관점에서
  "무관한 파일 추가"로 보일 수 있으나, `plan/in-progress/deps-peer-gating-and-eslint10.md`
  체크리스트(파일 4 전체 파일 컨텍스트 L864~890, "결정 (2026-08-29, 사용자): 관례에 맞춰
  넓힌다")가 이 저장소는 `developer` 가 매 리뷰 라운드 산출물 전체를 커밋하는 것이 확립된
  관례라고 명시적으로 결정해 뒀다. 따라서 이 추가는 스코프 이탈이 아니라 그 결정의 정상
  집행이다.
  - 위치: N/A (신규 파일 15개 중 11개, `review/code/2026/08/29/11_58_35/` 디렉터리 전체)
  - 상세: 위 근거로 조치 불요.
- **[INFO]** `code.handler.spec.ts`/`expression-resolver.service.spec.ts` 에 추가된
  `captureRejected`/`captureThrown` 헬퍼는 직전 리뷰 라운드(`11_58_35`) Warning #3 이 정확히
  요구한 리팩터("캡처 보일러플레이트를 로컬 헬퍼로 추출")다. 최소 변경 범위(두 spec 파일,
  각각 헬퍼 1개 + 기존 케이스 치환)를 벗어나지 않았고 프로덕션 코드는 건드리지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (`captureThrown` 함수, `describe('ExpressionResolverService', …)` 위) / `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (`captureRejected` 함수)
  - 상세: 요청된 범위 내 리팩터링. 문제 없음.
- **[INFO]** `it.each` 확장 시 `expect(shape.code as string).toMatch(/^EXPR_[A-Z_]+$/)`(정규식)를
  `expect(shape.code).toBe(expectedCode)`(정확값)로 강화했다. Warning #1이 요구한 "세 클래스를
  각각 실행 경로로 지나가게" 확장에 자연히 딸린 변경이다(파라미터화된 `expectedCode` 가 있으므로
  정확 비교가 더 강한 회귀 가드가 된다) — 스코프 이탈 아님.
  - 위치: 위 spec 파일의 `it.each([...])(...)` 블록
- **[INFO]** `secret-resolver.service.ts` 의 주석 4줄 보강은 이번 세션의 신규 변경이 아니라
  브랜치 첫 커밋(`3e2360db0`)에서 이미 들어간 것이고, 그 시점의 리뷰 라운드가 "plan 은 '한
  문장'을 예고했는데 실제로는 4줄 문단" 을 INFO(조치 불요)로 이미 판정했다. 이번 diff(orig/main
  대비 누적)에 다시 나타난 것뿐이라 이번 라운드의 새 스코프 항목이 아니다.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:95`-`99`(`resolve()` catch 블록 주석)

무관한 파일 수정, 요청 밖 기능 확장, 의미 없는 포맷팅, 불필요한 import/설정 변경은 발견되지
않았다. 3개 커밋 모두 커밋 메시지가 인용하는 리뷰 라운드/plan 항목과 diff 내용이 1:1로
대응한다.

## 요약

이번 diff(15개 파일, +787/−27)는 `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 가
등재한 두 후속 항목(C2 캐너리 단언화, `secret-resolver` 주석 보강)과 그 직전 `/ai-review`
라운드(`11_58_35`)의 Warning 3건에 대한 정확한 대응으로 구성돼 있다. 리뷰 산출물 11개 파일이
새로 커밋된 것은 무관한 변경처럼 보이지만 plan 이 명시한 "매 라운드 산출물 전체 커밋" 관례의
정상 집행이다. `captureThrown`/`captureRejected` 헬퍼 추출과 `it.each` 확장도 직전 리뷰가
문자 그대로 요청한 범위 안에 있다. 의도 이상의 변경, 불필요한 리팩토링, 기능 확장, 포맷팅
잡음은 발견되지 않았다.

## 위험도

NONE
