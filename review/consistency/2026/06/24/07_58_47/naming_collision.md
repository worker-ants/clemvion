# 신규 식별자 충돌 검토 — spec/3-workflow-editor/

- 검토 모드: `--impl-prep`
- 검토 대상: `spec/3-workflow-editor/` (0-canvas.md, 1-node-common.md, 2-edge.md, 3-execution.md, 4-ai-assistant.md, 5-version-history.md)
- 비교 대상: spec/0-overview.md, spec/1-data-model.md, spec/5-system/, spec/conventions/, plan/in-progress/

---

### 발견사항

- **[INFO]** `DUPLICATE_NAME` 에러 코드가 에러 카탈로그에 미등록
  - target 신규 식별자: `DUPLICATE_NAME` (spec/3-workflow-editor/3-execution.md §9 WorkflowTestDataset API 및 spec/1-data-model.md §2.13.3)
  - 기존 사용처: spec/5-system/3-error-handling.md §1 에러 카탈로그에는 해당 코드가 없음. `DUPLICATE_NODE_LABEL` 은 등록되어 있음.
  - 상세: `DUPLICATE_NAME` 은 spec/3-workflow-editor/ 와 spec/1-data-model.md 두 곳에서 동일 의미(테스트 데이터셋 이름 중복)로 일관되게 사용되고 있어 의미 충돌은 없음. 다만 에러 코드 카탈로그에 등록되지 않아 관리 누락 상태.
  - 제안: spec/5-system/3-error-handling.md 에러 카탈로그에 `DUPLICATE_NAME` 을 도메인 접두어(`WORKFLOW_TEST_DATASET_DUPLICATE_NAME` 또는 현행 `DUPLICATE_NAME` 그대로) 로 등록하여 단일 진실 원칙 준수.

- **[INFO]** spec frontmatter `id: common` 중복 — pre-existing, target 미도입
  - target 신규 식별자: 해당 없음 (target 은 고유 ID 사용: `canvas`, `node-common`, `edge`, `execution`, `ai-assistant`, `workflow-version-history`)
  - 기존 사용처: spec/4-nodes/*/0-common.md 파일들이 모두 `id: common` frontmatter를 공유하고 있음
  - 상세: target 이 도입한 문제가 아니며, spec/3-workflow-editor/ 의 모든 파일은 고유한 ID를 사용함. target 과 기존 `id: common` 간 교차 참조 오염 없음.
  - 제안: spec/4-nodes/ 하위 `0-common.md` 파일들은 향후 카테고리별 고유 ID 부여 권장 (예: `nodes-logic-common`, `nodes-ai-common`). 단 이는 target 의 책임 범위 외.

### 비충돌 확인 항목

- **위젯 ID** `chat-config-selector` / `embedding-config-selector`: spec/4-nodes/3-ai/ 및 spec/5-system/17-agent-memory.md 에서 동일 의미로 일관 사용. 구버전 `chat-model-selector` / `embedding-model-selector` 는 plan/in-progress 과거 기록에만 잔류하며 활성 spec 에는 없음. 충돌 없음.
- **`interactionType` 이중 enum**: spec/1-data-model.md §2.14 에서 `WaitingInteractionType` 과 `NodeExecution.interaction_data.interactionType` 이 "이름만 같고 별개 enum" 임을 명시적으로 문서화. 의도된 명명 일치이며 숨겨진 충돌 아님.
- **컨테이너 에러 코드** (`CONTAINER_MISSING_EMIT`, `CONTAINER_MULTIPLE_EMIT`, `CONTAINER_CYCLE`, `CONTAINER_INVALID_CHILD`): spec/3-workflow-editor/, spec/4-nodes/1-logic/, spec/5-system/4-execution-engine.md, spec/data-flow/ 전반에 일관 사용. 충돌 없음.
- **API endpoint** (test-datasets CRUD, execution start/cancel/resume, WS 이벤트): 중복 정의 없음. `execution.node.cancelled` 이벤트는 spec/5-system/6-websocket-protocol.md 에 일관 정의됨.
- **버전 히스토리 함수/이벤트명** (`applyExecutionSnapshot`, `startHistoryView`, `loadHistoricalExecution`, `dropStaleEdges`, `editor.autoCleanedEdges`): spec 전체에서 spec/3-workflow-editor/5-version-history.md 및 spec/3-workflow-editor/0-canvas.md 가 단일 정의. 충돌 없음.

### 요약

spec/3-workflow-editor/ 가 도입하는 신규 식별자(위젯 ID, 에러 코드, API 엔드포인트, WS 이벤트명, 엔티티명, frontmatter ID) 중 기존 사용처와 의미 충돌하는 항목은 없다. `DUPLICATE_NAME` 에러 코드가 에러 카탈로그에 미등록된 점이 유일한 INFO 수준 보완 사항이며, 구현 차단 요인에 해당하지 않는다. `interactionType` 이중 enum 은 spec 이 이미 명시적으로 문서화한 의도된 설계다. 전반적으로 impl-prep 진행에 지장이 없는 수준이다.

### 위험도

NONE
