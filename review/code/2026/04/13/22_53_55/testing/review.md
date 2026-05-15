### 발견사항

- **[WARNING]** `WARNING` 상수 및 fallback 경로가 사실상 Dead Code로 남음
  - 위치: `node-config-summary.ts:36`, `getConfigSummary` 함수 내 `if (!result) return { ...WARNING }`
  - 상세: 모든 formatter 함수의 반환 타입이 `ConfigSummaryResult | null` → `ConfigSummaryResult`로 변경되었고, `carouselSummary`도 내부 로직상 항상 non-null을 반환함. 따라서 `if (!result)` 분기는 실행되지 않음. 테스트에도 이 fallback을 커버하는 케이스가 없음 (제거하지 않는 이상 미검증 상태)
  - 제안: `WARNING` 상수와 `if (!result) return { ...WARNING }` 분기를 제거하고, `getConfigSummary`의 내부 반환 타입을 `ConfigSummaryResult | null`로 유지하되 formatter 반환값을 직접 반환하도록 단순화

- **[WARNING]** `merge` 노드의 `inputCount: 0` 경계값 미테스트
  - 위치: `node-config-summary.test.ts` — `merge summary` describe
  - 상세: `typeof config.inputCount === "number"` 조건은 `0`도 통과시킴. `{ inputCount: 0, strategy: "wait_all" }`은 `"0 inputs · wait_all"`을 반환하는데, 이 케이스가 의도된 동작인지 불분명하고 테스트도 없음
  - 제안: `inputCount: 0` 케이스 명시적 테스트 추가 (또는 `> 0` 검증으로 구현 가드 추가)

- **[INFO]** `custom-node.test.tsx` tooltip 검증의 비대칭성
  - 위치: `renders container node warning as header icon` (loop, line 176) vs `shows warning as header icon` (http_request, line 120)
  - 상세: loop 컨테이너 경고 테스트는 `tooltipContent.textContent`가 `"Count not set"`을 포함하는지 검증하도록 강화되었으나, http_request 경고 테스트는 P 태그 존재 여부만 확인하고 tooltip 내용("URL not set")은 검증하지 않음. 커버리지 불균형
  - 제안: http_request(및 기타 일반 노드) 경고 테스트에도 `tooltipContent.textContent`가 구체적 메시지를 포함하는지 검증 추가

- **[INFO]** `/^⚠/` 정규식이 지나치게 관대함
  - 위치: `custom-node.test.tsx` — 3곳의 `queryAllByText(/^⚠/)`
  - 상세: ⚠로 시작하는 어떤 텍스트도 매칭하므로, 의도치 않게 다른 경고 텍스트가 P 태그에 렌더링되어도 해당 assert가 통과될 수 있음. 단, 구체적인 메시지 검증은 `node-config-summary.test.ts`에서 이미 단위 테스트로 커버하므로 현재 테스트의 목적(P 태그 미렌더링 검증)에는 충분한 수준
  - 제안: 현재 수준 유지 가능하나, 의도를 주석으로 명시하면 가독성 향상

- **[INFO]** `carouselSummary` 타입 서명 불일치
  - 위치: `node-config-summary.ts` — `carouselSummary` 함수 시그니처
  - 상세: 다른 모든 formatter가 `ConfigSummaryResult`를 반환하도록 업그레이드된 반면, `carouselSummary`만 `ConfigSummaryResult | null` 반환 타입을 유지. 함수 내 실제 로직은 null을 반환하지 않지만 타입이 불일치하여 혼란 유발
  - 제안: `carouselSummary` 반환 타입도 `ConfigSummaryResult`로 통일

---

### 요약

전체적으로 generic `NOT_CONFIGURED` 단일 상수에서 노드별 구체적 경고 메시지(`warningOf()` 헬퍼 패턴)로의 전환은 테스트 명세화 측면에서 올바른 방향이며, dispatcher 수준의 bulk 테스트와 각 노드별 describe 블록이 잘 분리되어 있다. 그러나 구현 파일에 `WARNING` 상수와 `if (!result)` fallback이 Dead Code로 남아 있어 이를 커버하는 테스트도 없는 상태이며, `custom-node.test.tsx`에서 일반 노드(http_request)와 컨테이너 노드(loop)의 tooltip 검증 깊이가 비대칭적이다. `merge`의 `inputCount: 0` 경계값과 `carouselSummary`의 타입 서명 불일치도 보완이 필요하다.

### 위험도

**LOW**