# Flyway-based DB migration image. Build context must be the repo root.
#   docker build -f codebase/backend/migrations/Dockerfile -t clemvion/migrate .
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

COPY codebase/backend/migrations/V*.sql /flyway/sql/
# 마이그레이션별 .conf (예: executeInTransaction=false) 도 함께 들어가야 비-트랜잭션
# 모드 같은 메타데이터가 적용된다. .conf 가 한 개도 없는 시점이라면 이 라인은
# 에러나므로 첫 .conf 도입 시 함께 추가하는 것이 한 쌍.
COPY codebase/backend/migrations/V*.conf /flyway/sql/

# V번호 중복 가드 — 빌드 시점 fail-fast.
# 동일 V번호 .sql 이 둘 이상이면 Flyway 가 silent skip / 비결정적 적용을 할 수
# 있어, 이미지 빌드 자체를 실패시켜 운영 도달을 막는다. 동일 검사가
# codebase/backend/src/migrations.spec.ts 와 scripts/check-migration-versions.py 에도
# 있으나, 그 두 단계가 우회된 빌드 (긴급 hotfix·로컬 직접 빌드 등) 에 대한
# 최후 방어선. 정책 본문: spec/conventions/migrations.md §6
COPY codebase/backend/migrations/check-duplicate-versions.sh /usr/local/bin/check-duplicate-versions.sh
RUN chmod +x /usr/local/bin/check-duplicate-versions.sh \
 && /usr/local/bin/check-duplicate-versions.sh /flyway/sql

# ENTRYPOINT inherits `flyway` from the base image; default to a no-op probe.
CMD ["info"]
