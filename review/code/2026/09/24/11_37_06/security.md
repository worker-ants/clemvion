# 보안(Security) 리뷰 — `removeMember` 인가 순서 재배치

## 검증 방법

`codebase/backend/src/modules/workspaces/workspaces.service.ts`(`removeMember`·`getMemberRole`·
`assertMembership`·`assertAdmin`·`listMembers`), `workspaces.controller.ts`(`removeMember` 라우트),
`common/guards/roles.guard.ts`(`canActivate`)를 `Read`/`Bash grep` 으로 직접 열어 diff 게이트
숫자와 대조했다. 저장소에는 아무것도 쓰거나 고치지 않았다(`git status --short` 로 최종 확인).

## 발견사항

- **[INFO]** 이번 diff 는 실제 코드 변경이 아니라 신규 취약점 없음 — 오히려 기존 정보 노출
  취약점(존재·owner 오라클)을 닫는 보안 수정이다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:814-850` (`removeMember`)
  - 상세: 변경 전 순서(`findOne` → 404 → self 위임 → owner 403 → `assertAdmin`)에서는
    `workspaces.controller.ts:355-374` 의 `removeMember` 라우트가 `@Roles()` 도 없고
    `@Param('id')`(→ `handlerConsumesWorkspaceId` false)를 쓰는 것을 직접 확인했다 — 이 조건은
    `roles.guard.ts:112-118` 에서 `canActivate` 가 멤버십 검사 없이 `return true` 로 단축 통과함을
    의미한다. 즉 **유효 JWT 만 있으면 그 워크스페이스와 무관한 임의 인증 사용자**가 서비스
    계층까지 도달했고, 종전 순서는 `(workspaceId, memberId)` 쌍에 대해 없음(`404`)/owner(`403
    CANNOT_REMOVE_OWNER`)/비-owner(`403 ADMIN_REQUIRED`) 세 갈래로 구분되는 응답을 돌려줬다 —
    CWE-203(Observable Discrepancy)류 존재·역할 오라클이다. 이번 diff 는 요청자 멤버십을
    `getMemberRole` 로 대상 조회보다 먼저 확인해(`:831-832`) 비-멤버를 **대상에 대해 아무것도
    배우지 못한 채** `403 NOT_A_MEMBER` 로 끝낸다. `codebase/backend/test/workspace-rbac.e2e-spec.ts:669-732`
    의 신규 e2e 가 **헤더 없이**(`X-Workspace-Id` 미부착 — 붙이면 가드가 먼저 403 을 내 오라클
    자리를 검증하지 못한다는 점까지 docblock 에 명시) 없음/owner/비-owner 세 memberId 를 동시에
    찔러 `new Set(answers).size === 1` 로 "세 응답이 구분 불가"라는 성질을 직접 단언하고, 삭제가
    실제로 일어나지 않았음도 DB count 로 확인한다 — 실측 판별력이 있는 회귀 테스트다.
  - 제안: 없음 — 조치가 아니라 확인. `assertAdmin` 이 기존에도 `!role || !ADMIN_ROLES.has(role)`
    로 비-멤버를 거부했으므로(`:941`) 이번 변경은 **새 인가 층이 아니라 기존 인가의 재배치**임을
    `assertAdmin`/`assertMembership` 코드로도 직접 확인했다.

- **[INFO]** 멤버(비-admin) 대상 응답 차이는 새로 생긴 정보가 아니다 — `listMembers` 가 이미
  같은 정보를 노출한다
  - 위치: `workspaces.service.ts:205-235` (`listMembers`), 비교 대상 `:834-850`
  - 상세: `removeMember` 는 (이미 멤버인) 요청자가 admin 판정(`:847`)에 이르기 전에 대상 존재
    여부(`:837` `throwMemberNotFound`)를 알 수 있다 — 이 경로 자체는 이번 diff 가 유지한다.
    다만 `listMembers` 는 `assertMembership` 만 요구하고(admin 불요) 워크스페이스의 **모든
    멤버**에 대해 `id`·`userId`·`role` 을 정상 API 로 돌려준다(`:218`, `:231-235` DB 레벨
    프로젝션 확인). 즉 이미 멤버인 요청자는 `removeMember` 를 거치지 않고도 대상의 존재·role(owner
    포함)을 안다 — 이번 diff 가 남기는 "멤버 갈래의 순서 노출"은 새로 얻는 정보가 아니라는
    plan(`plan/in-progress/member-auth-order.md` §B)의 주장이 코드로 확인된다.
  - 제안: 없음(확인 완료). 다만 향후 `listMembers` 의 필요 권한이 admin 이상으로 강화되는 리팩터가
    있다면, 그 시점에 이 논증이 깨지므로 `removeMember` 의 멤버 갈래 순서도 함께 재검토해야 한다 —
    이는 이번 PR 의 스코프는 아니다.

- **[INFO]** 에러 메시지는 민감 정보를 노출하지 않는다
  - 위치: `workspaces.service.ts:913-926` (`throwNotAMember`/`throwAdminRequired`)
  - 상세: 두 헬퍼 모두 고정된 `{code, message}` 페이로드만 던지며 스택 트레이스·쿼리·내부 상태를
    포함하지 않는다. 리터럴을 헬퍼로 추출해 두 발행처(`assertMembership`/`assertAdmin` 과
    `removeMember` 직접 호출)가 문구를 공유하므로 메시지 드리프트로 인한 정보 불일치 위험도 줄었다.
  - 제안: 없음.

- **[INFO]** SQL 인젝션·하드코딩된 시크릿 없음
  - 위치: `workspaces.service.ts` 전체(`getMemberRole`·`removeMember` 등 TypeORM `where` 객체
    기반), `workspace-rbac.e2e-spec.ts:694-697,727-730` (신규 raw SQL, `$1` 포지셔널 파라미터)
  - 상세: 서비스 코드는 TypeORM repository API 만 쓰고 문자열 접합이 없다. 신규 e2e 의 raw
    쿼리도 파라미터화돼 있다. 테스트의 `Bearer ${outsider.accessToken}` 는 런타임에 발급된 토큰이라
    하드코딩된 시크릿이 아니다.
  - 제안: 없음.

- **[INFO]** 잔존 구조적 갭(13-라우트 축)은 이번 diff 가 만든 것이 아니며 이미 별도 항목으로
  트래킹 중이다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (예: `update`·
    `updateSettings`·`listMembers`·`addMember`·`updateMember`·`listInvitations` 등, 경로 `:id`
    를 워크스페이스로 쓰면서 `@Roles()`/`@WorkspaceId()` 둘 다 없는 라우트)
  - 상세: 같은 컨트롤러의 17개 중 13개가 이 PR 이 닫은 `removeMember` 와 동일한 가드 우회
    조건(`@Param('id')` + `handlerConsumesWorkspaceId` false)을 공유한다. 이번 PR 은 그중 한
    자리만 닫았고, `plan/in-progress/spec-draft-nullable-notation-followups.md` diff 에 "구조적
    해법(가드 확장)을 먼저 검토" 조건과 함께 별 항목으로 이미 등재돼 있다(diff 로 확인). 새로
    발견된 갭이 아니라 기존 결정을 확인한 것이므로 CRITICAL/WARNING 이 아니다.
  - 제안: 없음(이 PR 스코프 밖, 이미 추적됨). 후속 PR 이 그 항목을 열 때 각 라우트가 실제로
    무엇을 노출하는지 실측부터 하라는 조건이 이미 박혀 있다.

## 요약

이번 diff 의 핵심(`WorkspacesService.removeMember` 의 인가 판정을 대상 조회보다 앞으로 옮기고,
admin 판정을 owner 판정보다 앞으로 옮긴 것)은 신규 취약점이 아니라 **실제 정보 노출 취약점을
닫는 보안 수정**이다. 가드 계층이 이 라우트를 보호하지 못한다는 코드 주석의 핵심 주장(`@Roles()`
없음 + `handlerConsumesWorkspaceId` false → `RolesGuard` 단축 통과)을 컨트롤러·가드 소스로 직접
확인했고, 신규 e2e 는 그 정확한 우회 조건(헤더 미부착)에서 세 응답이 구분 불가능해졌음을 성질
단언으로 검증한다. 인가는 기존 `assertAdmin`/`assertMembership` 로직의 재배치일 뿐 새 검증 로직이
아니며, 남는 멤버-대상 순서 노출은 `listMembers` 가 이미 같은 정보를 admin 불요로 제공하므로
실질적 추가 노출이 아니다. 에러 메시지는 민감 정보를 담지 않고, SQL 인젝션·하드코딩 시크릿·안전하지
않은 암호화 사용도 없다. 동일 컨트롤러의 13개 라우트가 같은 구조적 갭을 공유하는 것은 사실이지만
이번 PR 이 새로 만든 문제가 아니고 이미 별도 plan 항목으로 스코프 조건과 함께 등재돼 있다.

## 위험도

NONE
