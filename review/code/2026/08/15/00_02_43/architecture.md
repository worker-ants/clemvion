# 아키텍처 리뷰 — EIA 종결(terminal) `error` payload 정규화 (5차, `00_02_43`)

## 리뷰 범위 및 이전 라운드 대비

이 changeset 의 핵심 코드(9개 소스 파일)는 이미 `22_55_51`(CRITICAL 1·WARNING 10) →
`23_17_57`(WARNING 6) → `23_34_12`(WARNING 3) → `23_49_41`(WARNING 4) 네 차례 ai-review 를
거쳤고, 그중 아키텍처 관점 리뷰는 `23_17_57`·`23_34_12` 두 차례 각각 LOW 위험도로 수렴했다.
이번 라운드에서 실제로 추가된 diff 를 `git diff 843a36ac7..HEAD -- codebase/ spec/` 로 직접
대조한 결과, 핵심 코드(`terminal-error-payload.ts`/`chat-channel.dispatcher.ts`/
`execution-engine.service.ts`/`retry-turn.service.ts`/`types.ts`/`use-execution-events.ts`)는
`23_34_12` 시점 이후 **한 줄도 바뀌지 않았다** — 유일한 변화는 (a) 테스트 단언 1건 추가
(`execution-engine.service.spec.ts`, sentinel code 가 emit 까지 보존되는지 고정) 와 (b) spec
문서 `chat-channel-adapter.md` 의 `EiaEvent` union 표기를 `code: string` → `code: string | null`
로 정정한 것뿐이다. 둘 다 아키텍처 구조를 바꾸지 않으며, (b)는 오히려 이전 라운드가 반복
지적한 "런타임 타입·spec union·§6.4 세 곳 정합" 갭을 한 곳 더 좁힌 것이라 긍정적이다.

**직접 재검증한 핵심 설계 — 이전 라운드의 결론과 일치함을 확인:**

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` 는 `chat-channel`·
  `execution-engine` 어느 쪽도 import 하지 않는 순수 함수이고, 두 모듈은 이 헬퍼를 단방향으로만
  참조한다(`grep -rln "terminal-error-payload" codebase/backend/src` — 소비처 3곳 + spec 1곳,
  역참조 없음). `execution-engine.service.ts:40` 이 이미 `../chat-channel/shared/form-mode` 를
  import하고 있어(직접 확인) `chat-channel → execution-engine` 역방향이었다면 순환이 됐을 것 —
  `shared/utils/` 승격은 순환 회피를 위한 올바른 계층 선택이다.
  같은 헬퍼가 producer 4곳(`execution-engine.service.ts` 2곳, `retry-turn.service.ts` 1곳,
  `finalizeStalledExhausted` 1곳)과 consumer 1곳(`chat-channel.dispatcher.ts:552`)에서 공유돼,
  `chat-channel.dispatcher.ts:546-558` 이 예전에 갖고 있던 3-way 손수 정규화(그중 object 분기는
  `errorRaw as typeof error` 캐스팅으로 필드별 타입가드를 우회했었다)가 제거됐다 — 이전
  maintainability WARNING("정규화 로직을 emit 지점마다 손으로 하면 빠진다"는 이 PR 자신의
  교훈이 컨슈머 쪽에서 재현되고 있었다)이 구조적으로 해소된 상태를 그대로 유지한다.
- 레이어 분리가 명확하다 — DB 쓰기(`execution-engine.service.ts:630` 부근 `row.error = {
  message: errMessage }`, `retry-turn.service.ts` 의 `execution.error` 대입)는 계속 부분 객체(키
  생략)를 그대로 저장하고, wire 변환(`toTerminalErrorPayload`)은 emit 호출부(`:663`,
  `retry-turn.service.ts:966`)에서만 적용된다. 영속 표현과 전송 표현을 분리하고 경계 한 곳에서만
  변환하는 설계로, 과거 실제로 발생했던 DB/wire 문구 drift(`finalizeStalledExhausted` 의
  `attempts` 누락) 클래스가 재발하지 않는다.

## 발견사항

- **[INFO]** 같은 §6.4 wire 형태가 `TerminalErrorPayload`(`codebase/backend/src/shared/utils/terminal-error-payload.ts:36-41`)와 `EiaFailedEvent.error`(`codebase/backend/src/modules/chat-channel/types.ts:399-408`, 인라인 타입) 두 곳에 독립 선언으로 남아 있다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:36-41`, `codebase/backend/src/modules/chat-channel/types.ts:399-408`
  - 상세: `chat-channel/types.ts` 는 `TerminalErrorPayload` 를 import 하지 않고 같은 모양을 손으로 다시 선언한다(`grep -rn "TerminalErrorPayload" codebase/backend/src/modules/chat-channel` 0건). `chat-channel.dispatcher.ts:552` 가 로컬 변수 타입을 `EiaFailedEvent['error']` 로 재사용해 선언 수를 3→2 로 줄인 것(`23_17_57` W3 조치)은 실제 개선이지만, 그 2번째 선언 자체를 producer 타입에 연결하는 조치는 여전히 없다 — 두 라운드(`23_17_57`, `23_34_12`) 연속으로 같은 잔여로 확인됐고 이번 라운드도 코드 변화가 없어 동일하다. 두 타입은 현재 구조적으로 호환되지만(`nodeId` optionality 차이는 producer/consumer 계약 구분이라는 명시적 근거로 의도된 것) 그 정합은 사람이 매번 판단해야 하고 컴파일러가 보장하지 않는다.
  - 제안: 조치 불요(현재 필드 집합 안정적, 이미 3라운드 연속 검토·수용된 트레이드오프). 다음에 §6.4 wire 형태에 필드가 추가될 때 producer 만 갱신하고 consumer 를 빠뜨리는 회귀가 재발할 수 있음을 인지하고, 그때 `Pick<TerminalErrorPayload, ...>` 재사용을 고려할 것.

- **[INFO]** `execution.cancelled` 계열은 이번 정규화 대상에서 계속 제외돼, 같은 "종결 error" 카테고리 안에 두 스키마(신규 nullable-object `EiaFailedEvent.error` vs 기존 non-nullable `EiaCancelledEvent.error`)가 공존한다
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:422` (`EiaCancelledEvent.error?: { code: string; message?: string }`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1079-1103` (`emitCancellationEvent`, 이번 diff 밖)
  - 상세: spec §6 필드 표는 `failed`/`cancelled`(시스템 취소 한정)를 같은 목표 형태로 규정하지만, `emitCancellationEvent` 호출 5곳은 여전히 `{code, message}` 리터럴을 손으로 만들고 `toTerminalErrorPayload` 를 거치지 않는다 — 정확히 이 PR 이 `EXECUTION_FAILED` 4곳에서 없앤 패턴이 `EXECUTION_CANCELLED` 쪽에는 남아 있다. 다만 이는 누락이 아니라 `terminal-error-payload.ts:4-9` 자신이 "DB write 5곳을 함께 손봐야 해 `durationMs` 와 같은 비용 그룹"이라고 명시한 것이고, code·spec(`spec/5-system/14-external-interaction-api.md`)·plan(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`) 세 층위에서 일관되게 추적된다.
  - 제안: 조치 불요(범위 밖, 명시적으로 추적됨). 후속 PR 에서 `emitCancellationEvent` 도 같은 헬퍼(또는 부분집합)로 통일하면 이 카테고리의 "정규화는 한 곳에서" 원칙이 완결된다.

- **[INFO]** 이벤트 emit 경계(`emitExecution`)가 `payload: unknown` 으로 선언돼, producer 의 강타입(`TerminalErrorPayload`)이 전송 경계를 넘는 순간 소실되고 각 consumer 가 `as` 캐스팅으로 형태를 재구성한다 — 이 diff 가 새로 만든 구조는 아니다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:37` (`emitExecution(executionId, eventType, payload: unknown)`)
  - 상세: 이번 PR 에서 실제로 발생했던 CRITICAL(프런트가 `error` 를 문자열로 캐스팅해 두고 있다가 백엔드가 object 로 바꾼 것을 타입체커가 못 잡음)이 바로 이 경계의 타입 소실 때문이었다. 지금 완료된 fix(양쪽에서 관용구 통일)는 이 경계의 증상 하나를 재동기화한 것이고, 경계 자체를 타입 안전하게 만들지는 않는다 — 같은 클래스의 회귀가 다음 필드 변경에서 재발할 수 있는 구조적 여지가 남는다.
  - 제안: 이번 PR 범위에서 고칠 필요는 없다(이벤트 타입 전반에 걸친 광범위한 리팩터 필요). discriminated payload union 으로 좁히는 안을 별도 개선 항목으로 두는 정도면 충분.

## 요약

핵심 코드는 `23_34_12` 라운드 이후 변경이 없고(테스트 단언 1건·spec 문서 1줄 정정만 추가), 그
라운드가 이미 확인한 아키텍처 설계 — 정규화 책임이 순수 함수(`toTerminalErrorPayload`) 하나에
집중된 SRP, emit 4곳 + consumer 1곳이 같은 헬퍼를 공유하는 DRY, `shared/utils/` 승격을 통한
`execution-engine`↔`chat-channel` 무순환 모듈 경계, DB 영속 표현과 wire 전송 표현을 emit
경계 한 곳에서만 변환하는 레이어 분리 — 를 이번 라운드에서도 직접 재확인했다. 남은 관찰
셋(`TerminalErrorPayload`/`EiaFailedEvent.error` 2중 선언, `execution.cancelled` 미통일,
`emitExecution` 의 `payload: unknown` 타입 소실 경계)은 3~4라운드 연속으로 같은 판단이
유지되는 pre-existing 트레이드오프이며, code·spec·plan 세 층위에서 일관되게 문서화·추적돼
은폐가 아니다. 이번 라운드에서 새로 발견된 아키텍처 결함은 없다.

## 위험도

LOW
