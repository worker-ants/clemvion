# 동시성(Concurrency) 리뷰

## 발견사항

없음.

리뷰 대상 28개 파일을 전수 확인했다. 이번 변경(경로 파라미터 워크스페이스 인가 — `@WorkspaceParam` /
`RolesGuard` 확장 / `workspace-roles.ts` 상수 분리)은 **인가 판정 로직 리팩터링**이지 동시성 제어
구조를 건드리지 않는다. 구체적으로 확인한 사항:

- **`codebase/backend/src/common/guards/roles.guard.ts`**: `canActivate` · `checkRequestContext` ·
  `assertMember` 모두 요청마다 새 지역 변수만 쓰고 인스턴스 필드에 아무것도 쓰지 않는다 — 싱글턴 가드가
  동시 요청 사이에 공유하는 가변 상태가 없다. 경로 파라미터가 여럿인 경우(`pathParamNames` 루프)는
  `await` 를 순차로 거는데, 각 반복이 독립적인 DB 조회 + 실패 시 즉시 throw 라 순서를 바꿔도 관측
  가능한 차이가 없다 — 원자성·경쟁조건 문제 아님(병렬화 가능성은 있지만 정확성과 무관한 성능 관점).
- **`codebase/backend/src/modules/workspaces/workspaces.service.ts`**: `deleteWorkspace` ·
  `leaveWorkspace` · `transferOwnership` · `removeMember` 의 트랜잭션·`pessimistic_write` 락·조건부
  `DELETE`(`affected === 0` 명시 비교) 구조는 **구조적으로 그대로**다. 이번 diff 는 (1) `assertAdmin`/
  `assertWorkspaceType` 호출 순서 정리, (2) `leaveWorkspace` 에 `assertMembership` 선행 추가(락 밖
  선검사, 트랜잭션 내부 재검사는 유지), (3) 에러 생성부를 공용 상수(`NOT_A_MEMBER`/`ROLE_REQUIRED`)로
  교체한 것뿐이다. 락 순서(워크스페이스 → 멤버십, 데드락 회피 근거 docstring 그대로), 재검사 위치,
  `Not('owner')` 술어를 이용한 단일 DELETE 원자성 등 기존에 검증된 동시성 보장은 변경되지 않았다.
- **`codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts`**: 코드 변경 없음 — 락 획득
  경합 테스트에 "왜 404 가 정답인가"를 설명하는 docstring 만 추가됐다(가드가 경로 워크스페이스
  멤버십을 락 없는 SELECT 로 먼저 보고, 커밋 후 도착한 요청만 403 으로 갈린다는 내용). 기존 동작에
  대한 사후 설명이지 로직 변경이 아니다.
- **`codebase/backend/src/common/constants/workspace-roles.ts`**: 모듈 레벨 상수(`NOT_A_MEMBER`,
  `ROLE_REQUIRED`, `ADMIN_ROLES`)는 요청 간 공유된다. 모든 호출부(`roles.guard.ts` ·
  `workspaces.service.ts` · `auth.service.ts`)가 예외에 넘길 때 스프레드(`{ ...NOT_A_MEMBER }`)로
  복사본을 던진다 — 공유 객체 참조가 그대로 전역 필터·클라이언트로 새서 동시 요청 간 오염될 여지를
  차단한 것으로, 문서화된 의도(주석 "공유 객체가 요청 사이에 새지 않게 한다")대로 전 사용처에서
  일관되게 지켜지고 있음을 확인했다(grep 전수 대조).
- **`codebase/backend/src/common/decorators/workspace.decorator.ts`,
  `workspace-reflection-canary.ts`**: 둘 다 `Reflect.getMetadata` 읽기 전용 reflection이고, 후자는
  부트 1회성 동기 스캔이다. 요청 처리 경로에 공유 mutable 캐시나 락을 두지 않는다.
- **`workspace-path-guard.e2e-spec.ts`(신규) / `workspace-rbac.e2e-spec.ts`**: `Promise.all` 사용은
  독립적인 검증용 병렬 요청(경합을 만드는 게 아니라 단순 동시 발사) — 동시성 결함을 감추거나 만드는
  패턴 아님.

## 요약

이번 변경은 워크스페이스 경로 파라미터(`@WorkspaceParam`)에 대한 인가 판정을 `RolesGuard` 로 끌어올리는
리팩터링이며, 기존에 검증된 트랜잭션/락/원자적 DELETE 기반 동시성 보장 구조(삭제·탈퇴·소유권 이양·멤버
제거)를 구조적으로 건드리지 않는다. 가드와 리플렉션 헬퍼는 요청 간 공유 가변 상태가 없는 stateless
코드이며, 새로 도입된 공유 상수 객체도 예외 생성 시 일관되게 스프레드 복사돼 요청 간 오염 가능성이
없다. 새 e2e 테스트(`workspace-delete-concurrency.e2e-spec.ts` 는 문서 갱신만, `workspace-path-guard.e2e-spec.ts` 는 신규 인가 경로 검증)도 동시성 원시(lock/transaction)를 바꾸지 않는다. 동시성 관점에서
새로 도입된 결함은 발견되지 않았다.

## 위험도

NONE
