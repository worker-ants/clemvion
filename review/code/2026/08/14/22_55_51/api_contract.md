# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `execution.failed` outbound 이벤트의 `error` wire 형태가 string → object 로 바뀌고, 기존 폴백 코드 `'INTERNAL_ERROR'` 가 `null` 로 대체됐다 — 실제 webhook/SSE 구독자에게 노출되는 breaking change인데 버전 신호가 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:42` (`toTerminalErrorPayload` 정의부, `code: null` 규범), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664` (`error: toTerminalErrorPayload(row.error)`), `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:555~567` (구 `'INTERNAL_ERROR'` fallback 제거 근거 주석)
  - 상세: `execution-engine.service.ts`/`retry-turn.service.ts` 의 4개 `EXECUTION_FAILED` emit 지점이 전부 `toTerminalErrorPayload` 를 거치도록 바뀌었고, 이 함수는 DB 객체에 `code` 가 없으면 `null` 을 채운다. 이 값은 `notification-fanout.service.ts:134` (`payload: event.payload` — 가공 없이 그대로 전달)를 거쳐 실제 webhook/SSE 로 나간다. 이전에는 (a) 엔진이 문자열을 emit 하던 4곳, (b) `chat-channel.dispatcher.ts` 가 그 문자열을 `{code:'INTERNAL_ERROR', message}` 로 감싸던 경로가 있었다. 지금은 두 경우 모두 `{code: null, message, nodeId: null}` 객체가 된다 — 기존에 `error` 를 문자열로 파싱하던 외부 통합자, 또는 `error.code === 'INTERNAL_ERROR'` 로 분기하던 통합자는 이번 배포로 조용히 깨진다. `spec/5-system/2-api-convention.md:31` 은 "버전은 URL 경로에 포함하지 않음(Accept 헤더 또는 단일 버전 운영)" 이라 명시해 이런 종류의 wire 변경을 걸러낼 버전 게이트가 애초에 없다. 다만 spec §6.4 가 이미 이 object 형태를 목표 계약으로 선언해 두었던 점(#1169)을 감안하면 "의도된 계약 완성" 이라는 근거는 있다 — 그래도 실제 구독자 관점에서는 옵트인 신호 없는 shape 변경이라는 사실은 남는다.
  - 제안: PR 설명(및 가능하면 릴리스 노트)에 "`error` 가 string 일 수도 있던 legacy 동작이 이제 항상 object" 라는 문구를 명시하고, 기존 외부 통합 문서(있다면)에 이 변경을 반영할 것. 가능하면 `Accept` 헤더 기반 단일 버전 운영 정책에 맞춰 최소한 changelog 형태로 소비자에게 신호를 남기는 것을 권장.

- **[WARNING]** `execution.cancelled` 의 `error` 는 이번 PR 이 정한 `null`-vs-생략 규칙에서 빠졌다 — 같은 spec 표 행이 `failed`/`cancelled` 를 같은 target shape 로 묶는데 실제로는 서로 다른 형태다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1083` (`emitCancellationEvent` 의 `opts.error?: { code: string; message: string }` — 이번 diff 미포함, 직접 확인), `codebase/backend/src/modules/chat-channel/types.ts:413` (`EiaCancelledEvent.error?: { code: string; message?: string }` — 이번 diff 미포함, 직접 확인). 대조군: `codebase/backend/src/modules/chat-channel/types.ts:400~402`(diff 반영된 `EiaFailedEvent.error` — `code: string | null`, `message: string`, `nodeId?: string | null`)
  - 상세: `spec/5-system/14-external-interaction-api.md` §6 필드 표(`error` 행)는 `failed`, `cancelled`(시스템 취소 한정) 모두 목표 형태를 `{code, message, nodeId, details?}` 로 규정하고 "`code`·`nodeId` 는 `null` 일 수 있다" 고 못박는다. 이번 PR 은 `failed` 경로 4곳을 `toTerminalErrorPayload` 로 정규화했지만, `cancelled` 를 만드는 `emitCancellationEvent`(4개 호출부 — `cancelParkedExecution`·`markExecutionCancelled`·`markQueueWaitTimeout`·`markWebChatIdleTimeout`)는 plan 이 "이미 객체라 손대지 않는다" 고 판단해 스코프에서 제외됐다. 그런데 "이미 객체" 인 것과 "§6.4 규범 형태" 인 것은 다르다 — 실제로 `emitCancellationEvent`/`EiaCancelledEvent` 는 `code` 가 non-nullable, `nodeId` 키가 아예 없음(생략), `message` 가 optional 이라 `EiaFailedEvent` 와 형태가 어긋난다. 같은 이벤트 카테고리(terminal error)를 다루는 두 이벤트 타입이 다른 스키마를 갖는 것은 외부 수신자의 공용 파서 작성을 방해한다.
  - 제안: `emitCancellationEvent` 도 `toTerminalErrorPayload` (또는 동등한 정규화)를 거치도록 통일하거나, 최소한 `nodeId: null` 을 명시적으로 채우는 후속 작업을 별도 항목으로 plan 에 등재할 것.

- **[WARNING]** spec `error` 필드 표 행이 이번 PR 의 코드 변경으로 stale 해졌다 — "일부 경로는 string" 서술이 더 이상 사실이 아니다.
  - 위치: `spec/5-system/14-external-interaction-api.md:572` (§6 필드 집합 표, `error` 행 — 이번 diff 에서 변경되지 않은 컨텍스트 줄. 바로 아래 `durationMs` 행(573행 부근)은 같은 diff 로 갱신됨)
  - 상세: 해당 행은 "현행 일부 경로는 string 을 넣는다 (`execution-engine.service.ts` · `retry-turn.service.ts` 의 `EXECUTION_FAILED` emit 일부) ... 수신자는 당분간 양쪽을 방어해야 한다" 고 서술한다. 그러나 이번 PR 이 바로 그 4개 emit 지점을 전부 `toTerminalErrorPayload` 로 일원화했고, `chat-channel.dispatcher.ts:536~538` 자신의 새 주석도 "엔진은 이제 전 경로에서 §6.4 object 를 emit 한다" 고 확언한다. `EXECUTION_FAILED` 를 emit 하는 파일은 저장소 전체에서 `execution-engine.service.ts`/`retry-turn.service.ts` 둘뿐임을 실측 확인했다(`grep -rln ExecutionEventType.EXECUTION_FAILED` — 두 파일만). 즉 spec 은 이 PR 이 닫은 바로 그 갭을 여전히 "열려 있다" 고 말하고 있다 — 같은 diff 안에서 인접 행(durationMs)은 갱신하면서 이 행만 놓쳤다.
  - 제안: `error` 행에서 "일부 경로는 string" 캐비엇을 제거하거나 "이번 PR(`toTerminalErrorPayload`)로 해소됨" 으로 갱신. `cancelled` 쪽은 위 두 번째 항목이 남아 있으므로 그 범위에서만 캐비엇을 유지.

- **[INFO]** `EiaFailedEvent.error.nodeId` 타입이 실제 보장보다 느슨하다.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:402` (`nodeId?: string | null;`)
  - 상세: 바로 위 주석(397행)은 "`code`·`nodeId` 는 명시적 `null` 이 올 수 있다(키 생략이 아니다)" 라고 규범을 못박는데, 타입은 `nodeId?:` 로 옵셔널까지 허용해 키 생략도 타입상 유효하게 만든다. 실제 유일한 생성 경로(`toTerminalErrorPayload`)는 항상 키를 채우므로 런타임 위반은 없지만, 이 타입만 보고 새 코드를 작성하는 다음 사람은 키 생략을 유효한 형태로 오인할 수 있다.
  - 제안: `nodeId: string | null;` (옵셔널 제거)로 타입을 실제 계약과 일치시키는 것을 고려.

## 요약

이번 변경은 `execution.failed`/`execution.cancelled` 종결 이벤트의 `error` 필드를 EIA §6.4 가 이미 선언해 둔 `{code, message, nodeId, details?}` object 계약으로 수렴시키는 작업이다. 4개 emit 지점을 단일 헬퍼(`toTerminalErrorPayload`)로 묶어 DB-wire 간 부재 표현 불일치(키 생략 vs 명시적 `null`)를 닫은 설계는 견고하고 테스트(`terminal-error-payload.spec.ts`)도 타입가드·뮤테이션 방어까지 촘촘하다. 다만 API 계약 관점에서 세 가지가 남는다 — (1) `error` 필드가 string 을 낼 수 있던 실제 webhook/SSE 구독자 관점에서는 이번 배포가 명백한 shape breaking change 인데 이 프로젝트는 URL 버전 세그먼트를 쓰지 않는 "단일 버전 운영" 정책이라 이를 구분해 낼 신호가 없고, (2) 같은 spec 행이 규정하는 `cancelled` 쪽 `error`(`emitCancellationEvent`/`EiaCancelledEvent`)는 이번 정규화에서 빠져 `failed` 와 스키마가 갈린다, (3) spec §6 필드 표의 `error` 행이 이번 PR 이 닫은 바로 그 갭("일부 경로는 string")을 여전히 열려 있다고 서술해 문서-구현 정합이 stale 하다. 요청 검증·URL 설계·페이지네이션·인증/인가는 이번 diff 의 범위 밖(변경 없음)이라 해당 없음.

## 위험도

MEDIUM
