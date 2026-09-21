# Security Review — `member-dup-remove` (2026-09-21 13:28:12)

## 검토 범위

`workspaces.service.ts` `removeMember()`/`updateMemberRole()` 리팩터(`throwMemberNotFound()`
추출), 신규 e2e `member-remove-concurrency.e2e-spec.ts`, 단위 테스트 보강, plan/tracker
문서, 그리고 직전 라운드(`review/code/2026/09/21/12_57_05`)의 리뷰 산출물(이미 커밋된
과거 분석 결과물)로 구성된 diff. 실제 애플리케이션 코드 변경은
`codebase/backend/src/modules/workspaces/workspaces.service.ts` 와 그 테스트뿐이다.

## 발견사항

- **[INFO]** `removeMember()` 권한 검사(`assertAdmin`) 순서가 대상 조회·owner 판정보다 뒤에 있어,
  워크스페이스 비멤버도 `(workspaceId, memberId)` 쌍으로 "멤버가 존재하는지" · "owner 인지"를
  세 갈래 응답(`404 MEMBER_NOT_FOUND` / `403 CANNOT_REMOVE_OWNER` / `403 ADMIN_REQUIRED`)으로
  구분해 알아낼 수 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` —
    `findOne`(:800) → `if (!member) this.throwMemberNotFound()`(:803) → self-check(:804) →
    owner 403(:809) → `assertAdmin`(:815). 같은 파일의 형제 Admin+ 메서드
    `updateMemberRole()`(:305, `await this.assertAdmin(...)`이 `findOne`보다 먼저)과 대비된다.
  - 상세: 이번 diff 가 만든 결함이 아니며 순서 자체는 이번 라운드에서 변경되지 않았다(직접
    소스 확인으로 재검증). 직전 라운드(`review/code/2026/09/21/12_57_05`, security WARNING 1)
    가 이미 지적했고, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (2026-09-21 등재분)에 개발자 후속 항목으로 등재되어 있으며, `RESOLUTION.md` 에 "이번 세션
    조치 없음 — `assertAdmin` 선이동은 자가 탈퇴 허용·owner 지목 시 에러 코드 계약 변경을
    수반해 별 PR 필요"라는 근거와 함께 명시적으로 유예되어 있다. 열거 자체는 두 파라미터 모두
    `ParseUUIDPipe` 로 UUID 강제라 다른 경로로 값이 새지 않는 한 실질 악용 난이도가 낮고,
    삭제 실행 자체는 여전히 `assertAdmin` 이 막는다(권한 상승은 아님).
  - 제안: 이미 트래커에 있으므로 이번 PR 을 막을 사유는 아니다. 후속 PR 에서 처방 시 owner
    지목 시 에러 코드가 `CANNOT_REMOVE_OWNER`→`ADMIN_REQUIRED` 로 바뀌는 계약 변경을
    `spec/5-system/3-error-handling.md` 기준 별도 consistency 라운드로 다룰 것(트래커에 이미
    그렇게 적혀 있음 — 재등재 불요).

- **[INFO]** owner 승격 TOCTOU — `member.role === 'owner'` 무락 판정과 원자적 `DELETE` 사이에
  동시 `transferOwnership()` 이 대상을 owner 로 승격시키면 owner 가드를 통과한 채 owner 가
  삭제될 수 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` —
    owner 가드(:809)부터 `delete(...)`(:834-837) 사이 무락 구간. 자기-인지 주석이
    `:829-833`에 있다.
    - `if (member.role === 'owner') { throw new ForbiddenException({ code: 'CANNOT_REMOVE_OWNER', ... }); }`
    - `const { affected } = await this.memberRepository.delete({ id: memberId, workspaceId });`
  - 상세: 개발자가 결정적 재진입 프로브로 실측 재현했다(`status=200`, `rows_remaining=0` —
    owner 가 지워지고 요청이 성공). 이번 diff 의 신규 코드가 아니라 기존 결함이고, 이미
    트래커(`spec-draft-nullable-notation-followups.md`)에 재현 레시피·후보 처방
    (`delete({..., role: Not('owner')})` + `affected===0` 시 재조회로 원인 분기)과 함께
    등재되어 있다. 이 PR 이 세우는 `affected===0` 판별자(감사 중복 방지용)를 후속 처방이
    두 가지 의미로 오버로드하게 되므로, 판별자 오염을 피하려 의도적으로 별도 PR 로 유예한
    설계 판단은 타당하다.
  - 제안: 병합을 막을 사유는 아님. 후속 PR 에서 후보 처방을 자체 뮤테이션 테스트와 함께 반드시
    닫을 것 (이미 트래커에 있음 — 재등재 불요).

## 긍정적으로 확인한 사항 (참고)

- 신규 원자적 삭제(`this.memberRepository.delete({ id: memberId, workspaceId })`)와 조회
  (`findOne({ where: { id, workspaceId } })`)는 모두 TypeORM 이 파라미터 바인딩하는 객체
  criteria 이며, 원시 SQL 문자열 결합이 없다 — SQL 인젝션 표면 없음.
- 신규 e2e (`codebase/backend/test/member-remove-concurrency.e2e-spec.ts`)의 원시 SQL도
  전부 `$1`/`$2` 파라미터 바인딩(`pg` 드라이버)만 쓴다 — 인젝션 위험 없음.
  (`SELECT id FROM workspace_member WHERE id = $1 FOR UPDATE`,
  `SELECT COUNT(*) ... WHERE resource_id = $1` 등)
- `removeMember` 의 `requesterId` 는 컨트롤러에서 `@CurrentUser() user: JwtPayload` →
  `user.sub` 로 주입되며(`workspaces.controller.ts` `removeMember()`), 클라이언트가 body/쿼리로
  주입할 수 있는 값이 아니다 — 요청자 위장(authorization bypass via parameter spoofing) 경로
  없음.
- `throwMemberNotFound(): never` 추출은 기존 `NotFoundException({ code: 'MEMBER_NOT_FOUND',
  message: '멤버를 찾을 수 없습니다.' })` 리터럴을 그대로 옮긴 순수 리팩터다 — 에러 코드·
  메시지·정보 노출 수준에 변화 없음. `updateMemberRole()`/`removeMember()` 두 호출부가
  동일 문구를 공유하도록 통합됐고, `transferOwnership()` 의 별도 "대상 멤버를 찾을 수
  없습니다." 문구와는 의도적으로 분리되어 있어(JSDoc 주석에 명시) API 응답 메시지가 조용히
  바뀌는 회귀는 없다.
- 하드코딩된 시크릿(API 키·비밀번호·토큰·인증서) 패턴을 diff 전체에서 grep 했으나 발견되지
  않았다. 테스트의 `accessToken`/`ownerToken` 은 `registerAndLogin` 헬퍼가 런타임에 발급한
  값을 담는 변수일 뿐이다.
- 감사 로그(`auditLogsService.record`) 호출에 담기는 필드(`workspaceId`, `userId`,
  `action`, `resourceType`, `resourceId`, `details: { mode, memberUserId }`)는 기존
  스키마와 동일하며 새로 추가된 민감 필드가 없다.

## 요약

이번 diff 의 실질 애플리케이션 코드 변경은 `removeMember()`/`updateMemberRole()`의
`MEMBER_NOT_FOUND` 처리를 `throwMemberNotFound()` 헬퍼로 통합한 리팩터와, 동시 삭제 요청이
감사 로그를 중복 기록하던 결함을 원자적 `DELETE` + `affected === 0` 명시 비교로 막은 수정이다.
두 변경 모두 인젝션·시크릿 노출·인가 우회를 새로 만들지 않으며, ORM 파라미터 바인딩과
파라미터화된 SQL만 사용한다. 이번 라운드에서 새로 발견된 보안 결함은 없다. 리뷰 중 확인한
두 개의 기존 취약점(권한 검사 순서로 인한 존재/owner 오라클, owner 승격 TOCTOU)은 모두 이번
diff 가 만든 것이 아니라 직전 리뷰 라운드에서 이미 지적·실측·등재·유예된 사안이며, 코드
자체를 대조해 순서·구간이 이번 라운드에서 변경되지 않았음을 재확인했다. 두 사안 모두 병합을
막을 사유는 아니지만 후속 PR 에서 반드시 닫아야 할 항목으로 트래커에 남아 있다.

## 위험도

LOW
