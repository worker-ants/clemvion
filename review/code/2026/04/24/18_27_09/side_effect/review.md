## 발견사항

- **[INFO]** `labelLookalikeHint` — `safeValue`와 `safeLabel` 이중 계산
  - 위치: `shadow-workflow.ts`, `labelLookalikeHint` 메서드 내 (두 번 중복 정의됨 — 파일 내 `private labelLookalikeHint` 구현이 두 곳에 동일하게 존재)
  - 상세: `node.label === value` 조건이 성립할 때만 진입하므로, `safeValue`와 `safeLabel`은 항상 동일한 문자열을 생성함. 이중 sanitize + JSON.stringify 호출이 발생하지만 결과물은 동일함. 또한 파일 전체 컨텍스트를 보면 `labelLookalikeHint`가 클래스 내에 두 번 정의되어 있음. (diff 추가본 + 기존 위치) — 실제로 중복 정의이면 컴파일 에러가 되며, 아니라면 오해를 유발하는 패턴.
  - 제안: `safeLabel` 계산을 제거하고 `safeValue`만 사용. 중복 메서드 정의 여부를 확인 후 하나 제거.

- **[INFO]** `addEdge` — 레이블 룩업의 조건 체인 미묘성
  - 위치: `shadow-workflow.ts:493-503`
  - 상세: `sourceHint === null` 조건이 "source가 노드 맵에 존재하여 hint가 null"인 경우와 "source가 없지만 label 매치도 없어 hint가 null"인 경우를 구분하지 않음. 두 경우 모두 target 체크로 진행되는데, 이는 의도된 동작이지만 `sourceId`가 존재함에도 target lookalike를 검사하는 path가 열려 있음. 테스트 커버리지로 의도된 동작이 고정되어 있으므로 기능상 문제는 없음.
  - 제안: 의도를 명확히 하려면 `!this.nodes.has(sourceId) && sourceHint === null` 로 조건을 재작성하는 것을 고려.

- **[INFO]** `updateNode` / `removeNode` — 반환값에 `hint` 필드 추가 (additive)
  - 위치: `shadow-workflow.ts:383-393`, `431-436`
  - 상세: `NODE_NOT_FOUND` 응답에 선택적 `hint` 필드가 추가됨. `ShadowResult`에 이미 `hint?: string`이 선언되어 있으므로 기존 호출자 중 `result.ok`와 `result.error`만 확인하는 경로는 영향 없음. 단, `hint`가 `undefined`임을 가정하는 코드가 있다면 영향받을 수 있음.
  - 제안: 별도 조치 불필요. 이미 인터페이스에 선언된 필드를 채우는 것.

- **[INFO]** `labelLookalikeHint` — O(n) 선형 스캔
  - 위치: `shadow-workflow.ts`, `labelLookalikeHint` 메서드
  - 상세: 노드 맵 전체를 순회하여 label 매치를 찾음. `updateNode`, `removeNode`에서 1회, `addEdge`에서 최대 2회 호출 가능. 일반적인 워크플로 규모(수십~수백 노드)에서는 무시할 수준이나, 이미 `findByLabel` 메서드가 동일 패턴으로 존재함.
  - 제안: `findByLabel`을 활용해 중복 로직 통합 가능. `const matched = this.findByLabel(value); if (matched) { ... }` 형태로 리팩토링하면 유지보수성이 향상됨.

- **[INFO]** `system-prompt.ts` — 정적 블록 문자열 변경
  - 위치: `STATIC_BLOCK_2_CONTRACTS` (Contracts 섹션), "Labels are globally unique" 불릿
  - 상세: 기존 문자열에 새 문단과 cross-reference가 추가됨. `expressionReferenceCache`와 무관한 영역이므로 캐싱 부작용 없음. 순수 컨텐츠 추가.
  - 제안: 해당 없음.

---

### 요약

이번 변경은 `ShadowWorkflow`의 `NODE_NOT_FOUND` 응답에 "label을 id 자리에 넣은 실수" 패턴을 자동 감지하는 hint를 추가하고, 시스템 프롬프트에 동일 규칙을 교육하는 내용을 삽입한 것이다. 모든 변경이 `ShadowResult`의 기존 선택적 필드(`hint?`)를 채우는 방식으로 이루어져 기존 호출자에 대한 파괴적 시그니처 변경이 없으며, 전역 상태·파일시스템·네트워크·환경변수에 대한 부작용도 없다. `labelLookalikeHint`가 클래스 내 두 번 정의된 것처럼 보이는 점은 실제 코드에서 확인이 필요하며, `findByLabel` 재활용으로 정리할 수 있다.

### 위험도

**LOW**