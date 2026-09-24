# 보안(Security) 코드 리뷰 — `member-owner-toctou`

검토 대상: `removeMember()` owner 보호 가드의 TOCTOU 수정 PR.
- `codebase/backend/src/modules/workspaces/workspaces.service.ts`
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
- `codebase/backend/test/member-remove-concurrency.e2e-spec.ts`
- `plan/in-progress/member-owner-toctou.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
- `review/consistency/2026/09/24/07_29_15/**` (consistency-check 산출물, 문서)

이번 diff 자체는 실제로 존재했던 **owner 삭제 TOCTOU 취약점**(동시 `transferOwnership` 이 대상을
owner 로 승격시키는 사이에 무락 가드를 통과한 `DELETE` 가 owner 를 지워 `workspace.ownerId` 가
멤버십 없는 사용자를 가리키게 되는 데이터 무결성 결함)을 원자적 조건부 `DELETE …
WHERE role != 'owner'` + `affected` 판별로 닫는다. 이 자체는 보안 관점에서 **개선**이며, e2e
재진입 테스트(`member-remove-concurrency.e2e-spec.ts`)로 고치기 전 `200`(RED) → 고친 뒤
`403`(GREEN) 을 실측했다.

## 발견사항

- **[WARNING]** `removeMember()` 의 조기 owner 가드가 `assertAdmin()` 보다 먼저 실행되고, 그
  앞에 요청자의 워크스페이스 **멤버십 검사 자체가 없다** — 임의 인증 사용자가 대상 owner 여부·
  멤버 존재 여부를 오라클처럼 읽어낼 수 있다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:815-827`
    (`findOne` → `if (!member) this.throwMemberNotFound();` → self-branch → `if (member.role ===
    'owner') this.throwCannotRemoveOwner();` → 그 다음에야 `await this.assertAdmin(...)`)
  - 상세: `removeMember(workspaceId, memberId, requesterId)` 는 `assertMembership`/`assertAdmin`
    을 전혀 거치지 않은 채 먼저 `{ id: memberId, workspaceId }` 로 대상 멤버를 조회하고, 그 역할이
    `'owner'` 이면 `assertAdmin` 호출 전에 `403 CANNOT_REMOVE_OWNER` 를 던진다(줄 826). 컨트롤러
    쪽도 이 라우트에 `@Roles(...)` 가드가 없다 —
    `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 의
    `@Delete(':id/members/:memberId')` (`removeMember`, 355행 부근)는 클래스 레벨
    `@UseGuards(JwtAuthGuard)`(인증만) 외에 별도 role 가드가 없고, 권한 판단은 전부 서비스
    내부에서 순서대로 이뤄진다(이 파일은 이번 리뷰 diff 에 포함되지 않아 게이트 번호 인용은
    생략하고 `Read` 로 직접 확인한 사실만 적는다).
    그 결과 **워크스페이스에 소속조차 되지 않은** 임의의 로그인 사용자가 `workspaceId`/`memberId`
    쌍을 넣어 이 엔드포인트를 호출하면:
    1. 그 쌍이 존재하지 않으면 `404 MEMBER_NOT_FOUND`
    2. 존재하고 대상이 owner 면 `403 CANNOT_REMOVE_OWNER` (자신이 admin 인지 검사되기 **전**)
    3. 존재하고 대상이 owner 가 아니면, 이어지는 `assertAdmin` 이 비-멤버·비-admin 인 자신을
       걸러 `403 ADMIN_REQUIRED` 를 던진다

    2번과 3번의 에러 코드가 다르므로, 요청자는 자신이 그 워크스페이스의 admin 인지와 무관하게
    **대상이 owner 인지 아닌지를 구분**할 수 있다 — 워크스페이스 소유권 정보를 인가 경계 밖에서
    누출하는 authorization-ordering 결함이다(CWE-862/CWE-203 성격). `spec/data-flow/12-workspace.md:141`
    은 이 엔드포인트를 `owner/admin` 전용으로 규정하므로, 이 순서는 그 계약과도 어긋난다.
    이 코드는 이번 diff 가 **새로 만든 것이 아니다** — 원래 코드에서도 같은 순서였고, 이번 변경은
    그 `if` 문을 `throwCannotRemoveOwner()` 헬퍼 호출로 리팩터링했을 뿐 순서·동작은 그대로다.
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(§F "하지 않는 것")도 "권한 검사
    순서 오라클(이른 CANNOT_REMOVE_OWNER 가 assertAdmin 보다 먼저라 비-admin 에게 대상의 role 을
    흘린다) — 트래커 별 항목이다" 라고 이미 인지·유예하고 있다. 다만 그 서술은 "비-admin **멤버**"
    로 한정해 읽힐 수 있는데, 실제 코드 경로는 **워크스페이스 멤버십조차 없는** 임의 사용자에게도
    똑같이 열려 있어 실제 블라스트 반경이 그 서술보다 넓다 — 이 사실을 다음 planner/developer
    턴에 전달할 가치가 있다.
    부가로, 이 라우트에는(파일 최상단 주석에 따르면 초대 관련 엔드포인트에만 `@Throttle` 이
    적용돼 있다) 별도 rate limit 이 없어, 위 오라클을 대량으로 자동화해 워크스페이스 소유자를
    스캔하는 것을 막는 완화 장치도 없다.
  - 제안: 이번 PR 의 `spec_impact: none`·범위(TOCTOU 판별자 정합성) 자체는 타당하므로 이 항목
    때문에 이 PR 을 막을 필요는 없다. 다만 이미 등재된 "권한 검사 순서 오라클" 트래커 항목을
    처리할 때, 그 서술을 "비-admin 멤버" 가 아니라 "**워크스페이스 비-멤버 포함 임의 인증
    사용자**" 로 넓혀 반영하고, 처방으로 `assertAdmin`/`assertMembership` 을 owner 조기 가드보다
    **먼저** 두도록(순서 반전) 권한다. `updateMemberRole()`(같은 파일 300-317행 부근)은 이미
    `assertAdmin` 을 먼저 호출한 뒤 owner 검사를 하므로, `removeMember` 만 형제와 순서가 다르다.

- **[INFO]** TOCTOU 수정 자체는 인가 경계를 새로 열지 않는다 — 원자성 근거가 검증 가능하게
  기록됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:854-868`
  - 상세: `delete({ id, workspaceId, role: Not('owner') })` 는 TypeORM 파라미터 바인딩을 거치므로
    SQL 인젝션 경로가 없고(`Not('owner')` 는 사용자 입력이 아닌 리터럴), `affected === 0` 뒤의
    재조회(`still`)도 잠그지 않는 이유가 주석에 명시돼 있어(고르는 것은 에러 코드뿐, 실제 삭제
    여부는 이미 원자적 `DELETE` 한 문장이 결정) 재조회 시점의 추가 레이스가 실제 데이터 상태를
    바꾸지 않는다. e2e(`member-remove-concurrency.e2e-spec.ts` 신규 `it`)가 재진입 방식으로
    `UPDATE … SET role='owner'` 를 DELETE 대기 중에 커밋시켜 고치기 전 `200`+행 삭제, 고친 뒤
    `403`+행 보존을 모두 실측했다 — 판별력 있는 회귀 테스트다. 별도 조치 불필요.

- **[INFO]** 신규 e2e/유닛 테스트의 원시 SQL 은 전부 파라미터 바인딩
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` (신규 블록, 206-286행)
  - 상세: `locker.query('UPDATE workspace_member SET role = \'owner\' WHERE id = $1', [memberId])`
    등 모든 쿼리가 `$1`/`$2` 플레이스홀더를 쓰고 사용자 제어 입력을 문자열 결합하지 않는다.
    테스트 전용 코드이고 실 서비스 노출 표면이 아니므로 위험도는 없으나, 좋은 선례로 기록.

- 하드코딩된 시크릿·평문 전송·안전하지 않은 암호화·의존성 취약점: 이번 diff 범위에서 **발견되지
  않음**. `Not`/`FindOperator` 는 이미 사용 중인 TypeORM API 를 재사용한 것이고 신규 의존성
  추가가 없다. 에러 메시지(`CANNOT_REMOVE_OWNER` 등)는 고정 문구·코드만 노출하고 스택트레이스나
  내부 구현 세부사항을 흘리지 않는다.

## 요약

이 PR 이 직접 수정한 로직(원자적 조건부 `DELETE` + `affected` 재해석)은 실제 TOCTOU 데이터
무결성 취약점을 닫는 정당한 보안 개선이며, 새로운 인젝션·시크릿 노출·암호화 결함은 발견되지
않았다. 다만 같은 메서드에 **이미 존재하던**(이번 diff 가 만들지 않은) authorization-ordering
결함 — owner 조기 가드가 `assertAdmin`/멤버십 검사보다 먼저 실행되어, 워크스페이스에 소속되지
않은 임의 인증 사용자도 대상이 owner 인지 여부를 구분해낼 수 있는 문제 — 를 이번 리뷰에서 다시
확인했다. 이 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md` §F 에 이미
별도 트래커 항목으로 등재돼 있어 이 PR 을 막을 사유는 아니지만, 그 서술("비-admin 멤버")보다
실제 블라스트 반경(비-멤버 포함)이 넓다는 점을 다음 처리 턴에 반영할 것을 권한다.

## 위험도

LOW
