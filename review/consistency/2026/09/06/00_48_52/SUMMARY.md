# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 급 위배가 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원에서 발견되지 않았다.

## 전체 위험도
**LOW** — spec 문서 자체는 무변경(전 checker 실측: `git diff origin/main...HEAD --stat -- spec/` 0건)이고, 응답-DTO 축소 구현 diff 는 기존 규약과 대체로 정합. WARNING 2건(정보 노출 가능성 1건 + 명명 혼동 가능성 1건)만 남는다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 신설 방어 코드(orphaned `schedule.trigger` 가드)가 `InternalServerErrorException(문자열)` 을 던져, 요청 스코프의 `schedule.id`+내부 쿼리/조인 추론이 담긴 상세 진단 문구가 500 응답 바디(`error.message`)에 그대로 echo 됨 | `codebase/backend/src/modules/schedules/schedules.controller.ts` (신규 `private toResponse()`) | `spec/5-system/3-error-handling.md` INTERNAL_ERROR 행(고정 일반 문구 원칙) + `http-exception.filter.ts` 의 CWE-209 방지 설계 의도 | `code: 'SCHEDULE_TRIGGER_MISSING'` 같은 안정 코드 + 클라이언트용 일반 메시지로 좁히고, `schedule.id`·조인 추론 등 진단 정보는 `this.logger.error(...)` 로만 남긴다(`GlobalExceptionFilter.mapHttpErrorLike` 가 이미 4xx 에 쓰는 패턴 준용). spec 변경 불요 |
| 2 | Naming Collision | 같은 PR 이 도입한 `TriggerWorkflowRefDto`(`{id,name}`)와 `ScheduleTriggerWorkflowRefDto`(`{name}` 단일)가 이름은 `Schedule` 접두어 하나만 다르고 shape 는 달라, 향후 재사용/타입 오인 위험 | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:14` (신규 `ScheduleTriggerWorkflowRefDto`) | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:17` (신규 `TriggerWorkflowRefDto`, 필드 구성 다름) | 필드 구성이 다름을 명시하는 이름으로 분화(예: `ScheduleTriggerWorkflowNameRefDto`)하거나, 실제로 동일 정보여야 한다면 `TriggerWorkflowRefDto` 재사용으로 통합. 최소한 각 클래스 JSDoc 에 자매 타입과 필드가 다름(의도적)을 상호 참조 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `secret-store.md §1` "노출 창이 아직 닫혀 있지 않다" 서술이 이 브랜치 머지 후 낡음(이 diff 가 바로 그 노출을 닫는 후속 조치) | `spec/conventions/secret-store.md §1` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 담당 정정 항목으로 등재됨 — 다음 planner 턴에서 반영 여부만 확인 |
| 2 | Convention Compliance | `*RefDto`(참조-전용 DTO) 명명 패턴이 이번에 처음 도입됐으나 `swagger.md` §1-4 에 성문화 안 됨 | `trigger-response.dto.ts`(`TriggerWorkflowRefDto`), `schedule-response.dto.ts`(`ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto`) | 다음에 `swagger.md` §1-4 를 건드릴 때 "조인 엔티티를 참조 수준으로 좁힐 때는 `<Parent><Child>RefDto` 로 명명" 한 줄 추가 |
| 3 | Convention Compliance | `IntegrationDto.consecutiveNetworkFailures` 노출 축소는 wire 파괴적 변경이라 별도 트래커 항목 필요(코드 주석이 자체 언급) — 정식 규약 위반은 아님, 본 checker scope 밖 | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` | cross_spec/plan_coherence 후속 트래킹 대상으로 인지만 해 둘 것 |
| 4 | Plan Coherence | `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter `spec_impact` 가 본문의 열린 후속 항목이 요구하는 spec 경로(`2-navigation/4-integration.md §9.1`, `2-navigation/{3-schedule,2-trigger-list}.md`, `conventions/secret-store.md §1`, `conventions/migrations.md`)보다 좁음 | `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter | 다음에 이 plan 항목들을 착수하는 planner 턴이 `spec_impact` 를 실제 footprint 로 갱신(이번 PR 이 지금 처리할 필요는 없음) |
| 5 | Plan Coherence | §5.4 래칫 canary fixture(`repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`)가 `spec/5-system/2-api-convention.md` frontmatter `code:` 에 여전히 미등재(기존 추적 항목, 이 브랜치가 새로 만든 gap 아님) | `spec/5-system/2-api-convention.md` frontmatter `code:` | 이미 plan 문서에 등재됨 — 별도 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec 무변경 diff. WARNING 1건: orphaned-trigger 가드가 500 응답에 상세 진단 문구 노출(INTERNAL_ERROR 일반화 원칙 위반). 그 외 secret strip·데이터모델·§5.4 검증 층 경계 전부 정합 확인 |
| Rationale Continuity | LOW | Critical/Warning 없음. `secret-store.md §1` 현재형 서술이 머지 후 낡을 예정이나 이미 plan 등재. §5.4 원칙·두 검증자 경계·`select:false` 미채택 이유 전부 준수 확인, 브랜치 자체 내 자기반증 정정(§5.4 위반→즉시 래칫 가드)도 확인 |
| Convention Compliance | NONE | CRITICAL/WARNING 없음. INFO 2건(`*RefDto` 명명 미성문화, `consecutiveNetworkFailures` 트래킹). §5.4 선언 형태·audit-actions/error-codes 카탈로그 정합·문서 3섹션 구조 전부 확인 |
| Plan Coherence | LOW | 이 브랜치는 spec 을 전혀 건드리지 않았고 plan 이 추적 중인 developer 몫만 수행. INFO 2건(spec_impact 범위 협소, canary fixture code: 미등재 — 둘 다 기존 known gap) |
| Naming Collision | LOW | spec 신규 식별자 없음. WARNING 1건: `TriggerWorkflowRefDto` ↔ `ScheduleTriggerWorkflowRefDto` 명명 유사·shape 상이로 인한 향후 혼동 위험. 나머지 신규 식별자(module-scope 상수/함수/private 메서드)는 전수 grep 상 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, BLOCK:NO)
2. `SchedulesController.toResponse` 의 `InternalServerErrorException` 문자열 인자를 안정 에러 코드 + 일반 메시지로 좁히고, 상세 진단(schedule.id·조인 추론)은 서버 로그로만 남긴다 (WARNING #1).
3. `ScheduleTriggerWorkflowRefDto`/`TriggerWorkflowRefDto` 두 타입에 상호 참조 JSDoc 을 추가하거나 이름을 필드 구성이 다름을 반영하도록 분화한다 (WARNING #2).
4. 다음 planner 턴에서 `spec-draft-nullable-notation-followups.md` 의 `spec_impact` frontmatter 를 본문 열린 항목의 실제 spec footprint 로 갱신하고, `secret-store.md §1` 의 "노출 창이 아직 닫혀 있지 않다" 서술을 이번 병합을 반영해 정정한다 (INFO #1, #4).
