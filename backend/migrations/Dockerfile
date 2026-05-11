# Flyway-based DB migration image. Build context must be the repo root.
#   docker build -f backend/migrations/Dockerfile -t clemvion/migrate .
#
# Usage (k8s Job or local):
#   docker run --rm clemvion/migrate \
#     migrate \
#     -url=jdbc:postgresql://<host>:5432/<db> \
#     -user=<user> \
#     -password=<password> \
#     -baselineOnMigrate=true \
#     -connectRetries=10

FROM flyway/flyway:10-alpine

# Flyway 9.1.2+ 의 schema-history 추적 락은 transactional advisory lock
# (pg_try_advisory_xact_lock) 이라, 락이 잡힌 트랜잭션의 snapshot 이 advance
# 하지 않아 CREATE INDEX CONCURRENTLY 가 무한 hang 한다. session-level lock
# (pg_advisory_lock) 으로 폴백시켜 근본 원인을 제거한다.
# PgBouncer transaction-pool 환경에서 마이그레이션을 돌릴 경우만
# `-e FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=true` 로 다시 켜고 직접/세션 풀
# 을 사용한다. (README §4 참고)
ENV FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false

COPY backend/migrations/V*.sql /flyway/sql/
# 마이그레이션별 .conf (예: executeInTransaction=false) 도 함께 들어가야 비-트랜잭션
# 모드 같은 메타데이터가 적용된다. .conf 가 한 개도 없는 시점이라면 이 라인은
# 에러나므로 첫 .conf 도입 시 함께 추가하는 것이 한 쌍.
COPY backend/migrations/V*.conf /flyway/sql/

# ENTRYPOINT inherits `flyway` from the base image; default to a no-op probe.
CMD ["info"]
