# 부작용(Side Effect) Review — websocket.service.ts `stripExternalOnlyFields`/`stripDeep`

## 발견사항

- **[WARNING]** 재귀 strip 이 caching 없이 매 이벤트 emit 마다 payload 전체 트리를 순회한다 — `sanitizePayloadForWs` 와 달리 hot-path 방어가 없다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349` (`stripDeep`), 호출부 `:339`(`stripExternalOnlyFields`), 실사용 지점 `:524`(`emitExecutionEvent`)·`:595`(`emitNodeEvent`)
  - 상세: 기존 구현은 `EXTERNAL_STRIPPED_FIELDS.some((f) => f in envelope)` 로 top-level key 존재만 O(1)~O(top-level 키 수) 확인했다. 신규 `stripDeep` 은 `wireEnvelope` 전체를 depth-first 로 재귀 순회한다 — `llmCalls` 를 포함하지 않는 event(node 이벤트 대부분, 대용량 `nodeOutput`/향후 `result.outputs` 등)도 매번 전체 서브트리를 훑어야 한다. 바로 위에 있는 자매 함수 `sanitizePayloadForWs`(`:249`)는 동일한 "ForEach 가 같은 config 를 5,000회 emit" 케이스를 `SANITIZE_CACHE`(WeakMap, `:236`)로 명시적으로 캐싱하는데, `stripDeep` 은 이 패턴을 공유하지 않는다. `wireEnvelope` 자체는 매 emit 마다 새로 spread 되는 객체(`:506~513`)라 top-level 캐시는 애초에 안 맞지만, 내부 공유 서브트리(`sanitizePayloadForWs` 캐시가 반환한 동일 참조)에 대해서도 `stripDeep` 은 매번 재순회한다. clone-on-write 로 "제거할 게 없으면 새 객체를 안 만든다"는 **할당** 비용은 막았지만, **순회** 비용 자체는 그대로 남아 있다 — JSDoc 이 "no allocation on the common path" 만 주장하고 순회 비용은 언급하지 않아 문서상 성능 주장과 실제 비용이 어긋난다.
  - 제안: hot-path(ForEach 등 고빈도 emit) 영향이 실측으로 크면 `stripDeep` 에도 입력 identity 기반 캐시를 추가하거나, `llmCalls` 가 존재할 가능성이 있는 서브트리(AI 관련 payload)로 순회 범위를 한정하는 것을 검토. 크지 않다면 이 자체는 수용 가능하지만 최소한 JSDoc 에 "순회는 매번 발생, 할당만 skip" 이라고 명확히 해 후속 오해를 막을 것.

- **[INFO]** strip 판단 기준이 "위치(top-level)" 에서 "이름(어디서든 `llmCalls`)" 으로 바뀌어, 이번에 고치려는 `waiting_for_input` 외 **모든** 이벤트 타입의 외부 fanout 계약이 조용히 넓게 바뀐다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:322`(`EXTERNAL_STRIPPED_FIELDS`), `:349`(`stripDeep`)
  - 상세: 새 JSDoc(`:312~314`)이 "필드명 자체가 문서화된 비밀 마커이므로 이름으로 막는다"고 명시적으로 설계 의도를 밝히고 있어 의도치 않은 변경은 아니다. 다만 이 결정의 사정거리는 `execution.waiting_for_input` 하나가 아니라 `emitExecutionEvent`/`emitNodeEvent` 를 타는 **모든** 이벤트로 확장된다 — 향후 어떤 노드 타입이 디버그 목적이 아닌 필드에 우연히 `llmCalls` 라는 이름을 재사용하면(현재 코드베이스 grep 결과 `information-extractor.handler.ts`/`text-classifier.handler.ts`/`ai-turn-executor.ts` 등 기존 사용처는 전부 디버그/트레이스 목적이라 collateral 없음 확인) 자동으로 외부 수신자에게서 사라진다. 문서화된 의도적 트레이드오프이므로 결함은 아니나, "인터페이스 변경" 관점에서 외부 fanout 계약의 스코프가 이번 커밋으로 전역적으로 넓어졌다는 점은 리뷰 기록으로 남길 가치가 있다.

- **[INFO]** `stripDeep` 은 재귀 깊이 제한·순환 참조 가드가 없다 — 현재는 앞단 `sanitizePayloadForWs`(`MAX_SANITIZE_DEPTH=10`)가 암묵적으로 깊이를 제한해 주고 있어 안전하지만, 이 보호는 호출 순서에 대한 우연한 의존이다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349`(`stripDeep`), 비교 대상 `:226`(`MAX_SANITIZE_DEPTH`)·`:251`(depth cap 체크)
  - 상세: `stripDeep` 자신의 JSDoc(`:346~347`)이 "순환 참조는 다루지 않는다 — 어차피 뒤이어 `JSON.stringify` 가 죽는다" 고 명시적으로 트레이드오프를 인정한다. 실제로 `stripExternalOnlyFields(wireEnvelope)` 호출(`:524`, `:595`) 은 항상 `sanitizePayloadForWs` 를 먼저 거친 `wireEnvelope` 에 대해서만 이뤄지므로, depth > 10 서브트리는 이미 `'[REDACTED_DEPTH]'` 문자열로 잘려 있어 `stripDeep` 이 실제로 마주치는 최대 깊이는 사실상 `MAX_SANITIZE_DEPTH` 근처로 bounded 된다. 다만 이는 `stripDeep` 자체의 방어가 아니라 **호출 순서**(sanitize → strip)에 의한 암묵적 보호다. 향후 `stripDeep`/`stripExternalOnlyFields` 가 sanitize 를 거치지 않은 원본 payload 에 재사용되거나 두 호출의 순서가 바뀌면 이 보호가 조용히 사라진다.
  - 제안: 필수는 아니나, `stripDeep` JSDoc 에 "이 함수는 반드시 `sanitizePayloadForWs` 이후에만 호출해 깊이가 이미 bounded 되어 있어야 한다"는 전제를 명시하면 향후 재사용 시 회귀를 막을 수 있다.

## 확인했으나 문제 없음 (positive findings)

- `stripExternalOnlyFields` 는 export 되지 않는 내부(private) 함수이고 시그니처(`(envelope: Record<string, unknown>) => Record<string, unknown>`)도 변경되지 않았다 — 외부 호출자·공개 API 영향 없음(`grep` 결과 호출부는 같은 파일의 `emitExecutionEvent`/`emitNodeEvent` 2곳뿐).
- `stripDeep` 은 배열은 `.map()`, 객체는 새 `out` 객체를 만드는 방식이라 입력을 어떤 경로로도 mutate 하지 않는다 — JSDoc 의 "Never mutates the input" 주장과 구현이 일치.
- clone-on-write 정체성 보장(변경 없으면 원본 참조 그대로 반환)이 새 테스트(`websocket.service.spec.ts` 게이트 715~735, "제거할 필드가 없으면 fanout payload 가 wire envelope 과 동일 객체다")로 실제로 회귀 가드된다.
- 전역 상태·환경 변수·파일시스템·네트워크 호출과 관련된 변경은 없음(순수 함수 리팩터 + 테스트 추가).
- `plan/*.md`, `review/consistency/**` 신규 파일(파일 3~12)은 신규 문서 추가일 뿐 런타임 부작용 없음 — 소스코드 부작용 검토 범위와 무관.

## 요약

핵심 변경은 `stripExternalOnlyFields` 를 top-level shallow delete 에서 depth-무관 재귀 clone-on-write(`stripDeep`)로 바꾼 것이며, 실제로 두 개의 새는 경로(`turnDebug.llmCalls.llmCalls[]`, `nodeOutput.meta.turnDebug[].llmCalls[]`)를 막는 보안 수정이다. 시그니처·공개 인터페이스·전역 상태·환경 변수·네트워크 호출 관점에서는 부작용이 없고, mutate-free 보장과 identity 보존도 신규 테스트로 뒷받침된다. 다만 (1) 이 재귀 순회가 `llmCalls` 유무와 무관하게 **모든** execution/node 이벤트에서 매번 전체 payload 트리를 훑도록 바뀌었는데 이웃 함수 `sanitizePayloadForWs` 가 갖는 WeakMap 캐시가 없어 고빈도 emit(ForEach 등) 경로에서 순회 비용이 늘어날 수 있고, (2) strip 기준이 "이름 기반 전역 마커"로 넓어지면서 이번에 고친 이벤트 외 모든 이벤트 타입의 외부 fanout 계약이 함께 넓게 바뀌었으며, (3) 깊이/순환 가드가 앞단 `sanitizePayloadForWs` 호출 순서에 암묵적으로 의존한다는 세 가지를 기록해 둔다. 셋 다 즉시 차단할 결함은 아니고 WARNING/INFO 수준이다.

## 위험도

LOW
