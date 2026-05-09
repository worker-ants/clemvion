/**
 * Engine dispatch metadata for a node type. Replaces hard-coded
 * `node.type === 'foreach'` 분기 (CRIT #3, WARN #26) with self-declared
 * `kind` flags on each NodeComponent.
 *
 * **모든 NodeComponent 가 명시 필수** — `kind: 'standard'` 도 생략 불가.
 * TS 컴파일 시점에 누락이 차단되며, 추가로 NodeHandlerRegistry 의 부팅
 * 검증 (`assertConsistency`) 이 (a) 모든 type 이 unique, (b) `kind: 'container'`
 * 인 type 은 dedicated executor (foreach/loop/map) 가 주입돼야 한다는 invariant
 * 를 검사한다.
 *
 * 새 컨테이너 / 블로킹 노드를 추가할 때:
 *  1. `NodeTypeMetadata` 에 새 `kind` 값을 추가
 *  2. 핸들러 NodeComponent 의 `metadata.executionMetadata` 에 명시
 *  3. ExecutionEngineService 의 dispatch 분기 (catalog flag 분기) 에 새 kind 추가
 *  4. 필요 시 dedicated executor 주입 + 부팅 검증 갱신
 *
 * 외부 npm 패키지로 노드를 배포할 때도 동일 인터페이스를 구현하면 자동 등록.
 *
 * Spec: spec/5-system/4-execution-engine.md §3 (컨테이너 실행), §4.4 (이벤트 발행 sink),
 *       spec/4-nodes/2-flow/1-workflow.md (sub-workflow trigger 박스)
 */
export type NodeTypeMetadata =
  /** 일반 노드 — 엔진은 아무 특수 dispatch 도 하지 않는다. */
  | { readonly kind: 'standard' }
  /**
   * 컨테이너 노드 — `containerId` 로 자식 노드를 그룹화하고 iteration 마다
   * body 를 재실행한다. 현재: `foreach`, `loop`, `map`.
   */
  | { readonly kind: 'container' }
  /**
   * Background 노드 — `background` 포트로 연결된 sub-graph 를 비동기 실행
   * (`BackgroundExecutionQueue`). main 포트는 일반적으로 진행. 현재: `background`.
   */
  | { readonly kind: 'background' }
  /**
   * Parallel 노드 — N 개 branch 를 동시 실행 (`p-limit` semaphore). v1 은
   * `PARALLEL_ENGINE=v1` env-flag 와 결합. 현재: `parallel`.
   */
  | { readonly kind: 'parallel' }
  /**
   * 정적으로 항상 blocking 인 노드 (현재: `form` 만). 엔진이 핸들러 결과의
   * `status === 'waiting_for_input'` 와 함께 본 metadata 를 보고
   * `waitForFormSubmission` 으로 dispatch 한다.
   *
   * **참고**: `buttons` / `ai_conversation` interaction 은 본 metadata 가 아니라
   * 런타임 cached output 의 `meta.interactionType` 으로 분기된다 (handler 가
   * config 에 따라 동적으로 결정 — 같은 carousel 노드도 buttons 가 없으면
   * standard, 있으면 buttons-blocking). 이 경우 본 metadata 는 `'standard'`.
   */
  | {
      readonly kind: 'blocking';
      readonly interaction: 'form';
    }
  /**
   * 트리거 노드 — 워크플로우 진입점. sub-workflow 안에서는 `manual_trigger`
   * 만 허용 (WARN #17). 현재: `manual_trigger`.
   */
  | { readonly kind: 'trigger' };
