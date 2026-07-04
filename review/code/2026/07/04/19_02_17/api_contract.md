# API 계약(API Contract) Review

## 대상 변경 요약
`ExecuteOptions.triggerType`(내부 유니온 타입, `'webhook' | 'schedule'`) 필드 추가를 통한 execution-run 큐 priority 3-tier(`manual` > `webhook` > `schedule`) threading. 변경 파일: `execution-engine.service.ts`(+spec), `hooks.service.ts`(+spec), `schedule-runner.service.ts`(+spec), `plan/complete/exec-intake-queue-impl.md`, consistency-check 산출물, `spec/5-system/4-execution-engine.md` 상태 배너.

## 확인 사항
- `ExecuteOptions`는 `execution-engine.service.ts` 내부에서만 쓰이는 TS 타입으로, 어떤 컨트롤러의 `@Body()` DTO 도 아니고 swagger/OpenAPI 스키마에도 노출되지 않는다. `execute(workflowId, input, options)`는 서비스 계층 내부 메서드이며 HTTP 요청 바디를 그대로 매핑하지 않는다.
- 신규 필드 `triggerType`은 모든 유니온 분기에서 옵셔널(`triggerType?: ExecutionRunTriggerType` 또는 `triggerType?: never`)이며, 기존 호출부(`executedBy` 전용 manual 분기, `{ executedBy?: never; triggerId?: never }` no-op 분기)는 변경 없이 컴파일된다 — 구조적으로 하위 호환.
- `triggerId` 전달 시 `triggerType` 미지정이면 `execute()` 내부에서 `'webhook'`으로 fallback — 기존 호출부(있다면)의 동작을 변경하지 않고 이전과 동일한 결과(webhook priority)를 낸다.
- `triggerType`은 `ExecutionRunJob` payload(BullMQ job data)에는 포함되지 않는다(코드 주석 §9.3 명시) — BullMQ job consumer/재생 로직에 대한 스키마 변경 없음. 오직 `queue.add()`의 `priority` 숫자 계산 입력으로만 소비된다.
- 실행 이력 표시용 `Execution.triggerSource`(DB 파생 필드, 5-way)와는 명시적으로 분리된 별개 필드로 문서화되어 있어(JSDoc + spec) 명명 혼동으로 인한 외부 응답 스키마 오염 가능성 없음.
- HTTP 엔드포인트(webhook controller, schedule trigger, chat-channel inbound)의 요청/응답 스키마, 상태 코드(202 Accepted 등), 인증/인가 로직에는 변경이 없다. `hooks.service.ts`의 diff는 `execute()` 호출 시 넘기는 내부 옵션 객체에 `triggerType: 'webhook'` 리터럴을 추가한 것뿐, `WebhookInput`/응답 타입/에러 응답 형식은 그대로다.
- `schedule-runner.service.ts` 변경도 동일하게 내부 `execute()` 호출 인자에 한정되며, cron job 데이터 스키마(`ScheduleJobData`)나 공개 API에는 영향 없음.
- 우선순위 값(`EXECUTION_RUN_PRIORITY.manual/webhook/schedule`)은 BullMQ 내부 큐 처리 순서 제어용으로, 클라이언트에게 노출되는 응답 필드나 상태 코드가 아니다.
- consistency-check 산출물(`review/consistency/...`)과 spec 배너 갱신(`spec/5-system/4-execution-engine.md`)은 문서/메타 변경으로 API 계약에 직접 영향 없음.

이전 세션(`consistency-check --impl-prep`, 2026-07-04 18:33:09)에서도 동일 결론(`convention_compliance` checker: "ExecuteOptions=내부 타입(swagger 무관)") 확인됨 — 본 리뷰와 일치.

## 발견사항
없음.

## 요약
이번 변경은 실행 엔진 내부 우선순위 계산용 TS 타입(`ExecuteOptions.triggerType`)에 옵셔널 필드를 추가하고 3개 내부 호출부(webhook/chat-channel hooks, schedule-runner)에서 이를 채워 넣는 구현으로, 공개 HTTP API(컨트롤러 DTO, 응답 스키마, 에러 형식, URL 설계, 페이지네이션, 인증/인가)에는 어떤 표면도 변경하지 않는다. BullMQ job payload 에도 신규 필드를 싣지 않도록 명시적으로 경계를 지켰고, 모든 신규 필드는 옵셔널이라 하위 호환성 문제가 없다. API 계약 관점에서 리뷰 대상이 되는 변경이 없다.

## 위험도
NONE

STATUS: SUCCESS
