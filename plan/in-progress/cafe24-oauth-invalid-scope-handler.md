---
worktree: TBD (follow-up — 별도 worktree)
started: 2026-05-17
owner: TBD
type: follow-up
parent_session: review/consistency/2026/05/17/12_37_41/
---

# PLAN: OAuth `invalid_scope` callback 분기 backend 구현

## 배경

`spec/2-navigation/4-integration.md §10.4` 에 신설된 `Cafe24 invalid_scope` 에러 매핑 행은 다음을 명세:

- Cafe24 가 `?error=invalid_scope` 로 callback redirect 했을 때 `Integration.statusReason='oauth_invalid_scope'` + `last_error.details.requiresCafe24Approval: string[]` 기록
- frontend 가 통합 상세 페이지에서 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출

`spec/1-data-model.md §2.10` 의 status_reason enum 에 `oauth_invalid_scope` 추가됨 (PR cafe24-restricted-scopes-a1b2c3 에서 완료).

## 본 PR 에서 제외한 이유

`integration-oauth.service.ts handleCallback` 의 `query.error` 분기 (현재 `OAUTH_DENIED` 단일 매핑) 를 `invalid_scope` 만 별도로 분기하려면 다음이 필요:

- state row 를 invalid_scope 케이스에서만 소비해 `integrationId` + `requestedScopes` 식별
- `handleCallbackWithErrorCapture` 가 새 errorCode `OAUTH_INVALID_SCOPE` 를 받아 `requestedScopes ∩ restricted 명단` 을 `markIntegrationCallbackError` 의 `extra` 인자로 전달
- `markIntegrationCallbackError` 의 statusReason 매핑에 `OAUTH_INVALID_SCOPE → 'oauth_invalid_scope'` 추가 (현재 일반 lowercase 매핑은 normalize 단계에서 unknown_error 로 fallback)

상기 변경은 OAuth 콜백 전체 흐름의 분기를 손대는 작업이라 본 PR (안내 메타데이터 + UI 라벨링) 의 의도와 변경 범위가 다르다. 호출 단계의 `INSUFFICIENT_SCOPE` 보강 (`cafe24-api.client.ts markAuthFailed` 의 `requiresCafe24Approval` 추가) 만으로도 사용자가 위저드 체크 → OAuth 통과 → 호출 시 403 시점에서 안내를 받을 수 있어 UX 의 가치 대부분이 확보된다.

## 작업 항목

- [ ] `handleCallback` 에서 `query.error === 'invalid_scope'` 분기 추가 + state 소비 + context 첨부 throw
- [ ] `handleCallbackWithErrorCapture` 에서 OAUTH_INVALID_SCOPE 시 state 의 requestedScopes 를 읽어 `pickRestrictedApprovalScopes` 호출 + `markIntegrationCallbackError({ requiresCafe24Approval })` 호출
- [ ] `markIntegrationCallbackError` 의 statusReason 매핑에 명시적 분기 추가 (`oauth_invalid_scope`)
- [ ] integration-oauth.service.cafe24.spec.ts 에 케이스 추가
- [ ] frontend: 통합 상세 페이지가 `Integration.statusReason==='oauth_invalid_scope'` + `last_error.details.requiresCafe24Approval` 를 읽어 분기 메시지 노출 (별도 컴포넌트 — 이미 본 PR 에서 INSUFFICIENT_SCOPE 메시지를 만들었다면 재사용)

## 비목표

- 새 에러 코드 추가 (사용자 facing UX 는 status_reason + details 로 충분)
