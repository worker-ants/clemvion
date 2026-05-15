### 발견사항

- **[WARNING]** 실행 루프 로직 중복 (`runExecution` vs `executeInline`)
  - 위치: `execution-engine.service.ts`, `runExecution` 및 `executeInline` 메서드
  - 상세: `reachable` 세트 초기화, `while (pointer < sortedNodeIds.length)` 루프 전체, 최대 반복 가드, disabled 노드 스킵, `propagateReachability` 호출, back-edge 처리 로직이 두 메서드에 거의 동일하게 복사되어 있음. 약 120줄 이상의 복잡한 로직이 중복. 한 쪽에서 버그를 수정해도 다른 쪽에는 반영되지 않을 위험이 있음.
  - 제안: `executeGraphLoop(sortedNodeIds, nodeMap, graphEdges, ..., options)` 같은 공유 private 메서드로 추출. `runExecution`과 `executeInline`은 각자의 준비 로직(노드 로딩, 컨텍스트 설정) 후 이 공유 메서드를 호출하는 구조로 개선.

- **[WARNING]** `ExecutionEngineService`의 God Class 심화
  - 위치: `execution-engine.service.ts` 전체 (~2100줄)
  - 상세: 그래프 순회, 노드 실행, WebSocket 이벤트 발행, Form 대기, Button 인터랙션, AI 대화 관리, 서브워크플로우 실행, 재도전 복구, 도달성(reachability) 전파까지 단일 서비스가 담당. `propagateReachability` 추출은 긍정적이나, 핵심 책임 분리는 이루어지지 않음.
  - 제안: `GraphExecutor`, `BlockingInteractionManager`, `ExecutionEventEmitter` 등으로 책임 분리 검토. 당장 전면 리팩토링이 어렵다면 최소한 실행 루프를 별도 클래스로 분리하는 것을 우선 고려.

- **[WARNING]** `memory/execution-engine-analysis.md` 내용이 구현과 불일치
  - 위치: `memory/execution-engine-analysis.md`
  - 상세: 파일 내용이 구 방식(`portRoutingSkipped` 세트, skip 판단 로직 라인 번호)을 "현재 방식"으로 기술하고 있음. 이번 변경으로 해당 접근법이 `reachable` 기반으로 교체되었으므로 메모리 파일이 완전히 stale 상태.
  - 제안: 파일을 새로운 `reachable` 기반 접근법 설명으로 갱신하거나, 이슈가 해결된 경우 "해결됨" 섹션을 추가.

- **[INFO]** `propagateReachability`와 blocking 인터랙션 간의 암묵적 순서 의존성
  - 위치: `execution-engine.service.ts:825-833` (`runExecution`), `:475-483` (`executeInline`)
  - 상세: `propagateReachability`는 반드시 `waitForButtonInteraction` 이후에 호출되어야 함(버튼 클릭이 `_selectedPort`를 설정하므로). 주석으로 명시되어 있으나, 순서를 변경할 경우 조용히 버그가 발생할 수 있는 시간적 결합(temporal coupling).
  - 제안: 버튼 인터랙션 내부에서 직접 reachability를 업데이트하거나, 순서 의존성을 명확히 하는 assertion 추가 고려.

- **[INFO]** `ValidationResult.errors` 비옵셔널화 확인 필요
  - 위치: `text-classifier.handler.spec.ts:65`, `node-handler.interface.ts` (미포함)
  - 상세: `result.errors!.length` → `result.errors.length`로 변경은 `errors`가 항상 정의됨을 가정. `ValidationResult` 인터페이스에서 `errors`가 실제로 `string[]`(non-optional)인지 확인 필요. 만약 `string[] | undefined`라면 핸들러 구현에서 일관성 없이 처리될 수 있음.
  - 제안: 인터페이스를 `errors: string[]`으로 고정하고 모든 핸들러가 빈 배열 `[]`을 반환하도록 강제.

- **[INFO]** back-edge 재실행 시 reachable 세트 재초기화 로직의 미묘함
  - 위치: `execution-engine.service.ts:843-847`
  - 상세: back-edge 활성화 시 재실행 범위의 모든 노드를 `reachable`에서 제거한 후 target만 추가. 이후 target 노드 실행 → `propagateReachability`로 하위 노드가 재추가되는 구조. 동작은 올바르나, 이 불변식(invariant)이 문서화되어 있지 않아 추후 수정 시 실수 가능성 있음.
  - 제안: 해당 블록에 "Re-execution pass: reachability will be re-propagated as nodes execute" 식의 설명 주석 추가.

---

### 요약

이번 변경의 핵심인 `portRoutingSkipped` → `reachable` 기반 도달성 전파 방식은 아키텍처적으로 올바른 방향의 개선이다. 기존의 "모든 노드 방문 후 명시적 skip" 패턴이 갖는 위상 정렬 비결정성 문제를 "실행 후 도달 가능한 하위 노드를 활성화"하는 전파 모델로 대체함으로써 포트 라우팅의 정확성이 높아졌다. 다만 핵심 실행 루프 로직이 `runExecution`과 `executeInline` 두 곳에 중복 구현되어 있어 유지보수 부채가 크며, `ExecutionEngineService` 자체가 단일 책임 원칙을 위반하는 God Class 상태가 지속되고 있다. `propagateReachability` 메서드 추출은 긍정적이지만, 실행 루프의 공통화가 선행되지 않으면 향후 기능 추가 시 세 번째 중복 구현이 생길 위험이 있다.

### 위험도

**MEDIUM**