# 동시성(Concurrency) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정 (후속 라운드)

이번 라운드의 diff 는 이전 리뷰(`review/code/2026/09/21/12_57_05`)의 WARNING 조치(`throwMemberNotFound()` 추출,
`getAudit()` 중복 제거, `ADMIN_REQUIRED` 거부 테스트 추가, `deleteWorkspace` cascade 용 공유 mock 기본값
`{affected:0}` 을 해당 테스트에서 `{affected:1}` 로 명시)와 그 리뷰 산출물(RESOLUTION/SUMMARY 등) 커밋을
포함한다. 핵심 동시성 로직(`removeMember()` 의 원자적 `DELETE`+`affected===0` 판정) 자체는 이번 라운드에서
변경되지 않았고, 실제 파일(`workspaces.service.ts:789-848`)을 직접 열어 diff 와 대조 확인했다.

## 발견사항

- **[WARNING]** `removeMember()` 의 owner 보호 가드가 여전히 TOCTOU 로 뚫린다 (이번 PR 수정 범위 밖, 사전에 실측·문서화·트래커 등재됨 — 재확인)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:809`(`if (member.role === 'owner')` 무락 판정) ~ `:834`(`memberRepository.delete(...)`) 사이의 창. 자기-인지 주석은 `:829-833`.
  - 상세: `:800` 의 무락 `findOne` 스냅샷을 owner 판정(:809)과 `assertAdmin`(:815)이 그대로 쓴다. 이 판정과 `:834` 의 원자적 `DELETE` 사이에 동시 `transferOwnership()` 이 같은 멤버를 owner 로 승격시키면, `removeMember()` 는 이미 "owner 아님"을 확인한 뒤라 가드를 재검사하지 않고 그대로 `DELETE`를 실행해 owner 행이 지워진다. 신규 판별자 `affected === 0`(:838)은 "행이 사라졌는가"만 구분할 뿐 "owner 로 바뀌었는가"는 구분하지 못하므로 이 창에서는 owner 삭제가 그대로 200 으로 성공한다. `plan/in-progress/member-dup-remove.md` §C-2 와 `plan/in-progress/spec-draft-nullable-notation-followups.md`(게이트 4840~4872)에 재진입 기법(레이스로는 인터리빙을 못 고르므로 locker 가 행 락을 쥔 채 `role='owner'` 로 UPDATE 후 COMMIT)으로 **실측 재현**(`status=200, rows_remaining=0`)됐고, 후보 처방(`delete({..., role: Not('owner')})` + 0-행 시 1회 재조회로 원인 분기)까지 이미 문서화돼 있다. 이번 라운드도 이 구간의 로직을 건드리지 않았으므로 그대로 남아 있다 — 신규 회귀는 아니고 이전 라운드에서 이미 등재·유예된 사안의 재확인이다.
  - 제안: 이번 PR 을 막을 사유는 아니다(판별자 오염 방지 논리가 타당하고 이미 트래커에 우선순위 "중간"으로 등재됨). 다만 shipped 코드에 실측 재현된 권한 우회 창이 남아 있다는 사실은 계속 기록해 둘 것 — 후속 PR 에서 `role: Not('owner')` + 0-행 원인 분기 처방을 적용할 때 새 분기의 뮤테이션 테스트를 반드시 짝지을 것.

- **[INFO]** `removeMember()` 의 원자적 `DELETE`+`affected===0` 명시 비교는 여전히 견고하고, 리팩터링(`throwMemberNotFound()` 추출)도 그 원자성을 보존한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:834-838` (`delete({id, workspaceId})` → `if (affected === 0) this.throwMemberNotFound();`)
  - 상세: `NotFoundException` 발생 로직을 `private throwMemberNotFound(): never`(파일 내 별도 헬퍼, `:342-347` 부근)로 추출한 것은 순수 리팩터링이며, `DELETE` 문 자체·`affected` 판정 시점·`null`/`undefined` 를 `0` 과 구분하는 명시 비교는 그대로다 — 원자성·경쟁조건 방어 성질에 변화 없음. 대조군 테스트(`workspaces.service.spec.ts:1524-1537`, `it.each([[undefined],[null]])`)도 그대로 유지된다.
  - 제안: 없음(정상).

- **[INFO]** 자가 제거 위임 경로(`leaveWorkspace()`)가 실제로 트랜잭션 안 `pessimistic_write` 로 닫혀 있음을 소스에서 직접 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:804-807`(`removeMember()` 의 self-check 위임) ↔ `:652-664`(`leaveWorkspace()` 의 `manager.transaction` + `lock: { mode: 'pessimistic_write' }` 로 `{workspaceId, userId}` 재조회)
  - 상세: plan·주석이 반복해 주장하는 "자가 탈퇴는 이미 닫혀 있다"는 문장을 코드로 직접 검증했다. `removeMember()` 의 `member.userId === requesterId` 스냅샷 비교는 무락이지만, 실제 인가·삭제 판단은 `leaveWorkspace()` 트랜잭션 안에서 `requesterId` 기준으로 **다시** 조회·락을 잡으므로 스냅샷이 stale 해도 위임 이후 판단은 항상 최신 상태를 본다. 신규 e2e 테스트(`member-remove-concurrency.e2e-spec.ts:139-203`)가 이 불변을 겨냥해 고정한다.
  - 제안: 없음(정상). 다만 plan 이 스스로 경고하듯 "위임 경계가 사라지면(예: `leaveWorkspace` 락 제거) 같은 결함이 이 라우트로 되돌아온다" — 이 결합이 향후 리팩터링에서 깨지지 않는지는 계속 감시할 가치가 있다.

- **[INFO]** e2e 동시성 테스트의 레이스 구성·정리 로직은 이전 라운드와 동일하게 견고하며, 이번 라운드의 변경(플랜 문서·리뷰 산출물 커밋)은 이 파일의 로직을 건드리지 않았다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:88-118`, `:167-193`
  - 상세: 별도 커넥션(`locker`)의 `SELECT … FOR UPDATE` 로 결정적 겹침을 만들고, `Promise.race` 로 1.5초 안에 "아직 안 끝남"을 먼저 확인(공허성 가드)한 뒤 `COMMIT`, `finally` 에서 항상 `ROLLBACK`+`pending?.catch(() => undefined)` 로 정리한다. `Promise.all([fireRemove(), fireRemove()])` 완료 순서는 비결정적이지만 결과를 `status` 로 정렬한 뒤 단언해 순서 의존성이 없다.
  - 제안: 없음(정상).

## 검증용 뮤테이션

이번 리뷰는 코드를 고쳐보지 않았다 — `Read`/`grep`으로 diff 와 실제 파일(`workspaces.service.ts`, `leaveWorkspace()` 본문)을 직접 대조 확인하는 정적 검증만 수행했다. `git status --short` 확인 결과 이 세션이 저장소에 남긴 변경은 없다(사전에 존재하던 `review/code/2026/09/21/13_28_12/` untracked 디렉터리만 있으며, 이는 이 리뷰 세션 자체의 산출 디렉터리다).

## 요약

이번 라운드의 diff 는 핵심 동시성 수정(무락 `findOne`→`remove(entity)` 조합을 원자적 `delete({id, workspaceId})`+`affected===0` 명시 판정으로 교체)을 그대로 유지한 채, 직전 리뷰의 WARNING 조치(리터럴 중복 헬퍼 추출, 테스트 헬퍼 통합, `ADMIN_REQUIRED` 거부 테스트 추가)와 그 리뷰 기록 커밋만 추가한다 — 이 부분은 동시성 로직 자체에 영향이 없음을 소스 대조로 확인했다. 자가 탈퇴 위임 경로가 트랜잭션 안 `pessimistic_write` 로 실제로 닫혀 있다는 plan 의 반복 주장도 코드에서 직접 검증했다. 유일하게 남는 실질 동시성 결함은 owner 보호 가드가 무락 스냅샷 위에 있어 동시 `transferOwnership()` 과 겹치면 owner 가 삭제될 수 있는 TOCTOU 인데, 이는 이번 diff 가 새로 만든 것도 아니고 이번 라운드에서 건드린 구간도 아니며 이미 실측 재현·문서화·트래커 등재·의도적 유예가 완료된 사안이다. 병합을 막을 신규 동시성 결함은 없다.

## 위험도

LOW
