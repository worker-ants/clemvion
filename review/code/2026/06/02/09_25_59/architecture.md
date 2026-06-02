# 아키텍처(Architecture) 리뷰

## 발견사항

### [WARNING] `CallbackContext` 인터페이스에 Cafe24 특화 필드가 누출
- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` L151–238, `CallbackContext` 인터페이스
- 상세: `CallbackContext`는 모든 OAuth 공급자에 공통으로 사용되는 범용 인터페이스다. 여기에 `requiresCafe24Approval?: string[]`를 추가하면 Cafe24 도메인 지식이 공유 컨텍스트 타입에 새어 나온다. 이는 인터페이스 분리 원칙(ISP)과 단일 책임 원칙(SRP)에 어긋난다. 다른 공급자를 추가할 때마다 `CallbackContext`에 공급자별 선택적 필드가 누적될 위험이 있다.
- 제안: `CallbackContext`에 `extra?: Record<string, unknown>` 또는 `providerMeta?: unknown` 타입의 불투명(opaque) 확장 슬롯을 두거나, Cafe24 전용 `Cafe24CallbackContext extends CallbackContext` 서브타입으로 분리한다. `handleCallbackWithErrorCapture`가 공급자를 인지하고 캐스팅하는 방식이 더 레이어 경계를 명확히 한다.

### [WARNING] `rejectCafe24InvalidScope`가 서비스 레이어 내에서 상태 소비(DELETE)와 에러 생성을 동시에 담당
- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` L1271–L1301, `rejectCafe24InvalidScope` private 메서드
- 상세: 이 메서드는 (1) DB에서 state row를 DELETE하고, (2) restricted scope 교집합을 계산하고, (3) 예외를 생성하고 throw한다는 세 가지 책임을 갖는다. state 소비 로직은 이미 일반 `handleCallback` 흐름에도 존재하며, `rejectCafe24InvalidScope`가 독자적으로 DELETE를 수행함으로써 state 소비 경로가 두 곳(정상 콜백 경로 + invalid_scope 분기)으로 분기된다. 결합도 관점에서 "state 소비는 반드시 단일 경로에서"라는 불변식이 깨질 위험이 있다. 현재는 invalid_scope 분기가 먼저 throw하기 때문에 일반 경로의 DELETE가 실행되지 않으나, 향후 리팩토링 시 이중 소비 버그를 유발할 수 있다.
- 제안: state 소비 로직(DELETE … RETURNING)을 `consumeOAuthState(state)` 같은 단일 private 메서드로 추출하고, `handleCallback`과 `rejectCafe24InvalidScope` 모두 이를 공유한다. `rejectCafe24InvalidScope`는 이미 소비된 row 레코드를 인자로 받아 예외 생성에만 집중한다.

### [INFO] `handleCallback` 내 공급자별 분기 증가 — 조건부 로직의 집중
- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` L1249–L1255, `handleCallback` 에러 처리 블록
- 상세: `if (query.error)` 블록 안에 `provider === 'cafe24' && query.error === 'invalid_scope' && query.state` 조건이 추가됐다. 공급자가 늘어날수록 이 블록이 `if-else if` 체인으로 성장할 가능성이 있다. 현재는 cafe24 하나뿐이라 심각하지 않으나, 개방-폐쇄 원칙(OCP) 관점에서 공급자별 에러 처리를 확장 시 기존 코드를 수정해야 하는 구조다.
- 제안: 단기적으로는 현 수준이 허용 가능하다. 중기적으로는 공급자별 에러 핸들러를 전략(Strategy) 패턴으로 service-registry에 등록하거나, `OAuthProvider` 추상 클래스/인터페이스에 `handleErrorCallback(error, state)` 훅을 정의하는 방향을 검토할 수 있다.

### [INFO] `markIntegrationCallbackError`의 `extra` 파라미터 — 구조적 타입 대신 암묵적 any 수준의 객체
- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` L1312–L1315, `handleCallbackWithErrorCapture` 내 `extra` 계산
- 상세: `extra`는 `{ requiresCafe24Approval: string[] } | undefined`로 인라인 구성되어 `markIntegrationCallbackError`에 전달된다. `markIntegrationCallbackError`의 시그니처에서 `extra`의 타입이 어떻게 정의되어 있느냐에 따라, 타입 시스템이 `last_error.details` 구조를 정적으로 보장하는지 여부가 달라진다. Cafe24 특화 필드(`requiresCafe24Approval`)가 `extra` 를 통해 `last_error.details`로 흘러가는 경로는 런타임에만 검증되며, 타입 체계로는 보장되지 않을 수 있다.
- 제안: `MarkCallbackErrorExtra` 타입을 명시적으로 export하여 소비 측에서도 타입 안전하게 구성할 수 있도록 한다.

### [INFO] 프론트엔드 `readRequiresApproval` 함수 — `lastError` 타입을 런타임에서만 검증
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L1403–L1413
- 상세: `readRequiresApproval`은 `lastError`를 여러 단계의 `as` 캐스팅과 런타임 체크로 좁힌다. 백엔드 `last_error.details` 구조가 변경될 경우 타입 시스템이 프론트엔드의 대응 변경을 강제하지 못한다. 현재는 적절한 방어 코딩(early return)이 되어 있어 런타임 오류는 없으나, 이는 backend–frontend 계약이 타입 수준에서 공유되지 않음을 의미한다.
- 제안: `packages/` 공유 레이어에 `IntegrationLastErrorDetails` 타입을 두거나, OpenAPI code generation 경로를 사용해 backend DTO를 프론트엔드에 자동 동기화한다. 현 규모에서는 중요도가 낮으나 공급자별 details 필드가 늘어날수록 drift 위험이 증가한다.

### [INFO] `oauth_invalid_scope` 섹션 — `missingScopes` 섹션과 렌더링 논리 중복
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L1525–L1532 및 L1540–L1549
- 상세: `requiresApprovalFromError`를 출력하는 `<p>` 태그 블록이 두 곳(missingScopes 섹션 내부, oauth_invalid_scope 독립 섹션)에 동일한 i18n 키로 렌더링된다. 동일한 표시 컴포넌트가 조건만 다르게 두 번 나타나므로 향후 문구나 스타일 변경 시 두 곳을 동기화해야 한다.
- 제안: `<Cafe24ApprovalErrorNotice scopes={requiresApprovalFromError} t={t} />` 같은 소형 컴포넌트로 추출해 두 곳에서 재사용한다. 단순하지만 응집도가 올라간다.

## 요약

이번 변경은 Cafe24 OAuth `invalid_scope` 에러를 state row 소비와 연계해 `statusReason + last_error.details`에 기록하는 기능을 추가한 것으로, 전체 흐름 설계(state 소비 → context attach → error capture → DB 기록)는 올바르다. 주요 아키텍처 우려는 `CallbackContext` 인터페이스에 Cafe24 특화 필드가 공유 타입에 직접 노출된 점이다. 공급자 수가 증가할수록 공통 컨텍스트 타입이 vendor-specific 필드의 집합으로 팽창할 수 있으며, 이는 인터페이스 분리 원칙에 위배된다. `rejectCafe24InvalidScope` 내에서 state 소비(DELETE)와 예외 생성이 결합된 점도 state 소비 경로의 단일화 불변식을 약화시킨다. 나머지는 확장성·중복 관점의 INFO 수준으로, 현재 규모에서 즉시 블로킹 이슈는 아니다.

## 위험도

LOW

STATUS: SUCCESS
