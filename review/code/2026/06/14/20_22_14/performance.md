# 성능(Performance) 리뷰 결과

## 발견사항

### 발견사항 1

- **[WARNING]** `assertFormSubmissionValid` 에서 form 제출마다 DB 쿼리 2회 발생 (직렬 순차)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 메서드
  - 상세: `this.nodeExecutionRepository.findOne(...)` 후 그 결과의 `nodeExec.nodeId` 를 이용해 `this.nodeRepository.findOneBy(...)` 를 순차 실행한다. 두 쿼리 사이에 데이터 의존성이 있어 병렬화는 불가능하나, NodeExecution 조회 시 `relations: { node: true }` 를 활용해 단일 JOIN 쿼리로 병합하면 왕복을 1회로 줄일 수 있다.
  - 제안: `findOne({ where: { id: nodeExecutionId }, relations: { node: true }, select: { id: true, nodeId: true, node: { id: true, config: true } } })` 형태의 단일 쿼리로 병합. 또는 이미 `resolveWaitingNodeExecutionId` 가 NodeExecution을 조회하므로 그 결과를 `assertFormSubmissionValid` 에 전달해 재조회를 제거한다.

### 발견사항 2

- **[WARNING]** 동일 form 노드에 대한 반복 제출(재제출) 시 node config 를 매번 DB에서 재로딩 (캐싱 없음)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 메서드
  - 상세: validation 실패 후 사용자가 재제출할 때마다 `extractFormFields(node.config)` 의 입력인 node config 를 DB에서 재조회한다. 워크플로우 편집 전까지 node config 는 불변이므로 불필요한 반복 I/O다. 특히 form 검증 실패 응답이 빠른 경우 재시도 루프가 짧아질 수 있다.
  - 제안: 단기 in-memory TTL 캐시(수십 초)를 노드 ID 키로 적용하거나, execution context 내 이미 로딩된 노드 정보가 있으면 재사용한다. 빈도가 낮은 운영 환경에서는 허용 가능하나 고빈도 재제출 시나리오에서는 개선이 권장된다.

### 발견사항 3

- **[INFO]** `coerceFormSubmission` 의 `Object.entries` + `JSON.stringify` — 현재 규모에서 허용 가능
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormSubmission`, `coerceFormValue` 정적 메서드
  - 상세: form 필드 수(N)에 대해 O(N) 순회이며 실용적인 form 필드 수(수십 개 이하)에서는 문제없다. 배열 요소마다 `JSON.stringify` 를 호출하나 multi-select·file 메타 처리에 한정되어 영향 미미.
  - 제안: form 필드 수에 상한(예: 50개)을 서비스 입력 검증에서 제한하면 의도적으로 필드 수를 늘린 요청에 의한 CPU 소모를 방어할 수 있다.

### 발견사항 4

- **[INFO]** `interaction.service.ts` `interact()` 의 명령 실행 후 status 재조회는 FormValidationError 경로에서 발생하지 않음 — 정상
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `interact()` 메서드
  - 상세: `FormValidationError` throw 시 `dispatchContinuation` 에서 즉시 예외가 전파되므로 하단의 `executionRepository.findOne` 재조회에 도달하지 않는다. 불필요한 추가 I/O 없음.
  - 제안: 없음 (현재 동작 정확).

### 발견사항 5

- **[INFO]** e2e 테스트 G 에서 픽스처 구성을 위한 다수의 직렬 DB INSERT
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` — 테스트 케이스 G
  - 상세: workspace, workflow, node, execution, node_execution 을 개별 INSERT 문으로 순차 삽입한다. 프로덕션 성능에는 무관하고 테스트 환경 전용이다.
  - 제안: 프로덕션 영향 없음. 테스트 속도가 누적 문제가 될 경우 트랜잭션 배치 INSERT 헬퍼 적용 고려.

## 요약

변경의 핵심인 `assertFormSubmissionValid` 는 form 제출 시 DB 쿼리를 2회 순차 발생시킨다. NodeExecution 조회 후 nodeId로 Node config를 재조회하는 구조인데, JOIN 단일 쿼리로 병합하거나 상위 흐름의 `resolveWaitingNodeExecutionId` 결과를 재사용하면 왕복 횟수를 절반으로 줄일 수 있다(WARNING). 또한 동일 form 노드에 대한 재제출 시 변경되지 않는 node config를 매번 DB에서 읽는 캐싱 부재도 잠재적 개선 포인트다(WARNING). 그 외 `coerceFormSubmission`·`coerceFormValue` 의 알고리즘 복잡도, 에러 분기 설계, 메모리 할당 패턴은 모두 적절하다. 단건 form 제출 빈도가 낮은 환경에서는 현재 구현이 실용적으로 충분하나, 고빈도 재제출 시나리오에서는 쿼리 병합과 node config 캐싱 개선이 권장된다.

## 위험도

LOW
