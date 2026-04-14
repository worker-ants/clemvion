## 발견사항

### **[WARNING]** 버전 번호 생성 시 경쟁 조건 (Race Condition)

- **위치**: `workflow-versions.service.ts` — `createVersion()` 메서드
- **상세**:
  ```ts
  const latestVersion = await this.workflowVersionRepository
    .createQueryBuilder('wv')
    .where('wv.workflow_id = :workflowId', { workflowId })
    .orderBy('wv.version', 'DESC')
    .getOne();

  const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
  // --- 여기서 다른 요청이 동일한 nextVersion을 계산할 수 있음 ---
  return this.workflowVersionRepository.save(version);
  ```
  두 요청이 동시에 `createVersion`을 호출하면 둘 다 `latestVersion.version + 1`로 동일한 번호를 계산하고, 이후 `save`에서 `(workflow_id, version)` UNIQUE 제약 위반(`UniqueConstraintViolationException`)이 발생할 수 있다.
  
  실제 발생 시나리오: 사용자가 저장 버튼을 빠르게 두 번 클릭하거나, 동일 워크플로우에 대해 두 탭에서 동시에 저장 요청이 들어올 경우.
- **제안**: DB 레벨의 시퀀스/원자 카운터를 활용하거나, `INSERT ... SELECT MAX(version)+1 ... WHERE workflow_id = ? FOR UPDATE` 패턴 사용. TypeORM 기준으로는 비관적 락(Pessimistic Write Lock) 또는 PostgreSQL의 `advisory lock` 적용을 권장한다.
  ```ts
  // 방법 1: SELECT FOR UPDATE로 row-level lock
  const latestVersion = await manager
    .createQueryBuilder(WorkflowVersion, 'wv')
    .where('wv.workflow_id = :workflowId', { workflowId })
    .orderBy('wv.version', 'DESC')
    .setLock('pessimistic_write')
    .getOne();
  ```

---

### **[WARNING]** 캔버스 저장과 버전 생성의 원자성 부재

- **위치**: `workflows.service.ts` — `saveCanvas()` 메서드
- **상세**:
  ```ts
  const result = await this.dataSource.transaction(async (manager) => {
    // 캔버스 저장 (노드/엣지 교체)
    return { workflow, nodes: savedNodes, edges: savedEdges };
  }); // ← 트랜잭션 커밋

  // ← 이 시점에서 서버 재시작, 네트워크 오류, DB 오류 발생 시
  await this.workflowVersionsService.createVersion(...); // 버전 미생성
  ```
  트랜잭션 커밋 이후 `createVersion` 호출 전에 프로세스가 종료되거나 오류가 발생하면 캔버스는 저장되었으나 버전 레코드는 없는 불일치 상태가 된다. spec 문서(§9)에서 이를 "다음 저장에서 따라잡힌다"고 허용하고 있으나, 이는 **버전 번호가 연속적이지 않은 갭**을 만들 수 있고, 실제로 "따라잡히는" 메커니즘도 구현되어 있지 않다.
- **제안**: `createVersion`을 동일 트랜잭션(`manager`) 안에 포함시키거나, `WorkflowVersionsService`가 외부 `EntityManager`를 수신할 수 있도록 리팩터링한다.
  ```ts
  return this.dataSource.transaction(async (manager) => {
    // ... 캔버스 저장 ...
    await this.workflowVersionsService.createVersionWithManager(
      manager, id, userId, snapshot, dto.changeSummary
    );
    return { workflow, nodes: savedNodes, edges: savedEdges };
  });
  ```

---

### **[INFO]** 버전 복원 시 이중 경쟁 조건 중첩

- **위치**: `workflows.service.ts` — `restoreVersion()`
- **상세**: `restoreVersion`은 내부적으로 `saveCanvas`를 호출하고, `saveCanvas`는 다시 `createVersion`을 호출한다. 즉 위 두 문제가 복원 경로에서도 동일하게 적용된다. 특히 복원은 "현재 버전 읽기 → 스냅샷 덮어쓰기 → 새 버전 생성" 순서인데, 복원 요청이 동시에 두 번 들어오면 둘 다 같은 스냅샷을 기반으로 동일한 번호의 버전을 시도한다.
- **제안**: `restoreVersion`에도 워크플로우 수준의 낙관적 락(optimistic lock) 또는 순차 처리 보장을 추가한다.

---

### **[INFO]** 프론트엔드 복원 후 `window.location.reload()` 의존

- **위치**: `restore-confirm-dialog.tsx` — `onSuccess` 핸들러
- **상세**: 복원 성공 시 `window.location.reload()`로 페이지 전체를 새로고침하는 방식은 동시성 문제는 아니지만, 복원 요청이 진행 중인 동안 사용자가 다른 저장 작업을 트리거하면(자동저장 등) 두 요청이 겹칠 수 있다. 현재 코드에서 `mutation.isPending` 중에는 버튼이 비활성화되므로 UI 레이어는 보호되어 있다. 단, 자동저장이 별도로 동작한다면 점검이 필요하다.
- **제안**: 복원 API 호출 직전 에디터 저장 기능을 잠금 처리(`setSaving(true)` 등)하여 동시 저장 요청을 차단하는 것을 검토한다.

---

## 요약

이번 변경의 핵심 동시성 리스크는 `WorkflowVersionsService.createVersion`의 **Read-then-Write 패턴**에서 발생하는 경쟁 조건이다. 최신 버전 번호를 SELECT 후 +1 하여 INSERT하는 구조는 DB UNIQUE 제약이 최후 방어선 역할을 하지만, 이 경우 예외로 변환되어 사용자에게 오류로 노출된다. 두 번째로, 캔버스 저장 트랜잭션과 버전 생성이 별도 트랜잭션으로 분리되어 있어 **부분 실패(partial failure)** 시 데이터 불일치가 발생할 수 있다. 단일 사용자 환경에서는 발생 빈도가 낮으나, 멀티탭 또는 팀 협업 환경에서는 실제 문제가 될 수 있다.

## 위험도

**MEDIUM**