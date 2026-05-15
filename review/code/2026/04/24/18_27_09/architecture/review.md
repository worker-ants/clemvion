### 발견사항

- **[WARNING]** `ShadowWorkflow` 클래스의 SRP 경계 침식 — hint 생성 책임 3종 누적
  - 위치: `shadow-workflow.ts`, `ShadowWorkflow` 클래스 전반
  - 상세: 클래스가 현재 ① `LABEL_CONFLICT` repeat 힌트 (`labelConflictCounts`), ② 실패한 `add_node` cascading 힌트 (`recentFailedAddNodeLabels`), ③ label-lookalike 힌트 (`labelLookalikeHint`) 세 가지 독립적인 hint 전략을 내부 상태와 함께 직접 구현하고 있다. 핵심 책임(workflow 상태 변환)과 에러 진단 보조(hint enrichment)가 같은 클래스 안에 혼재한다. 새 hint 패턴이 추가될 때마다 `addNode` / `updateNode` / `removeNode` / `addEdge` 메서드를 모두 수정해야 하므로 OCP도 약하게 위반된다.
  - 제안: 현 규모에서 즉각 리팩터링할 필요는 없으나, hint 전략을 `NodeNotFoundHintStrategy` 인터페이스로 추상화하고 우선순위 체이닝(cascading > lookalike > null)을 별도 `HintEnricher` 객체로 분리하면 이후 확장이 닫힌 구조가 된다.

- **[INFO]** `labelLookalikeHint`에서 `safeValue`와 `safeLabel`이 항상 동일한 값
  - 위치: `shadow-workflow.ts:labelLookalikeHint()`, 두 `JSON.stringify` 라인
  - 상세: 메서드 진입 조건이 `node.label === value`이므로 두 sanitized 문자열은 동일하다. `safeLabel` 변수는 불필요한 중복 연산이다.
  - 제안: `safeLabel` 계산을 제거하고 `safeValue`를 재사용한다.

    ```typescript
    const safeValue = JSON.stringify(sanitizeLlmProvidedString(value, LABEL_HINT_MAX_LEN));
    return `Value ${safeValue} matches the label of node ${safeValue} (id: ${JSON.stringify(node.id)}). ...`;
    ```

- **[INFO]** `addEdge` 내 label-lookalike 힌트 우선순위 로직이 인라인으로 노출
  - 위치: `shadow-workflow.ts:addEdge()`, `else` 블록 (약 493–507행)
  - 상세: cascading vs lookalike 우선순위 결정이 메서드 본문에 직접 노출되어 있다. 현재는 단순하지만, 세 번째 hint 타입이 추가되면 `else if` 체인이 길어진다. `updateNode`/`removeNode`에는 이 우선순위 처리가 없어 일관성도 약하다(이 두 메서드는 cascading window를 참조하지 않는다).
  - 제안: `resolveNodeNotFoundHint(id, side?)` 같은 단일 진입점으로 모든 `NODE_NOT_FOUND` 케이스의 hint 결정을 위임하면 우선순위 정책이 한 곳에 모인다.

- **[INFO]** `labelLookalikeHint` O(n) 순회 — 현재 규모에선 무해하나 hot path 위치
  - 위치: `shadow-workflow.ts:labelLookalikeHint()`
  - 상세: `this.nodes.values()` 전체를 순회하는 O(n) 탐색이다. 워크플로우 규모(수십 개 노드)에서는 비용이 미미하다. 다만 `update_node`·`remove_node`·`add_edge` 모두에서 NODE_NOT_FOUND 시 호출되므로 최악의 경우 한 턴에 여러 번 실행된다.
  - 제안: 레이블 → 노드 역방향 인덱스(`Map<string, ShadowNode>`)를 `nodes` Map과 동기화하면 O(1)로 낮출 수 있다. 현재는 개선 불요.

- **[INFO]** `system-prompt.ts`의 "Label vs identifier" 섹션 내 항목 순서
  - 위치: `system-prompt.ts`, 새로 추가된 불릿 블록 (약 162–172행)
  - 상세: 새 항목("Tool arguments: always reference a node by its UUID")이 `Null-safe $node referencing` 섹션 바로 앞에 삽입되어 기존 "Label vs identifier" 주제 연속성과 잘 맞지만, 두 번째 단락에 있는 불릿 리스트(`-`)가 상위 불릿(`-`)의 들여쓰기 자식으로 처리된다. 문서 렌더링(LLM 파싱)에 영향은 없으나 마크다운 구조상 최상위 불릿과 혼용된다.

---

### 요약

이번 변경은 "LLM이 UUID 자리에 label을 넣는 실수" 라는 단일 결함 패턴을 prompt 교육(system-prompt.ts) + 서버 사이드 자동 hint(shadow-workflow.ts) 두 층으로 방어하는 방어-깊이 설계이며, 변경 범위가 `workflow-assistant` 모듈 내부로 잘 제한되어 있다. 기능 구현 자체는 올바르고 테스트 커버리지도 충분하다. 주요 아키텍처 우려는 `ShadowWorkflow`가 workflow 상태 관리와 hint 전략 세 가지를 단일 클래스에 누적하고 있다는 SRP 침식이다. 당장의 기능 품질 문제는 아니나, 네 번째 hint 패턴이 추가되는 시점에 hint enrichment 책임을 분리하는 리팩터링이 권장된다.

### 위험도

**LOW**