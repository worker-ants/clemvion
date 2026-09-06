# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 및 방법

- target scope 는 `spec/5-system/` 이지만 `origin/main...HEAD` 기준 그 영역의 **spec 델타는 0개 파일**이다 (정상 — 코드 전용 PR).
- 실제 변경은 `codebase/backend/` 34개 파일 / 1,886줄(+50줄 삭제)의 구현 diff다 — §5.4 응답-계약 스윕(트리거·스케줄 DTO 정합화 + `swagger-dto-contract-guard` 3번째 축 신설). 프롬프트 번들에는 예산 절단으로 diff 본문이 실리지 않아, `git diff origin/main...HEAD -- codebase/ CHANGELOG.md` 를 워크트리에서 직접 조회해 신규 식별자를 전수 확인했다.
- 확인한 신규 식별자: DTO 클래스(`ScheduleTriggerRefDto`·`ScheduleTriggerWorkflowRefDto`·`TriggerWorkflowRefDto`·`OptionalNullableOffender`·`OptionalNullableOffenderFixtureDto`), 함수/헬퍼(`isResponseDtoFile`·`findOptionalNullableResponseFields`·`expectNarrowedScheduleTriggerRef`·`omitKeys`·`stripChatChannelSecrets`·`stripInteractionSecrets`·`stripNotificationSigningSecrets`·`deleteSecretColumns`·`narrowWorkflowRef`·`SchedulesController.toResponse`·`contractForDto` 캐시화), 모듈 상수(`NOTIFICATION_SIGNING_STRIP_KEYS`·`TRIGGER_RESPONSE_STRIP_COLUMNS`·`INTERACTION_RESPONSE_STRIP_KEYS`), DTO 신규 필드(`TriggerDto`·`IntegrationDto`·`KnowledgeBaseDto`·`AlertRuleDto`·`ScheduleDto` 각각), 신규 파일 경로(`shared/testing/schedule-trigger-ref.ts`(.spec)·`repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`·`test/schedule-trigger.e2e-spec.ts`).
- 각각을 `grep -rn` 으로 저장소 전수 대조해 기존 사용처와의 의미 충돌 여부를 확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `ScheduleTriggerWorkflowRefDto`(name 만) vs `TriggerWorkflowRefDto`(id+name) — 이름이 접두어 하나 차이인 자매 타입
  - target 신규 식별자: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` 의 `ScheduleTriggerWorkflowRefDto`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 의 `TriggerWorkflowRefDto`
  - 기존 사용처: 서로가 서로의 JSDoc 에서 상호 참조 — "한쪽을 다른 쪽으로 갈아 끼우지 말 것" 경고가 이미 양쪽에 있다
  - 상세: 두 타입은 필드 구성이 다르다(스케줄 쪽은 `name` 1개, 트리거 쪽은 `id`+`name` 2개) — 실수로 서로 바꿔 쓰면 스케줄 응답에 불필요한 `id` 가 새거나 트리거 응답에서 링크용 `id` 가 빠질 수 있다. 다만 이는 이 diff 가 이미 자각하고 문서화한 리스크이며(`review/consistency/2026/09/06/00_48_52` W2 를 인용), 실제 충돌(동일 식별자가 다른 의미로 쓰이는 상황)은 아니다 — 이름이 다르므로 컴파일러가 혼용을 막는다.
  - 제안: 조치 불필요. 향후 세 번째 "Ref" DTO 가 추가될 경우 이 문서화된 관례(접두어로 소유 도메인 명시)를 그대로 따르면 된다.

## 요약

`spec/5-system/` 자체의 신규 요구사항 ID·엔드포인트·이벤트명·환경변수·파일 경로 도입은 없다(spec 델타 0). 실제 변경은 트리거/스케줄 응답 DTO 필드 보완과 `swagger-dto-contract-guard` 검증자 확장인데, 새로 도입된 DTO 클래스명(`ScheduleTriggerRefDto`·`ScheduleTriggerWorkflowRefDto`·`TriggerWorkflowRefDto`·`OptionalNullableOffender*`)·헬퍼 함수명(`isResponseDtoFile`·`findOptionalNullableResponseFields`·`expectNarrowedScheduleTriggerRef`·`omitKeys`·`stripChatChannelSecrets`·`stripInteractionSecrets`·`stripNotificationSigningSecrets`·`deleteSecretColumns`·`narrowWorkflowRef`)·모듈 상수(`NOTIFICATION_SIGNING_STRIP_KEYS`·`TRIGGER_RESPONSE_STRIP_COLUMNS`·`INTERACTION_RESPONSE_STRIP_KEYS`)를 저장소 전수 grep 으로 대조한 결과 기존 사용처와의 의미 충돌은 없었다. 새로 노출된 DTO 필드(`lastTriggeredAt`·`createdBy`·`chatChannelHealth`·`notificationHealth` 등)는 전부 이미 존재하는 엔티티 컬럼을 그대로 선언에 반영한 것이라 새 개념이 아니며, 동일 필드명이 다른 DTO(`TriggerDto`·`AlertRuleDto`)에 등장하는 경우도 의미가 일관된다(둘 다 "마지막 발화 시각"). 유일하게 적을 만한 항목은 이름이 유사한 두 "WorkflowRef" DTO 쌍인데, 이는 실제 충돌이 아니라 diff 스스로 문서화·경고해 둔 의도적 비대칭이다.

## 위험도
NONE
