# 테스트(Testing) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정

## 검증 방법

`Read`로 워킹트리 원본을 직접 열어 diff 게이트 숫자와 실제 줄 번호가 일치함을 대조했다
(`workspaces.service.ts` 895줄, `workspaces.service.spec.ts` 1595줄, `member-remove-concurrency.e2e-spec.ts`
204줄 — 모두 diff 상 최종 줄 수와 일치). `removeMember()`·`assertAdmin()`·`getMemberRole()`·
`leaveWorkspace()`·컨트롤러의 `removeMember` 라우트·`inviteAndAccept`/`registerAndLogin`/
`createTeamWorkspace` 헬퍼 시그니처를 모두 열어 테스트의 전제(응답 코드, mock 분기 조건, 위임 경계)가
실제 구현과 맞는지 확인했다. 저장소에 아무것도 쓰지 않았다(`Read`/`Grep`/`Bash` 읽기 전용만 사용,
`git status --short` 로 파일 종료 시점 clean 확인 — 세션 시작 시 존재하던 `review/code/2026/09/21/13_28_12/`
untracked 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** `wireFindOne()` mock 이 `where.workspaceId` 를 검증하지 않아, `findOne` 호출에서
  `workspaceId` 스코핑이 빠지는 회귀(교차 워크스페이스 memberId 로 다른 워크스페이스 멤버를
  조회/삭제)를 이 describe 블록의 유닛 테스트는 잡지 못한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` `wireFindOne()` 함수
    (`describe('removeMember — 동시 제거', ...)` 안, 게이트 `1469`-`1482`)
  - 상세: `wireFindOne`의 `mockImplementation`은 `opts.where.id === memberId` 만 보고 대상/요청자
    응답을 가른다 — `opts.where.workspaceId` 는 어떤 테스트에서도 읽거나 단언하지 않는다. 따라서
    `removeMember()`의 `findOne({ where: { id: memberId, workspaceId } })` 호출에서 `workspaceId` 조건이
    실수로 빠지는 회귀가 나도(그래서 다른 워크스페이스에 속한 `memberId`도 조회되는 IDOR성 결함이 생겨도)
    이 유닛 테스트는 GREEN을 유지한다. 다만 `delete()` 호출 자체는 "한 행을 지우면…" 테스트가
    `expect(memberRepo.delete).toHaveBeenCalledWith({ id: memberId, workspaceId })` 로 인자를 정확히
    단언하므로, `delete()` 단의 `workspaceId` 누락 회귀는 잡힌다 — 갭은 `findOne()` 단에 국한된다.
    같은 패턴(`where.workspaceId` 미검증)이 파일의 다른 `mockImplementation` 들(예: `transferOwnership`
    테스트, 게이트 `1101`-`1114`)에도 이미 있어 이 파일 전반의 기존 관례이지, 이번 PR 이 새로 도입한
    문제는 아니다.
  - 제안: 급하지 않음(기존 관례와 일치, 이번 PR 스코프 밖). 다음에 이 describe 블록을 만지게 되면
    `wireFindOne` 이 `where.workspaceId === workspaceId` 도 함께 확인하도록 강화하는 편이
    tenant-isolation 회귀에 더 강해진다.

- **[INFO]** `throwMemberNotFound()` 추출로 `updateMemberRole()` 도 이 헬퍼를 공유하게 됐지만,
  `updateMemberRole()` 의 not-found 분기 자체를 검증하는 유닛 테스트는 여전히 없다(이번 PR 이 만든
  갭이 아니라 리팩터로 노출된 기존 갭)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:310`
    (`if (!member) this.throwMemberNotFound();`, `updateMemberRole()` 안)
  - 상세: 파일 전체에서 `updateMemberRole` 을 부르는 테스트는
    `records member.role_changed (from/to) on updateMemberRole`(spec.ts:1256) 하나뿐이고, 이는 happy
    path(멤버가 존재 → 역할 변경 → 감사)만 검증한다. `throwMemberNotFound()` 가 `removeMember()` 와
    `updateMemberRole()` 두 호출자를 공유하는 지금, `removeMember()` 쪽은 이번 PR 이 "대상이 없으면
    삭제를 시도하지 않는다" 테스트로 그 경로를 확인했지만(:1539-1547), `updateMemberRole()` 쪽은 여전히
    한 번도 그 분기가 실행되는지 테스트되지 않는다. 헬퍼의 코드/메시지가 나중에 바뀌면
    `updateMemberRole()` 호출자 쪽 회귀는 아무 테스트도 못 잡는다.
  - 제안: `updateMemberRole()` 에 대상 멤버가 없을 때 `MEMBER_NOT_FOUND` 를 던지는 테스트 한 건 추가
    권장(급하지 않음 — 이번 PR 이 그 분기의 동작을 바꾸지 않았고, 리터럴을 헬퍼로 옮긴 리팩터일 뿐이라
    이번 PR 을 막을 사유는 아니다).

## 확인한 항목 (문제 없음)

- **`removeMember()` 분기 커버리지**: 정상 삭제(승자)·동시 제거 패자(`affected===0`)·`affected`
  `null`/`undefined` 대조군(`it.each`)·대상 없음·owner 보호·`ADMIN_REQUIRED` 거부·자가 탈퇴 위임까지
  실행 순서(`findOne → self-check → owner 403 → assertAdmin → delete → affected 판정 → audit`)의
  모든 분기가 최소 한 건씩 커버된다. `memberRepo.delete`/`getAudit().record` 의 미호출까지 부정 단언으로
  확인해(vacuous 회피) 각 분기가 그 다음 단계로 새지 않음을 보장한다.
- **`ADMIN_REQUIRED` 회귀 테스트가 검사 순서에 결합하지 않음**: 트래커에 등재된 권한 검사 순서 결함
  (`assertAdmin` 을 앞으로 옮기는 후속 PR)을 예견하고, "몇 번째 단계에서 거부되는가"가 아니라
  "`ADMIN_REQUIRED` 로 거부되고 `delete` 미호출"이라는 불변만 단언한다 — 후속 PR 이 검사 순서를
  바꿔도 이 테스트가 불필요하게 깨지지 않는다. 실제로 `Bash mutation` 으로 `assertAdmin` 호출을 제거해
  이 테스트만 RED(`1 failed, 74 passed`)가 되는 것을 확인했다는 기록(`RESOLUTION.md`)과 코드상
  `ADMIN_ROLES = {'owner','admin'}` 정의가 일치한다.
- **`affected===0` 명시 비교 대조군의 판별력**: `it.each([[undefined],[null]])` 이 정확히 "드라이버
  미보고"를 흉내내고, `!affected` 로 되돌리는 뮤턴트를 겨냥한다는 주석이 실제 구현 규율
  (`workspaces.service.ts:825-827`, `affected === 0` 명시 비교)과 일치한다.
  `records member.removed (mode=removed) on admin removeMember`(:1286) 기존 테스트가 공유
  `beforeEach` 의 새 기본값(`memberRepo.delete` → `{affected: 0}`, `deleteWorkspace` cascade 용)과
  충돌해 깨졌던 것을, 그 자리에서 `{affected: 1}` 로 명시해 고친 것도 실측(`memberRepo.delete` 기본값
  위치: spec.ts:156-158)과 정확히 일치한다.
- **`getAudit()` 중복 제거**: 최상위 `describe('WorkspacesService', ...)` 스코프로 한 번만 정의되고
  (spec.ts:38-41), 옛 지역 정의(구 `:1154`, 구 `:1458`) 둘 다 제거됐다 — 실제로 파일 전체에서
  `function getAudit(` 정의가 정확히 1곳뿐임을 확인.
- **테스트 격리**: 최상위 `beforeEach` 가 매 테스트마다 `Test.createTestingModule` 로 서비스·mock
  저장소를 통째로 새로 만들고(spec.ts:72-159), 새 describe 블록의 지역 `beforeEach` 는 그 위에
  `wireFindOne`/`memberRepo.delete` 기본값만 추가로 덧씌운다 — 테스트 간 상태 누수 경로가 없다.
  `jest.spyOn(service, 'leaveWorkspace')` 도 매 테스트 새 `service` 인스턴스에 걸리므로 다른 테스트로
  전파되지 않는다(`mockRestore()` 호출은 방어적이지만 인스턴스가 매번 새로 만들어져 실질적으로 불필요 —
  해로운 것은 아니다).
  - `mockImplementation` 은 이전 `mockResolvedValueOnce` 체인을 덮어써야 정상 동작하는데, `wireFindOne`
    이 `describe` 블록 진입 시 매번 `mockImplementation` (once 아님)으로 전체 재정의하므로 순서 의존성
    문제가 없다.
- **e2e 판별력**: `Promise.race` 공허성 가드로 "락을 놓기 전 두 요청 모두 아직 안 끝남"을 먼저 관측한 뒤
  결과를 단언 — 형제 5개 파일(#1369~#1372)과 동일한 1,500ms 타임아웃 관례를 그대로 따른다
  (`integration-delete-concurrency.e2e-spec.ts:91-94` 대조 확인). 상태쌍 `[200, 404]`(형제들의 `[204, 404]`
  와 다름, 이 라우트만 `200 {data:{ok:true}}`)과 `mode='removed'` 필터를 실제 컨트롤러 코드
  (`workspaces.controller.ts:355-374`)와 대조해 정확함을 확인했다. `inviteAndAccept`/`registerAndLogin`/
  `createTeamWorkspace` 는 기존 공유 헬퍼(`test/helpers/auth.ts`)를 그대로 재사용해 새 결합 코드를
  추가하지 않았다. `finally` 블록의 `ROLLBACK`(`.catch(()=>undefined)`)과 `pending?.catch(()=>undefined)`
  가 커넥션 점유/미해결 프라미스 누수를 방지한다.
- **자가 탈퇴 위임 경계의 실증**: plan 이 "이미 닫혀 있다"고 두 번 적었지만 코드로 확인한 적이 없다고
  스스로 지적한 뒤, 실제로 `leaveWorkspace()` 소스(`workspaces.service.ts:652-658`,
  트랜잭션 안 `pessimistic_write` 재조회)와 e2e 재현(`status=200, 403 NOT_A_MEMBER`, mode='left' 감사
  1건)으로 그 주장을 검증했다 — 주장과 구현이 실제로 일치함을 직접 대조했다.
- **테스트 가독성**: 각 `it`/도우미 함수 위에 "무엇을 검증하고 왜 이 형태인지"를 설명하는 주석이
  붙어 있다(대조군의 이유, 위임 경계가 사라지면 재발한다는 경고, 검사 순서에 결합하지 않는 이유 등) —
  다음 사람이 테스트를 지울 때 왜 존재했는지 알 수 있게 한다.

## 요약

`removeMember()` 를 무락 `remove(member)` 에서 원자적 `delete({id, workspaceId})` + `affected===0`
명시 판정으로 바꾼 변경은 유닛(정상/패자/`null`·`undefined` 대조군/대상없음/owner보호/`ADMIN_REQUIRED`
거부/자가위임 7개 시나리오)과 e2e(실제 DB 행 락으로 만든 결정적 레이스, 자가 탈퇴 위임 경계의 실증)
양쪽에서 관련 분기를 촘촘히 커버하고, 이전 리뷰 라운드(`12_57_05`)가 지적한 `getAudit()` 중복 정의와
`ADMIN_REQUIRED` 테스트 부재도 실제로 해소된 것을 코드에서 직접 확인했다. `ADMIN_REQUIRED` 테스트가
검사 순서에 결합하지 않고 불변만 단언하도록 설계된 점, mutation 으로 판별력을 실측 검증한 기록이
남아 있는 점은 특히 견고하다. 남은 갭은 둘 다 사소하고 이번 PR 이 새로 만든 것이 아니다 — (1)
`wireFindOne` mock 이 `workspaceId` 스코핑을 검증하지 않아 그 조건이 빠지는 회귀를 잡지 못함(파일
전반의 기존 관례), (2) 리팩터로 공유된 `throwMemberNotFound()` 의 다른 호출자인 `updateMemberRole()`
의 not-found 분기는 여전히 테스트가 없음(이번 PR 이 그 동작을 바꾸지 않았으므로 회귀는 아님). 둘 다
병합을 막을 사유는 아니다.

## 위험도

LOW
