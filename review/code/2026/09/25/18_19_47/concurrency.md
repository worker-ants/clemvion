# 동시성(Concurrency) 리뷰

## 발견사항

없음(diff 범위 내 신규 결함).

리뷰 대상 30개 파일을 확인했다. 이번 변경(경로 파라미터 워크스페이스 인가 — `@WorkspaceParam` 확장,
`transferOwnership`/`leaveWorkspace` 인가 선행 추가, 거부 코드 통일)은 인가 판정 로직 조정이며 기존
동시성 제어 구조(트랜잭션·`pessimistic_write` 락·조건부 원자적 DELETE)를 새로 바꾸지 않는다. 구체적으로
확인한 사항:

- **`workspaces.service.ts` — `transferOwnership`**: 이번 diff 가 트랜잭션 진입 전에 무락
  `getMemberRole` 선검사(`requesterRole !== 'owner'` 이면 즉시 거부)를 추가했다. 최종 결정은 여전히
  트랜잭션 내부의 `pessimistic_write` 재검사(`requesterMembership.role !== 'owner'`, `733-756`행)가
  하므로 이 선검사와 트랜잭션 사이의 값 변경(TOCTOU)은 안전하게 흡수된다 — `leaveWorkspace`(`650`행
  `assertMembership` 선행)와 같은 기존 패턴을 그대로 따른다. 요청자가 선검사 통과 후 트랜잭션 진입 전에
  owner 를 잃어도, 트랜잭션은 그 최신 상태를 락을 쥐고 다시 읽어 `OWNER_REQUIRED` 로 거부한다.
- **`workspaces.service.ts` — 락 순서**: `deleteWorkspace`(워크스페이스 → 멤버십)와
  `transferOwnership`(워크스페이스 → requesterMembership → targetMembership)이 이번 diff 에서도
  동일한 "워크스페이스 먼저" 순서를 유지한다(`729-736`행 문서화). 두 메서드가 동시에 같은 워크스페이스
  행을 잠그려 하면 워크스페이스 행 락 자체가 임계구역 전체를 직렬화하므로, 그 뒤에 이어지는 멤버십 행
  락(A→B / B→A 이양처럼 서로 다른 두 멤버 행을 순서대로 잠그는 경우)이 별도의 교착을 만들지 않는다.
  참고: `transferOwnership` 상단 docstring(`705-716`행, 이번 diff 밖의 기존 코드)이 "두 멤버를 단일
  IN 쿼리로 동시에 락"이라고 서술하지만 실제 구현(`750-769`행)은 `requesterMembership` →
  `targetMembership` 순서의 **개별** `findOne(..., { lock })` 두 번이다. 기능적으로는 위에서 설명한
  워크스페이스 행 락의 직렬화 덕에 데드락이 발생하지 않지만, 문서가 서술하는 보호 메커니즘("단일 IN
  쿼리")과 실제 코드가 다르다 — 이번 PR 이 만든 불일치는 아니고 diff 도 이 줄들을 건드리지 않지만, 다음
  사람이 이 docstring 만 보고 "동시 잠금 순서가 무관하다"고 오해한 채 워크스페이스 락 없이 멤버 두 행만
  잠그는 코드를 다른 곳에 복제하면 그때는 진짜 ABBA 교착이 생길 수 있다. INFO 로 남긴다(diff 범위 밖·
  현재 동작은 안전).
- **`roles.guard.ts`**: `canActivate`/`checkRequestContext`/`assertMember` 모두 요청마다 지역 변수만
  쓰고 인스턴스 필드에 쓰지 않는다 — 싱글턴 가드가 동시 요청 사이에 공유하는 가변 상태가 없다. 신규
  `pathParamNames` 루프(`156-163`행)는 `await` 를 순차로 거는데, 현재 등록된 라우트는 워크스페이스
  경로 파라미터를 하나만 쓰므로 관측 가능한 차이는 없다 — 원자성·경쟁조건 문제가 아니라 병렬화 여지가
  있는 성능 관점일 뿐이다(라운드 4 concurrency 리뷰 `review/code/2026/09/25/17_47_18/concurrency.md`
  와 같은 결론).
- **`workspace.decorator.ts`(`workspaceParamNamesOf`), `workspace-reflection-canary.ts`**:
  `Reflect.getMetadata` 읽기 전용 reflection이고 부트 시 1회성 동기 스캔이다. 요청 처리 경로에 공유
  mutable 캐시나 락이 없다.
- **`workspace-roles.ts`(`ADMIN_ROLES`/`NOT_A_MEMBER`/`ROLE_REQUIRED`)**: 모듈 레벨 상수를 여러
  서비스·가드가 공유하지만, 예외로 던질 때 전부 스프레드(`{ ...NOT_A_MEMBER }`)로 복사본을 만든다
  (`roles.guard.ts` 218행, `workspaces.service.ts` 921행, `auth.service.ts` 1138행 등 grep 전수
  확인) — 공유 객체 참조가 요청 간 오염될 여지가 없다.
- **`workspace-delete-concurrency.e2e-spec.ts`**: 코드 변경 없이 락 경합 테스트가 404 로 수렴하는
  이유(가드의 무락 멤버십 SELECT가 이 테스트의 행 락에 막히지 않는다)를 설명하는 docstring 만
  추가됐다 — 로직 변경 아님.
- **`workspace-path-guard.e2e-spec.ts`(신규)**: `Promise.all`(`212`·`216`행)은 독립적인 검증용 병렬
  요청이며 경합을 만들거나 감추는 용도가 아니다. 테스트 자체에 새 동시성 원시(lock/transaction)는
  없다.

## 요약

이번 diff 는 `transferOwnership` 에 무락 선검사를 추가하고 거부 코드를 공용 상수로 통일하는 인가 계층
리팩터링으로, 기존에 검증된 트랜잭션/락/원자적 DELETE 기반 동시성 보장 구조를 그대로 유지한다. 새로
추가된 선검사는 트랜잭션 내부의 `pessimistic_write` 재검사가 최종 결정을 내리므로 TOCTOU 창을 열지
않는다. 가드·리플렉션 헬퍼는 요청 간 공유 가변 상태가 없는 stateless 코드다. diff 범위 밖의 기존
`transferOwnership` docstring 이 실제 락 획득 방식(단일 IN 쿼리)과 다르게 서술돼 있다는 점을 INFO 로
남기지만, 워크스페이스 행 락이 임계구역을 직렬화하므로 현재 동작 자체는 안전하다. 동시성 관점에서
새로 도입된 결함은 발견되지 않았다.

## 위험도

NONE
