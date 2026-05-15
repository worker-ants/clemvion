### 발견사항

---

**[WARNING] V043 마이그레이션: `CREATE UNIQUE INDEX` 비동시성 — 쓰기 블로킹**
- 위치: `V043__cafe24_install_token_index.sql:18`
- 상세: PostgreSQL의 `CREATE INDEX`(비 CONCURRENT)는 `ShareLock`을 획득해 인덱스 빌드 완료 전까지 `INSERT`/`UPDATE`/`DELETE`를 블로킹한다. `integration` 테이블이 운영 트래픽을 받는 중이라면 무중단 배포 원칙에 위배된다. `CREATE INDEX CONCURRENTLY`가 안전하나, Flyway는 기본적으로 마이그레이션을 트랜잭션으로 감싸기 때문에 CONCURRENT 사용 시 `-- flyway:executeInTransaction=false` 어노테이션 또는 Flyway 설정 `outOfOrder` 처리가 필요하다.
- 제안:
  ```sql
  -- flyway:executeInTransaction=false
  CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_install_token
    ON integration (install_token)
    WHERE install_token IS NOT NULL;
  ```

---

**[WARNING] `expirePendingInstalls`: TypeORM `save(array)` N+1 UPDATE**
- 위치: `integration-expiry-scanner.service.ts:94`
- 상세: TypeORM의 `repository.save(entities[])` 는 내부적으로 각 엔터티를 개별 `UPDATE` 구문으로 실행한다. `pending_install` 행이 다수일 경우(예: 서버 장애 후 복구 시) N개의 쿼리가 직렬 실행된다. 단일 bulk UPDATE가 훨씬 효율적이다.
- 제안:
  ```typescript
  await this.integrationRepository
    .createQueryBuilder()
    .update()
    .set({ status: 'expired', statusReason: 'install_timeout', installToken: null })
    .where('status = :s AND created_at < :cutoff', { s: 'pending_install', cutoff })
    .execute();
  ```
  이렇게 하면 `find` → loop → `save` 3단계가 단일 쿼리로 압축되고, 트랜잭션 경계 문제도 사라진다.

---

**[WARNING] `expirePendingInstalls`: find→mutate→save 비원자적 패턴**
- 위치: `integration-expiry-scanner.service.ts:83-97`
- 상세: `find`와 `save` 사이에 다른 프로세스(재배포, 스케일아웃 인스턴스)가 동일 행을 수정할 수 있다. 트랜잭션 없이 READ → WRITE를 수행하면 스캐너 두 인스턴스가 동시에 실행될 경우 같은 행을 중복 처리한다. 위 bulk UPDATE 제안을 사용하면 이 문제도 함께 해소된다.

---

**[WARNING] `createPrivatePendingIntegration`: TOCTOU 경쟁 조건 (연속 읽기-쓰기)**
- 위치: `integration-oauth.service.ts:762-822`
- 상세: `find` → 중복 체크 → `save` 사이에 동일 workspace+mall_id로 두 요청이 동시에 진입하면 두 `pending_install` 행이 생성될 수 있다. plan 문서에도 `advisory lock` 또는 DB 레벨 partial UNIQUE 인덱스 검토가 명시되어 있으나 현재 구현에 반영되지 않았다. `install_token`의 UNIQUE 인덱스(V043)는 `pending_install` 중복을 막지 않는다(서로 다른 token이 발급되므로).
- 제안: `pg_advisory_xact_lock(hashtext(workspaceId || mallId))`를 트랜잭션 시작 시 획득하거나, `mall_id`를 평문 컬럼으로 분리 후 partial UNIQUE 인덱스를 추가하는 방안 중 하나를 선택.

---

**[INFO] `expirePendingInstalls`: `(status, created_at)` 복합 인덱스 부재 가능성**
- 위치: `integration-expiry-scanner.service.ts:84-88`
- 상세: `WHERE status = 'pending_install' AND created_at < $cutoff` 쿼리에 맞는 복합 인덱스가 없다면 `integration` 테이블 전체 스캔이 발생한다. 스캐너는 일 1회 실행이라 일반적으로 허용 범위지만, 테이블이 수십만 건 이상이면 문제가 될 수 있다.
- 제안: `integration` 테이블에 `CREATE INDEX ON integration (status, created_at) WHERE status = 'pending_install'` partial 인덱스 추가 검토.

---

**[INFO] `createPrivatePendingIntegration`: in-memory mall_id 필터링**
- 위치: `integration-oauth.service.ts:762-775`
- 상세: 코드 주석에서 "typical bound: <10" 을 전제로 workspace 내 cafe24 행 전체를 로드 후 in-memory 필터링한다. 이 전제가 유지되는 한 문제없으나, workspace당 cafe24 통합 수가 증가하면 복호화 비용이 선형으로 증가한다.

---

### 요약

가장 즉각적인 위험은 **V043 마이그레이션의 비동시 인덱스 생성**으로, 운영 테이블에 쓰기 락이 걸려 배포 중 짧은 다운타임이 발생할 수 있다. 그 외 `expirePendingInstalls`의 N+1 save 패턴과 비원자 find-save 구간이 스케일아웃 환경에서 잠재적 중복 처리를 유발한다. `createPrivatePendingIntegration`의 TOCTOU 경쟁 조건은 plan에서 이미 인지하고 있으나 현 구현에 보호 장치가 없다. `install_token` partial unique 인덱스 설계 자체(NULL 허용, 부분 인덱스)는 올바르고, findOne 단일 row 조회도 해당 인덱스를 활용할 수 있어 기능적으로는 건전하다.

### 위험도
**MEDIUM**