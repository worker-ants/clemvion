# API 계약(API Contract) Review

## 대상 변경 요약
`ExecuteOptions.triggerType`(`'webhook' | 'schedule'`, discriminated union 확장) 신설을 통한 execution-run 큐 priority 3-tier(`manual` > `webhook` > `schedule`) threading. 변경 파일: `execution-engine.service.ts`(+spec), `hooks.service.ts`(+spec), `schedule-runner.service.ts`(+spec), `plan/complete/exec-intake-queue-impl.md`, `plan/in-progress/exec-intake-followups.md` 체크박스, 이전 세션(`19_02_17`) ai-review 산출물(SUMMARY/RESOLUTION/reviewer 리포트) 및 `review/consistency/**` 산출물.

이 diff 는 2026-07-04 19:02:17 세션에서 이미 리뷰되고 W1~W4(주석 merge-artifact, spec/plan stale 서술) 조치가 완료된 동일 코드 변경에 대한 fresh re-review(`resolution 후 fresh review` 컨벤션)이다. 코드 로직(`execution-engine.service.ts`/`hooks.service.ts`/`schedule-runner.service.ts`)은 이전 세션 이후 변경 없음.

## 확인 사항 (내부 타입 경계 검증)

- **`ExecuteOptions` 는 컨트롤러 계약이 아니다**: `grep -rn "ExecuteOptions" codebase/backend/src` 결과 정의(`execution-engine.service.ts:368`)와 사용처(동일 파일 `execute()` 메서드 시그니처, `:3176`) 단 2곳만 존재. 어떤 `*.controller.ts` 도 이를 import 하지 않는다. `hooks.controller.ts`/`schedules.controller.ts` 는 각각 `HooksService`/`ScheduleRunnerService` 를 통해 간접적으로 `execute()` 를 호출하지만, `ExecuteOptions` 객체는 서비스 내부에서 구성되며 HTTP 요청 바디를 그대로 매핑하지 않는다.
- **DTO/swagger 미노출**: `hooks.controller.ts` 가 참조하는 응답 DTO 는 `WebhookAcceptedDto`/`EmbedConfigDto` 뿐이며 `triggerType`/`ExecuteOptions` 와 무관. Webhook 응답 바디·상태 코드(202 Accepted, `WEBHOOK_ACCEPTED_RESPONSE_CODE`)는 이 변경으로 전혀 건드리지 않는다.
- **하위 호환성**: 신규 필드 `triggerType` 은 모든 유니온 분기에서 옵셔널(`triggerType?: ExecutionRunTriggerType` 또는 `triggerType?: never`)이며, `manual`(executedBy) 분기와 no-op 분기(`{ executedBy?: never; triggerId?: never; triggerType?: never }`)는 필드가 항상 `never` — 구조적으로 breaking change 없음. 미지정 트리거는 `webhook` fallback 으로 기존 동작(이전 2-tier 시절 결과)과 동일하게 유지된다.
- **payload 경계 준수**: `triggerType` 은 `ExecutionRunJob`(BullMQ job data)에 싣지 않는다 — 코드 주석(§9.3)에 명시. BullMQ consumer/재생(rehydrate) 로직의 job payload 스키마는 변경 없음. `triggerType` 은 오직 `queue.add()` 호출 시 `priority` 숫자 계산 입력으로만 소비되며, 이 값 자체도 클라이언트에 노출되는 응답 필드가 아니다.
- **명명 충돌 없음**: `Execution.triggerSource`(DB 파생, 5-way, 실행 이력 표시용)와 `ExecuteOptions.triggerType`(우선순위 계산 전용, 2-way: webhook/schedule)은 서로 다른 별개 필드로 JSDoc + spec(§9.3 경계)에 명시적으로 문서화되어 있어 혼동 가능성이 낮다.
- **에러 응답/상태 코드**: webhook 트리거의 실제 HTTP 응답(202)이나 에러 응답 형식에 대한 변경 없음. schedule/chat-channel 트리거 경로도 동일.
- **인증/인가**: 해당 컨트롤러들의 auth guard/역할 검사 로직에는 diff 가 없다.
- **페이지네이션/URL 설계**: 목록 API·라우트 정의 변경 없음 — 해당 없음.

## 결론
검토 대상 diff 는 서비스 계층 내부 TS discriminated union 타입(`ExecuteOptions`)의 옵셔널 필드 확장이며, 어떤 컨트롤러의 `@Body()`/`@Query()` DTO, swagger/OpenAPI 스키마, HTTP 응답 바디·상태 코드에도 노출되지 않는다. 이전 세션(19_02_17)에서 이미 API 계약 관점 확인을 마쳤고, 이번 fresh re-review 도 동일 코드에 대해 같은 결론(하위 호환·breaking change 없음)을 재확인했다. Critical/Warning 없음.

## 위험도
NONE

STATUS: SUCCESS
