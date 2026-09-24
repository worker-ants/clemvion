# 보안(Security) 코드 리뷰 — `member-owner-toctou` (2라운드)

검토 대상: `removeMember()` owner 보호 가드 TOCTOU 수정 PR — 1라운드
(`review/code/2026/09/24/08_09_57`) WARNING 6건 조치 후 재검토.

- `codebase/backend/src/modules/workspaces/workspaces.service.ts`
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
- `codebase/backend/test/helpers/concurrency.ts`
- `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts`
- `codebase/backend/test/member-remove-concurrency.e2e-spec.ts`
- `plan/in-progress/member-owner-toctou.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
- `CHANGELOG.md`
- `review/code/2026/09/24/08_09_57/**`, `review/consistency/2026/09/24/07_29_15/**` (1라운드 산출물, 문서)

이번 diff 는 `removeMember()` 의 `member.role === 'owner'` 이른 가드를
`throwCannotRemoveOwner()` 헬퍼로 추출하고, DELETE 문에 `role: Not('owner')` 술어를 넣어
동시 `transferOwnership` 에 의한 owner 삭제 TOCTOU 를 원자적으로 막는다. `affected === 0`
분기의 재조회 판별을 `still?.role === 'owner'` → `if (still)` 로 좁혀 "존재하는데 owner
아님"이라는 도달 불가능한 제3 상태를 근거로 실재 멤버를 404 로 잘못 보고하던 결함도
같이 없앴다. 이 자체는 데이터 무결성·보안 양쪽에서 개선이며, 신규 SQL 인젝션·시크릿
노출·안전하지 않은 암호화 경로는 발견되지 않았다.

`workspaces.service.ts`, `workspaces.controller.ts`, `roles.guard.ts`,
`workspace.decorator.ts` 를 직접 열어 소스로 재확인했다(아래 각 항목에 파일:줄 표기).

## 발견사항

- **[WARNING]** (1라운드에서 이미 식별·트래커 등재됨 — 이번 diff 가 만든 것도, 고친 것도
  아니다. 코드가 실제로 그대로인지 재확인차 다시 열어 봤고, **그대로다**) `removeMember()`
  라우트는 `RolesGuard` 의 멤버십 검사 자체를 통과하지 않고 서비스 내부의 owner 이른
  가드가 `assertAdmin()` 보다 먼저 실행돼, **워크스페이스 비-멤버를 포함한 임의 인증
  사용자**가 대상이 owner 인지 여부를 오라클처럼 구분해낼 수 있다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:355-372`
    (`@Delete(':id/members/:memberId')` — `@Roles()` 없음, `@Param('id')` 사용·
    `@WorkspaceId()` 미사용) · `codebase/backend/src/common/guards/roles.guard.ts`
    (`canActivate` — `!needsRoleCheck && !handlerConsumesWorkspaceId(...)` 면
    `return true`) · `codebase/backend/src/common/decorators/workspace.decorator.ts`
    (`handlerConsumesWorkspaceId` — `@WorkspaceId()` 를 실제로 쓰는 핸들러인지 reflection
    으로만 판별) · `codebase/backend/src/modules/workspaces/workspaces.service.ts:818-827`
    (`findOne` 무락 조회 → `if (member.role === 'owner') this.throwCannotRemoveOwner();`
    → 그 다음에야 `await this.assertAdmin(...)`)
  - 상세: `removeMember` 컨트롤러 메서드는 `@Param('id')` 로 `workspaceId` 를 받고
    `@WorkspaceId()` 를 쓰지 않으므로, `handlerConsumesWorkspaceId` 는 이 핸들러에 대해
    `false` 를 반환한다. 이 라우트엔 `@Roles()` 도 없으므로 `RolesGuard.canActivate` 의
    `!needsRoleCheck && !handlerConsumesWorkspaceId(...)` 조건이 참이 되어 **멤버십 조회
    없이 `return true`** 한다(전역 `APP_GUARD` 지만 이 라우트에서는 사실상 무동작). 이어서
    서비스는 `assertMembership`/`assertAdmin` 을 거치지 않은 채 대상 멤버를 무락으로
    조회하고, `member.role === 'owner'` 이면 요청자의 권한을 전혀 검사하지 않고
    `403 CANNOT_REMOVE_OWNER` 를 던진다(826행). 그 결과 워크스페이스에 소속조차 안 된
    임의 인증 사용자가 `workspaceId`/`memberId` 쌍을 넣어 호출하면:
    1. 쌍이 존재하지 않으면 `404 MEMBER_NOT_FOUND`
    2. 존재하고 대상이 owner 면 `403 CANNOT_REMOVE_OWNER` (자신의 권한 검사 이전)
    3. 존재하고 대상이 owner 가 아니면, 뒤이은 `assertAdmin` 이 비-멤버인 자신을 걸러
       `403 ADMIN_REQUIRED` 를 던짐

    2·3 의 에러 코드가 다르므로 요청자는 자신의 권한과 무관하게 **대상이 owner 인지
    아닌지**를 알아낼 수 있다(CWE-862 Missing Authorization / CWE-203 Observable
    Discrepancy 성격). `spec/data-flow/12-workspace.md:141` 은 이 동작을 owner/admin
    전용으로 규정하므로 계약과도 어긋난다. `updateMemberRole()`(같은 파일, `assertAdmin`
    을 owner 검사보다 먼저 호출)만 형제와 순서가 다르다 — `removeMember` 단독 결함이다.
  - **이번 diff 의 위치**: 이 순서·가드 통과 여부는 이번 PR 이 만든 것이 아니다. 이번
    diff 는 `if (member.role === 'owner') { throw ... }` 를
    `if (member.role === 'owner') this.throwCannotRemoveOwner();` 로 리팩터링했을 뿐
    (`workspaces.service.ts:826`), 검사 순서·컨트롤러 가드 구성은 그대로다. 1라운드
    리뷰(W2)가 이미 지적했고, 이번 PR 의 `plan/in-progress/member-owner-toctou.md` §F 가
    "노출 대상은 «비-admin» 이 아니라 **임의 인증 사용자**" 로 블라스트 반경 서술을
    정정해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 항목이
    참조할 근거를 남겼다(코드 자체는 이 PR 스코프 밖으로 유예).
  - 제안: 이 PR 을 막을 사유는 아니다(범위가 TOCTOU 판별자 정합성으로 명확히 한정돼
    있고, 트래커 항목이 정확한 블라스트 반경으로 등재돼 있다). 다만 트래커 처리 시
    `assertAdmin`(또는 최소 `assertMembership`) 을 owner 이른 가드보다 **먼저** 두는
    순서 반전을, 컨트롤러에 `@Roles('admin')` 을 추가하거나 `@WorkspaceId()` 를 함께
    받도록 하는 방식(가드 레벨에서부터 멤버십 검사가 걸리도록)과 같이 검토할 것을 권한다.

- **[INFO]** 이번 diff 가 넓힌 재조회 판별(`if (still)`)이 오라클을 새로 벌리지 않는다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:859-872`
  - 상세: `affected === 0` 뒤 재조회가 `still` 존재만 확인하도록 좁혀졌다(종전
    `still?.role === 'owner'`). DELETE 술어가 `role` 하나뿐이므로 행이 남아 있는데
    0행이었다면 DELETE 평가 시점에 owner 였다는 뜻 말고는 없어 논리적으로 건전하다.
    이 분기는 실제 레이스(동시 `transferOwnership`) 가 벌어졌을 때만 도달하고,
    `transferOwnership` 자체가 owner 권한(`@Roles('owner')`, 컨트롤러 246행 부근)을
    요구하므로 위 W2 오라클처럼 **비-owner 단독 행위자가 스스로 촉발**할 수 있는 경로가
    아니다 — 협조하는 owner 가 필요하다. 새 정보 노출 경로로 보지 않는다.

- **[INFO]** 신규 e2e 재진입 테스트의 원시 SQL 은 전부 파라미터 바인딩
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` (신규 블록,
    `it('제거 중 대상이 owner 로 승격되면 지우지 않고 403 이다', ...)`)
  - 상세: `locker.query("UPDATE workspace_member SET role = 'owner' WHERE id = $1", [memberId])`
    등 모든 쿼리가 `$1` 플레이스홀더를 쓰고 사용자 제어 입력을 문자열 결합하지 않는다.
    테스트 전용 코드라 실 서비스 노출 표면은 아니지만 좋은 선례.

- **[INFO]** `Not('owner')` 는 TypeORM 파라미터 바인딩을 거치므로 SQL 인젝션 경로 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:854-858`
  - 상세: `Not('owner')` 의 인자는 사용자 입력이 아닌 고정 리터럴이고, `delete()` 호출
    전체가 TypeORM QueryBuilder 파라미터화를 거친다(`EntityManager.delete` →
    `normalizeAndValidateWhereCriteria`). 별도 조치 불필요.

- 하드코딩된 시크릿·평문 전송·안전하지 않은 해시/암호화·알려진 취약 의존성: 이번 diff
  범위에서 **발견되지 않음**. `Not`/`FindOperator` 는 기존 사용 중인 TypeORM API 재사용이고
  신규 의존성 추가가 없다. 에러 메시지(`CANNOT_REMOVE_OWNER` 등)는 고정 문구·코드만
  노출하고 스택트레이스·내부 구현 세부사항을 흘리지 않는다. 리뷰 산출물 파일들
  (`review/**`, `plan/**`)에도 API 키·비밀번호·토큰류는 없다.

## 요약

이번 PR 이 직접 수정한 로직(원자적 조건부 `DELETE … WHERE role != 'owner'` + `affected`
재해석, 그리고 재조회 판별을 존재-여부로 좁힌 것)은 실제 TOCTOU 데이터 무결성 취약점을
정당하게 닫으며 새로운 인젝션·시크릿 노출·암호화 결함을 만들지 않는다. 1라운드에서 식별된
`removeMember()` 의 authorization-ordering 결함(owner 이른 가드가 `assertAdmin`/멤버십
검사보다 먼저 실행되어 임의 인증 사용자가 owner 여부를 오라클처럼 알아낼 수 있는 문제)은
소스를 재확인한 결과 이번 diff 에도 **그대로 남아 있다** — 이 PR 이 만든 결함도, 고친
결함도 아니며, 이미 정확한 블라스트 반경(비-멤버 포함 임의 인증 사용자)으로 트래커에
등재돼 이 PR 을 막을 사유는 아니다.

## 위험도

LOW
