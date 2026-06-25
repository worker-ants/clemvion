# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `Cafe24PrivatePendingStep` 과 `MakeshopPendingStep` 간 구조적 중복
- **위치**: `codebase/frontend/src/app/(main)/integrations/new/_components/cafe24-private-pending-step.tsx` 전체, `makeshop-pending-step.tsx` 전체
- **상세**: 두 컴포넌트는 props 시그니처(`appUrl`, `callbackUrl`, `integrationId`, `t`), `copy()` 로컬 함수, `copiedField` 상태, URL 표시 블록(라벨 + code + Copy 버튼 x 2), 에러/상태 배너, polling 상태(`poll`, `timedOut`, `lastErrorMessage`) 처리 JSX가 거의 동일한 구조로 반복된다. 유일한 차이는 사용하는 polling 훅(`useCafe24PendingPolling` vs `useMakeshopPendingPolling`)과 i18n 키 prefix뿐이다. 향후 레이아웃/UX 변경 시 두 파일을 동시에 수정해야 하며 불일치 버그가 생길 위험이 있다.
- **제안**: `PendingInstallStep` 공통 컴포넌트로 통합. polling 훅을 prop 또는 render-prop/children으로 주입하고, i18n 키를 prefix 객체로 전달하면 두 컴포넌트를 삭제할 수 있다.

### [WARNING] `AuthStep` props 인터페이스 과다 — props 21개
- **위치**: `codebase/frontend/src/app/(main)/integrations/new/_components/auth-step.tsx` L83-105, `AuthStepProps` 인터페이스
- **상세**: `AuthStep`이 받는 props가 21개다. props 개수가 많을수록 호출 측에서의 연결 비용이 높고, 이후 시그니처 변경 시 파급이 크다. page.tsx 에서의 `<AuthStep .../>` 호출 블록이 이미 매우 길다.
- **제안**: 연관 props를 객체로 묶는 것을 검토. 예: `oauthState: { waiting, error, onConnect, connecting }`, `cafe24State: { conflict, precheckLoading }` 등.

### [WARNING] `use-oauth-popup-return.ts` 에서 비즈니스 정책 매직 넘버 3개가 인라인
- **위치**: `codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` — `5 * 60 * 1000`, `1500`, `500`
- **상세**: 5분 타임아웃, popup.closed 후 deferred 체크 대기 1500ms, 폴링 간격 500ms가 모두 인라인 리터럴이다. 이 숫자들은 비즈니스 정책을 나타내며 조정이 필요할 때 찾기 어렵다. 팝업 크기(width=600, height=700)는 지역 변수로 이름이 있어 대비된다.
- **제안**: 파일 상단에 `const OAUTH_POPUP_TIMEOUT_MS = 5 * 60 * 1000`, `const POPUP_CLOSED_BAIL_DELAY_MS = 1500`, `const POPUP_CLOSED_POLL_INTERVAL_MS = 500` 선언.

### [INFO] `clearOAuthTimeout` 이 마운트 전용 `useEffect` 클로저에서 stale 캡처될 수 있음
- **위치**: `codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` — `clearOAuthTimeout` 정의부, 마운트 효과, 두 곳의 `// eslint-disable-next-line react-hooks/exhaustive-deps`
- **상세**: `clearOAuthTimeout`은 일반 함수로 선언되어 렌더마다 재생성된다. 마운트 전용 `useEffect` 클로저가 최초 렌더의 함수 인스턴스를 포착한다. 현재는 `oauthTimeoutRef.current`를 통해 ref를 읽으므로 실질적으로 안전하지만, `useCallback` 없이 의존성에서 제외하는 패턴이 `eslint-disable` 억제 주석 2곳과 맞물려 유지보수자가 안전성을 독립적으로 검증해야 하는 부담을 준다.
- **제안**: `clearOAuthTimeout`을 `useCallback(() => { ... }, [])` 으로 감싸 deps 억제 필요성을 없애거나, 함수를 ref에 저장하는 패턴으로 전환.

### [INFO] `Cafe24ExtraFields` 내 `conflictDescKey` 삼항 체인 중첩 깊이 3
- **위치**: `codebase/frontend/src/app/(main)/integrations/new/_components/auth-step.tsx` L385-393
- **상세**: `conflictDescKey` 계산이 삼항 3단 중첩이다. 논리 자체는 `conflict.status` 열거 분기이므로 실질 복잡도는 낮지만 가독성 측면에서 객체 맵 룩업이 더 명확하다.
- **제안**: `const STATUS_TO_CONFLICT_KEY: Record<string, TranslationKey> = { ... }` 형태의 맵으로 교체.

### [INFO] `copy()` 하드코딩된 `2000ms`와 `"Copy"` 영어 리터럴 — 두 pending step 모두
- **위치**: `cafe24-private-pending-step.tsx` / `makeshop-pending-step.tsx` — `setTimeout(..., 2000)`, `"Copy"` 하드코딩
- **상세**: 복사 완료 피드백 지속 시간 `2000ms`가 두 파일 모두에 인라인 리터럴로 있다. `"Copy"` 텍스트는 i18n 키를 사용하지 않고 하드코딩되어 다국어 지원에서 누락된다.
- **제안**: `2000`을 상수로 추출. `"Copy"` 를 i18n 키(`t("common.copy")` 등)로 교체.

### [INFO] `TestStep` 내 `test.error as Error | undefined` 타입 캐스트 중복
- **위치**: `codebase/frontend/src/app/(main)/integrations/new/_components/test-step.tsx` — useEffect 내부와 `message` 계산 두 곳
- **상세**: 동일한 `(test.error as Error | undefined)?.message` 표현이 같은 컴포넌트 안에서 두 번 나온다.
- **제안**: `const errorMessage = test.error instanceof Error ? test.error.message : null;` 를 한 번만 계산해 두 곳에서 재사용. `instanceof` 체크로 타입 안전 narrowing 적용.

### [INFO] `page.tsx` 의 `onConnect` 인라인 핸들러가 `validate()` 와 부분 중복
- **위치**: `codebase/frontend/src/app/(main)/integrations/new/page.tsx` — `onConnect` 콜백 내 name/scope/makeshop 검사, `validate()` OAuth 분기
- **상세**: `onConnect` 콜백 안에서 `name.trim()`, `selectedScopes.length === 0`, makeshop `client_id`/`client_secret` 체크를 직접 수행한다. 이 검사들은 `validate()` 내부에도 동일하게 존재한다. 검증 규칙 변경 시 두 경로를 동시에 수정해야 한다.
- **제안**: `validate()`를 `onConnect`에서도 재사용하거나, OAuth-specific 사전 검증을 별도 `validateOauthBegin()` 함수로 분리.

---

## 요약

이번 리팩터링은 1444줄 단일 파일을 7개 파일로 분할하여 `page.tsx`를 448줄로 줄인 의미 있는 응집도 개선이다. 훅 추출(`useOauthPopupReturn`, `useUnsavedChangesWarning`) 및 라우트-로컬 컴포넌트 분리 방향은 올바르며, 주요 복잡 로직(OAuth 팝업 상태 기계)에 충분한 주석이 달려 있어 가독성이 양호하다. 다만 `Cafe24PrivatePendingStep`과 `MakeshopPendingStep`이 구조적으로 거의 동일해 공통 컴포넌트 추출 여지가 남아 있고, `AuthStep`의 21개 props 인터페이스는 호출 측 부담과 향후 시그니처 변경 파급을 높인다. OAuth 관련 매직 넘버 3개(`5 * 60 * 1000`, `1500`, `500`)와 `"Copy"` 하드코딩 리터럴은 소규모 개선 사항이며, `onConnect`-`validate()` 로직 중복은 향후 검증 규칙 변경 시 불일치 버그 위험으로 이어질 수 있다. 전반적으로 분할 방향은 올바르고 즉각적인 기능 손상 위험은 없으나, WARNING 등급 두 항목(pending step 중복, AuthStep props 비대화)은 후속 리팩터링에서 해소를 권장한다.

---

## 위험도

LOW
