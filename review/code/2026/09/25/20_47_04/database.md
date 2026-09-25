# 데이터베이스(Database) 리뷰

## 발견사항

없음.

이번 변경 범위(`origin/main` 대비)는 `codebase/backend/README.md` 문서 수정, `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 유닛 테스트 1건 추가, `plan/in-progress/**` plan 갱신, `review/code/2026/09/25/20_20_00/**` 및 `review/consistency/2026/09/25/20_01_21/**` 리뷰 산출물로 구성된다. 컨트롤러·서비스·엔티티·마이그레이션 등 프로덕션 코드 변경이 전혀 없어 인덱스·N+1·트랜잭션·마이그레이션·스키마·커넥션·SQL 인젝션·페이지네이션 어느 관점에서도 새로 도입된 리스크가 없다.

유일하게 DB 로직에 인접한 변경은 `workspaces.service.spec.ts` 에 추가된 테스트뿐이다(`WorkspacesService.transferOwnership()` 관련). 대상 프로덕션 코드(`codebase/backend/src/modules/workspaces/workspaces.service.ts:723-808`)를 직접 열어 확인한 결과, 이 테스트가 검증하는 트랜잭션·`pessimistic_write` 락 재검사 패턴(무락 선행 인가 통과 후 트랜잭션 안에서 `workspaceRepository`→`memberRepository` 순서로 락을 걸고 role/멤버십을 재확인, 강등·멤버십 소멸 시 `OWNER_REQUIRED` 로 거부)은 이번 diff 로 새로 만들어진 것이 아니라 기존 구현이다. 추가된 테스트는 mock repository 로 `lock` 유무에 따라 응답을 분기시켜 그 재검사 분기(OR 두 갈래: 강등됨 / 멤버십 없음)가 실제로 실행되는지 고정할 뿐이며, 실제 DB 커넥션·쿼리·인덱스·마이그레이션과 무관하다. 오히려 TOCTOU(무락 선행 조회와 락 재검사 조회 사이의 경합)를 커버리지로 굳히는 방향이라 DB 정합성 관점에서 긍정적인 변경이다.

README 변경은 부팅 캐너리(`assertWorkspaceIdReflectionWorks`) 설명 범위를 `@WorkspaceParam(...)` 까지 확장하는 문서 정정으로, 스키마·마이그레이션·커넥션 설정과 무관하다.

## 요약

DB 관점에서 검토할 프로덕션 코드 변경이 없다. 유일하게 인접한 변경은 기존 `transferOwnership()` 트랜잭션/락 재검사 로직에 대한 유닛 테스트 추가이며, 이는 mock 기반이고 실제 DB 동작을 바꾸지 않는다. 나머지는 README 문서 정정과 plan/review 산출물이다.

## 위험도

NONE
