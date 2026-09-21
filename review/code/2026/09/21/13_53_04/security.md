# Security Review — `member-dup-remove` (2026-09-21 13:53:04, 3차 라운드)

## 검토 방법

`origin/main...HEAD` 기준 실제 애플리케이션 코드 변경은 이전 두 라운드(`12_57_05`, `13_28_12`)와
동일하게 3개 파일뿐이다(`git diff origin/main...HEAD --stat -- codebase/` 로 재확인: `workspaces.service.ts`
+62/-20, `workspaces.service.spec.ts` +163, 신규 `member-remove-concurrency.e2e-spec.ts` +208 — 총
413 삽입/20 삭제, 3파일). 이번 라운드에 새로 추가된 것은 `review/code/2026/09/21/12_57_05/RESOLUTION.md`
등 리뷰/조치 기록 산출물과 문서 정정 커밋(`6f1113a70`, "형제 다섯은 전부 204가 틀렸다")뿐이며, 둘 다
`codebase/`를 건드리지 않는다. `workspaces.service.ts`/`workspaces.controller.ts` 를 직접 열어 현재
줄 번호(`removeMember` 795, `findOne` 800, `!member` 803, self-check 804, owner 가드 809, `assertAdmin`
815, `delete` 834, `affected === 0` 838)가 diff 게이트와 일치함을 확인했다. 저장소 파일은 뮤테이션하지
않았고(`Read`/`Bash grep`/`sed -n` 만 사용), `git status --short` 로 이 세션이 남긴 변경이 없음을 확인했다.

## 발견사항

- **[INFO]** `removeMember()` — 권한 검사(`assertAdmin`)가 대상 존재·owner 판정보다 뒤에 있어, 워크스페이스
  비멤버도 `(workspaceId, memberId)` 쌍으로 "멤버 존재 여부"·"owner 여부"를 응답 코드로 구분해 알아낼 수
  있다 (이번 diff 가 만든 결함 아님 — 3라운드 연속 재확인, 이미 트래커 등재·유예됨)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:795`(`removeMember` 시작) ~
    `:815`(`assertAdmin` 호출). 대비되는 형제 메서드: `updateMemberRole()`(`:300`)은 `assertAdmin`을
    `:306`에서 `findOne`(`:307`)보다 **먼저** 호출한다. 컨트롤러(`workspaces.controller.ts:355-373`)는
    `removeMember` 라우트에 클래스 레벨 `@UseGuards(JwtAuthGuard)` 외 `@Roles` 가드를 두지 않아, 인가
    판단 전부가 서비스 메서드 내부 호출 순서에 의존한다.
  - 상세: 순서가 `findOne(무락) → !member 404 → self-check → owner-role 403 → assertAdmin`이므로, 요청자가
    그 워크스페이스의 admin/owner가 아니어도 `404 MEMBER_NOT_FOUND`·`403 CANNOT_REMOVE_OWNER`·
    `403 ADMIN_REQUIRED` 세 응답이 권한 확인 이전에 갈린다(CWE-863/CWE-203 계열). `workspaceId`·`memberId`
    모두 컨트롤러에서 `ParseUUIDPipe`로 형식 검증되어 blind guessing 난도는 낮지 않으나, ID가 이미 노출된
    경우(과거 멤버·로그·URL 공유) 정보 노출 경로가 된다. `requesterId`는 `@CurrentUser() user.sub`(JWT)에서만
    오며 클라이언트가 body/쿼리로 위조할 수 없음을 컨트롤러 소스로 재확인했다 — 요청자 위장 경로는 없다.
    이 항목은 1라운드(`12_57_05/security.md` WARNING 1)에서 최초 지적, 2라운드(`13_28_12/security.md`)에서
    "이미 트래커에 등재·유예됨 + 재현 난도 낮음"을 근거로 INFO 로 하향됐다. 이번 3라운드에서도 코드 순서·
    컨트롤러 가드 구성에 변화가 없음을 직접 대조 확인했고, `plan/in-progress/spec-draft-nullable-notation-followups.md:4833-4873`
    에 재현·처방(에러 코드 계약 변경 포함)이 여전히 등재돼 있어 유예 판단을 유지한다.
  - 제안: 이번 PR 을 막을 사유 아님 — 재등재 불요(이미 트래커에 있음). 후속 PR 에서 `assertAdmin`을
    `findOne` 직후로 옮길 때 owner 지목 시 에러 코드가 `CANNOT_REMOVE_OWNER`→`ADMIN_REQUIRED`로 바뀌는
    계약 변경을 `spec/5-system/3-error-handling.md` 기준으로 별도 검토할 것(트래커에 이미 명시).

- **[INFO]** owner 승격 TOCTOU — `member.role === 'owner'` 무락 판정과 원자적 `DELETE` 사이에 동시
  `transferOwnership()`이 대상을 owner로 승격시키면 owner가 삭제될 수 있다 (신규 회귀 아님, 3라운드 연속
  재확인·실측 재현·트래커 등재·의도적 유예 완료)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:809`(무락 owner 가드) ~
    `:834-838`(`delete({id, workspaceId})` → `affected === 0` 판정). 자기-인지 주석 `:829-833`.
  - 상세: `:800`의 무락 `findOne` 스냅샷을 owner 가드(`:809`)와 `assertAdmin`(`:815`)이 그대로 쓴다. 이
    판정과 `:834`의 `DELETE` 사이 창에서 동시 `transferOwnership()`이 같은 멤버를 owner로 승격시키면
    `removeMember()`는 재검사 없이 `DELETE`를 실행해 owner 행을 지운다. `affected === 0` 판별자는 "행이
    사라졌는가"만 구분할 뿐 "owner로 바뀌었는가"는 구분하지 못하므로 이 창에서 owner 삭제가 200으로
    성공한다. `plan/in-progress/member-dup-remove.md` §C-2, `plan/in-progress/spec-draft-nullable-notation-followups.md:4840-4872`
    에 재진입 기법으로 실측 재현(`status=200, rows_remaining=0`)됐고, 후보 처방(`delete({..., role: Not('owner')})`
    + 0행 시 재조회로 "행없음 vs owner 승격" 원인 분기)까지 문서화돼 있다. 판별자 오염(같은 `affected===0`이
    두 의미를 가지게 됨)을 피하려 별도 PR로 유예한 설계 판단은 타당하다.
  - 제안: 이번 PR 범위 밖으로 유지 — 재등재 불요. 후속 PR에서 `role: Not('owner')` + 0행 원인 재조회
    처방을 적용할 때 뮤테이션 테스트를 반드시 짝지을 것.

- **[INFO]** 인젝션·시크릿·에러 노출 — 신규 문제 없음 (3라운드 연속 재확인)
  - 상세: `memberRepository.delete({id, workspaceId})`/`findOne({where:{...}})` 모두 TypeORM 객체
    criteria로 파라미터 바인딩되어 SQL 인젝션 표면이 없다. 신규 e2e(`member-remove-concurrency.e2e-spec.ts`)의
    원시 SQL도 전부 `$1`/`$2` 바인딩만 사용함을 `grep`으로 확인했다(문자열 결합 없음). 하드코딩된 시크릿·
    API 키·비밀번호·인증서 패턴은 `codebase/`·`plan/`·`review/**` 전체에서 발견되지 않았다 — 테스트의
    `ownerToken`/`leaver.accessToken`은 `registerAndLogin` 헬퍼가 런타임에 발급하는 값을 담는 변수일 뿐이다.
    에러 메시지(`'멤버를 찾을 수 없습니다.'` 등)는 스택 트레이스·내부 구현 정보를 노출하지 않는다.
    `requesterId`는 JWT `user.sub`에서만 오며 클라이언트 입력으로 위조 불가함을 컨트롤러에서 확인했다.

## 요약

이번 3차 라운드는 `codebase/` 코드를 전혀 추가로 변경하지 않았다 — 새로 커밋된 것은 이전 라운드의
리뷰/조치 기록(`RESOLUTION.md` 등)과 e2e 주석·plan 문서의 사실 정정(`6f1113a70`, "형제 다섯은 전부
204"가 컨트롤러별로 갈린다는 실측 정정)뿐이며 둘 다 보안에 영향이 없다. 핵심 프로덕션 변경(`removeMember()`의
무락 `remove(entity)` → 원자적 `delete({id, workspaceId})` + `affected === 0` 명시 판정, `throwMemberNotFound()`
리팩터)은 1·2라운드에서 이미 검증된 대로 새 취약점을 도입하지 않는다. 리뷰 중 재확인한 두 개의 기존
이슈 — (1) `assertAdmin` 호출 순서가 존재/owner 확인보다 뒤에 있어 발생하는 권한-무관 정보 오라클,
(2) owner 승격 TOCTOU — 는 모두 이번 diff가 만든 것이 아니고 이미 1라운드에서 지적·2라운드에서 재확인·
트래커 등재·유예가 끝난 사안이며, 코드·컨트롤러 구성이 이번 라운드에서도 변경되지 않았음을 직접 소스
대조로 재확인했다. 신규 보안 결함은 없다.

## 위험도

LOW
