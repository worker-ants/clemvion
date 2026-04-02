### 발견사항

- **[WARNING]** WebSocket 이벤트 페이로드 하위 호환성 문제
  - 위치: `execution-engine.service.ts` - `NODE_STARTED`, `NODE_COMPLETED`, `NODE_SKIPPED`, `NODE_FAILED` 이벤트
  - 상세: 기존 이벤트 페이로드에 `nodeType`, `nodeLabel`, `output` 필드가 추가됨. 클라이언트 측(`use-execution-events.ts`)은 이 필드들을 필수로 사용하며, 이전 버전의 서버와 연결된 클라이언트는 `nodeType`이 `undefined`로 처리되어 `"unknown"` fallback으로 표시됨. 반대로 이전 클라이언트는 새 필드를 무시하므로 단방향 호환성 문제.
  - 제안: `nodeType`, `nodeLabel` 필드 추가를 WebSocket 프로토콜 변경으로 문서화하고, 클라이언트의 `payload.nodeType ?? "unknown"` fallback이 의도된 방어 처리임을 명시할 것.

- **[WARNING]** REST API 응답 스키마 변경 — `node` relation 추가
  - 위치: `executions.service.ts:37`, `executions.ts:15`
  - 상세: `GET /executions/:id` 응답의 `nodeExecutions` 배열에 `node` 관계 객체(`{ id, type, label }`)가 새로 포함됨. 이 필드는 `optional`(`node?`)로 선언되어 있어 항상 존재한다는 보장이 없음. 클라이언트(`use-execution-events.ts:249`)에서 `ne.node?.type ?? "unknown"` 방어 처리를 하고 있으나, DB에 고아 NodeExecution이 존재하는 경우(node가 삭제된 경우) `"unknown"` 카테고리로 폴백됨.
  - 제안: node relation이 없을 때의 동작을 명시적으로 정의하고, API 응답 타입에서 `node`를 필수 혹은 null 허용 필드로 명확히 구분할 것.

- **[INFO]** `NodeExecutionData.node.label` nullable 불일치
  - 위치: `executions.ts:15` — `node?: { id: string; type: string; label: string }`
  - 상세: `label` 필드가 non-nullable(`string`)로 선언되어 있으나, 실제 DB 엔티티에서 `label`이 nullable일 수 있음. `execution-engine.service.ts`에서 `node.label ?? node.type`을 사용하는 것과 일관성이 없음.
  - 제안: `label: string | null`로 타입을 수정하거나, 서버에서 항상 non-null 값을 보장하도록 처리.

- **[INFO]** WebSocket 이벤트 스펙과 구현 간 일관성
  - 위치: `spec/3-workflow-editor/3-execution.md` §10.13 vs `execution-engine.service.ts`
  - 상세: 스펙에서 `node.started`, `node.completed`, `node.failed`, `node.skipped` 이벤트에 `nodeType`, `nodeLabel`, `output` 포함을 명시함. 구현은 스펙과 일치하나, `node.skipped` 이벤트는 `output` 필드를 포함하지 않음 — 스펙상 명시가 없으므로 현재 구현이 올바름.

---

### 요약

이번 변경은 WebSocket 이벤트 페이로드 확장(`nodeType`, `nodeLabel`, `output` 추가)과 REST API 응답에 `node` 관계 포함이 핵심이다. 모든 클라이언트 측 코드에서 신규 필드에 대한 `??` fallback 처리가 적절히 적용되어 있어 즉각적인 런타임 오류 위험은 낮다. 단, WebSocket 프로토콜 변경은 사실상 **암묵적 breaking change**이며 이전 서버와 연결 시 `nodeType`이 누락되어 모든 노드가 `"unknown"` 카테고리로 표시되는 기능 저하가 발생한다. REST API의 `node` relation은 optional로 처리되어 있어 하위 호환성을 유지하지만, `label` 필드의 nullable 불일치는 런타임 오류 가능성이 있다.

### 위험도
**LOW**