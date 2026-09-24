# 성능(Performance) 리뷰 — member-auth-order

## 요약

이번 변경은 `WorkspacesService.removeMember()` 의 인가 순서를 재배치한 보안 수정이며,
쿼리 횟수 관점에서는 **개선 또는 중립**이다. 종전에는 대상 조회(`findOne`) 1회 +
`assertAdmin` 내부 `getMemberRole` 1회 = 정상 경로 2회 SELECT 였고, 이번 변경도
`getMemberRole`(요청자) 1회 + `findOne`(대상) 1회로 동일하게 2회다. 오히려 **비-멤버
거부 경로**는 종전 "대상 조회(1회) → 이후 여러 분기" 에서 "요청자 role 조회(1회) 만에
즉시 거부" 로, 불필요한 대상 조회 자체를 없애 쿼리 1회를 줄였다(스펙 테스트가
`targetLookups.toHaveLength(0)` 로 명시적으로 검증). 새 `throwNotAMember`/
`throwAdminRequired` 헬퍼는 예외 객체 생성만 하는 trivial 리팩터로 성능에 영향 없다.
N+1, 블로킹 I/O, 부적절한 자료구조, 캐싱 부재로 인한 회귀는 발견되지 않았다.

## 발견사항

- **[INFO]** 요청자 role 조회와 대상 멤버 조회가 순차(sequential) await 로 두 번의 별도
  DB 왕복을 만든다 — 병렬화(Promise.all)나 단일 쿼리(OR 조건)로 합치면 admin 경로의
  레이턴시를 한 왕복만큼 줄일 수 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:831` (요청자 role 조회) 및 `:834-836` (대상 조회)
  - 상세: `const requesterRole = await this.getMemberRole(workspaceId, requesterId);` 다음에
    `const member = await this.memberRepository.findOne({ where: { id: memberId, workspaceId } });`
    가 순차 실행된다. 두 조회는 서로 독립적(요청자 userId vs 대상 id)이므로 이론상 병렬
    실행이 가능해 보이지만, **의도적으로 순차로 남겨야 한다** — `workspaces.service.spec.ts`
    의 "비-멤버는 대상을 조회하기 전에 NOT_A_MEMBER 로 끝난다" 테스트(`:1712-1715` 부근,
    `targetLookups.toHaveLength(0)` 단언)가 비-멤버 거부 시 대상 조회가 **전혀 일어나지
    않음**을 명시적으로 검증하고 있다. `Promise.all` 로 두 조회를 병렬화하면 비-멤버
    거부 시에도 대상 조회 쿼리가 항상 발생해 이 테스트가 깨지고, 거부 경로의 쿼리 수도
    다시 1→2로 늘어난다.
  - 제안: 현재 순차 구조를 **유지**하는 것이 맞다(비-멤버 거부 경로 최적화가 이미 이
    변경의 의도된 이득이므로). 다만 admin 이 실제로 제거를 수행하는 정상 경로에서 두
    왕복의 레이턴시가 문제가 된다면, 두 조회를 하나의 쿼리(예: `workspace_member` 에
    대해 `WHERE (user_id = :requesterId OR id = :memberId) AND workspace_id = :workspaceId`
    후 애플리케이션에서 두 행을 구분)로 합치는 방안을 고려할 수 있으나, 이는 최적화이지
    이번 PR 의 결함은 아니다.

- **[INFO]** `affected === 0` 판정 후 원인 구분을 위한 추가 `findOne` 재조회(`:886-888`)는
  DELETE 가 실제로 막힌 드문 경합/owner 경로에서만 실행되므로 일반 경로에 영향을 주지
  않는다 — N+1 이 아니라 조건부 단발 재조회로, 적절하다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:886-888`
  - 상세: 참고용 관찰이며 조치 불필요.

- **[INFO]** `ADMIN_ROLES` 는 모듈 레벨 `Set<string>` 상수로 이미 선언돼 있고
  (`workspaces.service.ts:23`), 이번 diff 의 `if (!ADMIN_ROLES.has(requesterRole))`
  (`:847`)는 O(1) 조회로 적절한 자료구조 사용이다. 긍정적 관찰, 조치 불필요.

## 위험도

NONE
