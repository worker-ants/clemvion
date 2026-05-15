## 보안 코드 리뷰: Parallel Execution Engine

### 발견사항

---

**[WARNING] 공유 가변 상태 - 동시성 데이터 레이스**
- 위치: `execution-engine.service.ts` — `runParallel()`, `executeParallelBranchBody()`
- 상세: `executedNodes` (`Set<string>`)와 `context.variables` (객체 레퍼런스)가 모든 브랜치에 공유됨. `Promise.allSettled`로 실행되는 브랜치들은 `await` 지점에서 상호 실행되므로, JavaScript 단일 스레드 모델에도 불구하고 `await executeNode()` 진행 중 다른 브랜치가 `executedNodes`를 읽어 노드 중복 실행 조건을 오판할 수 있음. `planParallelBody()`의 exclusive body 보장이 유일한 방어선.
- 제안: `executeParallelBranchBody`에서 `executedNodes`를 브랜치별 독립 Set으로 분리하고, 완료 후 메인 Set에 병합. `context.variables`는 deep clone 또는 copy-on-write 패턴 적용.

```typescript
// 현재: 공유 참조
await this.executeParallelBranchBody(..., executedNodes, ...);

// 개선: 브랜치별 분리
const branchExecutedNodes = new Set(executedNodes);
await this.executeParallelBranchBody(..., branchExecutedNodes, ...);
for (const id of branchExecutedNodes) executedNodes.add(id);
```

---

**[WARNING] 사용자 제어 데이터가 Error 메시지에 포함 (Log Injection)**
- 위치: `execution-engine.service.ts` — `planParallelBody()` (~L2880, ~L2900, ~L2920)
- 상세: `parallelNode.label`은 사용자가 직접 입력하는 노드 레이블. 이것이 `throw new Error(...)` 메시지에 직접 삽입됨. 레이블에 `\n`, `\r` 또는 로그 파서가 해석하는 특수문자를 포함시키면 로그 인젝션으로 이어질 수 있음.

```typescript
throw new Error(
  `PARALLEL_BACK_EDGE: Parallel node "${parallelNode.label ?? parallelNode.type}" ...`
  //                                    ^^^^^^^^^^^^^^^^^^^ 사용자 입력값
);
```

- 제안: 에러 메시지 생성 시 제어 문자를 제거하거나 레이블 길이를 제한하는 헬퍼 사용.

```typescript
const safeName = (label: string) => label.replace(/[\r\n\t]/g, ' ').slice(0, 100);
```

---

**[WARNING] 얕은 Context 복사 — `variables` 상태 크로스 브랜치 오염**
- 위치: `parallel-executor.ts` — `execute()` 메서드 내 `branchContext` 생성
- 상세: `{ ...context, itemContext: undefined, loopContext: undefined }`는 얕은 복사(shallow clone). `context.variables` 객체는 모든 브랜치가 동일 참조를 공유. 한 브랜치에서 변수 값을 수정하면 다른 브랜치에 즉시 반영되어 비결정적 실행 결과 초래. 워크플로우 로직에 따라 권한 분기 오판 등 보안 이슈로 발전 가능.

```typescript
const branchContext: ExecutionContext = {
  ...context,
  itemContext: undefined,
  loopContext: undefined,
  // variables: 여전히 동일 객체 참조 ← 위험
};
```

- 제안:
```typescript
variables: { ...context.variables }, // 1단계 격리
```

---

**[INFO] 리소스 고갈 — 중첩 비용 연산**
- 위치: `parallel-executor.ts`, `execution-engine.service.ts`
- 상세: `branchCount` 최대 16개 브랜치 + `maxConcurrency: 0` (기본값) = 16개 동시 실행. 각 브랜치가 LLM 호출, DB 쿼리, HTTP 요청 노드를 포함할 경우 단일 워크플로우 실행이 16배 외부 요청을 발생시킴. 테넌트 간 리소스 경쟁 및 외부 API 요금 과다 발생 위험.
- 제안: 시스템 수준에서 워크플로우당 동시 실행 브랜치 수 상한(예: `MAX_PARALLEL_BRANCHES` 환경 변수)을 별도로 설정하거나, LLM/HTTP 노드에 대한 속도 제한(rate limiting)을 적용.

---

**[INFO] prototype pollution 방어 (긍정적 발견)**
- 위치: `merge.handler.ts` — `formatOutput()` `merge_object` 케이스
- 상세: `Object.create(null)` 사용 및 `__proto__`, `constructor`, `prototype` 키를 명시적 차단. 외부 데이터 병합 시 prototype pollution을 효과적으로 방어하는 구현.

---

**[INFO] 기능 플래그 보안**
- 위치: `execution-engine.service.ts`
- 상세: `PARALLEL_ENGINE=v1` 환경 변수로 기능 제어. 인증/인가 검사 없이 환경 변수 접근권을 가진 운영자가 전체 시스템 동작을 변경할 수 있음. 이는 의도된 설계이나, 프로덕션 환경에서 이 플래그 변경이 감사(audit)되는지 확인 필요.

---

### 요약

병렬 실행 엔진 구현 자체는 입력 검증(branchCount/maxConcurrency 범위 클램핑), 블로킹 노드 차단, 재귀 Parallel 금지 등 기본 방어가 잘 갖춰져 있습니다. 그러나 동시 실행 경로에서 `executedNodes` Set과 `context.variables` 객체가 브랜치 간 공유 참조로 유지되는 구조적 문제가 있으며, 사용자 제어 데이터(노드 레이블)가 에러 메시지에 필터링 없이 포함되는 로그 인젝션 위험도 존재합니다. `planParallelBody()`의 exclusive body 불변식이 지켜지는 한 실제 익스플로잇 가능성은 낮으나, 그 불변식이 엣지 케이스에서 깨질 경우 안전망이 없습니다.

### 위험도

**MEDIUM**