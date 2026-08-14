### 발견사항

- **[WARNING]** `stripExternalOnlyFields`(재귀 전체 순회)가 `emitNodeEvent` 의 **모든** node 이벤트(NODE_STARTED/COMPLETED/FAILED/SKIPPED)에 무조건 걸리는데, `NODE_COMPLETED` payload 는 실제로 크기가 무제한인 `output`/`input` 전체(HTTP 응답 JSON, Loop/ForEach 누적 데이터 등)를 싣는다. 이 worst case 는 측정된 적이 없다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:503-538`(`emitNodeEvent`, strip 호출은 524-527) — `522|` 주석 "node 이벤트는 현재 llmCalls 를 포함하지 않으나 … 방어심층화". 근거(변경 안 된 파일이지만 실제 payload 크기 증거): `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5946-5957` 의 `NODE_COMPLETED` emit 이 `output: nodeExecution.outputData` / `input: nodeExecution.inputData` 를 그대로 싣는다.
  - 상세: `emitNodeEvent` 는 이미 `sanitizePayloadForWs`(캐시 있음, `websocket.service.ts:430`/`510`)로 payload 를 한 번 전체 순회한 뒤, 이번 diff 가 추가한 `stripExternalOnlyFields`(캐시 없음, `strip-external-only-fields.ts:80-125` `stripDeep`)로 **같은 데이터를 다시 한 번** 전체 순회한다. `stripDeep` JSDoc(`strip-external-only-fields.ts:48-62`)에 적힌 유일한 실측(+20.2 µs/emit, 2.80배)은 "8턴 `turnDebugHistory` AI 대화 payload, N=3000" 한정이다. `emitNodeEvent` 는 `llmCalls` 를 가질 수 없는 node 이벤트에도 defense-in-depth 로 이 재귀 순회를 걸므로, 대용량 HTTP 응답·Loop 결과 같은 non-AI `nodeOutput` 이 실제 worst case 인데 그 시나리오는 벤치마크되지 않았다. `strip-external-only-fields.spec.ts` 에도 성능 테스트는 없고 정확성 테스트만 있다.
  - 제안: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:249-252` 에 이미 "대용량 non-AI payload A/B" 항목으로 등재돼 있다 — 착수 전 우선순위를 높이는 것을 권한다(대용량 HTTP 노드/Loop aggregation 워크플로가 프로덕션에 실재하면 매 node 이벤트마다 2×full-traversal 비용이 누적된다). 최소한 payload 크기(예: `JSON.stringify` 길이 또는 노드 outputData 크기 상한)와 상관관계를 한 번은 측정해 문서의 "실측했다" 범위를 넓힐 것.

- **[INFO]** `stripDeep` 에는 자매 `sanitizePayloadForWs` 의 `SANITIZE_CACHE`(WeakMap, identity 기반)에 대응하는 캐시가 없다 — 이미 인지·의도적으로 유예된 항목.
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:84-125`(`stripDeep`, 캐시 없음) ↔ `codebase/backend/src/modules/websocket/websocket.service.ts:237`(`SANITIZE_CACHE`)·`250-264`(`sanitizePayloadForWs`, depth 0 캐시 조회/저장)
  - 상세: `SANITIZE_CACHE` 의 JSDoc(`websocket.service.ts:233`)이 "ForEach 가 같은 `node.config` 를 5,000회 emit" 시나리오를 명시적으로 든다. 이 시나리오에서 `wireEnvelope` 자체는 매 emit `seq`/`timestamp` 때문에 새 객체지만, 그 안의 변경 없는 서브트리(`node.config` 등)는 `sanitizePayloadForWs` 캐시 덕에 참조가 재사용된다. `stripDeep` 은 이 재사용된 참조를 매번 다시 처음부터 재순회한다 — 캐시가 있었다면 O(1) 스킵이 가능했을 자리다. `review/code/2026/08/14/11_02_16/RESOLUTION.md`(WARNING 2)에 이미 같은 지적과 유예 근거(두 캐시 무효화 시점이 갈리는 조합을 덮는 테스트 부재)가 기록돼 있고 `plan/in-progress/spec-draft-eia-62-waiting-payload.md:245-248` 에 추적 중이다 — 유예 근거 자체는 타당하다고 판단하나, 위 WARNING(대용량 payload)과 결합하면 "크고 반복되는 서브트리" 케이스의 비용이 가장 크므로 두 항목을 함께 검토할 것을 권한다.
  - 제안: 별도 조치 불요(추적 중). 관측(APM 등)으로 실제 반복-emit 비율이 확인되면 우선순위 상향.

- **[INFO]** 재귀 전체 순회의 유일한 비용 증거가 JSDoc 주석의 1회성 수기 실측(+20.2 µs/emit)뿐이고, 이를 회귀로부터 지키는 커밋된 벤치마크/성능 테스트가 없다.
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:48-62`(§비용 JSDoc)
  - 상세: `EXTERNAL_STRIPPED_FIELDS` 에 필드가 추가되거나 `maxDepth` 가 커지면(호출부가 자매 sanitizer 와 값을 공유하므로 그 값이 바뀌면 자동으로 같이 커짐) 이 비용이 조용히 늘어나도 CI 가 감지할 방법이 없다. `strip-external-only-fields.spec.ts` 는 정확성만 검증한다.
  - 제안: 필수는 아니나, 위 WARNING 조치(대용량 payload A/B) 시 같은 스크립트를 `--expose-gc` 등으로 재사용 가능한 형태로 커밋해두면 향후 회귀를 자동으로 잡을 수 있다.

- **[INFO]** `interaction.service.ts` 의 `stripAndRedact` 는 순서(strip 먼저 → redact)를 의도적으로 설계해, `llmCalls` 서브트리(대개 최대 필드)에 `deepRedactSecrets` 의 비싼 정규식 다중 패스가 걸리지 않도록 했다 — 성능 관점에서 문제 없음(오히려 최적화), 확인만 하고 기록.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:98-108`(`stripAndRedact`)
  - 알고리즘 복잡도(재귀 O(n), depth cap 10)·N+1(getStatus 는 waiting/completed/failed 각 분기에서 `stripAndRedact` 1회만 호출, 배치 불필요)·메모리(lazy clone-on-write 로 변경 없는 서브트리는 재할당 없음)·데이터 구조 관점에서 이 diff 의 다른 부분은 문제 없음.

### 요약
이번 diff 는 보안 결함(depth-1 strip 우회)을 고치기 위해 `llmCalls` strip 을 얕은 top-level 삭제에서 깊이 무관 재귀 순회로 전환하고, REST(`getStatus`)와 WS fanout(`emitExecutionEvent`/`emitNodeEvent`) 양쪽에 동일 헬퍼를 적용했다. 순회가 이미 존재하던 `sanitizePayloadForWs`/`deepRedactSecrets` 패스에 추가로 얹히는 두 번째 full-tree 순회이며, 유일한 실측(+20.2 µs/emit, 2.8배)은 AI 대화 payload 한정이다. 가장 실질적인 리스크는 `emitNodeEvent` 가 방어심층화 명목으로 **모든** node 이벤트에 이 순회를 걸면서, `NODE_COMPLETED` 가 실제로 크기 무제한인 `outputData`/`inputData` 전체를 싣는다는 점(확인함)이다 — 이 worst case 는 미측정 상태로 이미 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 에 후속 항목으로 정직하게 등재돼 있다. identity 캐시 부재도 마찬가지로 인지·유예된 항목이다. 알고리즘 자체(clone-on-write, depth cap, 배열 부분 clone)는 효율적으로 설계됐고 N+1·블로킹 I/O·불필요한 O(n²) 패턴은 발견되지 않았다.

### 위험도
LOW
