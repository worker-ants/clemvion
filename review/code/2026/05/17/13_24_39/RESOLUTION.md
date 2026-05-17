# RESOLUTION — review/code/2026/05/17/13_24_39

세션: `review/code/2026/05/17/13_24_39/SUMMARY.md` (BLOCK: NO, WARNING 15, INFO 19, MEDIUM).
조치 후 backend 214 suite / 3822 test all green, frontend 123 suite / 1433 test all green, lint clean, build clean.

## WARNING 조치

| # | 항목 | 조치 |
|---|------|------|
| W-1 | OAuth callback `invalid_scope` 경로의 `extra` 미전달 | 본 PR 범위 외 — `plan/in-progress/cafe24-oauth-invalid-scope-handler.md` 로 분리. `markIntegrationCallbackError(extra?)` 시그니처 + status_reason enum 확장은 본 PR 에 포함, 호출자 wiring 은 follow-up. plan 본문에 명시. |
| W-2 | `Cafe24ApprovalGroup.analytics` 와 `RESTRICTED_APPROVAL` 누락 불일치 | `types.ts` `Cafe24ApprovalGroup` 의 `analytics` 항목 라인에 인라인 주석 추가 — "Reserved placeholder. No corresponding RESTRICTED_APPROVAL entry today; populated when Analytics support ships." `restricted-approval.ts` 모듈 헤더 JSDoc 에도 같은 주석. |
| W-3 | catalog-sync.spec.ts `cells.length < 9` 매직넘버 | `MIN_CATALOG_COLUMNS = 9` 명명 상수 추출 + 의미 주석. |
| W-4 | `extractCafe24ScopeTokens` 가 `metadata/` 레이어에 혼재 | 본 PR 에서는 위치 유지 — backend 의 `cafe24/metadata/` 가 이미 wrapper-shared helper (`planned.ts` 등) 를 들고 있는 패턴과 일관. `cafe24/utils/` 신설은 더 큰 리팩토링 트리거라 별도 follow-up 으로 분리할 가치. RESOLUTION 에서 추적. |
| W-5 | backend/frontend 타입 이중 선언 (Cafe24RestrictedApproval 등) | 본 PR 에서는 동기 보장만 강화 — frontend `Cafe24RestrictedApproval` 에 SoT cross-reference JSDoc 추가. shared 타입 패키지 / codegen 은 별도 PR (현재 backend↔frontend 타입 미러 패턴이 본 코드베이스 다른 영역에도 광범위하게 깔린 큰 변경). |
| W-6 | `markAuthFailed` / `markIntegrationCallbackError` 옵셔널 파라미터 누락 위험 | 양쪽 함수에 JSDoc 추가하여 `errBody` / `extra` 의 의미·전달 의무·관련 spec 참조 명시. |
| W-7 | `SCOPE_LEVEL_RESTRICTED_SCOPES` 와 `RESTRICTED_APPROVAL` 이중 관리 | `SCOPE_LEVEL_RESTRICTED_SCOPES` 를 IIFE 로 `RESTRICTED_APPROVAL` 의 `level==='scope'` 항목에서 파생. 두 자리에서 한 자리로 통합. |
| W-8 | `restricted-approval.ts` 핵심 함수 전용 단위 테스트 부재 | `restricted-approval.spec.ts` 신설 — 21 case (RESTRICTED_APPROVAL 정합성, SCOPE_LEVEL_RESTRICTED_SCOPES 파생, pickRestrictedApprovalScopes/extractCafe24ScopeTokens 다양한 입력, end-to-end 합성). |
| W-9 | `markAuthFailed` / `markIntegrationCallbackError` 통합 흐름 테스트 부재 | `markAuthFailed` 의 정확한 통합 흐름 단위 테스트는 기존 `cafe24-api.client.spec.ts` 의 401/403 케이스가 markAuthFailed 호출을 검증 (호출 자체는 회귀 보호됨). `errBody` payload 의 `requiresCafe24Approval` 채움 검증은 위 `restricted-approval.spec.ts` 의 end-to-end 케이스로 합성 보호. 향후 e2e 또는 통합 spec 도 추가 가치 — follow-up 으로 추적. |
| W-10 | catalog-sync.spec.ts Rule 8 의 non-null assertion | `findCafe24Operation(...)!` 제거 → 명시적 null check + 의미 있는 에러 메시지 (`catalog marks restricted="..." but no metadata row exists`). |
| W-11 | `IntegrationDto.lastError.details` 타입 느슨 + scope-tab 단언 | `details?: { requiresCafe24Approval?: string[] } & Record<string, unknown>` 으로 구체화. scope-tab 의 단언은 `readRequiresApproval(lastError)` 타입 가드 헬퍼로 대체 (runtime null/undefined/non-array 처리 포함). |
| W-12 | `oauth_invalid_scope` statusReason 프론트 UI 분기 부재 | follow-up `cafe24-oauth-invalid-scope-handler.md` 에 명시 — backend callback 분기 구현 시 frontend 분기도 함께. 본 PR 에서는 statusReason enum 만 추가. |
| W-13 | `markIntegrationCallbackError` JSDoc 부재 | JSDoc 추가 (W-6 동일 처리). |
| W-14 | plan 체크리스트 미갱신 | `plan/in-progress/cafe24-restricted-scopes.md` §5 항목들 `[x]` 갱신 + follow-up 분리 항목 `(follow-up)` 표기. |
| W-15 | catalog-sync.spec.ts 파서 리팩토링 범위 초과 | 의도된 변경 — drift fix commit `c4d49c19` 에서 10-column 헤더 변경에 맞춰 파서 전면 교체. 별도 commit 으로 분리되어 history 추적 가능. RESOLUTION 에서 명시. |

## INFO 조치

| # | 항목 | 조치 |
|---|------|------|
| I-1 | 정규식 좁히기 | `TOKEN_RE` 패턴을 `mall\.(?:read|write)_[a-z]+(?:_[a-z]+)*` 로 좁힘. |
| I-2 | scope-tab 런타임 가드 | `readRequiresApproval` 타입 가드 함수 신설 (W-11 함께). |
| I-3 | `inquiryUrl` 중복 하드코딩 | backend `CAFE24_INQUIRY_URL` export 화. frontend `approval-required-badge.tsx` 에 mirror 상수 + 주석. |
| I-4 | `markIntegrationCallbackError.extra` 공통 인터페이스 노출 | 현재 시그니처 유지. Cafe24-only 필드명은 의도된 — 다른 provider 의 `details` 키 도입 시 union 확장. JSDoc 에 의도 명시. |
| I-5 | `integration-configs.tsx` 공통 컴포넌트 미사용 | SelectField 의 option label 은 string-only 라 컴포넌트 임베드 불가. 라벨에 `⚠` + i18n 접미사 + 하단 안내 줄로 동일 UX 보장. |
| I-6 | `⚠` 접근성 | 드롭다운 옵션은 native `<option>` 이라 별도 aria-label 불가. 라벨 텍스트 자체에 "별도 승인 필요" 한국어 / "Approval required" 영어가 들어가 스크린리더가 읽음. |
| I-7 | `as const satisfies` 패턴 | `RESTRICTED_APPROVAL` 을 `as const satisfies Record<string, Cafe24RestrictedApproval>` 로 변경 — 리터럴 타입 좁히기 + 인터페이스 준수 동시 보장. |
| I-8 | `detailsObj` 변수명 | `lastErrorDetails` 로 명명 유지 (현재 명확). RESOLUTION 에 표기. |
| I-9 | plan 의 `'op'` enum 값 정정 | `plan/in-progress/cafe24-restricted-scopes.md` 는 갱신. `plan/in-progress/spec-draft-cafe24-restricted-scopes.md` 는 historical draft 라 그대로 보존 — drift fix commit `c4d49c19` 가 실제 spec/code 에서는 `operation` 으로 정정한 history 가 git log 에 남아 있다. |
| I-10 | 공통 컴포넌트 RTL 테스트 부재 | 본 PR 의 ScopeTab 통합 테스트가 ApprovalRequiredBadge / RestrictedScopeNotice 의 행위를 간접 보호. 별도 컴포넌트 단위 RTL 은 follow-up 으로 추적. |
| I-11 | scope-tab `requiresApprovalFromError` 프론트 통합 테스트 부재 | follow-up — scope-tab.test.tsx 의 missingScopes 분기에 last_error.details 케이스 추가. |
| I-12 | services endpoint 의 `requiresApproval` 직렬화 검증 e2e 부재 | follow-up — backend e2e suite 의 services endpoint 응답 검증에 `requiresApproval: true` 케이스 추가. |
| I-13 | frontend `Cafe24RestrictedApproval` JSDoc | SoT 참조 주석 추가. |
| I-14 | backend/frontend `ScopeOption.requiresApproval` cross-reference | JSDoc 양쪽에 mirror 명시. |
| I-15 | CHANGELOG | 본 프로젝트는 `CHANGELOG.md` 가 spec 본문의 `CHANGELOG` 섹션을 통해 관리됨 — 본 PR 의 변경은 `spec/conventions/cafe24-api-metadata.md`, `cafe24-api-catalog/_overview.md`, `cafe24-restricted-scopes.md`, `2-navigation/4-integration.md`, `4-nodes/4-integration/4-cafe24.md`, `1-data-model.md` 각 CHANGELOG 절에 기록 완료. |
| I-16 | 포맷팅 변경 혼재 | 본 PR 의 commit 단위로 의도 변경만 add 했으며 prettier --fix 자동 변경은 working tree 에 두고 본 PR 에서 분리. 별도 sweep PR 로 처리. |
| I-17 | AI Agent allowlist Operation suffix 가 plan 외 포함 | scope reviewer 의 오해 — `integration-configs.tsx` 의 변경은 **Cafe24 노드 Operation 드롭다운** (`§2`) 의 라벨이며 AI Agent allowlist UI 와는 다른 화면. AI Agent allowlist 는 `mcp-server-selector.tsx` 의 별도 surface 이며 본 PR 의 변경 없음 (follow-up `cafe24-ai-agent-allowlist-ui.md`). |
| I-18 | spec-draft 와 spec 본문 중첩 | spec-draft 는 historical record (consistency-check 입력) 로 보존. 본 plan 완료 시 spec-draft 도 `plan/complete/` 로 함께 이동. |
| I-19 | extract 토큰 추출 실패 무음 | runtime debug 로그는 본 PR 에서 미추가 — 일반 운영에서 token mismatch 가 흔히 발생할 수 있어 (사용자가 일반 scope 만 요청) noise 부담 큼. follow-up 으로 추적. |

## 라우터 결정 — 실행 안 된 reviewer

- `performance` / `dependency` / `database` / `concurrency` 4건 router 결정으로 skip.
- 본 PR 변경의 특성 (메타데이터 + UI 라벨링 + 신규 helper) 상 4 reviewer 의 잠재 발견 가치는 낮음. 별도 skip 명시.

## 후속 follow-up plans

- `plan/in-progress/cafe24-oauth-invalid-scope-handler.md` — OAuth callback `invalid_scope` 분기 handleCallback wiring + frontend statusReason UI
- `plan/in-progress/cafe24-ai-agent-allowlist-ui.md` — AI Agent allowlist operation-단위 grouping UI 신설 시 ⚠ 라벨링
- `plan/in-progress/cafe24-store-privacy-prefix-rename.md` — store.md `privacy_*` planned operation id 명명 충돌 정리

## TEST WORKFLOW 재통과

- backend: lint warnings 19 (pre-existing), unit 214 suite / 3822 test ✓, build ✓
- frontend: lint ✓, unit 123 suite / 1433 test ✓, build ✓
- e2e: 본 PR 변경은 메타데이터 + UI 라벨링 위주 — OAuth/Integration 핵심 흐름 (callback / token exchange / refresh) 무변경. `markAuthFailed(errBody?)` 시그니처 변경은 호출자 단일 지점만 영향. 본 RESOLUTION 에서 e2e skip 권장 (`[skip-e2e]`), 사용자 PR 머지 정책에 따라 GitHub Action 의 e2e 가 별도 검증.
