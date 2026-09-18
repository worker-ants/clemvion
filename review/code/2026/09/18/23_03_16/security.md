# 보안(Security) 코드 리뷰

## 검토 대상 요약

FK 컬럼에 인덱스가 없어(또는 선두가 다르거나 조건이 다른 부분 인덱스만 있어) 삭제 연쇄·목록 조회가 순차 스캔하던 문제를
해소하는 DB 마이그레이션(V121~V130, `.conf`+`.sql` 10쌍)과 그 인덱스 정의를 검증하는 e2e 스펙 추가, 그리고 관련
plan/spec 문서 갱신. 모든 마이그레이션은 정적 DDL(`DROP INDEX CONCURRENTLY IF EXISTS ...` / `CREATE INDEX
CONCURRENTLY IF NOT EXISTS ... ON <table> (<column>) [WHERE ... IS NOT NULL]`)이며 사용자 입력이나 동적으로
조립되는 문자열이 전혀 없다. 뮤테이션 검증(코드 실행 재현)은 필요 없다고 판단해 수행하지 않았다 — DDL 은 상수 리터럴만
사용해 동적 실행 경로 자체가 없다.

## 관점별 점검

1. **인젝션** — 전 파일이 하드코딩된 테이블·컬럼·인덱스 이름만 사용하는 정적 DDL. 문자열 결합·`format()`·동적 identifier
   조립 없음. e2e 스펙(`deletion-cascade-indexes.e2e-spec.ts`)도 `pg_indexes`를 정적 `SELECT indexdef FROM
   pg_indexes WHERE indexname = $1`류(기존 헬퍼, 이번 diff 범위 밖) 패턴을 재사용하는 것으로 보이며, 추가된 부분은 상수
   배열(`EXPECTED`)의 정규식 리터럴뿐이다. 인젝션 벡터 없음.
2. **하드코딩된 시크릿** — 없음. `api_key`, `secret_store`, `token` 등의 언급은 전부 스펙 문서 상의 컬럼/개념 설명(예:
   `model_config.api_key (encrypted)`)이지 실제 키·비밀번호 값이 아니다.
3. **인증/인가** — 이번 diff 는 인덱스 추가일 뿐 조회·엔드포인트 로직을 바꾸지 않는다. V126 주석이 언급하는
   `GET /api/auth-configs/:id/usage` 등 엔드포인트 자체의 인가 로직은 이 변경 범위에 포함되지 않아 검토 대상이 아니다.
4. **입력 검증** — 사용자 입력을 받는 코드 경로가 diff 에 없음(순수 DDL + 테스트 assertion).
5. **OWASP Top 10** — 해당 사항 없음. 가장 근접한 항목은 A05(Security Misconfiguration) 관점의 마이그레이션 운영
   안전성인데, `DROP INDEX CONCURRENTLY IF EXISTS` 선행 + `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + `IF NOT
   EXISTS` 재실행 안전성 주석이 이미 명시돼 있어 (선례 V111~V120과 동일 패턴) 문제 없음. 가용성 관점에서 `CONCURRENTLY`
   사용은 오히려 프로덕션 락을 피하는 안전한 선택이다.
6. **암호화** — 해당 파일들에 해시/암호화 로직 없음. `model_config.api_key (encrypted)` 서술은 기존 상태를 문서화한
   것으로 이번 변경의 대상이 아니다.
7. **에러 처리** — 해당 없음. 에러 메시지 노출 경로 자체가 diff 에 없음.
8. **의존성 보안** — 신규 의존성 추가 없음.

## 발견사항

없음.

## 요약

이번 변경분은 FK 컬럼에 대한 인덱스를 추가하는 순수 DB 마이그레이션(정적 DDL, 모두 상수 리터럴)과 그 인덱스 정의를
검증하는 e2e 테스트, 관련 spec/plan 문서 갱신으로 구성되어 있으며, 사용자 입력 처리·인증/인가 로직·시크릿·암호화·에러
메시지 등 보안에 영향을 줄 수 있는 코드 경로를 포함하지 않는다. 인젝션·하드코딩된 시크릿·인가 우회·안전하지 않은
암호화 등 어떤 항목에서도 취약점을 발견하지 못했다.

## 위험도

NONE
