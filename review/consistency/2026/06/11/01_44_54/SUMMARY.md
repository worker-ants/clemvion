# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — `unknown`/`unknown_error` 이중값 혼재 가능성(spec 내부 모순 + DB fallback 불일치)이 주요 위험. 나머지 항목은 LOW/NONE.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Naming Collision | `unknown_error` 교체가 `spec/1-data-model.md §2.10` 및 `integrations.service.ts` fallback 에 미반영 — spec 내부 모순 + DB 에 `unknown`/`unknown_error` 혼재 가능 | `spec/2-navigation/4-integration.md §5.4` (line 488) | `spec/1-data-model.md:293` (`unknown` 잔존), `codebase/backend/src/modules/integrations/integrations.service.ts:880,898` (`'unknown'` fallback), `.spec.ts:1891` | (1) `spec/1-data-model.md §2.10` 허용값 `unknown` → `unknown_error` 갱신. (2) `integrations.service.ts:880,898` fallback 교체. (3) 테스트 픽스처 동일 교체 |
| W-2 | Naming Collision | `isRefreshCapable` (spec) vs `isCafe24RefreshCapable` (구현) — 함수명 불일치로 추적성 저하 | `spec/2-navigation/4-integration.md §11.1` | `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts:515` | 구현 함수를 `isRefreshCapable` 로 rename 하거나 spec 에 `"현재 구현명: isCafe24RefreshCapable"` 주석 추가 |
| W-3 | Convention Compliance | `spec/2-navigation/14-execution-history.md` — `## Overview (제품 정의)` 최상위 섹션과 기술 명세 본문(`## 1.`)이 동일 파일에 중첩, 다른 파일과 구조 불일치 | `14-execution-history.md` line 18 | 동일 폴더 내 다른 spec 파일들 (단일 계층 구조) | `## Overview (제품 정의)` 블록을 `_product-overview.md` 관련 섹션으로 이동하거나 `## 1. 개요` 에 통합 |
| W-4 | Convention Compliance | `spec/2-navigation/14-execution-history.md §5` API 응답 예시 — `{ data: [...], pagination: {...} }` 형태가 TransformInterceptor 이중 래핑 여부와 불일치 가능 | `14-execution-history.md §5` (line 약 1655–1687) | `spec/conventions/swagger.md §5-2` (`ApiOkPaginatedResponse` 이중 래핑), `spec/5-system/2-api-convention.md §5.2` | `api-convention.md §5.2` 예시가 wire-format 인지 서비스 레이어 shape 인지 명확히 하고, 인라인 예시를 실제 클라이언트 수신 포맷에 맞게 조정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `status_reason='unknown_error'` 명칭 변경 — 동기적으로 갱신된 3개 파일 모두 일관 | `spec/2-navigation/4-integration.md §5.4`, `spec/1-data-model.md §2.10`, `spec/data-flow/5-integration.md §3.2` | 추가 조치 불필요 (단, W-1 과 연계해 코드베이스 fallback 갱신 필요) |
| I-2 | Cross-Spec | `isRefreshCapable` 판별 로직 — 양쪽 spec 정의 일치, `makeshop` spec 기존 기술과도 모순 없음 | `spec/2-navigation/4-integration.md §11.1`, `spec/data-flow/5-integration.md §1.4` | 추가 조치 불필요 |
| I-3 | Cross-Spec | `token_expired` 네임스페이스 충돌 주의 주석 추가됨 — 기능적 충돌 없음 | `spec/1-data-model.md §2.10` | 선택적으로 `spec/5-system/1-auth.md` 에 역참조 주석 추가 가능 |
| I-4 | Cross-Spec | `integration_expired` 알림 발사 대상 범위 변경 — 양 spec 파일 동기적 갱신 완료 | `spec/2-navigation/4-integration.md §11.2`, `spec/data-flow/8-notifications.md` | 추가 조치 불필요 |
| I-5 | Rationale Continuity | `error(*)` 알림 번복 — 구 Rationale "향후 신설 검토" 방향을 확정한 것, Rationale 동시 교체됨 | `spec/2-navigation/4-integration.md §10.5`, §Rationale | 추가 조치 불필요. 단, `spec/5-system/` 알림 spec 에 `integration_action_required` 등록 여부 확인 권장 |
| I-6 | Rationale Continuity | `unknown` → `unknown_error` 코드명 변경 — Rationale 기록 없음 (기각 이력도 없는 단순 통일) | `spec/2-navigation/4-integration.md §5.4` | Rationale 에 한 줄 추가 권장: "§5.4 PostgreSQL error.code — unknown → unknown_error 로 통일" |
| I-7 | Rationale Continuity | cafe24 `integration_expired` passive 알림 제거 — Rationale 근거 제공되나 cafe24 측 정책 번복이 명시적으로 분리되지 않음 | `spec/2-navigation/4-integration.md §11` | Rationale `isRefreshCapable — makeshop 포함 결정` 항에 cafe24 임계치 알림 제거 명시 추가 권장 |
| I-8 | Convention Compliance | `spec/2-navigation/15-system-status.md`, `16-agent-memory.md` — `## Overview` 섹션 부재 | 각 파일 상단 | 강제 아님. 일관성을 위해 `## Overview` 추가 권장 |
| I-9 | Convention Compliance | `spec/2-navigation/14-execution-history.md §5` sort 기본값 `started_at` — API 규약 §4.1 기본값(`created_at`) 과 다름 | `14-execution-history.md §5` 쿼리 파라미터 표 | Rationale 에 의도적 예외 명시 권장 |
| I-10 | Convention Compliance | `spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory` — 동일 폴더 다른 파일의 prefix-less slug 패턴과 불일치 | `16-agent-memory.md` frontmatter | 도구 영향 없으면 `agent-memory` 로 통일 고려 |
| I-11 | Convention Compliance | `spec/2-navigation/10-auth-flow.md §5.4` OAuth 에러 코드(`invalid_state` 등) — `lower_snake_case` 이나 `error-codes.md §3` 예외 레지스트리 미등록 | `10-auth-flow.md §5.4` | 클라이언트 분기에 사용 중이면 예외 레지스트리 등록; 미사용이면 UPPER_SNAKE_CASE 로 정규화 |
| I-12 | Plan Coherence | `spec-code-cross-audit-2026-06-10.md` V-01 (makeshop expired 오격하) — spec 및 코드 양쪽에서 이번 branch 로 해소됐으나 plan 문서에 해소 메모 미반영 가능 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-01 항목 | merge 후 V-01 해소 처리 |
| I-13 | Plan Coherence | `spec-sync-workflow-list-gaps.md` frontmatter `worktree: spec-sync-audit` — 물리 worktree 미존재, stale sentinel | `plan/in-progress/spec-sync-workflow-list-gaps.md` frontmatter | plan frontmatter `worktree: spec-sync-audit` 기재 정리 권장 |
| I-14 | Naming Collision | `integration_action_required` — 기존 정의와 충돌 없음. passive/active 분리 명문화 | `spec/2-navigation/4-integration.md §11.2` | 조치 불필요 |
| I-15 | Naming Collision | `token_expired` as `status_reason` — 기존 값 의미 강화, 충돌 없음 | `spec/2-navigation/4-integration.md §11.1` | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 4개 변경 spec 파일 간 모두 동기화 완료. 인접 미변경 spec 과도 모순 없음 |
| Rationale Continuity | LOW | 3개 주요 번복 모두 Rationale 근거 보유. `unknown_error` 코드명 변경 Rationale 기록 누락(단순 통일) |
| Convention Compliance | LOW | 문서 구조 이중 계층(`14-execution-history.md`), API 응답 예시 이중 래핑 불명확 (WARNING 2건). CRITICAL 없음 |
| Plan Coherence | NONE | 진행 중 plan 과 충돌 없음. active worktree 간 파일 충돌 없음. V-01 plan 해소 기록 누락(INFO) |
| Naming Collision | MEDIUM | `unknown`/`unknown_error` DB 혼재 위험, `isRefreshCapable`/`isCafe24RefreshCapable` 추적성 저하 (WARNING 2건) |

## 권장 조치사항

1. **(BLOCK 해소 대상 없음)** — Critical 없으므로 차단 없이 진행 가능.
2. **(W-1 우선 — 데이터 정합)** `spec/1-data-model.md §2.10` 의 `status_reason` 허용값 `unknown` → `unknown_error` 갱신, `integrations.service.ts:880,898` fallback 문자열 교체, `integrations.service.spec.ts:1891` 픽스처 교체. DB 에 두 값이 혼재하지 않도록 이번 branch 내 또는 직후 후속 커밋으로 처리.
3. **(W-2)** `integration-expiry-scanner.service.ts:515` 의 `isCafe24RefreshCapable` → `isRefreshCapable` rename, 또는 spec 에 현재 구현명 주석 추가.
4. **(W-3 / W-4)** `14-execution-history.md` 문서 구조 정리 및 API 응답 예시 wire-format 명확화 — 이번 branch 범위 외 파일이므로 별도 후속 정리 티켓 권장.
5. **(I-6 / I-7)** Rationale 에 `unknown_error` 통일 한 줄 및 cafe24 passive 알림 제거 명시 추가 (선택 권장, 차단 아님).
6. **(I-12)** merge 후 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-01 해소 처리.