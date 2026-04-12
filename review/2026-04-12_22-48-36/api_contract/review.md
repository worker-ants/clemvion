### 발견사항

- **[WARNING]** `nodeExec.outputData` 저장 형식 변경 (Breaking Change 가능)
  - 위치: `execution-engine.service.ts`, `waitForButtonInteraction` 메서드 (diff 기준 `nodeExec.outputData = updatedStructured`)
  - 상세: 이전에는 flat shape(`updatedOutput`)를 `outputData`에 저장했으나, 이제 `NodeHandlerOutput` 구조체(`{ config, output, meta, port, status }`)를 저장합니다. `nodeExecution` 엔티티의 `outputData`가 REST API나 WebSocket 이벤트로 외부에 노출된다면, 기존 클라이언트가 `outputData.interactionType`, `outputData.buttonId` 등을 직접 참조하던 코드가 깨집니다.
  - 제안: `nodeExecution` API 응답 스키마를 버전 관리하거나, 외부 노출 전 별도의 직렬화 레이어(e.g. response DTO)를 통해 클라이언트 계약 형태로 변환하세요. 또는 `outputData`에 flat shape와 structured shape를 병존시키는 과도기 전략을 명시하세요.

- **[WARNING]** `interactionType` 필드 위치 이동
  - 위치: 핸들러 출력 전반 (`carousel.handler.ts`, `table.handler.ts`, `chart.handler.ts`)
  - 상세: `interactionType`이 최상위 필드에서 `meta.interactionType`으로 이동했습니다. WebSocket 이벤트(`waitingEvent`)가 flat `nodeOutput`을 기반으로 프론트엔드에 전달된다면, 프론트엔드가 `interactionType`을 읽는 위치가 달라집니다.
  - 제안: WebSocket 이벤트 페이로드 스키마를 별도로 정의하고, 엔진 내부 구조 변경이 외부 이벤트 계약에 투명하게 전달되지 않도록 이벤트 직렬화 시점에 정규화하세요.

- **[INFO]** `ButtonConfig`에 `buttonItemMap` 필드 추가
  - 위치: `button.types.ts:13`
  - 상세: 선택적(`?`) 필드 추가이므로 기존 클라이언트에 영향 없음. 하위 호환성 유지됩니다.

- **[INFO]** `handler-output.adapter.ts`의 불필요한 타입 캐스트 제거
  - 위치: `toEngineFlatShape`, `hasConfig` 분기
  - 상세: `(adapted.config as Record<string, unknown>)` 캐스트 제거. `NodeHandlerOutput.config`가 이미 `Record<string, unknown>` 타입이므로 정확한 수정. API 계약 영향 없음.

---

### 요약

이번 변경은 핸들러-엔진 간의 내부 통신 프로토콜을 flat shape에서 구조화된 `NodeHandlerOutput`으로 마이그레이션하는 작업입니다. 외부 REST API 엔드포인트 설계 자체는 변경되지 않았으나, **`nodeExecution.outputData`에 저장되는 형식이 변경**되어 해당 필드를 API로 노출하는 경우 클라이언트 계약이 깨질 수 있습니다. `adaptHandlerReturn`/`toEngineFlatShape` 어댑터를 통한 레거시 캐시와의 공존 전략은 적절하나, DB에 저장되는 structured shape가 외부 API 응답 형식과 동일시되지 않도록 응답 직렬화 레이어를 명확히 분리하는 것이 필요합니다.

### 위험도

**MEDIUM**