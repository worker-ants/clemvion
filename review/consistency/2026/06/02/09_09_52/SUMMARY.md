# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**MEDIUM** — Cross-Spec 에서 `handleCallback` 의 `invalid_scope` 미처리가 핵심 구현 gap 으로 확인됨. 단, 이는 본 worktree 의 구현 목표 자체이므로 차단 사유가 아니라 구현 체크리스트로 전환.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `handleCallback` 이 `?error=invalid_scope` callback 을 `OAUTH_DENIED` 단일 코드로 즉시 throw — state row 미소비로 `integrationId` context 없어 `markIntegrationCallbackError` 가 `oauth_invalid_scope` + `requiresCafe24Approval` 를 미기록 | `codebase/backend/src/modules/integrations/integration-oauth.service.ts` `handleCallback()` 라인 495–500 | `spec/2-navigation/4-integration.md §10.4`, `spec/1-data-model.md §2.10`, `spec/conventions/cafe24-restricted-scopes.md §4.3` | `query.error === 'invalid_scope'` 분기를 state row 소비 이후로 이동; `pickRestrictedApprovalScopes` 로 `requiresCafe24Approval` 계산 후 `OAUTH_INVALID_SCOPE` 코드로 throw; `handleCallbackWithErrorCapture` 가 `markIntegrationCallbackError` 를 호출하도록 연결 |
| 2 | Cross-Spec | `normalizeStatusReason('oauth_invalid_scope')` 경로가 현재 코드에서 도달 불가 (dead code) — `OAUTH_INVALID_SCOPE` 를 throw 하는 경로가 없으므로 | `codebase/backend/src/modules/integrations/integration-status-reason.ts` 라인 32 | `spec/2-navigation/4-integration.md §6 상태 전이`, `§10.4` | WARNING 1 수정 완료 시 자동 해소. 별도 조치 불필요 |
| 3 | Cross-Spec | `scope-tab.tsx` 가 `statusReason === 'insufficient_scope'` 만 gate — `oauth_invalid_scope` 케이스에서 안내 섹션 미렌더링 | `codebase/frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` 라인 49 | `spec/2-navigation/4-integration.md §4.4`, `spec/conventions/cafe24-restricted-scopes.md §4.3` | `statusReason === 'oauth_invalid_scope' && requiresApprovalFromError.length > 0` 분기 추가. 본 worktree 구현 범위 내 |
| 4 | Rationale | `trigger-list.md` R-2 가 R-14 에 의해 폐기된 inline `hmacSecret` PATCH v1 API 경로를 현재 설계인 것처럼 서술 — 구현자 오해 위험 | `spec/2-navigation/2-trigger-list.md §Rationale R-2` (L202-210) | 동일 문서 R-14 "authConfigId v1 — inline 인증 필드 제거" (L284-291) | R-2 본문에 "(폐기됨 — R-14 참조)" 주석 추가 또는 별도 "R-2 (폐기됨)" 항목으로 명시 |
| 5 | Convention | `14-execution-history.md` 에 `## Overview (제품 정의)` PRD 블록과 `## 1. 개요` spec 본문이 이중으로 병존 — 문서 구조 혼재 | `spec/2-navigation/14-execution-history.md` 14행 이후 | CLAUDE.md 3섹션 구조 권장 (Overview / 본문 / Rationale) | Overview 블록을 `_product-overview.md` 로 이동하거나 `## 1. 개요` 앞에 통합 |
| 6 | Convention | `14-execution-history.md`, `0-dashboard.md`, `10-auth-flow.md` 의 `code:` frontmatter 에 backend 구현 경로 누락 (`status: implemented` 이면서 backend API surface 정의됨) | `spec/2-navigation/14-execution-history.md`, `0-dashboard.md`, `10-auth-flow.md` frontmatter | `spec/conventions/spec-impl-evidence.md §2` Frontmatter 스키마 | 각 파일 `code:` 에 대응 backend 모듈 경로 추가 (예: `codebase/backend/src/modules/executions/**`, `codebase/backend/src/modules/dashboard/**`, `codebase/backend/src/modules/auth/**`) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/1-data-model.md §2.10` `oauth_invalid_scope` 명명과 `integration-status-reason.ts` union 일치 확인 — WARNING 1 미수정 시 dead branch | `spec/1-data-model.md §2.10`, `integration-status-reason.ts` | WARNING 1 수정 후 자동 해소 |
| 2 | Rationale | `14-execution-history.md` Rationale 섹션 없음 (chain badge 위치, drill-down 분리 API 근거 미기록) | `spec/2-navigation/14-execution-history.md` | `## Rationale` 섹션 추가 후 최소 chain badge 배치·드롭다운 API 분리 이유 기록 |
| 3 | Rationale | `10-auth-flow.md §5.3` "decision A, 2026-05-31" 인라인 결정이 Rationale 섹션에 미등재 | `spec/2-navigation/10-auth-flow.md §5.3` | `## Rationale R-3` 으로 승격 (URL history/Referer/프록시 로그 노출 차단) |
| 4 | Rationale | `12-workflow-version-history.md` Rationale 섹션 없음 (페이지 리로드 선택·불변 스냅샷 설계 근거 미기록) | `spec/2-navigation/12-workflow-version-history.md` | `## Rationale` 섹션 추가 |
| 5 | Convention | `14-execution-history.md §5` 응답 예시의 `pagination` 포맷이 `TransformInterceptor` 래핑 적용 후 실제 응답 구조와 일치하는지 미명시 | `spec/2-navigation/14-execution-history.md §5` | spec 예시에 래핑 고려 주석 추가 또는 `swagger.md §2-5` 응답 wrapping 패턴과 정합 명시 |
| 6 | Convention | `14-execution-history.md §2.4` `#### Trigger 출처 분류` 가 H4 소절로 삽입 — cross-reference anchor 는 정상 동작 | `spec/2-navigation/14-execution-history.md §2.4` | 현 구조 유지 가능. 중요도 높을 시 `### 2.5` 로 독립 절 승격 고려 |
| 7 | Plan | `cafe24-install-ratelimit-2891d1` worktree 가 `spec/2-navigation/4-integration.md` 의 다른 섹션 수정 중 — target plan 은 spec 파일 미수정으로 실질 충돌 없음 | `spec/2-navigation/4-integration.md` | 조치 불요. target plan 이 예외적으로 spec 파일 수정하게 되면 rebase 충돌 확인 |
| 8 | Plan | `cafe24-restricted-scopes-followups.md §2` 체크박스가 본 worktree 완료 후 갱신 필요 | `plan/in-progress/cafe24-restricted-scopes-followups.md §2` | target plan 완료 시 `§2` 체크박스 `[x]` 갱신 |
| 9 | Naming | `OAUTH_INVALID_SCOPE` 상수가 코드에 아직 미존재 — spec §10.4 명세는 있음 | `codebase/backend/src/modules/integrations/integration-oauth.service.ts` | 구현 시 상수 추출 또는 기존 inline 객체 패턴으로 일관성 유지 |
| 10 | Naming | plan 상 내부 메서드명 `throwCafe24InvalidScope` 이 기존 `handleXxx` / `processXxx` 관례와 상이 | plan `cafe24-oauth-invalid-scope.md` | `handleCafe24InvalidScope` 또는 `rejectCafe24InvalidScope` 로 변경 검토 |
| 11 | Naming | `CallbackContext.requiresCafe24Approval?` optional 추가 — 기존 소비자 하위호환 유지. frontend `last_error.details.requiresCafe24Approval` 키와 경로 일치 여부 구현 시 확인 필요 | `integration-oauth.service.ts:149` `CallbackContext` 인터페이스 | 단위 테스트로 `CallbackContext → markIntegrationCallbackError → last_error.details.requiresCafe24Approval` 경로 검증 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `handleCallback` 의 `invalid_scope` 미분기로 spec §10.4 상태 전이 미충족 — 본 worktree 구현 목표와 일치하는 gap |
| Rationale Continuity | LOW | `trigger-list.md` R-2 의 폐기된 API 설계 미갱신 — 구현자 혼동 위험 |
| Convention Compliance | LOW | `status: implemented` spec 3건의 `code:` frontend-only — backend 경로 누락. `14-execution-history.md` 이중 구조 |
| Plan Coherence | NONE | 실질 worktree 충돌 없음. 동일 spec 파일 다른 섹션 수정 1건 INFO |
| Naming Collision | NONE | 신규 식별자 충돌 없음. 메서드명 관례 경미 불일치 INFO |

## 권장 조치사항

1. **(본 worktree 구현 필수)** `handleCallback` 에서 `query.error === 'invalid_scope'` 분기를 state row 소비 이후로 재배치하여 `integrationId` + `requestedScopes` 추출 후 `OAUTH_INVALID_SCOPE` 코드로 throw — `markIntegrationCallbackError` 가 `oauth_invalid_scope` status_reason + `requiresCafe24Approval` details 를 기록하도록 연결 (WARNING 1, 2 해소)
2. **(본 worktree 구현 필수)** `scope-tab.tsx` 에 `statusReason === 'oauth_invalid_scope' && requiresApprovalFromError.length > 0` 렌더링 분기 추가 (WARNING 3 해소)
3. **(spec 개선 — 본 worktree 외 권고)** `trigger-list.md R-2` 에 폐기 주석 추가 (WARNING 4 해소)
4. **(spec 개선 — 본 worktree 외 권고)** `0-dashboard.md`, `10-auth-flow.md`, `14-execution-history.md` frontmatter `code:` 에 backend 모듈 경로 추가 (WARNING 6 해소)
5. **(완료 후)** `plan/in-progress/cafe24-restricted-scopes-followups.md §2` 체크박스 갱신