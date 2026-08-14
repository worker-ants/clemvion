# 성능(Performance) 코드 리뷰

대상: `codebase/backend/src/modules/websocket/websocket.service.ts` (`stripDeep`/`stripExternalOnlyFields` 재작성),
`websocket.service.spec.ts` (신규 테스트). `CHANGELOG.md`·`plan/**`·`review/**`(10_32_27 산출물 포함)는
문서/리뷰 산출물이라 본 관점 대상 아님.

이 diff 는 직전 라운드(`10_32_27`)의 performance WARNING("hot path 이중 완전 순회")을
JSDoc(websocket.service.ts:370-384)에 A/B 실측(N=3000, +20.2 µs, 2.80배)과 함께 **명시적으로 유예**하고,
maintainability WARNING("no allocation" 과장)과 security W1/W4(프로토타입 오염, 깊이 상한 부재)는 실제로
고쳤다(지연 할당 `out: T | null = null` 패턴 + `MAX_SANITIZE_DEPTH` 적용). 이 유예/수정 자체는 근거가
측정돼 있어 타당하다. 다만 그 수정 과정에서 두 가지 새 비용이 생겼고, 유예 근거였던 벤치마크가 이번
diff 로 넓어진 실제 사용 범위를 커버하지 않는다.

## 발견사항

- **[WARNING]** `stripDeep` 에 형제 `sanitizePayloadForWs` 의 `SANITIZE_CACHE` 같은 identity 캐시가 없어, 그 캐시가 존재하는 **바로 그 이유**("ForEach 가 같은 `node.config` 를 5,000회 emit")가 strip 쪽에서는 여전히 O(5000 × subtree) 로 남는다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:386-421` (`stripDeep`, 캐시 없음) 대 `:236`(`SANITIZE_CACHE` 선언), `:254-262`(`sanitizePayloadForWs` 캐시 조회/저장)
  - 상세: `emitExecutionEvent`(`:551`)/`emitNodeEvent`(`:628`)는 `sanitizedPayload = sanitizePayloadForWs(payload)` 를 먼저 호출한다. 같은 서브트리(`node.config` 등)가 반복 emit 되면 이 호출은 `SANITIZE_CACHE` 적중으로 O(1) 이 된다(주석 `:231` "5,000회 emit 해도 sanitize 는 1회만 수행"). 그런데 그 결과를 감싼 `wireEnvelope`(매 emit 마다 `seq`/`timestamp` 로 새로 만들어지는 객체, `:553-560`·`:630-637`)를 `stripDeep(wireEnvelope, 0)` 에 넘기면, `wireEnvelope` 의 자식이 캐시 적중으로 **동일 참조**를 가리켜도 `stripDeep` 자신은 캐시가 전혀 없어 그 서브트리를 매번 처음부터 완전 재귀한다. 즉 sanitize 쪽 비용이 O(1) 로 줄어든 바로 그 반복 emit 시나리오에서, strip 쪽 비용만 O(N × subtree size) 로 남아 상대적으로 지배적인 비용이 된다. 이 시나리오는 `websocket.service.spec.ts:172`("동일 객체 reference 재방문 시 sanitize 결과를 WeakMap 캐시로 재사용")에서 테스트되지만, 이 테스트는 `emitBackgroundRunEvent`(`:685-701`, `stripExternalOnlyFields` 를 호출하지 않음)만 검증해 `stripDeep` 의 무-캐시 상태는 어떤 테스트로도 드러나지 않는다.
  - 제안: 최소한 이 gap 을 JSDoc(현재 `:342-385`)에 명시하거나, `wireEnvelope` 의 자식 서브트리 단위로 `stripDeep` 전용 `WeakMap` 캐시를 추가한다. 두 pass 를 합치는 것이 부담스럽다면 캐시만이라도 별도로 붙이는 편이 저비용 고효율이다.

- **[WARNING]** 유예 근거로 제시된 A/B 벤치마크(8턴 `turnDebugHistory` AI 대화 payload)가 이번 diff 로 넓어진 `stripDeep` 실사용 범위(모든 node 이벤트)를 대표하지 않는다
  - 위치: 벤치마크 JSDoc `codebase/backend/src/modules/websocket/websocket.service.ts:370-384`, 대비 호출부 `:640-642`(`emitNodeEvent` 의 `stripExternalOnlyFields` 호출과 그 주석)
  - 상세: `:640-641` 주석은 "node 이벤트는 현재 `llmCalls` 를 포함하지 않으나, 미래 누출 경로를 차단하기 위해 `emitExecutionEvent` 와 동일하게 strip 적용(방어심층화)" 이라고 명시한다 — 즉 이 diff 는 **`llmCalls` 가 절대 없다고 알려진 이벤트에도** 완전 재귀 strip 을 무조건 건다. `emitNodeEvent` 의 `payload`(→ `nodeOutput`) 크기는 AI 대화 턴 수와 무관하게 임의로 클 수 있다(HTTP 노드의 대용량 JSON 응답, 배열/CSV 파싱 결과, ForEach 반복 출력 등) — 반면 벤치마크는 "AI 대화 8턴" 이라는, 상대적으로 작고 자연스러운 상한(모델 context 한도)이 있는 케이스만 측정했다. `sanitizePayloadForWs` 가 이미 같은 payload 를 한 번 완전 순회하는 상황에서, `stripDeep` 의 두 번째 완전 순회가 **대용량 non-AI node output** 에 대해서도 무조건 실행되는데, 이 케이스의 실측치는 JSDoc 에 없다. +20.2 µs 라는 수치로 "얼마 안 든다" 고 결론 내린 근거가, 실제로 이 diff 가 새로 활성화한 경로(모든 node 이벤트)의 worst case 를 대표하지 못한다.
  - 제안: 대용량 `nodeOutput`(예: 수천 행 배열, 수백 KB JSON) 시나리오로 같은 A/B 를 추가 측정해 JSDoc 수치에 반영하거나, `llmCalls` 를 원천적으로 가질 수 없는 이벤트(현재 모든 node 이벤트)에는 `stripDeep` 자체를 스킵하고 향후 실제로 `llmCalls` 를 emit 하는 node 이벤트가 생길 때 그 지점에서만 켜는 방식(현재의 "미래 대비" 방어심층화를 이름 기반 조건부로 좁힘)을 검토한다.

- **[INFO]** 객체 분기가 값이 바뀐 **모든** key 에 대해 `Object.defineProperty` 를 쓰는데, 같은 JSDoc 의 실측이 스프레드 이후엔 bracket 대입도 안전하다고 이미 증명했다 — 안전을 위해 필요한 범위보다 넓게 비용을 문다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:408-417`(`stripDeep` object 분기, 특히 `:412-417` `Object.defineProperty(out, k, {...})`)
  - 상세: JSDoc(`:353-358`)은 "방어는 스프레드가 한다 … 스프레드 후에는 bracket 대입도 오염을 일으키지 않고, 빈 `{}` 에서만 일어난다. 아래 `Object.defineProperty` 는 그 위의 **중복 방어**" 라고 스스로 적는다. 즉 현재 구현(먼저 `out ??= { ...obj }`, 그 다음 대입)에서는 `k !== '__proto__'` 인 절대다수의 키에 대해 `Object.defineProperty` 가 correctness 상 불필요하다는 것을 직접 실측·명시하면서도, 코드는 모든 changed key 에 대해 예외 없이 `defineProperty` 를 호출한다. `Object.defineProperty` 는 V8 에서 일반 property write 보다 오버헤드가 크다(디스크립터 검증·existing-property 조회 경로). 형제 `sanitizeInner`(`:276-291`)는 동일 상황(스프레드 후 대입)에서 평범한 `result[k] = sanitized` 를 쓴다.
  - 제안: `k === '__proto__'` 일 때만 `defineProperty` 경로를 타고, 그 외 키는 `out[k] = s` bracket 대입으로 되돌리면 안전 마진(향후 `out` 생성 방식이 바뀌어도 방어)과 hot path 비용을 동시에 만족한다. 영향은 "무언가 실제로 strip 된" 드문 경로에만 미치므로 우선순위는 낮다.

## 확인했으나 문제 없음 (positive findings)

- 배열 분기(`:389-397`)는 첫 변경 감지 시점에만 `value.slice()` 로 1회 얕은 복사하고 이후 인덱스는 직접 대입 — O(n) 단일 패스이며 O(n²) 패턴 없음.
- `MAX_SANITIZE_DEPTH` 깊이 상한 도입(`:387`)으로 이전 라운드에서 지적된 무제한 재귀 위험이 해소됨.
- 지연 할당 패턴(`out: T | null = null`)으로 "공통 경로(변경 없음)는 새 할당 없이 원본 참조 반환" 이라는 JSDoc 의 최상위 주장은 실제 구현과 일치한다(각 서브트리 레벨에서도 변경이 없으면 할당하지 않음 — 직전 라운드 maintainability WARNING 이 실제로 해소됨).
- `EXTERNAL_STRIPPED_FIELDS.includes(k)` 의 O(n) 선형 탐색은 원소가 1개뿐이라 실질 비용 없음 — 필드가 늘어날 때 `Set` 전환을 고려할 사안, 현시점 조치 불요.

## 요약

핵심 보안 수정(`stripExternalOnlyFields` 를 depth-1 shallow 에서 depth-agnostic `stripDeep` 으로 교체)과 그
후속 하드닝(지연 할당, `__proto__` 방어, 깊이 상한)은 이전 라운드가 지적한 대부분의 결함을 실제로
해소했고, 유예된 "이중 완전 순회" 성능 비용도 근거를 실측해 문서화한 점은 이 저장소의 관례에 부합한다.
다만 그 실측(8턴 AI 대화 payload 기준 +20.2 µs)은 이번 diff 가 함께 확장한 실사용 범위 — `llmCalls` 를
가질 수 없다고 스스로 명시한 모든 node 이벤트에도 무조건 `stripDeep` 을 거는 것(`:640-642`) — 의 worst
case(대용량 non-AI node output)를 대표하지 못하며, `sanitizePayloadForWs` 가 이미 갖춘 `SANITIZE_CACHE`
의 반복-emit 최적화 효과를 `stripDeep` 은 전혀 누리지 못해 해당 hot-loop 시나리오(ForEach 5,000회 emit)
에서 strip 비용만 선형으로 재발생한다. 두 WARNING 모두 치명적 회귀는 아니지만(상한 있는 구조, 이미
알려진 트레이드오프의 연장선), 유예 근거로 쓰인 벤치마크의 대표성과 캐시 부재는 후속 조치 없이는
"이미 측정해서 괜찮다"는 결론을 그대로 확장 적용하기 어렵다. `Object.defineProperty` 전면 적용은 자체
실측이 "불필요"를 이미 증명한 안전장치를 hot path 전역에 깔아 둔 것으로, 영향은 작지만 손쉽게 좁힐 수
있다.

## 위험도

MEDIUM
