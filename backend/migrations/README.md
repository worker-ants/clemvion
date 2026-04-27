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
