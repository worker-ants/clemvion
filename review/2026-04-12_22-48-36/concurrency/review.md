### 발견사항

- **[WARNING]** 비원자적 이중 캐시 쓰기 (Non-atomic dual-cache write)
  - 위치: `execution-engine.service.ts`, `waitForButtonInteraction` 메서드 (~line 1711, 1739)
  - 상세: 버튼 클릭 처리 완료 후 `setNodeOutput`과 `setStructuredOutput`을 순차적으로 호출하는데, 두 호출 사이에 `await` 지점이 없더라도 `setNodeOutput` 내부에서 WebSocket 이벤트 발행이나 옵저버 패턴이 트리거되면 `structuredOutputCache`가 아직 갱신되기 전 상태에서 다른 코루틴이 읽을 수 있음. 두 캐시가 일시적으로 불일치 상태가 됨.
  ```typescript
  this.contextService.setNodeOutput(executionId, node.id, updatedOutput);   // flat cache 갱신
  // ← 이 시점에 이벤트 처리가 끼어들면 structuredOutputCache는 구 상태
  this.contextService.setStructuredOutput(executionId, node.id, updatedStructured); // structured cache 갱신
  ```
  - 제안: 두 캐시를 단일 트랜잭션처럼 묶는 `setOutputs(executionId, nodeId, flat, structured)` 메서드를 `ExecutionContextService`에 추가하거나, `setNodeOutput` 내부에서 structured cache를 함께 갱신하도록 통합.

- **[WARNING]** `structuredOutputCache` TOCTOU (Time-Of-Check-Time-Of-Use)
  - 위치: `execution-engine.service.ts` ~line 1711–1739
  - 상세: `prevStructured = context.structuredOutputCache?.[node.id]` 읽기 이후 `setStructuredOutput` 쓰기까지 `await nodeExecutionRepository.save(nodeExec)`가 중간에 존재함. DB I/O 중에 같은 `executionId`의 다른 비동기 흐름(예: 병렬 브랜치, 재시도 로직)이 동일 `node.id`의 구조화 캐시를 갱신하면 `prevConfig`/`prevMeta`가 오래된 값이 됨.
  ```typescript
  const prevStructured = context.structuredOutputCache?.[node.id]; // ← 읽기
  // ...
  await this.nodeExecutionRepository.save(nodeExec);               // ← I/O 지점
  // ...
  this.contextService.setStructuredOutput(..., updatedStructured);  // ← 쓰기
  ```
  - 제안: `prevStructured` 스냅샷을 DB 저장 이후 다시 읽거나, structured cache 갱신을 DB 저장 이전에 완료하여 I/O 전후 경계를 명확히 분리.

- **[INFO]** 이중 소스 fallback 패턴의 일관성 위험
  - 위치: `execution-engine.service.ts` ~line 461–469, 845–852
  - 상세: `interactionType`을 `structuredMeta?.interactionType ?? nodeOutput?.interactionType`로 이중으로 읽는 패턴은 마이그레이션 기간 한정 의도지만, 두 캐시가 비동기 실행 중 다른 상태를 가질 경우 실제로 서로 다른 값을 반환할 수 있음. 특히 레거시 핸들러가 `interactionType`을 flat output에 직접 넣고 신규 핸들러가 `meta`에 넣는 혼재 상황에서 재실행/복구 시 잘못된 분기로 진입할 수 있음.
  - 제안: 마이그레이션 완료 시점에 fallback 제거 일정을 명시적으로 TODO 주석으로 기록. 현재는 낮은 위험도이나 레거시 핸들러 잔존 기간이 길어질수록 위험 증가.

- **[INFO]** `adaptHandlerReturn` 내 `config` spread의 타입 완화
  - 위치: `handler-output.adapter.ts` ~line 79
  - 상세: `(hasConfig ? adapted.config : {})` — `adapted.config`의 타입이 `unknown`이라면 spread 시 런타임 에러 가능성이 있으나, 인터페이스 상 `Record<string, unknown>`으로 보장되므로 실제 동시성 이슈는 아님. 단, 타입 단언 제거로 컴파일러 검증 범위가 좁아진 점은 주목.

---

### 요약

변경된 코드는 핸들러 출력 구조를 flat → structured(`{ config, output, meta }`)로 마이그레이션하는 내용으로, 동시성 측면에서 가장 주목할 부분은 `waitForButtonInteraction` 내의 **비원자적 이중 캐시 쓰기**다. Node.js의 단일 스레드 이벤트 루프 덕분에 메모리 레벨의 진성 경쟁 조건은 발생하지 않지만, `setNodeOutput`과 `setStructuredOutput` 사이 I/O 지점(`nodeExecutionRepository.save`)에서 비동기 컨텍스트 전환이 일어나면 두 캐시가 일시적으로 불일치 상태를 가질 수 있으며, WebSocket 이벤트나 다른 코루틴이 그 사이 구조화 캐시를 읽으면 오래된 `interactionType`이나 `buttonConfig`를 참조할 수 있다. 이중 fallback(`structuredMeta ?? nodeOutput`) 패턴은 마이그레이션 기간에는 필요하나, 두 캐시의 불일치 상태를 감추는 역할도 하므로 레거시 제거 시점을 명확히 관리해야 한다.

### 위험도

**LOW**