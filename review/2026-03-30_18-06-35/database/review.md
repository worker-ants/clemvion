### 발견사항

- **[WARNING]** `saveCanvas` 내 N+1 쿼리 — 노드 Upsert 루프
  - 위치: `workflows.service.ts` — `saveCanvas()` 메서드 내 노드 upsert 루프
  - 상세: `for (const nodeDto of dto.nodes)` 루프 내에서 `manager.save(Node, ...)` 를 개별 호출하고 있어, 노드 수만큼 INSERT/UPDATE 쿼리가 발생합니다. 엣지 역시 `for (const edgeDto of dto.edges)` 루프에서 개별 `manager.save(Edge, ...)` 를 호출합니다.
  - 제안: `manager.save(Node, savedNodesBatch)` 와 같이 배열을 한 번에 저장하거나, `manager.upsert(Node, nodesArray, ['id'])` 를 사용하여 단일 쿼리로 처리하세요.

```ts
// Before (N+1)
for (const nodeDto of dto.nodes) {
  savedNodes.push(await manager.save(Node, existing));
}

// After (batch)
const updatedEntities = dto.nodes.map(...); // 엔티티 배열 준비
const savedNodes = await manager.save(Node, updatedEntities);
```

---

- **[WARNING]** 엣지 삭제 후 재생성 전략의 외래 키 제약 위험
  - 위치: `workflows.service.ts` — `saveCanvas()` > 엣지 Sync 섹션
  - 상세: 기존 엣지를 `manager.remove(Edge, existingEdges)` 로 전부 삭제한 후 새로 생성합니다. Edge가 다른 테이블(NodeExecution 등)에서 참조되고 있다면 `onDelete: 'CASCADE'` 또는 `RESTRICT` 설정에 따라 데이터 손실이나 제약 오류가 발생할 수 있습니다. 또한 트랜잭션 내에서 노드 삭제(`manager.remove(Node, nodesToDelete)`) 후 해당 노드를 참조하는 엣지가 남아 있는 경우 외래 키 위반이 생길 수 있습니다.
  - 제안: 엣지 삭제를 노드 삭제보다 먼저 수행하도록 순서를 보장하고, `Edge` 엔티티의 `onDelete` 설정을 확인하세요. 또한 엣지 upsert도 삭제/재생성 대신 `upsert`를 검토하세요.

---

- **[WARNING]** `create()` 내 워크플로우 저장과 트리거 노드 생성의 트랜잭션 부재
  - 위치: `workflows.service.ts` — `create()` 메서드
  - 상세: 워크플로우를 `workflowRepository.save()`로 저장한 후 `nodeRepository.save(triggerNode)`로 트리거 노드를 별도 저장하는데, 두 작업이 단일 트랜잭션으로 묶여 있지 않습니다. 워크플로우 저장 후 노드 저장 실패 시 트리거 노드 없는 고아 워크플로우가 생성됩니다.
  - 제안: `DataSource.transaction()` 으로 두 작업을 원자적으로 처리하세요.

```ts
async create(...): Promise<Workflow> {
  return this.dataSource.transaction(async (manager) => {
    const workflow = manager.create(Workflow, { ...dto, workspaceId, createdBy: userId });
    const savedWorkflow = await manager.save(Workflow, workflow);
    const triggerNode = manager.create(Node, { workflowId: savedWorkflow.id, ... });
    await manager.save(Node, triggerNode);
    return savedWorkflow;
  });
}
```

---

- **[WARNING]** `NodeCategory` enum에 `TRIGGER` 추가 — 마이그레이션 안전성
  - 위치: `node.entity.ts` — `NodeCategory` enum
  - 상세: PostgreSQL의 `enum` 타입에 새 값을 추가하는 마이그레이션(`ALTER TYPE ... ADD VALUE`)은 트랜잭션 내에서 실행할 수 없습니다(PostgreSQL 제약). 자동 마이그레이션 실행 환경에서 트랜잭션으로 감싸진 마이그레이션 스크립트라면 오류가 발생합니다.
  - 제안: TypeORM 마이그레이션 파일에서 해당 `ALTER TYPE` 구문이 독립적인 쿼리로 실행되는지 확인하고, 필요하면 `{ transaction: false }` 옵션을 명시하세요.

---

- **[INFO]** `saveCanvas` 내 `workflow.currentVersion` 증가 로직의 동시성 문제
  - 위치: `workflows.service.ts` — `saveCanvas()` > `workflow.currentVersion = (workflow.currentVersion ?? 0) + 1`
  - 상세: 트랜잭션 외부에서 `findById()`로 조회한 워크플로우 객체의 `currentVersion`을 애플리케이션 레벨에서 증가시키므로, 동시 요청 시 같은 버전 번호가 저장될 수 있습니다.
  - 제안: `manager.increment(Workflow, { id }, 'currentVersion', 1)` 을 사용하여 DB 레벨에서 원자적으로 증가시키세요.

---

- **[INFO]** `SaveCanvasNodeDto.id` 필드에 UUID 검증 부재
  - 위치: `save-canvas.dto.ts` — `SaveCanvasNodeDto.id`
  - 상세: `id` 필드가 `@IsString()` + `@MaxLength(36)` 만 검증하고 있어, 임의 문자열이 DB의 UUID PK로 삽입될 수 있습니다. `containerId`, `toolOwnerId`는 `@IsUUID()`를 사용하는 것과 대조됩니다.
  - 제안: `@IsUUID()` 데코레이터를 추가하세요.

---

### 요약

주요 데이터베이스 이슈는 두 곳에 집중됩니다. 첫째, `saveCanvas()`의 노드/엣지 처리가 루프 내 개별 쿼리(N+1)로 구현되어 대형 워크플로우에서 성능 저하가 예상되며, 배치 저장으로 교체가 필요합니다. 둘째, `create()` 메서드에서 워크플로우와 트리거 노드 생성이 트랜잭션으로 묶여 있지 않아 부분 실패 시 데이터 정합성이 깨질 수 있으며, `saveCanvas()`의 버전 증가도 동시성 이슈가 있습니다. `NodeCategory` enum 추가는 PostgreSQL 마이그레이션 특성상 별도 주의가 필요합니다. `saveCanvas()` 자체는 트랜잭션을 올바르게 사용하고 있어 구조적으로는 양호합니다.

### 위험도
**MEDIUM**