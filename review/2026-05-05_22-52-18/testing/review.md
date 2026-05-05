## 발견사항

### [WARNING] `process()` 성공 경로 — `lastRunAt`/`nextRunAt` 갱신 검증 누락
- 위치: `schedule-runner.service.spec.ts` — `'passes { triggerId: ... } to executionEngineService.execute'`
- 상세: 성공 케이스 테스트가 `engine.execute` 호출 여부만 검증하고, `scheduleRepo.save`가 업데이트된 `lastRunAt`/`nextRunAt`를 포함해 호출됐는지 검증하지 않는다. `execute()` 이후의 timestamp 갱신 로직이 실수로 제거돼도 이 테스트는 그린으로 통과한다.
- 제안:
  ```ts
  expect(scheduleRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ lastRunAt: expect.any(Date) }),
  );
  ```

### [WARNING] `process()` 에러 경로 테스트 없음
- 위치: `schedule-runner.service.spec.ts` — `process()` describe 블록
- 상세: `engine.execute`가 throw할 때 `process()`가 에러를 re-throw하는지 검증하는 테스트가 없다. `try/catch`에서 에러를 swallow하는 방향으로 코드가 바뀌어도 탐지 불가.
- 제안:
  ```ts
  it('re-throws when engine.execute fails', async () => {
    scheduleRepo.findOne.mockResolvedValue(baseSchedule);
    engine.execute.mockRejectedValue(new Error('engine fail'));
    await expect(service.process(job)).rejects.toThrow('engine fail');
  });
  ```

### [WARNING] `schedule.triggerId`가 falsy일 때 동작 미검증
- 위치: `schedule-runner.service.spec.ts` — `process()` describe 블록
- 상세: `trigger: undefined` 케이스는 있으나, `trigger.workflowId`가 있되 `schedule.triggerId`가 `null`인 경우가 없다. 이 경우 `execute({ triggerId: null })`이 호출되어 DB에 null이 저장되지만 테스트로는 탐지되지 않는다.
- 제안: `triggerId: null as unknown as string` 케이스를 추가하거나, 서비스 구현에서 `triggerId`가 falsy면 옵션을 빈 객체로 두는 가드를 추가하고 그에 대한 테스트 작성.

### [INFO] `executedBy`와 `triggerId` 동시 제공 시 동작 테스트 없음
- 위치: `execution-engine.service.spec.ts` — `execute() — trigger metadata persistence`
- 상세: 스펙상 동시 제공은 없어야 하지만, 방어적으로 두 값이 모두 주어질 때 DB에 어떻게 저장되는지(양쪽 모두 저장)를 문서화하는 테스트가 없다.
- 제안: INFO 수준이므로 필수는 아니나, 향후 `deriveExecutionTrigger` 우선순위 로직과 연결될 때 회귀 시나리오를 만들 수 있음.

### [INFO] 스킵 경로에서 `scheduleRepo.save` 미호출 검증 없음
- 위치: `schedule-runner.service.spec.ts` — `'skips when schedule is inactive'`, `'skips when schedule has no associated workflow'`
- 상세: 두 스킵 테스트 모두 `engine.execute`가 호출되지 않음만 확인한다. `scheduleRepo.save`(lastRunAt 갱신)도 호출되지 않아야 하지만 검증이 없어 의도치 않은 DB 쓰기가 발생해도 탐지되지 않는다.
- 제안: `expect(scheduleRepo.save).not.toHaveBeenCalled()` 추가.

### [INFO] `objectContaining({ triggerId: undefined })` — Jest 버전 의존성
- 위치: `execution-engine.service.spec.ts:574, 586, 608`
- 상세: 구현 코드가 `triggerId: options?.triggerId ?? undefined`로 키를 명시적으로 설정하므로 현재는 동작한다. 그러나 `??` 연산자 우측의 `undefined`는 의미가 없고(`??` 자체가 이미 `undefined`를 반환), 추후 누군가 `options?.triggerId`로 단순화하면 키가 존재하지 않게 되어 Jest 버전에 따라 테스트 동작이 달라질 수 있다.

---

## 요약

시그니처 변경(`executedBy?:string` → `options?`)의 4개 호출 지점 모두에 대해 mock assertion이 정확하게 갱신됐고, `execution-engine`, `hooks`, `schedule-runner`, `schedules`, `workflows.controller` 전반에 걸쳐 핵심 경로는 잘 커버된다. 주요 공백은 `ScheduleRunnerService.process()`의 성공 후 DB 갱신 검증 및 에러 re-throw 검증 누락으로, 현재 구현의 after-execute 로직이 깨져도 테스트가 통과할 수 있다.

## 위험도

**LOW**