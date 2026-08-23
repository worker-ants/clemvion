# 테스트(Testing) 리뷰 — SSE/fanout nodeOutput allowlist

## 발견사항

- **[WARNING]** `buttonConfig.nodeOutput` 분기의 copy-on-change("바뀐 게 없으면 참조 보존") 가 통합(integration) 레벨에서 검증되지 않는다 — top-level `nodeOutput` 분기만 커버됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:193-202` (`allowlistFanoutNodeOutput` 의 `buttonConfig` 분기, 특히 `198|      if (narrowed !== inner) {`)
  - 상세: `allowlistFanoutNodeOutput` 는 top-level `nodeOutput` 과 `buttonConfig.nodeOutput` 두 자리에 각각 독립된 copy-on-change 가드(`narrowed !== top` / `narrowed !== inner`)를 갖는다. 기존 pre-existing 테스트 `제거할 필드가 없으면 fanout payload 가 wire envelope 과 동일 객체다`(`websocket.service.spec.ts:874`)가 top-level 분기의 "무변경 → 참조 보존" 을 검증하고, plan 의 뮤테이션 표(M4)도 이 테스트 하나로 "copy-on-change 제거" 를 잡는다고 예측·실측했다. 그런데 `buttonConfig` 분기를 exercise 하는 유일한 테스트(`[캐너리] fanout 의 buttonConfig.nodeOutput 도 같은 allowlist 를 지난다`, `websocket.service.spec.ts:803`)는 항상 `_retryState` 를 제거하는 "변경 있음" 픽스처만 쓴다 — `buttonConfig.nodeOutput` 에 제거할 키가 **없는** 경우 `next.buttonConfig === envelope.buttonConfig` 참조가 보존되는지는 어느 테스트도 단언하지 않는다. `if (narrowed !== inner)` 가드를 제거해 buttonConfig 분기만 항상 재구성하도록 뮤테이션해도 잡는 테스트가 없다 — M1~M4 뮤테이션 표에 이 조합이 없다. 함수 JSDoc 이 "fanout 은 모든 execution 이벤트가 지나는 hot path 라 무변경 이벤트에 객체를 새로 만들지 않는다" 고 명시적으로 성능 계약을 선언한 만큼, 버튼 waiting 이벤트(빈번한 경로)에서 그 계약이 조용히 깨져도 아무 테스트도 RED 가 되지 않는다.
  - 제안: `buttonConfig.nodeOutput` 에 allowlist 밖 키가 없는 픽스처로 `expect(fanout.payload.buttonConfig).toBe(wire.buttonConfig)` (또는 `envelope.buttonConfig` 참조 동일성)를 단언하는 캐너리를 하나 추가하고, 뮤테이션 표에 "buttonConfig 분기만 copy-on-change 제거" 케이스를 M5 로 추가해 실측할 것.

- **[INFO]** `envelope.nodeOutput`/`envelope.buttonConfig` 가 명시적으로 `null` 인 방어 분기가 테스트로 exercise 되지 않는다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:188` (`if (top !== null && typeof top === 'object')`), `194|  if (bc !== null && typeof bc === 'object') {`
  - 상세: 이 함수는 fail-closed 보안 경계(allowlist)의 진입점이라 방어 분기 자체도 회귀 안전망 가치가 있다. 현재 테스트 픽스처들은 `nodeOutput`/`buttonConfig` 를 아예 생략하거나(→ `typeof undefined === 'object'` 는 false 라 `!== null` 분기와 무관하게 스킵) 객체로만 채운다 — `nodeOutput: null` (terminal 이벤트 등에서 나올 수 있는 값) 을 명시적으로 넣어 크래시 없이 통과하는지 확인하는 케이스는 없다.
  - 제안: `nodeOutput: null` / `buttonConfig: null` 을 넣는 캐너리 1~2건을 추가해 `null` 분기가 실제로 실행되고도 예외 없이 통과함을 고정할 것. 우선순위는 낮음(코드 자체는 표준적인 null-guard).

## 강점 (참고)

- `node-output-allowlist.spec.ts`: 리터럴 대조 + 파생 `it.each` 이중 방어(파생 fixture 가 vacuous 해지는 것을 리터럴 테스트로 막는 자기 인식), `Object.freeze` 런타임 불변 검증, `__proto__` 오염 방어, copy-on-change, non-object passthrough(`null`/숫자/배열) 전부 커버 — 순수 함수 유틸의 unit 커버리지가 촘촘함.
- `websocket.service.spec.ts` 신규 캐너리 3건은 각 실행 id 를 고유하게 부여(`exec-allowlist-form`, `exec-allowlist-buttons`, `exec-chat-${key}`)해 `ExecutionSeqAllocator` 상태·Subject 구독 경합 없이 서로 독립 실행된다.
- 대조군(counter-example) 설계가 일관됨: 내부 WS(`gateway.broadcastToChannel`)는 그대로 남아야 한다는 안전 조건을, 각 캐너리가 "제거됨" 단언과 "내부 WS 는 원문 보존" 단언을 쌍으로 둔다 — payload 를 통째로 날려 통과하는 거짓-GREEN 구현을 배제.
- Mutation 표(M1~M4)가 "두 배선 지점(top-level `nodeOutput` vs `buttonConfig.nodeOutput`)을 한 덩어리로만 검증하면 안 된다" 는 이 저장소가 반복 겪은 함정을 M3 로 명시적으로 갈라 검증했고, 예측을 실행 전에 적고 실측과 대조하는 방식도 재현성이 높다. 다만 위 WARNING 처럼 그 분리가 "changed" 분기에만 적용되고 "unchanged/copy-on-change" 분기에는 아직 적용되지 않은 비대칭이 남아 있다.
- 기존 회귀 테스트(`llmCalls strip`, `execution routing context`, `waiting_for_input 중첩 turnDebug`, 동일 객체 identity 테스트 등)는 신규 allowlist 배선과 겹치는 필드를 쓰지 않거나(모두 allowlist 안 키만 사용) allowlist 도입 후에도 그대로 유효함을 코드 추적으로 확인함 — 회귀 파손 없음.

## 요약

핵심 변경(`allowlistFanoutNodeOutput` 신설 + 두 소비 지점 배선, `NODE_OUTPUT_ALLOWED_KEYS` 4키 확장)에 대한 테스트는 캐너리·리터럴·뮤테이션 검증을 갖춰 전반적으로 충실하다. 순수 유틸(`node-output-allowlist.ts`)의 unit 커버리지는 경계값·null·proto 오염·불변성까지 빠짐없이 촘촘하고, 서비스 레벨 통합 테스트도 대조군을 갖춰 "통째로 날려 통과" 류의 거짓 GREEN 을 배제한다. 유일한 실질적 갭은 `toFanoutEnvelope` 의 두 배선 지점 중 `buttonConfig.nodeOutput` 분기에서 "제거할 게 없을 때 참조를 보존한다"는 copy-on-change 계약이 통합 레벨에서 미검증이라는 점이다(top-level 분기만 M4 로 커버) — 이 저장소가 반복 지적해 온 "두 자리 중 한쪽만 실측" 패턴이 changed 분기는 피했지만 unchanged 분기에는 그대로 남아 있다. Critical 급 결함은 없다.

## 위험도

LOW
