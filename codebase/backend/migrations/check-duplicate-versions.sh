#!/bin/sh
# Flyway 마이그레이션 V번호 중복 가드 (빌드 시점 fail-fast).
#
# 동일 V번호의 .sql 이 둘 이상이면 Flyway 가 둘 다 적용하거나 한 쪽을 silent
# skip 하는 등 비결정적 동작이 가능하므로, 이미지 빌드 시점에 차단한다.
#
# 동일 검사가 다음 두 단계에서 이미 수행되지만, 본 스크립트는 그 두 단계가
# 우회된 빌드 (긴급 hotfix·로컬 직접 빌드 등) 에도 동작하는 최후 방어선:
#   - codebase/backend/src/migrations.spec.ts (유닛테스트, 매 빌드/CI)
#   - scripts/check-migration-versions.py (PR CI 가드)
#
# 정책: spec/conventions/migrations.md §6
#
# 사용:
#   check-duplicate-versions.sh [<SQL_DIR>]
#     SQL_DIR 기본값 /flyway/sql. codebase/backend/migrations/Dockerfile 의 RUN 단계에서
#     호출된다. busybox(/bin/sh) 호환 — alpine 베이스 이미지에서 동작해야 함.
set -eu

SQL_DIR="${1:-/flyway/sql}"

if [ ! -d "$SQL_DIR" ]; then
  echo "ERROR: $SQL_DIR is not a directory" >&2
  exit 1
fi

# V<숫자>__... .sql 파일에서 정수 V번호만 추출 → 정렬 → 중복 출력.
# sed 패턴은 codebase/backend/src/migrations.spec.ts 의 SQL_NAME_RE 와 동일 규약을 따른다.
dup=$(find "$SQL_DIR" -maxdepth 1 -name 'V*.sql' -type f \
      | sed -E 's#.*/V0*([0-9]+)__.*#\1#' \
      | sort -n \
      | uniq -d)

if [ -z "$dup" ]; then
  exit 0
fi

echo "ERROR: duplicate Flyway migration version(s) detected in $SQL_DIR:" >&2
for v in $dup; do
  printf '  V%03d:\n' "$v" >&2
  find "$SQL_DIR" -maxdepth 1 -name 'V*.sql' -type f | while IFS= read -r f; do
    n=$(basename "$f" | sed -E 's#^V0*([0-9]+)__.*#\1#')
    if [ "$n" = "$v" ]; then
      echo "    - $f" >&2
    fi
  done
done
echo "" >&2
echo "Policy: spec/conventions/migrations.md §6 (V번호 단조성·중복 방지)." >&2
echo "Add a new migration with a unique V<N+1> prefix instead." >&2
exit 1
