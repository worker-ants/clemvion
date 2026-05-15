### 발견사항

- **[INFO]** `ALTER TABLE` 실행 시 잠금(Lock) 고려 필요
  - 위치: `ALTER TABLE node_execution ADD COLUMN ...`
  - 상세: PostgreSQL의 `ADD COLUMN ... DEFAULT NULL`은 테이블 재작성 없이 빠르게 수행되지만, `ACCESS EXCLUSIVE LOCK`을 획득합니다. `node_execution` 테이블이 고빈도 쓰기 테이블이라면 마이그레이션 중 쓰기 지연이 발생할 수 있습니다. 단, NULL 허용 컬럼이므로 PostgreSQL 11+에서는 실제 행 재작성이 발생하지 않아 영향은 짧습니다.
  - 제안: 배포 시 낮은 트래픽 시간대에 적용하거나, `lock_timeout`을 설정하여 장기 락 점유를 방지하세요. (`SET lock_timeout = '2s';`)

- **[INFO]** `CREATE INDEX` 동시성 고려
  - 위치: `CREATE INDEX idx_node_execution_parent ON node_execution(parent_node_execution_id)`
  - 상세: 일반 `CREATE INDEX`는 `SHARE LOCK`을 보유하며 인덱스 빌드 완료 시까지 쓰기를 블로킹합니다. 테이블 데이터가 많은 경우 서비스 영향이 커질 수 있습니다.
  - 제안: `CREATE INDEX CONCURRENTLY`를 사용하여 쓰기 블로킹 없이 인덱스를 생성하세요. 단, 트랜잭션 블록 내에서는 사용할 수 없으므로 마이그레이션 툴 설정을 확인해야 합니다. (Flyway: `mixed=true`)

- **[INFO]** 셀프 조인 쿼리 패턴에서의 성능
  - 위치: `REFERENCES node_execution(id)` (자기 참조 외래키)
  - 상세: 타임라인 트리를 재구성할 때 재귀 CTE(`WITH RECURSIVE`)를 사용하게 되면, 깊이가 깊은 서브워크플로우 중첩 시 성능이 선형 이상으로 증가할 수 있습니다. 현재 인덱스(`parent_node_execution_id`)는 자식 → 부모 방향의 조회를 지원하지만, 특정 execution_id 하위의 모든 자식을 조회하는 패턴에는 적합합니다.
  - 제안: 조회 패턴이 "특정 execution의 전체 트리"라면 인덱스 설계는 현재로 충분합니다. 만약 depth가 3단계 이상으로 중첩될 가능성이 있다면 `ltree` 확장이나 클로저 테이블 패턴을 장기적으로 고려하세요.

- **[INFO]** `ON DELETE SET NULL` FK 트리거 비용
  - 위치: `REFERENCES node_execution(id) ON DELETE SET NULL`
  - 상세: 부모 행 삭제 시 PostgreSQL은 자식 행들의 `parent_node_execution_id`를 NULL로 업데이트하는 작업을 수행합니다. execution 삭제가 bulk로 발생하는 경우(예: 오래된 실행 이력 정리) 해당 FK 처리 비용이 누적될 수 있습니다.
  - 제안: 대량 삭제 시나리오가 예상된다면 배치 삭제 전 일시적으로 FK 제약을 비활성화하거나, 삭제 쿼리를 청크 단위로 분리하는 전략을 검토하세요.

---

### 요약

이 마이그레이션은 NULL 허용 컬럼 추가와 단순 인덱스 생성으로 구성되어 있어 성능 위험이 전반적으로 낮습니다. 주요 관심사는 마이그레이션 실행 시점의 락 영향이며, `CREATE INDEX CONCURRENTLY` 전환이 가장 실질적인 개선 포인트입니다. 인덱스 설계는 현재 조회 패턴(부모 기준 자식 그룹핑)에 적합하고, 자기 참조 FK 구조도 적절하나 서브워크플로우 중첩 깊이가 깊어질 경우 재귀 쿼리 성능을 모니터링할 필요가 있습니다.

### 위험도

**LOW**