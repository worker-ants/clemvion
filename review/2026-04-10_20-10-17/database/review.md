### 발견사항

- **[WARNING]** `bulkCreate`의 중복 검사 시 Race Condition
  - 위치: `nodes.service.ts` - `bulkCreate` 메서드
  - 상세: `findByWorkflow`로 기존 노드를 조회한 뒤 `save`하는 사이에 다른 요청이 동일 레이블의 노드를 생성하면 중복이 통과될 수 있음. `assertLabelUnique`의 `findOne` + `save` 패턴도 동일한 TOCTOU(Time-of-check-time-of-use) 문제를 가짐.
  - 제안: DB 레벨에 `UNIQUE (workflow_id, label)` 제약 조건을 추가하고, ConflictException을 DB 유니크 위반 에러로도 처리하도록 보완. 서비스 레벨 검사는 UX 용도로만 사용.

- **[WARNING]** `bulkCreate`에서 기존 노드 전체 조회 후 메모리 비교
  - 위치: `nodes.service.ts` - `bulkCreate`, `findByWorkflow` 호출 부분
  - 상세: `findByWorkflow`는 해당 워크플로우의 **모든 노드**를 메모리에 로드함. 노드 수가 많아지면 불필요한 데이터 전송 발생.
  - 제안: 특정 레이블 목록이 존재하는지만 확인하는 쿼리 사용. 예: `WHERE workflow_id = $1 AND label IN ($2, $3, ...)`

- **[WARNING]** `assertLabelUnique`에서 인덱스 누락 가능성
  - 위치: `nodes.service.ts` - `assertLabelUnique`
  - 상세: `findOne({ where: { workflowId, label } })`는 `workflow_id`와 `label` 컬럼에 복합 인덱스가 없으면 풀 스캔 발생. 노드 생성/수정마다 호출되므로 성능 영향.
  - 제안: Node 엔티티에 `@Index(['workflowId', 'label'])` 추가. 유니크 제약이 추가된다면 이 인덱스는 자동 생성됨.

- **[INFO]** `update`에서 `findById` + `assertLabelUnique` 두 번의 `findOne` 호출
  - 위치: `nodes.service.ts` - `update` 메서드
  - 상세: 라벨 변경 시 `findById` → `assertLabelUnique` 순으로 2회 DB 쿼리 발생. 트랜잭션 없이 sequential 조회라 동시성 안전성이 낮음.
  - 제안: 단순 성능 이슈이므로 현재 규모에서 큰 문제는 없으나, 추후 유니크 제약 추가 시 자연스럽게 해결됨.

- **[INFO]** `bulkCreate` 내 배치 레이블 중복 검사 알고리즘 비효율
  - 위치: `nodes.service.ts` - `batchDuplicates` 계산 부분
  - 상세: `batchLabels.filter((label, i) => batchLabels.indexOf(label) !== i)`는 O(n²). 배치 크기가 수백 개 이상이면 비효율적.
  - 제안: `Set`을 활용한 O(n) 탐지로 교체.

---

### 요약

이번 변경의 핵심 DB 관련 코드는 `NodesService`의 라벨 유니크 검사 로직이다. 서비스 레벨에서의 중복 검사는 UX 피드백 용도로는 적절하나, DB 레벨의 유니크 제약 없이는 동시 요청 시 중복이 삽입될 수 있는 Race Condition이 존재한다. `(workflow_id, label)` 복합 유니크 인덱스가 스키마에 추가되지 않는 한 데이터 정합성은 보장되지 않으며, 이는 워크플로우 실행 엔진이 라벨을 키로 사용하는 이 시스템에서 잠재적으로 심각한 문제로 이어질 수 있다. 나머지 변경사항(expression resolver, frontend)은 DB와 무관하다.

### 위험도
**MEDIUM**