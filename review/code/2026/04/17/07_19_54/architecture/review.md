### 발견사항

---

**[WARNING]** `ExecutionEngineService`가 God Class로 확장됨 — SRP 위반
- 위치: `execution-engine.service.ts` — `planParallelBody`, `executeParallelBranchBody`, `runParallel`, `appendExecutionPath` 추가
- 상세: 이미 대형 서비스인 `ExecutionEngineService`에 병렬 그래프 BFS 플래닝(~100줄), 분기 body 실행, 동시성 조율 책임이 추가되었다. 해당 서비스는 이제 그래프 탐색, 상태 머신, 컨테이너 오케스트레이션, 병렬 플래닝, 백그라운드 스케줄링을 모두 담당하며 한 파일이 수천 줄에 달한다.
- 제안: `ParallelPlanner` 클래스를 분리하여 `planParallelBody`를 위임하고, `executeParallelBranchBody`도 `ParallelBranchRunner`나 `ParallelExecutor` 내부로 이동. `ParallelExecutor`는 이미 올바른 추상화를 갖추고 있으므로 branch body runner 콜백 외에 planning 책임도 흡수할 수 있다.

---

**[WARNING]** Feature Flag를 실행 핫패스 내부에 직접 주입 — OCP / Strategy Pattern 미적용
- 위치: `execution-engine.service.ts:973-1010`
```typescript
if (
  node.type === 'parallel' &&
  this.configService.get<string>('PARALLEL_ENGINE', 'off') === 'v1'
) { ... }
```
- 상세: `PARALLEL_ENGINE=v1` 플래그가 매 노드 실행마다 `configService.get`으로 동적 평가된다. 이는 (1) 핫패스에 불필요한 I/O, (2) Strategy 패턴 미적용으로 인한 확장 어려움, (3) 플래그 종류가 늘어날 경우 if-chain 증가를 유발한다.
- 제안: `OnModuleInit`에서 플래그를 한 번 읽어 `private readonly parallelEngineEnabled: boolean`으로 고정. 장기적으로는 `IParallelStrategy` 인터페이스를 정의하고 `LegacyParallelStrategy` / `V1ParallelStrategy`를 DI로 주입.

---

**[WARNING]** `executeParallelBranchBody`가 `executeContainerBody`의 로직을 중복
- 위치: `execution-engine.service.ts` — `executeParallelBranchBody` 전체
- 상세: skip-node WebSocket 이벤트, container dispatch(`foreach`/`loop`/`map` 분기), background 스케줄링, `waiting_for_input` 런타임 체크가 `executeContainerBody`와 거의 동일한 패턴으로 반복된다. DRY 위반이며 향후 한쪽 변경 시 다른 쪽을 빠뜨릴 위험이 있다.
- 제안: `executeNodeInBody(nodeId, node, input, context, executedNodes, nodeMap, meta, bodyEdges)` 같은 공통 헬퍼를 추출하고, 두 실행 경로가 이를 공유하도록 리팩토링.

---

**[WARNING]** 병렬 분기 간 `executedNodes` Set과 `nodeOutputCache`를 공유하는 암묵적 결합
- 위치: `execution-engine.service.ts` — `runParallel` → `executeParallelBranchBody` 호출부
- 상세: 모든 분기가 동일한 `executedNodes: Set<string>`과 `context.nodeOutputCache`를 참조한다. JavaScript는 단일 스레드이므로 실제 race condition은 없지만, 분기 A가 노드를 `executedNodes`에 추가하면 같은 ID를 갖는 분기 B의 노드가 스킵될 수 있다. `planParallelBody`가 분기 간 노드 ID 배타성을 보장하지만, 이 계약이 타입 시스템에 표현되어 있지 않다.
- 제안: `branchContext`에 `executedNodes`를 분기별로 복사(`new Set(executedNodes)`)하거나, 타입 레벨에서 branch-exclusive 노드임을 명시. 적어도 `planParallelBody`의 반환값에 불변 계약 주석을 강화.

---

**[WARNING]** `waitAll=false` 설정이 경고 후 조용히 무시됨
- 위치: `execution-engine.service.ts` — `runParallel` 내 `waitAll` 처리
- 상세: `waitAll=false`를 사용자가 설정하면 로그 경고만 출력하고 `wait_all` 동작으로 진행한다. 이는 사용자가 설정한 동작과 실제 동작이 다르다는 것을 모르게 만드는 조용한 실패(silent failure) 패턴이다.
- 제안: Phase P1에서는 `waitAll=false`를 명시적 에러로 거부(`PARALLEL_WAIT_ALL_REQUIRED: waitAll=false is not yet supported`)하거나, validate 단계에서 경고를 표시하여 사용자가 설정 전에 인지하도록 처리.

---

**[WARNING]** `PARALLEL_DISPATCHED_PORT` 매직 센티넬 값이 레이어 경계를 침범
- 위치: `execution-engine.service.ts:120`, `runParallel` 메서드 내
- 상세: `'__parallel_internal__'` 매직 문자열을 `nodeOutputCache`에 직접 주입하여 메인 루프의 `propagateReachability`가 분기 재진입을 억제하도록 한다. 이는 실행 상태를 캐시 오브젝트의 특정 키에 숨기는 암묵적 프로토콜로, `propagateReachability`가 이 값을 인식하는 방식과의 암묵적 결합을 만든다.
- 제안: `reachable`에서 직접 `plan.allBodyNodeIds`를 제거하거나, 명시적인 `dispatchedNodes: Set<string>`을 `execute` 메서드 스코프에서 관리하고 메인 루프에 전달.

---

**[INFO]** `parallel` 노드가 Override Registry에 수동 등록 — auto-form 역행
- 위치: `override-registry.ts:65`, `logic-configs.tsx` — `ParallelConfig`
- 상세: 주변 주석에 "split, map, foreach, merge는 schema-driven으로 마이그레이션됨"이라고 명시되어 있지만, `parallel`은 완전한 zod 스키마(`maxConcurrency`, `waitAll` 포함)와 UI 힌트를 갖추고 있음에도 수동 override로 등록된다. `switch` widget이 `UiHint.widget`에 없기 때문이며, 이를 해결하면 auto-form으로 전환 가능하다.
- 제안: `UiHint.widget`에 `'switch'`를 추가하거나 `'checkbox'`를 재사용하고 parallel을 auto-form으로 마이그레이션. 두 구현이 동기화되어야 하는 이중 유지보수 지점을 제거.

---

**[INFO]** `MergeHandler`에서 Phase P2 아키텍처 단계 정보를 경고 로그로 노출
- 위치: `merge.handler.ts:54-68`
- 상세: 핸들러가 "Phase P2 barrier" 같은 구현 로드맵 정보를 사용자에게 직접 warn 로그로 노출한다. 핸들러는 비즈니스 로직 실행만 담당해야 하며, 운영 메시지/로드맵 가시성은 상위 레이어의 책임이다.
- 제안: 해당 경고를 validate 단계로 이동시키거나, 설정 문서에서 처리. 핸들러 내부에서는 지원되는 동작만 실행.

---

**[INFO]** 통합 테스트에서 `setTimeout(200)` 기반 비동기 대기 사용
- 위치: `execution-engine.service.spec.ts:2724`
```typescript
await new Promise((r) => setTimeout(r, 200));
```
- 상세: 타이밍 기반 테스트는 CI 환경 부하에 따라 flaky해질 수 있다. 특히 병렬 실행 완료를 보장하는 로직에 절대 시간을 사용하는 것은 취약하다.
- 제안: `await flushPromises()` (파일 상단에 이미 정의된 헬퍼) 또는 실행 완료 이벤트를 기다리는 방식으로 대체.

---

### 요약

이번 변경은 `ParallelExecutor`를 독립 클래스로 분리하고, DynamicPortsSpec의 tagged union 확장, feature flag 기반 점진적 롤아웃 설계 등 구조적으로 올바른 판단들을 포함한다. 그러나 핵심 문제는 `ExecutionEngineService`가 parallel planning, branch body execution, graph BFS, sentinel 주입까지 흡수하면서 God Class가 심화된 점이다. `planParallelBody`와 `executeParallelBranchBody`는 `ExecutionEngineService` 외부로 분리되어야 하며, feature flag는 Strategy 패턴을 통해 DI로 해결하는 것이 적합하다. `waitAll=false`의 조용한 무시와 `PARALLEL_DISPATCHED_PORT` 센티넬 패턴은 암묵적 프로토콜 결합을 만들어 향후 유지보수 리스크가 된다.

### 위험도

**MEDIUM**