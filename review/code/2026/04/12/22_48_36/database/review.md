### 발견사항

- **[WARNING]** `nodeExec.outputData` 저장 형식 변경 — 하위 호환성 없는 JSON 컬럼 데이터 스키마 변경
  - 위치: `execution-engine.service.ts`, 변경된 diff 내 `nodeExec.outputData = updatedStructured as unknown as ...`
  - 상세: 기존에는 `updatedOutput`(flat shape)을 `node_executions.outputData`에 저장했으나, 이제 `NodeHandlerOutput` 구조체(`{ config, output, meta, port, status }`)를 저장합니다. DB에 이미 저장된 이전 레코드는 flat shape이고, 신규 레코드는 structured shape이므로 동일 컬럼에 두 가지 다른 JSON 형태가 공존하게 됩니다. 이 데이터를 읽는 쪽(예: 조회 API, 실행 이력 표시, 재개 로직)이 두 형태를 모두 처리하지 않으면 런타임 오류 또는 데이터 누락이 발생할 수 있습니다.
  - 제안: `outputData`를 읽는 소비처 전체에 대한 하위 호환 처리(flat/structured 판별)를 추가하거나, 저장 시 항상 flat shape으로 직렬화하는 어댑터 레이어를 유지하세요. 또는 `NodeHandlerOutput` 구조를 DB에 그대로 저장하기로 결정했다면, 기존 레코드를 마이그레이션하는 DB 마이그레이션 스크립트를 작성해야 합니다.

- **[INFO]** `recoverStuckExecutions`의 루프 내 개별 `save` 호출
  - 위치: `execution-engine.service.ts:recoverStuckExecutions()`
  - 상세: 서버 재시작 시 `WAITING_FOR_INPUT` 상태의 실행 건을 하나씩 `save`하는 루프가 존재합니다. 이 변경과 직접 관련은 없지만, 대량의 stuck execution이 있을 경우 N+1 문제가 됩니다. (기존 코드이므로 INFO 수준)
  - 제안: `executionRepository.save(stuck)` 배열 일괄 저장을 사용하거나, TypeORM의 `update()` 벌크 연산을 고려하세요.

- **[INFO]** form 제출 시 `outputData` 저장 형식도 structured shape으로 변경됨
  - 위치: `execution-engine.service.ts`, `updatedStructured` 생성 후 form 관련 저장 경로
  - 상세: form 노드의 `outputData` 역시 `{ config, output: { submittedData }, status: 'submitted' }` 형태로 저장됩니다. 위와 동일한 이중 형식 공존 문제가 form 실행 이력에도 적용됩니다.

---

### 요약

이번 변경의 핵심 DB 관련 위험은 `node_executions.outputData` JSON 컬럼에 저장되는 데이터 형식이 flat shape에서 `NodeHandlerOutput` structured shape으로 바뀐다는 점입니다. 컬럼 스키마 자체(DDL)는 변경되지 않으나, 컬럼 내 JSON 구조가 달라져 기존 레코드와 신규 레코드 간 형식 불일치가 발생합니다. 이 데이터를 읽는 모든 소비처가 두 형식을 모두 처리하도록 업데이트되지 않으면 조회 오류나 UI 표시 오류가 발생할 수 있으며, 데이터 마이그레이션 전략 또는 읽기 시 역호환 처리가 반드시 필요합니다. 나머지 변경(핸들러 로직, 타입 정의, 어댑터)은 DB와 직접적인 연관이 없습니다.

### 위험도
**MEDIUM**