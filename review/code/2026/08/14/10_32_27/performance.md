# 성능(Performance) 코드 리뷰

대상: `codebase/backend/src/modules/websocket/websocket.service.ts` (핵심 변경),
`codebase/backend/src/modules/websocket/websocket.service.spec.ts` (테스트 추가).
그 외 `plan/**`, `review/consistency/**` 파일은 문서/산출물로 성능 관점 대상 아님.

## 발견사항

- **[WARNING]** `stripExternalOnlyFields` 가 O(top-level 필드 수) shallow 검사에서 O(payload 전체 크기) 완전 재귀 순회로 바뀌었고, `emitExecutionEvent`/`emitNodeEvent` 라는 **가장 빈번한 hot path**(실행당 노드 수 × 이벤트 종류)에서 이벤트마다 무조건 실행된다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:339`(`stripExternalOnlyFields`), `:349-374`(`stripDeep` 구현), 호출부 `:524`(`emitExecutionEvent`)·`:595`(`emitNodeEvent`)
  - 상세: 종전 구현(`- if (!EXTERNAL_STRIPPED_FIELDS.some((f) => f in envelope)) return envelope;` 로 시작하는 삭제된 4줄)은 최상위 키만 확인하는 O(1)급 연산이었다. 새 `stripDeep` 은 배열/객체를 재귀로 완전히 순회하며, `llmCalls` 를 절대 포함하지 않는 일반 노드 이벤트(`NODE_STARTED`/`NODE_COMPLETED` 등, 주석 `:593` "node 이벤트는 현재 llmCalls 를 포함하지 않으나")에 대해서도 `nodeOutput` 전체(대용량 API 응답·배열 변환 결과 등)를 매번 완전히 순회한다. 이미 같은 payload 에 대해 `sanitizePayloadForWs`(credential 마스킹, `:249`)가 완전 재귀 순회를 수행하므로, 이번 변경은 **동일 hot path 에 두 번째 전체 트리 순회를 추가**하는 셈이다.
  - 보안 수정(중첩된 `llmCalls` 유출 차단)의 정당성은 인정하나, 성능 트레이드오프가 문서화되지 않았고 최적화 여지가 있다.
  - 제안: `sanitizePayloadForWs`/`sanitizeInner` 와 `stripDeep` 을 단일 재귀 pass 로 병합해 트리 순회를 1회로 줄인다. 또는 최소한 이 트레이드오프를 함수 JSDoc 에 명시한다.

- **[WARNING]** `stripDeep` 은 형제 함수 `sanitizePayloadForWs` 와 달리 **identity 캐시가 없다** — 동일 서브트리가 반복 emit 되는 hot loop(예: `SANITIZE_CACHE` 주석이 명시하는 "ForEach 가 같은 `node.config` 를 5,000회 emit" 케이스)에서 `sanitizePayloadForWs` 는 캐시로 1회만 계산하지만, `stripDeep` 은 매번 처음부터 완전 재귀한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349-374`(`stripDeep`, 캐시 부재) vs `:228-236`(`SANITIZE_CACHE`), `:249-263`(`sanitizePayloadForWs` 캐시 사용부)
  - 상세: `stripDeep` 은 `wireEnvelope`(`:506-513`, `emitExecutionEvent`)를 인자로 받는데, `wireEnvelope` 은 `seq`/`timestamp` 를 포함해 **매 호출마다 새로 생성되는 객체**(`{executionId, ...sanitizedPayload, seq, timestamp}`)라 최상위 identity 캐시를 붙여도 적중하지 않는다. 반복 emit 되는 것은 `sanitizedPayload` 내부의 특정 서브트리(예: `node.config`)인데, `stripDeep` 은 그 서브트리 identity 를 알 방법이 없어 매번 재순회한다.
  - AI 멀티턴 대화의 `nodeOutput.meta.turnDebug`(`ai-conversation-helpers.ts:97` `state.turnDebugHistory ?? []`)는 **턴 누적 전체**를 매 턴 emit 에 다시 싣는다 — 턴 N 에서 O(N) 크기 구조를 매번 완전 순회하므로 대화 길이에 대해 기존에도 O(T²) 성격의 비용이 있었는데(이미 `sanitizePayloadForWs` 가 이를 순회), 이번 변경으로 같은 O(T) 순회가 emit 당 한 번 더 늘어 상수 배가 증가한다.
  - 제안: 위 항목과 동일하게 두 pass 를 병합하면 `SANITIZE_CACHE` 의 캐시 이득을 strip 쪽도 자동으로 얻는다. 병합이 부담스럽다면 `stripDeep` 전용 `WeakMap` 캐시를 `sanitizedPayload`(래핑 전 원본 payload) 레벨에서 별도로 적용하는 방법도 검토.

- **[INFO]** `stripDeep` 의 배열/객체 분기 모두 **변경 여부와 무관하게 임시 컨테이너를 먼저 할당**한 뒤 `changed` 가 false 면 버린다 — JSDoc 의 "common path 는 할당이 없다"는 주장은 최종 반환값(최상위 identity)에는 맞지만, 재귀 도중의 각 서브트리 레벨에서는 매번 임시 객체/배열(GC 대상)이 생성된다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349-374`(`stripDeep`) — 특히 배열 분기 `:352`(`value.map(...)` 은 무조건 새 배열 생성) 및 객체 분기 `:363`(`const out: Record<string, unknown> = {}` 무조건 생성)
  - 상세: 형제 함수 `sanitizeInner`(`:265-291`)의 객체 분기는 `let result: Record<string, unknown> | null = null` 로 **지연 할당**(변경이 실제 발생할 때만 clone) 패턴을 쓰는 반면, `stripDeep` 은 이 패턴을 따르지 않고 항상 먼저 할당한다. `payload` 전체 트리 규모가 커질수록(대화 히스토리·대용량 노드 출력) 이 임시 가비지 양이 누적된다.
  - 제안: `stripDeep` 도 `sanitizeInner` 와 동일한 지연 할당 패턴(`out = null` 시작, 실제 변경 시에만 `{ ...obj }`/새 배열 생성)으로 맞추면 불필요한 재귀 도중 임시 할당을 줄이고 두 함수 간 구현 일관성도 확보된다.

- **[INFO]** `stripDeep` 은 순환 참조뿐 아니라 **재귀 깊이 제한도 없다** — 형제 함수 `sanitizeInner`/`sanitizePayloadForWs` 는 `MAX_SANITIZE_DEPTH`(=10, `:226`)로 깊이를 제한하는 반면 `stripDeep` 은 무제한 재귀한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349-374`(`stripDeep`), 대조: `:226`(`MAX_SANITIZE_DEPTH`), `:251`(`sanitizePayloadForWs` 의 depth 체크)
  - 상세: JSDoc(`:346-347`)은 순환 참조를 의도적으로 다루지 않는다고 설명하지만("어차피 뒤이은 `JSON.stringify` 에서도 죽는다"), 깊이 제한 부재는 별개 문제다 — 매우 깊게 중첩된(비순환) 구조(예: 도구 호출 결과에 포함된 재귀적 JSON, MCP 서버가 반환하는 임의 깊이 데이터)가 있으면 `sanitizeInner` 는 depth 10 에서 조기 종료하지만 `stripDeep` 은 스택이 허용하는 한 계속 내려간다. 실제 payload 특성상 위험은 낮지만(엔진 내부 구조가 대개 얕음), 형제 함수와의 방어 수준 비대칭은 근거가 문서화되어 있지 않다.
  - 제안: 위험이 낮다고 판단되면 그 판단 근거를 JSDoc 에 한 줄 추가하거나, 방어적으로 `MAX_SANITIZE_DEPTH` 와 동일한 상한을 적용한다.

- **[INFO]** 신규 테스트("제거할 필드가 없으면 fanout payload 가 wire envelope 과 동일 객체다") 는 최상위 `nodeOutput` 참조 동일성만 단언한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:733-734`
  - 상세: clone-on-write 계약을 검증하는 목적엔 부합하나, 위에서 지적한 "중간 서브트리 임시 할당" 부분까지는 커버하지 않는다(참조 동일성만 보므로 통과함). 별도 조치 불필요, 참고용.

## 요약

이번 변경의 핵심은 `EXTERNAL_STRIPPED_FIELDS` strip 을 top-level(depth-1) 전용에서 전체 깊이(depth-agnostic) 로 바꾼 보안 수정이며, 이는 실제로 새고 있던 raw LLM 프롬프트/응답 유출을 막는 정당한 트레이드오프다. clone-on-write 로 "변경 없으면 원본 참조 반환" 이라는 핵심 불변식은 최상위 레벨에서 올바르게 유지되고, 새 테스트가 이를 직접 검증한다. 다만 이 정확성 개선은 비용을 수반한다 — strip 이 이제 O(payload 전체 크기) 완전 재귀 순회가 되었고, 이는 이미 존재하던 `sanitizePayloadForWs` 의 credential-masking 완전 순회와 **동일 hot path(모든 execution/node 이벤트 emit)에서 중복**되며, 형제 함수가 갖춘 `SANITIZE_CACHE` 캐시 이득도 얻지 못한다. AI 멀티턴 대화의 누적 `turnDebugHistory` 처럼 턴이 늘수록 커지는 구조에서는 이 중복 순회 비용이 누적된다. 치명적 회귀는 아니며(선형 배율 증가, 캐시 부재로 최적 대비 손해는 있지만 상한이 있음), 두 순회를 하나로 합치거나 strip 쪽에도 캐시를 붙이는 후속 최적화를 권장한다.

## 위험도

MEDIUM
