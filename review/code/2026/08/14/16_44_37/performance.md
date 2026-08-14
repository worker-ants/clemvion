### 발견사항

- **[WARNING]** REST 스냅샷(`getStatus`)이 `outputData` 를 이제 **두 번** 완전 재귀 순회한다 — 새 `stripExternalOnlyFields` pass 는 이 경로에서 실측된 적이 없다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:98`(`function stripAndRedact`), 호출부 `:379`(waiting `nodeOutput`)·`:441`(`result`)·`:445`(`error`)
  - 상세: `stripAndRedact()` 는 `deepRedactSecrets(stripExternalOnlyFields(value, MAX_REDACT_DEPTH))` 로 두 개의 독립된 재귀 트리 순회를 순차 실행한다. 종전에는 `deepRedactSecrets` 단독 1회 순회였다. `strip-external-only-fields.ts` JSDoc 의 "비용 (실측)" 절과 `plan/in-progress/spec-draft-eia-62-waiting-payload.md:249-295` 는 **WS emit 경로**(`sanitizePayloadForWs` + `stripExternalOnlyFields`)만 A/B 측정했고(8턴 payload +20.2 µs/emit, 대용량 non-AI payload 최대 +61 ms @ 6.5 MB, 2.4~2.8배), 같은 플랜 문서가 이미 **"엔진 emit 호출부 4곳 전부 `outputData`/`inputData` 를 무가공 탑재"·"`outputData` JSONB 가 수십 MB 까지 증가한 실제 이력"·"상한은 없다"** 를 실측·기록해 뒀다. 그런데 이번 diff 로 새로 생긴 REST `stripAndRedact` 이중 순회는 이 관측 어디에도 포함돼 있지 않다 — WS 는 `SANITIZE_CACHE`/`DEEP_REDACT_CACHE`(WeakMap, depth-0)로 반복 emit 을 완화하지만, REST 는 요청마다 새로 로드한 객체라 캐시가 원천적으로 적중하지 않는다(단발 호출이라 무효). 즉 REST 스냅샷은 WS 보다 **캐시 이득이 없는 채로 같은 이중 순회 비용**을 그대로 진다. `GET /api/external/executions/:id` 는 spec 상 SSE `replay_unavailable` 수신 시 클라이언트가 재조회하도록 문서화돼 있어(`spec/5-system/14-external-interaction-api.md:427`), 네트워크 flapping 구간에서 반복 호출될 수 있다.
  - 제안: WS emit 경로와 같은 방식으로 REST `getStatus` 경로에 대해 별도 A/B(특히 대용량 `outputData`)를 측정해 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 "대용량 non-AI payload A/B" 항목에 병기하거나, 이 경로 전용 후속 항목으로 등재할 것. 이미 프로젝트가 "유예 근거는 실측해야 한다" 관례를 갖고 있으므로, 유예하더라도 반드시 숫자를 남길 것.

- **[INFO]** WS fanout 경로의 이중 순회 자체는 이미 실측·유예된 항목 — 재지적 아님, 참조로만 기록
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:250-264`(`sanitizePayloadForWs`, `SANITIZE_CACHE` 캐시 있음), `:450-453`·`:524-527`(`stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)`, 캐시 없음)
  - 상세: `emitExecutionEvent`/`emitNodeEvent` 는 이미 캐시된 `sanitizePayloadForWs` 순회 뒤에 캐시 없는 `stripExternalOnlyFields` 순회를 추가로 돈다 — node 이벤트는 구조적으로 `llmCalls` 를 가질 수 없어도 방어심층화로 매번 순회한다. `plan/in-progress/spec-draft-eia-62-waiting-payload.md:245-295` 가 이미 이 비용을 측정(+20.2 µs/emit 통상, 대용량 최대 +61 ms/6.5 MB, 2.4~2.8배)하고 "보안 수정이 성능보다 우선, 관측되면 붙인다" 는 근거로 identity 캐시·native 선판정·payload 상한을 후속 후보로 등재해 뒀다. 새 결함이 아니므로 이번 라운드에서 별도 조치를 요구하지 않는다.
  - 제안: 조치 불요 — 위 plan 항목 추적 유지.

- **[INFO]** `stripDeep` 의 객체 분기가 변경이 없을 때도 `Object.entries(obj)` 로 `[key, value]` 배열을 매번 새로 할당한다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:121`(`for (const [k, v] of Object.entries(obj)) {`)
  - 상세: 반환 **참조**는 변경이 없으면 원본을 그대로 돌려주지만(clone-on-write 계약 충족), 순회 자체는 매 object 노드마다 `Object.entries` 로 임시 배열을 할당한다 — `for...in` + `hasOwnProperty` 로 대체하면 이 할당을 없앨 수 있다. 이미 `review/code/2026/08/14/12_06_20/RESOLUTION.md` INFO 3 에서 "정확한 지적. '할당 없음' 은 반환 identity 에 대한 주장이고 순회 자체는 배열을 만든다" 로 확인·유예된 사항이라 재지적이 아니라 참조로만 남긴다.
  - 제안: 조치 불요 — 다음에 이 함수를 만질 때 반영 예정으로 이미 처분됨.

- **[INFO]** 알고리즘 자체(선형 시간, 재귀 깊이 상한, clone-on-write)는 건전하다 — 확인했으나 문제 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:105-146`(`stripDeep`)
  - 상세: 깊이 상한(`maxDepth`)으로 무한 재귀를 차단하고, 배열/객체 모두 변경분만 얕은 복제(`value.slice()`/`{...obj}`)해 참조를 보존한다 — 크기에 대해 숨은 이차항 없음은 `plan/in-progress/spec-draft-eia-62-waiting-payload.md:253-262` 의 실측(µs/KB 가 3자릿수 구간에서 2.66~2.83 로 안정)으로 이미 검증됐다. `__proto__` 방어도 스프레드 기반이라 추가 순회·할당이 없다.
  - 제안: 없음(positive finding).

### 요약

이번 라운드의 실질 코드 델타(`interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts`)는 보안 결함(REST 스냅샷의 `llmCalls` 누출) 수정이 중심이고, 그 과정에서 성능 트레이드오프는 대체로 투명하게 측정·문서화돼 있다 — WS fanout 경로의 이중 순회 비용은 A/B 로 실측(+20.2 µs/emit 통상, 대용량 최대 +61 ms)되어 있고 "관측되면 캐시를 붙인다" 는 근거와 함께 plan 에 후속 항목으로 명시적으로 유예됐다. 다만 이번 diff 로 새로 생긴 REST `getStatus` 경로의 `stripAndRedact` 이중 순회(strip + redact)는 같은 수준의 실측이 아직 없다 — WS 경로와 달리 단발 호출이라 identity 캐시의 이득도 없고, 같은 plan 문서가 이미 `outputData` 가 상한 없이 수십 MB 까지 커질 수 있음을 실측해 뒀기 때문에 이 갭이 잠재적으로 의미 있는 지연을 만들 수 있다. 나머지(`Object.entries` 할당, `stripDeep` 알고리즘 건전성)는 이미 이전 라운드에서 확인·유예된 사항으로 새로운 위험이 아니다.

### 위험도
LOW
