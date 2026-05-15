### 발견사항

---

**[INFO] `execution-trigger.spec.ts` — 핵심 로직 테스트 커버리지 우수**
- 위치: `execution-trigger.spec.ts` 전체
- 상세: `deriveExecutionTrigger`의 5가지 분기(unknown/subworkflow/manual/schedule/webhook)와 우선순위 규칙이 모두 독립 케이스로 검증되어 있음. `makeExec` 헬퍼가 보일러플레이트를 줄여 가독성이 좋음.
- 제안: 없음.

---

**[WARNING] `executor.name`이 빈 문자열(`""`)일 때의 동작이 테스트되지 않음**
- 위치: `execution-trigger.ts:38`, `execution-trigger.spec.ts` manual describe 블록
- 상세: `executor?.name ?? executor?.email ?? null`에서 `??`는 nullish coalescing이므로 `name = ""`이면 빈 문자열이 그대로 label로 반환됨. `executor.name` 이 `null`/`undefined`일 때만 email로 폴백하는 현재 로직이 의도한 것인지 검증이 없음.
- 제안:
  ```typescript
  it('returns empty string label when executor.name is empty string', () => {
    const result = deriveExecutionTrigger(
      makeExec({ executedBy: 'u1', executor: { name: '', email: 'a@x.com' } }),
    );
    // 현재 로직상 label은 '' (email로 폴백 안 함) — 의도가 맞는지 확인
    expect(result.label).toBe('');
  });
  ```

---

**[WARNING] 서비스 레벨에서 webhook 출처가 테스트되지 않음**
- 위치: `executions.service.spec.ts` — `findByWorkflow → DTO mapping`
- 상세: `execution-trigger.spec.ts`에서 webhook은 단위 테스트되지만, `executions.service.spec.ts`에서는 schedule만 서비스 통합 경로로 검증됨. `trigger.type = 'webhook'`인 row가 `toExecutionDto`를 통해 올바르게 매핑되는지 서비스 레벨에서 미검증.
- 제안: schedule 케이스와 동일한 구조의 webhook 케이스 추가.

---

**[WARNING] 서로 다른 `parentExecutionId`를 가진 혼합 서브워크플로우 배치 쿼리 미검증**
- 위치: `executions.service.spec.ts:113–143` (subworkflow batch 테스트)
- 상세: 현재 테스트는 두 row가 동일한 `parentExecutionId: 'p1'`을 공유. `p1`/`p2` 두 개의 서로 다른 부모를 가진 경우, `loadParentWorkflowNames`의 dedup(`Set`) 및 Map 조회가 올바른지 검증되지 않음.
- 제안:
  ```typescript
  it('correctly maps multiple distinct parentExecutionIds in a single batch', async () => {
    const childA: AnyExec = { ...baseChild, id: 'c1', parentExecutionId: 'p1' };
    const childB: AnyExec = { ...baseChild, id: 'c2', parentExecutionId: 'p2' };
    executionRepo.createQueryBuilder.mockReturnValue(buildQB([childA, childB]));
    executionRepo.find.mockResolvedValue([
      { id: 'p1', workflow: { name: 'Parent A' } },
      { id: 'p2', workflow: { name: 'Parent B' } },
    ]);
    const { data } = await service.findByWorkflow('wChild', {});
    expect(data[0].triggerLabel).toBe('Parent A');
    expect(data[1].triggerLabel).toBe('Parent B');
    expect(executionRepo.find).toHaveBeenCalledTimes(1);
  });
  ```

---

**[WARNING] `executionRepo.find` 호출 인자 미검증**
- 위치: `executions.service.spec.ts:141` — `expect(executionRepo.find).toHaveBeenCalledTimes(1)`
- 상세: N+1 방지를 위해 batch 1회만 쿼리함을 검증하지만, 실제 `In(parentIds)`와 `relations: ['workflow']` 인자가 올바른지 확인하지 않음. 추후 쿼리 조건이 변경되어도 이 테스트는 통과함.
- 제안:
  ```typescript
  expect(executionRepo.find).toHaveBeenCalledWith({
    where: { id: In(['p1']) },
    relations: ['workflow'],
  });
  ```

---

**[INFO] `toIso` 메서드의 문자열 입력 경로 미검증**
- 위치: `executions.service.ts:172`, `executions.service.spec.ts`
- 상세: `toIso(d: Date | string)`는 `d instanceof Date`가 아닐 때 `d`를 그대로 반환하는 브랜치가 있음. 현재 테스트는 모두 `Date` 객체를 전달하므로 문자열 입력 경로가 미검증. (런타임에서 DB가 이미 ISO 문자열을 반환하는 경우 해당 경로 진입 가능)
- 제안: `finishedAt: '2026-05-04T10:00:00.000Z'`처럼 문자열을 전달하는 row로 케이스 추가.

---

**[INFO] `findById`·`stop` 메서드에 대한 테스트 없음**
- 위치: `executions.service.spec.ts`
- 상세: 이번 변경으로 `findByWorkflow`의 반환 타입이 `Execution`에서 `ExecutionDto`로 바뀌었지만, 다른 public 메서드(`findById`, `stop`)는 테스트가 없음. 이번 PR 범위를 벗어나지만 기술 부채로 남음.
- 제안: 후속 PR에서 `stop` 메서드의 상태 전환(RUNNING→CANCELLED, WAITING_FOR_INPUT, 이미 COMPLETED 상태 등) 케이스 추가 권장.

---

**[INFO] `leftJoin` 추가 여부가 테스트에서 검증되지 않음**
- 위치: `executions.service.ts:61–65`, `executions.service.spec.ts`
- 상세: `trigger`/`executor` 관계가 `leftJoin`으로 추가되었지만, 테스트의 QueryBuilder mock은 `leftJoin`의 인자를 검증하지 않음. 보안 주석(`User.passwordHash 노출 방지`)이 중요한 의도임에도 `addSelect(['trigger.id', 'trigger.type', 'trigger.name'])`의 정확성은 검증 불가.
- 제안: 높은 보안 중요도를 감안해 `expect(qb.leftJoin).toHaveBeenCalledWith('e.executor', 'executor')` 등 최소한의 join 호출 검증 추가 권장.

---

**[INFO] 프론트엔드 `triggerSource` 폴백 경로(`?? "unknown"`) 테스트 없음**
- 위치: `page.tsx:303` — `execution.triggerSource ?? "unknown"`
- 상세: API 응답에 `triggerSource`가 없을 때(`undefined`) `"unknown"`으로 폴백하는 로직이 있음. 프론트엔드 컴포넌트 테스트가 없어 이 방어 코드의 동작이 검증되지 않음.
- 제안: 컴포넌트 테스트 환경이 갖춰지면 `triggerSource` 없는 API 응답으로 렌더링 테스트 추가.

---

### 요약

`execution-trigger.ts`의 핵심 판정 로직은 `execution-trigger.spec.ts`에서 5가지 분기와 우선순위 규칙이 잘 커버되어 있고, `executions.service.spec.ts`도 N+1 방지, 날짜 ISO 변환, 서브워크플로우 배치 쿼리 등 주요 경로를 검증한다. 다만 webhook 출처의 서비스 레벨 통합 검증 누락, 다중 `parentExecutionId` 배치 시나리오 미검증, `find` 호출 인자 미검증, `executor.name = ""` 엣지 케이스 등 보완이 필요한 갭이 존재한다. 전반적으로 새 기능에 테스트가 동반된 점은 긍정적이나, 서비스 레벨 커버리지를 조금 더 보완하면 회귀 안전망으로서의 신뢰도가 높아진다.

### 위험도

**LOW**