---
worktree: cafe24-oauth-invalid-scope-408b14
started: 2026-06-02
owner: developer
type: implementation
parent: plan/in-progress/cafe24-restricted-scopes-followups.md (§2)
---

# §2 — OAuth `invalid_scope` callback 분기 backend 구현

## 출처

`cafe24-restricted-scopes-followups.md §2`. spec/2-navigation/4-integration.md §10.4 +
cafe24-restricted-scopes.md §4.3 가 이미 명세: Cafe24 가 `?error=invalid_scope` 로 callback
redirect 시 `Integration.statusReason='oauth_invalid_scope'` + `last_error.details.
requiresCafe24Approval: string[]` (요청 scopes ∩ restricted 명단 §1) 기록 → frontend 통합
상세가 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. **status 보존** (재시도 가능).

사용자 결정 (2026-06-02): 구현 가치 있음 (사용자 직접 연동 기능이라 오류 명확화 필요).

## 이미 존재하는 인프라 (구현 불요)

- `markIntegrationCallbackError(extra?: { requiresCafe24Approval })` — last_error.details 기록 + pending_install statusReason 정규화.
- `oauth_invalid_scope` enum (`integration-status-reason.ts`).
- `pickRestrictedApprovalScopes(scopes)` 헬퍼 (`restricted-approval.ts`).
- OAuthState.requestedScopes / integrationId / workspaceId.
- frontend `scope-tab.tsx` `readRequiresApproval()` + i18n `integrations.cafe24RestrictedApprovalApiError`.

## 구현 (wiring)

- [ ] `CallbackContext` 에 `requiresCafe24Approval?: string[]` optional 추가.
- [ ] `handleCallback`: `provider==='cafe24' && query.error==='invalid_scope' && query.state` 분기 →
  private `throwCafe24InvalidScope(state)`: state DELETE…RETURNING 소비 → `pickRestrictedApprovalScopes(requestedScopes)` →
  `OAUTH_INVALID_SCOPE` BadRequestException + context(approval 포함) attach throw. state 없음/소비됨 시 context 없이 throw.
  다른 error 값은 기존 `OAUTH_DENIED` 유지.
- [ ] `handleCallbackWithErrorCapture`: `ctx.requiresCafe24Approval` 를 `markIntegrationCallbackError` 의 `extra` 로 전달.
- [ ] `markIntegrationCallbackError`: `connected && OAUTH_INVALID_SCOPE` 분기 추가 — status 보존 + statusReason='oauth_invalid_scope' (§10.4. pending_install 은 기존 normalize 로 이미 처리).
- [ ] 테스트: integration-oauth.service.cafe24.spec.ts — invalid_scope (pending_install) → statusReason + requiresCafe24Approval, restricted 교집합 비었을 때 details 생략, OAUTH_DENIED 회귀, state 소비 확인.
- [ ] frontend 확인: scope-tab 가 oauth_invalid_scope details 를 이미 렌더 (회귀 테스트 있으면 확인).

## 단계 체크리스트

- [x] 3. consistency-check --impl-prep (BLOCK:NO — review/consistency/2026/06/02/09_09_52). WARNING #1·2·3 = 본 구현 목표(처리됨), #4·5·6 = 타 spec 무관.
- [x] 4. DOCUMENTATION (spec §10.4 이미 명세 — 코드만; partial surface 없음, i18n 신규 키 없음)
- [x] 5-7. TDD + 구현 (CallbackContext.requiresCafe24Approval, handleCallback invalid_scope 분기 + rejectCafe24InvalidScope, handleCallbackWithErrorCapture extra 전달, markIntegrationCallbackError connected 분기, scope-tab oauth_invalid_scope 섹션. backend 151 pass + invalid_scope 5 케이스)
- [ ] 8. TEST WORKFLOW
- [ ] 9. REVIEW WORKFLOW
- [ ] 10. plan complete

## 비목표 (spec §2 명시)

- 새 에러 코드 추가 (status_reason + details 로 충분 — OAUTH_INVALID_SCOPE 는 last_error.code 로만).
