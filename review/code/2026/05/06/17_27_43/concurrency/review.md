충분한 코드를 읽었습니다. 분석을 작성합니다.

---

### 발견사항

---

**[MEDIUM] `executeSync` 타임아웃 TOCTOU — 배경 실행이 DB 상태를 덮어씀**

- **위치**: `execution-engine.service.ts` L800–870 (`executeSync`)
- **상세**: `Promise.race([this.runExecution(...), timeoutPromise])`에서 타임아웃이 먼저 resolve되더라도 `runExecution`은 백그라운드에서 계속 실행된다. catch 블록은 `reloaded` DB를 읽어 `status !== COMPLETED && !== FAILED`이면 FAILED로 덮어쓰지만, 직후에 `runExecution`이 완료되어 `COMPLETED`를 기록하면 FAILED 마킹을 무효화한다. 호출자는 타임아웃 에러를 받았는데 DB 행은 COMPLETED 상태가 되는 불일치가 발생한다.
- **제안**: `runExecution`에 취소 토큰(AbortSignal 또는 per-execution cancel flag)을 주입해 타임아웃 시 진행 중인 실행을 실제로 중단하거나, TOCTOU가 명시적으로 허용된 것임을 주석으로 문서화하고 `executeSync` 호출자들이 DB에서 최종 상태를 다시 읽어 결정하도록 안내한다.

---

**[MEDIUM] `ParallelExecutor` 브랜치 컨텍스트 — `variables`의 shallow copy에 의한 중첩 객체 공유**

- **위치**: `parallel-executor.ts` L68–73
- **상세**: `variables: { ...context.variables }`는 1단계 shallow copy만 수행한다. 만약 `variables` 내 값이 객체 참조(`{ nested: { x: 1 } }`)라면, 두 브랜치가 동일한 중첩 객체에 concurrently 쓸 수 있다. Node.js 단일 스레드 특성상 즉각적 데이터 손상은 없지만, 두 브랜치가 `await` 경계를 넘나들며 `context.variables.someObj.field`에 교대로 쓰면 비결정적 마지막-쓰기-승리 결과가 된다.
  ```ts
  // 현재 — shallow copy만
  variables: { ...context.variables }
  
  // 제안 — deep clone (단순 JSON-safe 값 한정이라면)
  variables: JSON.parse(JSON.stringify(context.variables))
  // 또는 structuredClone(context.variables)
  ```
- **제안**: 브랜치 컨텍스트 생성 시 `structuredClone(context.variables)`를 사용하거나, 핸들러가 `variables`의 중첩 객체를 직접 변이하지 않음을 CONVENTIONS에 명시한다.

---

**[INFO] 병렬 브랜치에서 `nodeOutputCache` / `structuredOutputCache`가 공유 참조**

- **위치**: `parallel-executor.ts` L68–73, `execution-engine.service.ts` L3563–3565
- **상세**: `branchContext`의 `nodeOutputCache`와 `structuredOutputCache`는 spread(`...context`)로 공유된다. 현재는 각 브랜치가 exclusive 노드 집합(`bodyNodeIds`)에만 쓰도록 설계되어 있어 키 충돌이 없다. 그러나 미래에 조인 노드가 두 브랜치에서 공통으로 실행되거나 설계가 변경되면 race window가 열린다.
- **제안**: `nodeOutputCache: { ...context.nodeOutputCache }` shallow copy를 추가해 방어적 격리를 명시하거나 현재 설계의 불변식("브랜치 노드 집합은 반드시 배타적")을 주석으로 문서화한다.

---

**[INFO] `resolveHasDefaultLlmConfigCached` — 병렬 브랜치 간 메모이제이션이 공유되지 않음**

- **위치**: `execution-engine.service.ts` L2562–2574
- **상세**: 캐시 키를 `branchContext.variables`에 저장하는데, 각 브랜치는 자체 `variables` 복사본을 가지므로 한 브랜치의 DB 조회 결과가 다른 브랜치에 전달되지 않는다. AI 노드 N개가 병렬 브랜치에 있으면 `hasDefaultLlmConfig` DB 쿼리가 브랜치 수만큼 발생한다.
- **제안**: 캐시를 `context.variables` 대신 `Map<string, Promise<boolean>>` 형태의 per-execution 캐시로 관리하면 공유 참조가 되어 병렬 브랜치 간에도 단 1회만 쿼리된다.

---

**[INFO] `executeInline`의 finally 블록이 `executionPathChain`을 drain하지 않음**

- **위치**: `execution-engine.service.ts` L766–770 (`executeInline` finally), L1298–1308 (`runExecution` finally)
- **상세**: `executeInline` 내에서 호출된 `appendExecutionPath`가 등록한 chain promise를 `executeInline` 자신은 drain하지 않는다. 부모 `runExecution`의 finally 블록에 의존하는 암묵적 결합이다. 현재 `executeInline`이 항상 `runExecution` 내부에서 awaited되므로 실제 메모리 누수는 없지만, 미래에 독립 실행 경로가 추가되면 chain이 방치될 수 있다.
- **제안**: `executeInline`의 finally 블록에도 chain drain을 추가하거나 이 의존 관계를 문서화한다.

---

**[INFO] 테스트에서 `flushPromises`가 단일 hop만 처리함**

- **위치**: `execution-engine.service.spec.ts` L41–44
- **상세**: `flushPromises`가 `setImmediate`를 사용해 microtask queue를 1회 flush한다. `setTimeout` 기반 비동기 체인(예: retry delay `sleep`, `executeSync` 타임아웃)은 flush되지 않는다. 이로 인해 해당 경로를 테스트하는 케이스에서 비동기 사이드이펙트가 누락될 수 있다.
- **제안**: 타이머가 관련된 테스트에는 Jest의 `fakeTimers`를 함께 사용하거나, `Promise.all`로 여러 번 flush한다.

---

### 요약

코드 전반은 Node.js 단일 이벤트 루프를 올바르게 활용하고 있으며, `executionPathChain`을 통한 promise-chaining 직렬화는 `PARALLEL_ENGINE=v1`에서 발생하는 `executionPath` read-modify-write 경쟁을 명확하게 해소한 잘 설계된 패턴이다. `pendingContinuations`의 get-delete-resolve 순서도 동시 double-resolve를 안전하게 방어한다. 주요 위험은 두 가지다: `executeSync`의 타임아웃 TOCTOU로 인해 DB 상태가 FAILED가 아닌 COMPLETED로 남을 수 있고, `ParallelExecutor`의 `variables` shallow copy로 인해 핸들러가 중첩 객체를 직접 변이할 경우 브랜치 간 상태 오염이 가능하다. 그 외 항목들은 현재 설계의 불변식(배타적 브랜치 노드 집합)이 유지되는 한 안전하지만, 방어적 문서화 또는 격리 강화가 권장된다.

### 위험도

**MEDIUM**