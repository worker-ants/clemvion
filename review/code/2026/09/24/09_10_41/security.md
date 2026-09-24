# 보안(Security) 리뷰 — `removeMember()` owner 보호 가드 TOCTOU 수정

## 검증 방법

`codebase/backend/src/modules/workspaces/workspaces.service.ts`(`removeMember`/
`throwCannotRemoveOwner`/`assertAdmin`), `workspaces.controller.ts`(`removeMember` 핸들러),
`workspaces.service.spec.ts` diff, `test/member-remove-concurrency.e2e-spec.ts`,
`test/helpers/concurrency.ts`, `test/integration-rotate-concurrency.e2e-spec.ts`,
그리고 인가 오라클 주장을 직접 확인하려고 `codebase/backend/src/common/guards/roles.guard.ts` 와
`codebase/backend/src/common/decorators/workspace.decorator.ts`(`handlerConsumesWorkspaceId`)를
`Read`/`grep` 으로 열었다. 저장소 파일은 뮤테이션하지 않았다 — 전량 읽기 전용 확인이며
`git status --short` 결과 이 리뷰 세션의 산출 디렉터리(`review/code/2026/09/24/09_10_41/`) 외
변경 없음을 확인했다.

## 발견사항

- **[WARNING]** `removeMember` 핸들러가 `RolesGuard` 를 완전히 단락해, 워크스페이스 비멤버를
  포함한 임의 인증 사용자가 멤버 존재 여부·owner 여부를 오라클링할 수 있다 (diff 가 만든 결함은
  아니고 이번 diff 로 노출 범위가 재확인·문서화된 기존 결함)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:826`(이른 owner 가드)
    `:827`(`assertAdmin` 호출) — 순서가 `role==='owner'` 판정을 권한 검사보다 먼저 수행한다.
    함께 확인한 근거: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:355-374`
    (`removeMember` 핸들러에 `@Roles(...)` 데코레이터가 없고, 워크스페이스 id 를
    `@WorkspaceId()` 가 아니라 평범한 `@Param('id')` 로 받는다) ·
    `codebase/backend/src/common/guards/roles.guard.ts:114-119`(`!needsRoleCheck &&
    !handlerConsumesWorkspaceId(...)` 면 멤버십 검사 없이 `return true`) ·
    `codebase/backend/src/common/decorators/workspace.decorator.ts`
    (`handlerConsumesWorkspaceId` 는 `@WorkspaceId()` factory identity 만 인식, 단순 `@Param()`
    은 인식하지 않음).
  - 상세: 세 조건이 겹쳐 `DELETE /api/workspaces/:id/members/:memberId` 는 `RolesGuard` 의
    멤버십 검사를 아예 타지 않는다 — ①핸들러에 `@Roles()` 없음, ②워크스페이스 id 를
    `@WorkspaceId()` 로 소비하지 않음(따라서 `handlerConsumesWorkspaceId` false), ③
    이 둘의 AND 가 `RolesGuard.canActivate` 의 조기 `return true` 조건과 정확히 일치한다.
    결과적으로 유효한 JWT 만 있으면 그 워크스페이스에 소속돼 있지 않은 사용자도 이 라우트를
    호출할 수 있고, 서비스 계층의 순서(존재 확인 → owner 조기 판정 → `assertAdmin`)가 응답
    코드를 셋으로 가른다: 대상이 그 워크스페이스에 없으면 404 `MEMBER_NOT_FOUND`, 있고
    owner 면 403 `CANNOT_REMOVE_OWNER`(`assertAdmin` 이전이므로 요청자의 멤버십과 무관하게
    도달), 있고 owner 가 아니면 403 `ADMIN_REQUIRED`(요청자가 그 워크스페이스 admin 이 아닐
    때). 이 세 응답의 구분만으로 비멤버가 "이 workspaceId 에 이 memberId 가 존재하는가" 와
    "그 멤버가 owner 인가" 를 알아낼 수 있다 — 실제 DELETE(상태 변경)는 `assertAdmin` 이
    막으므로 데이터 정합성 침해나 권한 상승은 아니고, 정보 노출(IDOR 성격의 존재/역할 오라클)
    에 그친다.
  - 이 이슈는 이번 diff 가 새로 만든 것이 아니다 — `member.role === 'owner'` 검사가
    `assertAdmin` 보다 앞서는 순서는 diff 전(`#1373`)부터 있었고, 이번 PR 은 그 리터럴을
    `throwCannotRemoveOwner()` 헬퍼로 추출했을 뿐 순서를 바꾸지 않았다. 저장소 자체도
    이를 인지하고 있다 — `CHANGELOG.md` 최상단 항목("남는 것")과
    `plan/in-progress/member-owner-toctou.md` §F 가 "권한 검사 순서 오라클... 노출 대상은
    「비-admin 멤버」가 아니라 **임의 인증 사용자**다"라고 정확히 같은 결론을 별도 트래커
    항목으로 이미 등재해 뒀고, 직전 두 리뷰 라운드(`review/code/2026/09/24/08_09_57/concurrency.md`,
    `.../requirement.md`)도 같은 지점을 INFO 로 짚고 "이 PR 계약과 다른 별개 사안"으로 스코프
    밖 처리했다. 독립적으로 가드 코드를 추적해 그 결론이 실제 코드와 부합함을 확인했다.
  - 제안: 이 PR 자체를 막을 사유는 아니다(스코프가 다르고 이미 등재됨). 다만 별도 트래커
    항목(순서 오라클)의 해소책으로 "`assertAdmin` 을 존재/역할 판정보다 먼저 수행"으로
    재정렬하거나, 최소한 비멤버에게는 존재 여부와 무관하게 동일한 403(예: 멤버십 부재 403)을
    먼저 반환하도록 순서를 바꾸는 방안을 권장 — 이미 등재된 그 항목에서 다룰 내용이라
    여기서는 재등재하지 않는다.

## 점검 관점별 확인 (문제 없음)

- **인젝션(SQL/커맨드/경로 등)**: 신규 DELETE 술어 `role: Not('owner')` 는 TypeORM
  `FindOperator` 로 파라미터 바인딩되며 문자열 결합이 없다(`workspaces.service.ts:857`).
  신규 e2e(`member-remove-concurrency.e2e-spec.ts`)의 raw SQL(`SELECT ... FOR UPDATE`,
  `UPDATE ... SET role = 'owner' WHERE id = $1`, 감사 조회)도 전부 `$1`/`$2` 파라미터
  플레이스홀더를 쓰고 사용자 입력을 직접 문자열 보간하지 않는다. 커맨드 인젝션·경로 탐색
  해당 코드 없음.
- **하드코딩된 시크릿**: diff 전체(`codebase/`, `plan/`, `CHANGELOG.md`)에서 API 키·비밀번호·
  토큰·인증서 패턴을 grep 했으나 실제 시크릿 값은 없다(`ownerToken`/`targetOnReread` 등은
  변수명일 뿐 값이 아님).
- **인증/인가(신규 로직 자체)**: `role: Not('owner')` 술어를 원자적 DELETE 문 안에 넣고
  Postgres READ COMMITTED 의 EvalPlanQual 재평가에 의존하는 설계는 새 락을 들이지 않고도
  올바르게 원자적이다 — `transferOwnership()` 이 대상 행에 `pessimistic_write` 를 쥔 채
  커밋하므로 겹친 DELETE 는 최신 행 버전에 대해 조건을 재평가해 제외된다. 이 부분은 인가
  우회를 새로 만들지 않는다.
- **0-행 재조회의 제3 상태**: 직전 라운드에서 지적된 "재조회가 강등된 행을 볼 때 `still?.role
  === 'owner'` 로 판정하면 실재하는 멤버를 404 로 잘못 보고한다"는 갈래는 이번 커밋에서
  `if (still) this.throwCannotRemoveOwner();`(`workspaces.service.ts:871`)로 분기 형태 자체를
  바꿔 해소됐다 — 존재 여부만으로 판정하므로 강등 연쇄에도 "막은 것은 owner였다"는 사실과
  일치한다. 새 단위 테스트 2건(`workspaces.service.spec.ts`)이 owner 승격/강등 두 갈래를
  각각 고정한다.
- **암호화**: 해시/암호화 알고리즘 변경 없음. 평문 전송 관련 변경 없음.
- **에러 처리**: `throwCannotRemoveOwner()`/`throwMemberNotFound()` 는 고정된 code/message
  만 던지고 스택 트레이스·내부 쿼리·DB 에러 원문을 응답에 노출하지 않는다.
- **의존성 보안**: 신규 의존성 추가 없음(`typeorm` 의 기존 `Not` export 를 새로 import).

## 요약

핵심 변경(`removeMember` DELETE 문에 `role: Not('owner')` 원자 술어 추가)은 SQL 인젝션·
평문 전송·시크릿 하드코딩·암호화 약화 등 전형적 보안 결함을 새로 만들지 않으며, 직전 라운드에서
지적된 재조회 제3-상태 오분류도 `if (still)` 판정으로 정확히 해소됐다. 유일한 보안 성격의
관찰은 `removeMember` 핸들러가 `RolesGuard` 의 멤버십 검사를 구조적으로 단락해 워크스페이스
비멤버를 포함한 임의 인증 사용자가 멤버 존재·owner 여부를 오라클링할 수 있다는 것인데, 이는
이번 diff 가 만든 결함이 아니라 diff 이전부터 있던 순서 문제이고 저장소가 이미 정확한 블라스트
반경("비-admin 멤버"가 아니라 "임의 인증 사용자")으로 별도 트래커 항목에 등재해 둔 상태임을
코드 추적으로 직접 확인했다. 이번 PR 을 막을 사유는 아니며, 별도 항목에서 순서 재정렬로
해소할 사안이다.

## 위험도

LOW
