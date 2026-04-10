### 발견사항

- **[INFO]** `reachable` Set과 백엣지 점프 시 비원자적 다단계 갱신
  - 위치: `execution-engine.service.ts` — 백엣지 처리 블록 (`reachable.delete` 루프 → `reachable.add` → `pointer = ...`)
  - 상세: 세 단계(범위 삭제 → 목표 추가 → 포인터 리셋)가 `await` 없이 동기적으로 실행되므로 Node.js 단일 스레드 모델에서는 인터리빙 없음. `reachable`도 실행 인스턴스별 지역 변수라 실행 간 공유 없음.
  - 제안: 변경 불필요. 현재 구조 안전함.

- **[INFO]** `executeInline`의 `executedNodes` / `nodeOutputCache` 공유 상태
  - 위치: `execution-engine.service.ts` — `executeInline` 메서드
  - 상세: `executedNodes`(Set)와 `context.nodeOutputCache`(Record)는 부모 실행에서 전달받은 공유 참조. 현재는 WorkflowHandler가 순차 호출하므로 문제없으나, 향후 `Promise.all`로 병렬 서브워크플로우를 실행하면 `await` 포인트마다 두 자료구조에 대한 읽기-쓰기 교차가 발생해 경쟁 조건이 생길 수 있음.
  - 제안: 병렬 인라인 실행 추가 시 각 서브워크플로우에 격리된 `executedNodes` 복사본 전달 필요. 현재는 해당 없음.

- **[INFO]** `pendingContinuations` Map — 타임아웃과 외부 resolve 간 경쟁 가능성
  - 위치: `waitForFormSubmission` 내 `setTimeout` 콜백 vs `continueExecution` 메서드
  - 상세: 타임아웃 콜백이 `has()` → `delete()` → `reject()`, `continueExecution`이 `get()` → `delete()` → `resolve()`를 각각 실행하는 시나리오. Node.js 단일 스레드 이벤트 루프 특성상 두 콜백이 인터리빙될 수 없으므로 실제 경쟁 조건 없음.
  - 제안: 현재 구조 안전함.

- **[INFO]** `propagateReachability`가 블로킹 인터랙션 이후에 호출되는 순서
  - 위치: `runExecution`, `executeInline` — `waitForButtonInteraction` 이후 `propagateReachability` 호출
  - 상세: `waitForButtonInteraction` 완료 후 `nodeOutputCache`에 `_selectedPort`가 설정되고, 그 다음 `propagateReachability`가 이를 읽어 분기를 결정하는 순서가 `await` 체인상 올바름. 블로킹 대기 중 다른 실행의 코드가 개입할 수 있으나 `reachable`은 지역 변수이므로 영향 없음.
  - 제안: 현재 구조 정확함. 코드 주석 `"Must happen after blocking interactions"`이 의도를 잘 표현하고 있음.

---

### 요약

이번 변경(`portRoutingSkipped` → `reachable` 기반 도달성 전파)은 동시성 관점에서 위험도가 증가하지 않는다. `reachable` Set은 각 `runExecution` / `executeInline` 호출마다 독립적인 지역 변수로 생성되므로 동시에 여러 워크플로우가 실행되더라도 상태 공유가 없다. `pendingContinuations` Map은 싱글턴이지만 Node.js 단일 스레드 이벤트 루프 특성상 원자성이 보장된다. `executeInline`에서 부모 컨텍스트의 `executedNodes`와 `nodeOutputCache`를 공유 참조로 사용하는 것은 현재 순차 호출 구조에서는 안전하나, 향후 병렬 서브워크플로우 실행 시 잠재적 경쟁 조건의 씨앗이 될 수 있다.

### 위험도
**LOW**