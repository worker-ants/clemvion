# 신규 식별자 충돌 검토 — spec/5-system (impl-done)

## 조사 범위·방법

- `spec/5-system/` 자체의 diff-base(`origin/main`) 대비 델타는 **0개 파일** — 이 브랜치는 그 spec 영역을 바꾸지 않았다. 요구사항 ID·API endpoint·이벤트명·env var 등 "spec 이 새로 선언하는 식별자"는 존재하지 않는다.
- 실제 신규 식별자는 **구현 diff**(`origin/main...HEAD -- codebase/ spec/`, 31개 파일 / 1,535줄 순증)에서 나온다. 프롬프트 번들에서 diff 본문이 예산 절단됐으므로, 워킹트리에서 직접 `git diff origin/main...HEAD`(name-status + 파일별 diff)로 재확인했다.
- `--diff-filter=A`(순수 신규 파일) 결과는 `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` 단 1건. 나머지 30개는 기존 파일에 대한 수정(M)이며, 그 안에서 새 exported 식별자(클래스·함수·상수)가 추가됐다.
- 확인한 신규 식별자와 충돌 여부(전수 `grep`):
  - `OptionalNullableOffender`(interface) · `isResponseDtoFile` · `findOptionalNullableResponseFields`(함수) — `swagger-dto-contract-guard.ts`/`.spec.ts`/신규 fixture 3곳에만 존재. 충돌 없음.
  - `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(spec-local 상수, `swagger-dto-contract.spec.ts`) — 동일 파일 내 정의·참조. 충돌 없음.
  - `OptionalNullableOffenderFixtureDto`(양성 대조군 DTO) — fixture 파일 1곳. 충돌 없음.
  - `NOTIFICATION_SIGNING_STRIP_KEYS` · `TRIGGER_RESPONSE_STRIP_COLUMNS` · `INTERACTION_RESPONSE_STRIP_KEYS` · `omitKeys` · `narrowWorkflowRef` · `sanitizeForResponse`(구 `sanitizeChatChannelForResponse` 에서 이름 확장) — 전부 `triggers.service.ts` 모듈 스코프(비-export 함수/상수, private 메서드). 다른 파일에서 동명 정의 없음.
  - `SchedulesController.toResponse`(private 메서드) — 클래스 스코프. 다른 컨트롤러에 동명 메서드 없음(private 라 외부 노출도 없음).
  - `TriggerWorkflowRefDto`(트리거 응답 DTO) · `ScheduleTriggerWorkflowRefDto` / `ScheduleTriggerRefDto`(스케줄 응답 DTO) — 모두 이번 PR 이 신규 도입. 세 이름 자체는 서로 다르며 OpenAPI 컴포넌트 스키마 키(NestJS Swagger 는 클래스명을 스키마명으로 씀)로도 겹치지 않는다. 다만 아래 발견사항 참조.
  - 신규 `process.env.*`/`registerAs(...)` 없음 — env var·config key 축 충돌 없음.
  - 신규 HTTP endpoint(controller route) 없음 — 이번 diff 는 기존 라우트의 **응답 DTO 선언·정화 로직**만 바꾼다.

## 발견사항

- **[WARNING]** `TriggerWorkflowRefDto` ↔ `ScheduleTriggerWorkflowRefDto` — 같은 PR 이 도입한 "워크플로우 참조" DTO 두 개가 이름은 거의 동일한데 필드 구성이 다르다
  - target 신규 식별자: `ScheduleTriggerWorkflowRefDto` (`{ name }` 단일 필드) — `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:14`
  - 기존 사용처: 같은 PR 에서 나란히 신규 도입된 `TriggerWorkflowRefDto` (`{ id, name }` 2필드) — `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:17`
  - 상세: 두 타입 모두 "트리거에 연결된 워크플로우의 참조"라는 동일한 개념을 표현하지만, `TriggerWorkflowRefDto` 는 `id`+`name`, `ScheduleTriggerWorkflowRefDto` 는 `name` 만 갖는다. diff 주석은 각자의 실제 프런트엔드 소비처(`triggers/page.tsx`는 `id`+`name`, `schedules/page.tsx`는 `name`만)를 근거로 든다 — 설계 자체는 정당하다. 그러나 이름이 `Schedule` 접두어 하나만 다르고 나머지(`TriggerWorkflowRefDto`)가 완전히 동일해, 다음 사람이 두 타입을 동일 shape 로 오인하고 `id` 접근을 시도하거나(컴파일 에러로 드러나긴 하지만) 재사용을 시도할 위험이 있다. `ScheduleTriggerRefDto` 라는 별도 상위 타입까지 겹쳐 있어 `Schedule*Ref*` / `Trigger*Ref*` 네이밍 패밀리가 두 벌 생겼다.
  - 제안: (a) 필드 구성이 다름을 명시하는 이름으로 분화(예: `ScheduleTriggerWorkflowNameRefDto`) 하거나, (b) 두 타입이 실제로 동일 정보를 담아야 한다면 `TriggerWorkflowRefDto` 를 재사용하도록 통합. 최소한 각 클래스 JSDoc 에 "자매 타입 `TriggerWorkflowRefDto` 와 필드가 다름(의도적)"이라는 상호 참조 한 줄을 추가하면 향후 혼동 비용을 낮출 수 있다.

## 요약

이번 PR 은 `spec/5-system/` 문서 자체를 변경하지 않으므로(델타 0), spec 이 새로 선언하는 요구사항 ID·API endpoint·이벤트명·환경변수·spec 파일 경로 축에서는 충돌 후보가 존재하지 않는다. 실제 신규 식별자는 구현 diff(31개 파일, response-contract 스윕 관련)에서 나오며, 이들은 예외 없이 module-scope 상수/함수이거나 private 메서드, 혹은 서로 다른 이름의 신규 DTO 클래스로 — 코드베이스 전수 grep 상 기존 식별자와의 실질적 이름 충돌(CRITICAL)은 발견되지 않았다. 유일한 주목할 점은 `TriggerWorkflowRefDto`와 `ScheduleTriggerWorkflowRefDto`(+`ScheduleTriggerRefDto`)가 같은 PR에서 유사한 이름·다른 shape로 함께 도입된 것으로, 실제 충돌은 아니지만 향후 혼동 가능성이 있어 WARNING으로 남긴다.

## 위험도

LOW
