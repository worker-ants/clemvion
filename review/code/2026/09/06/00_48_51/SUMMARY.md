# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없으나, `SchedulesController.toResponse` 의 `InternalServerErrorException` 이 `spec/5-system/2-api-convention.md §5.3` 의 5xx 마스킹 규약을 우회해 DB 스키마·쿼리 구현 정보를 클라이언트에 노출하는 문제를 security·side_effect·api_contract 3개 reviewer 가 **독립적으로 동일 지점을 재현**했다(도달 조건은 낮음). 나머지는 CHANGELOG 감사 기록 오귀속·테스트 중복·방어 분기 미테스트 등 경미한 WARNING 3건과 다수의 INFO(대부분 기결정/조치 불요)다.

forced 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 확인 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API계약/보안 | `SchedulesController.toResponse` 가 트리거 미로드 시 던지는 `InternalServerErrorException` 의 상세 메시지(DB 컬럼명 `trigger_id`·NOT NULL 제약·"join/relation 누락" 힌트)가 `GlobalExceptionFilter` 의 CWE-209 마스킹을 우회해 클라이언트 응답에 그대로 echo 되고, `HttpException` 분기라 서버 로그에도 남지 않는다 — `spec/5-system/2-api-convention.md §5.3` 위반. security·side_effect·api_contract 3개 reviewer 가 `GlobalExceptionFilter` 소스를 직접 열어 독립적으로 동일 결론에 도달했다. 직전 라운드(`review/code/2026/09/06/00_24_34`)가 "마스킹되어 안전"이라 판단한 근거는 `TypeError`(Error 분기, masked) 기준이었는데, 실제 구현은 `HttpException` 계열(unmasked)로 되어 그 판단이 무효화됐다. | `codebase/backend/src/modules/schedules/schedules.controller.ts:81-87` | 인자 없는(또는 코드만 담은) `InternalServerErrorException` 로 바꾸고, 상세 진단(`schedule.id` 등)은 `this.logger.error(...)` 로 서버 로그에만 남긴다. |
| 2 | 문서화(요구사항 감사기록) | `CHANGELOG.md` 인용 블록 안에서 "나머지 6개는 다른 축이다"(과소-선언 축) 설명 뒤에 "17개 금지-조합 축" 설명이 한 문장으로 잘못 이어붙어, 17개 축의 특징("키가 없어도/null 이어도 맞는 조합")이 6개 축 설명에 잘못 귀속된다. 84줄부터는 `>` 인용 접두도 빠진다. | `CHANGELOG.md:81-86` | 84줄에서 문장을 끊고 "두 검증자 어느 쪽도 잡지 못했다..." 문단을 17개 축 설명 뒤(79줄 인근)로 옮기거나, 최소한 85~86줄에도 `>` 를 붙여 인용 범위를 명확히 한다. |
| 3 | 유지보수성 | 트리거 참조 좁히기 결과 형태(`['id','name','workflowId','workflow']` 등)를 확인하는 동일 assertion 블록이 `schedule-trigger.e2e-spec.ts` 3곳 + `schedules.controller.spec.ts` 2곳, 총 5곳에 글자 그대로 반복된다 — `ScheduleTriggerRefDto` 필드 구성이 바뀌면 다섯 곳을 각각 찾아 고쳐야 하고 하나를 놓치면 그 자리만 조용히 낡은 형태를 계속 단언한다. | `codebase/backend/test/schedule-trigger.e2e-spec.ts:148-150,166-170,302-307`, `codebase/backend/src/modules/schedules/schedules.controller.spec.ts:72-78,92-98` | `expectNarrowedTriggerRef(trigger, { withWorkflow })` 류 공용 단언 헬퍼로 추출해 다섯 지점을 호출로 교체. |
| 4 | 테스트 | `SchedulesController.toResponse` 의 `!t`(트리거 미로드) 방어 분기가 unit·e2e 어디에도 테스트되지 않는다 — 예외 타입/메시지가 다른 것으로 바뀌어도(조건 반전이 아닌 한) 아무 테스트도 반응하지 않는다. | `codebase/backend/src/modules/schedules/schedules.controller.ts:68-89` (throw 자리 82-86) | `schedules.controller.spec.ts` 에 `service.findAll`/`findById` 가 `trigger: null` 인 스케줄을 돌려줄 때 `InternalServerErrorException` 을 던지는지 확인하는 테스트 1건 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 트리거 응답 정화(`sanitizeForResponse`)가 deny-list 4벌 구조라 신설 비밀 축마다 사람이 목록에 추가해야 막힌다 — 이미 3회 재발 이력, JSDoc 에 선언적 SoT 전환 경고가 이미 있음. | `codebase/backend/src/modules/triggers/triggers.service.ts:74,94,114` 등 | 조치 불요. 4번째 비밀 축이 생기면 선언적 allow-list/데코레이터 전환 우선 검토. |
| 2 | 문서화 | `spec/conventions/secret-store.md §1` 의 "노출 창이 아직 안 닫혀 있다" 서술이 이 PR 로 stale 화되지만, 실제보다 더 경계하라는 **안전한 방향**으로만 낡는다. developer 권한 밖(spec 델타 0). | `spec/conventions/secret-store.md §1` | 조치 불요 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추적 중. |
| 3 | 스코프/스타일 | `ExportWorkflowDto`/`WorkflowDto` import 가 같은 경로에서 두 줄로 분리된 채 여러 라운드째 잔존한다. | `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14` | `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합. |
| 4 | 문서화 | `CHANGELOG.md` 인용 블록 서식 결함(`>` 접두 누락, WARNING#2 와 동일 지점의 서식 측면) — 렌더링 결과에는 영향 없음. | `CHANGELOG.md:81-86` | WARNING#2 수정 시 함께 해소. |
| 5 | 부작용 | `response-contract.ts` 에 모듈 전역 `contractCache` 도입 — 프로덕션 dist(`tsconfig.build.json` exclude) 제외 확인, 실패 promise 는 즉시 캐시 삭제, 이미 이전 라운드(`22_24_58` INFO#11)에서 검토·수용된 트레이드오프. | `codebase/backend/src/shared/testing/response-contract.ts:386,412-425` | 조치 불요. |
| 6 | 부작용 | `sanitizeForResponse` 가 조기 return 제거로 참조 동일성을 더 이상 보장하지 않는다 — 현재 7개 호출부 전부 종단 반환이라 실질 영향 없음, JSDoc 이 이미 경고. | `codebase/backend/src/modules/triggers/triggers.service.ts:691-751` | 조치 불요. |
| 7 | 부작용 | `SchedulesService.create`/`update` 의 `saved.trigger = ...` 대입이 `if(isActive)` 조건 밖으로 나와 항상 실행 — `save()` 완료 이후 in-memory 전용 대입이라 DB 재기록 없음. | `codebase/backend/src/modules/schedules/schedules.service.ts:206,266` | 조치 불요. |
| 8 | API계약 | 응답 형태 좁히기(`ScheduleDto.trigger`, `TriggerDto.workflow`)가 실질적 breaking narrowing — CHANGELOG·plan 트래커에 FE 소비처 grep 근거와 함께 이미 문서화·검토 완료. | `codebase/backend/src/modules/schedules/schedules.controller.ts:68-90`, `triggers.service.ts:685-690` | 조치 불요. |
| 9 | 유지보수성 | §5.4 선언 보정 배경을 설명하는 6줄 주석이 4개 응답 DTO 파일에 글자 그대로 복제 — 규칙 문구가 개정되면 drift 위험. | `alert-rule-response.dto.ts:55-61`, `integration-response.dto.ts:118-124`, `knowledge-base-response.dto.ts:93-99`, `trigger-response.dto.ts:98-104` | 필수 아님. 다음 §5.4 개정 시 네 곳 동시 갱신 인지, 또는 `spec/conventions/` 링크+축약 고려. |
| 10 | 유지보수성 | `sanitizeForResponse`/`toResponse` JSDoc 이 공개 계약 설명과 과거 리뷰 이력 서사를 한 블록에 혼재해 첫 가독성이 낮다. | `triggers.service.ts:652-690`, `schedules.controller.ts:54-67` | 강제 아님. 다음 수정 시 계약 설명/사건 서사 분리 고려. |
| 11 | 유지보수성 | `schedules.service.ts` create/update 의 트리거 대입 주석이 두 메서드에서 각각 다르게 서술(단, `update` 쪽이 `create` 를 명시 교차 참조). | `schedules.service.ts:198-206,263-266` | 조치 불요. |
| 12 | 테스트 | `schedules.controller.spec.ts` 가 `findAll`/`findById` 를 커버하지 않는다(`create`/`update`/`remove` 만) — e2e 가 실동작을 이미 촘촘히 덮음. | `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` | 우선순위 낮음. 파일을 다시 열 일이 생기면 같은 패턴(비밀 채운 mock + 좁혀진 키 단언)으로 채우기. |
| 13 | 테스트 | 트리거 **생성** 응답에서 `workflow` 키의 **부재**를 명시적으로 단언하는 e2e 가 없다 — §5.4 계약검증자는 optional 필드 부재를 위반으로 보지 않아 회귀 사각지대. | `trigger-response.dto.ts:96-102`; e2e: `webhook-trigger.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts` | `ScheduleDto.trigger` C-3 패턴처럼 `Object.keys(...).sort()` 양성 단언 추가. |
| 14 | API계약 | `TriggerWorkflowRefDto`(id+name) vs `ScheduleTriggerWorkflowRefDto`(name 만) — 같은 "워크플로우 참조" 개념이 비대칭 필드셋으로 노출됨. 각각 FE 소비처 기준 최소노출이라 개별로는 타당하나 재사용 기준 불명확. | `trigger-response.dto.ts`(TriggerWorkflowRefDto), `schedule-response.dto.ts`(ScheduleTriggerWorkflowRefDto) | 조치 불요 — 세 번째 유사 DTO 가 생기면 공통 필드셋/네이밍 규칙 검토. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `InternalServerErrorException` CWE-209 우회(WARNING#1), deny-list fail-open 구조(INFO) |
| requirement | LOW | CHANGELOG 축 설명 오귀속(WARNING#2). 그 외 spec 대조 전부 line-level 일치 확인 |
| scope | NONE | import 미병합 반복(INFO), CHANGELOG 포맷(INFO) — 범위 위반 없음, 실 diff 전량 단일 목적에 종속 확인 |
| side_effect | MEDIUM | `InternalServerErrorException` 마스킹 우회(WARNING#1) — 직전 라운드 "안전" 판단이 이번 구현으로 무효화됨을 재확인 |
| maintainability | LOW | assertion 블록 5곳 반복(WARNING#3), §5.4 주석 4파일 복제·JSDoc 서사 혼재(INFO) |
| testing | LOW | `toResponse` 방어분기 미테스트(WARNING#4), `findAll`/`findById` 미커버·`workflow` 부재 미단언(INFO) |
| documentation | NONE | CHANGELOG `>` 포맷 결함(INFO) 외 문서화 품질 이례적으로 높음(필드 JSDoc 전량·인용 정확성·이전 오류 자가정정 확인) |
| api_contract | MEDIUM | `InternalServerErrorException` §5.3 위반(WARNING#1, `GlobalExceptionFilter` 분기 추적으로 재확인), 워크플로우 참조 비대칭 필드셋(INFO) |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 INFO 이상을 보고했다(대부분 "조치 불요"로 처분된 기결정 사항 포함).

## 권장 조치사항

1. **[WARNING#1]** `SchedulesController.toResponse` 의 `InternalServerErrorException` 메시지를 일반화하고 상세 진단은 `this.logger.error(...)` 로만 남겨 §5.3 CWE-209 마스킹 규약을 준수시킨다 — 3개 reviewer 가 독립 재현한 유일한 실질 보안/계약 위반이므로 최우선.
2. **[WARNING#4]** 위 수정과 함께(또는 그 전에) `!t` 방어 분기에 대한 unit 테스트를 추가해, 향후 예외 타입/메시지 변경을 회귀로 잡는다.
3. **[WARNING#3]** 트리거 참조 좁히기 assertion 중복 5곳을 공용 헬퍼로 추출한다.
4. **[WARNING#2]** `CHANGELOG.md:81-86` 의 6개/17개 축 설명 오귀속 문단을 분리하고 인용 서식을 정정한다 — 사후 보안 감사 기록의 정확성 문제이므로 코드 배포와 무관하게 정정 권장.
5. 나머지 INFO 항목은 대부분 이전 라운드에서 이미 검토·수용된 기결정(전역 캐시, 참조 동일성, breaking narrowing)이거나 저우선 스타일 이슈로 이번 PR 을 막을 사유가 아니다. 다음에 관련 파일을 다시 열 때(§5.4 조항 개정, 세 번째 참조 DTO 추가 등) 함께 정리하는 것을 권장한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **제외**: 아래 표 (6명, router 산출에 상세 사유 미제공)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨 (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 비관련 판단 (상세 사유 prompt 미제공) |
  | architecture | router 비관련 판단 (상세 사유 prompt 미제공) |
  | dependency | router 비관련 판단 (상세 사유 prompt 미제공) |
  | database | router 비관련 판단 (상세 사유 prompt 미제공) |
  | concurrency | router 비관련 판단 (상세 사유 prompt 미제공) |
  | user_guide_sync | router 비관련 판단 (상세 사유 prompt 미제공) |