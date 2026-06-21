# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — pre-existing spec drift 2건(WARNING 1, INFO 다수)이 존재하나, 이번 m1 변경이 신설한 Critical 위배는 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 해당 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `preview-test` 요청 바디 필드명 불일치 — spec `service` vs 코드 `serviceType` (pre-existing drift) | `spec/2-navigation/4-integration.md §9.2` 표 `POST /api/integrations/preview-test` 행 | `integration.dto.ts` `PreviewTestDto.serviceType` (line 161); `spec/data-flow/5-integration.md §1.1` `service_type` 표기 | `spec/2-navigation/4-integration.md §9.2` 의 `body: { service, authType, credentials }` → `body: { serviceType, authType, credentials }` 로 갱신 (planner 위임) |
| 2 | Naming Collision | `validateServiceAuthType` (신규 public) vs 기존 `validateServiceAndAuth` (private) — 동일 로직 중복 공존 | `integrations.service.ts` line 933 (`validateServiceAuthType`) | 동일 파일 line 1411 (`validateServiceAndAuth`) | `validateServiceAndAuth` 를 `validateServiceAuthType` 으로 통합(rename + public 승격)하거나, public 에서 private 를 위임 호출해 중복 제거 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Rationale / Naming | `INTEGRATION_INVALID_SERVICE` 에러 코드가 `spec/2-navigation/4-integration.md §9.4` 및 `spec/conventions/error-codes.md` 에 미등재 (pre-existing, 이번 PR 이 신설한 것 아님) | `integrations.service.ts` `validateServiceAuthType()` | planner 가 별도 spec 작업으로 `INTEGRATION_INVALID_SERVICE (400)` 등재 예약 |
| 2 | Plan Coherence | `INTEGRATION_INVALID_SERVICE` 등재 작업이 `refactor/02-architecture.md §m-1` 에 planner 독립 트랙으로 언급되나 명시적 체크박스 미추가 → 유실 위험 | `plan/in-progress/refactor/02-architecture.md §m-1` | 체크박스 항목으로 명시화하거나 별도 plan 항목 신설 |
| 3 | Rationale Continuity | `spec/2-navigation/2-trigger-list.md` R-2(rotate-secret v1.1 예약) vs R-14(폐기 선언) 서술 모순 (pre-existing, 이번 PR 과 무관) | `spec/2-navigation/2-trigger-list.md` Rationale R-2 vs R-14 | R-2 의 예약 표기를 삭제하거나 R-14 폐기 clarification 추가 (planner 작업) |
| 4 | Convention Compliance | `spec/2-navigation/14-execution-history.md` — PRD + spec 혼합 구조 (Overview 섹션 이중 존재) | `14-execution-history.md` lines 18, 75 | `## Overview (제품 정의)` 블록을 `_product-overview.md` 로 이동하거나 예외 근거를 Rationale 에 기록 |
| 5 | Convention Compliance | `spec/2-navigation/15-system-status.md`, `2-trigger-list.md`, `16-agent-memory.md` — Overview/개요 섹션 누락 | 해당 파일 각각 | `## 1. 개요` 섹션 추가 또는 의도적 예외를 Rationale 에 기록 |
| 6 | Plan Coherence | `spec-sync-workflow-list-gaps.md`, `spec-sync-user-profile-gaps.md` 미완료 항목 — 본 변경과 도메인 분리, 직접 충돌 없음 | `spec/2-navigation/1-workflow-list.md`, `9-user-profile.md` | 후속 frontend PR 에서 별도 해소 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `preview-test` 바디 필드명 spec drift (pre-existing WARNING 1건); m1 이관 방향은 data-flow spec 과 정합 |
| Rationale Continuity | NONE | 모든 Rationale 저촉 없음; 2건 INFO 는 기존 부채 |
| Convention Compliance | NONE | build-time 가드 위반 없음; 형식 일관성 제안 4건 INFO |
| Plan Coherence | LOW | m-1 Option A 이행 완료; `INTEGRATION_INVALID_SERVICE` 체크박스 미명시 추적 필요 |
| Naming Collision | LOW | `validateServiceAuthType` vs `validateServiceAndAuth` 동일 로직 중복 WARNING 1건; 에러 코드 spec 미등재 INFO 1건 |

## 권장 조치사항

1. **(WARNING 해소 — 이번 PR 또는 직후 planner 위임)** `spec/2-navigation/4-integration.md §9.2` 의 `preview-test` 요청 바디 필드명을 `serviceType` 으로 수정해 DTO 현실과 동기화.
2. **(WARNING 해소 — 이번 PR 또는 직후 developer 작업)** `integrations.service.ts` 의 `validateServiceAndAuth` (private) 를 제거하고 `validateServiceAuthType` (public) 으로 일원화하거나 위임 호출 구조로 변경해 중복 로직 제거.
3. **(INFO — planner 별도 트랙)** `spec/2-navigation/4-integration.md §9.4` 및 `spec/conventions/error-codes.md` 에 `INTEGRATION_INVALID_SERVICE (400)` 항목 추가; `refactor/02-architecture.md §m-1` 에 체크박스로 추적 명시.
4. **(INFO — planner 비차단)** `spec/2-navigation/2-trigger-list.md` R-2 vs R-14 모순 해소.
5. **(INFO — planner 비차단)** `spec/2-navigation/` 파일 구조 형식 정합: `14-execution-history.md` PRD 분리, `15-system-status.md`·`2-trigger-list.md`·`16-agent-memory.md` 개요 섹션 추가.