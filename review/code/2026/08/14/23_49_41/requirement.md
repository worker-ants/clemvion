STATUS=success requirement review complete — 0 CRITICAL, 1 WARNING, 3 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `execution.failed` 의 `error.code` nullable 계약이 이 PR 이 직접 정정한 SoT(§6.4)·field 표와 `chat-channel-adapter.md` 의 TS union 사이에서 여전히 어긋난다.
  - 위치: `spec/conventions/chat-channel-adapter.md:150` (`| { type: "execution.failed"; … error: { code: string; message: string; nodeId: string | null; details?: unknown } | string; … }` — `code: string`, non-nullable)
  - 상세: 이번 PR 이 같은 파일 바로 아래 문단(:159-163, diff 로 직접 수정)과 `spec/5-system/14-external-interaction-api.md:572`(§6 필드 표, 이번 diff로 갱신)·`:781-789`(§6.4 blockquote)에서 "`code`·`nodeId` 는 `null` 일 수 있다"를 명시적 SoT 로 확정했고, 실제 런타임 타입(`codebase/backend/src/modules/chat-channel/types.ts` `EiaFailedEvent.error.code: string | null`, 이번 diff로 갱신)도 정확히 그 계약을 따른다. 그런데 `chat-channel-adapter.md:150` 의 `EiaEvent` union — 스스로 "SoT 를 TypeScript 로 옮긴 것"(:157)이라 선언하는 바로 그 타입 — 은 `code: string`(non-nullable)으로 여전히 남아 있다. 이 파일은 이번 PR 이 실제로 건드린 파일이고(§1.2 바로 아래 캐비엇 문단을 diff 로 수정), 이 저장소 자신의 RESOLUTION 이력이 "고쳤다를 쓰는 시점에 자매를 전수로 세지 않아 같은 문서/자매 문서 한 곳을 놓치는" 실수를 이 PR 안에서만 3회(§6 표/§6.4 blockquote, 소스/스펙 JSDoc, 5곳 중 2곳 누락) 반복했다고 스스로 기록한 것과 같은 클래스의 재발이다. `git log -S` 로 확인한 결과 `code: string`(non-nullable)은 이 PR 이전(#1166, `9a4d3e32b`)부터 있던 표현이라 이번 PR 이 새로 만든 결함은 아니지만, 이번 PR 이 정확히 이 필드의 nullable 여부를 §6.4/필드표에서 재확정하면서 인접 union 타입은 갱신하지 않았다. (참고: `review/consistency/2026/08/14/07_44_12/cross_spec.md`·`09_38_17/cross_spec.md` — 이 파일의 동일 클래스 drift 가 더 이른 세션에서도 이미 지적된 이력이 있다.)
  - 제안: 코드 fix 대상 아님 — `project-planner` 턴에서 `chat-channel-adapter.md:150` 의 `error` 필드를 `{ code: string | null; message: string; nodeId: string | null; details?: unknown } | string` 로 정정. 같은 세션이 반복 서술한 "한 곳만 고쳤다" 패턴 재발 방지를 위해 `error` 필드를 서술하는 나머지 spec 위치(§6 필드 표, §6.4 예시/blockquote 2개, `chat-channel-adapter.md` union)를 전수 grep 해 재확인할 것.

- **[INFO]** 핵심 요구사항(4개 `EXECUTION_FAILED` emit 지점을 `toTerminalErrorPayload` 로 일원화 + wire `null` 정규화)이 코드·타입·spec 세 층위에서 실측상 정확히 일치한다.
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:48-82`(`toTerminalErrorPayload`), 호출부 4곳(`execution-engine.service.ts:664`·`:3314`·`:4872`, `retry-turn.service.ts:966` — grep 으로 전수 확인, 5번째 emit 없음), 소비 타입 `chat-channel/types.ts:395-408`, 소비 로직 `chat-channel.dispatcher.ts:552-558`(더 이상 손수 3-way 분기·무검증 캐스팅 없이 헬퍼를 그대로 재사용), 프런트 소비자 `use-execution-events.ts:253-279`(`handleExecutionFailed`, string/object 양쪽 안전 처리) + 회귀 테스트(`use-execution-events.test.ts:1140-1159`), 스토어 시그니처 `execution-store.ts:316`(`failExecution: (error?: string) => void` — 항상 string 만 받음, object 가 store 에 들어갈 경로 없음을 직접 확인).
  - 상세: `retry-turn.service.ts` 의 `failRetryExecution` 도 `isCancelled` 분기에서만 `execution.error` 를 세팅하고 emit 도 `!isCancelled` 조건부로만 `toTerminalErrorPayload(execution.error)` 를 호출해 취소 경로에 stale/undefined 값을 실을 위험이 없음을 직접 확인했다. 엔진 3곳도 `row.error`/`stalledError`/`savedExecution.error` 를 DB 에 쓴 것과 **같은 객체**를 emit 에 그대로 넘겨 DB·wire 문구가 갈리던 종전 결함(`finalizeStalledExhausted` 의 `attempts` 누락)이 구조적으로 재발할 수 없게 됐다.
  - TODO/FIXME/HACK/XXX 마커: `git diff origin/main...HEAD -- 'codebase/**' 'spec/**'` 전수 grep 결과 0건.

- **[INFO]** `execution.cancelled` 미커버 범위가 코드·spec·plan 세 층위에서 일관되게 문서화돼 있어 SPEC-DRIFT 아님(의도된 범위 축소).
  - 위치: `terminal-error-payload.ts:1-9`(JSDoc — "현재 호출부는 EXECUTION_FAILED 4곳뿐"), `chat-channel/types.ts:412-421`(`EiaCancelledEvent.error?: { code: string; message?: string }` — 이번 diff 로 손대지 않음, 실측 확인), spec `:572`("cancelled 는 아직 {code, message} 를 손으로 만들어 nodeId/details 가 없다").
  - 상세: `emitCancellationEvent`(및 호출 5곳)는 여전히 `toTerminalErrorPayload` 를 거치지 않는 것을 직접 grep 으로 재확인했다. `plan/in-progress/eia-terminal-payload.md` 재판정 ③-c 가 "DB write 5곳을 함께 손봐야 해 비용이 다르다"는 근거로 다음 PR 로 명시 이연했고, 세 문서가 정확히 같은 서술로 일치한다.

- **[INFO]** (긍정 확인) 직전 3라운드 ai-review 가 찾은 CRITICAL(프런트 캐스팅-only → React 렌더 크래시)·WARNING(컨슈머 무검증 캐스팅, 값 미고정 테스트, spec 자기모순 §6 표/§6.4 blockquote)이 이번 changeset 에 실제로 반영돼 있음을 직접 코드로 재확인했다. `notification-fanout.service.ts:134`(직접 Read 로 확인)가 `event.payload` 를 가공 없이 webhook enqueue body 에 그대로 싣어, `error` string→object 전환이 외부 webhook/SSE 수신자에게 실질적 breaking change 임을 확인했으나, `CHANGELOG.md` 에 breaking 고지가 이미 반영돼 있다.

### 요약
핵심 요구사항(`execution.failed` 의 `error` 를 문자열에서 EIA §6.4 object 계약(`{code, message, nodeId, details?}`, `code`/`nodeId` nullable)으로 통일)은 4개 emit 지점 전부(엔진 3곳 + retry-turn 1곳)·소비 타입(`chat-channel/types.ts`)·컨슈머(`chat-channel.dispatcher.ts`, 더 이상 무검증 캐스팅 없음)·프런트엔드 소비자(`use-execution-events.ts` + 회귀 캐너리)까지 코드 레벨로 직접 재확인한 결과 일관되게 구현돼 있다. TODO/FIXME/HACK 류 미완성 마커는 없고, 반환값·에러 시나리오(부재 → `null`, 레거시 문자열 흡수, 스칼라 방어)도 신규 `terminal-error-payload.spec.ts` 가 촘촘히 고정했다. 유일한 새 발견은 이 PR 이 §6.4/필드표에서 재확정한 `error.code` nullable 계약이, 이 PR 이 직접 손댄 `spec/conventions/chat-channel-adapter.md` 의 인접 TS union 타입(:150, `code: string`)에는 반영되지 않아 남은 spec 내부 불일치다 — 이 저장소가 이 PR 안에서만 세 차례 반복했다고 스스로 기록한 "자매 위치 누락" 패턴의 재발이며, 코드 결함이 아니라 spec 정정(권한 밖, planner 턴) 대상이다.

### 위험도
LOW
