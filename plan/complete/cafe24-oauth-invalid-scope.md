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

## 구현 (wiring) — 완료

- [x] `CallbackContext.requiresCafe24Approval?: string[]` 추가.
- [x] `handleCallback`: cafe24 invalid_scope 분기 → `rejectCafe24InvalidScope(state)` (state 소비 → pickRestrictedApprovalScopes → OAUTH_INVALID_SCOPE context attach throw, provider 가드). 다른 error 는 OAUTH_DENIED 유지. state 소비는 `consumeOAuthState` 공유 헬퍼로 추출(ai-review W2).
- [x] `handleCallbackWithErrorCapture`: ctx.requiresCafe24Approval → markIntegrationCallbackError extra.
- [x] `markIntegrationCallbackError`: connected+OAUTH_INVALID_SCOPE status 보존 분기 (pending_install 은 normalize).
- [x] 테스트 7 케이스 (pending_install·connected·restricted 없음·integrationId=null·이미 소비된 state·OAUTH_DENIED 회귀·connected non-restricted). 기존 4-arg 단언 2건 5-arg 갱신.
- [x] frontend: scope-tab oauth_invalid_scope 전용 섹션 (insufficient_scope gate 와 별개 — ai-review/consistency W3).

## 단계 체크리스트

- [x] 3. consistency-check --impl-prep (BLOCK:NO — review/consistency/2026/06/02/09_09_52). WARNING #1·2·3 = 본 구현 목표(처리됨), #4·5·6 = 타 spec 무관.
- [x] 4. DOCUMENTATION (spec §10.4 이미 명세 — 코드만; partial surface 없음, i18n 신규 키 없음)
- [x] 5-7. TDD + 구현 (CallbackContext.requiresCafe24Approval, handleCallback invalid_scope 분기 + rejectCafe24InvalidScope, handleCallbackWithErrorCapture extra 전달, markIntegrationCallbackError connected 분기, scope-tab oauth_invalid_scope 섹션. backend 151 pass + invalid_scope 5 케이스)
- [x] 8. TEST WORKFLOW — lint·unit(5407)·build·e2e(140) PASS
- [x] 9. REVIEW WORKFLOW — /ai-review(12 reviewer, LOW, Critical 0) → 수동 fix(W2/5 consumeOAuthState refactor·INFO#2 provider 가드·W3/4 테스트·W6/8·W9 유저가이드) + RESOLUTION.md. W1 등 보류(근거 RESOLUTION). 재테스트 PASS.
- [x] 10. plan complete — git mv to plan/complete/. restricted-scopes-followups.md §2 체크박스 갱신.

## 비목표 (spec §2 명시)

- 새 에러 코드 추가 (status_reason + details 로 충분 — OAUTH_INVALID_SCOPE 는 last_error.code 로만).
