---
worktree: TBD (per-item)
started: 2026-05-17
owner: developer / project-planner (per-item)
type: follow-up
parent_session: review/consistency/2026/05/17/12_37_41/ (W-7), cafe24-restricted-scopes-a1b2c3 PR
---

# Cafe24 restricted-scopes PR follow-up 묶음

## 출처

`cafe24-restricted-scopes-a1b2c3` (PR cafe24-restricted-scopes 본체) merge 후 별 PR 로 분리된 follow-up 들을 한 plan 으로 묶어 추적한다. 모두 본 PR 의 핵심 변경 (`Cafe24OperationMetadata.restrictedApproval` 데이터 모델 + `RestrictedScopeNotice` UI + `INSUFFICIENT_SCOPE` 매핑) 과 직접 연관되지만 scope 분리로 별 PR 권장.

분리 통합한 원본 plan (2026-05-18 in-progress 정리에서 흡수):
- `cafe24-ai-agent-allowlist-ui.md` (§1)
- `cafe24-oauth-invalid-scope-handler.md` (§2)
- `cafe24-store-privacy-prefix-rename.md` (§3)

각 항목은 worktree 를 별도로 두어 진행한다. 한 항목이 끝나면 본 plan 의 해당 § 체크박스를 `[x]` 로 갱신하고, 모든 항목이 끝나면 본 plan 을 `plan/complete/` 로 `git mv`.

---

## §1. AI Agent allowlist UI 의 ⚠ 별도 승인 라벨링

### 배경
`spec/4-nodes/4-integration/4-cafe24.md §8.3` 의 AI Agent allowlist UI 가 카테고리 단위 grouping 으로 enabledTools 를 편집할 때 카페24 별도 승인 대상 카테고리/operation 에 ⚠ 라벨을 노출해야 한다.

현재 frontend (`components/integrations/mcp-server-selector.tsx`) 는 server (Integration) 단위 picker 만 제공하고 operation 단위 grouping UI 는 아직 advanced surface 로 구현 전.

### 본 PR 에서 이미 준비된 것
- backend `Cafe24OperationMetadata.restrictedApproval` + `public-meta.PublicCafe24OperationSupported.restrictedApproval` — frontend 가 사용 가능한 데이터는 이미 응답에 노출됨.
- frontend `Cafe24SupportedOperation.restrictedApproval` 타입 + 공통 컴포넌트 `ApprovalRequiredBadge`, `RestrictedScopeNotice` — 신규 화면에서도 그대로 재사용.
- i18n 키 (`integrations.approvalRequiredBadge` 등) — 이미 등록됨.

### 작업 (advanced surface 도입 시)
- [ ] AI Agent allowlist UI 신설 (mcp-server-selector 에 expand 또는 별도 페이지)
- [ ] 카테고리 단위 grouping — `restrictedApproval.level==='scope'` 면 그룹 헤더 ⚠
- [ ] operation 단위 row — `restrictedApproval.level==='operation'` 면 행 단위 ⚠
- [ ] 공통 컴포넌트 재사용

---

## §2. OAuth `invalid_scope` callback 분기 backend 구현

### 배경
`spec/2-navigation/4-integration.md §10.4` 에 신설된 `Cafe24 invalid_scope` 에러 매핑 행은 다음을 명세:

- Cafe24 가 `?error=invalid_scope` 로 callback redirect 했을 때 `Integration.statusReason='oauth_invalid_scope'` + `last_error.details.requiresCafe24Approval: string[]` 기록
- frontend 가 통합 상세 페이지에서 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출

`spec/1-data-model.md §2.10` 의 status_reason enum 에 `oauth_invalid_scope` 추가됨 (PR cafe24-restricted-scopes-a1b2c3 에서 완료).

### 본 PR 에서 제외한 이유
`integration-oauth.service.ts handleCallback` 의 `query.error` 분기 (현재 `OAUTH_DENIED` 단일 매핑) 를 `invalid_scope` 만 별도로 분기하려면:

- state row 를 invalid_scope 케이스에서만 소비해 `integrationId` + `requestedScopes` 식별
- `handleCallbackWithErrorCapture` 가 새 errorCode `OAUTH_INVALID_SCOPE` 를 받아 `requestedScopes ∩ restricted 명단` 을 `markIntegrationCallbackError` 의 `extra` 인자로 전달
- `markIntegrationCallbackError` 의 statusReason 매핑에 `OAUTH_INVALID_SCOPE → 'oauth_invalid_scope'` 추가

상기 변경은 OAuth 콜백 전체 흐름의 분기를 손대는 작업이라 본 PR 의 범위와 다르다. 호출 단계의 `INSUFFICIENT_SCOPE` 보강 (`cafe24-api.client.ts markAuthFailed` 의 `requiresCafe24Approval` 추가) 만으로도 사용자가 위저드 체크 → OAuth 통과 → 호출 시 403 시점에서 안내를 받을 수 있어 UX 의 가치 대부분이 확보된다.

### 작업
- [ ] `handleCallback` 에서 `query.error === 'invalid_scope'` 분기 추가 + state 소비 + context 첨부 throw
- [ ] `handleCallbackWithErrorCapture` 에서 OAUTH_INVALID_SCOPE 시 state 의 requestedScopes 를 읽어 `pickRestrictedApprovalScopes` 호출 + `markIntegrationCallbackError({ requiresCafe24Approval })` 호출
- [ ] `markIntegrationCallbackError` 의 statusReason 매핑에 명시적 분기 (`oauth_invalid_scope`)
- [ ] integration-oauth.service.cafe24.spec.ts 에 케이스 추가
- [ ] frontend: 통합 상세 페이지가 `Integration.statusReason==='oauth_invalid_scope'` + `last_error.details.requiresCafe24Approval` 를 읽어 분기 메시지 노출 (INSUFFICIENT_SCOPE 메시지 컴포넌트 재사용)

### 비목표
- 새 에러 코드 추가 (사용자 facing UX 는 status_reason + details 로 충분)

---

## §3. store 카탈로그의 `privacy_*` planned operation id 재명명

### 배경
impl-prep consistency-check (`review/consistency/2026/05/17/12_37_41/` W-7) 가 `spec/conventions/cafe24-api-catalog/store.md` 의 6 planned row 가 `privacy_` 접두사를 사용해 별개 resource 인 `privacy.md` 와 명명 혼동을 유발한다고 지적.

영향 row:

- `privacy_boards_get` / `privacy_boards_update`
- `privacy_join_get` / `privacy_join_update`
- `privacy_orders_get` / `privacy_orders_update`

### 2026-05-21 상태 변경
6 row 가 모두 **planned → supported 로 승격**됨 (`claude/cafe24-impl-remaining-935c4d` PR). backend 메타데이터 (`store.ts`) · planned mirror (`planned.ts`) · catalog (`store.md`) · `_overview.md` coverage matrix 동기 갱신. id 는 기존 `privacy_*` 그대로 유지 — 재명명은 본 §3 후속으로 가능하나 이제부터는 backend 메타데이터 + AI agent allowlist 저장값 마이그레이션을 포함해야 함 (호환성 breaking).

### 결정 필요 사항 (재명명을 진행할 경우)
1. 새 prefix 선택 — `store_privacy_*` (resource prefix 유지) vs `policy_privacy_*` (정책 그룹 명시) vs 기타.
2. catalog row + backend metadata id 동시 갱신 + 기존 `enabledTools` (AI agent allowlist) 저장값 마이그레이션 절차 결정.

### 작업
- [ ] prefix 결정 (필요 시)
- [ ] backend 메타데이터 + catalog + planned mirror 동기 갱신
- [ ] 기존 사용자 `enabledTools` 마이그레이션 (id 변경은 breaking 이므로 deprecated alias 또는 일괄 변환)
- [ ] PR

### 비목표
- 다른 resource 의 명명 일관성 점검 — 별 plan.

### 진행 조건
- 본 작업은 본 worktree 의 spec 변경에 종속되지 않음 (별 worktree 에서 가능).
- 사용자가 재명명을 명시적으로 요청한 시점에 착수 — 현재는 backend 가 실제 호출 가능한 supported 상태로 안정되어 있으므로 긴급도 낮음.
