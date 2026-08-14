### 발견사항

- **[INFO]** `stripDeep`(신규 `stripExternalOnlyFields`)이 `emitExecutionEvent`/`emitNodeEvent`·`getStatus` 의 기존 full-tree 순회(`sanitizePayloadForWs`/`deepRedactSecrets`)에 **두 번째 전체 순회**를 추가한다 — 이미 3라운드(`11_02_16`→`15_58_26`)에 걸쳐 실측·문서화·plan 추적된 항목이며 이번 라운드에서 코드 변경은 없다(확인)
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` `stripDeep` 함수 · `codebase/backend/src/modules/websocket/websocket.service.ts` `emitExecutionEvent`/`emitNodeEvent` 내 `stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)` 호출부(두 곳) · `codebase/backend/src/modules/external-interaction/interaction.service.ts` `stripAndRedact` 함수
  - 상세: `git diff origin/main...HEAD`로 대조한 결과 `stripDeep` 알고리즘 자체(O(n) 재귀, lazy clone-on-write, depth cap 10, 배열 부분 clone)는 이번 라운드에서 변경되지 않았다. `plan/in-progress/spec-draft-eia-62-waiting-payload.md:249-295`에 실 emit 경로 A/B 실측이 이미 남아 있다 — 6.5MB payload 기준 strip 유무 39.0ms→99.7ms(+61ms, 2.56배), 선형(µs/KB 안정, 숨은 이차항 없음). 상한 부재("`output`/`inputData` 에 크기 캡 없음, DB rows·HTTP 응답이 무제한, `outputData` 가 수십 MB 까지 큰 실제 이력 있음")도 실측·확인됐고, **strip 없이도 이미 39ms 가 걸린다는 점**에서 이 결함(캡 부재)은 strip 과 무관한 선존 문제로 올바르게 분류돼 있다. `15_58_26` RESOLUTION 에 "보안 수정이 성능보다 우선, 후속 후보(identity 캐시/native 선판정/크기 상한) 3가지를 남기고 이번 PR 에서는 고치지 않는다"는 근거가 명시돼 있다 — 프로젝트 규약("유예 근거는 실측해야 한다")을 충족하는 유예다.
  - 제안: 조치 불요(이번 라운드 신규 변경 없음, 이미 측정·유예됨). `stripDeep` identity 캐시(아래 항목)와 함께 관측(APM) 후 우선순위 재평가.

- **[INFO]** `stripDeep`에 자매 `sanitizePayloadForWs`의 `SANITIZE_CACHE`(WeakMap, identity 기반)에 대응하는 캐시가 없다 — 3라운드 연속 인지·의도적 유예, 이번 라운드 변경 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` `stripDeep` (캐시 없음) ↔ `codebase/backend/src/modules/websocket/websocket.service.ts:227` 부근 `SANITIZE_CACHE`
  - 상세: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:245-248`에 "지금 붙이지 않는 이유: 두 캐시의 무효화 시점이 갈려 조합 테스트 공백이 생긴다. 관측되면 붙인다(현재 비용 +20.2 µs/emit)"로 근거가 실측과 함께 명시돼 있다. ForEach 대량 반복 emit 시나리오에서 `wireEnvelope`의 변경 없는 서브트리(`sanitizePayloadForWs` 캐시로 참조 재사용됨)를 `stripDeep`이 매번 재순회하는 것은 사실이나, 캐시 미도입의 이유가 임의가 아니라 실측 비용 + 무효화 리스크 분석에 근거한다.
  - 제안: 조치 불요(추적 중, 실측 기반 유예).

- **[INFO]** `stripAndRedact`(`interaction.service.ts`)가 strip 을 redact 보다 **먼저** 실행하도록 순서를 고정한 것은 실질적 성능 최적화이며, 순서 무관성이 테스트로 고정돼 있다 — 문제 없음, 확인
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `stripAndRedact` 함수 (JSDoc: "strip 을 먼저 — deepRedactSecrets 는 정규식 다중 패스 + JSON 파싱까지 하는데 llmCalls 서브트리는 어차피 통째로 버려진다") · `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts` `'deepRedactSecrets 와의 순서를 바꿔도 결과가 같다'` 테스트
  - 상세: `llmCalls` 서브트리(대개 이 payload 에서 가장 큰 필드)에 비싼 정규식 스캔을 선지불하지 않고 먼저 삭제한 뒤 나머지에만 `deepRedactSecrets`를 태운다. 이 최적화가 안전한 이유(strip 은 키로, redact 는 키를 만들거나 없애지 않으므로 결과가 순서 무관)가 spec 테스트로 회귀 방지돼 있다.
  - 제안: 없음(positive finding).

- **[INFO]** 알고리즘 복잡도·데이터 구조 — `stripDeep`은 O(n) 단일 재귀 순회(중첩 루프·재순회 없음), depth cap(`MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH` = 10, 둘 다 상수)로 재귀 깊이가 유계, lazy clone-on-write(`out ??= {...obj}` / `out ??= value.slice()`)로 변경 없는 서브트리·객체는 재할당하지 않는다 — 이번 diff 범위에서 문제 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` `stripDeep` 함수 전체
  - 상세: `Object.entries(obj)` 순회는 O(k)(k=해당 노드의 키 수)이고 배열은 인덱스 순회 O(m), 전체 O(n)(n=payload 노드 수)으로 정상. `__proto__` 오염 방어를 위한 `Object.defineProperty` 호출은 실제 변경(strip 대상 필드 존재)이 있는 서브트리에서만 발생해 공통 경로(변경 없음)에는 영향 없다.
  - 제안: 없음.

- **[INFO]** N+1·블로킹 I/O — `stripAndRedact`/`stripExternalOnlyFields`는 `getStatus`의 각 분기(waiting/completed/failed)당 1회, `emitExecutionEvent`/`emitNodeEvent`당 1회만 호출된다. 반복문 내 DB/API 호출이나 동기 I/O 는 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus` — `nodeExec` 조회(`Promise.all`, 병렬)는 이번 diff 무관 기존 로직, `stripAndRedact` 호출은 각 분기 1회
  - 상세: 확인함, 문제 없음.

### 요약
이번 라운드(`16_29_50`)의 실질 코드 델타는 앞선 라운드(`15_58_26`)까지 이미 성능 관점에서 3회 이상 검토·실측·유예된 `stripDeep`/`stripAndRedact` 로직에 대해 **코드 변경이 없고**(JSDoc 문서 addendum + null 분기 회귀 테스트만 추가) 알고리즘·자료구조·호출 패턴이 그대로다. 이중 full-tree 순회 비용(선형, 6.5MB에서 +61ms/2.56배)과 identity 캐시 부재는 둘 다 실측 근거와 함께 plan 에 추적 중이며 "보안 수정 우선, 성능은 관측 후 재평가"라는 명시적이고 검증 가능한 유예 사유가 있어 이번 라운드에서 새로 escalate 할 이유가 없다. `stripAndRedact`의 strip-먼저 순서는 실질적 최적화이고 depth cap·lazy clone-on-write·부분 배열 clone 등 자료구조 선택도 적절하다. N+1, 블로킹 I/O, O(n²) 누적, 불필요한 선행 로딩 패턴은 발견되지 않았다.

### 위험도
LOW
