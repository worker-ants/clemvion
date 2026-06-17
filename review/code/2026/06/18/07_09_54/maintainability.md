# 유지보수성(Maintainability) Review

## 발견사항

### [INFO] `EngineDriver` 인터페이스가 구현 세부 타입(`ExecutionGraphState`, `NodeDispatchLoopParams`)을 직접 임포트
- 위치: `engine-driver.interface.ts` L9-13
- 상세: 인터페이스 파일이 `./execution-engine.service` 에서 두 타입을 임포트한다. 이는 인터페이스가 구현체 파일에 의존하는 역방향 결합을 만든다. 일반적으로 인터페이스는 구체 구현에서 독립되어야 한다. 이 타입들을 별도 shared 타입 파일(예: `execution-engine.types.ts`)에 두면 순환 의존 위험을 완전히 제거할 수 있다.
- 제안: `ExecutionGraphState`, `NodeDispatchLoopParams`를 `execution-engine.types.ts`와 같은 leaf 파일로 이동하고 인터페이스와 서비스 양쪽에서 임포트. (단, 이번 PR 범위에서 이미 인식하고 있는 한계로 docstring에 언급된 만큼 후속 리팩토링 대상으로 적절히 미뤄진 것으로 보임)

---

### [INFO] `applyRetryLastTurn`의 좀비 row 방지 패턴이 3회 반복됨
- 위치: `retry-turn.service.ts` — `applyRetryLastTurn` 내 `!retryState` 분기(L419-430), `!execution` 분기(L439-449), `!node` 분기(L451-461)
- 상세: 세 early-return 분기 모두 동일한 패턴(`spawnedRow.status = FAILED`, `spawnedRow.error = {...}`, `spawnedRow.finishedAt = new Date()`, `save`, `return`)을 반복한다. 중복 자체가 오류를 유발하진 않지만, `finishedAt` 세팅 누락이나 필드명 오타 같은 버그가 한 분기에만 발생할 수 있다.
- 제안: `markSpawnedRowFailed(spawnedRow, message)` 같은 private helper로 추출하면 3개 분기가 한 줄씩으로 줄어들고 일관성이 보장된다.

```typescript
private async markSpawnedRowFailed(
  row: NodeExecution,
  message: string,
): Promise<void> {
  row.status = NodeExecutionStatus.FAILED;
  row.error = { message };
  row.finishedAt = new Date();
  await this.nodeExecutionRepository.save(row);
}
```

---

### [INFO] `retryLastTurn`의 `spawned` 변수 타입 어설션 패턴이 직관적이지 않음
- 위치: `retry-turn.service.ts` L2318, L2356
- 상세: `let spawned: NodeExecution | null = null`로 선언 후 트랜잭션 콜백 내에서 할당하고, 트랜잭션 종료 후 `(spawned as NodeExecution | null)?.id`로 읽는다. TypeScript는 클로저 내 할당이 외부 변수에 반영되는 것을 알지만, 타입이 `null`로 좁혀지지 않아 이중 타입 단언이 필요하다. 이 패턴은 트랜잭션이 throw 없이 끝났음에도 `null`일 수 있다는 불필요한 방어 분기를 요구한다.
- 제안: 트랜잭션 콜백의 반환값을 직접 사용하면 명확해진다.

```typescript
const spawned = await this.dataSource.transaction(async (manager) => {
  // ... consume ...
  const fresh = manager.create(NodeExecution, { ... });
  return manager.save(NodeExecution, fresh);
});
```

---

### [INFO] `engine-driver.interface.ts` 주석 블록 구분선(U+2500 대시)이 시각적 혼잡 유발
- 위치: `engine-driver.interface.ts` L86-90 (`C-1 step4` 섹션 구분선)
- 상세: `// ─────...` 형태의 78자 구분선은 기존 인터페이스 상단 JSDoc 스타일과 다르다. C-1 step2 원본 멤버들에는 이 구분선이 없어 스타일 일관성이 깨진다.
- 제안: 기존 멤버들과 동일하게 JSDoc 블록 주석(`/** ... */`)으로 섹션 의도를 표현하거나, 구분선 패턴을 프로젝트 전체에서 사용하는지 확인 후 일관 적용.

---

### [INFO] `retry-turn.service.spec.ts`의 `installRetryMocks`가 `service` 내부를 직접 패치함
- 위치: `retry-turn.service.spec.ts` L1666
- 상세: `(service as unknown as { dataSource: unknown }).dataSource = ...`로 private 필드를 per-test 오버라이드한다. 이는 구현 내부 필드명(`dataSource`)에 테스트가 강결합된다는 의미다. 필드명이 변경되면 테스트가 조용히(runtime에) 실패한다.
- 제안: `dataSource`를 생성자 파라미터로 주입받는 구조(현재도 그렇게 되어 있음)를 유지하면서, `beforeEach`에서 `new RetryTurnService(..., mockDataSource, ...)`로 생성 시 mock을 주입하고, `installRetryMocks` 내에서 `mockDataSource.transaction` mock을 교체하는 방식이 더 안전하다. 단, 현재 `mockDataSource`가 `beforeEach`에서 `{ transaction: jest.fn() }`으로 이미 생성되므로 이를 외부 변수로 꺼내면 해결된다.

---

### [INFO] `execution-engine.service.ts`에서 `public`으로 승격된 메서드들에 접근 제한 의도가 코드 표면에서 드러나지 않음
- 위치: `execution-engine.service.ts` — `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `clearLlmDefaultConfigCache`, `findActivatedBackEdge`
- 상세: 5개 메서드가 `private`에서 `public`으로 변경됐다. 이는 `EngineDriver` 인터페이스 계약을 통한 제한적 노출이지만, 클래스 소비자가 `EngineDriver`를 거치지 않고 `ExecutionEngineService` 직접 참조 시 이 메서드들을 자유롭게 호출할 수 있다. `protected`나 명시적 `@internal` JSDoc 태그가 없어, 인터페이스 밖에서의 직접 호출을 억제하는 언어 레벨 장치가 없다.
- 제안: 인터페이스 전용 노출임을 `/** @internal — EngineDriver 계약을 통해서만 호출. 직접 참조 금지. */` JSDoc으로 명시. TypeScript에서 가시성 강제는 불가능하지만 의도를 코드에 기록하면 리뷰와 grep으로 추적 가능하다.

---

### [INFO] `workflow-errors.ts`에서 `import` 문이 파일 중간에 위치함
- 위치: `workflow-errors.ts` L3026 — `import { ErrorCode } from '../../nodes/core/error-codes';`
- 상세: TypeScript/ESLint 관례상 `import`는 파일 최상단에 위치해야 한다. 이 임포트가 `RetryLastTurnError` 클래스 직전에 위치해 가독성을 해치며, eslint `import/first` 규칙 위반 가능성이 있다.
- 제안: 파일 상단 임포트 섹션으로 이동.

---

### [WARNING] `completeRetryExecution`과 `failRetryExecution`이 `RetryTurnService` 내부에서만 사용됨에도 `resumeGraphAfterRetry`로부터만 호출되는 구조적 의존 관계가 숨겨져 있음
- 위치: `retry-turn.service.ts` — `completeRetryExecution`(L2560-2573), `failRetryExecution`(L2755-2781)
- 상세: `completeRetryExecution`은 `resumeGraphAfterRetry`의 defensive fallback에서만 호출됨을 JSDoc에 명시하고 있으나, 호출 경로가 `applyRetryLastTurn` → `resumeGraphAfterRetry` → `completeRetryExecution`으로 두 단계 들어가 있다. `failRetryExecution`은 `applyRetryLastTurn`의 catch에서 호출된다. 두 helper 모두 `Execution`을 직접 mutate하므로, 서비스의 상태 변이 책임 범위가 메서드 서명만 봐서는 파악하기 어렵다.
- 제안: `@internal` + `@remarks 호출자: resumeGraphAfterRetry defensive fallback 전용` 같은 호출 제약 주석을 통일 포맷으로 추가. (현재 `completeRetryExecution`에는 어느 정도 명시돼 있으나, `failRetryExecution`에는 없음)

---

### [WARNING] `resumeGraphAfterRetry`의 함수 길이와 복잡도
- 위치: `retry-turn.service.ts` — `resumeGraphAfterRetry` (약 80줄)
- 상세: 메서드가 (1) graph 로드, (2) fallback 판별, (3) reachability seed, (4) executedNodes 등록 및 전파, (5) back-edge 처리, (6) dispatch loop 호출, (7) completion finalize 총 7개 단계를 순서대로 처리한다. 각 단계가 주석으로 번호가 붙어 있어 가독성은 나쁘지 않지만, 단일 메서드가 과도한 책임을 가진다. `@remarks`에서 "resumeFromCheckpoint traversal loop와 거의 동일하다"고 스스로 언급하는 중복 코드 존재를 인지하고 있으며, 이 중복이 향후 한쪽만 수정 시 silent regression의 씨앗이 된다.
- 제안: 단기적으로는 현 구조 유지(이미 plan에 언급됨)가 적절하나, 후속 plan에 `setupReachabilityFromCompleted(...)`, `finalizeExecutionCompleted(...)` 같은 공통 helper 추출을 명시적으로 트래킹할 것.

---

## 요약

이번 PR은 `RetryTurnService` 추출로 god-class를 466줄 추가 감소시키는 strangler-fig 리팩토링의 완결 단계다. 코드 구조는 PR2(AiTurnOrchestrator), PR3(Form/ButtonInteractionService)와 동일한 패턴을 일관성 있게 따르고 있어 전체적인 유지보수성 방향은 올바르다. 주요 유지보수 위험은 세 가지다: (1) `applyRetryLastTurn` 내 좀비 row 방지 패턴 3중 중복으로 인한 미래 불일치 위험, (2) `workflow-errors.ts` 내 mid-file `import` 문이 ESLint 규칙을 잠재적으로 위반하며 가독성을 저해, (3) `resumeGraphAfterRetry`와 `resumeFromCheckpoint` 간 중복 코드가 이미 인지되었으나 plan 추적이 명시적이지 않아 방치될 가능성. `engine-driver.interface.ts`가 `execution-engine.service`를 역방향 임포트하는 구조적 결합은 현 strangler-fig 전략의 한계로 인식하고 수용한 것으로 보이나, 향후 타입 leaf 파일 분리를 통해 해소하는 것이 바람직하다.

## 위험도

LOW
