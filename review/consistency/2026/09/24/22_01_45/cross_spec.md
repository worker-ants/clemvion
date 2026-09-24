# Cross-Spec 일관성 검토 — `removeMember` 판정 순서 커버리지 (--impl-prep)

## 검토 범위 요약

대상 plan(`plan/in-progress/remove-member-order-coverage.md`)은 `spec_impact: none` —
`codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 에 누락 테스트 2건(§A-1
"대상 존재 → admin" 순서, §A-2 "요청자 role 1회 조회")을 추가하는 **테스트 전용** 작업이다.
프로덕션 코드 변경은 뮤턴트(M-a/M-b/M-b2) 검증 목적으로만 일시 적용되며 `cp` 로 복원되고,
`spec/**` 문서는 전혀 건드리지 않는다. 따라서 "target 문서(draft)" 로 번들된 내용은 신규
제안이 아니라 **기존** `spec/data-flow/12-workspace.md` 스냅샷(scope-ws)이며, 이번 검토는 그
기존 서술이 다른 spec 영역과 이미 정합한지를 확인하는 배경 점검에 가깝다.

## 확인한 내용

1. **판정 순서 서술의 교차 정합** — `workspaces.service.ts` `removeMember()` 의 docstring
   ("판정 순서: 멤버십 → 대상 존재 → self 위임 → admin → 대상이 owner 인가")과, 이를 구현한
   실제 코드 순서(§814행 이하)를 대조했다. `spec/data-flow/12-workspace.md` §1.6 테이블은 이
   순서를 세부까지 서술하지 않고 결과("owner 는 제거 불가", "본인 제거는 자가 탈퇴로 위임")만
   적는데, 이는 축약이지 모순이 아니다. `spec/5-system/1-auth.md` §Rationale "§3.2 '멤버 관리'
   행의 Admin 열 정정(2026-07-28)" 이 동일한 사실관계(자기 자신 제거는 `leaveWorkspace` 위임,
   거부 조건은 요청자 role 이 아니라 대상이 owner 인 경우)를 이미 실측 근거와 함께 기술하고
   있어 두 문서가 일치한다.
2. **에러 코드 충돌 여부** — `MEMBER_NOT_FOUND`·`CANNOT_REMOVE_OWNER`·`ADMIN_REQUIRED`·
   `NOT_A_MEMBER` 를 `spec/**` 전수 grep 했다. `ADMIN_REQUIRED`·`NOT_A_MEMBER`·
   `CANNOT_REMOVE_OWNER` 는 `spec/5-system/3-error-handling.md`·`1-auth.md` 에 동일 의미로만
   등장한다. `MEMBER_NOT_FOUND` 는 에러 카탈로그에 없으나, 같은 문서가 이미 "`workspaces.service`
   전역 CRUD 공통 generic 코드는 distinctive 가 아니어서 미등재" 라는 정책을 `USER_NOT_FOUND`·
   `WORKSPACE_NOT_FOUND` 에 대해 명시해 뒀다 — `MEMBER_NOT_FOUND` 도 같은 계열이라 이 정책과
   정합하며 새로운 갭이 아니다. 다른 영역에서 이 코드들을 **다른 의미**로 쓰는 사례는 없었다.
3. **RBAC 매트릭스 정합** — `spec/2-navigation/9-user-profile.md` §4.1/§4.2 의 "제거 | Admin+"
   와 `spec/5-system/1-auth.md` §3.2(Admin CRUD 정정), `spec/data-flow/12-workspace.md` §4 표
   (`admin | ✓ (owner 제외)`)가 서로 다른 문서이면서도 동일한 결론(Admin 은 멤버 제거 가능,
   owner 는 보호)을 낸다. 이번 작업은 이 매트릭스를 바꾸지 않는다.
4. **계층 책임** — 변경 파일은 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
   (developer 소유 test) 뿐이며, spec 문서·다른 모듈 경계를 넘지 않는다.

## 발견사항

없음. target 이 신규로 도입하는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임
서술이 없고(테스트 커버리지만 추가), 번들된 기존 spec 서술(`12-workspace.md`·`1-auth.md`·
`9-user-profile.md`·`3-error-handling.md`) 간에도 이 도메인에 관한 한 상호 모순이 확인되지
않았다.

## 요약

이번 plan 은 `removeMember` 의 **이미 문서화·구현된** 판정 순서에 누락된 테스트 두 건을
추가하는 test-only 작업으로, spec 을 변경하지 않고 새로운 계약·엔티티·요구사항 ID 도
도입하지 않는다. 관련 스코프(워크스페이스 멤버 제거 RBAC·에러 코드)를 `spec/data-flow/12-workspace.md`·
`spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md`·`spec/2-navigation/9-user-profile.md`
전반에서 대조한 결과 기존 서술 간 충돌이 없고, 이번 구현 범위가 그 서술과 어긋날 여지도
없다. Cross-Spec 관점에서 이 작업은 착수해도 안전하다.

## 위험도

NONE
