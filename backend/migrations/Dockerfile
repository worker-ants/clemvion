# Flyway-based DB migration image. Build context must be the repo root.
#   docker build -f backend/migrations/Dockerfile -t idea-workflow/migrate .
#
# Usage (k8s Job or local):
#   docker run --rm idea-workflow/migrate \
#     migrate \
#     -url=jdbc:postgresql://<host>:5432/<db> \
#     -user=<user> \
#     -password=<password> \
#     -baselineOnMigrate=true \
#     -connectRetries=10

FROM flyway/flyway:10-alpine

COPY backend/migrations/V*.sql /flyway/sql/
# 마이그레이션별 .conf (예: executeInTransaction=false) 도 함께 들어가야 비-트랜잭션
# 모드 같은 메타데이터가 적용된다. .conf 가 한 개도 없는 시점이라면 이 라인은
# 에러나므로 첫 .conf 도입 시 함께 추가하는 것이 한 쌍.
COPY backend/migrations/V*.conf /flyway/sql/

# ENTRYPOINT inherits `flyway` from the base image; default to a no-op probe.
CMD ["info"]
