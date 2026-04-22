### 발견사항

- **[WARNING]** `labelIdx` 가 -1 일 때 순서 테스트가 오탐 통과
  - 위치: `spec.ts` — `'places the CONTRACTS block (Label vs identifier) before REFERENCE (Expression language)'`
  - 상세: `prompt.indexOf('Label vs identifier')`가 -1을 반환하면 `-1 < exprIdx(양수)` 가 참이 되어 테스트가 통과합니다. "Label vs identifier" 문구가 누락된 퇴행도 이 테스트로는 잡히지 않습니다. 기존 `it('teaches id vs label semantics...')` 테스트가 존재를 별도 보장하긴 하지만, 구조 순서 테스트로서는 불완전합니다.
  - 제안: `expect(labelIdx).toBeGreaterThanOrEqual(0)` assertion을 먼저 추가한 뒤 순서 비교.

- **[INFO]** `EXPRESSION_REFERENCE_CACHE` 모듈 스코프 캐시의 Jest 격리 전제
  - 위치: `system-prompt.ts` — `let EXPRESSION_REFERENCE_CACHE: string | null = null`
  - 상세: Jest는 기본적으로 모듈 캐시를 테스트 파일 단위로 공유합니다. `getAllFunctionNames()` 반환값이 테스트 환경에서 mock 된다면 첫 번째 호출 결과가 이후 테스트에도 고착됩니다. 현재 테스트는 mock 하지 않으므로 실질적 문제는 없으나, 미래 단위 테스트 확장 시 주의가 필요합니다.
  - 제안: `afterEach(() => { EXPRESSION_REFERENCE_CACHE = null; })`를 내보내거나, 캐시 무효화 훅을 테스트 유틸로 제공하는 방안 검토.

- **[INFO]** `renderActivePlanSection` 에서 `ctx.status` 에 대한 exhaustive 처리 부재
  - 위치: `system-prompt.ts` — `renderActivePlanSection` 함수
  - 상세: `completed` 분기와 묵시적 `else`(active로 가정)만 존재합니다. `ActivePlanContext` 타입이 미래에 `pending` 같은 상태를 추가할 경우 빈 문자열을 반환하며 무음으로 실패합니다.
  - 제안: `else { /* exhaustive check */ }` 또는 TypeScript의 `never` 패턴으로 컴파일 타임에 누락 상태를 감지하도록 처리.

- **[INFO]** `snapshotIdx` 검색 패턴이 빈 배열/객체와 채워진 데이터를 구분하지 못함
  - 위치: `spec.ts` — `'places the workflow snapshot JSON after the Expression language reference'`
  - 상세: `prompt.indexOf('"nodes":[')`는 `emptySnapshot`의 `"nodes":[]`에도 매치됩니다. 테스트 의도(스냅샷 JSON의 위치 고정)는 충족되나, 캐시 구조 검증이라는 목적 측면에서 실제 dynamic content 를 검색한다는 시맨틱이 희석됩니다.
  - 제안: 현 수준으로도 동작상 무결하므로 필수 변경은 아니며 코멘트 수준.

---

### 요약

변경 전체가 5블록 prefix-cache 최적화라는 명확한 요구사항을 충실히 구현했으며, 기존 계약(dynamic-ports 마커, P0 가드레일, label/id 교육, closing-turn 규약 등)을 유지하는 테스트들도 올바르게 보존되어 있습니다. 유일하게 실질적 개선이 필요한 지점은 순서 테스트에서 `labelIdx === -1` 일 때 오탐 통과가 가능한 점으로, "Label vs identifier" 문구 누락이 구조 순서 테스트를 통과해 버리는 퇴행 탐지 공백을 만듭니다. 나머지는 미래 확장성 또는 스타일 차원의 INFO 레벨 사항입니다.

### 위험도

LOW