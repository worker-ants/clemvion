### 발견사항

- **[WARNING]** 순환 그래프에 대한 에러 응답 메시지 변경 (Breaking behavioral change)
  - 위치: `execution-engine.service.ts` - 이전 `detectCycle` → 신규 `identifyBackEdges` 교체
  - 상세: 기존에는 순환 그래프가 있는 워크플로우 실행 시 즉시 `"Workflow graph contains a cycle: A -> B -> A"` 에러로 실패했으나, 변경 후에는 실행이 시작되어 최대 반복 횟수 초과 후 `"Node X exceeded maximum iteration count (100)"` 메시지로 실패합니다. 이 에러 메시지를 파싱하거나 의존하는 클라이언트가 있다면 동작이 달라집니다.
  - 제안: WebSocket `execution.failed` 이벤트의 `error` 필드에 에러 코드(`errorCode: "MAX_ITERATIONS_EXCEEDED"`)를 추가하여 클라이언트가 에러 유형을 메시지 파싱 없이 식별하도록 개선

- **[INFO]** `MAX_NODE_ITERATIONS=0` 시 무제한 반복 허용 — 운영 API 계약 영향
  - 위치: `execution-engine.service.ts:284`, ConfigService 주입
  - 상세: 환경 변수로 `0` 설정 시 무한 루프 가능 워크플로우가 실행되어 실행 응답이 영구적으로 오지 않을 수 있습니다. REST/WebSocket API 관점에서 클라이언트의 타임아웃 처리가 필요합니다.
  - 제안: 스펙의 `§8 동시 실행 제한`에 있는 "단일 Execution 최대 실행 시간(30분)"이 이를 차단하는지 명시적으로 확인 필요

- **[INFO]** `continueExecution`, `cancelWaitingExecution`, `continueButtonClick` 공개 메서드 시그니처는 변경 없음 — 하위 호환성 유지됨

---

### 요약

이 변경사항은 내부 그래프 순회 알고리즘 교체(DAG 강제 → back-edge 허용)로, 공개 REST API 엔드포인트나 요청/응답 스키마에는 직접적인 영향이 없습니다. 다만 WebSocket `execution.failed` 이벤트의 `error.message` 내용이 실질적으로 변경되어, 기존 순환 그래프 에러를 메시지 문자열로 감지하던 클라이언트에게 behavioral breaking change가 발생합니다. 에러 코드 필드 추가로 대응 가능한 수준의 낮은 위험도입니다.

### 위험도
LOW