# 보안(Security) 코드 리뷰

## 검토 범위

이 PR 은 워크플로/캔버스 삭제 연쇄에서 부모 삭제 시 FK 트리거가 자식 테이블을 전부 훑는 문제를 해결하기 위해
FK 컬럼 다섯 개에 `CREATE INDEX CONCURRENTLY` 로 인덱스를 추가하는 순수 DB 성능(DDL) 변경이다.

- `codebase/backend/migrations/V112~V116__*.{sql,conf}` (5쌍, 신규) — `node_execution(node_id)`,
  `integration_usage_log(node_execution_id)`, `integration_usage_log(workflow_id)`,
  `llm_usage_log(node_execution_id) WHERE … IS NOT NULL`, `llm_usage_log(execution_id) WHERE … IS NOT NULL`
- `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (신규) — `pg_index`/`pg_class` 대조 e2e
- `spec/1-data-model.md`, `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md` — 문서 반영
- `plan/in-progress/*.md`, `review/consistency/2026/09/18/{13_44_08,13_55_55}/**` — plan/consistency 산출물(문서, 비-실행 코드)

애플리케이션 코드(컨트롤러/서비스/엔티티) 변경은 없다. 인증/인가·API 계약·사용자 입력 처리 경로는 이 PR 의 대상이 아니다.

## 발견사항

- **[INFO]** 신규 마이그레이션 SQL 은 전부 정적 리터럴 DDL이라 인젝션 표면이 없다
  - 위치: `codebase/backend/migrations/V112__node_execution_node_id_index.sql:24-26`,
    `V113__integration_usage_log_node_execution_id_index.sql:22-24`,
    `V114__integration_usage_log_workflow_id_index.sql:21-23`,
    `V115__llm_usage_log_node_execution_id_index.sql:24-27`,
    `V116__llm_usage_log_execution_id_index.sql:22-25`
  - 상세: `DROP INDEX CONCURRENTLY IF EXISTS <고정 이름>` / `CREATE INDEX CONCURRENTLY IF NOT EXISTS <고정 이름> ON <고정 테이블> (<고정 컬럼>) [WHERE <고정 조건>]` 형태로, 사용자 입력이나 외부 변수가 문자열로 조립되는 지점이 전혀 없다. Flyway 파일명(`V112`~`V116`)·인덱스명 모두 리포지토리 전수 grep 0건으로 기존 식별자와 충돌하지 않음이 이미 확인돼 있다(선행 consistency-check 산출물). 문제 없음, 참고용 기록.

- **[INFO]** e2e 검증 쿼리는 파라미터 바인딩을 사용해 SQL 인젝션 표면이 없다
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` — `it.each` 블록 내 `db.query<...>(..., [name])` 호출부 (함수: `describe('삭제 연쇄의 FK 인덱스 (e2e, V112~V116)', ...)`)
  - 상세: 인덱스 이름을 `$1` 플레이스홀더로 바인딩하고, `EXPECTED` 배열은 파일 내 상수 리터럴이라 테스트 입력이 외부에서 주입될 경로가 없다. 정상적인 파라미터화 쿼리 패턴.

- **[INFO]** 비-트랜잭션 마이그레이션(`executeInTransaction=false`) + `CONCURRENTLY` 조합은 가용성 관점의 운영 위험이지 보안 취약점은 아니다
  - 위치: `codebase/backend/migrations/V112__node_execution_node_id_index.conf` 등 5개 `.conf` 파일, 각 `.sql` 파일 헤더 주석
  - 상세: `CREATE/DROP INDEX CONCURRENTLY` 는 트랜잭션 블록 안에서 실행할 수 없어 `executeInTransaction=false` 가 필수이며, 중간에 프로세스가 죽으면 invalid 인덱스가 남을 수 있다. 이 PR 은 `DROP INDEX CONCURRENTLY IF EXISTS` 를 앞에 두어 재실행 시 잔재를 정리하는 저장소 기존 관례(V111 선례, `migrations/README.md` §5)를 그대로 따르고 있어 추가 조치 불요. 기밀성/무결성/인가에는 영향 없음.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 변경분 전체(마이그레이션 10개 파일, e2e 테스트, spec/plan/consistency 문서)
  - 상세: API 키·비밀번호·토큰·인증서 패턴 grep 결과 없음. `review/consistency/**` JSON 산출물에 담긴 것은 로컬 워크트리 절대경로뿐이며 자격증명이 아니다.

- **[INFO]** 의존성 변경 없음
  - 상세: `package.json`/lockfile 변경이 diff 에 없다. 새 라이브러리 도입 없음(e2e 는 기존 `pg`/`@jest/globals` 재사용).

## 요약

이번 변경분은 5개 FK 컬럼에 `CONCURRENTLY` 인덱스를 추가하는 DDL 마이그레이션과 그 검증 e2e, 그리고 대응하는 spec/plan 문서 갱신으로 구성된 순수 성능 개선 PR이다. 신규 SQL 은 전부 정적 리터럴이고 e2e 쿼리는 파라미터 바인딩을 사용해 인젝션 표면이 없으며, 인증/인가·입력 검증·암호화·에러 처리 경로에는 아무 변경이 없다. 하드코딩된 시크릿이나 신규/취약 의존성도 없다. `review/consistency/**` 산출물은 이전 단계의 검토 메타데이터로, 이번 target 자체에 대한 보안 이슈를 추가로 제기하지 않는다(로그 테이블 쓰기 비용 실측 관련 WARNING 은 성능/방법론 문제이지 보안과 무관).

## 위험도

NONE
