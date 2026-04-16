### 발견사항

- **[INFO]** Parallel 노드 설정 스키마 확장 (additive)
  - 위치: `parallel.schema.ts`, `parallel.handler.ts`
  - 상세: `maxConcurrency`(default: 0), `waitAll`(default: true) 필드가 `GET /nodes/definitions` 응답의 Parallel 노드 configSchema에 추가됨. 기본값이 있으므로 기존 저장된 config(`{ branchCount: N }` 형태)는 스키마 통과 가능. additive change로 하위 호환성 유지됨.
  - 제안: 없음

- **[WARNING]** `_selectedPort: '__parallel_internal__'` 내부 센티넬이 실행 출력에 노출될 수 있음
  - 위치: `execution-engine.service.ts` — `PARALLEL_DISPATCHED_PORT`, `runParallel()` 종료부
  - 상세: `context.nodeOutputCache[parallelNode.id]._selectedPort`에 `'__parallel_internal__'`이 주입됨. `GET /executions/{id}` 또는 WebSocket node 이벤트가 nodeOutputCache 내용을 직렬화해 노출하는 경우, 이 내부 값이 API 소비자에게 그대로 전달됨. API 계약에 명시되지 않은 필드가 포함될 위험.
  - 제안: 실행 결과 직렬화 시 `_selectedPort` 키를 필터링하거나, 별도의 내부 상태 맵(service-level Map)으로 분리하여 nodeOutputCache를 오염시키지 않을 것.

- **[WARNING]** 피처 플래그(`PARALLEL_ENGINE=v1`)로 인한 관측 가능한 실행 동작 변경
  - 위치: `execution-engine.service.ts` `:973`
  - 상세: 동일한 workflow를 실행해도 서버 환경변수 값에 따라 branch 실행 순서가 달라짐(순차 vs. 동시). `executionPath` 배열 순서 및 node-execution 타임스탬프가 달라져 `GET /executions/{id}` 응답의 의미론적 계약이 변함. 클라이언트는 이 플래그 존재를 알 수 없음.
  - 제안: 실행 레코드에 `executionMode: 'sequential' | 'parallel'` 필드를 추가하거나, 실행 응답 스키마 문서에 이 동작 차이를 명시할 것.

- **[INFO]** MergeConfig에 `partialOnTimeout` 필드 추가
  - 위치: `merge.handler.ts`
  - 상세: `validate()`는 해당 필드를 허용하지만 Phase P1에서는 효과 없음. `GET /nodes/definitions`의 Merge 노드 configSchema에 해당 필드 미반영 시 UI와 API 스키마 불일치 가능성 있음. 현재 warn-only 처리는 적절함.
  - 제안: Merge 노드의 zod 스키마에도 `partialOnTimeout` 필드를 추가하여 `/nodes/definitions` 응답과 실제 허용 필드를 일치시킬 것.

- **[INFO]** `executionPath` 직렬화 순서 변경
  - 위치: `execution-engine.service.ts` — `appendExecutionPath()`
  - 상세: 병렬 실행 시 `executionPath` 항목이 branch 완료 순서로 삽입됨. 기존 API 소비자가 executionPath 순서를 토폴로지 순서로 가정하고 있다면 동작 변경에 해당함. 순차 실행에서는 기존과 동일.
  - 제안: API 문서에 병렬 실행 시 executionPath가 완료 순서로 기록될 수 있음을 명시할 것.

---

### 요약

이번 변경은 REST API 엔드포인트를 직접 추가/제거하지 않으며, Parallel/Merge 노드 스키마 확장은 기본값이 제공되어 하위 호환성이 유지됩니다. 그러나 내부 센티넬 값(`__parallel_internal__`)이 실행 출력 직렬화를 통해 API 소비자에게 노출될 경우 미문서화 필드가 계약 위반이 될 수 있고, `PARALLEL_ENGINE=v1` 플래그로 인한 실행 동작 변화(실행 경로 순서, 병렬도)가 기존 클라이언트의 실행 결과 해석에 영향을 줄 수 있습니다.

### 위험도
**MEDIUM**