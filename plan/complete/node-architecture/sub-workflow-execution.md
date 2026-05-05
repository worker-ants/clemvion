# Sub-Workflow (Workflow Node) 실행 구현 — COMPLETED

## 구현 내용

Workflow 노드의 서브 워크플로우 실행 기능을 완전 구현함.

### 핵심 설계: 인라인 실행 (Sync 모드)

동기 모드에서 서브 워크플로우는 **부모 Execution 내에서 인라인 실행**됨:
- 같은 `executionId` 사용 → 히스토리 타임라인에 자연스럽게 표시
- 부모의 `nodeOutputCache` 공유 → `$node` expression 참조 상호 호환
- 부모의 `nodeMap`에 서브 워크플로우 노드 병합 → expression resolver가 모든 노드 참조 가능
- Trigger 노드 자동 스킵, 입력 데이터 패스스루

비동기 모드는 별도 Execution 생성 (fire-and-forget).

### DB Migration
- `V006__add_parent_execution_id.sql`: `parent_execution_id`, `recursion_depth` 컬럼 추가 (비동기 모드용)

### Backend 변경
- `ExecutionContext`에 `recursionDepth`, `_executedNodes`, `_nodeMap` 필드 추가
- `ExecutionEngineService.executeInline()`: 같은 execution context 내에서 서브 워크플로우 노드 실행
- `ExecutionEngineService.executeAsync()`: 별도 Execution 생성 (비동기용)
- `WorkflowHandler`: sync → `executeInline`, async → `executeAsync`

### Frontend 수정
- `conversation-inspector.tsx`: `ConversationItem` 타입 추론 오류 수정

### Spec 갱신
- `spec/4-nodes/2-flow-nodes.md`: 인라인 실행 방식 상세 기술

## 검증 결과
- Lint: 0 errors
- Unit Tests: 49 suites, 648 tests passed (workflow.handler: 26 tests)
- Build: backend + frontend 성공
