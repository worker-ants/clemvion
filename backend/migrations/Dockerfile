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

# ENTRYPOINT inherits `flyway` from the base image; default to a no-op probe.
CMD ["info"]
