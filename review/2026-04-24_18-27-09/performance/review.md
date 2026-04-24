### 발견사항

- **[INFO]** `labelLookalikeHint`가 기존 `findByLabel`과 동일한 O(N) 순회를 중복 구현
  - 위치: `shadow-workflow.ts`, `labelLookalikeHint` 메서드 (lines 660–690) vs `findByLabel` (별도 존재)
  - 상세: 두 메서드 모두 `this.nodes.values()`를 순회해 label로 노드를 찾는다. 현재 error path에서만 호출되어 실질적 영향은 없지만, `findByLabel`을 재사용하면 유지보수 부담을 줄일 수 있다.
  - 제안: `labelLookalikeHint` 내부에서 `const node = this.findByLabel(value);` 로 위임하고, 그 이후 hint 문자열 조립만 처리

- **[INFO]** 매치 성공 시 `sanitizeLlmProvidedString`을 동일 입력으로 두 번 호출
  - 위치: `shadow-workflow.ts`, `labelLookalikeHint` 메서드
  - 상세: match 조건이 `node.label === value`이므로 `safeValue`와 `safeLabel`은 항상 동일한 문자열을 가리킨다. `sanitizeLlmProvidedString` + `JSON.stringify`를 두 번 호출해 동일한 결과를 생성한다.
  - 제안: `const safe = JSON.stringify(sanitizeLlmProvidedString(value, LABEL_HINT_MAX_LEN));` 한 번만 계산하고 양쪽에 사용

- **[INFO]** `addEdge` 내 `this.nodes.has()` 중복 호출
  - 위치: `shadow-workflow.ts`, `addEdge` 메서드의 else 블록
  - 상세: 외부 `if (!this.nodes.has(sourceId) || !this.nodes.has(targetId))` 조건 진입 후 내부에서 다시 `!this.nodes.has(sourceId)`, `!this.nodes.has(targetId)`를 재평가한다. Map lookup은 O(1)이므로 실측 비용은 무시할 수준이나, 외부 조건에서 이미 알 수 있는 정보를 재계산한다.
  - 제안: 외부 조건 평가 시 `const sourceExists = this.nodes.has(sourceId); const targetExists = this.nodes.has(targetId);`로 변수화한 뒤 재사용

- **[INFO]** label 기반 조회에 역방향 인덱스 부재 (현 규모에서는 적정)
  - 위치: `shadow-workflow.ts` 전반
  - 상세: 클래스는 `Map<id, node>`만 유지하고 label 기반 조회(`findByLabel`, `labelLookalikeHint`)는 O(N) 순회에 의존한다. 워크플로우 노드 수가 통상 수십 개 수준인 이 도메인에서는 허용 범위이나, 급격한 규모 증가 시 label→id `Map`을 추가 유지하는 방향을 고려할 수 있다.
  - 제안: 현재는 유지, 노드 수가 수백 개 이상으로 증가하면 `private labelIndex = new Map<string, string>()` (label→id) 도입

---

### 요약

변경된 코드는 모두 **에러 경로(NODE_NOT_FOUND 발생 시)**에서만 실행되는 hint 생성 로직이다. 정상 경로(add_node 성공, add_edge 성공)의 성능에는 전혀 영향이 없다. 에러 경로에서의 O(N) label 순회도 워크플로우 노드 수(통상 < 100)를 감안하면 무시할 수 있는 비용이다. 실질적 성능 위험은 없으며, 발견된 사항들은 모두 코드 중복·소규모 최적화 수준이다.

### 위험도

**NONE**