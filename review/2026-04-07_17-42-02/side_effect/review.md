## 리뷰 결과: 부작용(Side Effect) 분석

---

### 발견사항

**[INFO]** `detectCycle` → `identifyBackEdges` 교체로 인한 공개 API 제거
- 위치: `execution-engine.service.ts:22`
- 상세: `detectCycle`이 완전히 제거되고 `identifyBackEdges`로 대체됨. `detectCycle`이 다른 모듈에서 직접 import되고 있지 않은지 확인 필요.
- 제안: 현재 변경 범위에서는 문제없으나, `cycle-detector.ts` 파일 자체가 삭제되었는지 확인 필요.

---

**[WARNING]** `backEdgeMap`에서 `sortedNodeIds.indexOf()` 비용 — 런타임 O(n) 반복
- 위치: `execution-engine.service.ts`, `runExecution()` 내 backEdgeMap 구성 루프
- 상세: back-edge의 `targetNodeId`를 `sortedNodeIds.indexOf()`로 찾음. `sortedNodeIds`가 클 경우 back-edge 수만큼 O(n) 탐색이 발생. 현재는 큰 문제가 아니지만, 잠재적 성능 부작용.
- 제안:
  ```ts
  const indexMap = new Map(sortedNodeIds.map((id, i) => [id, i]));
  // 이후 indexMap.get(edge.targetNodeId) ?? -1 사용
  ```

---

**[WARNING]** `portRoutingSkipped` 초기화 범위가 back-edge 점프 시 불완전할 수 있음
- 위치: `execution-engine.service.ts:415-440`, back-edge 활성화 시 reset 구간
- 상세: `portRoutingSkipped.delete(sortedNodeIds[i])`를 `targetIndex ~ pointer` 범위로 초기화하지만, `executedNodes`는 초기화하지 않는다. 루프 재실행 시 이미 `executedNodes`에 포함된 노드가 `gatherNodeInput`에서 "이미 실행됨"으로 판단되어 이전 출력을 재사용할 수 있음.
- 상세2: 특히 `nodeOutputCache`도 초기화되지 않기 때문에, 루프 내 노드 재실행 시 이전 iteration의 출력이 새 iteration의 입력으로 전달됨. 이는 의도된 동작일 수 있으나, 명시적으로 문서화되지 않았음.
- 제안: 재실행 구간의 `executedNodes`와 `nodeOutputCache`를 어떻게 처리할지 설계 의도를 명확히 주석으로 기록할 것.

---

**[WARNING]** `ConfigService` 주입이 `forwardRef` 없이 추가됨 — NestJS 순환 의존성 위험
- 위치: `execution-engine.module.ts`, `execution-engine.service.ts:118`
- 상세: `WebsocketModule`은 `forwardRef`로 처리되어 있으나, `ConfigModule`은 글로벌 모듈이므로 일반 import로도 충분. 현재는 문제없으나, `ConfigModule`이 글로벌로 등록되어 있다면 `imports`에 중복 추가할 필요가 없음.
- 제안: `AppModule`에서 `ConfigModule.forRoot({ isGlobal: true })`로 등록되어 있다면 `ExecutionEngineModule`의 `imports`에서 제거 가능. 중복 등록은 무해하지만 혼란 유발 가능.

---

**[INFO]** 테스트에서 `service['configService']` private 접근으로 mock 교체
- 위치: `execution-engine.service.spec.ts:869, 920`
- 상세: TypeScript의 private 필드를 `as unknown as` 캐스팅으로 접근하여 mock 구현을 런타임에 교체. 이는 테스트 격리성은 보장하지만, 서비스 내부 구조 변경 시 테스트가 무음으로 실패할 수 있음.
- 제안: `beforeEach`의 `ConfigService` mock을 `per-test`로 구성하거나, DI 토큰을 통해 override하는 방식(`module.overrideProvider`) 고려.

---

**[INFO]** `MAX_NODE_ITERATIONS=0` 무제한 모드에서 무한루프 보호 없음
- 위치: `execution-engine.service.ts:299-304`
- 상세: `maxNodeIterations > 0`일 때만 가드가 동작하므로, `0` 설정 시 실제로 무한루프가 발생할 경우 프로세스가 OOM 또는 무한 실행 상태에 빠짐. 환경 변수로 외부에서 제어되는 값이므로 잘못된 설정 가능성 존재.
- 제안: `MAX_NODE_ITERATIONS=0`은 의도적 선택임을 스펙에 명시했으므로 수용 가능하나, 운영 환경에서 이 값을 허용할지 정책 문서화 권장.

---

**[INFO]** back-edge 타겟이 `sortedNodeIds`에 없는 경우 `targetIndex = -1`
- 위치: `execution-engine.service.ts:271`, `sortedNodeIds.indexOf(edge.targetNodeId)`
- 상세: back-edge의 타겟 노드가 `forwardEdges` 기반 topological sort 결과에 없으면 `indexOf`가 `-1`을 반환하고, 이후 `pointer = -1`이 되어 `sortedNodeIds[-1]`이 `undefined`가 됨. `while (pointer < sortedNodeIds.length)` 조건은 `-1`에서 통과하므로 무한루프 위험.
- 제안:
  ```ts
  const targetIndex = sortedNodeIds.indexOf(edge.targetNodeId);
  if (targetIndex === -1) continue; // back-edge target not in sorted list
  list.push({ edge, targetIndex });
  ```

---

### 요약

이번 변경의 핵심은 `detectCycle`(사이클 거부) → `identifyBackEdges`(사이클 허용, back-edge 기반 루프 실행)로의 전환이다. 전반적으로 설계가 일관되며 의도하지 않은 전역 상태 변경, 파일시스템 부작용, 네트워크 호출 등의 부작용은 없다. 그러나 두 가지 잠재적 위험이 존재한다: (1) `backEdgeMap` 구성 시 `targetIndex = -1`이 될 경우 `pointer`가 `-1`로 설정되어 무한루프가 발생할 수 있으며, (2) back-edge 점프 시 `executedNodes`와 `nodeOutputCache`가 초기화되지 않아 재실행 구간의 노드가 이전 출력을 입력으로 받는 암묵적 동작이 존재한다. 두 번째 항목은 의도된 동작일 수 있으나 명시적 설명이 없어 유지보수 시 혼란을 줄 수 있다.

### 위험도

**MEDIUM** — `targetIndex = -1` 케이스의 무한루프 위험이 실제 발생 가능한 엣지 케이스이므로 조치 권장.