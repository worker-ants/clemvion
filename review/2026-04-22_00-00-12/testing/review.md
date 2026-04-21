## 발견사항

### [WARNING] 엣지 매핑 검증 불완전
- **위치**: `workflow-assistant-stream.service.spec.ts`, `get_current_workflow` 테스트 (line ~397)
- **상세**: `buildCurrentWorkflowResult`는 엣지에 `id`, `sourcePort`, `targetPort`, `type` 필드를 포함해 매핑하지만, 테스트에서 `objectContaining({ source: 'trig-1', target: 'http-1' })`만 검증한다. `sourcePort`, `targetPort`, `type`, `id` 필드의 정확한 매핑은 커버되지 않는다.
- **제안**:
  ```typescript
  expect(result.edges[0]).toMatchObject({
    source: 'trig-1',
    sourcePort: 'out',
    target: 'http-1',
    targetPort: 'in',
    type: 'data',
  });
  ```

---

### [WARNING] `category` / `position` 필드 검증 누락
- **위치**: `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult`
- **상세**: `buildCurrentWorkflowResult`는 `category`, `position: { x, y }` 필드를 반환 결과에 포함하지만, 테스트 1에서 이 두 필드를 전혀 검증하지 않는다. LLM이 이 필드를 기반으로 탐색 응답을 구성하므로 매핑 오류 시 무증상 회귀가 발생할 수 있다.
- **제안**: `httpNode?.category`, `httpNode?.position`에 대한 assertion 추가.

---

### [WARNING] 빈 워크플로우 케이스 미테스트
- **위치**: 테스트 파일 전체
- **상세**: `get_current_workflow` 호출 시 노드/엣지가 모두 비어있는 상태(`{ nodes: [], edges: [] }`)에 대한 테스트가 없다. `buildCurrentWorkflowResult`는 빈 배열을 정상 처리하지만 `ok: true`와 빈 배열을 함께 반환하는 경로가 회귀 위험에 노출되어 있다.
- **제안**: 빈 워크플로우로 `get_current_workflow`를 호출하고 `{ ok: true, nodes: [], edges: [] }`를 검증하는 케이스 추가.

---

### [WARNING] 테스트 2에서 in-turn add_node 결과의 `type` 미검증
- **위치**: `workflow-assistant-stream.service.spec.ts`, `reflects in-turn edits` 테스트
- **상세**: 테스트 2는 `nodes.map(n => n.label).sort()`만 검증하고, 추가된 노드의 `type: 'http_request'`가 올바르게 반영되었는지 확인하지 않는다. 레이블 충돌 회귀는 잡을 수 있지만, 타입 매핑 버그는 놓친다.
- **제안**:
  ```typescript
  const newNode = nodes.find(n => n.label === 'NewNode');
  expect(newNode?.type).toBe('http_request');
  ```

---

### [WARNING] `get_current_workflow` 에러 경로 미테스트
- **위치**: `workflow-assistant-stream.service.ts:215-222`
- **상세**: `shadow.snapshot()`이 예외를 던질 경우 외부 `try-catch`에서 잡아 `ASSISTANT_STREAM_FAILED` 이벤트로 변환되지만 이 경로에 대한 테스트가 없다. `ShadowWorkflow`의 계약이 변경될 경우 무증상 실패 가능.
- **제안**: `shadow.snapshot`을 throw하도록 모킹하고 `ASSISTANT_STREAM_FAILED` 이벤트가 emit되는지 확인하는 테스트 추가.

---

### [INFO] `as never` DTO 캐스팅이 타입 안전성 저하
- **위치**: 모든 `service.streamMessage(...)` 호출 (`as never`)
- **상세**: 전체 테스트 파일에서 `baseDto as never` 패턴을 사용해 TypeScript 타입 검사를 우회한다. DTO 구조 변경 시 컴파일 오류가 발생하지 않아 테스트가 구조 변경을 감지하지 못한다.
- **제안**: `as AssistantMessageRequestDto` 또는 `satisfies AssistantMessageRequestDto`로 전환하거나, `baseDto`를 명시적 타입으로 선언.

---

### [INFO] 테스트 1에서 `usage` 이벤트 미검증
- **위치**: `workflow-assistant-stream.service.spec.ts`, 첫 번째 신규 테스트
- **상세**: `inputTokens: 5, outputTokens: 0`의 `done` 이벤트가 mock에 포함되어 있지만, `usage` SSE 이벤트가 emit되는지 검증하지 않는다. 기존 텍스트 턴 테스트에서는 `usage` 검증이 포함되어 있어 일관성이 없다.

---

### [INFO] `handleExploreCall`이 호출되지 않았음을 명시적으로 검증하지 않음
- **위치**: `workflow-assistant-stream.service.spec.ts`
- **상세**: `get_current_workflow`는 특수 처리 경로(`buildCurrentWorkflowResult`)를 타도록 설계되어 있지만, 테스트에서 `exploreTools.getWorkflow` 등 외부 I/O mock이 호출되지 않았음을 검증하지 않는다. 향후 라우팅 로직 변경 시 조용히 DB를 조회하게 될 수 있다.
- **제안**: `expect(mocks.exploreTools.getWorkflow).not.toHaveBeenCalled()` 추가.

---

## 요약

신규 `get_current_workflow` 도구에 대한 핵심 흐름(기본 스냅샷 반환, redact 적용, in-turn 편집 반영)은 두 테스트가 적절히 커버한다. 다만 엣지 매핑의 상세 필드 검증, `category`/`position` 반환 검증, 빈 워크플로우 경계값 케이스, 에러 경로가 공백으로 남아있다. 특히 `as never` 캐스팅 패턴이 전체 테스트에 걸쳐 DTO 구조 변경을 감지하지 못하게 하는 구조적 위험이 있으며, `handleExploreCall` 우회 여부를 명시적으로 검증하는 assertion이 없어 특수 케이스 라우팅의 회귀 보호가 불충분하다.

## 위험도

**LOW** — 핵심 동작(redact, in-turn 반영, kind=explore 퍼시스턴스)은 테스트로 보호되어 있으나, 엣지 필드 매핑과 `category`/`position` 같은 LLM 응답 품질에 직결되는 필드가 검증되지 않아 무증상 회귀 가능성이 존재한다.