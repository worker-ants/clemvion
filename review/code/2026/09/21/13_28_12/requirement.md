# 요구사항(Requirement) 리뷰 — `WorkspacesService.removeMember()` 동시 삭제 감사 중복 수정 (fresh review, post-resolution)

## 검토 방법

이 diff(`origin/main...HEAD`, 28개 파일)에는 코드 3개 파일 외에 직전 라운드
(`review/code/2026/09/21/12_57_05`)의 산출물과 그 RESOLUTION 이 함께 포함돼 있다. 즉 이번
요청은 "1차 리뷰 → 조치 → 재리뷰"의 재리뷰(fresh review after resolution) 단계다. RESOLUTION.md 가
주장하는 조치(WARNING #3·#4·#5 fix)가 실제 워킹트리 코드에 반영됐는지를 diff 만이 아니라 `Read`로
현재 파일 상태를 직접 열어 대조했고, `npx jest workspaces.service.spec.ts`(75/75 PASS)와
`npx tsc --noEmit`(에러 0)을 재실행해 확인했다.

## 발견사항

- **[INFO]** RESOLUTION.md 가 주장한 조치 3건이 실제 코드에 정확히 반영됨을 직접 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:342-347`(`throwMemberNotFound(): never` 신설, `:310`·`:803`·`:838` 세 판정에서 재사용), `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:38-41`(`getAudit()` 최상위 1회 정의, 옛 지역 정의 두 곳 제거 확인 — `grep -c "function getAudit"` = 1), `:1565-1576`(`ADMIN_REQUIRED` 거부 테스트 신규)
  - 상세: `transferOwnership()`의 별도 "대상 멤버를 찾을 수 없습니다." 메시지(`:757`)는 의도대로 헬퍼로 흡수되지 않고 남아 있어, JSDoc이 스스로 밝힌 "메시지가 달라 재사용하지 않는다"는 설계와 실제 코드가 정확히 일치한다. camelCase 리네임(`WS`/`MEMBER_ID`/`REQUESTER` → `workspaceId`/`memberId`/`requesterId`)도 `:1460-1462`에서 확인됨. `npx jest`는 75/75 PASS, `npx tsc --noEmit`는 에러 0 — RESOLUTION.md의 TEST 결과 주장과 실측이 일치한다.
  - 제안: 없음 — 조치가 진짜로 이뤄졌음을 재확인.

- **[WARNING]** owner 승격 TOCTOU — `member.role === 'owner'` 무락 판정과 원자적 `DELETE` 사이에 동시 `transferOwnership()`이 대상을 owner로 승격시키면 owner가 삭제될 수 있음 (이번 PR이 만든 결함은 아니고, 재현·문서화·의도적 유예까지 완료된 기존 갭 — 직전 라운드 4개 리뷰어가 공통 지적한 것과 동일)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:809-814`(owner 가드) ~ `:834-837`(`delete({id, workspaceId})`, `role` 조건 없음)
  - 상세: 직접 코드를 읽어 재확인 — WHERE 절에 `role`이 없어 owner 가드 통과 후 승격되면 그대로 지워진다. `plan/in-progress/member-dup-remove.md` §C-2가 재진입 기법으로 `status=200, rows_remaining=0`을 실측했고, `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-21 항목)에 후보 처방(`delete({..., role: Not('owner')})` + 0행 재조회 분기)까지 등재돼 있다. `affected===0`의 의미를 이 PR에서 둘로 늘리지 않기 위해 분리했다는 근거는 판별자 오염을 정확히 짚은 타당한 논리다.
  - 제안: 코드 변경 불요 — 이번 PR 스코프 밖으로 이미 트래커에 등재·유예됨. 후속 PR에서 후보 처방을 뮤테이션 테스트와 함께 반드시 닫을 것(우선순위 유지 권고, 신규 조치 아님).

- **[WARNING]** `removeMember()` 권한 검사(`assertAdmin`)가 대상 존재·owner 확인보다 뒤에 있어 비멤버도 멤버 존재/owner 여부를 구분해 알아낼 수 있음 (이번 PR이 만든 결함 아님, 직전 라운드에서 신규 발견 후 이미 트래커 등재 완료)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:800-815` (`findOne`→404→self위임→`CANNOT_REMOVE_OWNER`→`assertAdmin`)
  - 상세: 직접 확인 — 같은 파일의 `addMemberByEmail:257`·`updateMemberRole:306`은 `assertAdmin`을 최우선 호출하는 반면 `removeMember`만 뒤에 둔다. `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-21 등재, "권한 검사가 대상 조회·owner 판정보다 뒤에 있어 존재 오라클이 된다")에 이미 등재돼 있고, 자가 탈퇴 분기·owner 대상 에러 코드 계약 변경이 얽혀 있어 이번 PR과 별도로 처리해야 한다는 근거도 타당하다. 신규 단위 테스트(`:1565`)가 "검사 순서"가 아니라 "ADMIN_REQUIRED로 거부되고 delete 미호출"이라는 불변만 단언해, 향후 `assertAdmin`을 앞으로 옮기는 후속 PR과 충돌하지 않도록 설계된 점도 확인했다.
  - 제안: 코드 변경 불요 — 이미 별도 트래커 항목·후속 PR 대상으로 명시. 이번 diff의 완전성 평가에는 영향 없음.

- **[SPEC-DRIFT]** `DELETE` 멱등성 표(§3)가 실제 동작(동시 요청 패자=404)과 다시 어긋남 — 6번째 사례
  - 위치: `spec/5-system/2-api-convention.md:111` (`DELETE | 리소스 삭제 | O`) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:838` (`if (affected === 0) this.throwMemberNotFound();`)
  - 상세: 직접 두 파일을 열어 재확인 — 표에 각주 없음, 코드는 패자에게 404를 반환한다. 형제 5건(#1369~#1372)과 동일 패턴의 6번째 적용이며 코드가 옳고 spec 각주만 낡은 전형적 SPEC-DRIFT다. `plan/in-progress/spec-draft-nullable-notation-followups.md`에 이미 planner 소유 항목으로 등재돼 있다.
  - 제안: 코드 유지. spec 반영(§3 각주 "동시 요청 중 진 쪽은 404를 받을 수 있다")은 planner 턴 대상 — 신규 등재 불요.

- **[INFO]** `spec/2-navigation/9-user-profile.md:378`·`spec/data-flow/12-workspace.md §1.6`가 "동시 삭제 시 진 쪽 404"를 서술하지 않음 — 모순이 아니라 누락, 이미 트래커 등재됨
  - 위치: `spec/2-navigation/9-user-profile.md:378` (`DELETE /api/workspaces/:id/members/:memberId | 멤버 제거 (Admin+ / 자가 탈퇴 시 leave로 위임)`)
  - 상세: 직접 확인 — RBAC·자가 탈퇴 위임·owner 보호는 정확히 서술하나 동시 요청 시 진 쪽 404는 언급 없음. `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-21 재확장(3))에 이미 등재돼 있다.
  - 제안: 조치 불요(이미 트래킹됨).

## 기능 완전성 · 엣지 케이스 · 반환값 (직접 재검증)

실제 소스를 다시 읽고 `npx jest`로 재실행해 확인한 결과, 모든 분기가 정의된 값을 반환하거나 던진다:

- 정상 경로(admin이 타인 제거): `delete` → `affected=1` → 감사(`mode:'removed'`) 기록 → `Promise<void>` resolve. (`:834-847`, 테스트 `:1489-1504` GREEN)
- 대상 없음(`findOne` null): `throwMemberNotFound()` → 404, `delete` 미호출. (`:803`, 테스트 `:1539-1547` GREEN)
- owner 대상: `CANNOT_REMOVE_OWNER` 403, `delete` 미호출. (`:809-814`, 테스트 `:1549-1557` GREEN)
- 자기 자신: `leaveWorkspace`로 위임, 이 경로의 `delete` 미호출. `leaveWorkspace` 자체는 `:652-681`에서 트랜잭션 내 `pessimistic_write` 재조회로 이미 닫혀 있음을 직접 확인 — 동시 자가 탈퇴 두 건 중 진 쪽은 락 해제 후 `findOne`이 null이 되어 `NOT_A_MEMBER` 403 (e2e `member-remove-concurrency.e2e-spec.ts:139-203` 기대와 일치).
- admin/owner 아닌 요청자: `assertAdmin`(`:867-871`)이 `ADMIN_REQUIRED` 403, `delete` 미호출 — 이번 라운드에서 새로 추가된 테스트(`:1565-1576`)로 커버됨(직전 라운드 WARNING 5의 실제 조치 확인).
- 동시 제거 두 건: 승자 `affected=1`→200, 패자 `affected=0`→404 `MEMBER_NOT_FOUND`, 감사는 승자 1건만 (`mode:'removed'`) — 단위(`:1489-1516`)·e2e(`:61-129`, 공허성 가드 포함) 양쪽 확인.
- `affected`가 `null`/`undefined`(드라이버 미보고): `=== 0` 명시 비교로 정상 삭제 취급 — 대조군 `it.each([[undefined],[null]])`(`:1524-1537`) GREEN, `!affected`로 되돌리는 뮤턴트를 정확히 겨냥(RESOLUTION.md 뮤테이션 검증 로그와 별개로, 이번 라운드에서도 실제 재실행해 GREEN 유지 확인).
- 응답 형태: `workspaces.controller.ts:373` `return { data: { ok: true } }` — 204 아닌 `200 {data:{ok:true}}`라는 e2e 주석·단언과 정확히 일치.
- TODO/FIXME/HACK/XXX: 3개 변경 파일 전체 grep 결과 0건.
- helper·타입 정합: e2e가 쓰는 `createDbClient`·`uniqueEmail`·`uniqueName`·`registerAndLogin`·`createTeamWorkspace`·`inviteAndAccept`·`RegisteredUser.userId` 전부 `test/helpers/{db,auth}.ts`의 실제 export/필드와 시그니처까지 일치함을 직접 대조(단순 존재 확인이 아니라 인자 개수·타입까지 확인). e2e가 쓰는 raw SQL의 테이블/컬럼명(`workspace_member`, `audit_log`, `action='member.removed'`)도 실제 엔티티 정의(`@Entity('workspace_member')`, `@Entity('audit_log')`, `AUDIT_ACTIONS.MEMBER_REMOVED`)와 일치.

## 요약

이번은 직전 라운드(`review/code/2026/09/21/12_57_05`)의 조치 후 재리뷰다. RESOLUTION.md가 주장한 3건(WARNING #3 `throwMemberNotFound()` 추출, #4 `getAudit()` 중복 제거, #5 `ADMIN_REQUIRED` 거부 테스트 추가)을 워킹트리 원본에서 직접 대조했고 정확히 반영돼 있음을 확인했다(`npx jest` 75/75, `npx tsc --noEmit` 에러 0로 재검증). 핵심 변경(무락 `findOne`+`remove(entity)` → 원자적 `delete({id, workspaceId})` + `affected===0` 명시 비교)은 정상/대상없음/owner/자가위임/권한거부/동시패자/`null`·`undefined` 대조군까지 모든 경로에서 적절한 값을 반환하거나 올바른 코드로 예외를 던진다. 남은 이슈(owner 승격 TOCTOU, 권한검사 순서 오라클, DELETE 멱등성 spec 각주 미반영, `9-user-profile.md`/`data-flow/12-workspace.md` 서술 부재)는 전부 이번 diff가 새로 만든 결함이 아니라 이미 실측·문서화·트래커 등재까지 마친 기존 갭이며, 병합을 막을 사유가 아니다. 코드와 spec 문서 사이에 새로운 line-level 불일치는 발견되지 않았다. 리뷰 과정에서 저장소 파일을 수정하지 않았다(`git status --short` 확인 — 이 세션 산출 디렉터리 외 변경 없음).

## 위험도

LOW
