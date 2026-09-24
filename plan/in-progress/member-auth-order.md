---
title: removeMember 의 권한 검사가 대상 조회보다 뒤에 있어 존재 오라클이 된다
status: in-progress
owner: developer
worktree: member-auth-order-8c4d1f
spec_impact: none
started: 2026-09-24
---

# 인가보다 조회가 먼저라, 인가받지 못한 사람도 답을 세 갈래로 받는다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`removeMember()` 의 권한 검사가 대상 조회·owner 판정보다 뒤에 있어 존재 오라클이 된다»
(중간)를 닫는다. `/ai-review` 가 **세 라운드 연속**(#1384 의 1·2·3라운드) 재확인한 항목이다.

현재 순서는 `findOne` → 404 → self 위임 → owner 403 → `assertAdmin` 이다. 그래서
`(workspaceId, memberId)` 쌍에 대해 **세 갈래로 구분되는 응답**이 나간다:

| 대상 상태 | 응답 |
| --- | --- |
| 없음 | `404 MEMBER_NOT_FOUND` |
| 있고 owner | `403 CANNOT_REMOVE_OWNER` |
| 있고 비-owner | `403 ADMIN_REQUIRED` |

**받는 사람에 제한이 없다.** `RolesGuard` 는 전역 `APP_GUARD` 지만 `@Roles()` 가 없고
`handlerConsumesWorkspaceId` 가 false 면 단락하는데(`roles.guard.ts:116`), 이 핸들러는
`@WorkspaceId()` 가 아니라 `@Param('id')` 를 쓴다 → **유효 JWT 만 있으면 비-멤버도 도달한다.**

## A. 착수 전 실측

| 확인 | 실측 |
| --- | --- |
| 형제 Admin+ 메서드는 어떻게 하나 | **둘 다 대상 조회 전에 인가한다** — `addMemberByEmail` 은 `assertWorkspaceType` → `assertAdmin` (`:256-257`), `updateMemberRole` 은 `assertAdmin` 이 **첫 await** (`:306`) 뒤에 `findOne`(`:307`). `removeMember` 만 예외다 |
| 현재 동작을 고정하는 테스트가 있나 | **0건.** `ADMIN_REQUIRED`·`NOT_A_MEMBER` 단언은 있지만 전부 `updateWorkspaceSettings`·다른 경로용이고, `workspace-rbac.e2e-spec.ts` 의 멤버 경로 단언은 **owner 가 PATCH** 하는 자리다 |
| `NOT_A_MEMBER` 가 정식 코드인가 | 있다 — `3-error-handling.md:49` 에 **403** 으로 등재. 설명이 열거하는 경로는 «전환·탈퇴·멤버십 확인» 이라 이 자리가 새 발행처가 된다(§E) |
| spec 이 비-멤버 응답을 규정하나 | **안 한다** — `data-flow/12-workspace.md:141` 은 권한을 «owner / admin» 으로만 적는다 → `spec_impact: none` |

## B. 처방 — `assertAdmin` 을 앞으로 옮길 수는 없다

형제처럼 `assertAdmin` 을 첫 줄에 두면 **자가 탈퇴가 깨진다.** 비-admin 멤버도 자기 자신은
제거할 수 있어야 하고(그 갈래는 `leaveWorkspace` 로 위임된다), 자기 자신인지는 **대상을 읽어야**
안다. 그래서 인가를 두 단으로 나눈다:

```
requesterRole = getMemberRole(...)        ← 한 번 읽는다
  없으면 403 NOT_A_MEMBER                  ← 비-멤버는 여기서 끝난다
findOne(대상) → 404 → self 위임 → owner 403
  admin 아니면 403 ADMIN_REQUIRED          ← 위에서 읽은 role 을 재사용
```

**왜 이것이 완전한 차단인가 — 실측이 근거다.** 멤버로 좁히면 «멤버는 여전히 세 갈래를 본다»
가 남는데, **그 멤버는 이미 같은 정보를 가지고 있다**:

> `listMembers` 는 `assertMembership` 만 요구하고(`:218`) 워크스페이스의 **모든 멤버**에 대해
> `id` · `userId` · `email` · `name` · `role` · `joinedAt` 를 돌려준다(`:245` 부근 매핑).
> 즉 멤버는 `(workspaceId, memberId)` 의 존재 여부와 owner 여부를 **정상 API 로 이미 안다.**
> 따라서 오라클을 멤버로 좁히는 것은 «노출 대상을 줄이는 완화» 가 아니라 **새로 얻는 정보를
> 0 으로 만드는 것**이다.

**조회를 두 번 돌리지 않는다.** `assertMembership` 과 `assertAdmin` 은 **둘 다**
`getMemberRole` 을 부른다(`:889`, `:902`) — 앞에 `assertMembership` 을 그냥 끼우면 같은 쿼리가
두 번 돈다. 요청자 role 을 한 번 읽어 두 판정에 쓰고, 두 예외의 리터럴은
`throwNotAMember()` · `throwAdminRequired()` 로 뽑아 기존 두 assert 도 그것을 쓰게 한다
(같은 코드가 다른 메시지를 내는 것을 막는다 — `throwMemberNotFound()` 선례).

## C. 관측 가능한 변화

| 요청자 | 전 | 후 |
| --- | --- | --- |
| 비-멤버 | `404` / `403 CANNOT_REMOVE_OWNER` / `403 ADMIN_REQUIRED` | **`403 NOT_A_MEMBER`** |
| 멤버(비-admin) | 세 갈래 그대로 | **그대로** |
| admin / owner | 변화 없음 | 변화 없음 |

비-멤버는 애초에 인가받지 못한 호출자이고, 그 동작을 고정하는 테스트·spec 서술이 **0건**이다.

## D. TDD

- [ ] **먼저 RED**: 비-멤버가 (a) 없는 memberId (b) owner memberId (c) 비-owner memberId 에
      대해 **서로 다른 응답**을 받는 것을 e2e 로 고정한다. 고치기 전 예측: `404` / `403
      CANNOT_REMOVE_OWNER` / `403 ADMIN_REQUIRED` — **세 값이 서로 다르다**.
- [ ] 고친 뒤 셋 다 `403 NOT_A_MEMBER` (구분 불가) + 멤버 경로는 그대로.
- [ ] 뮤턴트로 단언 유효성 (예측/실측 두 칸).

> **단언을 «세 값이 다르다» 로 쓴다.** 각 값을 따로 단언하면 고친 뒤 셋을 전부 바꿔야 하고,
> 그러면 «구분 불가» 라는 **성질**이 아니라 값 세 개를 고정하게 된다. 성질을 직접 단언하면
> 그 성질이 깨질 때만 RED 다.

## E. 하지 않는 것 — 13개 라우트 축은 이 PR 이 닫지 않는다

트래커 항목의 註가 더 큰 축을 적어 뒀다: 같은 컨트롤러에서 경로 `:id` 를 워크스페이스로 쓰면서
`@WorkspaceId()` 도 `@Roles()` 도 없는 라우트가 **17개 중 13개**이고, 전부 가드 층에서 아무
보호를 받지 못한다. 처방이 «가드가 경로 파라미터 워크스페이스도 보게 할 것인가» 라는 **설계
결정**이라 이 PR 의 스코프가 아니다.

**그 축을 별 항목으로 갈라 등재한다** — 지금은 이 항목 안의 註로만 있어서, 이 항목을 닫으면
註까지 함께 닫힌 것처럼 보인다. 계약이 다르다(이 PR: 한 메서드의 검사 순서 / 그 축: 가드의
커버리지 모델).

또 하지 않는 것: `NOT_A_MEMBER` 카탈로그 설명의 경로 열거에 이 자리를 추가하는 것 —
`spec/` 은 developer 권한 밖이라 planner 항목으로 등재한다.

## 체크리스트

- [ ] `/consistency-check --impl-prep spec/5-system` → BLOCK: NO
- [ ] e2e 로 오라클 재현 (RED 실측 — 세 값이 다르다)
- [ ] 구현 (단일 읽기 + thrower 추출)
- [ ] 뮤턴트 (예측/실측 두 칸)
- [ ] TEST WORKFLOW (lint · unit · build · e2e) — 숫자는 로그 파일명과 함께
- [ ] 13-라우트 축 별 항목 등재 + `NOT_A_MEMBER` 카탈로그 planner 항목 등재
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done spec/5-system` → BLOCK: NO
- [ ] 트래커 항목 해소 + plan `complete/` 로 (**한 커밋으로**)
