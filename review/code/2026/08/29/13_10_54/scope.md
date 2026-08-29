# 변경 범위(Scope) 리뷰

## 방법

`git log --oneline origin/main..HEAD` 로 이 브랜치의 커밋 5개(`3e2360db0` → `58806c380` →
`89e9b5d53` → `86f74145d` → `0718302bc`)를 확인했다. 프롬프트가 제시한 cumulative diff(38개
파일, +2577/−27)는 파일 1~4(코드/테스트) + 파일 5(`plan.md`) + 파일 6~38(직전 세 리뷰 라운드
`11_58_35`/`12_23_45`/`12_50_04` 의 산출물 33개)로 구성된다.

이번 4라운드(`13_10_54`)에서 실제로 새로 추가된 것은 최신 커밋 `0718302bc` 하나뿐이다 —
`git show --stat`으로 각 커밋의 파일 목록을 개별 대조한 결과, 나머지 34개 파일(코드 3개 +
review 산출물 33개)은 전부 이전 커밋에서 이미 들어간 것이었다. `0718302bc` 의 실제 diff는
3개 파일뿐이다:

- `expression-resolver.service.spec.ts` — 2줄 (주석 "셋이"→"넷이")
- `packages/expression-engine/src/__tests__/error-shape.spec.ts` — 40줄 (`EXPECTED_CODE` 표 +
  1:1 단언 + `position` 단언 정확값화)
- `plan/in-progress/deps-peer-gating-and-eslint10.md` — 15줄 (4라운드 교훈 기록)

저장소에 대한 뮤테이션은 수행하지 않았다(`git status --short` = 이 세션의
`review/code/2026/08/29/13_10_54/` 미추적 디렉터리 하나만 보고).

## 발견사항

- **[INFO]** 직전 리뷰 라운드(`review/code/2026/08/29/12_50_04/scope.md`)가 이미 판정한
  "review 산출물 전체 커밋" 관례가 이번에도 그대로 반복된다 — 새로운 스코프 이슈 아님.
  - 위치: N/A (파일 28~38, `review/code/2026/08/29/12_50_04/*` 11개 — 커밋 `0718302bc` 에 번들)
  - 상세: `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 "결정 (2026-08-29, 사용자):
    관례에 맞춰 넓힌다" 항목이 `CLAUDE.md` 권한표(`developer` → `review/**`)를 실제로 갱신했음을
    `CLAUDE.md:64` 에서 직접 확인했다(과거 세 라운드가 인용한 근거가 그대로 유효). fix 커밋이
    직전 라운드의 리뷰 산출물을 함께 커밋하는 것은 라운드 1→2, 2→3 에서도 동일하게 반복된
    패턴이라(각 fix 커밋 diffstat 대조로 확인) 이번 라운드가 새로 만든 것이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 최신 커밋(`0718302bc`)은 직전 라운드(`12_50_04`)가 낸 Warning #1·#2·INFO #1 세
  항목에 **정확히 대응**하고 그 외 어떤 코드도 건드리지 않았다.
  - 위치: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts`(`EXPECTED_CODE`
    표 신설, `it('클래스↔코드 표가 하위 클래스와 1:1 이다', …)` 신설, `it.each` 콜백의
    `Object.values(ErrorCode)).toContain(err.code)` → `expect(err.code).toBe(EXPECTED_CODE[name])`,
    `err.position === undefined || Number.isInteger(...)` → `expect(err.position).toBeUndefined()`),
    `expression-resolver.service.spec.ts`(주석 1줄 "셋이"→"넷이")
  - 상세: 프로덕션 코드(`expression-resolver.service.ts`, `code.handler.ts`,
    `packages/expression-engine/src/errors.ts`/`evaluator.ts`)는 이번 커밋에서 전혀 변경되지
    않았다(`git show --stat 0718302bc` 로 확인). 새 export·새 public API·새 의존성·설정 파일
    변경도 없다. `plan.md` 변경분(15줄)도 이 커밋의 근거(뮤테이션 M11/M12 표, "순회 축과 단언
    축은 따로다" 교훈)만 기록하며 무관한 서술을 추가하지 않았다.
  - 제안: 조치 불요.

무관한 파일 수정, 요청 밖 기능 확장, 의미 없는 포맷팅, 불필요한 import/설정 변경은 이번
커밋에서 발견되지 않았다. `EXPECTED_CODE` 상수 도입은 "정확값 비교로 전환"이라는 리뷰 요청
그대로의 최소 구현이며, `TimeoutError`/`DepthExceededError` 매핑까지 표에 포함시킨 것도
"클래스 전수"라는 기존 캐너리 설계 축(3라운드에서 이미 확정)의 자연스러운 연장이라 별도
스코프 확장으로 보지 않는다.

## 요약

이번 diff(누적 38개 파일)의 대부분은 이전 세 라운드에서 이미 스코프 검증을 마친 내용이고,
이번 4라운드에서 실제로 새로 커밋된 것은 `0718302bc` 하나뿐이다. 그 커밋은 직전 리뷰
(`12_50_04`)의 Warning 2건 + INFO 1건에 대한 RESOLUTION이며, 대상 파일 2개(테스트 스펙)와
plan 문서 1개만 건드렸다. 변경 폭(주석 1단어 정정 + 정확값 단언 표 도입)은 지적된 결함의
크기와 정확히 비례하고, 프로덕션 코드·설정·의존성·import 는 이번에도 전혀 건드리지 않았다.
직전 라운드가 이미 INFO 로 판정해 둔 "review 산출물 전체 커밋" 관례도 근거 문서
(`CLAUDE.md:64`, plan §2 결정 항목)를 재확인한 결과 유효하다. 스코프 이탈 없음.

## 위험도

NONE
