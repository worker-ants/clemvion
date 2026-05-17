# 요구사항(Requirement) 코드 리뷰

## 발견사항

### [WARNING] `oauth_invalid_scope` 신규 statusReason이 `markIntegrationCallbackError` 경로에서 발동되지 않음
- **위치**: `integration-oauth.service.ts` L759–L764, `integration-status-reason.ts` L32
- **상세**: `oauth_invalid_scope`가 INTEGRATION_STATUS_REASONS union에 추가되고 normalizeStatusReason을 통해 pending_install 행의 statusReason으로 저장 가능하지만, `handleCallbackWithErrorCapture`에서 `markIntegrationCallbackError`를 호출할 때 `extra` 파라미터를 전달하지 않는다(L759–L764는 extra 없이 4개 인자만 전달). OAuth 콜백 중 `invalid_scope` 에러가 발생해 errorCode가 `OAUTH_TOKEN_EXCHANGE_FAILED`로 오면 `requiresCafe24Approval` 상세 정보가 lastError.details에 포함되지 않은 채로 기록된다. `SCOPE_LEVEL_RESTRICTED_SCOPES`와 교차하는 범위는 `markAuthFailed`(API 호출 실패 경로)에서만 처리되고, OAuth 토큰 교환 실패 경로에서는 처리되지 않는다.
- **제안**: `handleCallbackWithErrorCapture`에서 에러 본문(errBody)을 `readErrorCode`/`readErrorMessage`와 함께 추출하고, `extractCafe24ScopeTokens` + `pickRestrictedApprovalScopes`를 적용해 `extra`를 구성한 뒤 `markIntegrationCallbackError`에 전달하거나, 또는 이 경로가 의도적으로 extra를 omit하는 것이라면 spec에 명시 필요.

---

### [WARNING] `cells.length < 9` 하드코딩이 dynamic column index 구조와 불일치
- **위치**: `catalog-sync.spec.ts` L138
- **상세**: `parseCatalogFile`에서 header-based dynamic column indexing으로 리팩토링했음에도, 데이터 행의 유효성 검증은 여전히 `cells.length < 9`로 하드코딩되어 있다. canonical 컬럼 순서에서 `restricted` 컬럼이 optional임을 감안하면(header 없이 9컬럼도 허용) 9는 `restricted` 없는 경우 기준이지만, 향후 컬럼 추가/삭제 시 이 숫자가 묵시적 계약이 되어 오탐 또는 행 누락이 발생할 수 있다. 또한 `restricted` 컬럼이 있는 파일은 10컬럼이어야 하는데 9 미만으로만 skip하므로 restricted 없는 파일도 통과한다. 이 자체는 의도된 동작이나 주석이 부재하다.
- **제안**: 매직 넘버 9를 `const MIN_CATALOG_COLUMNS = 9;`로 추출하거나 `Object.keys(columnIndex).length`를 기준으로 동적 계산, 또는 최소한 주석으로 근거 명시.

---

### [WARNING] `Cafe24ApprovalGroup`에 `analytics`가 정의되어 있으나 `RESTRICTED_APPROVAL` 맵에 없음
- **위치**: `types.ts` L47, `restricted-approval.ts` L89–L135, 프론트엔드 `types.ts` L233
- **상세**: `Cafe24ApprovalGroup` union type에 `'analytics'`가 포함되어 있고, JSDoc 주석은 "e.g. Cafe24 Analytics"라고 설명한다. 그러나 `RESTRICTED_APPROVAL` 맵에는 `analytics` 키가 없다. `analytics`를 `approvalGroup`으로 갖는 `Cafe24RestrictedApproval` 객체를 직접 생성하려는 코드가 나타나면 TypeScript 타입 검사는 통과하지만 `RESTRICTED_APPROVAL.analytics`는 `undefined`가 된다. `level: 'program'`에 대한 설명("e.g. Cafe24 Analytics")은 있으나 실제 사용 가능한 인스턴스가 없어 일관성이 부족하다.
- **제안**: `analytics`가 실제로 `RESTRICTED_APPROVAL` 맵 항목으로 사용될 예정이면 추가하거나, 현재는 '미래를 위한 예약값'임을 JSDoc에 명시. 또는 현재 코드베이스에서 미사용이면 union에서 제거.

---

### [INFO] `markIntegrationCallbackError`의 `extra.requiresCafe24Approval`이 빈 배열일 때 details를 omit하는 가드가 있으나, 외부 호출 시 빈 배열 전달 가능성
- **위치**: `integration-oauth.service.ts` L801–L804
- **상세**: `extra?.requiresCafe24Approval && extra.requiresCafe24Approval.length > 0` 조건이 빈 배열 방어를 한다. 현재 유일한 `extra` 생산자(`cafe24-api.client.ts`의 `markAuthFailed`)는 `pickRestrictedApprovalScopes`가 `undefined` 반환 시 `lastErrorDetails`를 undefined로 두므로 빈 배열이 실제로 전달되지는 않는다. 그러나 `markIntegrationCallbackError`의 public signature에서 `requiresCafe24Approval?: string[]`는 빈 배열을 허용하며, 미래 호출자가 이를 모르고 `[]`를 전달하면 방어 로직이 작동하지만 타입만으로는 이를 명시적으로 알 수 없다.
- **제안**: 타입을 `requiresCafe24Approval?: [string, ...string[]]`(non-empty 튜플)으로 좁히거나, 또는 JSDoc에 "빈 배열은 omit한다"는 계약 명시.

---

### [INFO] `extractCafe24ScopeTokens`의 깊이 탐색이 2단계까지만 수행됨
- **위치**: `restricted-approval.ts` L60–L86
- **상세**: `extractCafe24ScopeTokens`는 최상위 string → 1단계 object → 2단계 object까지만 탐색한다. Cafe24 API 에러 응답 구조가 3단계 이상 중첩(예: `{ error: { details: { scope: "mall.read_mileage" } } }`)이면 토큰을 추출하지 못한다. 현재 Cafe24 공식 에러 형식 기준으로는 충분하나, 함수 JSDoc에는 "shallow object"라고 명시되어 있어 계약은 일치한다.
- **제안**: JSDoc에 "2-level deep traversal" 한계를 명시해 향후 유지보수자가 인지할 수 있게 함. 현재 기능적 요구사항은 충족됨.

---

### [INFO] `RestrictedScopeNotice`의 `inquiryUrl` 기본값이 하드코딩됨
- **위치**: `frontend/src/components/integrations/approval-required-badge.tsx` L389
- **상세**: `RestrictedScopeNotice`의 `inquiryUrl` prop 기본값이 `"https://developers.cafe24.com"`으로 하드코딩되어 있다. `RESTRICTED_APPROVAL` 맵의 각 항목도 동일한 `INQUIRY_URL` 상수를 쓰므로 현재는 일치하지만, 프론트엔드 컴포넌트가 백엔드의 `restrictedApproval.inquiryUrl`을 prop으로 받을 때 caller가 이를 전달하지 않으면 기본값이 사용된다. 현재 `scope-tab.tsx`와 `new/page.tsx` 모두 `inquiryUrl`을 명시적으로 전달하지 않아 기본값에 의존한다.
- **제안**: 비즈니스 요구사항 상 inquiryUrl이 operation/group마다 다를 수 있다면(spec §1에서 per-group `docsUrl` 언급), caller가 `restrictedApproval.inquiryUrl`을 주입하도록 수정. 단일 URL이면 현재 구조 유지 가능.

---

### [INFO] `TOKEN_RE` 정규식이 루프 내 재사용 시 `lastIndex` 리셋 필요 — 현재는 올바르게 처리됨
- **위치**: `restricted-approval.ts` L75–L79
- **상세**: `TOKEN_RE`가 함수 스코프 내부에 정의되어 있고 각 `text` 순회 시 `TOKEN_RE.lastIndex = 0`으로 리셋된다. `/g` 플래그 정규식의 `exec` 루프 패턴에 대한 올바른 처리이다. 기능 상 결함 없음, 확인 목적으로 기록.

---

### [INFO] scope-tab.tsx에서 `lastError.details`의 타입 캐스팅이 안전하지 않음
- **위치**: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L48–L50
- **상세**: `(integration.lastError?.details as { requiresCafe24Approval?: string[] } | undefined)` 캐스팅은 TypeScript 컴파일러를 만족시키지만 런타임에는 `details`가 임의 `Record<string, unknown>`이므로 `requiresCafe24Approval`이 실제로 `string[]`인지 검증하지 않는다. 악의적이거나 잘못된 응답에서 다른 타입이 들어와도 `join(", ")`이 호출될 수 있다.
- **제안**: `Array.isArray(candidate) && candidate.every(s => typeof s === 'string')`로 런타임 가드 추가. 또는 공유 타입 가드 함수 추출.

---

## 요약

이번 PR은 Cafe24 파트너 승인 대상 스코프/오퍼레이션에 대한 메타데이터(`restrictedApproval`), 런타임 에러 세부정보(`requiresCafe24Approval`), 그리고 프론트엔드 배지/공지 컴포넌트를 일관성 있게 구현하였다. 데이터 타입 정의, 단방향/양방향 카탈로그 동기화 테스트, 국제화 키 등 기능 완전성 측면에서 대체로 잘 구성되어 있다. 그러나 **주요 갭**이 하나 존재한다: OAuth 콜백 토큰 교환 실패(handleCallbackWithErrorCapture) 경로에서 `extra` 파라미터 없이 `markIntegrationCallbackError`를 호출하므로, 해당 경로에서 발생하는 `invalid_scope` 에러에는 `lastError.details.requiresCafe24Approval`이 채워지지 않아 프론트엔드 scope-tab의 에러 상세 표시가 동작하지 않는다. 또한 `Cafe24ApprovalGroup` union의 `analytics` 항목이 RESTRICTED_APPROVAL 맵에 누락되어 있고, catalog-sync.spec.ts의 `cells.length < 9` 하드코딩이 dynamic column indexing 리팩토링과 불일치한다. 프론트엔드 lastError.details 타입 캐스팅도 런타임 안전성 보강이 권장된다.

## 위험도

MEDIUM
