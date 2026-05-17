---
worktree: cafe24-restricted-scopes-a1b2c3
started: 2026-05-17
owner: project-planner → developer
---

# PLAN: Cafe24 별도 승인 scope/operation 식별·안내 장치

## 1. 배경

Cafe24 Admin API 중 일부 scope·operation 은 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다 (공식 문서 안내 — `"해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요."`). 현 spec/구현에는 이를 표현하는 차원이 없어:

1. 사용자가 통합 추가 위저드에서 mileage / notification / privacy 카테고리를 일반 카테고리처럼 체크 → `invalid_scope` 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인이 "별도 승인 부재" 라는 점을 안내해 줄 장치 없음.
2. `mall.read_store` 같이 일반 권한 안에 일부 sub-resource (Activitylogs, Menus, Naverpay/Kakaopay setting, PG settings 등) 만 별도 승인 대상인 케이스가 있어 **scope 단위 라벨링** 외에 **operation 단위 라벨링**도 필요하다.
3. Cafe24 Analytics API 는 **별도 프로그램 승인**이 필요한 전혀 다른 트랙. (현 spec 범위 외이나 placeholder 등재 — 향후 도입 시 동일 메타데이터 차원 재사용)

## 2. 목표 (Outcome)

- Cafe24 별도 승인 대상이 **메타데이터 SoT 한 곳에 등재**되어 UI/노드/AI Agent/에러 메시지로 자동 전파된다.
- 위저드 Scope 체크박스, 통합 상세 §4.4 Scope & Permissions, Cafe24 노드 Operation 드롭다운, AI Agent allowlist UI 4 군데에서 **동일 ⚠ 배지·tooltip** 으로 노출된다.
- 사용자는 체크 시점에 별도 승인 필요 사실을 인지하고, OAuth 또는 호출 단계에서 실패하더라도 원인을 안내받는다.
- 차단은 하지 않는다 (이미 승인받은 사용자도 있을 수 있음) — "알고 누른다" 보장.

## 3. 영향 범위 (spec)

| 파일 | 변경 |
|------|------|
| `spec/conventions/cafe24-restricted-scopes.md` | **신설** — 별도 승인 대상 scope/operation/program SoT 표 |
| `spec/conventions/cafe24-api-metadata.md` | `Cafe24OperationMetadata.restrictedApproval?` optional 필드 형식 추가 (§2 갱신) + §5 추가 절차에 카탈로그 row 의 `restricted` 컬럼 갱신 단계 추가 + CHANGELOG |
| `spec/conventions/cafe24-api-catalog/_overview.md` | §2 표 컬럼 정의에 `restricted` 컬럼 추가 + §4 동기 정책에 검증 규칙 추가 + Coverage Matrix 또는 별표 + CHANGELOG |
| `spec/conventions/cafe24-api-catalog/mileage.md` | scope 단위 restricted 표기 (전체 row) |
| `spec/conventions/cafe24-api-catalog/notification.md` | scope 단위 restricted 표기 (전체 row) |
| `spec/conventions/cafe24-api-catalog/privacy.md` | scope 단위 restricted 표기 (전체 row) |
| `spec/conventions/cafe24-api-catalog/store.md` | operation 단위 restricted 표기 (영향 row 만: paymentgateway_*, paymentgateway_paymentmethods_*, naverpay_setting_*, kakaopay_setting_*, menus_*, activitylogs_*, financials_paymentgateway_get) |
| `spec/2-navigation/4-integration.md` | §5 Scope 권장 프리셋 표에 "별도 승인" 컬럼; §3.2 Cafe24 Public/Private Step 2 폼 안내 추가; §4.4 Scope & Permissions 탭 ⚠ 배지 노출; §9.4 `INSUFFICIENT_SCOPE` 응답에 `details.requiresCafe24Approval: string[]` 보강 필드; Rationale 항목 신설 |
| `spec/4-nodes/4-integration/4-cafe24.md` | §2 설정 UI 의 Operation 드롭다운 라벨링, §8.3 allowlist UI 의 ⚠ 배지 노출 명세 추가, Rationale 항목 신설 |

## 4. 의사결정 (정책)

- **차원**: 메타데이터 필드 `restrictedApproval` (optional)
  ```ts
  restrictedApproval?: {
    level: 'scope' | 'operation' | 'program';
    category:
      | 'mileage' | 'notification' | 'privacy'         // scope 전체
      | 'activitylogs' | 'menus' | 'pg_settings'        // operation 단위 (store 안)
      | 'naverpay_setting' | 'kakaopay_setting'
      | 'analytics';                                     // 별도 프로그램 (placeholder)
    docsUrl?: string;
    inquiryUrl: string;
  };
  ```
- **카탈로그 표 컬럼**: `restricted` 추가. 값 enum:
  - `scope` — scope 전체가 승인 대상이라 자기 자신과 자매 row 모두 영향
  - `op` — 같은 scope 안에서 본 row 만 승인 대상 (store 케이스)
  - (빈칸) — 일반 사용 가능
- **scope 단위 매핑** (mileage/notification/privacy resource 의 모든 supported row):
  - 카탈로그 row 의 `restricted` 컬럼 = `scope`
  - backend 메타데이터 row 의 `restrictedApproval.level = 'scope'`
  - 동일 resource 의 모든 operation 이 자동으로 같은 라벨을 받도록 한다.
- **operation 단위 매핑** (store resource 안):
  - 영향 row 만 `restricted: op` 라벨 (다른 store row 는 그대로 빈칸)
  - 백엔드는 row 별 `restrictedApproval.level = 'operation'`
- **차단 정책**: 체크/저장 차단 없음. UI ⚠ 배지 + 경고 배너 + tooltip 만 노출. 사용자가 인지하고 진행.
- **에러 메시지 보강**: `INSUFFICIENT_SCOPE (403)` 응답 `details` 에 `requiresCafe24Approval: string[]` (사용자가 요청했던 scope/operation 중 별도 승인이 필요한 항목 목록). 신규 에러 코드는 추가하지 않음 (하위 호환).
- **OAuth `invalid_scope` 처리**: backend 의 OAuth callback 핸들러가 Cafe24 응답을 파싱 후 요청 scopes ∩ restricted 명단의 교집합을 `status_reason='oauth_invalid_scope'` 와 함께 `last_error.details.requiresCafe24Approval` 로 기록 → 통합 상세 페이지에서 안내. (단, OAuth begin 단계의 사전 검증은 하지 않음 — 사용자가 이미 알고 누를 수 있게 안내만)
- **i18n**: 한국어/영어 메시지 2종 (기존 통합 spec 의 i18n 관용에 맞춤).

## 5. 작업 순서 (체크리스트)

### Spec phase (project-planner) — 완료

- [x] worktree 생성 (`.claude/worktrees/cafe24-restricted-scopes-a1b2c3`) — 본 plan
- [x] **`/consistency-check --spec`** 호출 — `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO, WARNING 10건 — 모두 spec 반영 단계에서 흡수)
- [x] `spec/conventions/cafe24-restricted-scopes.md` 신설 (사용자 제공 3개 표 등재 + ## Rationale 섹션 — W-9)
- [x] `spec/conventions/cafe24-api-metadata.md` §2 + §5 + CHANGELOG (W-4: `category` 묶음 매핑 표 + W-5: `level='program'` 검증 제외 명시)
- [x] `spec/conventions/cafe24-api-catalog/_overview.md` §2 + §4 + CHANGELOG (I-3: status 직교 명시 + W-5: program 제외 규칙)
- [x] `spec/conventions/cafe24-api-catalog/mileage.md` 표 row 갱신 (scope 단위, 8 row)
- [x] `spec/conventions/cafe24-api-catalog/notification.md` 표 row 갱신 (scope 단위, 12 row)
- [x] `spec/conventions/cafe24-api-catalog/privacy.md` 표 row 갱신 (scope 단위, 6 row)
- [x] `spec/conventions/cafe24-api-catalog/store.md` 표 row 갱신 (operation 단위, 16 row, 나머지 빈칸)
- [x] `spec/2-navigation/4-integration.md` §3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale (W-1·W-3·I-12 흡수)
- [x] `spec/4-nodes/4-integration/4-cafe24.md` §2 / §8.3 / §9.11 Rationale / CHANGELOG
- [x] `spec/1-data-model.md` §2.10 Integration.status_reason 에 `oauth_invalid_scope` 추가 + `last_error` 스키마에 `details?` 확장 (W-1, W-2)
- [x] `plan/in-progress/cafe24-backlog-residual.md` F-2 와 cross-reference (W-8)

### Implementation phase (developer) — 완료

- [x] `/consistency-check --impl-prep` (구현 착수 직전 의무) — `review/consistency/2026/05/17/12_37_41/` (초기 BLOCK YES → spec drift fix commit 으로 해소)
- [x] backend: `Cafe24OperationMetadata` 타입에 `restrictedApproval` + `Cafe24ApprovalGroup` / `Cafe24RestrictedApproval` 신설
- [x] backend: 영향 resource (mileage / notification / privacy 전부 + store 의 영향 4 supported row) 메타데이터 row 에 `restrictedApproval` 채움
- [x] backend: `catalog-sync.spec.ts` parser 헤더 기반 동적 인덱싱으로 개정 + 규칙 8 양방향 동기 검증 신규 4 케이스
- [x] backend: services 메타데이터 응답에 `ScopeOption.requiresApproval` + node-definitions extras 에 `restrictedApproval` 노출
- [x] backend: `INSUFFICIENT_SCOPE` 분기에서 `markAuthFailed(errBody)` → `last_error.details.requiresCafe24Approval` 기록
- [x] backend: `integration-status-reason` enum 에 `oauth_invalid_scope` 추가 + `markIntegrationCallbackError(extra?)` 인자 마련
- [ ] **(follow-up)** Cafe24 OAuth callback 의 `invalid_scope` 분기 자체는 `plan/in-progress/cafe24-oauth-invalid-scope-handler.md` 로 분리 — handleCallback 의 query.error 분기와 state 소비 순서 변경이 필요해 본 PR 범위 외
- [x] frontend: `components/integrations/approval-required-badge.tsx` 공통 컴포넌트 신설 (ApprovalRequiredBadge + RestrictedScopeNotice)
- [x] frontend: 통합 추가 위저드 Step 2 Cafe24 폼 — Scope checkbox ⚠ + 영구 경고 배너
- [x] frontend: 통합 상세 §4.4 Scope & Permissions 탭 — 현재/누락/권장 scope 모두 ⚠ 배지
- [x] frontend: Cafe24 노드 Operation 드롭다운 — supported row 라벨 우측 ⚠ 접미사 + 하단 안내 줄
- [ ] **(follow-up)** AI Agent allowlist UI 라벨링은 `plan/in-progress/cafe24-ai-agent-allowlist-ui.md` 로 분리 — advanced surface 신설 후 동일 컴포넌트로 라벨링
- [x] frontend: `Integration.lastError.details.requiresCafe24Approval` 가 채워져 있으면 분기 메시지 노출 (scope-tab)
- [x] frontend: i18n 한/영 번역 키 추가 (`integrations.approvalRequired*` + `nodeConfigs.integration.cafe24OperationApprovalSuffix`)
- [x] tests: backend `restricted-approval.spec.ts` 신설 (extractCafe24ScopeTokens / pickRestrictedApprovalScopes / SCOPE_LEVEL_RESTRICTED_SCOPES 파생). catalog-sync 16 case 통과. frontend 1433 test 통과
- [x] **`/ai-review`** 사후 호출 → `review/code/2026/05/17/13_24_39/SUMMARY.md` 결과 RESOLUTION 으로 흡수

## 6. 사용자 제공 자료 (factual sources)

### 6.1 Scope 전체 별도 승인

| Scope | 설명 |
|---|---|
| `mall.read_mileage` | 적립금 조회 |
| `mall.write_mileage` | 적립금 수정 |
| `mall.read_notification` | 알림 조회 |
| `mall.write_notification` | 알림 발송 |
| `mall.read_privacy` | 개인정보 조회 |
| `mall.write_privacy` | 개인정보 수정 |

### 6.2 store scope 안의 operation 단위 별도 승인

| Operation 영역 | Scope | 설명 |
|---|---|---|
| Activitylogs | `mall.read_store` | 활동 로그 목록/상세 조회 |
| Financials paymentgateway | `mall.read_store` | PG사 계약정보 조회 |
| Menus | `mall.read_store` | 메뉴 모드/경로 조회 |
| Naverpay setting | `mall.read_store` / `mall.write_store` | 네이버페이 설정 조회·등록·수정 |
| Kakaopay setting | `mall.read_store` / `mall.write_store` | 카카오페이 설정 조회·수정 |
| Paymentgateway | `mall.read_store` / `mall.write_store` | PG 생성·수정·삭제 |
| Paymentgateway paymentmethods | `mall.read_store` / `mall.write_store` | PG 결제수단 생성·수정·삭제 |

### 6.3 별도 프로그램 승인

| API | 설명 |
|---|---|
| Cafe24 Analytics API | 카페24 승인 제휴사에만 제공. 쇼핑몰 사용자 행동 데이터 제공 서비스 제작 용도 (현 spec 범위 외 — placeholder 등재) |

### 6.4 참고 링크

- Cafe24 Admin API 공식 문서: https://developers.cafe24.com/docs/api/admin/
- Scope별 사용 동의 가이드: https://developers.cafe24.com/app/front/app/develop/api/scope
- Cafe24 Analytics API: https://developers.cafe24.com/docs/ko/api/cafe24data/
- 카페24 개발자센터 문의: https://developers.cafe24.com

## 6.5 동시 수정 인지 (W-8 cross-reference)

같은 `spec/2-navigation/4-integration.md` 를 `plan/in-progress/cafe24-backlog-residual.md` 의 **F-2** 항목 (§6 mermaid `install_token` 보존 정책 명시) 이 별도로 수정 대상으로 들고 있다. consistency-check (`review/consistency/2026/05/17/12_12_46/`) W-8 으로 검출되어 양쪽 plan 에 상호 인식을 명시한다. 본 plan 이 먼저 main 머지 → F-2 후행 권장 (영역 분리: 본 plan 은 §3.2/§4.4/§5/§9.4/§10.4/Rationale, F-2 는 §6 mermaid — 라인 충돌 가능성 낮지만 머지 순서로 안전 확보).

## 7. 비목표 (Out of scope)

- Cafe24 Analytics API 실제 구현 — placeholder 등재만. 실제 호출 경로는 별도 plan.
- OAuth begin 단계에서 restricted scope 사용을 사전 차단 — 본 plan 은 "안내만, 차단 없음" 정책.
- 카페24 본사 승인을 자동화 — 사용자가 직접 개발자센터 문의 진행.
- mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope 인지의 검증 — 사용자 자료 기준으로는 mileage resource 전체를 scope-level restricted 로 다룬다. 향후 카페24 공식 문서로 분리 확인되면 별도 plan 으로 정정.
