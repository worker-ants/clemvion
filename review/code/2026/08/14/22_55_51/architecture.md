# 아키텍처 리뷰 — EIA 종결(terminal) `error` payload 정규화

## 발견사항

- **[WARNING]** 신규 헬퍼 `toTerminalErrorPayload` 의 JSDoc 이 `execution.cancelled` 커버리지를 주장하지만 실제로는 어떤 취소 emit 경로에서도 호출되지 않는다 — "문서화된 보장이 실제 구현보다 넓다".
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:2` (JSDoc: `종결 이벤트(execution.failed / 시스템 execution.cancelled)의 error 를 EIA §6.4 wire 형태로 정규화한다.`)
  - 상세: `toTerminalErrorPayload` 는 `execution-engine.service.ts` 의 `failFirstSegmentSetup`(:664)·`finalizeStalledExhausted`(:3312)·`finalizeFailedExecution`(:4870), `retry-turn.service.ts` 의 `failRetryExecution`(:966) — 즉 **`EXECUTION_FAILED` 4곳에만** 배선됐다. `EXECUTION_CANCELLED` 를 emit 하는 `emitCancellationEvent`(execution-engine.service.ts:1079)와 그 5개 호출부(`cancelParkedExecution:1016`, `markExecutionCancelled:2761`, `markQueueWaitTimeout:2828`, `markWebChatIdleTimeout:1121` 등)는 여전히 `{code, message}` 를 손으로 만든다 — `code` 는 non-nullable, `nodeId`/`details` 는 아예 없다. spec 자체가 `error` 필드를 `failed`·`cancelled`(시스템 취소 한정) 공통의 단일 목표 형태(`{code, message, nodeId, details?}`, `code`·`nodeId` nullable)로 선언하는데(`spec/5-system/14-external-interaction-api.md` §6 표, `error` 행), 소비 측 타입 `EiaCancelledEvent.error`(`codebase/backend/src/modules/chat-channel/types.ts:417`, `{ code: string; message?: string }`)도 그 목표 형태보다 좁다. 이번 PR 이 정확히 "emit 지점마다 손으로 정규화하면 한 곳씩 빠진다" 는 문제의식으로 헬퍼를 만든 시점인데, 그 헬퍼 자신이 취소 경로에는 적용되지 않은 채 "적용된다" 고 문서화됐다 — 다음 사람이 JSDoc 만 믿고 취소 경로도 이미 null-정규화됐다고 오판할 수 있다.
  - 제안: JSDoc 범위를 `execution.failed` 로 좁히거나(현재 실제 구현과 일치), 이번 기회에 `emitCancellationEvent` 의 5개 호출부도 `toTerminalErrorPayload` 로 통일해 spec 이 선언한 단일 목표 형태에 실제로 도달시킨다. 후자를 별도 PR 로 미룬다면 그 결정과 근거를 plan 에 명시적으로 등재할 것(이 PR 의 plan 문서는 `error` 스코프를 "4곳"으로만 한정했고 cancelled 은 언급이 없다).

- **[WARNING]** 같은 diff 안에서 추가된 주석이 타입 선언과 어긋난다 — `nodeId` 가 "명시적 null(키 생략 아님)" 이라고 서술하지만 타입은 여전히 optional.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:397-402` (`EiaFailedEvent.error`)
  - 상세: 새로 붙은 주석 "`code`·`nodeId` 는 **명시적 `null`** 이 올 수 있다(키 생략이 아니다)" 는 두 필드 모두에 적용된다고 읽히는데, 실제 변경은 `code: string` → `code: string | null` 뿐이고 `nodeId?: string | null` 은 `?` 를 그대로 유지한다. `toTerminalErrorPayload` 는 `nodeId` 키를 항상 채운다(절대 생략하지 않는다)는 것이 이번 PR 이 세운 불변식인데, 소비 측 타입은 그 불변식보다 느슨해서 "`nodeId` 자체가 없을 수도 있다" 로 읽힌다.
  - 제안: `nodeId: string | null;` 로 `?` 를 제거해 실제 생산자 보장과 방금 추가한 주석 양쪽에 타입을 맞춘다.

- **[WARNING]** 같은 wire 형태(`{code, message, nodeId, details?}`)가 서로 참조 없이 세 곳에 독립 선언돼 있고, emit 경계 자체가 `unknown` 이라 컴파일러가 producer/consumer 정합을 전혀 검증하지 못한다.
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:30` (`TerminalErrorPayload`), `codebase/backend/src/modules/chat-channel/types.ts:399-404` (`EiaFailedEvent.error` 인라인 타입), `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:545-550` (`toChatChannelEvent` 내부 로컬 `error` 변수 타입) — 그리고 `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:40` (`emitExecution(... payload: unknown)`).
  - 상세: `execution-engine` 모듈이 `TerminalErrorPayload` 로 값을 만들어도 `emitExecution`/`emitExecutionEvent` 는 `payload: unknown` 으로 받기 때문에 그 타입 정보가 전송 경계에서 소실된다. `chat-channel` 쪽은 받은 값을 다시 `unknown` → 로컬 인라인 타입으로 캐스팅(`as typeof error`)해서 소비한다. 결과적으로 같은 개념(§6.4 종결 error)을 표현하는 타입이 두 모듈에 각각 독립적으로 3벌 존재하며 그 사이를 연결하는 컴파일 타임 체크가 없다. 이 PR 의 동기 자체가 "손으로 하면 한 곳씩 빠진다" 인데, 정작 producer→consumer 경계에서는 여전히 사람이 형태를 맞춰야 하는 구조가 남았다(위 두 WARNING 이 실제로 그 틈에서 발생했다).
  - 제안: `TerminalErrorPayload` 를 `execution-engine` 밖으로(예: `chat-channel` 도 참조 가능한 shared 위치나 `shared/` 로) 승격해 `types.ts` 의 `EiaFailedEvent.error` 가 그 타입을 직접 참조하게 하거나, 최소한 두 선언에 "동기화 필요" 주석을 상호 링크한다. 강한 결합을 원치 않으면 emit 경계에 discriminated payload 타입(이벤트 타입별 payload 유니온)을 도입해 `unknown` 을 좁히는 것도 대안.

- **[INFO]** `chat-channel.dispatcher.ts` 의 `execution.failed` 케이스에 과거 조사 경위를 서술하는 긴 내러티브 주석이 프로덕션 코드에 남아 있다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:536-543`, `560-567`
  - 상세: "종전 주석이 가리키던 plan 이 존재한 적이 없다", "`git log --diff-filter=A` 0건" 같은 조사 과정 서술은 그 자체로 가치 있는 기록이지만 소스 코드 주석보다는 plan/handoff 문서에 남기는 편이 레이어 책임에 더 맞는다(코드 주석은 "왜 이 코드가 이 형태인가", 조사 일지는 plan). 코드 자체 로직은 간결하고 옳다 — 순수 스타일 관찰이며 차단 사유는 아니다.
  - 제안: 필요하면 요약 1~2줄만 남기고 조사 경위 전문은 `plan/in-progress/eia-terminal-payload.md`(이미 재판정 ③ 로 기록돼 있음)로 이동.

## 요약

핵심 변경(신규 `terminal-error-payload.ts` 헬퍼 + 4개 `EXECUTION_FAILED` emit 지점 배선)은 SRP·DRY 관점에서 잘 설계됐다 — DB 저장 객체와 wire 전송 객체를 같은 리터럴로 묶어 과거 실제로 발생했던 drift(stalled 경로의 `attempts` 누락)를 구조적으로 재발 방지하고, 순수 함수로 분리해 모듈 결합도를 낮췄으며(execution-engine 내부에서만 import, 순환 의존 없음), `finalNodeId`/`finalPort` 같은 유령 필드 제거도 실측(0건 소비) 기반이라 근거가 탄탄하다. 다만 이 PR 이 스스로 세운 "정규화는 한 곳에서, 손으로 하면 빠진다" 는 원칙이 `execution.cancelled` 경로까지는 확장되지 않은 채, 새 헬퍼의 JSDoc 만 그 범위를 주장하고 있고(문서가 구현보다 넓음), `EiaFailedEvent`/`TerminalErrorPayload`/dispatcher 로컬 타입 3중 독립 선언 + emit 경계의 `unknown` 타입이 producer/consumer 정합을 컴파일러가 못 보게 만들어 이번에 잡은 `nodeId` optional 잔존 같은 미세한 불일치가 다시 스며들 통로로 남아 있다. 전부 WARNING 수준이며 런타임 동작 자체를 깨뜨리지는 않는다(각 호출부는 항상 non-null 객체를 넘기므로 실사용 경로에서 관측되는 결함은 아니다).

## 위험도

LOW
