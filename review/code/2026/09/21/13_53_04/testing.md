# 테스트(Testing) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정 (라운드 3, 후속 확인)

## 검토 방법

`origin/main...HEAD` 누적 diff 는 라운드 1(`12_57_05`)·라운드 2(`13_28_12`)에서 이미 두 차례 테스트 관점으로
검토됐다. 이번 라운드(`13_53_04`)에서 새로 추가된 커밋은 `6f1113a70` 하나뿐이라 `git show --stat 6f1113a70`
로 실제 변경 파일을, `git show 6f1113a70 -- codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 로
그 커밋이 `codebase/` 에 낸 유일한 변경을 직접 대조했다. 또한 라운드 2 `testing.md`(INFO #6·#7)가 남긴
carry-over 항목이 이번 라운드에도 여전히 유효한지 `workspaces.service.spec.ts` 원본을 `Read`/`grep -n` 으로
재확인했다. 저장소 파일은 전혀 고치지 않았다(`git status --short` 결과 이 세션이 만든 변경 없음, 기존
`review/code/2026/09/21/13_53_04/` 산출 디렉터리만 untracked로 존재).

## 발견사항

- **[INFO]** 이번 라운드의 유일한 신규 커밋(`6f1113a70`)은 테스트 파일에 대해 JSDoc 주석 문구만 고쳤고, 단언·픽스처·실행 경로는 전혀 바뀌지 않았다 — 회귀 위험 없음
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:18-24` (파일 상단 JSDoc, "형제 다섯은 전부 204" → "컨트롤러별로 갈린다"로 정정)
  - 상세: `git show 6f1113a70 -- codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 로 대조한 결과, 변경분은 12~34행 JSDoc 블록의 산문 두 문장뿐이며 `it(...)` 블록·`fireRemove`/`fireLeave`·락 오케스트레이션·`expect(...)` 단언은 라운드 2 검토 시점과 바이트 단위로 동일하다. 실측(원문이 스스로 반증한 "형제 다섯=전부 204"가 실제로는 컨트롤러별로 갈린다는 것)을 정정문에 함께 실은 것도 확인했다 — `workspace-delete-concurrency.e2e-spec.ts`가 이미 `[200, 404]`를 쓴다는 주장은 이번 검토 범위(테스트 관점)에서 별도로 검증할 필요가 없는 문서적 사실 서술이다.
  - 제안: 없음(정상).

- **[INFO]** 라운드 1 WARNING("`ADMIN_REQUIRED` 거부 테스트 부재")의 조치가 코드로 확인됨 — 회귀 테스트로서 유효
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1565-1576` (`it('admin/owner 가 아니면 ADMIN_REQUIRED 로 거부하고 delete 를 타지 않는다', ...)`), `wireFindOne` 확장은 `:1469-1482`
  - 상세: `wireFindOne(target, requesterMembership)`이 두 번째 인자로 요청자 멤버십을 오버라이드할 수 있게 확장돼, 새 테스트가 `{ id: 'mem-req', role: 'editor' }`로 비-admin 요청자를 흉내내 `ADMIN_REQUIRED` 거부와 `memberRepo.delete` 미호출을 함께 단언한다. 테스트 자체의 JSDoc(`:1559-1564`)이 "검사 순서에 결합하지 않는다"는 의도를 명시해, 향후 `assertAdmin` 이동 PR이 이 테스트를 깨뜨리지 않을 것이라는 설계 의도가 코드에 남아 있다. RESOLUTION.md(SUMMARY#5) 서술과 실제 코드가 일치함을 확인했다.
  - 제안: 없음(정상 확인).

- **[INFO]** (carry-over, 라운드 2 INFO#6 재확인) `wireFindOne()`이 `where.workspaceId`를 검증하지 않는다 — 이번 라운드에서도 변화 없음, 신규 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1476-1481` (`opts.where.id === memberId ? target : requesterMembership`)
  - 상세: mock 구현이 `where.id`로만 대상/요청자 조회를 가르고 `where.workspaceId`는 아예 보지 않는다. 만약 `removeMember()`의 `findOne`이 워크스페이스 스코프를 빠뜨리는 회귀(교차 워크스페이스 조회)를 낸다 해도 이 unit 테스트 스위트는 잡지 못한다(다만 `delete()` 호출 시엔 `{id, workspaceId}` 인자를 명시 단언하므로 그 단에서는 걸린다). 라운드 2 `testing.md`가 이미 INFO로 지적하고 "급하지 않음"으로 유예한 항목과 동일하며, 이번 라운드 diff가 이 함수를 건드리지 않았으므로 재발이 아니라 미해소 상태의 재확인이다.
  - 제안: 급하지 않음 — 다음에 `wireFindOne`을 만질 때 `expect(memberRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId }) }))` 류의 단언을 대표 테스트 1개에 추가 권장.

- **[INFO]** (carry-over, 라운드 2 INFO#7 재확인) `updateMemberRole()`이 `throwMemberNotFound()`를 공유하게 됐는데도, 그 not-found 분기 자체를 검증하는 unit 테스트가 여전히 없다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:310` (`if (!member) this.throwMemberNotFound();`) — 테스트 파일에서 `updateMemberRole`을 호출하는 유일한 테스트는 `:1256-1281`의 happy path(`role_changed` 감사) 하나뿐, not-found 케이스 없음
  - 상세: `throwMemberNotFound()` 추출(f022ae9fd, SUMMARY#3)이 `removeMember()`의 두 판정뿐 아니라 `updateMemberRole()`까지 재사용 범위를 넓혔지만(라운드 2 scope INFO#2가 이미 지적), 그 확장으로 새로 노출된 `updateMemberRole` not-found 분기의 회귀 테스트는 아직 추가되지 않았다. `grep`으로 `updateMemberRole(` 호출을 전수 확인한 결과 스펙 파일 전체에 이 한 자리뿐임을 재확인했다. 이번 PR이 그 동작을 바꾸지 않았으므로 신규 결함은 아니다.
  - 제안: 급하지 않음 — 다음에 `updateMemberRole` 블록을 만질 때 `it('대상이 없으면 MEMBER_NOT_FOUND', ...)` 추가 권장.

- **[INFO]** 대조군(`affected` `null`/`undefined`) 테스트와 동시 제거 unit describe 블록은 라운드 1·2 검토 이후 바이트 단위로 변경 없음 — 재검증 결과 여전히 판별력 있음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1524-1537` (`it.each([[undefined],[null]])`), `:1506-1516`(진 쪽 404 테스트)
  - 상세: `memberRepo.delete.mockResolvedValue({ affected: 0 })` → `NotFoundException` + 감사 미호출을 단언하는 테스트, `affected` `undefined`/`null` → 정상 삭제로 취급하는 대조군 테스트 둘 다 원문 그대로다. `affected === 0` 명시 비교를 `!affected`로 되돌리면 이 대조군이 RED가 된다는 판별력은 라운드 1 RESOLUTION.md의 뮤테이션 실측(`Tests: 1 failed, 74 passed, 75 total`)으로 이미 검증됐고, 이번 라운드 diff가 이 블록을 건드리지 않았으므로 그 판별력은 그대로 유지된다.
  - 제안: 없음(정상, 재확인).

## 요약

이번 라운드(`13_53_04`)에서 `codebase/`에 새로 추가된 유일한 변경(`6f1113a70`)은 `member-remove-concurrency.e2e-spec.ts` 상단 JSDoc 주석의 문구 정정(라운드 2 INFO#8 "형제 다섯은 전부 204"가 사실과 다르다는 지적에 대한 자기-반증형 소정정)뿐이며, 테스트의 단언·픽스처·실행 경로는 전혀 바뀌지 않아 회귀 위험이 없다. 라운드 1의 유일한 테스트 관련 WARNING("`ADMIN_REQUIRED` 거부 테스트 부재")은 `wireFindOne()`을 요청자 멤버십도 오버라이드 가능하게 확장하고 신규 `it` 블록을 추가하는 방식으로 정확히 조치됐음을 코드 대조로 재확인했다. 남는 갭은 라운드 2에서 이미 INFO로 발견·유예된 두 건(`wireFindOne`이 `where.workspaceId`를 검증하지 않음, `updateMemberRole()`의 not-found 분기 자체 테스트 부재)뿐이며 둘 다 이번 diff가 만든 것이 아니고 이번 라운드에서도 변화가 없다 — 급하지 않은 후속 개선 여지로 재확인 수준의 기록만 남긴다. 이번 PR을 막을 신규 테스트 결함은 없다.

## 위험도

NONE
