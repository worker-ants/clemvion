# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `ParseUUIDPipe` 추가는 DB 왕복을 줄이는 방향의 부수 효과
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 의 근거 사슬에 따르면, 이 파이프가 없던 종전에는 비-UUID `:id` 가 `TriggersService.findById` → TypeORM `findOne({ where: { id, workspaceId } })` 까지 흘러 Postgres 드라이버가 SQLSTATE `22P02`(invalid text representation) 로 쿼리를 거부한 뒤 `GlobalExceptionFilter` 가 그 예외를 분류하지 못해 500 으로 마스킹됐다. 이번 변경으로 파싱 불가 입력이 컨트롤러 파라미터 파이프 단계에서 400 으로 즉시 차단되어, 실패가 예정된 쿼리가 DB 커넥션까지 도달하지 않는다. DB 쪽에는 이득만 있는 변경(불필요한 쿼리 왕복·에러 로그 감소)이며 위험 요소는 없다.
  - 제안: 없음 (긍정적 부수 효과 기록 목적).
- **[INFO]** 확인된 쿼리 경로(`findOne({ where: { id, workspaceId } })`)는 TypeORM QueryBuilder/Repository API 를 통한 파라미터화 쿼리로, 이번 diff 에서 SQL 문자열 조합이나 raw query 삽입은 없다 — SQL 인젝션 관점에서 지적 사항 없음.

## 요약

이번 diff 의 실질 변경은 `TriggersController.rotateBotToken` 과 `AuthController.switchWorkspace` 의 `:id` 경로 파라미터에 `ParseUUIDPipe`/`@ApiParam({format:'uuid'})` 를 추가하는 입력 검증·문서화 수정과, 이를 강제하는 정적 AST 가드(`repo-guards/__tests__/param-uuid-pipe*`) 및 HTTP 왕복 테스트, 관련 문서(CHANGELOG·plan·mdx 가이드) 변경이다. 스키마 변경·마이그레이션·엔티티 정의·리포지토리 쿼리 로직·트랜잭션·커넥션 풀 관리·인덱스·페이지네이션 등 데이터베이스 계층에 직접 영향을 주는 코드는 포함되어 있지 않다. 유일하게 DB 와 맞닿는 지점은 비-UUID 입력이 기존에는 Postgres 까지 도달해 `QueryFailedError`(22P02)로 거부되던 것을 이제 애플리케이션 계층에서 선차단한다는 점인데, 이는 불필요한 DB 왕복을 줄이는 긍정적 부수 효과일 뿐 새로운 위험을 도입하지 않는다. 기존 쿼리(`findOne({ where: {...} })`)는 이미 TypeORM 파라미터화 쿼리 형태를 유지하고 있어 SQL 인젝션 우려도 없다.

## 위험도

NONE
