# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새 헬퍼 함수가 기존 JSDoc 과 대상 함수 사이에 삽입되어 문서-함수 결속이 깨지고, 그 JSDoc 자체도 이번 변경으로 stale 해졌다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:51-66`
  - 상세: 51~60행의 JSDoc(`Extract a structured output.error payload from a node lifecycle event...`)은 원래 `extractNodeErrorPayload` 바로 위에 있었다. 이번 diff 는 그 사이에 새 헬퍼 `asRecord` (61~66행, 한 줄짜리 자체 주석 포함)를 끼워 넣었다. 결과적으로 JSDoc 블록과 그것이 설명하는 함수(`extractNodeErrorPayload`, 68행)가 물리적으로 분리됐다 — IDE 호버/`tsdoc`류 도구는 JSDoc 을 바로 아래의 `asRecord` 에 귀속시키므로 어느 쪽에서도 정확한 문서를 못 얻는다. 게다가 그 JSDoc 본문은 여전히 "arrived on the `error` (failed) or `output.error` (completed-with-error) field" 라고 서술하는데, 정작 68~101행의 실제 구현과 79~90행의 새 인라인 주석은 구조화 에러가 `output.output.error`(래퍼 한 겹 더 아래)에만 있다고 명시한다 — 같은 함수에 대해 상단 JSDoc 과 본문 주석이 서로 다른 shape 을 주장하는 상태가 됐다.
  - 제안: `asRecord` 를 `extractNodeErrorPayload` 위(또는 파일 하단 유틸 섹션)로 옮겨 JSDoc 과 함수를 다시 인접시키고, 51~60행 JSDoc 을 `output.output.error` shape 에 맞춰 갱신한다(§4.1-a 인용 포함). 상단 JSDoc 과 본문 인라인 주석이 같은 내용을 다른 상세도로 두 번 서술하는 구조 자체가, 한쪽만 고치고 다른 쪽을 놓치는 이번과 같은 drift 를 반복시킬 위험이 있다 — 가능하면 본문 주석으로 통합하고 JSDoc 은 계약(파라미터/반환)만 짧게 남기는 편이 유지보수에 유리하다.

- **[WARNING]** production shape 을 반영한 `{ output: { <domain>, config: {}, meta: {} } }` 래퍼 boilerplate 가 테스트 5곳에 손으로 복제되어 있고 공유 빌더가 없다
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1999-2015`, `:2045-2056`, `:2075-2091`, `:2157-2170`, `:2196-2214`
  - 상세: 이번 PR 의 근본 원인 자체가 "테스트 fixture 가 production shape(`NodeHandlerOutput` 래퍼 + `output.output.error`)을 반영하지 못해 결함을 가렸다"는 것이다(`plan/in-progress/system-error-banner-live-ws.md` 참조). 그런데 정정 fixture 는 각 `it` 블록에 `output: { output: {...}, config: {}, meta: {} }` 형태를 손으로 5번 복제하는 방식으로 작성됐다. 다음에 이 wrapper shape 이 또 바뀌면(예: `meta` 에 필수 필드가 추가되는 등) 5곳을 개별적으로 찾아 고쳐야 하고, 하나라도 놓치면 이번과 같은 "fixture 가 production shape 을 못 따라가서 결함을 가리는" 패턴이 재발할 수 있다.
  - 제안: `wrapNodeHandlerOutput(domain: unknown)` 같은 테스트 헬퍼(파일 상단 `emitSnapshot`/`getHandler` 헬퍼들과 같은 위치)를 하나 두어 `{ output: domain, config: {}, meta: {} }` 를 반환하게 하고 5개 테스트가 이를 재사용하도록 한다. shape 변경 시 단일 지점만 고치면 되고, `config`/`meta` 가 항상 `{}` 로 고정된 이유(테스트 관심사 밖이라는 뜻)도 헬퍼 이름으로 드러난다.

- **[INFO]** `handleNodeFailed` 주석에 취소선(`~~...~~`)으로 이전 주석의 오류를 서사하는 이력 설명이 코드에 남아있다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:840-849` (핸들러 정의 직전 주석 블록)
  - 상세: "~~종전 주석은 *"`error` 가 output.error 전체 구조로 운반된다"* 였다.~~ **그 서술이 이 파일의 결함을 낳았다**..." 와 같이, 과거에 무엇이 틀렸었는지를 코드 주석에 남기는 서사형 패턴이다. 같은 파일의 다른 "PR-B hotfix" 계열 주석들과 스타일은 일관되지만, 이런 회고성 주석이 반복 누적되면(이번 파일만도 이미 여러 건) 코드가 현재의 진실보다 변경 이력 서술에 더 많은 줄을 쓰게 되어 정작 "지금 이 코드가 무엇을 보장하는가"를 읽기 어렵게 만들 위험이 있다.
  - 제안: 현재 우선순위상 문제는 아니지만, 향후 유사 정정 시 "왜 틀렸었는지"의 상세 서사는 `plan/` 문서(이미 `plan/in-progress/system-error-banner-live-ws.md` 에 잘 기록됨)에 맡기고 코드 주석은 현재 계약(무엇을, 왜 이렇게 읽는지)만 간결히 유지하는 쪽을 고려할 만하다.

- **[INFO]** `handleNodeCompleted`(812행 부근)와 `handleNodeFailed`(908~932행)의 `errorPayload → isMultiTurnAiContext → makeSystemErrorItem` append 블록이 거의 동일한 형태로 중복되어 있다 (diff 이전부터 존재, 이번 변경이 `handleNodeFailed` 쪽 호출 인자만 수정하며 중복을 그대로 유지)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:808-834`(handleNodeCompleted) vs `:903-933`(handleNodeFailed)
  - 상세: retryable/retryAfterSec 추출 로직과 `addConversationMessage(makeSystemErrorItem({...}))` 호출이 두 핸들러에 약 20줄씩 동일하게 반복된다. 이번 diff 의 스코프는 아니지만, 이번 PR 이 정확히 이 블록에 있는 호출 인자(`payload.output` 전달 여부)를 고친 것이므로, 다음에 이 로직이 또 바뀌면 두 곳을 동시에 갱신해야 하는 위험이 이번 결함과 같은 패턴으로 재발할 수 있다.
  - 제안: 여유가 있을 때 `appendSystemErrorIfMultiTurn(errorPayload, nodeId, nodeLabel, nodeExecutionId, timestamp)` 같은 공유 헬퍼로 추출을 고려. 이번 PR 범위를 넘는 리팩터링이므로 즉시 조치는 불필요.

## 요약

핵심 변경(`asRecord` 헬퍼 도입, `output.output.error` 언래핑, fixture 를 production shape 으로 정정)은 목적에 부합하고 가독성도 양호하다 — 특히 새 주석들이 "왜 이 shape 인지"와 "종전에 무엇이 틀렸는지"를 명확히 근거(파일:라인, spec §)와 함께 남긴 점은 이 저장소의 관례에 부합하며 향후 디버깅에 유용하다. 다만 새 헬퍼 삽입 위치가 기존 JSDoc 을 그 문서 대상 함수로부터 분리시켰고 그 JSDoc 자체도 갱신되지 않아 stale 해졌으며, 테스트에서는 이번 결함의 근본 원인이었던 "production shape 을 반영하지 못한 fixture" 문제를 고치면서도 그 shape 을 5곳에 손으로 복제해 동일한 drift 위험을 다시 심었다. 두 건 모두 CRITICAL 은 아니지만 이 PR 의 목적(shape 불일치로 인한 결함 재발 방지)과 정확히 같은 축의 문제이므로 낮은 비용으로 정리할 가치가 있다.

## 위험도
LOW
