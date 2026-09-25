# 데이터베이스(Database) 리뷰

## 발견사항

없음.

## 요약

이번 changeset(8개 파일)은 경로 워크스페이스 RBAC 가드 후속 정리로, 실질 변경은 다음 세 종류뿐이다: (1) `workspace.decorator.ts` 의 `routeArgEntriesMatching` 리플렉션 헬퍼 추출(순수 메타데이터 조회, DB 무관), (2) `integrations.service.ts` 의 로컬 `ADMIN_ROLES` 상수를 공유 상수(`workspace-roles.ts`)로 교체(값 동일, `In([...ADMIN_ROLES])` 사용처인 `workspaces.service.ts:findAdminUserIdsByWorkspaces` 의 쿼리 술어에는 변화 없음), (3) `auth.controller.ts`/`executions.controller.ts`/`workspaces.controller.ts` 의 Swagger `description` 문자열을 하드코딩 리터럴에서 공유 상수 보간으로 교체. `workspaces.service.ts` 의 유일한 실코드 변경은 `throwOwnerTransferRequired` 의 예외 본문 스프레드 방식 변경(문서 렌더링 목적)이며, `transferOwnership` 의 동시성 보장(트랜잭션·`pessimistic_write` 락 순서: workspace → requester → target)은 코드 변경 없이 **부정확했던 JSDoc 주석**("두 멤버를 단일 IN 쿼리로 동시에 락")만 실제 구현(순차 `findOne` 두 번)에 맞게 정정됐다 — 정정 후 문서가 실측 코드와 일치하며 락 순서·트랜잭션 경계에 문제는 없다. 인덱스·N+1·트랜잭션·마이그레이션·스키마·커넥션 관리·SQL 인젝션·페이지네이션 어느 관점에서도 새로운 쿼리, 스키마 변경, 마이그레이션 파일, 락 전략 변경이 없어 데이터베이스 관점에서 지적할 사항이 없다.

## 위험도

NONE
