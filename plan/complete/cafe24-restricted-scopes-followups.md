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

### 작업 (advanced surface) — ✅ 완료 (2026-06-02, worktree cafe24-allowlist-ui)
- [x] AI Agent allowlist UI 신설 — `cafe24-allowlist-editor.tsx` + `mcp-server-selector` cafe24 expandable 섹션
- [x] 카테고리 단위 grouping — `restrictedApproval.level==='scope'` → 그룹 헤더 ⚠
- [x] operation 단위 row — `level!=='scope'`(operation/program) → 행 ⚠
- [x] 공통 컴포넌트 재사용 (`ApprovalRequiredBadge`) + `cafe24-extras` 공유 헬퍼 추출

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

### 작업 — ✅ 완료 (2026-06-02, worktree cafe24-oauth-invalid-scope-408b14)
- [x] `handleCallback` invalid_scope 분기 + state 소비(`consumeOAuthState`) + context(approval) attach throw (`rejectCafe24InvalidScope`)
- [x] `handleCallbackWithErrorCapture` 에서 ctx.requiresCafe24Approval → `markIntegrationCallbackError` extra 전달
- [x] `markIntegrationCallbackError` statusReason 매핑 (pending_install normalize + connected 명시 분기)
- [x] integration-oauth.service.cafe24.spec.ts invalid_scope 7 케이스
- [x] frontend scope-tab oauth_invalid_scope 전용 섹션 (cafe24RestrictedApprovalApiError 재사용)

### 비목표
- 새 에러 코드 추가 (사용자 facing UX 는 status_reason + details 로 충분)

---

## §3. store 카탈로그의 `privacy_*` planned operation id 재명명 — ❌ 재명명 안 함 (CLOSED 2026-06-02)

> **결정 (2026-06-02): 재명명하지 않는다.** 근거: 앞으로 다양한 외부 시스템과 통합을 진행하며 이런
> 명명 충돌은 빈번하게 발생할 것이고, 매번 충돌하지 않는 이름을 찾는 것은 현실적으로 불가능하다.
> 6 row 는 이미 supported 로 안정적으로 호출 가능하고, 재명명은 backend 메타데이터 + AI agent
> allowlist 저장값 마이그레이션을 포함하는 breaking change 라 비용 대비 실익이 낮다. 따라서 `privacy_*`
> id 를 **현행 유지**하고 본 §3 는 종결한다. (`privacy.md` resource 와의 prefix 혼동은 catalog 주석/
> 문서 레벨로 흡수하며, 명명 충돌 일반 정책이 필요해지면 별도 컨벤션으로 다룬다.)

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

### 작업 — 진행 안 함 (CLOSED)
- [~] prefix 결정 — **취소** (재명명 안 함)
- [~] backend 메타데이터 + catalog + planned mirror 동기 갱신 — 취소
- [~] 기존 사용자 `enabledTools` 마이그레이션 — 취소
- [~] PR — 취소

### 비목표
- 다른 resource 의 명명 일관성 점검 — 별 plan.

### 진행 조건 (히스토리)
- 본 작업은 본 worktree 의 spec 변경에 종속되지 않음 (별 worktree 에서 가능했음).
- 재명명은 사용자 명시 요청 시 착수 예정이었으나, 2026-06-02 결정으로 **현행 유지·종결**.
