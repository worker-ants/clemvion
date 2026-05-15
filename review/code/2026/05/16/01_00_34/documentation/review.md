# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `openOAuthPopup` 함수에 JSDoc 없음
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` 전체 (11줄)
  - 상세: 공개 유틸리티 함수로 별도 모듈로 추출되었으나 파라미터(`url: string`) 와 동작(팝업 크기·위치 계산 후 `window.open` 호출)에 대한 JSDoc 이 없다. 함수 자체가 단순해 즉시 파악 가능하므로 치명적이지는 않으나, 공용 모듈로 추출된 만큼 최소한의 문서는 권장된다.
  - 제안: `/** Opens a centered OAuth popup window. @param url — The authorization URL to open. */` 한 줄 JSDoc 추가.

- **[INFO]** `ScopeTab` 컴포넌트에 props 문서 없음
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` 라인 572–582 (함수 시그니처)
  - 상세: `integration`, `service`, `onChanged`, `t` 4개의 props 가 인라인 타입으로 선언되어 있으나 각 prop 의 역할·제약에 대한 JSDoc 이 없다. 특히 `service` 가 `undefined` 일 수 있는 이유, `onChanged` 가 호출되는 시점이 문서화되어 있지 않다.
  - 제안: 컴포넌트 선언부 위에 JSDoc 블록을 추가하거나, 최소한 `service?: ServiceDefinition` 에 "undefined when service definition is not yet loaded" 수준의 인라인 주석을 추가.

- **[INFO]** `RequestScopesResult` 타입에 JSDoc 없음
  - 위치: `frontend/src/lib/api/integrations.ts` 라인 798–806
  - 상세: `OAuthBeginResult` 와 분리된 새 discriminated union 타입이지만, 두 variant 의 의미 차이 — 특히 `cafe24_private_pending` variant 의 `scopesAdded` 필드가 `OAuthBeginResult` 의 동일 variant 에는 없는 이유 — 가 타입 선언만으로는 파악하기 어렵다.
  - 제안: 타입 선언 위에 `/** Result of POST /integrations/:id/request-scopes. Cafe24 Private returns cafe24_private_pending mode with scopesAdded instead of an authUrl. */` JSDoc 추가.

- **[WARNING]** plan 체크리스트가 완료 상태와 불일치 — 미완 항목이 commit 에 포함됨
  - 위치: `plan/in-progress/cafe24-request-scopes-ui.md` 라인 1048–1054
  - 상세: commit 에 포함된 `plan/in-progress/cafe24-request-scopes-ui.md` 의 체크리스트를 보면 `[ ] i18n 키 추가`, `[ ] requestMutation.onSuccess 분기 + inline alert 렌더링`, `[ ] 단위 테스트 추가`, `[ ] lint / unit test / build`, `[ ] [skip-e2e] 표기`, `[ ] ai-review + RESOLUTION`, `[ ] plan complete 이동` 이 모두 미체크 상태로 commit 되었다. 그런데 실제 diff 에는 i18n 키 추가·컴포넌트 구현·테스트 추가가 모두 포함되어 있다. plan 문서가 구현 완료 시점의 실제 상태를 반영하지 않아 문서와 코드 현황이 불일치한다.
  - 제안: commit 시점에 완료된 항목은 `[x]` 로 갱신한 뒤 commit 해야 한다. ai-review 와 RESOLUTION, plan complete 이동은 이후 단계이므로 미체크가 맞지만, 구현 항목은 체크 상태여야 한다.

- **[INFO]** consistency-checker I-1·I-2·I-4 권고(spec 역반영)가 plan 에 후속 항목으로 명시되지 않음
  - 위치: `plan/in-progress/cafe24-request-scopes-ui.md` 전체 / `review/consistency/2026/05/16/00_36_35/SUMMARY.md` INFO 섹션
  - 상세: consistency-checker 는 구현 완료 후 `spec/2-navigation/4-integration.md §4.4` 에 (1) ko/en 번역본 역반영, (2) `scopesAdded` UI 표현 방식 한 줄 추가, (3) "inline alert + toast.info 병행" 방식 한 줄 추가를 권고했다(I-1, I-2, I-4). 이 후속 스펙 갱신 사항이 plan 체크리스트에 별도 항목으로 등록되어 있지 않아 추적되지 않을 위험이 있다.
  - 제안: plan 체크리스트에 `[ ] spec/2-navigation/4-integration.md §4.4 역반영 (I-1·I-2·I-4 — project-planner 위임)` 항목을 추가해 후속 작업이 누락되지 않도록 한다.

- **[INFO]** `scope-tab.tsx` 의 `cafe24_private_pending` 분기 처리 로직에 인라인 주석 없음
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` 라인 604–611 (`onSuccess` 핸들러)
  - 상세: `"authUrl" in res` 체크와 `"mode" in res && res.mode === "cafe24_private_pending"` 체크가 discriminated union 의 두 variant 를 구분하는 핵심 로직이지만 왜 `in` 연산자를 쓰는지, 이 두 분기가 어떤 비즈니스 케이스를 처리하는지 설명이 없다. 특히 기존 `OAuthBeginResult` 와 새 `RequestScopesResult` 가 구조적으로 겹치는 부분이 있어 혼동이 생길 수 있다.
  - 제안: 분기 직전에 `// authUrl: standard OAuth provider / cafe24_private_pending: Cafe24 Private cannot initiate OAuth externally — show inline guidance instead` 같은 한 줄 주석 추가.

- **[INFO]** `openOAuthPopup` 함수의 창 크기·이름(`"integration-oauth"`)에 대한 근거 주석 없음
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` 라인 279–289
  - 상세: `width=600`, `height=700`, 창 이름 `"integration-oauth"` 는 하드코딩된 매직 넘버·문자열이다. 동일한 창 이름을 재사용하면 이미 열린 팝업이 재활용된다는 브라우저 동작이 의도적인지 주석이 없어 파악하기 어렵다.
  - 제안: `// Reusing the same window name reuses the existing popup if still open.` 한 줄 주석 추가. 크기는 상수(`POPUP_WIDTH`, `POPUP_HEIGHT`)로 추출하거나 주석으로 의도를 명시.

## 요약

이번 변경은 commit message 가 변경 이유·범위·spec 참조·consistency-checker 검토 결과를 충실히 담고 있어 변경 이력 문서화 측면은 양호하다. i18n 딕셔너리(ko/en)는 함께 추가되었고 plan 문서도 생성되어 작업 추적 구조는 갖추어져 있다. 다만 두 가지 문서화 취약점이 있다. 첫째, 공용 모듈로 추출된 `openOAuthPopup` 과 `ScopeTab`, 그리고 새로 신설된 `RequestScopesResult` 타입에 JSDoc 이 전혀 없어 독립 모듈로서의 자기 설명력이 낮다. 둘째, plan 체크리스트가 실제 완료된 구현 항목을 반영하지 않고 미체크 상태로 commit 되었으며, consistency-checker 가 권고한 spec 역반영 후속 작업(I-1·I-2·I-4)이 plan 에 추적 항목으로 등록되어 있지 않아 완료 후 누락될 위험이 있다. 전반적으로 사용자 표시 문구와 비즈니스 로직의 정합성은 spec 에 근거하고 있으나, 코드 자체의 자기 문서화와 plan 상태 동기화가 미흡하다.

## 위험도

LOW
