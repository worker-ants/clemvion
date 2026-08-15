# API 계약(API Contract) 리뷰 — `eia-terminal-emit-facade`

## 대상 요약

`ExecutionEventEmitter.emitTerminalExecution(executionId, TerminalEventPayload)` 판별 union
파사드 도입 + 종결 이벤트(`completed`/`failed`/`cancelled`) 직접 `emitExecution` 호출 11곳
이관. 그 과정에서 `retry-turn.service.ts` `failRetryExecution` 의 CANCELLED 재진입 분기가
**종전에 emit 하지 않던 `result.cancelledBy` 필드를 새로 emit**하게 됐다(spec §6 이 항상
요구하던 필드지만 그 경로만 누락돼 있었다 — `retry-turn-terminal-guard.md` #2).

이 계열의 이벤트(`ExecutionEventType.EXECUTION_CANCELLED` 등)는 `WebsocketService.executionEvents$`
단일 소스에서 나가며, 내부 워크스페이스 WS 뿐 아니라 **External Interaction API 의 두 외부
표면 — outbound webhook notification(`NotificationFanout`→`NotificationDispatcher`, spec §3.3
EIA-NX-02 화이트리스트) 과 inbound SSE 스트림(`GET /api/external/executions/:id/stream`,
spec §5.2)** 이 동일 payload 를 **그대로(verbatim) 전달**한다
(`notification-fanout.service.ts:134` `payload: event.payload`,
`sse-adapter.service.ts` 가 `WebsocketService.executionEvents$` 를 그대로 push). 즉 이번
wire 변화는 저장소 내부 소비자에게만 국한되지 않고, 실제로 서명된 webhook 을 받는 **제3자
통합사(customer 워크플로우 트리거)** 와 SSE 를 구독하는 외부 클라이언트에게도 도달한다.

## 발견사항

- **[WARNING]** CHANGELOG 의 "수신자 영향" 분석이 저장소 내부 소비자로만 스코프돼 있고, 이 이벤트가 실제로 도달하는 **외부(제3자) webhook/SSE 소비자**를 언급하지 않는다
  - 위치: `CHANGELOG.md` (신규 섹션의 "**수신자 영향**" 문단, 게이트 16~18) ↔ 실제 fanout 경로 `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:134`, `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts`
  - 상세: `failRetryExecution` CANCELLED 분기(게이트 981~995, `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`)가 이제 `result.cancelledBy: "user"` 를 새로 emit 한다. CHANGELOG 는 이 값 유실이 "정상화되는 방향"이라 적고, 영향 대상으로 "`execution.cancelled` 구독자 중 `result` 부재를 신호로 쓰던 코드"를 들며 저장소 내 소비자(`chat-channel.dispatcher.ts` 가 `result ?? {}` 로 방어)만 grep 해 무해하다고 결론짓는다. 그러나 spec `spec/5-system/14-external-interaction-api.md` §3.3(EIA-NX-02)·§5.2 가 명시하듯, 이 `execution.cancelled` 이벤트는 **동일 payload 로 서명된 outbound webhook** 과 **SSE 스트림**을 통해 워크스페이스 외부의 제3자 통합사에게도 그대로 나간다 — 그 소비자 코드는 이 저장소에 없으므로 grep 으로 "무해"를 확인할 수 없다. 이 리팩터의 방향(spec 이 요구하던 필드를 채우는 것) 자체는 옳고 필드가 **추가**(제거/개명 아님)이므로 엄격한 JSON 파서가 아닌 한 크래시 위험은 낮지만, "취소 주체를 몰라 `result` 자체가 안 왔다"는 종전 신호에 의존해 자체 폴백 로직을 짠 외부 통합사가 있다면 그 분기가 새 값으로 바뀐다. External Interaction API 는 이 spec 이 §5.1 STATE_MISMATCH 항목에서 이미 "문서화된 계약과 실제 동작이 갈렸던 결함 수정은 breaking-change 외부 공지 대상이 아니다"라는 판단 기준을 세워둔 바 있어 이 케이스도 같은 논리로 방어 가능하지만, 그 판단을 CHANGELOG 에 **명시**하지 않은 채 "저장소 내 소비자는 무해"라는, 범위가 더 좁고 그래서 더 강해 보이는 근거만 남겼다.
  - 제안: CHANGELOG "수신자 영향" 문단에 "이 이벤트는 EIA outbound webhook(EIA-NX-02)·SSE 스트림(§5.2)으로 외부 제3자에게도 동일 payload 로 전달된다. 필드 **추가**이며 spec §6 이 처음부터 요구하던 값을 채우는 결함 수정이라 breaking 은 아니지만, `result` 부재를 신호로 쓴 외부 통합사가 있다면 관측 가능한 변화다" 정도로 외부 소비자 존재를 명시. 코드 수정은 불필요(방향은 spec 정합).

- **[INFO]** (기존 라운드에서 이미 추적 중, 재확인) `cancelledBy: 'user'` 고정값은 `failRetryExecution` 재진입 취소 분기가 실제 취소 주체를 알 수 없는 상태에서 배정하는 값이다 — 외부 API 소비자가 `cancelledBy` 로 재시도/알림 로직을 분기한다면 system/timeout 취소도 `'user'` 로 보고된다. `plan/in-progress/eia-terminal-emit-facade.md` 에 기지 한계로 명시돼 있고(§6.5 규칙상 `error` 키 부재와 자기정합적), 별도 조치는 요구하지 않음.

- **[INFO]** 응답 형식·판별 union 자체는 spec §6.3~§6.5 필드 집합과 line-level 로 일치(`completed`: `durationMs` 필수, `failed`: `durationMs`+`error` 필수(object, null 허용), `cancelled`: `durationMs`+`cancelledBy`(닫힌 3값) 필수, `error` 는 시스템 취소에만 optional 동행) — `execution-event-emitter.service.ts` 의 `TerminalEventPayload` 정의 및 `emitTerminalExecution` wire 조립부 확인. `error.message` 를 spec 의 optional 보다 엄격하게 필수로 강제하는 지점 1건은 이미 `requirement.md`(`17_54_32`)에서 INFO 로 추적 중이라 중복 등재하지 않음.

- REST 엔드포인트(`/api/external/executions/...`) 자체의 URL·페이지네이션·인증/인가·버전 관리는 이번 diff 의 변경 범위 밖(코드 5개 파일 전부 내부 이벤트 emit 조립 리팩터이며 신규/변경 HTTP 핸들러 없음) — 해당 관점은 이번 diff 에 적용 대상 없음.

## 요약

이번 변경은 신규 REST 엔드포인트나 URL/버전/페이지네이션/인증 계약을 건드리지 않는 내부 이벤트
emit 리팩터이지만, 그 산출물(`execution.cancelled` payload)은 spec 상 정의된 External
Interaction API 의 outbound webhook·SSE 라는 실제 외부 계약 표면으로 그대로 흘러간다. 이번
diff 가 고치는 방향(spec §6 이 원래 요구하던 `result.cancelledBy` 필드를 채우는 것)은 계약
정합성을 개선하는 올바른 수정이고 필드 추가라 파괴적이지 않지만, CHANGELOG 의 영향 분석이
"저장소 내부에서 grep 되는 소비자" 로만 범위를 좁혀 실제 계약 상대(외부 webhook/SSE 구독자)를
누락한 점은 API 계약 문서화 관점에서 WARNING 급 갭이다. 코드 결함은 아니다.

## 위험도
LOW
