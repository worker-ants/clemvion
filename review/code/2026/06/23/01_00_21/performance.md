### 발견사항

- **[INFO]** `buildVerifyWorkflowResult` — 이중 순회 (filter + map)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` lines 643-648
  - 상세: `snapshot.nodes.filter(...).map(...)` 와 `snapshot.edges.filter(...).map(...)` 는 각각 배열을 두 번 순회한다. 워크플로우 노드/에지 수가 통상 수십 개 수준(소형 워크플로우 기준)이므로 실제 비용은 무시할 만하나, 단일 `reduce` 또는 `for...of` 루프로 누락 목록을 O(n) 한 번에 구성할 수 있다.
  - 제안: 아래처럼 단일 순회로 대체 가능 (성능보다 명확성 이득):
    ```ts
    const missingNodeIds: string[] = [];
    for (const n of snapshot.nodes) {
      if (!verifiedNodeIds.has(n.id)) missingNodeIds.push(n.id);
    }
    ```
    단, 현재 노드 수 규모에서는 실측 차이가 없으므로 의무 수정 아님.

- **[INFO]** `buildVerifyWorkflowResult` — `Set` 생성 비용과 입력 크기
  - 위치: 동일 파일 lines 632-641
  - 상세: `new Set(Array.isArray(...) ? args.verifiedNodeIds.filter(...) : [])` 패턴이 `verifiedNodeIds`와 `verifiedEdgeIds` 두 군데에서 반복된다. LLM 이 제출하는 id 목록은 수십~수백 개 수준으로 예상되어 Set 생성 비용 자체는 무시할 수준이나, `filter`(타입 가드) 후 `Set` 생성으로 중간 배열이 한 번 더 할당된다. `for...of` 루프에서 직접 `Set`에 추가하면 중간 배열 할당을 피할 수 있다.
  - 제안: 규모상 실측 차이가 없으므로 현행 유지 가능. 가독성과 안전성(타입 가드)을 우선한 현 코드가 적절하다.

- **[INFO]** `get_node_schema` 캐시 히트 시 객체 스프레드 (`...cached.result`)
  - 위치: 동일 파일 lines 521-528
  - 상세: `{ ...(cached.result as Record<string, unknown>), warning: ..., cached: true }` 는 cached.result 전체를 얕은 복사로 새 객체에 펼친다. 스키마 객체가 크면(수 KB JSON) 이 복사 비용이 누적될 수 있다. 그러나 2회 이상 접근 자체가 비정상 패턴(경고 대상)이므로 핫 경로가 아니며, 실제 스키마 크기도 통상 KB 미만이라 허용 범위이다.
  - 제안: 현행 유지. 만약 스키마 객체가 상당히 크다면 `{ result: cached.result, warning: ..., cached: true }` 처럼 래핑 형태로 반환하고 소비자 쪽에서 병합하는 구조로 바꿀 수 있다.

- **[INFO]** `classifyKind` — 객체 프로퍼티 룩업 (`TOOL_KIND_BY_NAME[toolName]`)
  - 위치: 동일 파일 line 464
  - 상세: `TOOL_KIND_BY_NAME`은 모듈 로드 시 생성되는 정적 객체로, 런타임 O(1) 해시 룩업이다. `Map` 대비 성능 차이는 현 도구 수(~15개) 수준에서 무시할 수 있다. 현행 구조 적절.

- **[INFO]** `dispatchExplore` — `if/else if` 체인 vs `Map` 레지스트리
  - 위치: 동일 파일 lines 481-547
  - 상세: 현재 `if/else if` 3-branch 이후 `handleExploreCall` switch로 넘기는 2-단계 구조이다. 도구 수가 현재 9개로 고정되어 있어 선형 탐색 비용은 완전히 무시 가능하다. 다만 후속 PR(M-3 2·3단계)에서 도구가 계속 추가될 경우, `Map<string, Handler>` 레지스트리 패턴으로 전환하면 OCP를 더 명확히 실현할 수 있다. 현재는 성능 문제 아님.

- **[INFO]** `schemaCache`는 `Map`으로 turn-scoped — 메모리 누수 없음 확인
  - 위치: `workflow-assistant-stream.service.ts` line 923
  - 상세: `schemaCache`가 `streamMessage` 호출 스택에 지역 변수로 생성되므로 turn 종료 시 GC 대상이 된다. `AssistantToolRouter`가 무상태 singleton으로 유지되므로 캐시가 서비스 인스턴스에 누적될 위험이 없다. 설계 적절.

### 요약

이번 변경은 `streamMessage` 루프에서 explore dispatch + kind 분류를 `AssistantToolRouter`로 추출하는 순수 구조 리팩터링이다. 신규 코드에서 알고리즘 복잡도는 모두 O(n) 이하(n = 노드/에지 수)이며, N+1 쿼리·블로킹 I/O·메모리 누수 패턴은 발견되지 않는다. `schemaCache`를 turn-scoped 지역 변수로 두고 singleton router에 참조로 전달하는 설계는 메모리 안전성과 상태 격리를 동시에 달성한다. 지적된 사항들은 모두 코드 분량 대비 무시할 수 있는 수준의 중간 배열 할당이나 이중 순회이며, 실측 차이가 나는 규모도 아니다. 성능 관점에서 본 변경은 이전 대비 회귀가 없으며, 오히려 `streamMessage` 루프 내부의 복잡도가 단순화되어 가독성과 인라인 캐시 친화성이 개선된다.

### 위험도

NONE
