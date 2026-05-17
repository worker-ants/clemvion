# Testing 관점 코드 리뷰

## 발견사항

### [WARNING] `restricted-approval.ts` 핵심 함수에 대한 단위 테스트 파일 부재
- 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` (신규 파일 전체)
- 상세: `extractCafe24ScopeTokens`와 `pickRestrictedApprovalScopes` 두 함수는 런타임 에러 분기의 핵심 로직이나 전용 테스트 파일이 존재하지 않는다. `extractCafe24ScopeTokens`는 Cafe24 응답 body에서 `mall.<read|write>_<r>` 토큰을 정규식으로 추출하는 로직이며, 입력 형태가 string/shallow object/nested object/undefined 등 다양하다. `pickRestrictedApprovalScopes`는 추출 결과를 `SCOPE_LEVEL_RESTRICTED_SCOPES` Set과 교차하는 필터 함수이다.
- 제안:
  - `restricted-approval.spec.ts` 를 신설해 아래 케이스를 커버한다:
    - `extractCafe24ScopeTokens(undefined)` → `[]`
    - `extractCafe24ScopeTokens("")` → `[]`
    - `extractCafe24ScopeTokens("mall.read_mileage scope is missing")` → `["mall.read_mileage"]`
    - `extractCafe24ScopeTokens({ error: "mall.read_mileage" })` → `["mall.read_mileage"]`
    - `extractCafe24ScopeTokens({ errors: { scope: "mall.read_mileage mall.write_mileage" } })` → `["mall.read_mileage", "mall.write_mileage"]`
    - 중복 토큰 dedup 검증
    - `pickRestrictedApprovalScopes(["mall.read_mileage", "mall.read_order"])` → `["mall.read_mileage"]`
    - `pickRestrictedApprovalScopes([])` → `undefined`
    - `pickRestrictedApprovalScopes(undefined)` → `undefined`
    - 전달 scope 중 restricted 명단에 없는 항목만 있을 경우 → `undefined`

---

### [WARNING] `markAuthFailed` errBody 연계 흐름에 대한 통합 테스트 부재
- 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` L823-L248
- 상세: `markAuthFailed`에 `errBody` 파라미터가 추가되어 `extractCafe24ScopeTokens` → `pickRestrictedApprovalScopes` → `lastErrorDetails.requiresCafe24Approval` 경로로 DB에 기록된다. 그런데 이 end-to-end 경로(403 응답 수신 → `markAuthFailed` 호출 → DB `lastError.details` 기록)를 검증하는 통합/단위 테스트가 변경 diff에 없다. 기존 `cafe24-api.client.spec.ts`(또는 유사 파일)에 케이스가 추가되었는지 불명확하다.
- 제안:
  - 기존 `cafe24-api.client.spec.ts` 또는 신규 spec 파일에 다음을 추가:
    - `reason='insufficient_scope'`이고 errBody가 mileage scope를 포함할 때 `lastError.details.requiresCafe24Approval`에 해당 scope가 기록됨을 검증
    - `reason='insufficient_scope'`이고 errBody에 restricted scope가 없을 때 `details`가 기록되지 않음을 검증
    - `reason='auth_failed'`일 때 errBody 무관하게 `details.requiresCafe24Approval`가 생성되지 않음을 검증

---

### [WARNING] `markIntegrationCallbackError`의 `extra.requiresCafe24Approval` 경로 테스트 미비
- 위치: `backend/src/modules/integrations/integration-oauth.service.ts` L788–L814
- 상세: `markIntegrationCallbackError`에 `extra?: { requiresCafe24Approval?: string[] }` 파라미터가 추가되고 `detailsObj`를 통해 `lastError.details`에 반영되는 로직이 추가됐다. 그러나 plan 파일(`cafe24-oauth-invalid-scope-handler.md`) 에서 OAuth callback의 `invalid_scope` 분기 구현 자체가 아직 완료되지 않았음을 명시하고 있어, 실제로 이 `extra` 파라미터를 채워 호출하는 caller가 현재 코드베이스에 없다. 파라미터가 실제로 동작하는지 검증하는 테스트도 없다.
- 제안:
  - `integration-oauth.service.cafe24.spec.ts`에 `markIntegrationCallbackError` 전용 케이스 추가:
    - `extra.requiresCafe24Approval`가 비어있지 않을 때 `lastError.details`가 기록됨
    - `extra.requiresCafe24Approval`가 빈 배열일 때 `details`가 omit됨
    - `extra`가 `undefined`일 때 기존 `lastError` 형식과 동일하게 유지됨

---

### [WARNING] `catalog-sync.spec.ts` Rule 8 테스트의 `findCafe24Operation` 반환값 null 처리 불완전
- 위치: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` L436–L509
- 상세: Rule 8의 첫 번째 테스트(`supported row with restricted=scope|operation has metadata.restrictedApproval`)에서 `findCafe24Operation(resource, row.id)!`처럼 non-null assertion(`!`)을 사용한다. catalog에 존재하지만 metadata에서 찾지 못할 경우 런타임 에러(`Cannot read properties of null`)가 발생해 테스트 실패 메시지가 불명확해진다. 세 번째 테스트는 `if (!row) continue;`로 명시적으로 처리하나 첫 번째는 그렇지 않다.
- 제안:
  ```ts
  const op = findCafe24Operation(resource, row.id);
  if (!op) {
    throw new Error(
      `${resource}.md row "${row.id}": catalog has restricted="${row.restricted}" but no metadata entry found`
    );
  }
  ```
  null 명시 처리로 오류 메시지를 명확하게 개선한다.

---

### [WARNING] `catalog-sync.spec.ts` Rule 8 테스트가 `cells.length < 9` 가드와 동적 컬럼 수를 혼용
- 위치: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` L380 근방
- 상세: `parseCatalogFile`에 동적 헤더 기반 컬럼 인덱싱(`buildColumnIndex`)을 도입했지만 `cells.length < 9` 가드는 그대로 유지된다. `restricted` 컬럼 추가로 최대 컬럼 수가 10이 될 수 있는 반면, 기존 catalog 파일이 9컬럼(restricted 없음)이면 `cells.length < 9`는 9컬럼 파일에 대해 정상 통과한다. 그러나 가드 숫자 자체가 실제 "최소 필수 컬럼 수"를 의미하는지에 대한 주석/테스트가 없어 future regression 위험이 있다.
- 제안: `restricted` 컬럼이 선택적(optional)이므로 최소 컬럼 가드를 `< 9`에서 `< 8`(id/라벨/영어/method/path/scope/paginated/status/docs 기본 9 → restricted 없는 경우)로 조정하거나, 상수로 추출해 의도를 문서화하고, `parseCatalogFile`에 대한 독립 단위 테스트를 추가해 restricted 컬럼 유무 양쪽 케이스를 검증한다.

---

### [INFO] `ApprovalRequiredBadge` / `RestrictedScopeNotice` 컴포넌트에 대한 프론트엔드 테스트 부재
- 위치: `frontend/src/components/integrations/approval-required-badge.tsx` (신규 파일)
- 상세: 재사용 공통 컴포넌트이지만 RTL(React Testing Library) 또는 스냅샷 테스트가 제공되지 않는다. `count <= 0`일 때 `null` 반환, `count > 0`일 때 amber 배너 렌더, `inquiryUrl` 링크 href 검증, aria-label 접근성 등은 UI 계약의 핵심이다.
- 제안:
  - `approval-required-badge.test.tsx` 신설:
    - `RestrictedScopeNotice count={0}` → 렌더 없음
    - `RestrictedScopeNotice count={2}` → 배너 렌더 + inquiryUrl 링크 존재
    - `ApprovalRequiredBadge` → role="img" aria-label이 i18n key 결과와 일치

---

### [INFO] `scope-tab.tsx`의 `requiresApprovalFromError` 로직에 대한 프론트엔드 통합 테스트 부재
- 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L180–L183
- 상세: `integration.lastError?.details`를 `{ requiresCafe24Approval?: string[] }`로 타입 단언(`as`)하여 읽는 로직이 추가됐다. 이 경로는 `lastError`가 `null`, `lastError.details`가 undefined, 혹은 배열이 비어있는 경우 등 다양한 엣지 케이스를 포함한다. 타입 단언을 통한 런타임 안전성을 검증하는 테스트가 없다.
- 제안:
  - `scope-tab.test.tsx`에 다음 케이스 추가:
    - `lastError=null`일 때 `requiresApprovalFromError`가 `[]`
    - `lastError.details=undefined`일 때 `[]`
    - `lastError.details.requiresCafe24Approval=[]`일 때 에러 메시지가 렌더되지 않음
    - `lastError.details.requiresCafe24Approval=["mall.read_mileage"]`일 때 에러 메시지가 렌더됨

---

### [INFO] `ScopeOption.requiresApproval` 관련 서비스 응답 Mock 갭
- 위치: `backend/src/modules/integrations/services/service-registry.ts` L142–L180
- 상세: `CAFE24_SCOPES` 상수에 `requiresApproval: true`가 추가됐으나, 이 값이 실제로 API 응답으로 직렬화되어 프론트엔드까지 전달되는지 검증하는 통합 테스트나 e2e 테스트가 없다. `ScopeOption.requiresApproval`이 response DTO에 포함되는지, JSON 직렬화 시 누락되지 않는지 보장하는 테스트가 필요하다.
- 제안: backend API `/integrations/services` (또는 해당 endpoint) 의 통합 테스트 또는 e2e 테스트에서 Cafe24 서비스 응답의 scope 항목에 `requiresApproval: true`가 포함됨을 검증한다.

---

### [INFO] `extractCafe24ScopeTokens`의 정규식 전역 플래그 재사용 패턴은 테스트로만 안전성 보장 가능
- 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` L959–L966
- 상세: `TOKEN_RE = /mall\.(?:read|write)_[a-z_]+/g`를 루프 내에서 `TOKEN_RE.lastIndex = 0`으로 재설정 후 재사용하는 패턴이다. 이는 JavaScript 정규식 전역 플래그의 stateful `lastIndex`로 인한 버그를 방지하기 위한 올바른 처리이나, 잘못 수정될 경우 조용히 잘못된 결과를 반환할 수 있다. 이 특성을 명시적으로 검증하는 테스트(여러 문자열에 걸쳐 반복 실행 시 결과 일관성)가 없다.
- 제안: 단위 테스트에서 `extractCafe24ScopeTokens`를 동일 입력으로 2회 연속 호출했을 때 결과가 동일한지 검증한다.

---

### [INFO] `RESTRICTED_APPROVAL` 상수 중 `store_activitylogs`, `store_menus` 등 operation-level 항목에 `docsUrl`이 없음 — 테스트로 일관성 보장 불가
- 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` L993–L1019
- 상세: `catalog-sync.spec.ts` Rule 8의 네 번째 테스트(`restrictedApproval.inquiryUrl is non-empty when set`)는 `inquiryUrl`만 검증하고 `docsUrl`의 일관성은 검증하지 않는다. scope-level 항목(mileage/notification/privacy)은 `docsUrl`이 있고, operation-level 항목(store_*)은 `docsUrl`이 없다. 이 비대칭이 의도적인지 여부를 주석으로만 표현하고 있으며 테스트로 강제하지 않는다.
- 제안: 의도적 비대칭이라면 `RESTRICTED_APPROVAL` 상수 내 JSDoc으로 명시하거나, `catalog-sync.spec.ts`에 `level==='scope'` 항목은 `docsUrl`이 있어야 함을 검증하는 케이스를 추가한다.

---

## 요약

이번 변경은 Cafe24 별도 승인 scope/operation 식별·안내 장치를 도입하는 작업으로, 핵심 로직인 `restricted-approval.ts`(extractCafe24ScopeTokens, pickRestrictedApprovalScopes, SCOPE_LEVEL_RESTRICTED_SCOPES)에 대한 전용 단위 테스트 파일이 없다는 것이 가장 큰 갭이다. `catalog-sync.spec.ts`에 Rule 8 양방향 동기 검증을 추가한 것은 긍정적이나, null assertion 미처리, 동적 컬럼 파서의 최소 컬럼 가드 일관성 문제가 남아 있다. 백엔드 통합 경로(markAuthFailed errBody 연계, markIntegrationCallbackError extra 파라미터)에 대한 케이스도 diff에 없어 실제 동작 보장이 테스트로 확보되지 않은 상태다. 프론트엔드 신규 컴포넌트(`ApprovalRequiredBadge`, `RestrictedScopeNotice`)와 `scope-tab.tsx`의 타입 단언 기반 로직도 RTL 테스트로 보호되지 않는다. 전반적으로 구현 복잡도 대비 테스트 커버리지가 부족하며, plan 파일(`cafe24-oauth-invalid-scope-handler.md`)이 명시하는 미완성 분기(OAuth callback invalid_scope)는 이후 구현 시 반드시 테스트가 선행되어야 한다.

## 위험도

MEDIUM
