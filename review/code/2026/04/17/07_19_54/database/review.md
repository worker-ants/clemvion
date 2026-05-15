### 발견사항

- **[WARNING]** `appendExecutionPath`의 N+1 읽기 패턴
  - 위치: `execution-engine.service.ts` — `appendExecutionPath` 메서드
  - 상세: 병렬 브랜치 내 각 노드 완료 시 `findOneBy({ id: executionId })` → `save()` 사이클이 개별 실행됨. 브랜치 2개 × 노드 5개 = 10회의 개별 SELECT+UPDATE 발생. 단순히 직렬화 체인으로 순서를 보장하지만, DB 왕복 횟수는 절감하지 못함.
  - 제안: PostgreSQL이라면 `UPDATE execution SET execution_path = array_append(execution_path, $1) WHERE id = $2`, MySQL이라면 `JSON_ARRAY_APPEND` 계열 atomic update를 사용해 read-modify-write 사이클 자체를 제거.

- **[WARNING]** 분산 배포 환경에서 `executionPath` 비원자적 갱신
  - 위치: `execution-engine.service.ts` — `appendExecutionPath`, `executionPathChain` Map
  - 상세: 인메모리 Promise 체인은 단일 프로세스 내에서만 직렬화를 보장. 백엔드 인스턴스가 2개 이상 실행 중이거나 프로세스가 재시작되면 동일 `executionId`에 대한 read-modify-write 경쟁이 발생해 노드 ID가 유실될 수 있음. 현재 수평 확장 시나리오에서 데이터 정합성 보장 없음.
  - 제안: DB 레벨 atomic 배열/JSON append 쿼리로 교체하거나, 락이 필요한 경우 SELECT FOR UPDATE 트랜잭션으로 감쌀 것.

- **[INFO]** `nodeExecutionRepository.findOne` — 복합 인덱스 확인 필요
  - 위치: `execution-engine.service.ts` — `runParallel` 메서드 내 `findOne({ where: { executionId, nodeId }, order: { startedAt: 'DESC' } })`
  - 상세: `executionId + nodeId` 필터 후 `startedAt DESC` 정렬은 `(executionId, nodeId, startedAt)` 복합 인덱스가 없으면 node_execution 테이블 전체 스캔 또는 filesort 발생 가능.
  - 제안: `node_execution` 엔티티에 `@Index(['executionId', 'nodeId', 'startedAt'])` 인덱스 존재 여부 확인 및 미비 시 추가.

---

### 요약

변경의 핵심은 병렬 브랜치 완료 시 `executionPath` 갱신을 인메모리 Promise 체인으로 직렬화한 것으로, 단일 인스턴스에서의 경쟁 조건은 해결하나 DB 레벨 원자성은 미보장 상태임. 노드당 개별 read-modify-write 사이클이 반복되는 N+1 패턴과 분산 배포 시 정합성 위험이 잠재되어 있으며, `nodeExecutionRepository.findOne`의 정렬 쿼리에 복합 인덱스 누락 가능성도 있어 전반적으로 단일 인스턴스 운영에서는 안전하나 스케일 아웃 시 위험도가 높아지는 구조임.

### 위험도
**MEDIUM**