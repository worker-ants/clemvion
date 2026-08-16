# 부작용(Side Effect) 리뷰

이번 changeset 의 핵심 코드 변경은 3개 파일이다(나머지는 plan/review 산출물). 아래는 직접
`Read`/`Grep` 으로 소스를 열어 독립 검증한 결과다 — 이전 라운드(`09_51_00`)의 동일 관점 리뷰가
이미 상당수를 다뤘으므로, 재확인된 항목은 근거를 명시하고 새로 발견/정밀화한 항목을 구분했다.

## 발견사항

- **[INFO]** `chat-channel.dispatcher.ts` 의 재정규화 경로에서 새 마스킹이 **이중 실행**된다 (신규 관측, idempotent 하나 미기록)
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` `redactTerminalError`(96-104) / `toTerminalErrorPayload`(111-150, `object` 분기는 140-149) — 소비 지점은 diff 밖의 기존 파일 `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:545-557`(`execution.failed` case)
  - 상세: `execution-engine.service.ts`/`retry-turn.service.ts` 가 emit 시점에 이미 `toTerminalErrorPayload`(→ `redactTerminalError` → `deepRedactSecrets`)를 거쳐 **마스킹된** `TerminalErrorPayload` 를 만들어 WS 로 내보낸다. 그런데 `chat-channel.dispatcher.ts:551`(diff 밖, 기존 코드)이 큐에서 재생된 `event.payload.error`(이미 §6.4 형태 + 이미 마스킹됨)를 `toTerminalErrorPayload(errorRaw)` 로 **다시** 통과시킨다 — object 분기(`terminal-error-payload.ts:140-149`)가 필드를 재추출하고 `redactTerminalError`(:96)가 `deepRedactSecrets(p.message)` 를 한 번 더 돌린다. `"***"` 로 이미 치환된 문자열은 `SECRET_LEAK_PATTERNS` 에 다시 안 걸리므로 **기능적으로는 no-op**(idempotent)이지만, 이 diff **이전에는** 이 재정규화 경로가 순수 shape-passthrough(마스킹 없음)였고 지금은 매 `execution.failed` → chat-channel dispatch 마다 `message`(및 JSON-형태면 `JSON.parse`/`stringify` 재직렬화 분기까지)에 실제 regex 스캔이 한 번 더 도는 것으로 바뀌었다. 어느 리뷰 파일도 이 이중 실행을 명시하지 않았다.
  - 제안: 조치 불요(관측 가능한 동작 변화 없음, 비용도 문자열 1개 regex 패스 수준). 다만 향후 `SECRET_LEAK_PATTERNS` 가 non-idempotent 한 패턴(예: 부분 매치를 다른 값으로 치환)으로 확장되면 이 이중 실행이 결과를 바꿀 수 있다는 점을 주석으로 남겨두면 다음 확장 시 유용하다.

- **[INFO]** "내부 신뢰 채널(워크플로우 에디터)이 마스킹값을 받는다" 우려 — 독립 검증 결과 **현재는 렌더링되지 않는 dead 필드**라 실질 부작용 없음 (재확인·하향)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:264-276`(`handleExecutionFailed` → `failExecution(errorMessage)`), `codebase/frontend/src/lib/stores/execution-store.ts:736-746`(`failExecution` → `nodeStatuses.set('__execution__', {status:'failed', error})`)
  - 상세: 이전 라운드의 `side_effect.md`(WARNING)와 consistency `rationale_continuity.md`(WARNING #1)가 "워크플로우 에디터가 마스킹된 `error.message` 를 신뢰 채널에 그대로 렌더링할 수 있다"는 우려를 제기했고, `09_51_00` RESOLUTION 의 W3 는 "에디터가 이 payload 를 렌더링하지 않는다"고 답했으나 근거 코드를 남기지 않았다. 직접 추적한 결과 그 답은 맞다 — `nodeStatuses.get('__execution__')` 의 `.error` 값을 읽어 화면에 그리는 컴포넌트가 존재하지 않는다(`grep -rn "__execution__"` 결과 store/테스트 외 유일한 소비처인 `run-results-drawer.tsx:254` 는 이 키를 **필터링해서 제외**할 뿐 렌더링하지 않음). `custom-node.tsx:506-510` 의 실패 표시도 `nodeStatus.error` 텍스트가 아니라 빨간 점 아이콘뿐이다. spec `3-workflow-editor/3-execution.md` §3.5 가 그리는 `Error: <message>` 배너 UI 는 현재 프런트 어디에도 문자열로 구현돼 있지 않다(`grep` 0건). 즉 스토어에 마스킹된 값이 쌓이긴 하지만 **현재는 아무도 읽지 않는 dead write** — 이번 PR 이 만드는 관측 가능한 UI 회귀는 없다.
  - 제안: 조치 불요. 다만 향후 이 spec 배너를 실제로 구현하는 PR 이 오면 그때는 "마스킹값을 보여줄지 원문을 보여줄지"를 명시적으로 결정해야 한다 — 지금은 결정을 미룰 수 있는 이유(소비자 부재)가 코드로 확인됐다는 점만 기록해 둔다.

- **[INFO]** `deepRedactSecrets` 의 module-level `WeakMap` 캐시(`DEEP_REDACT_CACHE`)에 새 쓰기가 늘지만, 실제로는 `details` 필드에 한정된다 (기존 INFO 정밀화)
  - 위치: 캐시 정의는 diff 밖 `codebase/backend/src/shared/utils/sanitize-error-message.ts:107`. 신규 호출은 `codebase/backend/src/shared/utils/terminal-error-payload.ts:99`(`message`, 문자열 — 캐시 미경유)와 `:102`(`details`, 객체일 때만 캐시 경유)
  - 상세: `deepRedactSecrets`(`sanitize-error-message.ts:127-143`)는 `typeof value === 'string'` 이면 즉시 `redactSecrets`/`redactSecretsInJsonString` 으로 빠져 `WeakMap` 을 전혀 건드리지 않는다. 캐시는 `depth === 0` && 객체 타입일 때만 쓰인다. 즉 `redactTerminalError` 의 `message: deepRedactSecrets(p.message)` (`:99`, 항상 문자열)는 캐시에 아무 영향이 없고, `details: deepRedactSecrets(p.details)` (`:102`, `details` 가 정의됐고 객체인 경우만)만 새 캐시 엔트리를 만든다. `WeakMap` 이라 GC 안전하고, 각 emit 지점이 매번 새 리터럴을 만들어 넘기므로(스테일 재사용 위험 낮음) 실질 리스크는 낮다.
  - 제안: 조치 불요.

- **[INFO]** `execution.cancelled` 는 여전히 이 새 마스킹 초크포인트를 완전히 우회한다 — 종결 이벤트 3종 사이의 마스킹 적용이 비대칭 (재확인)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1119`(`...(opts.error ? { error: opts.error } : {})` — `opts.error` 는 `toTerminalErrorPayload` 를 거치지 않고 손으로 만든 `{code, message}`), 소비측은 diff 밖 `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:577-581`(`execution.cancelled` case — 캐스팅만 하고 재마스킹 없음)
  - 상세: `execution.failed`/`execution.completed`(무관)와 달리 `execution.cancelled` 의 `error` 는 `toTerminalErrorPayload`/`redactTerminalError` 를 한 번도 거치지 않는다. 현재는 이 필드에 raw 예외 메시지가 실리는 경로가 없어(고정 코드·`RESUME_*` sentinel 뿐) 안전하지만, 이 diff 는 그 비대칭을 해소하지 않고 그대로 둔다. security.md(이전 라운드)가 이미 INFO 로 등재한 것과 동일 관측이며, 이번 diff 자체에는 이 경로를 막는 구조적 강제(타입/컴파일 타임)가 없다는 점만 재확인한다.
  - 제안: 조치 불요(이번 PR 범위 밖, 이미 plan 에 raw 사용처 3곳 전수 감사로 현재는 안전함이 확인됨). 향후 취소 사유 상세화 리팩터 시 이 우회로가 재발할 수 있다는 캐너리로만 인지.

## 확인된 안전한 설계 (직접 검증)

- **함수 시그니처 불변**: `toTerminalErrorPayload(err: unknown): TerminalErrorPayload | null` — 파라미터·반환 타입 모두 이전과 동일. `TerminalErrorPayload` 인터페이스(`code`/`message`/`nodeId`/`details?`)도 무변경. 기존 5개 호출부(`execution-engine.service.ts:668,3400,5030`, `retry-turn.service.ts:1001`, `chat-channel.dispatcher.ts:551`, 직접 grep 확인)가 재컴파일 없이 그대로 동작한다.
- **DB write 없음**: 5개 호출부 모두 `this.eventEmitter.emitTerminalExecution(...)` 인자로만 쓰이고, 직전 코드 문맥(`execution-engine.service.ts:663-668`,`:3396-3401`,`:5027-5030`, `retry-turn.service.ts:996-1001`)을 직접 대조해 DB write 문(`UPDATE`/`save`/`repo.update`)이 하나도 없음을 확인 — `Execution.error` 원본은 마스킹 이전 값 그대로 저장된다(R17 egress-only 원칙 유지).
- **mutation 없음**: `redactTerminalError` 는 spread 로 새 객체를 반환하고, `deepRedactSecrets`/`deepRedactObject`(`sanitize-error-message.ts:127-171`)는 copy-on-change(변경 없으면 원본 참조 반환)라 입력을 in-place 수정하지 않는다.
- **순환 참조 없음**: `sanitize-error-message.ts`(shared/utils)를 직접 열어 import 문이 0개임을 확인 — `terminal-error-payload.ts:3` 의 신규 import 가 순환을 만들지 않는다는 주석 주장이 맞다.
- **환경변수·네트워크 호출 없음**: 세 핵심 파일 어디에도 `process.env` 읽기/쓰기, `fetch`/`http` 호출이 없다.
- **이벤트 발행 로직 자체는 무변경**: `emitTerminalExecution`(`execution-event-emitter.service.ts:139-157`)의 라우팅/이벤트 타입 결정 로직은 이번 diff 의 대상이 아니며, 오직 emit 되는 `payload.error` **값**만 마스킹된 값으로 바뀐다 — 발행 여부·타이밍·채널은 그대로다.
- **파일시스템 부작용**: `plan/`·`review/` 하위 신규 파일들은 프로젝트 규약상 developer/consistency-checker 의 명시된 쓰기 권한 범위이며 내용도 실제 변경과 일치 — 의도치 않은 파일시스템 부작용 아님.

## 요약

핵심 변경(`redactTerminalError` 신설 + `toTerminalErrorPayload` 4개 반환 경로 전체 배선)은 시그니처·인터페이스 불변, DB 미변경, mutation 없음, 순환참조 없음이 모두 코드 레벨에서 확인돼 부작용 관점에서 신중하게 설계됐다. 이전 라운드가 WARNING 으로 남겼던 "워크플로우 에디터(내부 신뢰 채널)가 마스킹값을 받는다"는 우려는 프런트엔드를 직접 추적한 결과 **현재는 그 값을 렌더링하는 컴포넌트가 없어(dead store write) 실질 UI 부작용이 없음**을 새로 확인했다 — WARNING 에서 INFO 로 하향할 근거가 코드로 뒷받침된다. 새로 발견한 것은 `chat-channel.dispatcher.ts`(diff 밖 기존 코드)의 재정규화 경로가 이미 마스킹된 payload 를 다시 `toTerminalErrorPayload` 에 통과시켜 마스킹을 이중 실행한다는 점인데, `SECRET_LEAK_PATTERNS` 치환이 idempotent(`***`는 재매칭 안 됨)라 관측 가능한 동작 변화는 없다 — 향후 패턴이 non-idempotent 하게 확장될 때만 의미가 생기는 잠재 리스크로 INFO 기록한다. `execution.cancelled` 가 이 마스킹 초크포인트를 여전히 우회하는 비대칭도 재확인했으나 현재 raw 사용처가 없어 안전하다는 점은 plan 감사로 이미 뒷받침된다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도
LOW
