# Database Review

## 발견사항

해당 없음 — 이번 변경 세트(파일 1~17)에는 스키마·마이그레이션·엔티티·리포지토리·쿼리 빌더·트랜잭션·커넥션 풀 코드가 포함되어 있지 않다. 실제로 수정된 코드는 다음 세 범주뿐이다.

1. `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 핸들러의 `@Param('id')` 에 `ParseUUIDPipe` 를 추가하고 `@ApiParam({format:'uuid'})` 를 보강한 컨트롤러(라우팅) 레이어 변경.
2. `codebase/backend/src/modules/auth/auth.controller.ts` — `@ApiParam` 에 `format: 'uuid'` 필드 하나 추가 (Swagger 문서 전용, 런타임 영향 없음).
3. 그 외: 컨트롤러 spec 테스트(HTTP 왕복), 신규 AST 기반 정적 가드(`param-uuid-pipe-guard.ts`/`.spec.ts`/fixture) — 둘 다 소스코드 정적 분석·HTTP 계층 테스트이며 DB 접근이 없다.
4. 나머지(`CHANGELOG.md`, MDX 문서 4곳, `backend-labels.ts`/`.test.ts`, `plan/**`)는 전부 문서·i18n 라벨·plan 트래커로 DB 와 무관.

참고로 plan 문서(`plan/in-progress/trigger-uuid-and-guide-error-codes.md`)가 이 변경의 배경으로 다음 인과관계를 실측해 적어 두었다: `Trigger.id` 는 `@PrimaryGeneratedColumn('uuid')` (Postgres `uuid` 컬럼)이고, `rotateBotToken` → `TriggersService.findById` → `findOne({ where: { id, workspaceId } })` 경로에서 비-UUID 값이 파싱 파이프 없이 그대로 들어가면 Postgres 드라이버가 SQLSTATE `22P02`(invalid text representation) 로 거부하며, `GlobalExceptionFilter` 가 그 에러 코드를 분류하지 않아 500 `INTERNAL_ERROR` 로 마스킹되던 결함이다. 이번 diff 는 그 값을 컨트롤러 경계(`ParseUUIDPipe`)에서 400 으로 끊어 **DB 쿼리 자체가 실행되기 전에 걸러내도록** 만든다 — DB 관점에서는 순수하게 긍정적인 방향(불필요한 실패 라운드트립 제거, DB 드라이버 예외를 입력 검증의 대용으로 쓰지 않게 됨)이며, 인덱스·트랜잭션·N+1·마이그레이션·커넥션 풀·SQL 인젝션 어느 관점에서도 새로운 위험을 추가하지 않는다. `findOne({ where: {...} })` 는 TypeORM 리포지토리 API 라 파라미터화가 항상 보장되므로 SQL 인젝션 우려도 없다 (애초에 `22P02` 는 인젝션이 아니라 타입 캐스팅 실패다).

plan 문서 자체가 이미 등재해 둔 별도 사항 — "`GlobalExceptionFilter` 가 `22P02` 를 일반적으로 분류하지 않아, `ParseUUIDPipe` 가 없는 다른 경로(예: 다른 필드를 통해 비-UUID 가 흘러가는 경우)는 여전히 500 마스킹 가능" — 는 이번 PR 이 의도적으로 범위 밖(전 엔드포인트 실패 분류 변경은 별도 선행 조사 필요)으로 명시하며 후속 트래커에 등재했다고 밝히고 있다. 이는 새로운 발견이 아니라 저장소가 이미 인지·유예한 항목이므로 본 리뷰에서 재-flag 하지 않는다.

## 요약

이번 변경 세트는 데이터베이스 스키마·쿼리·트랜잭션·마이그레이션·커넥션 관리 어느 것도 직접 수정하지 않는다. 유일한 실질 코드 변경은 컨트롤러 파라미터 파이프(`ParseUUIDPipe`)와 Swagger 문서 애노테이션(`@ApiParam format:'uuid'`) 추가로, 비-UUID 입력이 DB 계층까지 흘러가 Postgres SQLSTATE 22P02 로 거부되던 경로를 API 경계에서 사전 차단하는 방어적 입력 검증 강화다. TypeORM 리포지토리 API 사용 방식은 변경되지 않았고 파라미터화도 그대로 유지되므로 SQL 인젝션 리스크가 없으며, 새로 추가된 가드·테스트도 정적 분석/HTTP 계층 검증일 뿐 DB 접근이 없다. 데이터베이스 관점에서 이 PR 은 무해하며 오히려 불필요한 DB 왕복을 줄이는 미세한 긍정적 효과가 있다.

## 위험도
NONE
