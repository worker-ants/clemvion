# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `ScheduleDto.trigger` 를 (이전엔 `Trigger` 엔티티 전체가 조인을 타고 새던 상태에서) 참조 4필드(`id`·`name`·`workflowId`·`workflow.name`)로 좁힌 것, `TriggerDto.workflow` 를 `Workflow` 엔티티 전체에서 2필드(`id`·`name`)로 좁힌 것은 `GET/POST/PATCH /api/schedules` · `GET/POST/PATCH /api/triggers` 응답의 하위 호환성 파괴다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse()`, `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` `ScheduleDto.trigger`/`ScheduleTriggerRefDto`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` `TriggerDto.workflow`/`TriggerWorkflowRefDto`
  - 상세: 종전 응답은 조인된 엔티티 전체(회전 secret 컬럼 포함)를 실어 보냈으므로, 그 필드들에 의존하던 클라이언트가 있었다면 이번 변경으로 조용히 `undefined` 를 받게 된다. 다만 (1) 이 프로젝트는 API 버전 관리 스킴이 없고 breaking change 는 CHANGELOG 고지로만 다루는 것이 기존 컨벤션이며 CHANGELOG 최상단 항목에 영향 범위·소비처 실측(저장소 전수 grep: FE `lib/api/schedules.ts` `RawSchedule` 유일, `@workflow/sdk` 는 스케줄/트리거 워크플로 필드 미참조)까지 문서화돼 있고, (2) 이번 축소가 회전 secret 유출이라는 보안 결함 수정의 불가피한 부수효과다. 즉 컨벤션 안에서 처리된 breaking change 이며 이번 diff 가 새로 만든 절차 공백이 아니다. 외부(서드파티) API 소비자가 향후 생기면 CHANGELOG-only 고지 방식의 충분성을 재검토할 필요는 남는다.
  - 제안: 조치 불요. 참고용 관찰(직전 라운드 `review/code/2026/09/05/23_30_00/api_contract.md` 와 동일 결론).

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 응답에 항상 존재하는 내부 health 카운터인데 프런트엔드 소비처가 0곳이다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`consecutiveNetworkFailures` 필드)
  - 상세: PR 자신의 주석·CHANGELOG·`plan/in-progress/spec-draft-nullable-notation-followups.md` 가 "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다" 고 명시적으로 등재했다. 최소 노출 관점에서는 아쉽지만 스코프 판단이 스스로 문서화돼 있어 은닉된 확장이 아니다.
  - 제안: 조치 불요(이미 트래커에 등재).

- **[INFO]** 이중 응답-계약 검증자(`response-contract.ts` 런타임 값 대조 + `swagger-dto-contract-guard.ts` 정적 선언 대조, 이번 PR 이 신설한 `required:false`+`nullable:true` 응답 바디 금지-조합 3번째 축 포함)는 "응답 형식의 일관성·스키마 준수" 관점이 요구하는 인프라를 정확히 갖췄다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  - 상세: 두 검증자의 경계(런타임 값 vs 선언 대 선언)가 각 파일 JSDoc 에 명시돼 있다. 신규 응답 DTO 필드 24개(`TriggerDto`·`IntegrationDto`·`KnowledgeBaseDto`·`AlertRuleDto`·`ScheduleDto`)는 전부 §5.4 "기본형"(`@ApiProperty` + 컬럼이 nullable 이면 `nullable: true`)으로 일관되게 선언돼 있고, 새 정적 가드(`findOptionalNullableResponseFields`)로 요청 바디 전용인 "키 생략형+nullable" 조합이 응답 DTO 에 섞이지 않았음을 78건 베이스라인 양방향 래칫으로 고정한다. `knowledge-base.entity.ts` 의 `rerankMode` 유니온 타입과 DTO `enum` 선언이 정확히 일치하는 등 엔티티-DTO 대조도 직접 확인했다.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.update()` 가 `rest` 에서 `undefined` own-property 만 걸러내는 필터를 추가해, `useDefineForClassFields`(ES2023 타깃) 로 인해 값 없는 optional 필드가 `undefined` own-property 로 존재해 `Object.assign` 이 로드된 값을 덮어쓰던 결함(PATCH 응답에서 `name` 등 필드 소실)을 고쳤다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()`
  - 상세: 요청 DTO 의 tri-state 계약(키 생략=불변·`null`=초기화·값=설정)과 상충하지 않는다 — 필터는 `undefined` 만 제거하고 명시적 `null` 은 그대로 통과시키므로 PATCH 의 "null 로 초기화" 의미가 보존된다. `schedules.service.ts` 의 `saved.trigger = savedTrigger`/`saved.trigger = trigger ?? schedule.trigger` 를 `if (isActive)` 조건 밖으로 옮긴 것도 같은 계열 수정 — 응답 형태가 요청 값(`isActive`)에 따라 갈리던 것을 없앴다(§응답 형식 일관성 개선).
  - 제안: 조치 불요.

- **[INFO]** 페이지네이션 래퍼는 이번 diff 로 변경되지 않았다 — `SchedulesController.findAll()` 이 `page.data.map((s) => this.toResponse(s))` 로 배열 원소만 매핑하고 `{ ...page, data: ... }` 로 바깥 페이지네이션 봉투(`total`/`page`/`limit` 등)는 그대로 보존한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` `findAll()`
  - 제안: 조치 불요.

## 요약

이번 diff 는 트리거 회전 secret(`notificationSecretV2`·`chatChannelTokenV2`)이 `GET/POST/PATCH /api/triggers` 와 `GET/POST/PATCH /api/schedules`(조인 경로) 두 곳으로 새던 보안 결함을 응답 경계(서비스 `sanitizeForResponse` + 컨트롤러 `toResponse`)에서 막고, §5.4 응답-계약 스윕이 실측으로 찾아낸 "응답엔 있는데 선언에 없던" 24개 필드를 5개 DTO 에 반영하는 작업이다(wire 변경 없음, 문서만 실제에 맞춤). 신규 필드 선언은 전부 §5.4 required+nullable 기본형을 일관되게 따르고, 새로 신설한 정적 래칫이 요청 바디 전용 "키 생략형+nullable" 금지 조합이 응답 DTO 에 섞이지 않았음을 78건 베이스라인으로 고정한다. 유일한 실질적 하위 호환성 파괴(`ScheduleDto.trigger`·`TriggerDto.workflow` 축소)는 보안 수정의 불가피한 부수효과이며 CHANGELOG 에 영향 범위·소비처(FE 유일, SDK 미해당) 실측까지 문서화돼 있고, 이 프로젝트의 기존 breaking-change 처리 컨벤션(버전 없는 REST + CHANGELOG 고지)과 일치한다. 이번 diff 는 직전 라운드(`review/code/2026/09/05/23_30_00`)의 api_contract 리뷰가 이미 검토한 변경 집합에 주석 정리·중복 루프 추출(`omitKeys`)·unit 테스트 2건 추가만 더한 것으로, 새로 검토한 범위에서도 API 계약 관점의 Critical/Warning 급 결함은 발견되지 않았다. 에러 응답 형식·인증/인가(`@ApiBearerAuth`, `@Roles`, 표준 에러 데코레이터)·URL 설계·페이지네이션 봉투는 이번 PR 범위에서 변경되지 않았고 기존 패턴을 그대로 따른다.

## 위험도

LOW
