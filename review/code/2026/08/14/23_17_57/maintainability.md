# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `toTerminalErrorPayload` 신설로 없앤 "emit 지점마다 손으로 정규화" 패턴이 컨슈머 쪽에서 다시 나타남
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:545-555` (`toChatChannelEvent` 의 `case 'execution.failed':` 블록, `errorRaw`/`error` 선언부)
  - 상세: 이번 PR 은 `terminal-error-payload.ts` 를 신설한 근거로 "그 변환을 emit 지점마다 손으로 하면 한 곳씩 빠진다"(같은 파일 JSDoc, `terminal-error-payload.ts:25`)를 명시하며 4개 emit 지점을 한 헬퍼로 묶었다. 그런데 `chat-channel.dispatcher.ts` 의 `execution.failed` 분기는 정확히 같은 모양(object / string / 기타 3-way)의 정규화를 여전히 손으로 재구현한다 — `errorRaw && typeof errorRaw === 'object'` → `errorRaw as typeof error`(무검증 캐스트), `typeof errorRaw === 'string'` → `{code:null, message:errorRaw, nodeId:null}`, 그 외 → `{code:null, message:'unknown error', nodeId:null}`. 특히 hot-path 캐스트(`error = errorRaw as typeof error;`, line 549)는 `toTerminalErrorPayload` 가 제공하는 필드별 타입 방어(예: `message` 가 string 이 아니면 `''`로 떨어뜨리는 처리, `terminal-error-payload.ts:74-76`)를 우회한다 — 레거시 버퍼 이벤트가 `message` 를 숫자로 갖고 있어도 그대로 통과한다. 같은 wire 계약을 정규화하는 로직이 두 파일에 독립적으로 존재해, 향후 §6.4 shape 가 바뀌면 한쪽만 갱신되고 잊힐 위험이 있다 — 이 PR 이 스스로 지목한 결함 클래스와 동형이다.
  - 제안: string/기타 분기만이라도 `toTerminalErrorPayload(errorRaw) ?? { code: null, message: 'unknown error', nodeId: null }` 형태로 공용 헬퍼를 재사용해 정규화 로직의 SoT 를 하나로 유지. (module 경계상 import 가 부담스럽다면 최소한 파일 상단 주석에 "이 분기가 `toTerminalErrorPayload` 와 의도적으로 분리된 이유"를 명시해 다음 사람이 실수로 재구현하지 않게 할 것.)

- **[INFO]** `error` 를 string-or-object 로 흡수하는 3줄 관용구가 한 파일에서 세 번째로 반복
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:264-270` (`handleExecutionFailed`, 이번 diff 로 신규). 기존 `handleNodeFailed`(약 863번째 줄 부근)와 `handleNodeCancelled`(약 970번째 줄 부근)에도 동일한 `typeof payload.error === "string" ? payload.error : payload.error?.message` 패턴이 있다.
  - 상세: 세 곳 모두 로컬 타입 선언(필드 목록)이 조금씩 달라 완전한 복붙은 아니지만, 핵심 3줄 로직은 동일하다. 코드 자체는 반영해 다루기엔 이미 이 PR 의 커밋 코멘트가 "같은 파일 `node.failed` 핸들러가 이미 쓰는 관용구로 통일한다"고 명시해 의도적 일관성 유지임을 밝히고 있어 심각한 문제는 아니다.
  - 제안: 세 번째 반복이 된 시점이므로 `extractErrorMessage(error: string | { message?: string } | null | undefined): string | undefined` 같은 작은 공용 헬퍼로 추출하면 다음 핸들러가 또 손으로 베끼는 것을 막을 수 있다. 시급하지 않음.

## 요약

핵심 변경은 `execution.failed` 의 `error` 를 문자열에서 EIA §6.4 객체로 통일하며 신설한 `toTerminalErrorPayload` 헬퍼를 4개 emit 지점(엔진 2곳·stalled·retry-turn)이 공유하도록 리팩터한 것으로, 종전에 실제로 어긋나 있던 DB↔wire 문구(`attempts` 누락)까지 함께 해소했다. 헬퍼 자체(`terminal-error-payload.ts`)는 짧고 단일 책임이며, 각 분기·기본값의 근거가 JSDoc/인라인 주석으로 잘 남아 있고, 신규 `terminal-error-payload.spec.ts` 는 스칼라 타입별 분기·불변성·null 처리까지 촘촘히 고정해 테스트 가독성도 좋다. `EiaCompletedEvent` 에서 구현된 적 없는 유령 필드(`finalNodeId`/`finalPort`)를 제거한 것도 "다음 사람이 구현 대상으로 오독"할 여지를 줄이는 긍정적 정리다. 다만 이 PR 이 스스로 지목한 "정규화 로직을 emit 지점마다 손으로 하면 빠진다"는 교훈이 컨슈머 쪽(`chat-channel.dispatcher.ts`)에서 아직 재현되고 있어(WARNING 1건), 완전히 닫힌 리팩터는 아니다. 그 외에는 네이밍·중첩·매직넘버·기존 스타일 일관성 모두 양호하다.

## 위험도
LOW
