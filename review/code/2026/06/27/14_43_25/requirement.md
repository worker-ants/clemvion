# 요구사항(Requirement) 리뷰 — 컴포저 전송버튼 로딩 스피너 + idle 중립 회색

리뷰 대상 커밋: `71816df8` — `fix(web-chat): 컴포저 전송버튼 — AI 응답 중 스피너 + idle 중립 회색`

---

## 발견사항

### [WARNING] [SPEC-DRIFT] Composer 로딩 표시(spinner / aria-busy / "AI 응답 중") — spec 미반영

- **위치**: `codebase/channel-web-chat/src/widget/components/composer.tsx` (새 `loading` prop 전체), `components/panel.tsx` (loading 전달 로직), `widget/styles.ts` (`.wc-composer-spinner`, `@keyframes wc-spin`, `.wc-composer-send[aria-busy="true"]:disabled` 규칙)
- **상세**: `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행은 "booting/streaming 중이거나 현재 표면이 buttons/form 이면 비활성(사용자는 선택/제출로 응답)" 까지만 정의하며, 비활성 시 전송버튼의 **시각 피드백(스피너·회색·aria-busy)** 을 규정하지 않는다. R6 Rationale(§R6)도 입력 차단 정책만 다루고 로딩 표시 UX 는 언급 없다. 구현이 R6 입력 차단은 그대로 유지하면서 **UX/접근성 개선으로 의도적으로 확장**한 것이므로, 코드를 되돌리는 것이 아니라 spec 갱신이 필요한 SPEC-DRIFT 다.
- **제안**: 코드 유지. `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행에 다음 내용 추가 반영 (`project-planner` 위임):
  - `booting`/`streaming` 중 전송 버튼: `aria-busy="true"` + `aria-label="AI 응답 중"` + 스피너 표시(브랜드 컬러 유지).
  - 그 외 비활성(빈 입력 · buttons/form 표면): 중립 회색(`#c7cad1`) 표시.
  - 갱신 대상 spec 위치: `spec/7-channel-web-chat/1-widget-app.md §2` 표 — "입력창" 행 "동작" 열.

---

### [INFO] Composer 컴포넌트 자체에서 `loading=true, disabled=false` 조합 비방어

- **위치**: `/codebase/channel-web-chat/src/widget/components/composer.tsx` 37–40 행
- **상세**: `loading` 과 `disabled` 는 독립 props 다. `loading=true` 이면서 `disabled=false` 이면 스피너는 표시되지만 버튼이 활성 상태가 되어 사용자가 클릭 가능하다. 현재 `panel.tsx` 에서 `loading={phase === "booting" || phase === "streaming"}` 일 때 `disabled` 도 반드시 `true` 이므로 이 조합은 실제로 발생하지 않는다. 단, Composer 를 독립 재사용할 경우 API 계약이 암묵적이다. `submit` 함수가 `disabled` 를 추가로 검사(`if (!trimmed || disabled) return`)하므로 제출 자체는 막히지만, 시각적으로 스피너와 클릭 가능 버튼이 동시에 보이는 상태가 가능하다.
- **제안**: 현재 사용 범위 내에서는 문제 없음. 중장기적으로 JSDoc 또는 런타임 invariant(`if (loading && !disabled) console.warn(...)`)로 API 계약을 명시하는 것을 권장한다.

---

### [INFO] 테스트에서 `.querySelector` 직접 DOM 접근 사용

- **위치**: `codebase/channel-web-chat/src/widget/components/panel.test.tsx` 193행 — `btn.querySelector(".wc-composer-spinner")`
- **상세**: React Testing Library 권장 패턴(`getByRole`, `getByTestId`, `within`)을 우회하고 raw DOM 쿼리를 사용한다. 스피너의 CSS 클래스명이 변경되면 테스트가 실패하는 내부 구현 결합도가 있다. 기능 정확성은 유지되며, 스피너에 `data-testid` 를 부여하는 방식으로 개선 가능하다.
- **제안**: 단기 차단 이슈 아님. 향후 스피너 렌더 검증 방식을 `getByRole` 기반으로 개선 시 참고.

---

## 요구사항 충족 평가

핵심 요구사항인 R6(booting/streaming 중 입력 차단)은 변경 이후에도 완전히 보존된다. `disabled` 게이팅 로직(`phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"`)은 변경 없이 유지되고, `loading` prop 은 순수하게 시각·접근성 레이어에만 작용한다. 추가된 스피너·회색 스타일·aria-busy·aria-label 변경은 명시적으로 계획에 기술된 의도(commit message, plan doc)와 일치하며 동작을 변경하지 않는다. 회귀 테스트(streaming/booting/awaiting 3케이스)가 추가되어 향후 변경 시 안전망이 확보됐다. 주요 발견은 코드 결함이 아닌 SPEC-DRIFT — spec 본문이 새 UX 동작을 반영하지 않은 상태다.

## 위험도

LOW
