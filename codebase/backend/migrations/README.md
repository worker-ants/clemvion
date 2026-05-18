# DB Migrations (Flyway)

PostgreSQL 스키마 마이그레이션은 [Flyway](https://flywaydb.org/) 네이밍 규약을 따른 순수 SQL 파일로 관리됩니다.

## 파일 네이밍

```
V<번호>__<설명>.sql
```

- `V001__initial_schema.sql`, `V002__indexes.sql`, ... 처럼 단조 증가하는 정수 번호 + 더블 언더스코어 + 설명.
- 새 마이그레이션 추가 시 마지막 번호 +1.
- **이미 적용된 파일은 절대 수정하지 않습니다.** 변경이 필요하면 새 마이그레이션 파일을 추가하세요.
- ⚠️ **alphanumeric suffix 금지** — `V035a`, `V035_1` 처럼 정수가 아닌 접미사를 붙이면 Flyway 의 기본 version 파서가 매치에 실패해 **silent skip** 됩니다 (schema_history 미등록). 한 작업을 두 트랜잭션으로 분리해야 한다면 `V035` / `V036` 처럼 별도 정수 prefix 두 파일로 작성하세요. 본 컨벤션은 `codebase/backend/src/migrations.spec.ts` 가드가 매 빌드/CI 마다 자동 검증합니다.
- ⚠️ **V번호 중복 금지** — 같은 V<N>__*.sql 이 둘 이상이면 Flyway 가 silent skip / 비결정적 적용을 할 수 있어 세 단계로 차단합니다: `codebase/backend/src/migrations.spec.ts` (유닛테스트), `scripts/check-migration-versions.py` (PR CI), `check-duplicate-versions.sh` (Docker 이미지 빌드 시점). 정책 본문: [`spec/conventions/migrations.md`](../../spec/conventions/migrations.md) §6.

## 적용 방법

전용 Docker 이미지(`codebase/backend/migrations/Dockerfile`)를 통해 적용합니다.

```bash
# 빌드 (repo 루트에서)
docker build -f codebase/backend/migrations/Dockerfile -t clemvion/migrate .

# 적용
docker run --rm clemvion/migrate \
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
docker run --rm clemvion/migrate info -url=... -user=... -password=...
```

`flyway_schema_history` 테이블에서 적용 이력을 추적합니다.

## 작성 가이드 (필수 컨벤션)

### 1. 운영 무중단 배포 — `NOT VALID` + `VALIDATE CONSTRAINT`

`ALTER TABLE ... ADD CONSTRAINT (CHECK | FOREIGN KEY)` 는 PostgreSQL 에서 기본적으로 `ACCESS EXCLUSIVE LOCK` 을 잡고 기존 행을 모두 검증합니다. 운영 트래픽이 큰 테이블에서는 수 초 ~ 수 분 동안 INSERT/UPDATE/SELECT 가 모두 멈출 수 있어 위험합니다. 신규 마이그레이션부터는 다음 두 단계 패턴을 사용하세요.

> **예외 인정 조건** — 다음 *모두* 충족 시 단일 statement 도 허용:
> - 테이블이 INSERT-only append-only (UPDATE/DELETE 거의 없음, e.g. `login_history` ≤ 1M row)
> - 신규 enum 값을 CHECK 에 추가하는 케이스처럼 기존 row 위배가 0건임이 schema 적으로 보장
> - 락 영향 평가 + DBA review 완료
>
> 위 조건이 깨지거나 의심스러우면 NOT VALID 2-step 으로 분리. Rationale 은 마이그레이션 헤더 + 관련 spec 의 Rationale 절에 함께 기록 (예: V058 → `spec/5-system/1-auth.md §1.4.G`).

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
codebase/backend/migrations/
├── V022__embedding_partial_hnsw_indexes.sql
└── V022__embedding_partial_hnsw_indexes.conf   # executeInTransaction=false
```

Dockerfile 에서 `*.conf` 도 함께 COPY 되어야 합니다 (이미 V022 도입 시 적용 완료).

> **중요 — `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false`**
>
> 마이그 이미지 (`codebase/backend/migrations/Dockerfile`) 에 `ENV FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` 가 박혀 있다. Flyway 9.1.2 부터 schema-history 추적 락이 **transactional advisory lock** (`pg_try_advisory_xact_lock`) 으로 바뀌었는데, 이 락이 잡힌 트랜잭션은 마이그레이션이 끝날 때까지 열려 있어 **transaction snapshot 이 advance 하지 않는다**. `CREATE INDEX CONCURRENTLY` 는 두 차례의 scan 사이에 *해당 백엔드의 모든 transaction snapshot 이 advance 해야* 진행되므로, 추적 트랜잭션 snapshot 에 막혀 무한 hang 한다.
>
> 이 옵션은 락을 9.0.4 이전과 동일한 **session-level** (`pg_advisory_lock`) 로 폴백시킨다. session lock 은 트랜잭션이 아니므로 snapshot 을 잡지 않고, CONCURRENTLY 가 정상 진행한다. 직접 PostgreSQL 또는 session-pool 환경에서는 안전하다.
>
> **PgBouncer transaction-pool 환경에서만** 주의 — session lock 이 statement 사이에 유실될 수 있다. 그 경우 `-e FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=true` 로 다시 켜고, 마이그레이션은 직접 PostgreSQL 또는 session-pool 로 돌려야 한다.

### 5. `executeInTransaction=false` 파일은 한 statement 만 (컨벤션)

`.conf` 로 비-트랜잭션 모드를 켠 마이그레이션 파일에는 **`CREATE INDEX CONCURRENTLY` 를 정확히 한 개만** 두는 것을 컨벤션으로 둡니다.

> **근본 원인은 §4 의 `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` 로 해결되어 있습니다.** 과거에는 같은 파일에 두 개 이상이면 두 번째부터 hang 하던 이슈 (V022 / V030 split 의 배경) 가 있었으나, transactional advisory lock 이 session lock 으로 폴백되어 더 이상 발생하지 않습니다.
>
> 그럼에도 한 파일 한 statement 컨벤션을 유지하는 이유:
> - **롤백 단위가 명확**합니다 — 파일 = atomic forward step.
> - **checksum / 적용 추적이 단순**합니다 — 차원·인덱스별 분리가 history 에 그대로 드러납니다.
> - 같은 파일에 *transactional* statement (예: `ALTER TABLE`) 와 `CONCURRENTLY` 를 섞으면 PostgreSQL 자체 제약 (CONCURRENTLY 는 트랜잭션 안에서 실행 불가) 에 걸립니다.

**규칙**:
- 한 차원당 한 마이그레이션 파일 (예: V0xx_dim_768.sql, V0yy_dim_1024.sql).
- 각 파일에 동일한 `.conf executeInTransaction=false` 동봉.
- 같은 파일 안에 *transactional* statement (예: `ALTER TABLE`) 와 `CONCURRENTLY` 를 섞지 않습니다.

**과거 적용된 V022 / V030 split 작업 (현재 repo 상태)**: V022 는 768 만, V030 은 384 만 남기고 나머지는 V031 (1536), V032 (512), V033 (1024) 로 분리되었다. 차원당 한 파일.

이미 V022 / V030 (멀티-statement 형태) 이 적용된 환경은 마이그 적용 전 **`flyway repair`** 가 필요하다 — 파일 내용이 바뀌어 checksum 이 어긋나기 때문. 같은 증상(`Migration checksum mismatch for migration version NNN`) 은 다른 버전에서도 동일하게 발생하며, 처리 절차는 동일하다.

로컬(`docker compose`) — `.env` 변수가 compose 보간으로 자동 주입됨:

```bash
# 1) checksum 보정
docker compose up migrate-repair

# 2) 정상 마이그 재개
docker compose up migrate
```

K8s/CI (이미 빌드된 이미지 사용):

```bash
# 1) 현재 적용된 마이그레이션과 새 파일 checksum 일치시키기
docker run --rm clemvion/migrate repair -url=... -user=... -password=...

# 2) 일반 마이그 실행 — V031/V032/V033 가 새로 적용됨.
#    이전 V022/V030 가 만든 인덱스가 이미 존재하므로 IF NOT EXISTS 로 no-op.
docker run --rm clemvion/migrate migrate -url=... -user=... -password=...
```

신규 환경은 `repair` 불필요 — 처음부터 split 형태로 적용된다.
