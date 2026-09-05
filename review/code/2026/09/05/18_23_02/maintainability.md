# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `sanitizeForResponse()` 안에서 `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 두 번 순회하는데, 첫 번째 순회(`overrides[column] = undefined`)는 실질적으로 죽은 코드다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:563-566` (`overrides[column] = undefined` 루프) 및 `:587-590` (`delete sanitized[column]` 루프) — 메서드 전체는 `:554-592`.
  - 상세: 함수는 (1) `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 순회하며 `overrides[column] = undefined` 를 채우고, (2) `Object.assign(Object.create(...), trigger, overrides)` 로 `sanitized` 를 만든 다음, (3) 같은 컬럼 목록을 **다시** 순회하며 `delete sanitized[column]` 을 무조건 실행한다. 이 함수는 동기 함수라 (2)와 (3) 사이에 다른 코드가 `sanitized` 를 관찰할 기회가 없고, (3)의 `delete` 는 `overrides` 에 그 키가 있었는지 여부와 무관하게 항상 실행된다. 즉 (1)이 있든 없든 최종 `sanitized` 상태는 동일하다 — `overrides[column] = undefined` 단계는 함수 동작에 아무 영향을 주지 않는 죽은 코드다. `Object.assign` 인자 순서를 바꿔도(예: `overrides` 를 먼저 놓아도) (3)의 무조건 `delete` 가 항상 최종 안전성을 보장하므로, (1)이 "혹시 모를 순서 변경에 대비한 방어" 역할도 하지 못한다. 이 메서드는 평문 서명 secret(`notificationSecretV2`)을 응답에서 제거하는 보안 경계 코드라, 불필요한 이중 처리가 있으면 다음에 이 코드를 만지는 사람이 "왜 undefined 로 먼저 채우고 나중에 delete 하지?"를 오해하며 검토 비용을 늘린다.
  - 제안: `overrides[column] = undefined` 루프(및 그 목적의 주석)를 제거하고, `Object.assign` 이후의 무조건 `delete` 루프 하나만 남긴다. 정 두 단계를 유지하고 싶다면 왜 필요한지(예: 향후 `Object.assign` 인자 순서가 바뀔 가능성에 대한 방어) 를 주석에 명시하되, 현재는 그 근거가 성립하지 않으므로 단순화가 맞다.

- **[INFO]** `SchedulesController.toResponse()` 에서 `schedule.trigger` 를 담는 변수명이 `t` 로, 이 컨트롤러 파일의 다른 코드(`id`, `workflowId` 등 서술적 이름 사용)와 비교해 유독 축약돼 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:68` (`const t = schedule.trigger;`), 사용처 `:71-77`.
  - 상세: 이 메서드는 이 PR 의 핵심 보안 목적(트리거 엔티티 전체가 조인을 타고 새 나가던 것을 참조 4필드로 좁힘)을 담당하는 자리다. 위쪽 JSDoc 은 상세하게 배경을 설명하는데, 정작 본문의 핵심 변수는 `t` 로만 표기돼 있어 짧은 스코프(13줄)임에도 가독성이 한 단계 떨어진다.
  - 제안: `t` → `trigger` 로 변경. (`Trigger` 타입 임포트와 이름이 겹치지만 변수/타입 네임스페이스가 달라 충돌 없음.)

- **[INFO]** "이미 응답에 실려 나가고 있었다 …" 로 시작하는 동일한 설명 주석 블록이 4개 DTO 파일에 거의 그대로 반복된다.
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:55-58`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:118-122`, `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:93-97`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:65-74`.
  - 상세: 코드 중복은 아니고 설명 주석의 중복이라 당장 위험도는 낮다. 다만 이 서사(§5.4 스윕 경위)를 나중에 정정해야 할 일이 생기면 4곳을 일일이 찾아 동기화해야 한다. 각 DTO 가 FE 참조 수처럼 파일별로 다른 정보도 담고 있어 완전한 추출은 어렵지만, 공통 도입부만이라도 한 곳(예: `response-contract.ts` 상단 또는 CHANGELOG)을 가리키는 짧은 참조로 줄이는 것을 고려할 수 있다. 이번 PR 범위에서는 각 파일이 자기완결적으로 맥락을 담아야 한다는 프로젝트 관례(스펙/근거는 해당 문서에)와 충돌하지 않으므로 차단 사유는 아니다.
  - 제안: 즉시 조치 불필요. 다음에 이 서사를 정정할 일이 생기면 4곳 전체를 grep 으로 찾아 동기화할 것.

## 요약

이번 변경은 §5.4 응답-계약 스윕의 실측 결과를 DTO 선언에 반영하고, 트리거 관련 두 비밀 컬럼(`notificationSecretV2`, `chatChannelTokenV2`)의 응답 유출을 서비스·컨트롤러 두 경계에서 각각 틀어막는 작업이다. 전반적으로 네이밍이 명확하고(`TRIGGER_RESPONSE_STRIP_COLUMNS`, `sanitizeForResponse`, `ScheduleTriggerRefDto` 등), 각 결정의 배경(왜 `select: false` 를 안 썼는지, 왜 서비스가 아니라 컨트롤러에서 좁히는지)이 코드 인접 주석으로 잘 남아 있어 가독성이 높다. `SchedulesController.toResponse()` 를 4개 메서드에서 공유하는 방식은 중복을 잘 제거한 사례다. 유일한 실질적 지적은 `triggers.service.ts` 의 `sanitizeForResponse()` 에서 컬럼을 "undefined 로 채운 뒤 delete" 하는 이중 순회 중 앞쪽 순회가 기능적으로 죽은 코드라는 점이며, 이는 버그는 아니지만 보안 경계 코드의 불필요한 복잡도를 늘린다. 나머지는 사소한 네이밍·주석 중복 수준의 INFO 다.

## 위험도

LOW
