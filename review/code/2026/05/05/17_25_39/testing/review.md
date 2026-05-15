### 발견사항

- **[WARNING]** `reset-password` 페이지 테스트 누락
  - 위치: `smoke.spec.ts` — describe 블록 제목 "forgot-password / reset-password"
  - 상세: describe 이름에 `reset-password`가 명시되어 있으나 실제 테스트는 `forgot-password`만 있음. `reset-password-form.tsx`도 이번 변경에 포함되었고, 토큰 유효성 분기(유효/무효/성공)가 있는 복잡한 페이지임에도 axe scan 조차 없음.
  - 제안: `/reset-password?token=test` 경로에 대해 axe critical scan + h1 count 테스트 추가. 토큰 없을 때(폼 숨김 상태)와 있을 때(폼 노출 상태) 두 경우를 커버.

- **[WARNING]** 키보드 진입 테스트 assertion이 과도하게 허용적
  - 위치: `smoke.spec.ts:98-106` — `expect(["A", "INPUT", "BUTTON"]).toContain(focused)`
  - 상세: 주석에는 "폼 내부 첫 input(email)으로 직접 도달"한다고 명시되어 있으나, 실제 assertion은 `A`/`INPUT`/`BUTTON` 셋 중 하나면 통과함. 만약 포커스가 `A` 태그(링크)에 잡혀도 통과하므로 포커스 순서가 깨져도 테스트가 그린 상태를 유지할 수 있음.
  - 제안: `expect(focused).toBe("INPUT")` 으로 좁히거나, `page.locator("input[type='email']").evaluate(el => el === document.activeElement)`를 사용해 특정 요소 확인.

- **[WARNING]** `StatusBadge` 내 다른 상태 아이콘에 `aria-hidden` 미적용 — 불일관 + 미검증
  - 위치: `result-detail.tsx:44-90` — `running`/`completed`/`failed`/`waiting_for_input` 케이스
  - 상세: `skipped`의 `MinusCircle`에만 `aria-hidden="true"`가 추가되었으나, `Loader2`, `CheckCircle`, `XCircle`, `PauseCircle` 아이콘에는 미적용. 텍스트 레이블("Running", "Done" 등)이 이미 의미를 전달하므로 아이콘은 모두 `aria-hidden`이어야 하는 일관된 패턴이 필요함. 이를 검증하는 단위 테스트가 없어 편향적 수정이 그대로 남음.
  - 제안: 나머지 4개 케이스에 `aria-hidden="true"` 추가. 해당 컴포넌트에 대한 vitest/RTL 단위 테스트를 작성해 각 상태별 `aria-hidden` 존재 여부 검증.

- **[WARNING]** axe 실패 시 위반 내용 디버깅 로그 없음 (login 대비 일관성 저하)
  - 위치: `smoke.spec.ts:84-91` — forgot-password axe scan 테스트
  - 상세: login 페이지 테스트는 `criticals.length > 0` 시 위반 id/description/target을 `console.log`로 출력하는 디버깅 블록이 있으나, forgot-password 테스트에는 없음. CI에서 실패 시 원인 추적이 어려워짐.
  - 제안: login 페이지 테스트의 디버깅 블록을 그대로 복사하거나, 공통 헬퍼 함수로 추출해 모든 axe 테스트에 적용.

- **[INFO]** `forgot-password` 페이지 h1 카운트 테스트 없음
  - 위치: `smoke.spec.ts` — forgot-password describe 블록
  - 상세: login/register 페이지는 각각 `h1 1개 존재` 테스트를 보유하나 forgot-password엔 없음. 헤딩 위계 회귀를 자동으로 잡을 수 없음.
  - 제안: `expect(await page.locator("h1").count()).toBe(1)` 테스트 추가.

- **[INFO]** 전체 위반 0 회귀 테스트가 login에만 존재
  - 위치: `smoke.spec.ts:50-69` — login만 `전체 위반 0 (회귀 감지)` 테스트 보유
  - 상세: register와 forgot-password는 critical=0만 검사함. serious/moderate 위반은 다음 릴리스에서 몰래 누적될 수 있음. login처럼 전체 위반 0 강제가 달성 가능하다면 동일 기준 적용이 바람직함.
  - 제안: register/forgot-password도 전체 위반 0 회귀 테스트를 추가하거나, 그 결정을 명시적으로 주석으로 문서화.

- **[INFO]** VoiceOver 수동 검증 체크리스트 결과 미기입
  - 위치: `review/2026-05-05_a11y/voiceover-notes.md:53-58`
  - 상세: "검증 일시", "검증자", "발견된 이슈" 필드가 비어있음. 체크리스트 항목도 모두 `[ ]` 미체크 상태. Stage 10 완료로 표기되어 있으나 수동 검증이 실제로 수행되었는지 기록으로 확인 불가.
  - 제안: 실제 VoiceOver 검증 수행 후 결과를 기입. 완료 전에는 PRD 상태를 `✅`가 아닌 `🚧`로 유지.

- **[INFO]** CSS 색 대비 수치의 정확성을 검증하는 독립 테스트 없음
  - 위치: `globals.css:17-19, 43-45`
  - 상세: 주석의 "~5.7:1", "~7:1" 수치는 계산 오류 가능성이 있고, 향후 다른 색 변수와의 조합에서 대비비가 달라질 수 있음. axe scan이 이를 간접 커버하지만, 어떤 CSS 변수 조합이 기준을 만족하는지에 대한 명시적 단위 테스트는 없음.
  - 제안: 현 수준에서는 axe smoke 테스트로 충분. 단, CSS 변수 변경 시 axe 테스트를 재실행해야 한다는 주석을 추가하면 미래 기여자에게 신호가 됨.

---

### 요약

이번 변경의 핵심인 e2e a11y smoke 테스트는 방향성이 올바르고 axe 자동 검사가 CSS 색 대비·링크 스타일 변경을 간접 커버한다. 그러나 describe 제목에 명시된 `reset-password` 페이지에 대한 테스트가 전혀 없는 점, 키보드 진입 테스트의 assertion이 지나치게 허용적인 점, `StatusBadge`에서 `skipped` 케이스만 `aria-hidden`이 적용되고 나머지 4개 상태는 누락된 점이 핵심 개선 과제다. VoiceOver 수동 검증 결과가 미기입된 상태에서 Stage 완료로 표기된 것도 추적 가능성 관점에서 위험하다.

### 위험도

**MEDIUM**