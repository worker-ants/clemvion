# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, CRITICAL 0건)

## 전체 위험도
**LOW** — 5개 checker 모두 CRITICAL/WARNING 없음. plan 문서 간 완료표시 선행(INFO) 1건만 확인 필요.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | MakeShop 403 처리가 §5.9 "정책 동일" 서술과 달리 `CAFE24_INSUFFICIENT_SCOPE` 대응 코드가 없음(사전 존재하던 간극, 이번 PR 이 유발하지 않음) | `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` (`MakeshopPingCode`) vs `spec/2-navigation/4-integration.md` §5.9 | 차단 사유 아님. 다음 §5.9 편집 시 "정책 동일" 범위를 401 재시도/counter 제외로 좁히거나 makeshop 403 문구 별도 명시 (project-planner 소관) |
| 2 | convention_compliance | 신규 닫힌 union(`IntegrationTestResultCode`)이 형제 Swagger DTO(`TestConnectionResultDto.code`)에는 반영 안 됨 | `codebase/backend/src/modules/integrations/integrations.service.ts` vs `dto/responses/integration-response.dto.ts` | swagger.md 가 기존 필드 소급 갱신을 요구하지 않아 위반 아님. 다음에 이 DTO 를 건드릴 때 `enum: Object.values(CONNECTION_TEST_CODES)` 로 좁히면 좋음 |
| 3 | convention_compliance | `CONNECTION_TEST_CODES` 상수 식별자가 SCREAMING_SNAKE_CASE (형제 대표 surface `ErrorCode`/`EngineErrorCode` 는 PascalCase) | `codebase/backend/src/modules/integrations/connection-test-codes.ts:16` | 규약 위반 아님(기존 `AUDIT_ACTIONS`/`MCP_ERROR_CODES` 선례와 동일 스타일). 식별자 케이싱 통일은 별도 리팩터 논의 대상 |
| 4 | plan_coherence | 완료 표시가 실제 plan 이동보다 앞섬 — 트래커가 이미 `[x]` 해소·`plan/complete/connection-test-codes-and-gaps.md` 로 인용하지만 실제 파일은 아직 `plan/in-progress/`에 있고 그 plan 자신의 `--impl-done`/이동 체크박스도 미체크 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (~4853, ~4862) vs `plan/in-progress/connection-test-codes-and-gaps.md` | finalize 커밋에서 `connection-test-codes-and-gaps.md` 를 실제로 `plan/complete/` 로 이동하는 것을 빠뜨리지 않을 것 — 누락 시 트래커 링크가 깨진 경로를 가리킴 |
| 5 | plan_coherence | spec 문서화 갭(§5.3/§14.1 이 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 를 누락) 발견 즉시 developer 가 직접 고치지 않고 planner 몫 후속 트래커에 정상 등재 | `spec/2-navigation/4-integration.md` §5.3(476-483)·§14.1(1100-1122) | 조치 불필요 — 정상 절차 확인, 다음 planner 턴에서 반영 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 도입 union 전 멤버가 spec §5.3/§5.4/§5.5/§5.8/§5.9/§9.1/§14.1·MCP §8.2 와 값·의미 1:1 일치. MakeShop 403 표현 간극은 사전 존재, INFO |
| rationale_continuity | NONE | 기존 Rationale(코드 집합·namespace 구분·게이트 분류)을 타입으로 강화하는 순수 리팩터. 결정 번복·기각 대안 재도입 없음 |
| convention_compliance | NONE | error-codes.md 명명·UPPER_SNAKE_CASE·도메인 prefix 전부 준수. Swagger DTO 소급 미반영·상수 케이싱은 INFO(위반 아님) |
| plan_coherence | LOW | spec 델타 0 은 `spec_impact: none` 과 일치. plan 완료표시가 실제 이동보다 선행(INFO, finalize 커밋에서 확인 필요) |
| naming_collision | NONE | 신규 TS 식별자(상수·타입·파일명) 전역 충돌 없음. 코드 값은 기존 wire 값 재사용, namespace 중복은 spec 에 이미 문서화된 의도된 설계 |

## 권장 조치사항
1. finalize 커밋 시 `plan/in-progress/connection-test-codes-and-gaps.md` 를 실제로 `plan/complete/` 로 이동하여 `spec-draft-nullable-notation-followups.md` 의 선행 완료 표시·경로 인용과 정합시킬 것 (INFO #4).
2. 이번 PR 자체는 조치 불필요 — CRITICAL/WARNING 없음, 병합 가능.
3. (참고, 이번 PR 스코프 아님) 다음 §5.9 또는 `TestConnectionResultDto` 편집 기회에 INFO #1·#2 를 함께 정리하면 좋음.
