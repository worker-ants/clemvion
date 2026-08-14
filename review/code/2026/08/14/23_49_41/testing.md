STATUS=success testing review complete — 0 CRITICAL, 1 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `finalizeFailedExecution` emit 의 `error` 값 — 특히 sentinel `code`(ERROR_PORT_FALLBACK/ExecutionTimeLimitError) 보존 여부 — 를 단언하는 테스트가 하나도 없다. 이번 diff 가 정확히 이 emit 라인을 바꿨는데도(`errMessage` 문자열 → `toTerminalErrorPayload(savedExecution.error)`), 이 PR 이 다른 3개 emit 지점(`failFirstSegmentSetup`/`finalizeStalledExhausted`/일반 Error 경로)에서 명시적으로 고친 "`status` 만 보면 `error` 자리를 바꿔도 GREEN" 문제가 같은 파일의 이 지점에는 그대로 남았다.
  - 위치: 변경된 라인 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4872` (`error: toTerminalErrorPayload(savedExecution.error),`)
  - 위치: 미보강 기존 테스트(값 무단언, `status` 만 확인) — `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:999` (`finalizeFailedExecution` 직접 호출 회귀 테스트, `expect.objectContaining({ status: ExecutionStatus.FAILED })`) 및 `:6913` (`'stops the workflow (ERROR_PORT_FALLBACK) when the error port has no connected edge'`, 같은 패턴 `expect.objectContaining({ status: 'failed' })`)
  - 상세: `finalizeFailedExecution` 은 `ErrorPortFallbackError`/`ExecutionTimeLimitError` 일 때 `savedExecution.error = { message, code }` 로 sentinel code 를 보존하고, 그 객체를 그대로 `toTerminalErrorPayload` 에 넘겨 WS emit 한다. 이 코드가 소비되는 곳은 `execution-failure-classifier.ts` 의 `event.error?.code` 분기(INTERNAL_CODES 목록에 `ERROR_PORT_FALLBACK` 포함, 없으면 "unknown code" warn 로그가 찍히는 CCH-ERR-04 경로)다. 그런데 `:999`(`finalizeFailedExecution(saved, new Error('boom'), {...})` 직접 호출) 와 `:6913`(엔드투엔드 ERROR_PORT_FALLBACK 시나리오)의 emit 단언은 둘 다 `error` 필드를 아예 검사하지 않는다 — DB 쪽(`mockExecutionRepo.query` 의 SQL 파라미터 문자열 매칭, `:6903-6909`)만 `ERROR_PORT_FALLBACK` 문자열 포함을 확인할 뿐, 같은 호출에서 나가는 WS emit 의 `error.code` 는 아무도 보지 않는다. `toTerminalErrorPayload(savedExecution.error)` 를 `null` 이나 `{code: null, ...}` 로 되돌리는 뮤턴트가 있어도 이 두 테스트는 GREEN 이다 — 이 PR 이미 3곳에서 실측(뮤테이션)으로 찾아 고친 것과 완전히 같은 형태의 갭이 같은 파일, 같은 함수에 남아 있다.
  - 제안: `:996-1000` 의 `emitSpy` 단언에 `error: { code: null, message: 'boom', nodeId: null }` 을 추가하고, `ErrorPortFallbackError`(또는 `ExecutionTimeLimitError`) 를 던지는 별도 케이스(또는 `:6910-6914` 의 기존 ERROR_PORT_FALLBACK 테스트)에 `error: expect.objectContaining({ code: 'ERROR_PORT_FALLBACK' })` 단언을 추가해 sentinel code 보존을 emit 레벨에서도 고정한다.

- **[INFO]** dispatcher 의 `toChatChannelEvent` — `errorRaw` 가 필드 없는 빈 객체(`{}`)인 경계 케이스가 테스트되지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:552-558` — `toTerminalErrorPayload(errorRaw) ?? { code:null, message:'unknown error', nodeId:null }`
  - 상세: `errorRaw` 가 `undefined`(부재)면 `toTerminalErrorPayload` 가 `null` 을 돌려줘 `message:'unknown error'` placeholder 로 폴백한다(`chat-channel.dispatcher.spec.ts` 의 "undefined / 잘못된 타입" 케이스가 커버). 그런데 `errorRaw` 가 `{}` 처럼 "객체지만 필드가 전혀 없는" 값이면 `toTerminalErrorPayload` 는 `null` 이 아니라 `{code:null, message:'', nodeId:null}` 을 돌려주므로 `??` 폴백이 발동하지 않고 `message` 가 빈 문자열이 된다 — placeholder 문구("unknown error")가 아니라 빈 문자열이 나가는 이 분기점은 어떤 테스트도 짚지 않는다. 종전 코드(`errorRaw && typeof errorRaw === 'object'` → 그대로 캐스팅)는 이 경우 `message` 필드조차 없는 객체를 그대로 내보냈으므로 동작이 이미 달라졌는데, 그 차이가 회귀 스펙에 반영돼 있지 않다.
  - 제안: `it('payload.error 가 필드 없는 객체 → message 빈 문자열로 wrap')` 케이스를 추가해 placeholder 폴백과 "필드 없는 객체" 폴백의 경계를 명시적으로 고정한다.

- **[INFO]** 프런트엔드 `handleExecutionFailed` — `error` 객체가 `message` 필드를 갖지 않는 경우(`{code, nodeId}` 뿐)가 테스트되지 않는다.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:264-276`
  - 상세: `errorMessage = payload.error?.message` 는 object 인데 `message` 가 없으면 `undefined` 가 되고, `failExecution(undefined)` 로 흘러간다. 새로 추가된 테스트(`use-execution-events.test.ts:1140-1159`)는 `message` 가 항상 있는 fixture 만 쓴다. 기존 문자열 경로와 동치라 위험도는 낮지만, §6.4 는 `message` 를 non-null 로 계약하면서도 백엔드 쪽 `toTerminalErrorPayload` 는 실제로 빈 문자열(`''`)을 채워 넣지 falsy `undefined` 는 wire 상 발생하지 않는다 — 이 사실이 프런트 fixture 에 반영돼 있지 않아 계약 경계가 암묵적이다.
  - 제안: 필수는 아니나, `message: ''` fixture 로 "빈 문자열이 그대로 렌더된다" 를 한 줄 고정하면 스토어가 `undefined` 로 새는 경로를 막는 데 도움된다.

### 요약
핵심 신규 로직(`toTerminalErrorPayload`)은 `null`/`undefined`/string/number/boolean/bigint/symbol/필드 결손 객체/입력 불변성까지 뮤테이션 근거와 함께 촘촘히 테스트돼 있고, 4개 emit 호출부 중 3곳(`failFirstSegmentSetup`, `finalizeStalledExhausted` 부모+자식, 일반 `Error` 경로, `retry-turn.service.ts`)은 이번 diff 에서 "status 만 보면 GREEN" 문제를 뮤테이션으로 실측해 값 단언으로 교체했다 — 이 PR 자신의 서술대로 회귀 방지력이 실질적으로 강화됐다. 다만 그 교훈이 같은 파일의 `finalizeFailedExecution`(sentinel code 보존 경로, 이번 diff 가 emit 라인 자체를 바꾼 곳)에는 적용되지 않아, `error.code` 값이 깨져도 잡아낼 테스트가 없는 갭이 남아 있다 — 이것이 유일한 실질적 발견이며 나머지는 경계 케이스 보강 제안 수준의 INFO 다. Mock 사용은 기존 TypeORM query-builder mock 관례를 그대로 따르고, 새 테스트들은 서로 독립적이며 의도(왜 이 값을 고정하는지)를 주석으로 명확히 설명해 가독성이 좋다.

### 위험도
MEDIUM
