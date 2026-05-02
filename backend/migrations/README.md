# DB Migrations (Flyway)

PostgreSQL 스키마 마이그레이션은 [Flyway](https://flywaydb.org/) 네이밍 규약을 따른 순수 SQL 파일로 관리됩니다.

## 파일 네이밍

```
V<번호>__<설명>.sql
```

- `V001__initial_schema.sql`, `V002__indexes.sql`, ... 처럼 단조 증가하는 정수 번호 + 더블 언더스코어 + 설명.
- 새 마이그레이션 추가 시 마지막 번호 +1.
- **이미 적용된 파일은 절대 수정하지 않습니다.** 변경이 필요하면 새 마이그레이션 파일을 추가하세요.

## 적용 방법

전용 Docker 이미지(`backend/migrations/Dockerfile`)를 통해 적용합니다.

```bash
# 빌드 (repo 루트에서)
docker build -f backend/migrations/Dockerfile -t idea-workflow/migrate .

# 적용
docker run --rm idea-workflow/migrate \
  migrate \
  -url=jdbc:postgresql://<host>:5432/<db> \
  -user=<user> \
  -password=<password> \
  -baselineOnMigrate=true \
  -connectRetries=10
```

Kubernetes에서는 동일 이미지를 Job(또는 Deployment의 init container)으로 실행해 backend Pod 기동 전에 스키마를 적용합니다.

## 현재 상태 확인

```bash
docker run --rm idea-workflow/migrate info -url=... -user=... -password=...
```

`flyway_schema_history` 테이블에서 적용 이력을 추적합니다.

## 작성 가이드 (필수 컨벤션)

### 1. 운영 무중단 배포 — `NOT VALID` + `VALIDATE CONSTRAINT`

`ALTER TABLE ... ADD CONSTRAINT (CHECK | FOREIGN KEY)` 는 PostgreSQL 에서 기본적으로 `ACCESS EXCLUSIVE LOCK` 을 잡고 기존 행을 모두 검증합니다. 운영 트래픽이 큰 테이블에서는 수 초 ~ 수 분 동안 INSERT/UPDATE/SELECT 가 모두 멈출 수 있어 위험합니다. 신규 마이그레이션부터는 다음 두 단계 패턴을 사용하세요.

```sql
-- 1) NOT VALID 로 추가 — 신규 row 만 검증, 기존 row 는 미검증 (락 짧음)
ALTER TABLE document
  ADD CONSTRAINT chk_doc_graph_extraction_status
    CHECK (graph_extraction_status IS NULL
           OR graph_extraction_status IN ('pending','processing','completed','error'))
  NOT VALID;

-- 2) 별도 마이그레이션 또는 같은 파일에서 VALIDATE — SHARE UPDATE EXCLUSIVE 만 잡고
--    기존 row 를 백그라운드에서 검증 (DML 영향 적음)
ALTER TABLE document
  VALIDATE CONSTRAINT chk_doc_graph_extraction_status;
```

`UNIQUE` 제약은 `CREATE UNIQUE INDEX CONCURRENTLY` 후 `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE USING INDEX` 패턴을 사용합니다. 마이그레이션 파일에 `CREATE INDEX CONCURRENTLY` 가 들어가면 Flyway 가 트랜잭션 모드에서 실행하지 못하므로 동봉된 `.conf` 파일에 `executeInTransaction=false` 를 설정하세요 (V022 / V023 / V026 참고).

### 2. 롤백 절차 주석 (`-- DOWN:`)

마이그레이션은 forward-only 가 원칙이지만, 운영 사고 시 빠르게 되돌릴 수 있도록 파일 하단에 롤백 SQL 을 주석으로 남깁니다.

```sql
-- V0xx: ...
ALTER TABLE foo ADD COLUMN bar INTEGER;
CREATE INDEX idx_foo_bar ON foo(bar);

-- DOWN:
-- DROP INDEX IF EXISTS idx_foo_bar;
-- ALTER TABLE foo DROP COLUMN IF EXISTS bar;
```

복원이 데이터 손실을 동반하면(예: 컬럼/테이블 DROP) 이를 명시:

```sql
-- DOWN: (DESTRUCTIVE — 데이터 손실 동반)
-- DROP TABLE foo;
```

### 3. PostgreSQL extension 의존성

`pgvector` (V005, V022, V023), `pg_trgm` (V028) 처럼 extension 에 의존하는 마이그레이션은 파일 상단에 의존 버전을 명시합니다.

```sql
-- requires pgvector >= 0.7 (halfvec)
```

운영 환경에 extension 이 미리 설치되어 있어야 마이그레이션이 통과합니다. K8s / Docker 이미지에 `postgres-15-pgvector` 같이 extension 포함 이미지를 사용하거나, DBA 가 `CREATE EXTENSION` 을 사전 실행하세요.

### 4. 비-트랜잭션 모드 (`.conf`)

`CREATE INDEX CONCURRENTLY` / `REINDEX CONCURRENTLY` 등 트랜잭션 안에서 실행할 수 없는 명령은 동일 이름의 `.conf` 파일을 같이 추가합니다.

```
backend/migrations/
├── V022__embedding_partial_hnsw_indexes.sql
└── V022__embedding_partial_hnsw_indexes.conf   # executeInTransaction=false
```

Dockerfile 에서 `*.conf` 도 함께 COPY 되어야 합니다 (이미 V022 도입 시 적용 완료).

### 5. ⚠️ `executeInTransaction=false` 파일은 한 statement 만

`.conf` 로 비-트랜잭션 모드를 켠 마이그레이션 파일에는 **`CREATE INDEX CONCURRENTLY` 를 정확히 한 개만** 둡니다. 두 개 이상이면 k8s job 이 2번째 statement 부터 무한 hang 합니다.

**원인** — Flyway 는 마이그레이션 한 건이 진행되는 동안 별도 connection 으로 `flyway_schema_history` 추적 (advisory lock + 진행 기록) 을 유지합니다. 이 추적 세션에는 implicit snapshot 이 잡혀 있고, `CREATE INDEX CONCURRENTLY` 는 시작·종료 시점에 *같은 백엔드의 모든 transaction snapshot 이 advance 해야* 진행할 수 있는데, 추적 세션 snapshot 이 그 조건을 막아 무한 대기로 들어갑니다. 첫 statement 가 끝나도 추적 세션 snapshot 이 새로 잡히면서 두 번째도 다시 막힙니다. job 을 재시작하면 추적 세션이 리셋되어 한 statement 씩만 advance 합니다 (V022 → 2 restart, V030 → 3 restart 의 정확한 양상).

빈 테이블이라 SQL 자체는 instant 인데도 hang 으로 보이는 이유. backend pod 를 scale=0 으로 내려도 풀리지 않습니다 — Flyway 자기 자신의 추적 세션이 원인이라.

**규칙**:
- 한 차원당 한 마이그레이션 파일 (예: V0xx_dim_768.sql, V0yy_dim_1024.sql).
- 각 파일에 동일한 `.conf executeInTransaction=false` 동봉.
- 같은 파일 안에 *transactional* statement (예: `ALTER TABLE`) 와 `CONCURRENTLY` 를 섞지 않습니다.

**과거 적용된 V022 / V030 split 작업 (현재 repo 상태)**: V022 는 768 만, V030 은 384 만 남기고 나머지는 V031 (1536), V032 (512), V033 (1024) 로 분리되었다. 차원당 한 파일.

이미 V022 / V030 (멀티-statement 형태) 이 적용된 환경은 마이그 적용 전 **`flyway repair`** 가 필요하다 — 파일 내용이 바뀌어 checksum 이 어긋나기 때문. 절차:

```bash
# 1) 현재 적용된 마이그레이션과 새 파일 checksum 일치시키기
docker run --rm idea-workflow/migrate repair -url=... -user=... -password=...

# 2) 일반 마이그 실행 — V031/V032/V033 가 새로 적용됨.
#    이전 V022/V030 가 만든 인덱스가 이미 존재하므로 IF NOT EXISTS 로 no-op.
docker run --rm idea-workflow/migrate migrate -url=... -user=... -password=...
```

신규 환경은 `repair` 불필요 — 처음부터 split 형태로 적용된다.
