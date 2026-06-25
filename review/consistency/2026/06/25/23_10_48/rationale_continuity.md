# Rationale 연속성 검토

## 발견사항

### [INFO] 컴포넌트 배치 경로 — 계획 제안과 상이하나 Rationale 위반 아님
- **target 위치**: `new/_components/auth-step.tsx`, `new/_components/test-step.tsx`, `new/_components/cafe24-private-pending-step.tsx`, `new/_components/makeshop-pending-step.tsx`
- **과거 결정 출처**: `plan/in-progress/refactor/03-maintainability.md` m-3 개선 방안 1번 — "components/integrations/steps/ 로 AuthStep/TestStep/SaveStep 분리"
- **상세**: plan의 개선 방안은 `components/integrations/steps/` 경로를 제안했으나, 구현은 `new/_components/` (라우트-로컬)로 배치했다. 이 차이는 impl-prep 검토(scope 기술의 "컴포넌트 라우트-로컬(impl-prep I1)")에서 이미 INFO 수준으로 명시적으로 기록된 의도적 결정이다. spec(`4-integration.md`)은 컴포넌트 파일 경로를 명문화하지 않으며, `spec/0-overview.md` 및 `spec/2-navigation/4-integration.md` 의 `## Rationale` 어디에도 "step 컴포넌트는 공유 디렉토리에 두어야 한다"는 기각·합의된 원칙이 없다. plan의 개선 방안은 권장 설계이지 합의된 invariant가 아니므로 Rationale 위반에 해당하지 않는다.
- **제안**: 변경 불필요. 라우트-로컬 배치가 의도된 결정임을 plan m-3 완료 항목 주석에 한 줄 기록해두면 후속 리뷰어의 의문을 차단할 수 있다.

### [INFO] `useDraftRestore` 대신 `useUnsavedChangesWarning` 사용 — spec 행위 대비 더 정확한 명명
- **target 위치**: `codebase/frontend/src/lib/hooks/use-unsaved-changes-warning.ts`, `new/page.tsx` import
- **과거 결정 출처**: `plan/in-progress/refactor/03-maintainability.md` m-3 개선 방안 2번 — "`useOauthPopupReturn`/`useDraftRestore` hook 으로"
- **상세**: plan은 §3.6 이탈·복원 훅을 `useDraftRestore`로 부르지만, 구현은 `useUnsavedChangesWarning`으로 명명했다. `spec/2-navigation/4-integration.md §3.6` (`beforeunload에서 입력 중인 자격 증명이 있으면 경고`)은 "복원(restore)" 동작을 요구하지 않고 "이탈 경고"만 규정한다. 훅 이름 차이는 spec 행위를 더 정확하게 반영한 결과이며, plan의 `useDraftRestore` 명칭이 spec보다 넓은 의미를 가진 표현이었다. `spec/2-navigation/4-integration.md ## Rationale`에는 이 훅의 이름·구현 방식에 관한 기각 항목이 없다.
- **제안**: 변경 불필요. spec이 규정하는 행위(`beforeunload` 경고)를 정확히 구현하였으며 plan 용어와의 차이는 spec 대비 더 정확한 쪽이다.

### [INFO] `openOAuthPopup` 함수를 module-private으로 배치 — impl-prep에 기록된 결정
- **target 위치**: `codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` (module-private 함수로 포함)
- **과거 결정 출처**: scope 기술 "openOAuthPopup module-private(impl-prep W1)"
- **상세**: 기존 `page.tsx`에 있던 `openOAuthPopup` 함수가 별도 export로 분리되지 않고 `use-oauth-popup-return.ts` 내부 module-private 함수로 유지되었다. `spec/2-navigation/4-integration.md §3.5`의 팝업 로직(600×700 크기, "integration-oauth" 윈도우 이름)을 훅 내부에서 올바르게 구현하고 있으며, spec의 `## Rationale` 어디에도 "팝업 open 함수는 별도 export여야 한다"는 합의 원칙이 없다. impl-prep 검토에서 W1로 명시적으로 기록·수용된 결정이다.
- **제안**: 변경 불필요.

## 요약

본 refactor(m-3, `integrations/new/page.tsx` 1444→448줄 분할)는 `spec/2-navigation/4-integration.md`의 `## Rationale` 및 관련 spec의 `## Rationale`에 기각되거나 폐기된 결정을 재도입하지 않았다. 합의된 invariant — §3.5 OAuth popup state machine(postMessage 수신, 5분 timeout, popup.closed polling 1500ms 유예), §3.6 beforeunload 이탈 경고, §3.1 URL 쿼리 파라미터 step 제어, Cafe24/MakeShop pending_install 폴링(§3.2/§5.9) — 은 모두 정확히 보존되었다. 발견된 3건은 모두 INFO 등급으로, plan 제안 언어와의 차이 또는 impl-prep에서 이미 기록된 의도적 배치 결정이다. Rationale 연속성 관점에서 기각 대안 재도입이나 합의 원칙 위반은 없다.

## 위험도

NONE
