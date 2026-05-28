# 동시성(Concurrency) 리뷰 결과

리뷰 대상: chat-channel form native modal (§4.1) 관련 변경 40파일
리뷰 일시: 2026-05-29

---

## 발견사항

### [WARNING] `pendingFormModal` 상태의 비원자적 Read-Modify-Write — hooks.service.ts

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `form_submission` 처리 블록 (diff 기준 +2431~+2481)
- 상세: `form_submission` 명령 처리 시 다음 순서로 실행된다.
  1. `conversationService.lookup(...)` 으로 state 읽기
  2. `interactionService.interact(...)` 호출 (EIA submit_form — 외부 I/O, 수십~수백 ms 소요)
  3. `state.pendingFormModal = undefined` 변경
  4. `conversationService.upsert(...)` 로 state 쓰기

  2번 단계가 완료되기 전에 동일 사용자가 동일 대화에 대해 다른 요청(재전송, 중복 submit)을 보내면, 다른 핸들러 인스턴스가 1번 단계에서 동일한 `pendingFormModal` 이 있는 state를 읽어 EIA `submit_form`을 이중으로 호출할 수 있다. NestJS 의 single-threaded event loop 특성상 순수 동기 코드는 안전하지만, `await` 구간 사이에는 다른 요청이 interleave 된다.

  현재 코드에는 이 read-modify-write 구간을 보호하는 낙관적 잠금(optimistic lock), Redis 분산 락, 또는 idempotency 가드가 없다.

- 제안:
  1. (단기) `conversationService.upsert` 에 조건부 갱신(예: `lastUpdateAt` 버전 체크) 을 추가해 stale state 덮어쓰기 방지.
  2. (권장) `open_form_modal` / `form_submission` 처리 진입 시 Redis 분산 락을 `conversationKey` 단위로 획득 후 처리, 완료 후 해제.
  3. 최소한 `form_submission` 처리 시작 직전 `pendingFormModal` 존재 여부를 CAS(Compare-And-Swap) 방식의 업데이트로 선점(clear) 하여 중복 submit 방어.

---

### [WARNING] `renderNode` 호출 위치 변경으로 인한 form 상태 persist와 메시지 전송 사이의 시간 창 — chat-channel.dispatcher.ts

- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — diff 기준 +213~+258
- 상세: 변경 전에는 `renderNode` 가 form 상태 persist 이후에 호출되었다. 변경 후 순서:
  1. `renderNode` 호출 (adapter I/O, 외부 호출 가능)
  2. `messages` 결과를 보고 `pendingFormModal` 또는 `formState` 설정
  3. `conversationService.upsert` (state persist)
  4. 이후 코드에서 `sendMessage` (메시지 전송)

  3번 persist 전에 사용자로부터 다음 메시지가 도착하면(네트워크 reorder / 재전송 시나리오) state가 저장되지 않은 상태에서 `hooks.service` 가 `pendingFormModal = undefined` 상태를 읽게 되어 `open_form_modal` 을 no-op으로 처리한다. 이 창(window)은 짧지만, 네트워크 지연이 큰 환경(Slack/Discord API round-trip)에서는 실질적인 위험이 된다.

  renderNode 를 form 상태 분기 전으로 끌어올린 목적은 "renderer 와 dispatcher 가 mode 결정을 이중으로 하지 않는다"는 설계 원칙을 구현한 것으로 타당하나, 이 결과로 state persist → 메시지 전송이 아닌 renderNode → state persist → 메시지 전송 순서가 되어 persist 실패 시 "버튼은 전송됐으나 state 없음" 불일치 상태가 발생할 수 있다.

- 제안:
  1. `conversationService.upsert` 실패 시 메시지 전송을 차단(return early)하거나, upsert 성공 후에만 sendMessage 루프를 실행하도록 순서를 명시적으로 보장.
  2. `pendingFormModal` persist 실패를 catch하여 에러 로깅 후 degraded 처리(trigger markDegraded)하는 방어 코드 추가.

---

### [INFO] `openFormModal` 의 `await` 누락 가능성 없음 — 확인 완료

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` +2413 (`await adapter.openFormModal(...)`)
- 상세: `openFormModal` 호출이 `await` 로 올바르게 처리되어 있다. Slack 어댑터는 `views.open` API를 `await` 하고, Discord 어댑터는 `Promise.resolve()` 를 반환한다. 이벤트 루프 블로킹 없음.

---

### [INFO] `buildFormSubmissionResponse` 는 동기 메서드 — 동시성 문제 없음

- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`, `discord.adapter.ts`
- 상세: 두 어댑터 모두 `buildFormSubmissionResponse` 가 순수 동기 메서드(Promise 미반환)로 구현되어 있다. 공유 상태를 접근하지 않으므로 스레드 안전성 문제 없음.

---

### [INFO] `extractFormFields` / `decideFormMode` / `flattenViewStateValues` — 순수 함수, 동시성 문제 없음

- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`, `providers/slack/slack-update.parser.ts`
- 상세: 신규 추가된 유틸리티 함수들이 모두 side-effect 없는 순수 함수로 구현되어 있다. 공유 가변 상태 없음.

---

### [INFO] `SlackClient.viewsOpen` 은 단순 HTTP 래핑 — 커넥션 풀 이슈 없음

- 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts`
- 상세: 기존 `call<T>()` 래퍼를 그대로 재사용하므로 커넥션 풀 관리가 기존 패턴과 일치한다. 신규 풀 관련 위험 없음.

---

## 요약

이번 변경의 핵심 동시성 위험은 두 가지다. 첫째, `form_submission` 처리 시 `pendingFormModal` 상태에 대한 read-modify-write가 보호되지 않아 동일 사용자의 중복 요청이 EIA `submit_form`을 이중 호출할 수 있다(WARNING). 이는 단일 Node.js 프로세스 환경에서도 `await` 구간 사이의 request interleaving으로 재현 가능하다. 둘째, `renderNode`를 form 상태 persist 이전으로 끌어올린 설계 변경으로 인해, persist 실패 시 "버튼은 사용자에게 전달됐으나 state가 없는" 불일치 상태가 발생할 수 있다(WARNING). 나머지 신규 코드(순수 유틸리티 함수, 동기 응답 합성, HTTP 클라이언트 래퍼)는 동시성 관점에서 이상이 없다.

## 위험도

MEDIUM

---

STATUS=success ISSUES=2
