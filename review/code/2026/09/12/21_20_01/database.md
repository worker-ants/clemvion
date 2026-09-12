# 데이터베이스(Database) 코드 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 의 `:id` 에 `ParseUUIDPipe` 를 추가해 비-UUID 입력이 DB 계층에 도달하기 전에 차단된다 (긍정적 부수효과)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: 변경 전에는 비-UUID `:id` 가 그대로 `TriggersService.findById` → TypeORM `findOne({ where: { id, workspaceId } })` 로 흘러가 Postgres 드라이버가 SQLSTATE `22P02`(invalid input syntax for type uuid) 로 쿼리를 거부했다. 이는 SQL 인젝션 문제는 아니다(파라미터화된 쿼리이므로 값이 안전하게 바인딩됨) — 다만 **확정적으로 실패할 쿼리가 매번 커넥션 풀에서 커넥션을 하나 점유하고 DB 왕복을 한 번 소비**한 뒤에야 실패했었다. 이번 변경으로 `ParseUUIDPipe` 가 컨트롤러 계층에서 형식을 먼저 검증해 그런 쿼리 자체가 DB 까지 가지 않는다. 스키마 쪽은 `Trigger.id` 가 `@PrimaryGeneratedColumn('uuid')` (Postgres `uuid` 컬럼)로 이미 적절하다.
  - 제안: 별도 조치 불필요 — fail-fast 로 DB 부하를 줄이는 개선. 형제 6개 엔드포인트와 동일한 패턴으로 일관성도 확보됐다.

- **[INFO]** `param-uuid-pipe` repo-guard 는 순수 정적 분석(AST)이며 실제 DB 스키마·쿼리를 변경하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`, `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`
  - 상세: 컨트롤러 데코레이터 존재 여부만 카운트하는 회귀 가드로, DB 관점에서는 영향이 없다(정보 제공 목적으로만 기재).

## 요약

이번 변경 세트는 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 엔드포인트의 `:id` 경로 파라미터에 `ParseUUIDPipe` 를 추가하는 컨트롤러 계층 입력 검증 수정, 이를 회귀 방지하는 정적 AST 가드 신설, 그리고 CHANGELOG·유저 가이드 MDX·프런트엔드 i18n 라벨의 오기(誤記) 수정으로 구성된다. 마이그레이션·엔티티·리포지토리·쿼리 빌더·트랜잭션·커넥션 풀 관련 코드는 이번 diff 에 전혀 포함되지 않았고, 스키마 변경도 없다. 유일하게 DB 와 접점이 있는 부분은 `rotateBotToken` 수정인데, 이는 오히려 **파싱 불가능한 UUID 가 DB 쿼리까지 도달하지 못하게 앞단에서 막는 개선**이라 위험 요소가 아니라 긍정적 변화다(불필요한 DB 왕복·에러 발생 감소). SQL 인젝션·N+1·트랜잭션·페이지네이션·커넥션 관리 등 다른 관점에서 지적할 사항은 없다.

## 위험도

NONE
