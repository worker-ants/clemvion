# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 기존 spec drift 2건이 plan 에 인식·기록된 상태로 planner 후속 미처리 중. 신규 충돌 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Plan-Coherence | `INTEGRATION_INVALID_SERVICE (400)` 에러 코드가 `previewTest` 경로까지 공식 발행 경로로 확장됐으나 API 명세에 미등재 | `spec/2-navigation/4-integration.md §9.4` | `spec/conventions/error-codes.md` + `spec/5-system/3-error-handling.md §1` | project-planner 가 `§9.4` 에 `INTEGRATION_INVALID_SERVICE (400) — 미지원 serviceType/authType 조합` 추가. `spec/5-system/3-error-handling.md §1` 갱신 확인. plan 체크박스 추적 후 spec 갱신 |
| 2 | Cross-Spec / Plan-Coherence | `POST /api/integrations/preview-test` 요청 바디 필드명 — spec `{ service, authType, credentials }` vs DTO `{ serviceType, authType, credentials }` | `spec/2-navigation/4-integration.md §9.2` | `codebase/backend/src/modules/integrations/dto/integration.dto.ts` `PreviewTestDto.serviceType` | project-planner 가 `§9.2` 의 `service` → `serviceType` 으로 정정. plan 의 해당 체크박스(`[ ]`) 선행 처리 필요 |
| 3 | Rationale-Continuity | `spec/2-navigation/2-trigger-list.md §R-2` 가 R-14 + `spec/5-system/12-webhook.md` 에 의해 폐기된 `config.hmacSecret` 인라인 경로 및 `/auth/rotate-secret` v1.1 예약을 v1 valid 계약으로 계속 문서화 | `spec/2-navigation/2-trigger-list.md` — `### R-2` (L226–234) | `### R-14` (L308–315), `spec/5-system/12-webhook.md § inline auth path 폐지` (L419–430) | R-2 를 삭제하거나 "폐기 — R-14 와 `spec/5-system/12-webhook.md` 로 대체됨" 으로 갱신. v1.1 TBD 주석도 함께 제거 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale-Continuity | R-2 가 EIA outbound notification secret 과 inbound webhook auth secret 을 혼동시키는 근거 인용 잔존 | `spec/2-navigation/2-trigger-list.md §R-2` L230 | R-2 삭제 시 함께 해소. 유지 시 inbound/outbound 구분 명시 추가 |
| 2 | Convention-Compliance | `14-execution-history.md` 의 `## Overview (제품 정의)` 인라인 포함이 영역 내 다른 14개 파일의 `_product-overview.md` 위임 패턴과 비일관 | `spec/2-navigation/14-execution-history.md` 상단 | 현행 유지 가능(허용된 패턴). 일관성 원하면 요구사항·배경·목표를 `_product-overview.md §3.x` 로 이동 |
| 3 | Convention-Compliance | `15-system-status.md` · `16-agent-memory.md` — 공식 `## Overview` 섹션 부재 | `spec/2-navigation/15-system-status.md`, `spec/2-navigation/16-agent-memory.md` | 권장 사항. `## Overview` 섹션 추가 시 다른 spec 문서와 일관성 향상 |
| 4 | Convention-Compliance | `0-dashboard.md §Rationale` — 메타 주석 blockquote 가 결정 근거 섹션에 위치 | `spec/2-navigation/0-dashboard.md` `## Rationale` 첫 줄 | `## Note` 또는 관련 절 각주로 이동 |
| 5 | Naming-Collision | `validateServiceAuthType` (신규 public) 및 `INTEGRATION_INVALID_SERVICE` (발행 위치 이동) — 충돌 없음 확인 | `integrations.service.ts` line 1408 | 조치 불필요 |
| 6 | Plan-Coherence | m-1 구현이 `spec/2-navigation/` 내 다른 미결정 항목(`spec-sync-integration-common-gaps.md`, `spec-sync-workflow-list-gaps.md`)을 침범하지 않음 | 구현 변경 전체 | 추적 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 기존 spec drift 2건(`§9.4` 에러코드 미등재, `§9.2` 필드명 불일치) 노출 표면 확장. 신규 충돌 없음 |
| Rationale-Continuity | LOW | R-2 가 R-14 + webhook spec 에 의해 폐기된 inline auth 설계를 유효 계약으로 잔존 문서화 |
| Convention-Compliance | NONE | 직접 규약 위반 없음. INFO 4건은 문서 구조 일관성 권장 사항 |
| Plan-Coherence | LOW | plan 이 인식·기록한 planner 후속 2건(§9.2 필드명, §9.4 에러코드)이 체크박스 열린 채 미처리 |
| Naming-Collision | NONE | 충돌 없음. 유일한 식별자 변경(`validateServiceAuthType` rename)은 코드베이스 내 중복 없음 |

## 권장 조치사항
1. (BLOCK 해소 없음 — Critical 없음)
2. **[WARNING-1, WARNING-2 — project-planner]** `spec/2-navigation/4-integration.md §9.4` 에 `INTEGRATION_INVALID_SERVICE (400) — 미지원 serviceType/authType 조합` 추가 및 `§9.2` 의 `service` → `serviceType` 정정. `plan/in-progress/refactor/02-architecture.md §m-1` planner 후속 체크박스 추적 선행 후 진행.
3. **[WARNING-3 — project-planner]** `spec/2-navigation/2-trigger-list.md §R-2` 를 삭제하거나 R-14·`spec/5-system/12-webhook.md` 폐기 결정을 참조하는 내용으로 대체. v1.1 TBD 주석 함께 제거.
4. **[INFO]** Convention-Compliance INFO 항목(Overview 구조 비일관, Rationale 메타 주석)은 팀 판단에 따라 선택적 개선.