## 성능 코드 리뷰

### 발견사항

---

**[INFO]** Merge 노드 입력 포트 단순화로 런타임 동적 포트 관리 비용 제거
- 위치: `index.ts` line 42, `logic-configs.tsx` MergeConfig
- 상세: 기존 `in_0`, `in_1`, ...의 동적 포트 구조는 `inputCount` 변경 시 포트 배열을 재생성하고 엣지 연결 검증을 매번 수행해야 했음. 단일 `in` 포트 + 다중 엣지 방식으로 변경되어 포트 관리 오버헤드가 제거됨.
- 제안: 현재 변경 방향이 성능상 유리함. 추가 조치 불필요.

---

**[INFO]** `MergeConfig` 컴포넌트에서 `NumberField` 제거로 불필요한 렌더링 감소
- 위치: `logic-configs.tsx` MergeConfig (line 550~)
- 상세: `inputCount` 필드 제거로 해당 컴포넌트의 렌더링 요소 수가 줄어 초기 렌더 및 리렌더 비용이 소폭 감소함.
- 제안: 현재 구조 유지.

---

**[INFO]** `merge.handler.spec.ts` — Object.keys 정렬 기반 순서 결정 방식의 복잡도
- 위치: `merge.handler.spec.ts` `should sort object keys for deterministic ordering` 테스트
- 상세: 테스트가 `Object.keys` 알파벳 정렬을 전제로 함. 실제 `merge.handler`가 매 실행마다 `Object.keys(input).sort()`를 수행한다면 입력 키 수 N에 대해 O(N log N)의 정렬 비용이 발생함. 대부분의 실제 사용 케이스에서 N은 수십 이하로 무시 가능하나, 수백 개의 엣지가 단일 포트에 연결될 경우 문제가 될 수 있음.
- 제안: 입력 소스가 워크플로우 엔진에 의해 결정론적 순서로 전달된다면 정렬을 생략하거나, 삽입 순서를 보존하는 `Map`을 사용해 O(N) 처리가 가능함.

---

**[INFO]** 테스트 코드 내 `context` 객체 매 테스트마다 재생성
- 위치: `merge.handler.spec.ts` `beforeEach` (line 10~16)
- 상세: `beforeEach`에서 `context` 객체를 매 테스트마다 새로 생성하는데, `context.variables`와 `nodeOutputCache`가 변경되지 않는 테스트에서는 불필요한 객체 할당임. 테스트 수가 많지 않아 실질적 영향은 없음.
- 제안: 성능보다 테스트 격리 보장이 중요하므로 현재 구조 유지를 권장함. 단, 대규모 테스트 스위트로 확장 시 `beforeAll` + 개별 테스트 내 스냅샷 리셋 패턴 고려.

---

### 요약

이번 변경은 Merge 노드의 동적 다중 포트 구조를 단일 포트 + 다중 엣지 방식으로 전환한 것으로, 포트 배열 동적 관리 오버헤드를 제거하고 UI 렌더링 요소를 줄이는 성능상 긍정적인 변경이다. 스펙, 노드 정의, 설정 UI, 테스트 코드가 일관되게 갱신되었다. 실질적인 성능 위험은 없으며, `Object.keys` 기반 정렬 순서 결정 방식이 이론적으로 O(N log N)이나 실사용 범위에서는 무시 가능한 수준이다. 전반적으로 성능 관점의 개선 방향이 올바르다.

### 위험도

**NONE**