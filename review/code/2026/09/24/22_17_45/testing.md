# 테스트(Testing) 리뷰 — removeMember 판정 순서 커버리지

## 발견사항

- **[INFO]** 리뷰 중 저장소 워킹트리에서 병렬 오염(다른 세션의 뮤테이션)을 일시적으로 관측했다 — 리뷰 대상 diff 결함 아님, 참고용 기록
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`removeMember`, HEAD 대비 비변경 파일)
  - 상세: 리뷰 도중 `git status --short` 를 두 번 확인했다. 1차 확인 시 `removeMember` 의 대상-null 검사가 admin 판정 뒤로 옮겨지고 self 비교가 `member?.userId` 로 바뀐 상태(diff 로 확인, plan `remove-member-order-coverage.md` §B 의 **M-a 뮤턴트**와 바이트 단위로 일치)였다. 이 상태에서 `-t "removeMember"` 를 돌리면 새 테스트 `비-admin 이 없는 대상을 지목하면 ADMIN_REQUIRED 가 아니라 MEMBER_NOT_FOUND 다` 하나만 RED(`Received code: "ADMIN_REQUIRED"`, 기대 `"MEMBER_NOT_FOUND"`)였다 — plan 문서가 적은 실측치와 정확히 일치. 수 분 뒤 재확인하니 파일은 다시 HEAD 상태로 복귀했고 스위트는 GREEN(`removeMember` 16/16, 모듈 전체 139/139)이었다. 이 세션은 해당 파일을 한 번도 Edit/Write 하지 않았다(`cp` 로 scratch 백업만 했다) — 동시에 도는 다른 reviewer/세션이 같은 M-a 뮤턴트를 검증하던 중이었을 가능성이 높다. 지금 시점(`git status --short`)엔 워킹트리가 깨끗하고 대상 diff 와 무관하지만, **혹시 이 상태가 커밋에 섞여 들어가면 이 PR 이 고치려는 바로 그 순서 결함(정보 노출)이 조용히 되돌아온다** — 병합 직전 재확인을 권한다.
  - 제안: 조치 불필요(현재 클린). 병합 전 `git diff` 로 `workspaces.service.ts` 가 HEAD 와 동일한지 마지막으로 한 번 더 확인.

- **[INFO]** 새 테스트 두 개는 plan 이 표로 미리 선언한 두 빈 칸(대상 존재→admin, 요청자 role 1회 조회)을 정확히 메운다 — 실제 실행·뮤테이션 검증 완료
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (`describe('removeMember — 동시 제거'`, `it('비-admin 이 없는 대상을 지목하면 ADMIN_REQUIRED 가 아니라 MEMBER_NOT_FOUND 다'`, `it('요청자 role 을 한 번만 조회한다'`)
  - 상세: 직접 `node --experimental-vm-modules jest src/modules/workspaces/workspaces.service.spec.ts -t removeMember` 로 실행해 16/16 통과, 모듈 전체 `src/modules/workspaces/` 139/139 통과를 확인했다(CHANGELOG·plan 의 "139건" 서술과 일치). 소스(`workspaces.service.ts:814-906`)를 직접 읽어 판정 순서(멤버십→대상 존재→self→admin→owner)와 두 신규 테스트의 기대값이 정확히 대응함을 확인했다. `wireFindOne` 헬퍼는 `where.id`/`where.userId` 로 대상·요청자 조회를 구분하는 기존 패턴을 그대로 재사용해 새 mock 을 추가하지 않았고, `getMemberRole` 이 `findOne({ where: { workspaceId, userId } })` 를 쓴다는 실제 구현과 두 번째 테스트의 필터(`c[0]?.where?.userId === requesterId`)가 일치함도 소스로 대조했다.
  - 제안: 없음(추가 조치 불요).

- **[INFO]** 두 번째 테스트("요청자 role 을 한 번만 조회한다")는 count 기반 assertion 이라 판별력이 필터 정확도에 의존한다 — 현재는 안전하지만 향후 재배치 시 재확인 필요
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1818-1829` (게이트 기준, diff 상 새로 추가된 `it('요청자 role 을 한 번만 조회한다'` 블록)
  - 상세: `expect(requesterLookups).toHaveLength(1)` 은 필터 키(`where.userId === requesterId`)가 실제 쿼리 모양과 계속 일치하는 동안만 유효하다. JSDoc 이 이미 이 트레이드오프("조회 키가 바뀌어도 공허하게 통과하지 않는다")를 명시하고 있고, `getMemberRole` 리팩터로 조회 shape 자체가 바뀌는 경우엔 0건으로 떨어져 RED 가 나므로 공허성 위험은 낮다. 다만 이 필터는 `workspaceId` 는 검사하지 않는다(같은 테스트 스코프 안에서 `workspaceId` 상수가 하나뿐이라 실질 위험은 없음).
  - 제안: 조치 불필요 — 다만 향후 이 describe 블록에 여러 workspaceId 를 오가는 테스트가 추가되면 필터에 `workspaceId` 조건도 넣을 것.

## 요약

리뷰 대상 diff(CHANGELOG.md 항목 1건, `workspaces.service.spec.ts` 테스트 2건, plan 문서 1건)는 plan 이 착수 전 표로 명시한 두 커버리지 갭(「대상 존재 → admin」, 「요청자 role 1회 조회」)을 정확히 겨냥해 메운 순수 테스트 추가 작업이다. 직접 실행해 `removeMember` 16/16, 모듈 전체 139/139 통과를 확인했고, 소스(`workspaces.service.ts:814-906`)와 대조해 두 신규 테스트의 기대값·mock shape 이 실제 판정 순서와 정확히 대응함을 검증했다. 기존 `wireFindOne` 헬퍼를 재사용해 mock 신규 도입이 없고, JSDoc 이 "보안 불변이 아니라 문서화된 순서"라는 한계를 스스로 명시해 가독성·정직성이 높으며, plan 문서에 실린 3개 뮤턴트(M-a/M-b/M-b2) 실측치도 소스 코드의 실제 판정 순서와 논리적으로 부합한다. 유일한 특이사항은 리뷰 도중 워킹트리에서 관측한 일시적 병렬 오염(다른 세션이 M-a 뮤턴트를 적용 중이었던 것으로 추정)인데, 이 세션이 유발한 것이 아니고 현재는 다시 클린·GREEN 상태다 — 리뷰 대상 diff 자체의 결함은 아니지만 병합 직전 재확인을 권고할 만큼 내용이 예민하다(방치 시 이 PR 이 고치는 정보 노출 순서 결함이 그대로 재현되는 모양이기 때문).

## 위험도

NONE
