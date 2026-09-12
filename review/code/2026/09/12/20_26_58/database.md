# 데이터베이스(Database) 리뷰

## 발견사항

없음.

본 변경 전체를 스캔한 결과(`migration`, `CREATE/ALTER TABLE`, `@Entity`, `@Column`, `@Index`, `Repository`, `QueryBuilder`, `transaction`, `connection pool`, 원시 SQL 키워드 등) 데이터베이스 스키마·쿼리·트랜잭션·커넥션·마이그레이션에 해당하는 코드 변경이 없다. 변경 대상은 다음으로 한정된다.

- `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 핸들러의 `@Param('id')` 에 `ParseUUIDPipe` 추가, `@ApiParam` 에 `format: 'uuid'` 추가 (HTTP 레이어 입력 검증·OpenAPI 문서화)
- `codebase/backend/src/modules/auth/auth.controller.ts` — `switchWorkspace` 의 `@ApiParam` 에 `format: 'uuid'` 추가 (문서 전용, 런타임 변경 없음)
- `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` + `param-uuid-pipe.spec.ts` + fixture — AST 기반 정적 가드/테스트 신규 추가 (컨트롤러 소스 전수 스캔, DB 접근 없음)
- `CHANGELOG.md`, 프론트엔드 docs(mdx), i18n 라벨, plan 문서 — 문서·비-런타임 변경

참고로 이번 변경은 오히려 DB 관점에서 방어적이다. 종전에는 비-UUID `:id` 문자열이 `ParseUUIDPipe` 없이 서비스 계층을 거쳐 `findById` 까지 흘러갔고, Postgres 가 SQLSTATE `22P02`(invalid_text_representation)로 쿼리 자체를 거부하면 `GlobalExceptionFilter` 가 이를 분류하지 못해 500 으로 마스킹했다. 이번 변경은 그 malformed 값을 컨트롤러 진입점에서 걸러 DB 계층까지 도달하지 못하게 하므로, "DB 에러를 애플리케이션 로직으로 처리한다"는 안티패턴을 줄이는 방향이다. 다만 이 로직 자체는 DB 코드가 아니라 NestJS 파이프/HTTP 계층이라 본 리뷰 관점(인덱스·N+1·트랜잭션·마이그레이션·스키마·커넥션·SQL 인젝션·대량 데이터)의 직접 대상은 아니다.

## 요약

이번 변경 셋은 트리거·워크스페이스 API 의 `:id` 경로 파라미터에 `ParseUUIDPipe` 런타임 검증과 `@ApiParam format:'uuid'` 문서화를 전수로 맞추고 이를 강제하는 정적 가드를 추가하는 작업으로, 데이터베이스 스키마·쿼리·트랜잭션·마이그레이션·커넥션 관리에 해당하는 코드 변경이 전혀 없다. 부수적으로 malformed UUID 가 DB 계층까지 도달해 SQLSTATE 22P02 를 유발하던 경로를 컨트롤러 단에서 조기 차단하므로 DB 예외 처리 부담을 줄이는 긍정적 효과가 있으나, 이는 정보 제공 차원이며 본 리뷰의 판정에는 영향을 주지 않는다.

## 위험도

NONE
