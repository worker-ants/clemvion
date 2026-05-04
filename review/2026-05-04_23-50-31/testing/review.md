### 발견사항

---

**[WARNING] `load-parent-workflow-names.ts` 유틸리티 함수에 독립 테스트 없음**
- 위치: `backend/src/modules/executions/utils/load-parent-workflow-names.ts`
- 상세: `ExecutionsService`의 private 메서드를 독립 함수로 추출하면서 재사용 범위가 넓어졌음에도 전용 테스트 파일이 없음. 이 함수는 `ExecutionsService`, `DashboardService` 양쪽에서 호출되며, 핵심 로직(IN 쿼리, dedup, null 처리)이 집중되어 있음.
- 제안: `load-parent-workflow-names.spec.ts` 신규 작성. 최소 케이스: ① executions 전체가 `parentExecutionId: null` → 빈 Map 반환, ② 중복 parentId dedup 검증, ③ DB에서 일부 parent만 반환될 때 누락된 ID는 Map에 없고 호출측이 `null`로 처리하는 경로.

---

**[WARNING] `dashboard.service.spec.ts` — "parent 못 찾음" 케이스 미검증**
- 위치: `dashboard.service.spec.ts:102-118` (subworkflow 테스트)
- 상세: `parentExecutionId`는 있으나 `loadParentWorkflowNames`가 해당 ID를 Map에 포함시키지 않는 경우(부모 실행 삭제 등)를 전혀 다루지 않음. 현재 서비스 코드는 `parentNameMap.get(e.parentExecutionId) ?? null`로 방어하지만, 이 분기가 테스트되지 않아 `deriveExecutionTrigger`에 `null`이 전달될 때의 동작이 검증 안 됨.
- 제안:
  ```ts
  it('subworkflow row: uses null label when parent is not found in map', async () => {
    const c1 = baseFake({ id: 'c1', parentExecutionId: 'deleted-parent' });
    executionRepo.createQueryBuilder
      .mockReturnValueOnce(buildListQB([c1]) as unknown)
      .mockReturnValueOnce(buildParentNameQB([])); // 빈 결과
    const result = await service.getRecentExecutions('ws-1');
    expect(result[0].triggerLabel).toBeNull();
  });
  ```

---

**[WARNING] `triggerSource: 'unknown'` 케이스 미검증**
- 위치: `dashboard.service.spec.ts` 전체
- 상세: `baseFake` 기본값이 `triggerId: null, executedBy: null, parentExecutionId: null`임에도 첫 번째 테스트(`r1`)는 `executedBy: 'u1'`을 설정해 unknown 케이스를 회피함. `trigger/executor/parent` 모두 없는 "아무 정보도 없는" 실행의 `triggerSource`가 실제로 `'unknown'`으로 처리되는지 미검증.
- 제안:
  ```ts
  it('uses unknown source when no trigger/executor/parent', async () => {
    const r = baseFake({ id: 'e-unk' }); // 모든 null 기본값 그대로
    executionRepo.createQueryBuilder.mockReturnValueOnce(buildListQB([r]) as unknown);
    const [item] = await service.getRecentExecutions('ws-1');
    expect(item.triggerSource).toBe('unknown');
  });
  ```

---

**[WARNING] `websocket.gateway.spec.ts` — `as never` 타입 우회로 불완전 Mock 은폐**
- 위치: `websocket.gateway.spec.ts:144`
- 상세: `ExecutionDetailWithTrigger`에 `triggerSource`, `triggerLabel` 필드가 추가되면서 기존 Mock `{ id: 'exec-abc' }`에 필수 필드가 빠졌고, 이를 `as never`로 우회함. Gateway가 나중에 `triggerSource`를 사용하기 시작해도 이 테스트는 런타임 오류를 일으키지 않고 통과해버림.
- 제안: `as never` 대신 최소한의 필수 필드를 채운 완전한 Mock 사용:
  ```ts
  findByIdMock.mockResolvedValue({
    id: 'exec-abc',
    triggerSource: 'manual',
    triggerLabel: null,
  } as ExecutionDetailWithTrigger);
  ```

---

**[WARNING] `TriggerCell` 공유 컴포넌트에 테스트 없음**
- 위치: `frontend/src/components/executions/trigger-cell.tsx`
- 상세: 이 컴포넌트는 `executions/page.tsx`에서 분리되어 `dashboard/page.tsx`에도 공유 적용되었는데, 두 페이지 모두 커버하는 렌더링 테스트가 없음. `source`가 Record에 없는 값(예: API 변경으로 새로운 source 추가 시)일 때 `TRIGGER_ICON[source]`가 `undefined`가 되어 런타임 에러 발생 가능성이 있음.
- 제안: 최소 테스트: ① 5가지 source 각각 아이콘·레이블 렌더, ② `label: null`일 때 보조 텍스트 미출력, ③ `label`이 있을 때 `title` 속성 포함 여부.

---

**[INFO] Mock QBuilder의 `where` 인자 미검증 — workspaceId 격리 무보증**
- 위치: `dashboard.service.spec.ts:42-50` (`buildListQB`)
- 상세: 테스트에서 `'ws-1'`을 전달하지만 `qb.where`가 실제로 `{ workspaceId: 'ws-1' }`로 호출되었는지 확인하지 않음. 서비스 코드의 workspace isolation 버그가 테스트에서 통과될 수 있음.
- 제안:
  ```ts
  expect(listQB.where).toHaveBeenCalledWith(
    'w.workspace_id = :workspaceId',
    { workspaceId: 'ws-1' },
  );
  ```

---

**[INFO] `FakeExec` 타입이 엔티티를 수동 복제 — 드리프트 위험**
- 위치: `dashboard.service.spec.ts:3-16`
- 상세: `FakeExec`는 `Execution` 엔티티를 수동으로 미러링함. 엔티티에 필드가 추가·변경되어도 이 테스트 타입에는 반영되지 않아 false-positive 테스트가 계속 통과될 수 있음.
- 제안: `Pick<Execution, 'id' | 'workflowId' | ...>`처럼 엔티티에서 직접 파생하거나, `executor.name: null` 케이스를 별도로 추가해 엣지 케이스를 명시적으로 커버.

---

### 요약

전반적으로 `dashboard.service.spec.ts`는 triggerSource 분기의 주요 경로(manual/schedule/webhook/subworkflow/empty)와 TypeORM orderBy 회귀 방지라는 핵심 목적을 잘 달성하고 있다. 그러나 이번 변경에서 새로 추출된 `loadParentWorkflowNames` 유틸리티 함수와 `TriggerCell` 공유 컴포넌트는 독립 테스트가 전혀 없어, 두 파일이 여러 모듈에서 공유되는 만큼 커버리지 공백이 누적될 위험이 있다. `websocket.gateway.spec.ts`의 `as never` 우회는 타입 안전성을 낮추고 향후 mock 누락 버그를 은폐할 수 있다. "parent 못 찾음"·"unknown source" 등 일부 방어 경로도 검증되지 않아, 실제 운영에서 발생 가능한 엣지 케이스가 보호되지 않는 상태다.

### 위험도

**MEDIUM**