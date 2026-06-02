# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-prep)

검토 대상: `spec/2-navigation/` 전체 (구현 착수 전, `--impl-prep` 모드).
본 검토의 실질 구현 범위는 `cafe24-oauth-invalid-scope-408b14` worktree 에서 진행 중인 **§2 OAuth `invalid_scope` callback 분기 backend 구현** 이다.

---

## 발견사항

### [WARNING] `handleCallback` 의 `query.error` 분기가 spec §10.4 의 `invalid_scope` 별도 처리와 어긋남

- **target 위치**: `spec/2-navigation/4-integration.md §10.4` — `Cafe24 invalid_scope` 에러 매핑 행
- **충돌 대상**: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` `handleCallback()` (라인 495–500)
- **상세**:

  spec `§10.4` 는 Cafe24 가 `?error=invalid_scope` 로 callback redirect 했을 때 다음을 요구한다:
  1. status 를 `pending_install` 로 **보존**
  2. `status_reason='oauth_invalid_scope'` 기록
  3. `last_error.code='OAUTH_INVALID_SCOPE'` + `last_error.details.requiresCafe24Approval: string[]` 기록 (요청 scopes ∩ restricted 명단 교집합)

  그러나 현재 구현은 `query.error` 가 존재하면 **state row 를 소비하기 전에** `OAUTH_DENIED` 단일 코드로 즉시 throw 한다:

  ```ts
  if (query.error) {
    throw new BadRequestException({ code: 'OAUTH_DENIED', message: '...' });
  }
  ```

  state row 를 소비하기 전에 throw 하므로 `integrationId` context 가 없어 `handleCallbackWithErrorCapture` 의 `markIntegrationCallbackError` 호출도 실행되지 않는다. 결과적으로:
  - `status_reason` 이 `oauth_invalid_scope` 로 갱신되지 않고 이전 값 또는 null 로 남는다.
  - `last_error.details.requiresCafe24Approval` 이 기록되지 않아 통합 상세 페이지의 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지가 노출되지 않는다.
  - 이는 `spec/conventions/cafe24-restricted-scopes.md §4.3` 이 기술한 UX(에러 발생 후 안내 분기)와 직접 모순이다.

- **제안**:
  - `handleCallback` 내에서 `query.error === 'invalid_scope'` 를 먼저 분기한 뒤, state row 를 소비하여 `requestedScopes` 와 `integrationId` 를 추출한다.
  - `pickRestrictedApprovalScopes(requestedScopes)` 로 `requiresCafe24Approval` 배열을 계산한다.
  - `OAUTH_INVALID_SCOPE` 코드로 throw 하되 `attachCallbackContext` 를 통해 integrationId 를 첨부하면 `handleCallbackWithErrorCapture` 가 `markIntegrationCallbackError(..., { requiresCafe24Approval })` 를 호출할 수 있다.
  - 또는 `handleCallback` 내부에서 `invalid_scope` 케이스를 직접 `markIntegrationCallbackError` 로 처리하고 별도 throw 경로로 분기한다.
  - `integration-oauth.service.cafe24.spec.ts` 에 `query.error === 'invalid_scope'` 케이스를 추가한다.

  이 작업은 `plan/in-progress/cafe24-restricted-scopes-followups.md §2` 에 이미 체크리스트로 정의되어 있으며, 본 worktree 의 구현 목표와 일치한다.

---

### [WARNING] `normalizeStatusReason` 이 `oauth_invalid_scope` 를 union 에 포함하지만 `handleCallback` 이 해당 코드를 생성하지 않음 — dead code 위험

- **target 위치**: `codebase/backend/src/modules/integrations/integration-status-reason.ts` (라인 32)
- **충돌 대상**: `integration-oauth.service.ts` `handleCallback()` (현재 `OAUTH_DENIED` 만 throw)
- **상세**:

  `INTEGRATION_STATUS_REASONS` 에 `'oauth_invalid_scope'` 가 등록되어 있고, `markIntegrationCallbackError` 의 `normalizeStatusReason(errorCode.toLowerCase())` 호출이 이를 정규화할 수 있도록 준비되어 있다. 그러나 `handleCallback` 이 `OAUTH_INVALID_SCOPE` 코드를 throw 하지 않으므로 현재 코드 경로에서 이 값은 실제로 기록되지 않는다. spec 의 상태 전이 표 (`spec/2-navigation/4-integration.md §6 상태 전이`, `§10.4`) 는 이 값이 반드시 기록되어야 함을 명시한다.

  이 불일치는 직전 WARNING 과 같은 원인이므로 동일 수정으로 해소된다. 별도 코드 변경(status-reason 파일)은 필요하지 않다.

- **제안**: WARNING 1 의 수정 완료 후 자동 해소됨. 별도 조치 불필요.

---

### [INFO] 프론트엔드 `scope-tab.tsx` 가 `statusReason === 'insufficient_scope'` 만 보고 `oauth_invalid_scope` 를 처리하지 않음

- **target 위치**: `spec/2-navigation/4-integration.md §4.4` — Scope & Permissions 탭의 별도 승인 ⚠ 배지 및 분기 메시지
- **충돌 대상**: `codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` 라인 49
- **상세**:

  `scope-tab.tsx` 는 `missingScopes` 렌더링 조건을 `integration.statusReason === 'insufficient_scope'` 로만 제한한다. spec §4.4 는 `status_reason='oauth_invalid_scope'` 일 때도 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지를 노출하도록 명시하며, `requiresCafe24Approval` 배열을 `last_error.details` 에서 읽는 `readRequiresApproval` 함수도 이미 구현되어 있다. 그러나 `requiresApprovalFromError` 가 채워지더라도 `missingScopes.length === 0` 인 경우 (status_reason = oauth_invalid_scope + 누락 scope 없음) 안내 섹션 자체가 비렌더링된다.

  spec §10.4 의 `oauth_invalid_scope` 케이스는 callback 단계에서 Cafe24 가 scope 전체를 거부한 시점이므로, 통합 credentials 에는 scopes 가 비어있거나 이전 값이 남아있을 수 있다. `missingScopes` 계산이 `statusReason === 'insufficient_scope'` 로 gate 되어 있으면 `oauth_invalid_scope` 케이스에서 안내가 누락된다.

  `readRequiresApproval(integration.lastError).length > 0` 이 참인 경우를 별도 렌더링 분기로 추가하면 해소된다. 이는 spec §10.4 + `cafe24-restricted-scopes.md §4.3` 의 "통합 상세 페이지 분기 메시지" 요건을 충족한다.

- **제안**:
  - `scope-tab.tsx` 에서 `statusReason === 'oauth_invalid_scope' && requiresApprovalFromError.length > 0` 일 때도 안내 섹션을 렌더링하는 분기를 추가한다.
  - 이 변경은 `plan/in-progress/cafe24-restricted-scopes-followups.md §2` 의 "frontend: 통합 상세 페이지가 `statusReason==='oauth_invalid_scope'` + `last_error.details.requiresCafe24Approval` 를 읽어 분기 메시지 노출" 체크리스트에 해당하므로 본 worktree 구현 범위에 포함된다.

---

### [INFO] `spec/1-data-model.md §2.10` status_reason 정의와 `integration-status-reason.ts` union 의 명명 일치 확인

- **target 위치**: `spec/1-data-model.md §2.10` — `status_reason` 컬럼 열거값
- **충돌 대상**: `codebase/backend/src/modules/integrations/integration-status-reason.ts`
- **상세**:

  spec 의 `status_reason` 열거에서 `oauth_invalid_scope` 는 `pending_install` 상태의 사유로 정의된다. `integration-status-reason.ts` 의 union 도 `oauth_invalid_scope` 를 포함하며 일치한다. 단, spec 은 이 값의 코드 대응을 `OAUTH_INVALID_SCOPE` (UPPER_SNAKE_CASE) 으로 명시하는데(`§10.4`), 현재 `handleCallback` 이 throw 하는 코드는 `OAUTH_DENIED` 이므로 `normalizeStatusReason('oauth_denied')` 는 `unknown_error` 로 폴백된다. WARNING 1 수정 시 코드가 `OAUTH_INVALID_SCOPE` 로 throw 되어야 `normalizeStatusReason('oauth_invalid_scope')` = `'oauth_invalid_scope'` 가 올바르게 저장된다.

  spec 의 명명·코드 대응표(`§10.4`)와 구현 union 간에 직접 모순은 없으나, WARNING 1 수정 없이는 실질적으로 dead branch 로 남는다.

- **제안**: WARNING 1 수정 완료 후 자동 해소됨.

---

## 요약

Cross-Spec 일관성 관점의 핵심 문제는 **`handleCallback()` 이 Cafe24 의 `?error=invalid_scope` callback 을 `OAUTH_DENIED` 단일 코드로 흡수하여 state row 를 소비하지 않고 즉시 throw** 함으로써, `integrationId` context 가 없어 `markIntegrationCallbackError` 가 `oauth_invalid_scope` status_reason + `requiresCafe24Approval` details 를 기록하지 못한다는 점이다. 이는 `spec/2-navigation/4-integration.md §10.4`, `spec/1-data-model.md §2.10`, `spec/conventions/cafe24-restricted-scopes.md §4.3` 세 spec 이 모두 공통으로 명시하는 `oauth_invalid_scope` 상태 전이와 직접 모순된다. 프론트엔드 `scope-tab.tsx` 의 `statusReason` gate 누락은 이 backend gap 이 해소된 이후 노출될 수 있는 후속 불일치로, 동일 worktree 내 구현 목표이다. 다른 target 영역 (`spec/2-navigation/` 의 나머지 화면들) 은 Cafe24 OAuth callback 흐름과 직접 교차하지 않으므로 추가 충돌은 발견되지 않았다.

## 위험도

MEDIUM
