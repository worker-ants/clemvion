# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — pre-existing spec drift 2건(WARNING)이 잔존하나 이번 구현이 신설한 것이 아님. 이미 plan 에서 추적 중.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Plan-Coherence | `preview-test` 요청 바디 필드명 spec drift — spec 은 `service`, 실제 DTO 는 `serviceType` | `spec/2-navigation/4-integration.md §9.2` | `integration.dto.ts` line 161 `PreviewTestDto.serviceType` | project-planner 가 `§9.2` 의 `service` → `serviceType` 으로 정정. `plan/in-progress/refactor/02-architecture.md §m-1` planner 체크박스 닫기 |
| 2 | Cross-Spec / Plan-Coherence | `INTEGRATION_INVALID_SERVICE (400)` 에러 코드 spec 미등재 — `previewTest()` 경로까지 공식 발행 경로로 확장됐으나 spec/에러코드 레지스트리 미반영 | `spec/2-navigation/4-integration.md §9.4`, `spec/conventions/error-codes.md` | `integrations.service.ts` line 1413 `INTEGRATION_INVALID_SERVICE` | project-planner 가 `§9.4` 에 `INTEGRATION_INVALID_SERVICE (400) — 미지원 serviceType/authType 조합` 추가 및 `spec/conventions/error-codes.md` 동시 등재 |

> 주: WARNING 1·2 모두 이번 구현 이전부터 존재하던 pre-existing drift. 이번 `m-1` 변경이 신설한 것이 아니라 노출 표면이 확정된 것. `plan/in-progress/refactor/02-architecture.md §m-1` planner 후속 체크박스로 이미 추적 중.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/2-navigation/2-trigger-list.md §R-2` 가 폐기된 `config.hmacSecret` 인라인 경로 및 `/auth/rotate-secret` v1.1 예약을 유효 계약으로 잔존 | `spec/2-navigation/2-trigger-list.md §R-2` | `plan/in-progress/auth-config-webhook-followups.md §3` 처리 시 §R-2 를 삭제하거나 "폐기 — §R-14·webhook spec 대체" 로 갱신 |
| 2 | Cross-Spec / Convention-Compliance | `spec/2-navigation/14-execution-history.md` 에 PRD 성격 Overview 섹션 인라인 포함 — 나머지 파일의 `_product-overview.md` 위임 패턴과 불일치 | `spec/2-navigation/14-execution-history.md` 상단 `## Overview (제품 정의)` | 의도된 구조라면 Rationale 에 근거 추가 권장. 기능 충돌 없음 |
| 3 | Cross-Spec | `spec/2-navigation/15-system-status.md`, `16-agent-memory.md` 에 표준 `## Overview` 섹션 부재 | 해당 파일 상단 | 권장 사항. 기능 충돌 없음 |
| 4 | Plan-Coherence | `spec/2-navigation/1-workflow-list.md` `pending_plans` 가 가리키는 태그 필터·폴더 필터·빈 상태 마켓플레이스 링크 3건이 이번 구현과 무관함 확인 | `plan/in-progress/spec-sync-workflow-list-gaps.md` | 조치 불필요 |
| 5 | Plan-Coherence | `ai-agent-tool-connection-rewrite.md` 미결정 사항(5건) 이번 구현과 무관함 확인 | `plan/in-progress/ai-agent-tool-connection-rewrite.md` | 조치 불필요 |
| 6 | Naming-Collision | `validateServiceAuthType` rename — `validateServiceAndAuth` (main) 대비 의미 더 명확, `private` 이므로 외부 충돌 없음 | `integrations.service.ts:1409` | 없음. rename 완전 적용 확인 |
| 7 | Convention-Compliance | `spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory` — `spec-impl-evidence.md §2.1` 이 명시적으로 허용하는 영역 prefix 충돌 회피 패턴 | `spec/2-navigation/16-agent-memory.md` | 위반 없음. 확인 완료 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건(필드명 drift, 에러코드 미등재) — pre-existing, INFO 3건 |
| Rationale-Continuity | NONE | 기각된 대안 재도입 없음. 계획대로 레이어 정렬 구현 확인 |
| Convention-Compliance | NONE | CRITICAL/WARNING 없음. INFO 5건 모두 기능 충돌 없음 |
| Plan-Coherence | LOW | WARNING 1건(plan 에 이미 인지된 spec drift planner 후속 미처리). 신규 선행 미해소 없음 |
| Naming-Collision | NONE | 신규 식별자 1건(`private validateServiceAuthType`), 외부 충돌 없음 |

## 권장 조치사항

1. **(BLOCK 해소 사유 없음 — 차단 없음)** 이번 `m-1` 변경은 Critical 위배 없이 진행 가능.
2. **(WARNING 해소 — planner 후속)** project-planner 가 `spec/2-navigation/4-integration.md §9.2` 의 `service` → `serviceType` 필드명 정정 및 `§9.4` 에 `INTEGRATION_INVALID_SERVICE (400)` 에러 코드 추가. `spec/conventions/error-codes.md` 동시 등재. `plan/in-progress/refactor/02-architecture.md §m-1` planner 체크박스 닫기.
3. **(INFO — 비차단 후속)** `spec/2-navigation/2-trigger-list.md §R-2` 폐기 처리는 `plan/in-progress/auth-config-webhook-followups.md §3` 처리 시 함께 진행.
4. **(긍정 확인)** `validateServiceAuthType private` 이관·중복 메서드 제거로 이전 fresh-review Warning("controller 의 service-registry 직접 의존") 해소 확인. `spec/5-system/1-auth.md` service-layer-first 원칙과 정합.