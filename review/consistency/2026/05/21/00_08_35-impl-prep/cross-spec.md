# Cross-Spec 일관성 검토 결과 — PR2 (External Interaction API 구현)

검토 대상: `plan/in-progress/external-interaction-api.md` §P1~P10  
권위 spec: `spec/5-system/14-external-interaction-api.md`  
검토 기준: R1~R12 결정 및 인접 spec과의 정합성  

---

## 발견사항

### 1. R10 (단일 sink 정책 유지) — P6 after-commit hook 설계

- **[WARNING]** P6 의 "ExecutionEngine after-commit hook 으로 NotificationDispatcher 트리거" 문구가 구체적 메커니즘을 명시하지 않아, 구현자가 `ExecutionEngineService` 내부에 NotificationDispatcher 의존성을 직접 inject 할 여지가 있음
  - target 위치: `plan/in-progress/external-interaction-api.md` §P6 설명 및 §2.5 sse-adapter 항목
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R10 ("엔진 내부 코드가 직접 호출하지 않음"), §9.3 (after-commit hook 또는 outbox pattern), `spec/5-system/4-execution-engine.md` §4.4 단일 sink 정책
  - 상세: R10 의 구조는 `ExecutionEngine → WebsocketService.emitToExecution → (Redis pub/sub) → SSE 어댑터` 이며, NotificationDispatcher 는 엔진 외부에서 after-commit 신호를 받아야 한다. 현재 코드베이스를 보면 `ExecutionEventEmitter` facade 가 이미 `WebsocketService` 의 thin wrapper 로 존재하며(`execution-event-emitter.service.ts`), 이 facade 를 확장해 Redis pub/sub 또는 outbox 이벤트를 추가 emit 하는 것이 R10 준수 경로다. P6 설명은 이 경로를 명시하지 않아 "엔진에 직접 import" 오해를 낳을 수 있음
  - 제안: P6 항목에 "NotificationDispatcher 는 `ExecutionEventEmitter` 의 Redis pub/sub 브로드캐스트를 구독하는 별도 리스너로 구현 — 엔진 코드에서 NotificationDispatcher 를 직접 inject/호출 금지" 문장을 명시적으로 추가. P3 checklist 에도 "엔진 import 없음" 확인 항목 추가

---

### 2. R11 (external prefix 분리) — `@Controller('api/external/executions')` vs global prefix

- **[CRITICAL]** `main.ts` 에 `app.setGlobalPrefix('api')` 가 설정되어 있으므로, `@Controller('api/external/executions')` 를 그대로 사용하면 실제 라우트가 `/api/api/external/executions/...` 로 이중 prefix 등록된다
  - target 위치: `plan/in-progress/external-interaction-api.md` §2.3 Inbound 컨트롤러 (`@Controller('api/external/executions')`)
  - 충돌 대상: `codebase/backend/src/main.ts` line 62 (`app.setGlobalPrefix('api')`), `spec/5-system/14-external-interaction-api.md` §R11 (`/api/external/executions/*` prefix), §10 구현 파일 구조 주석 (`@Controller('api/external/executions')`)
  - 상세: NestJS 의 `setGlobalPrefix('api')` 는 모든 컨트롤러 경로에 `/api/` 를 자동 prepend 한다. `@Controller('api/external/executions')` 를 쓰면 `/api/api/external/executions` 가 된다. 올바른 컨트롤러 데코레이터는 `@Controller('external/executions')` 이어야 spec 의 `/api/external/executions/*` 라우트와 정합한다. 같은 이슈가 spec §10 의 주석에도 그대로 기재되어 있어 spec 자체에도 오기가 있음
  - 제안: plan §2.3 및 spec §10 의 `@Controller('api/external/executions')` 를 `@Controller('external/executions')` 로 정정. e2e 시나리오 A~G 의 URL 검증 시 `/api/external/executions/...` 가 되는지 확인하는 assertion 추가

---

### 3. R6 (Notification 자동 비활성화 금지) — P3 NotificationDispatcher 정합

- **[INFO]** P3 plan checklist 가 "5회 실패 시 `Trigger.notificationHealth='degraded'` + `notification_last_error` 갱신 (자동 비활성화 금지)" 를 명시하고 있어 R6 / EIA-NX-07 과 정합함
  - target 위치: `plan/in-progress/external-interaction-api.md` §2.4
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R6, EIA-NX-07
  - 상세: plan 과 spec 이 일치. 단, `trigger.is_active` 를 절대 수정하지 않는다는 단위 테스트 assertion 이 §4 테스트 목록에 명시되어 있지 않아 회귀 위험이 잠재함
  - 제안: §4 NotificationDispatcher unit test 항목에 "실패 5회 후 `trigger.isActive` 가 변경되지 않았음을 명시적으로 assert" 항목 추가

---

### 4. R7 (seq 동일 공유) — seq 카운터 미구현 상태

- **[CRITICAL]** `seq` monotonic counter 가 현재 코드베이스 어디에도 구현되어 있지 않다. `WebsocketService.emitExecutionEvent` 는 payload 에 `seq` 필드를 포함하지 않으며, `Execution` entity 에도 seq 컬럼이 없다
  - target 위치: `plan/in-progress/external-interaction-api.md` §P5 (SSE adapter — `seq` 값은 WS §2.2 의 monotonic counter 그대로 사용), §2.5 마지막 bullet
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R7, EIA-NX-08, EIA-IN-07; `spec/5-system/6-websocket-protocol.md` §2.2 (seq 설명에 "외부 SSE 의 `id:` / Outbound Notification 의 `seq` 와 동일 값 공유" 라고 기술되어 있으나 현재 `broadcastToChannel` 호출에 seq 가 없음)
  - 상세: WS spec §2.2 에 seq 정의가 있고, EIA spec 이 "그대로 재사용" 을 전제하지만, 실제 `WebsocketGateway.broadcastToChannel` / `WebsocketService.emitExecutionEvent` 코드에 seq 발행 로직이 전혀 없다. P5 SSE adapter 가 "WS seq 그대로 사용" 이라고 명시하고 있는데, 그 seq 자체가 없으므로 P5 가 의존하는 선행 조건이 충족되지 않는다. P2 또는 별도 phase 에서 seq 카운터 신설 여부를 명시적으로 결정해야 한다
  - 제안: P2 (InteractionTokenService) 전 또는 P1 에 "Execution-scoped seq counter 신설 (Redis Incr 또는 in-memory atomic counter, WS emit 에도 seq 필드 추가)" phase-item 을 추가하거나, P5 의 선행 조건으로 seq 구현을 명시. SSE adapter 가 자체 별도 카운터를 쓰는 것은 R7 위반이므로 금지 항목으로 명시

---

### 5. R4 (per_execution default) — P6 Hooks 응답 확장

- **[INFO]** P6 / §2.6 항목이 "interaction.enabled=true + tokenStrategy='per_execution' 일 때" 조건을 정확히 명시하고 있어 R4 및 spec §4.1 과 정합
  - target 위치: `plan/in-progress/external-interaction-api.md` §2.6
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §4.1, §R4
  - 상세: plan 에 `per_trigger` 일 때 `interaction` 필드를 응답에 포함하지 않는다는 명시는 없으나, §4.1 spec 에 "tokenStrategy=per_execution 일 때만 동봉" 이 명시되어 있어 구현 시 spec 을 참조하면 충분. 그러나 plan §2.6 에 per_trigger 케이스 처리를 명시적으로 추가하면 회귀 방지에 도움
  - 제안: §2.6 에 "tokenStrategy='per_trigger' 이면 응답에 interaction 필드 미동봉 (호출자가 이미 itk_* 보유)" 명시 추가

---

### 6. EIA-RL-04 (트랜잭션 commit 후 emit) — P3 / P5 / P6 설계

- **[WARNING]** P6 의 "Websocket emit 직후 SSE fan-out" 문구가 트랜잭션 commit 후 보장 여부를 명확히 하지 않아, 구현자가 트랜잭션 commit 전에 emit 할 위험이 있음
  - target 위치: `plan/in-progress/external-interaction-api.md` §P6 설명 "Websocket emit 직후 SSE fan-out"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R10, §9.3 (EIA-RL-04), `spec/5-system/4-execution-engine.md` §1.1 원자성 보장 주석 ("WebSocket 이벤트 발행은 트랜잭션 commit 후 수행"), `execution-engine.service.ts` 의 `updateExecutionStatus` 헬퍼 주석
  - 상세: 현재 `ExecutionEngineService.updateExecutionStatus` 헬퍼 javadoc 에도 "WebSocket emit 은 본 헬퍼 호출 후 수행해야 한다" 고 명시되어 있다. P6 의 SSE fan-out 은 WS emit 이 발생하는 시점에 Redis pub/sub 을 통해 SSE adapter 가 수신하는 구조이므로 이미 트랜잭션 commit 이후이다. NotificationDispatcher 도 동일 Redis 채널을 구독하거나 after-commit outbox pattern 을 따르면 EIA-RL-04 를 자동으로 충족한다. 문제는 P6 가 이 인과 관계를 명시하지 않아 잘못된 구현(트랜잭션 중간에 enqueue)이 가능하다는 점
  - 제안: P3 checklist 에 "NotificationDispatcher.enqueue() 는 `updateExecutionStatus` 트랜잭션 commit 완료 이후 (after-commit callback 또는 WS emit 이후) 에만 호출" 항목 추가. P6 설명을 "TX commit → WebsocketService emit → (Redis pub/sub) → SSE fan-out + (동일 채널 또는 after-commit hook) → NotificationDispatcher enqueue" 순서로 명확히 기술

---

### 7. Hooks 응답 호환성 — 기존 e2e 회귀

- **[WARNING]** 기존 `webhook-trigger.e2e-spec.ts` 의 시나리오 A 는 `res.body.data.executionId` 만 assert 하므로 신규 `status` / `interaction` 필드 추가 후에도 회귀가 없다. 그러나 Swagger 문서의 `WebhookAcceptedDto` 가 `{ executionId, message }` 만 정의되어 있어 자동 문서가 신규 필드를 누락한 채 배포될 수 있음
  - target 위치: `plan/in-progress/external-interaction-api.md` §P6 / §2.6
  - 충돌 대상: `codebase/backend/src/modules/hooks/dto/responses/webhook-response.dto.ts` (현재 `executionId` + `message` 만 정의), `spec/5-system/14-external-interaction-api.md` §4.1 확장 응답 shape
  - 상세: 기존 e2e 테스트는 `{ executionId }` 만 확인하므로 신규 필드가 추가되어도 회귀 없음 (하위 호환). 단, `WebhookAcceptedDto` 에 `status?: string` 과 `interaction?: InteractionTokenDto` 의 `@ApiProperty` 가 추가되지 않으면 Swagger 문서가 신규 shape 를 반영하지 못한다. 문서 불일치는 외부 통합 개발자가 spec 과 다른 내용을 보게 되는 직접 사용성 문제
  - 제안: P6 / §2.6 checklist 에 "WebhookAcceptedDto 에 `status`, `interaction` 필드 `@ApiProperty` 추가" 항목 명시. P4 checklist 의 Swagger scheme 등록과 함께 처리

---

### 8. AI Agent multi-turn 종료 포트 enum — finalPort 정합

- **[INFO]** spec §6.3 의 `finalPort` 허용값은 `"out" | "completed" | "<condition.id>" | "user_ended" | "max_turns" | "error"` 이며, AI Agent multi-turn 포트 (`spec/4-nodes/3-ai/1-ai-agent.md` §3.2) 는 `{condition.id}` / `user_ended` / `max_turns` / `error` 를 정의한다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.3 `result.finalPort`
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 Multi Turn 모드 포트 목록
  - 상세: AI Agent multi-turn 에는 `out` 포트가 없음 ("Multi Turn 모드에는 `out` 포트가 존재하지 않는다" 명시). 따라서 EIA §6.3 의 `finalPort: "out"` 은 Single Turn 및 condition 0개 single-turn 전용이다. multi-turn 종료 시 NotificationDispatcher 가 `finalPort: "out"` 을 발송하는 경우는 없어야 한다. P3 dispatcher 구현에서 이 분기를 명확히 해야 한다
  - 제안: P3 NotificationDispatcher 의 `execution.completed` payload 빌더가 `finalPort` 를 `NodeExecution` 의 port 필드에서 가져올 때, AI Agent multi-turn 의 경우 `user_ended` / `max_turns` / `{condition.id}` 중 하나임을 확인하는 단위 테스트 추가

---

### 9. Information Extractor multi-turn `completed` 포트 — finalPort enum 포함 여부

- **[INFO]** `spec/4-nodes/3-ai/3-information-extractor.md` §3.2 에 `completed` 포트가 정의되어 있고, EIA §6.3 의 `finalPort` 에 `"completed"` 가 포함되어 있어 정합함. P3 dispatcher 가 이를 반영하는지는 구현 단계 확인 필요
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.3 (`"completed"` 포트 언급)
  - 충돌 대상: `spec/4-nodes/3-ai/3-information-extractor.md` §3.2 (`completed` / `user_ended` / `max_turns` / `error` 포트 목록)
  - 상세: EIA §6.3 의 주석 ("Information Extractor multi-turn 의 정상 종료 포트") 은 `completed` 를 명시한다. information-extractor 의 single-turn 종료 포트는 `out` 이며 `completed` 가 아니다. multi-turn 에서만 `completed` 가 올바른 finalPort. P3 dispatcher 가 `finalPort` 를 올바르게 매핑하려면 NodeExecution 의 port 값을 그대로 사용하면 되므로 별도 변환 없이 정합 가능
  - 제안: §4 단위 테스트 항목에 "information_extractor multi-turn 정상 종료 시 finalPort='completed', single-turn 정상 종료 시 finalPort='out'" 케이스 명시

---

### 10. Conversation Thread `source` 마커 fallback — P5 SSE adapter / P6 Hooks payload

- **[INFO]** EIA spec §5.3 / §6.2 의 `conversationThread` payload 가 `source` 마커 누락 시 `'live'` 폴백을 적용하도록 명시되어 있으며, 이는 `spec/5-system/6-websocket-protocol.md` §4.4.6 의 "필드 누락 시 `'live'` 로 간주" 폴백 규약 (`spec/conventions/conversation-thread.md` §1, WS spec line 524) 과 정합함
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.3 / §6.2 `context.conversationThread` 주석
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.4.6, `spec/conventions/conversation-thread.md` §1.1~§1.2
  - 상세: P5 SSE adapter 는 WebsocketService 가 이미 emit 한 이벤트를 Redis pub/sub 으로 수신해 SSE 로 포워딩하는 구조이므로, WS 페이로드에 이미 포함된 `source` 마커가 그대로 SSE 스트림에 실린다. NotificationDispatcher 가 별도로 conversationThread 를 조회해 payload 를 구성하는 경우에만 `source` 마커 fallback 처리가 필요하다. P3 계획에 이 분기가 명시되어 있지 않음
  - 제안: P3 NotificationDispatcher 의 `execution.waiting_for_input` payload 빌더가 `conversationThread` 를 포함할 때, `messages[].source` 가 없는 레거시 데이터에 대해 `'live'` 폴백을 적용하는 로직을 명시. SSE adapter (P5) 는 WS payload 를 그대로 relay 하므로 별도 처리 불필요

---

## 요약

가장 심각한 두 문제는 CRITICAL 등급이다. 첫째, `main.ts` 의 global prefix `'api'` 와 plan / spec §10 의 `@Controller('api/external/executions')` 가 이중 prefix 를 만들어 모든 inbound 엔드포인트가 `/api/api/external/...` 로 잘못 등록되는 실제 라우팅 오류다 — spec 과 plan 양쪽의 컨트롤러 데코레이터를 `@Controller('external/executions')` 로 수정해야 한다. 둘째, spec 이 전제하는 `seq` monotonic counter 가 현재 코드베이스 (`Execution` entity, `WebsocketService`) 에 전혀 구현되어 있지 않아, P5 SSE adapter 가 "WS seq 그대로 사용" 한다는 선행 조건이 충족되지 않는다 — 이를 P1 또는 P2 에서 명시적으로 신설하지 않으면 R7, EIA-NX-08, EIA-IN-07 이 모두 작동 불가다. WARNING 등급 두 건 (R10 단일 sink 구체화 누락, EIA-RL-04 commit 후 emit 순서 미명시) 은 구현자 오해로 이어질 수 있어 plan 수정이 권장된다. 나머지 INFO 항목은 단위 테스트 coverage 보강과 DTO Swagger 갱신 수준의 후속 조치로 해소 가능하다.

---

## 위험도

**CRITICAL**

STATUS: BLOCK
