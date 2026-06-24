# 데이터베이스(Database) 리뷰 결과

## 발견사항

### **[WARNING]** `node_execution` 테이블에 `(execution_id, status)` 복합 인덱스 누락

- **위치**: `/codebase/backend/src/modules/external-interaction/interaction.service.ts` — `getStatus()` 메서드 내 `nodeExecutionRepository.findOne(...)` 쿼리 (신규 추가 블록)
- **상세**: 신규 쿼리는 `WHERE execution_id = $1 AND status = 'waiting_for_input' ORDER BY started_at DESC` 조건으로 `node_execution` 테이블을 조회한다. 현재 `node-execution.entity.ts`에 정의된 인덱스를 확인하면, `execution_id` 컬럼 자체에는 외래키 JoinColumn으로 인해 단일 인덱스가 생성되지만, `(execution_id, status)` 복합 인덱스는 선언되어 있지 않다. `node_execution` 테이블은 실행마다 수십~수백 행이 누적될 수 있으므로, `execution_id` 단일 인덱스만으로 status 필터 후 정렬까지 처리하면 불필요한 행 스캔이 발생한다. `getStatus`는 위젯 복구 경로(race 해소용 시드)에서 호출되므로 동시 접속이 많을 경우 누적 부하가 될 수 있다.
- **제안**: `node-execution.entity.ts`의 `@Entity` 데코레이터에 `@Index(['executionId', 'status'])` 복합 인덱스를 추가하거나, 최소한 `(execution_id, status, started_at)` 커버링 인덱스를 마이그레이션으로 추가하여 인덱스 스캔만으로 정렬·필터를 처리할 수 있게 한다.

  ```typescript
  // node-execution.entity.ts
  @Index(['executionId', 'status'])
  @Entity('node_execution')
  export class NodeExecution { ... }
  ```

---

### **[INFO]** `relations: ['node']` — 불필요한 JOIN 발생 가능성 (조건부 사용)

- **위치**: `interaction.service.ts` `getStatus()` — `nodeExecutionRepository.findOne({ relations: ['node'] })`
- **상세**: `node` 관계는 `nodeExec.node.type` 참조를 위해 eager-load된다. Node 엔티티가 추가 jsonb 컬럼(definition 등)을 포함할 경우 불필요한 데이터 전송이 발생한다. 현재 코드에서 사용하는 필드는 `node.type` 하나뿐이다.
- **제안**: `select` 옵션으로 필요한 컬럼만 지정하거나, `node` 엔티티에서 `type` 만 SELECT 하도록 QueryBuilder로 전환하는 것을 검토한다. 단, `node_execution` 행 자체의 크기가 크지 않다면 실질적 영향은 낮다.

---

## 요약

이번 변경에서 DB 관련 신규 쿼리는 `getStatus()`에서 `NodeExecution` 레포지토리를 주입받아 `waiting_for_input` 상태의 노드 실행을 단건 조회(`findOne`)하는 것이 전부다. 스키마 변경(마이그레이션)·트랜잭션·N+1·SQL 인젝션·커넥션 관리·대량 페이지네이션 관점에서는 문제가 없다. 단, `WHERE execution_id = $1 AND status = $2 ORDER BY started_at DESC` 패턴에 대응하는 `(execution_id, status)` 복합 인덱스가 엔티티 정의에 없어, 실행당 행이 많아질 경우 쿼리 성능이 저하될 수 있다. 운영 트래픽이 낮은 단계에서는 즉각적 장애를 유발하지 않지만, 인덱스 추가 마이그레이션을 권장한다.

## 위험도

MEDIUM
