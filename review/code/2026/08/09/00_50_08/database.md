# Database Review — backend-lint-gate-broken-on-main

## 검증 방법

프롬프트에 나열된 34개 파일 중 대용량 파일 다수가 프롬프트 크기 제한으로 잘려 있어,
`git diff origin/main -- <file>` 로 34개 전 파일의 실제 diff 를 직접 조회해 확인했다
(전체 diff stat: 75 files changed, 272 insertions(+), 375 deletions(-)).

## 발견사항

없음.

전 diff 를 확인한 결과 이 PR(`plan/in-progress/backend-lint-gate-broken-on-main.md` 가
설명하는 backend lint 게이트 복구 작업)은 **순수 포맷팅/린트 수정만** 포함한다:

- prettier 재포맷 (union 타입 `| A | B` 선행 파이프 제거 — `@typescript-eslint`
  포맷 규칙 변경에 따른 정렬)
- `@typescript-eslint/no-unnecessary-type-assertion` 정리 (`as X` 캐스트 제거 —
  구조적으로 이미 해당 타입과 일치하는 리터럴/파생값에서 불필요 캐스트 삭제)
- 미사용 import 제거(`Cafe24Method`, `MakeshopMethod`) 및 미사용
  `eslint-disable-next-line no-console` 주석 제거

`database-query.handler.ts`(DB 쿼리 노드 핸들러), `generate-golden-set.ts`
(`dataSource.query` 원시 SQL 스크립트), `conversation-thread.types.ts`
(jsonb 영속 스냅샷 타입) 등 DB 와 실제로 관련된 파일들도 모두 위와 동일한
타입-캐스트/포맷 diff 뿐이며, 쿼리 문자열·트랜잭션 경계·커넥션 풀 설정·
인덱스 사용·페이지네이션 로직에는 **한 글자도 변경이 없다**. `database-query.handler.ts`
의 `mysqlCreateConnection` 커넥션 lifecycle, `POOL_MAX_CONNECTIONS`/
`POOL_IDLE_TIMEOUT_MS` 상수, 파라미터 바인딩 방식도 변경분 밖이다.
`generate-golden-set.ts` 의 `dataSource.query(...,[kbId, minChars, sample])` 파라미터화
쿼리와 `ORDER BY` 화이트리스트(`ALLOWED_ORDERS`) 패턴도 기존 그대로 유지되며
새로운 위험을 도입하지 않는다.

나머지 파일(노드 핸들러류·AI 메모리 매니저·워크플로우 어시스턴트 도구 등)은
Redis 기반 conversation thread / in-memory 로직이거나 외부 HTTP API 클라이언트로,
직접적인 DB(RDB) 상호작용이 없다.

## 요약

이 변경 세트는 데이터베이스 관점에서 검토할 대상이 없다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 기술된 대로 origin/main 의 backend lint 게이트(prettier + no-unnecessary-type-assertion)를 복구하기 위한 순수 포맷팅/타입-어서션 정리 PR이며, 34개 대상 파일 전체의 실제 diff 를 직접 대조해 SQL·트랜잭션·마이그레이션·커넥션 풀·인덱스·페이지네이션과 관련된 어떤 실질 변경도 없음을 확인했다.

## 위험도

NONE
