### 발견사항

- **[INFO]** 부분 인덱스 미사용으로 인한 인덱스 비효율
  - 위치: `V012__add_parent_node_execution_id.sql`, `CREATE INDEX idx_node_execution_parent`
  - 상세: `parent_node_execution_id`는 Sub-Workflow 자식 노드에만 값이 있고 대다수 레코드는 `NULL`입니다. PostgreSQL은 기본적으로 NULL을 인덱스에 포함하므로 전체 인덱스는 불필요하게 큽니다.
  - 제안:
    ```sql
    CREATE INDEX idx_node_execution_parent
      ON node_execution(parent_node_execution_id)
      WHERE parent_node_execution_id IS NOT NULL;
    ```

- **[INFO]** `CREATE INDEX` 실행 시 쓰기 블로킹
  - 위치: `V012__add_parent_node_execution_id.sql`, `CREATE INDEX` 라인
  - 상세: 일반 `CREATE INDEX`는 `SHARE LOCK`을 보유하며 인덱스 빌드 완료 시까지 DML을 블로킹합니다. 운영 중 마이그레이션이 실행될 경우 서비스 영향이 있을 수 있습니다.
  - 제안: `CREATE INDEX CONCURRENTLY` 사용을 검토하세요. 단, 트랜잭션 블록 내에서는 사용 불가하므로 Flyway `mixed=true` 설정이 필요합니다.

- **[INFO]** `ALTER TABLE` + FK 제약의 잠금 비용
  - 위치: `V012__add_parent_node_execution_id.sql`, `ALTER TABLE` 라인
  - 상세: `ADD COLUMN DEFAULT NULL`은 PostgreSQL 11+에서 테이블 재작성 없이 빠르게 처리되지만, `REFERENCES` 제약 포함 시 FK 유효성 검사를 위한 `SHARE ROW EXCLUSIVE` 락이 추가로 발생하고 기존 레코드가 많다면 전체 테이블 스캔이 일어날 수 있습니다.
  - 제안: 무중단 배포가 중요한 환경이라면 FK를 `NOT VALID`로 먼저 추가한 뒤 별도 단계에서 `VALIDATE CONSTRAINT`를 수행하세요.

- **[INFO]** 자기 참조 FK의 `ON DELETE SET NULL` — 고아 레코드 가능성
  - 위치: `node-execution.entity.ts`, `@ManyToOne(() => NodeExecution, { onDelete: 'SET NULL' })`
  - 상세: 부모 `NodeExecution`이 삭제될 경우 자식 레코드의 `parent_node_execution_id`가 NULL로 설정됩니다. 동일 Execution 내 부모-자식이 생명주기를 함께한다면 타임라인 UI에서 고아 레코드가 루트로 오인될 수 있습니다. `ON DELETE CASCADE`가 더 자연스러운 선택일 수 있으나, 이력 보존이 목적이라면 현재 정책도 합리적입니다. — 의도를 주석으로 명시하는 것을 권장합니다.
  - 제안: 마이그레이션 파일에 `-- ON DELETE SET NULL: 부모 삭제 시에도 자식 실행 이력 보존` 형태의 주석 추가

- **[INFO]** 대량 삭제 시 `ON DELETE SET NULL` 연쇄 UPDATE 비용
  - 위치: `V012__add_parent_node_execution_id.sql`, FK 정의
  - 상세: 오래된 실행 이력을 정리하는 배치 작업 등에서 부모 행을 대량 삭제하면 PostgreSQL이 자식 행들의 `parent_node_execution_id`를 NULL로 일괄 UPDATE합니다. lock contention이 발생할 수 있습니다.
  - 제안: 대량 삭제 시나리오가 있다면 청크 단위 삭제 전략을 검토하세요.

- **[INFO]** `createNodeExecution` 메서드에서 단순 save() 호출 — N+1 잠재 가능성 없음
  - 위치: `execution-engine.service.ts:2809`
  - 상세: 각 노드 실행마다 개별 `save()`를 호출하는 구조이지만, 이는 이미 기존 코드의 패턴이며 이번 변경으로 `parentNodeExecutionId` 필드만 추가된 것이므로 신규 N+1 문제는 없습니다.

- **[INFO]** 기존 데이터 백필 전략 미명시
  - 위치: `V012__add_parent_node_execution_id.sql` 전체
  - 상세: 기존 레코드는 `parent_node_execution_id = NULL`이 되어 자동으로 루트로 취급되므로 실용적으로는 문제없습니다. 그러나 신규 실행에만 적용됨을 주석으로 명시하면 향후 혼란을 방지할 수 있습니다.
  - 제안: `-- Applies to new executions only; existing records will have NULL (treated as root).` 주석 추가

---

### 요약

이 변경의 핵심 DB 작업은 `node_execution` 테이블에 자기 참조 FK 컬럼을 추가하는 단순한 스키마 변경으로, nullable 컬럼이므로 테이블 재작성 없이 안전하게 적용됩니다. TypeORM Entity 매핑과 서비스 레이어의 `parentNodeExecutionId` 전달 로직도 올바르게 구현되어 있습니다. 운영 환경에서 주의할 사항은 두 가지로, 첫째 `CREATE INDEX`의 쓰기 블로킹(`CONCURRENTLY` 고려), 둘째 대다수 NULL인 컬럼에 전체 인덱스 대신 부분 인덱스(`WHERE IS NOT NULL`) 적용입니다. `ON DELETE SET NULL` 정책은 이력 보존 관점에서 합리적이나 설계 의도를 주석으로 명시할 필요가 있습니다.

### 위험도

**LOW**