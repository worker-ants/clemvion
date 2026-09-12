# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음 (cross_spec=NONE, rationale_continuity=NONE, convention_compliance=LOW, plan_coherence=LOW, naming_collision=NONE). 전문 확보 못 한 checker 없음.

## 전체 위험도
**LOW** — 신규 식별자 충돌·Rationale 번복·spec 간 모순은 없으며, 유일한 실질 발견은 `rotateBotToken` swagger 데코레이터 완결성(코드 레벨) WARNING 1건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance, cross_spec | `rotateBotToken` 엔드포인트가 swagger.md §5-4 "경로 UUID 파라미터 `@ApiParam({format:'uuid'})` 일관 적용" 체크리스트를 어김 — `ParseUUIDPipe`뿐 아니라 `@ApiParam` 데코레이터도 부재, `@ApiBadRequestResponse` 설명도 `VALIDATION_ERROR`(malformed UUID) 미언급 | `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` (269-286행 부근) | `spec/conventions/swagger.md` §5-4 체크리스트, 같은 컨트롤러 형제 6개 엔드포인트 패턴 | plan §A 의 `ParseUUIDPipe` 부착과 함께 `@ApiParam({ name:'id', format:'uuid' })` 데코레이터도 형제 6곳과 동일하게 추가 — 현재 plan 체크리스트는 파이프만 명시하고 이 데코레이터는 누락(같은 조항의 절반만 겨냥). spec 자체 수정은 불요, 코드 레벨 보강만 필요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | plan §C "트래커 2건 등재"(5개 은퇴 에러코드 + KO 라벨 부재 축) 약속이 아직 미이행 상태(등재 시점 기준 grep 0건) | `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C, 대상 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` | 이 plan 종료 전 체크리스트의 "C: 트래커 2건 등재"를 실제로 수행했는지 확인. "실재 코드 확정 전까지 이름을 바꾸지 않는다"는 판단 근거를 함께 옮겨 다음 세션이 같은 실측을 반복하지 않게 할 것 |
| 2 | rationale_continuity | §C 로 미루는 은퇴 에러코드(`NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR` 등)는 이미 `spec/5-system/3-error-handling.md §1.4` 본문이 "더 이상 사용하지 않는다"고 선언한 이름 | `spec/5-system/3-error-handling.md §1.4` | 위 트래커 등재 시 이 문구를 근거로 명시 인용하면 SoT 추적이 쉬워짐 (선택 사항) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/5-system/`·`2-navigation/2-trigger-list.md`·`data-flow/10-triggers.md`·`1-data-model.md` 6개 교차 축(트리거 404 코드, TRIGGER_NOT_FOUND 범위, id 타입, MCP 플래그명, RBAC, 400 기본값) 모두 이미 상호 일치. 어긋남은 spec 이 아니라 `codebase/frontend` 가이드/i18n 쪽 |
| rationale_continuity | NONE | plan 의 두 축 모두 기존 Rationale("UUID 검증 강도 비대칭", RESOURCE_NOT_FOUND 기본 카탈로그, MCP_ALLOW_INSECURE_URL 명명)을 뒤집지 않고 오히려 그 원칙이 요구하는 상태로 outlier 정렬 |
| convention_compliance | LOW | swagger.md §5-4 UUID 파라미터 규칙을 `rotateBotToken` 이 코드 레벨에서 위반(WARNING) — spec 문서 자체는 이미 정확. i18n-userguide.md Principle 3-C(ERROR_KO 강제 제외)와도 정합 |
| plan_coherence | LOW | 출처 트래커가 요구한 선실측을 정확히 수행했고 결과가 기존 spec 서술과 일치. 다른 in-progress plan 과 파일/엔드포인트 충돌 없음. §C 등재 이행 여부만 확인 필요 |
| naming_collision | NONE | 신규 식별자 도입 없음(기존 식별자로 정정만). 신규 가드 파일 2개는 grep 0건 사전 미존재 확인 + 기존 명명 컨벤션 일치 |

## 권장 조치사항
1. `rotateBotToken` 에 `ParseUUIDPipe` 부착 시 `@ApiParam({ name: 'id', format: 'uuid' })` 데코레이터도 형제 6개 엔드포인트와 동일하게 함께 추가 (swagger.md §5-4 완전 준수, WARNING 해소)
2. plan §C 의 트래커 등재(5개 은퇴 에러코드 + KO 라벨 부재 축)를 세션 종료 전 실제로 수행 — 판단 근거("실재 코드 확정 전까지 이름 유지")를 함께 기록
3. (선택) 트래커 등재 시 `spec/5-system/3-error-handling.md §1.4` "더 이상 사용하지 않는다" 문구를 근거로 명시 인용
