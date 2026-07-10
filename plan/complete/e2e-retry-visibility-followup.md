---
worktree: (unstarted)
started: 2026-07-09
owner: developer (다음 진입자)
---

# e2e CI retry 가시성 (flaky surfacing) 후속

> 파생: `test(e2e): Playwright 스위트 flakiness 안정화` (branch `claude/e2e-stabilization-b50e19`)
> 의 ai-review WARNING #2 (session `review/code/2026/07/09/16_38_12/`).
> 참조: `codebase/frontend/playwright.config.ts` `retries` 주석.

## 배경

CI 에서 `retries: 2` 를 도입해 순간 timing flake 를 흡수한다(안정화 PR). 부작용으로
**진짜 회귀(타이밍 아닌 결함)가 2차 시도에서 우연히 통과하면 CI green 으로 보고**될 수 있다.

- 부분 완화(이미 있음): Playwright `list`/`html` reporter 는 retry 로 통과한 테스트를
  `flaky`(passed 와 구분)로 별도 집계한다 → **run 로그·HTML 리포트에는 flaky 수가 보인다**.
- 남은 갭: CI 게이트(exit code)는 flaky 를 실패로 치지 않으므로, 아무도 로그를 안 보면
  flaky 가 방치된다. **능동적 surfacing 수단이 없다.**

## 할 일 (택1 이상)

1. **PR 코멘트 surfacing** — e2e job 후 `playwright-report/` 의 JSON(또는 HTML) 을 파싱해
   `retries > 0` 로 통과한 테스트 목록을 PR 코멘트/Slack 으로 노출. (CI 워크플로 변경 필요 —
   이 저장소 frontend config 범위 밖이라 별도 과제로 분리.)
2. **known-flaky quarantine** — 상습 flaky 스펙을 별도 리스트/프로젝트로 격리하고
   "재시도로 통과 = 여전히 미해결" 을 명시적으로 추적. 근본 원인(prod 빌드 hydration·query
   해소 타이밍) 해소 시 리스트에서 제거.

## 곁가지 — sub-global timeout override 재발 방지 가드 — ✅ 완료

> 파생: 안정화 fix 커밋 fresh 리뷰(`review/code/2026/07/09/18_39_22/`) INFO 2.
> **해소(branch `claude/e2e-timeout-override-guard-5d0c86`)**: unit 가드
> `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` — `e2e/**` 의
> bare-numeric `timeout: N`(N < `playwright.config.ts` 의 `expect.timeout`) 를 CI(unit)로 차단.
> 전역값은 config 에서 파싱(SoT 동기). `PROJECT.md §Frontend e2e 패턴` 에 컨벤션 명문화.

전역 `expect.timeout`(10_000) **미만**의 하드코딩 timeout override 가 스펙에 흩뿌려지면
전역 상향(Tier 3)의 slack 이 그 스펙에 닿지 못한다(동일 anti-pattern 이 16_38_12→18_39_22
두 세션에 걸쳐 지적·수정된 이력). discipline 에만 의존하지 않도록 **CI lint 단계에
"전역 기본 미만 sub-global timeout override 검출" grep/ESLint 가드**를 추가하거나,
`PROJECT.md` §e2e 작성 패턴에 "positive wait 는 전역 기본에 위임, 개별 override 는 전역
초과 시에만" 을 명문화한다.

## 비고

- 안정화 PR 자체는 flaky 의 **발생 빈도**를 줄인다(prod 빌드 Tier 2·전역 timeout Tier 3).
  본 후속은 **남은 flaky 를 숨기지 않고 관측**하는 별개 관심사.
- 우선순위: 낮음(관측/운영 개선, 기능·정합 영향 없음). CI 파이프라인 정비 시 함께 처리 권장.
