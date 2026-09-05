# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. 신규 발견 WARNING 4건(가용성 1·테스트 커버리지 서술-실제 불일치 1·문서 정확성 2)은 모두 이번 §5.4 응답-계약 스윕 + 트리거 회전 secret 유출 수정 자체의 핵심 로직(정화 4축, 좁히기 로직, 계약 검증자)이 아니라 주변부(에러 경로 하나, e2e 커버리지 주장, CHANGELOG/주석 서술)에 국한된다. router forced 화이트리스트(`documentation·maintainability·requirement·scope·security·side_effect·testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `SchedulesController.toResponse`가 `schedule.trigger` 미로드 시 방어 없이 `t.id` 등에 접근해 미처리 TypeError(→ masked 500)를 던진다. 이전에는 필드가 조용히 빠지는 정도였는데 이번 diff 로 fail-fast 실패 모드가 새로 생겼다. `GlobalExceptionFilter`가 스택트레이스 노출 없이 마스킹하므로 정보 유출은 없으나, 데이터 정합성이 깨진 한 행 때문에 워크스페이스의 스케줄 목록 조회 전체가 500 이 될 수 있다. | `codebase/backend/src/modules/schedules/schedules.controller.ts:67-85` | 의도된 설계이면 `if (!t) throw new InternalServerErrorException(...)`처럼 명시적으로 드러내 다음 사람이 방어 코드를 추가하지 않도록 하고, 실제 관측 시 알람/런북에 남긴다. |
| 2 | testing | `ScheduleTriggerRefDto.workflow`의 JSDoc이 "findById·findAll·update 세 형태를 e2e 가 각각 고정한다"고 주장하지만, 실제 양성(키-존재) 단언은 `findById` 한 곳(`Object.keys(...).toEqual([...])`, :148-149)뿐이다. `findAll`(:161)과 `update`(:288)는 `assertMatchesContract`만 돌아 "narrowing 로직 자체가 사라져 `workflow` 키가 통째로 안 실리는" 회귀를 못 잡는다(§5.4 키생략형은 부재를 위반으로 보지 않음). 서술이 실제 커버리지보다 넓다. | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:34-40`, `codebase/backend/test/schedule-trigger.e2e-spec.ts:148-149,161,288` | `:161`·`:288`에도 `:148`과 같은 `Object.keys(...).toEqual([...])` 명시적 대조를 추가하거나, JSDoc 주장을 "findById 한 곳만 명시적으로 고정한다"로 낮춘다. |
| 3 | documentation | `CHANGELOG.md`가 "첫 판의 실수"를 23개 필드 전체로 일반화했지만, 실제로는 17개만 §5.4 금지 조합(`@ApiPropertyOptional({nullable:true})`+`field?: T\|null`)이었고 나머지 6개(`consecutiveNetworkFailures`·`documentCount`·`rerankMode`·`rerankCandidateK`·`chatChannelHealth`·`notificationHealth`)는 다른 축(상시 존재를 optional 로 과소 선언)이었다. 같은 PR 의 `plan/in-progress/spec-draft-nullable-notation-followups.md:456-458`는 이미 17/6 으로 정확히 갈라 놓았는데 CHANGELOG 본문만 그 정정이 반영되지 않았다. | `CHANGELOG.md:76-81` | CHANGELOG 문장을 plan 트래커와 같은 수준으로 분리 — "23개 중 17개는 금지 조합, 나머지 6개는 별개 축의 과소 선언"으로 정정. |
| 4 | documentation | `schedules.service.ts`의 신규 인라인 주석이 `saved.trigger = savedTrigger`가 과거 `if (isActive)` 안에 있었던 이유로 "`registerJob`이 그것을 필요로 해서"를 드는데, 실제로 `ScheduleRunnerService.registerJob`(`schedule-runner.service.ts:262-277`)은 `id`·`cronExpression`·`timezone`·`workspaceId` 4필드만 읽고 `trigger`는 전혀 참조하지 않는다(도입 커밋까지 추적해도 마찬가지). 검증 없이 쓰인 인과 주장이 다음 사람에게 잘못된 제약을 전제시킬 수 있다. | `codebase/backend/src/modules/schedules/schedules.service.ts:198-199` | "`registerJob`이 필요로 하므로" 구절을 삭제하거나, 실제 근거("같은 `if (isActive)` 블록 안에 있었을 뿐")로 교체. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 트리거 회전 secret 정화(`sanitizeForResponse`)가 4개의 독립 deny-list 로 구성돼 구조적으로 fail-open — 다섯 번째 비밀 축이 추가되면 같은 실패가 재발할 수 있다. 코드 자신의 JSDoc 이 이미 이 위험을 인지·문서화하고 있으며, 4축 모두 뮤테이션 테스트로 회귀 고정됨. | `codebase/backend/src/modules/triggers/triggers.service.ts`(`sanitizeForResponse` 및 4개 STRIP 상수) | 조치 불요(현 범위). 다섯 번째 비밀 축 추가 시 선언적 `@Sensitive()` 데코레이터 전환 우선 검토. |
| 2 | security / [SPEC-DRIFT] | `notification_secret_v2`가 24h rotation grace 동안 평문으로 DB 저장되며 `spec/5-system/14-external-interaction-api.md §7.1`("ref 만 보관")과 모순 — 이 PR 의 결함이 아니라 선행 아키텍처 결정이며, 이미 `review/consistency/2026/09/05/19_08_19/RESOLUTION.md`가 Critical 로 잡아 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 인계 등재됨. | `codebase/backend/src/modules/triggers/triggers.service.ts`(`TRIGGER_RESPONSE_STRIP_COLUMNS`/`rotateNotificationSecret` JSDoc), `CHANGELOG.md` | 조치 불요(이미 등재·인계됨). planner 턴에서 spec 정정 또는 코드 측 실제 ref 저장 전환 중 택1 필요. |
| 3 | requirement | 이전 라운드(`00_00_23`) WARNING 3건(appUrl JSDoc MakeShop 누락·`sanitizeForResponse` 78줄 미분해·JSDoc-테스트 분리)이 현재 HEAD 에서 모두 반영됨을 재확인. 신규 선언 23개 필드 전부 엔티티·서비스 로직과 교차 대조해 일치 확인. | (교차 확인) | 조치 불요. |
| 4 | scope | `workflow-crud.e2e-spec.ts:13-14`의 `ExportWorkflowDto`/`WorkflowDto` import 미병합이 7라운드째 그대로 남아 있음(스타일 수준). | `codebase/backend/test/workflow-crud.e2e-spec.ts:13-14` | 두 import 병합. 이번 PR 을 막을 사유는 아님. |
| 5 | maintainability | "이미 응답에 실려 나가고 있었다" 배경 설명 주석(6줄)이 4개 DTO 파일에 글자 그대로 반복됨. 다섯 번째 파일에도 복붙되면 규약 본문으로 옮기는 것을 검토. | `alert-rule-response.dto.ts`·`integration-response.dto.ts`·`knowledge-base-response.dto.ts`·`trigger-response.dto.ts` | 급하지 않음. |
| 6 | maintainability | `SchedulesController` create/update unit 테스트의 트리거-좁힘 단언 3줄 조합이 두 테스트에 반복(직전 라운드 유예 유지). | `codebase/backend/src/modules/schedules/schedules.controller.spec.ts:72-79,92-99` | 조치 불요(기존 유예). `expectNarrowedScheduleTrigger` 헬퍼 추출 고려. |
| 7 | api_contract | `ScheduleDto.trigger`를 전체 `Trigger` 엔티티에서 4필드 참조로 좁힌 것은 breaking change 이나, 유일 소비자(`lib/api/schedules.ts`의 `RawSchedule`)가 정확히 그 4필드만 씀을 저장소 전수 검색으로 확인하고 CHANGELOG 에 근거를 남김. | `schedules.controller.ts`(`toResponse`), `schedule-response.dto.ts:52-111` | 조치 불요(이미 문서화·실측됨). |
| 8 | api_contract | `IntegrationDto.consecutiveNetworkFailures`(FE 소비 0곳인 내부 카운터)가 제거 대신 선언에 포함됨 — PR 자신이 "제거는 별도 breaking change 항목"이라고 명시. | `integration-response.dto.ts:159-167` | 조치 불요. 후속 제거 PR 시 breaking change 공지 필요. |
| 9 | api_contract | `assertMatchesContract`의 `allowMissing: ['formatVersion']`이 `ExportWorkflowDto.formatVersion` required 선언 vs 미구현 기존 갭(spec 에 Planned 로 이미 문서화)을 우회 검증 — 이 PR 이 새로 만든 갭 아님, 닫지도 않음. | `codebase/backend/test/workflow-crud.e2e-spec.ts:432-441` | 조치 불요(범위 밖). 후속 트래커 항목 필요. |
| 10 | side_effect | `contractCache` 신규 모듈-레벨 전역 가변 상태 — `tsconfig.build.json` exclude 로 프로덕션 dist 미포함, `src/modules/**` import 0건 확인. non-frozen 이나 소비자 전부 읽기 전용이라 기결정대로 유예. | `codebase/backend/src/shared/testing/response-contract.ts:386` | 조치 불요(기결정 재확인). |
| 11 | side_effect | `sanitizeForResponse`가 조기 return 제거로 참조 동일성을 더 이상 보장하지 않음 — 현재 호출부 7곳은 전부 종단 반환이라 문제 없으나, 향후 `===` 비교/WeakMap 키 사용 코드 추가 시 조용히 깨질 수 있음. JSDoc 에 이미 경고 남김. | `codebase/backend/src/modules/triggers/triggers.service.ts:691` 이하 | 조치 불요(문서화 충분). |
| 12 | testing | 신규 선언 필드(rerank* 4개·mallId 등 4개·createdBy/lastTriggeredAt)는 구조만 검증되고 실제 값 정확성(예: 트리거된 규칙의 `lastTriggeredAt` non-null 여부)은 이 diff 범위 밖 — 과독 방지 차원의 기록. | `alerts-threshold-wire-type.e2e-spec.ts:103`, `knowledge-base.e2e-spec.ts:79-82` 등 | 조치 불요. |
| 13 | user_guide_sync | doc-sync-matrix 21개 trigger 중 "backend-api-change" 1건만 매치. swagger jsdoc 은 diff 내 이미 충족, user-guide 페이지 갱신은 신규 사용자 가시 기능이 없어(기존에 이미 나가던 필드의 선언 정합화 + secret 노출 제거) 불필요로 판단. frontend 변경 0건과 일치. | (매트릭스 전수 대조) | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 4축 secret 정화 완전성 확인, 신규 취약점 없음. 구조적 fail-open 위험(INFO)과 spec drift(INFO, 기등재)만 기록. |
| requirement | NONE | 이전 라운드 WARNING 전량 반영 확인. 23개 신규 필드 전부 엔티티/서비스 로직과 일치. |
| scope | NONE | 실질 코드 diff 33개 파일이 단일 목적(§5.4 스윕)에 수렴. import 미병합(7라운드째) 외 스코프 이탈 없음. |
| side_effect | LOW | `SchedulesController.toResponse` 미처리 TypeError 신규 실패 모드(WARNING). 그 외 좁히기·전역 캐시·in-memory 대입 전부 안전 확인. |
| maintainability | LOW | 직전 라운드 WARNING 2건(78줄 미분해·JSDoc 분리) 실제 해소 확인. 반복 주석/테스트 단언 등 저위험 잔여만 남음. |
| testing | LOW | `ScheduleTriggerRefDto.workflow` e2e 커버리지 서술이 실제보다 넓음(WARNING, findAll/update 누락). 나머지 뮤테이션 검증은 견고. |
| documentation | LOW | CHANGELOG 17/6 conflation(WARNING), `registerJob` 인과 오서술(WARNING). 그 외 문서화 수준 전반적으로 높음. |
| api_contract | LOW | `ScheduleDto.trigger` 좁힘 breaking change(실측·문서화됨), `formatVersion` 기존 갭 우회 확인 등 전부 INFO 수준. |
| user_guide_sync | NONE | 매트릭스 21개 trigger 중 1건만 매치, 요건 충족 확인. 동반 갱신 누락 없음. |

## 발견 없는 에이전트

user_guide_sync — "발견사항: 없음"으로 명시 종결(매트릭스 요건 충족, 동반 갱신 누락 0건).

## 권장 조치사항

1. `SchedulesController.toResponse`의 `trigger` 미로드 시 TypeError 를 명시적 예외(`InternalServerErrorException`)로 드러내 의도를 코드화한다 (WARNING #1).
2. `schedule-trigger.e2e-spec.ts`의 `findAll`(:161)·`update`(:288) 경로에 `Object.keys(...).toEqual([...])` 명시적 대조를 추가해 `ScheduleTriggerRefDto.workflow` JSDoc 의 커버리지 주장을 실제로 채우거나, 주장 자체를 낮춘다 (WARNING #2).
3. `CHANGELOG.md`의 "23개 필드 전체가 금지 조합" 서술을 17/6 분리로 정정한다 (WARNING #3).
4. `schedules.service.ts`의 `registerJob` 인과 주장 주석을 실제 근거로 교체하거나 삭제한다 (WARNING #4).
5. (급하지 않음) 4개 DTO 파일의 반복 배경 설명 주석과 스케줄 컨트롤러 unit 테스트 중복 단언은 다음 손질 시 공통화를 고려한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 관련성 낮음 (prompt 상 skipped 목록에 포함, 개별 사유 텍스트 미제공) |
  | architecture | 상동 |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |