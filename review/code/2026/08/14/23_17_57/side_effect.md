# 부작용(Side Effect) 코드 리뷰 — EIA 종결 `error` payload 객체화 (`toTerminalErrorPayload`)

## 발견사항

- **[WARNING]** `execution.failed`(`EXECUTION_FAILED`) 이벤트의 `error` payload 형태가 string → object 로 바뀌는 이벤트/인터페이스 변경 — 저장소 내부 소비자는 이번 diff 로 함께 갱신됐지만, 저장소 밖 외부 webhook/SSE 구독자는 이 PR 로는 손댈 수 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664`(`error: toTerminalErrorPayload(row.error)`), `:3314`(`error: toTerminalErrorPayload(stalledError)`), `:4872`(`error: toTerminalErrorPayload(savedExecution.error)`), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:966`(`{ error: toTerminalErrorPayload(execution.error) }`)
  - 상세: `emitExecution(ExecutionEventType.EXECUTION_FAILED, …)` 는 `notification-fanout.service.ts:134`(`payload: event.payload` 가공 없이 그대로 forward)를 거쳐 실제 webhook 구독자에게, 그리고 WS/SSE 를 통해 내부 에디터·외부 SSE 클라이언트에게 도달한다. 저장소 내부 소비자(`use-execution-events.ts`, `chat-channel.dispatcher.ts`)는 이번 diff 로 object 형태에 맞춰 함께 갱신됐음을 직접 확인했다(그리고 이전 라운드에서 프런트 미갱신이 CRITICAL 로 잡혀 이미 고쳐졌다 — `review/code/2026/08/14/22_55_51/RESOLUTION.md`). 이 저장소는 URL 버전 세그먼트를 쓰지 않아(`spec/5-system/2-api-convention.md`) 이 shape 변경을 구분해 낼 버전 게이트가 없다 — 저장소 밖의 실제 webhook/SSE 구독자(문자열을 파싱하던 통합자)는 이 커밋으로 조용히 깨질 수 있다. `CHANGELOG.md` 에 breaking change 로 명시된 점은 완화 요인이다.
  - 제안: 이미 CHANGELOG 로 통지됐으므로 추가 코드 조치는 불요. 릴리스 시 실제 외부 webhook 구독자가 있다면 별도 채널로 사전 공지 권장.

- **[INFO]** `chat-channel.dispatcher.ts` 의 back-compat 폴백 코드가 `'INTERNAL_ERROR'`(지어낸 문자열) → `null` 로 바뀌어, 이 경로를 타는 이벤트의 관측 가능한 `error.code` 값 자체가 변한다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:552`(`error = { code: null, message: errorRaw, nodeId: null };`), `:554`(`error = { code: null, message: 'unknown error', nodeId: null };`)
  - 상세: `execution-failure-classifier.ts:105` 의 `event.error?.code ?? ''` 가 `null`/`undefined`/키부재를 동일하게 흡수하므로 저장소 내부 분류 결과는 바뀌지 않는다(직접 확인). 저장소 전체에서 `'INTERNAL_ERROR'` 리터럴을 이 이벤트의 `error.code` 값으로 소비하는 코드는 0건임을 grep 으로 확인했다. 다만 이 값을 보는 외부 로그/모니터링 대시보드가 있다면 관측되는 문자열이 바뀐다 — CHANGELOG 에 이미 언급됨.
  - 제안: 조치 불요(이미 문서화됨).

- **[INFO]** `EiaFailedEvent.error.code` 타입이 `string` → `string | null` 로 넓어졌는데, 실제 소비 코드가 이미 방어적으로 작성돼 있어 런타임 부작용은 없음을 확인.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:400`(`code: string | null;`). 소비처: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:63`(`event.error?.code?.startsWith('RESUME_')`), `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:105`(`event.error?.code ?? ''`)
  - 상세: 두 소비처 모두 optional chaining/nullish coalescing 을 이미 쓰고 있어 `code: null` 이 들어와도 예외 없이 안전하게 처리된다. `assistant-message.tsx` 의 `message.error.code`(non-optional 접근)는 별개 도메인(AI 어시스턴트 패널 대화 메시지, `AssistantDisplayMessage`)이라 이 diff 의 `EiaFailedEvent` 와 무관함을 확인했다 — 오탐 배제.
  - 제안: 없음(positive finding).

- **[INFO]** 신규 헬퍼 `toTerminalErrorPayload` 는 입력을 변형하지 않는 순수 함수이며, `finalizeStalledExhausted` 에서 같은 `stalledError` 객체 참조가 TypeORM `.set()`(DB write)과 `toTerminalErrorPayload()`(emit) 양쪽에 전달되지만 aliasing 부작용은 없음을 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:72-77`(`out` 신규 리터럴 생성·`src` 스프레드/변형 없음), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3268-3271`(`stalledError` 선언), `:3277`(`.set({ error: stalledError, … })`), `:3314`(`toTerminalErrorPayload(stalledError)`)
  - 상세: 헬퍼는 `src`(입력)를 읽기만 하고 새 객체 `out` 을 만들어 반환한다(`terminal-error-payload.spec.ts` `'입력을 변형하지 않는다'` 케이스로도 고정됨). 따라서 같은 `stalledError` 참조가 DB write 경로와 emit 경로 양쪽에 전달돼도 한쪽이 다른 쪽에 영향을 주지 않는다.
  - 제안: 없음(positive finding).

- **[INFO]** `EiaCompletedEvent.result` 인터페이스에서 `finalNodeId`/`finalPort` 필드가 제거됨(narrowing) — 저장소 내 소비자 0건 확인, 컴파일/런타임 영향 없음.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:391`(`result: { outputs?: unknown };`)
  - 상세: `grep -rn "finalNodeId|finalPort" codebase/` 로 전수 확인한 결과 이 선언 자체의 주석 외에는 참조가 없다(구현·소비 0건). 인터페이스가 좁아지는 방향의 변경이라 기존 호출자에 영향을 주지 않는다.
  - 제안: 없음(positive finding).

## 점검 관점별 요약

1. 의도치 않은 상태 변경 — 없음. `toTerminalErrorPayload` 는 순수 함수, `stalledError` 공유 참조도 안전(위 INFO 4).
2. 전역 변수 — 신규/수정 없음.
3. 파일시스템 부작용 — 코드 변경(TS) 범위에는 없음. 커밋에 포함된 `plan/**` 문서 이동은 워크플로 상 의도된 라이프사이클 이동이라 "예상치 못한" 부작용이 아니다.
4. 시그니처 변경 — 기존 함수 시그니처 변경 없음(`toTerminalErrorPayload` 는 신규 추가). `execution-engine.service.ts`/`retry-turn.service.ts` 의 각 메서드 시그니처는 그대로다.
5. 인터페이스 변경 — `EiaFailedEvent.error.code: string|null`(안전 확인), `EiaCompletedEvent.result` narrowing(안전 확인), 그리고 실질적 wire 형태 변경(WARNING 1건, 위 참조).
6. 환경 변수 — 관련 없음.
7. 네트워크 호출 — 신규/변경 없음. 기존 emit/webhook 경로 그대로, payload 내용만 변경.
8. 이벤트/콜백 — `EXECUTION_FAILED` 이벤트의 payload shape 변경(WARNING 1건). 저장소 내부 리스너는 전부 이번 diff 로 동반 갱신됨을 직접 확인(프런트 `use-execution-events.ts`, `chat-channel.dispatcher.ts`).

## 요약

핵심 변경은 4개 `EXECUTION_FAILED` emit 지점을 단일 순수 함수(`toTerminalErrorPayload`)로 통합해 DB-wire 표현 drift 를 구조적으로 제거하는 리팩터로, 부작용 관점에서 새로 도입된 전역 상태·의도치 않은 파일시스템/네트워크 호출·시그니처 파괴는 없다. `stalledError` 객체가 DB write 와 emit 양쪽에 참조로 공유되는 지점을 별도로 검증했으나 헬퍼가 입력을 변형하지 않아 aliasing 위험은 없다. 유일하게 남는 실질 부작용은 `execution.failed` 이벤트의 `error` payload 형태가 string→object 로 바뀌는 **breaking wire 변경**인데, 저장소 내부 소비자(프런트 WS 훅·chat-channel dispatcher)는 이번 diff 로 이미 동반 갱신됐고 CHANGELOG 로 통지됐다 — 남는 리스크는 저장소 밖 외부 webhook/SSE 구독자뿐이며 코드로 완화할 수 없는 영역이다. `EiaFailedEvent.error.code` nullable 화·`EiaCompletedEvent.result` 필드 축소도 실제 소비 코드를 전수 확인한 결과 안전하다.

## 위험도

LOW
