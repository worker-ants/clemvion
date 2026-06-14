### 발견사항

- **[WARNING]** `assertFormSubmissionValid` — DB 쿼리 2회 순차 발생
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 메서드 (`nodeExecutionRepository.findOne` + `nodeRepository.findOneBy` 순차 호출)
  - 상세: `submit_form` 제출마다 `nodeExecutionRepository.findOne({ where: { id: nodeExecutionId } })` 후 결과의 `nodeId`로 `nodeRepository.findOneBy({ id: nodeExec.nodeId })` 를 순차 호출한다. 두 번의 DB 왕복이 직렬로 발생하며, 상위 `continueExecution` 흐름에서 이미 `resolveWaitingNodeExecutionId`로 `node_execution` row 를 조회했을 가능성이 높아 중복 조회일 수 있다. `findOne({ relations: { node: true }, select: { id: true, nodeId: true, node: { id: true, config: true } } })` 단일 JOIN 쿼리로 병합하면 왕복 1회를 절감할 수 있다. 재제출 가능 설계(`waiting_for_input` 유지) 때문에 동일 경로가 반복 호출될 수 있어 개선 효과가 누적된다.
  - 제안: `nodeExecutionRepository.findOne({ where: { id: nodeExecutionId }, relations: { node: true }, select: { id: true, nodeId: true, node: { id: true, config: true } } })` 단일 쿼리로 통합하거나, 상위 흐름에서 이미 로드된 `nodeId` 를 파라미터로 전달해 두 번째 조회를 제거한다. 이미 RESOLUTION.md W-11 에서 DEFERRED-BACKLOG 로 추적 중이므로 별도 태스크로 처리 예정임을 확인.

- **[INFO]** `node.config` 재제출 시 캐싱 부재
  - 위치: `execution-engine.service.ts` — `assertFormSubmissionValid` 내 `nodeRepository.findOneBy`
  - 상세: 검증 실패 후 재제출이 가능한 설계(`waiting_for_input` 유지)이므로 동일 `nodeId`에 대해 `config` 를 반복 로딩한다. node config 는 실행 중 변경되지 않으므로 단기 in-memory TTL 캐시(실행 단위 스코프) 또는 기 로딩 node 정보 재사용 시 재제출 폭주 시나리오에서 I/O 절감 가능하다. 현재 규모에서 심각하지 않으나 고빈도 재제출 경로에서 잠재적 낭비가 존재한다.
  - 제안: 중장기 태스크로 단기 TTL 캐시 또는 실행 컨텍스트에 node 정보 보관을 검토한다. 즉각 수정 필요 수준은 아니다.

- **[INFO]** `coerceFormSubmission` — 필드 수 상한 부재로 최악 케이스 미bound
  - 위치: `execution-engine.service.ts` — `coerceFormSubmission` 정적 메서드
  - 상세: form 필드 수 n에 대해 O(n) 객체 순회 및 각 값에 대한 `JSON.stringify` 를 수행한다. form 필드 수에 상한이 없다면 비정상적으로 큰 payload 에서 CPU 소모가 증가할 수 있다. 실제 form 필드 수는 통상 소규모이므로 현재 규모에서 허용 가능하다.
  - 제안: form 필드 수 상한(예: 50개)을 입력 검증 레이어에서 강제하면 `coerceFormSubmission` 의 최악 케이스 복잡도를 O(50) 상수로 bound 할 수 있다.

- **[INFO]** `toHttpDetails()` 매번 새 배열 생성
  - 위치: `workflow-errors.ts` — `FormValidationError.toHttpDetails()`
  - 상세: 호출마다 `[{ field, message, code }]` 새 배열 리터럴을 생성한다. 에러 객체 생성 빈도가 낮고 배열 크기가 1로 고정이므로 실질 영향은 무시할 수준이다.
  - 제안: 현행 유지. 호출 빈도와 배열 크기 기준으로 최적화 필요 없음.

### 요약

이번 변경의 핵심 성능 우려는 `assertFormSubmissionValid` 내 DB 조회 2회 순차 발생(WARNING)이다. `submit_form` 마다 `node_execution` 조회 후 `node` 를 별도로 재조회하는 2-hop 패턴이 발생하며, JOIN 단일 쿼리 또는 상위 흐름의 `nodeId` 파라미터 전달로 해소 가능하다. 재제출 가능 설계로 인한 node config 반복 로딩(INFO)은 고빈도 재제출 시나리오에서 잠재적이지만 현재 규모에서는 허용 가능하다. `coerceFormSubmission`의 O(n) 변환과 `toHttpDetails()`의 배열 생성은 실질 영향이 없다. 전체적으로 심각한 성능 병목은 없으며, DB 쿼리 최적화 항목 하나가 이미 DEFERRED-BACKLOG(W-11)로 추적 중이다.

### 위험도

LOW
