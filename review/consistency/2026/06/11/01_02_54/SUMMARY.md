# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 전 체커에서 Critical 위배 없음. WARNING 4건(중복 제거 후), INFO 다수. 전반적으로 spec 간 동기화가 양호하며 실행 차단 사유 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `status_reason='unknown'` → `'unknown_error'` 개명이 `spec/5-system/` 및 `spec/conventions/` 에서 잔존 가능 | `spec/1-data-model.md §2.10`, `spec/2-navigation/4-integration.md §5.4` | `spec/5-system/` 하위 및 `spec/conventions/` 내 `status_reason` 값 목록 명시 문서 | 두 디렉터리에서 `status_reason` 또는 `integration.*error.*code` 에 `unknown` 잔존 여부 점검 후 `unknown_error` 로 동기화 |
| 2 | Convention Compliance | `14-execution-history.md` 이중 개요 섹션 혼용 (`## Overview (제품 정의)` + `## 1. 개요` 병존) | `spec/2-navigation/14-execution-history.md` | CLAUDE.md §정보 저장 위치, 3섹션 단일 흐름 규약 | `## Overview (제품 정의)` 절의 요구사항 ID·배경을 `spec/2-navigation/_product-overview.md` 로 이동하거나 두 절 통합하여 중복 제거 |
| 3 | Convention Compliance | `14-execution-history.md` 목록 API 응답 예시의 paginated 래퍼가 Swagger 컨벤션 `ApiOkPaginatedResponse` 이중 래핑 구조와 불일치 | `spec/2-navigation/14-execution-history.md §5` | `spec/conventions/swagger.md §5-2` `ApiOkPaginatedResponse` 스키마 (`{ data: { data: [], pagination: {} } }`) | `ExecutionsController` 응답 구조 확인 후 (a) 구현이 flat 이면 swagger 주석 정정, (b) 이중 래핑이면 spec 예시 수정. 어느 쪽이 SoT 인지 명시 |
| 4 | Naming Collision | `token_expired` (Integration.status_reason DB 슬러그 신규)가 JWT 에러 코드 `TOKEN_EXPIRED` (REST 401) 및 계획 WS 이벤트 `auth.token_expired` 와 표기 유사 | `codebase/backend/src/modules/integrations/integration-status-reason.ts`, `spec/1-data-model.md §2.10` | `spec/5-system/3-error-handling.md` line 35, `spec/5-system/14-external-interaction-api.md` line 315, `spec/5-system/6-websocket-protocol.md` line 739 | `spec/5-system/6-websocket-protocol.md §4.5` 의 `auth.token_expired` 계획 항목에 "이 WS 이벤트명이 `Integration.status_reason='token_expired'` (DB 슬러그)와 무관함" 크로스 주석 추가 (필수 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/4-nodes/4-integration/5-makeshop.md` 에 `isCafe24RefreshCapable` 구 표기 잔존 가능성 | `spec/4-nodes/4-integration/5-makeshop.md` | 구 용어 잔존 여부 점검 후 `isRefreshCapable` 로 동기화 |
| 2 | Cross-Spec | `spec/data-flow/5-integration.md §3.2` `token_expired` 추가 — `spec/1-data-model.md §2.10` 과 대칭 완료 | `spec/data-flow/5-integration.md §3.2` | 추가 조치 불필요 |
| 3 | Cross-Spec | `spec/2-navigation/4-integration.md §11.1` 알림 발사 대상 축소 — `_product-overview.md` NAV-IN-* 요구사항 충돌 없음 | `spec/2-navigation/4-integration.md §11.1` | 추가 조치 불필요 |
| 4 | Rationale Continuity | `spec/data-flow/8-notifications.md` (origin/main) 구 Rationale "사용자 가시성 유지"를 번복하는 설명이 target Rationale 에 명시되지 않음 | `spec/2-navigation/4-integration.md` Rationale `isRefreshCapable` 항 | Rationale 에 "이전 spec 의 사용자 가시성 유지 이유가 refresh-capable provider 에서는 false alarm 이므로 기각" 한 줄 추가 권장 |
| 5 | Rationale Continuity | `unknown_error` 슬러그 변경이 기존 DB 행에 미치는 영향이 Rationale 에 불명시 | `spec/2-navigation/4-integration.md`, `spec/1-data-model.md` | Rationale 에 "기존 DB 행에 `unknown` 값 없음(미구현 경로)" 한 줄 추가 권장 |
| 6 | Rationale Continuity | `isRefreshCapable` makeshop 포함 — 이전 "구현 갭" 상태 해소, Rationale 신설로 완결 | `spec/2-navigation/4-integration.md §11.1` | 추가 조치 불필요 |
| 7 | Convention Compliance | `16-agent-memory.md` frontmatter `id: nav-agent-memory` — 파일명 기반 권장값 `agent-memory` 와 불일치 | `spec/2-navigation/16-agent-memory.md` | 다른 문서 참조 여부 확인 후 `id: agent-memory` 로 변경 권장 |
| 8 | Convention Compliance | `15-system-status.md` — `## Overview` 또는 `## 1. 개요` 절 없이 `## Rationale` 만 존재 | `spec/2-navigation/15-system-status.md` | 서두 문장을 `## 1. 개요` 로 승격 권장 (우선순위 낮음) |
| 9 | Convention Compliance | `10-auth-flow.md` `invitation_not_found` 등 lower_snake_case — error-codes.md §3 Historical-artifact 예외 레지스트리 등재로 정상 | `spec/2-navigation/10-auth-flow.md §2.6` | 해당 코드 언급 시 "historical artifact, 예외 레지스트리 참조" 주석 추가 선택사항 |
| 10 | Plan Coherence | `integration_action_required` 알림 "향후 신설 검토" → "결정·구현 완료" 격상 — plan `integration-expiry-fixes.md` 근거 있음 | `spec/2-navigation/4-integration.md §11.2 Rationale` | 추가 조치 불필요 |
| 11 | Plan Coherence | `spec-sync-structural-followups.md` §C 항목의 `integration_action_required` 참조가 본 결정으로 해소됐는지 확인 미완 | `plan/in-progress/spec-sync-structural-followups.md` | 플래너가 점검 후 해당 항목 체크 처리 권장 |
| 12 | Plan Coherence | `node-output-redesign/database-query.md` 가 `unknown` 에러 코드 열거를 포함할 경우 `unknown_error` 로 갱신 필요 | `plan/in-progress/node-output-redesign/database-query.md` | 담당자에게 변경 인지 요청 |
| 13 | Plan Coherence | Stale worktree `spec-sync-audit`, `spec-sync-audit-998544` — 다수 plan frontmatter 에서 참조되나 branch 미존재 | `plan/in-progress/spec-sync-*.md` 다수 | `cleanup-worktree-all.sh --yes --force` 실행 또는 stale plan 정리 권장 |
| 14 | Naming Collision | `isRefreshCapable` — module-scope private 함수 rename, 외부 export 없음, 충돌 없음 | `integration-expiry-scanner.service.ts` line 531 | 추가 조치 불필요 |
| 15 | Naming Collision | `unknown_error` spec 표기 통일 — `spec/2-navigation/4-integration.md:488` 까지 완료, 잔존 불일치 없음 | `spec/1-data-model.md`, `spec/2-navigation/4-integration.md §5.4` | 추가 조치 불필요 |
| 16 | Naming Collision | `MAKESHOP_REFRESH_QUEUE` in `MONITORED_QUEUES` — 큐 이름 중복 없음, e2e 동기 완료 | `system-status.constants.ts`, `system-status.e2e-spec.ts` | 추가 조치 불필요 |
| 17 | Naming Collision | `integration_action_required` — 기존 정의 그대로, 신규 도입 아님, 충돌 없음 | `spec/1-data-model.md`, `spec/data-flow/8-notifications.md` | 추가 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `unknown_error` 갱신 범위가 `spec/5-system/`·`spec/conventions/` 에서 미확인(WARNING). 나머지 spec 간 동기 양호 |
| Rationale Continuity | LOW | passive 알림 제외 번복 시 구 근거 반박 문장 미기재(INFO), `unknown_error` DB 영향 범위 Rationale 미명시(INFO) |
| Convention Compliance | LOW | `14-execution-history.md` 이중 개요 구조(WARNING) + paginated 래퍼 불일치(WARNING). 나머지 규약 준수 양호 |
| Plan Coherence | NONE | worktree 충돌 0건, 미해결 결정 우회 없음. stale worktree 정리 권장(INFO) |
| Naming Collision | LOW | `token_expired` ↔ `TOKEN_EXPIRED` / `auth.token_expired` 표기 유사성(WARNING). 실질 충돌 없음 |

## 권장 조치사항

1. **(WARNING #1 — 범위 완결)** `spec/5-system/` 및 `spec/conventions/` 에서 `status_reason` 값으로 `unknown` 을 명시하는 문서를 점검하여 `unknown_error` 로 동기화한다.
2. **(WARNING #3 — SoT 명확화)** `ExecutionsController` 실제 paginated 응답 구조 확인 후 `spec/2-navigation/14-execution-history.md §5` JSON 예시 또는 `spec/conventions/swagger.md §5-2` 중 하나를 정합하고 SoT 를 명시한다.
3. **(WARNING #2 — 구조 정리)** `spec/2-navigation/14-execution-history.md` 의 `## Overview (제품 정의)` 절을 `_product-overview.md` 로 이동하거나 `## 1. 개요` 와 통합하여 이중 개요 제거.
4. **(INFO #1 — 용어 동기)** `spec/4-nodes/4-integration/5-makeshop.md` 에서 `isCafe24RefreshCapable` 구 표기 잔존 여부 확인 후 `isRefreshCapable` 로 동기화.
5. **(INFO #4, #5 — Rationale 보완)** `spec/2-navigation/4-integration.md` Rationale 에 (a) 이전 "사용자 가시성 유지" 근거 기각 이유, (b) `unknown_error` DB 행 영향 없음(`unknown` 값 기존 미삽입 경로였음) 한 줄씩 추가.
6. **(INFO #11, #12 — 후속 plan 동기)** `plan/in-progress/spec-sync-structural-followups.md` §C 항목 중 `integration_action_required` 해소 체크 + `plan/in-progress/node-output-redesign/database-query.md` 담당자에게 `unknown_error` 변경 인지 요청.
7. **(INFO #13 — 환경 정리)** stale worktree `spec-sync-audit`, `spec-sync-audit-998544` 참조 plan 을 정리하거나 `cleanup-worktree-all.sh --yes --force` 실행.