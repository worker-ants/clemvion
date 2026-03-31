### 발견사항

- **[WARNING]** `importWorkflow` 내 트랜잭션 중 N+1 쿼리 패턴
  - 위치: `workflows.service.ts` - `importWorkflow` 메서드
  - 상세: 노드를 하나씩 순차적으로 `manager.save(Node, node)`를 반복 호출하고, 이후 `containerId` 업데이트를 위해 다시 `manager.update()`를 노드마다 반복. 노드 수가 많을 경우 쿼리 수가 선형 증가.
  - 제안: `manager.save(Node, nodes)` 배열 일괄 저장 후 `containerId` 업데이트를 별도 배치 쿼리(`manager.createQueryBuilder().update()...whereInIds()`)로 처리하거나, `containerId`를 첫 저장 시 해결 가능한 구조로 변경.

- **[WARNING]** `getUsage` 에서 분리된 카운트 쿼리와 목록 쿼리
  - 위치: `auth-configs.service.ts` - `getUsage` 메서드
  - 상세: `totalCalls` 카운트와 `recentExecutions` 목록을 별도 쿼리로 실행. `Promise.all`로 병렬화하지 않아 직렬 실행됨.
  - 제안: 두 쿼리를 `Promise.all([countQuery, listQuery])`로 병렬 실행하여 응답 시간 절반으로 단축.

- **[WARNING]** `getHistory`에서 `e.started_at`, `e.duration_ms` 직접 컬럼명 사용
  - 위치: `triggers.service.ts` - `getHistory` 메서드
  - 상세: `select(['e.id', 'e.status', 'e.started_at', 'e.duration_ms'])`에서 스네이크케이스 컬럼명을 직접 사용. TypeORM의 엔티티 프로퍼티명(`startedAt`, `durationMs`)을 사용해야 ORM 매핑이 정상 동작하고 `getMany()` 결과에서 해당 필드가 올바르게 채워짐.
  - 제안: `select(['e.id', 'e.status', 'e.startedAt', 'e.durationMs'])`로 변경.

- **[WARNING]** `getNodeStats`의 집계 쿼리에 인덱스 누락 가능성
  - 위치: `statistics.service.ts` - `getNodeStats` 메서드
  - 상세: `node_executions` 테이블에서 `execution_id`와 `node_id`를 조인하며 `status` 필터링과 `duration_ms` 집계를 수행. `(execution_id, node_id)` 복합 인덱스 또는 `node_id` 인덱스가 없으면 풀스캔 발생 가능.
  - 제안: `node_executions.execution_id`, `node_executions.node_id`에 인덱스 존재 여부를 엔티티/마이그레이션에서 확인하고 없으면 추가.

- **[WARNING]** `dashboard.service.ts`에서 7일/14일 기간 쿼리 2회 별도 실행
  - 위치: `dashboard.service.ts` - `runs7dPrevious` 쿼리 추가 부분
  - 상세: 기존 7일 카운트 쿼리에 이전 7일 카운트 쿼리가 직렬로 추가됨. 대시보드는 페이지 로드 시 호출 빈도가 높아 성능 영향 있음.
  - 제안: 두 카운트 쿼리를 `Promise.all`로 병렬 실행하거나, 단일 쿼리로 `CASE WHEN`을 사용한 조건부 집계로 통합.

- **[INFO]** `importWorkflow` 내 `manager.save(Edge, edge)` 루프
  - 위치: `workflows.service.ts` - `importWorkflow`의 edge 생성 부분
  - 상세: 엣지도 하나씩 개별 INSERT. 트랜잭션 내이므로 정합성은 보장되나, 대량 엣지 임포트 시 성능 저하 가능.
  - 제안: `manager.save(Edge, edgesArray)` 배열 일괄 저장으로 단일 INSERT 또는 멀티로우 INSERT 사용.

- **[INFO]** `getHistory` limit 하드코딩
  - 위치: `triggers.service.ts` - `.limit(10)`
  - 상세: 컨트롤러에서 `params: { limit: "10" }`을 전달하지만 서비스에서 이를 무시하고 하드코딩된 10을 사용.
  - 제안: limit 파라미터를 서비스 메서드 인수로 수용하거나 상수로 명시적 정의.

- **[INFO]** `recentExecutions`에서 `.limit(20)` 하드코딩
  - 위치: `auth-configs.service.ts` - `getUsage`의 `recentExecutions` 쿼리
  - 상세: 응답 DTO에는 20개가 반환될 수 있으나 프론트엔드는 최근 호출만 표시. 불필요한 데이터 전송 가능성.
  - 제안: 프론트엔드 표시 수와 일치시키거나 파라미터화.

---

### 요약

전반적으로 TypeORM과 트랜잭션을 적절히 활용하고 있으며, `importWorkflow`에서 트랜잭션을 사용한 점은 올바른 설계입니다. 그러나 트랜잭션 내에서 노드와 엣지를 개별 루프로 저장하는 N+1 패턴, 병렬화 가능한 쿼리의 직렬 실행(getUsage, dashboard), 그리고 `getHistory`에서 스네이크케이스 컬럼명을 직접 사용하는 ORM 매핑 오류 가능성이 주요 관심사입니다. `node_executions` 집계 쿼리의 인덱스 전략도 서비스 규모에 따라 중요해질 수 있습니다.

### 위험도

**MEDIUM**