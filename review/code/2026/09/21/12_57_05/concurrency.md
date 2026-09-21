# 동시성(Concurrency) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정

## 발견사항

- **[WARNING]** `removeMember()` 의 owner 보호 가드가 여전히 TOCTOU 로 뚫린다 (이번 PR 의 수정 범위 밖, 사전에 실측·문서화·트래커 등재됨)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:797` (`if (member.role === 'owner')` 무락 판정) ~ `:822` (`memberRepository.delete(...)`) 사이의 창. 해당 자기-인지 주석은 `:817-821`.
  - 상세: `member.role === 'owner'` 검사는 `:783` 의 무락 `findOne` 스냅샷을 본다. 이 검사와 `:822` 의 원자적 `DELETE` 사이에 동시 `transferOwnership()` 이 같은 멤버를 owner 로 승격시키면, `removeMember`는 이미 "owner 아님"을 확인한 뒤이므로 가드를 재검사하지 않고 그대로 `DELETE`를 실행해 owner 행을 지운다. `affected === 0` 판별자는 "행이 사라졌는가"만 구분할 뿐 "owner 로 변했는가"는 구분하지 못하므로, 이 창에서는 owner 삭제가 그대로 성공(200)한다. plan(`plan/in-progress/member-dup-remove.md` §C-2, `plan/in-progress/spec-draft-nullable-notation-followups.md` 4819-4851행)에 재진입 방식(레이스로는 인터리빙을 못 고르므로 locker 가 락을 쥔 채 `role='owner'` 로 UPDATE 후 COMMIT)으로 **실측 재현**됐고(`status=200, rows_remaining=0`), 후보 처방(`delete({..., role: Not('owner')})` + 0-행 시 재조회로 원인 판별)까지 이미 문서화되어 있다. 즉 이번 PR 이 "만든" 결함이 아니라 이번 PR 이 고치는 결함(감사 중복)과 짝을 이루는 **별개의, 여전히 열려 있는** 동시성 결함이다.
  - 제안: 코드 자체의 자기-문서화(주석 `:817-821`)와 트래커 등재(followups.md 신규 항목, 우선순위 "중간")로 이미 추적되고 있으므로 이번 PR 을 막을 사유는 아니다. 다만 이 리뷰 시점 기준으로 shipped 코드에 실측 재현된 권한 우회(비-owner 가 결과적으로 owner 를 지울 수 있음)가 남아 있다는 사실은 명시적으로 기록해 둔다 — 다음 PR 에서 `role: Not('owner')` 처방을 적용할 때 `affected === 0` 의 의미가 "행 없음"과 "owner 로 변경됨" 두 가지로 갈리므로, 그 판별자 오염을 피하기 위해 0-행 시 1회 재조회로 원인을 가르는 candidate fix 설계(이미 문서화됨)를 그대로 따르면 된다.

- **[INFO]** 이번 PR 의 핵심 수정 자체는 동시성 관점에서 타당하고, 검증도 견고하다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:822-831` (`memberRepository.delete({ id, workspaceId })` → `affected === 0` 명시 비교 → 404)
  - 상세: 종전 `remove(member)` 는 무락 조회로 얻은 in-memory 엔티티를 지우는 방식이라 이미 지워진 행에 대해서도 예외를 던지지 않아, 동시 제거 두 건이 둘 다 감사 행(`member.removed`, `mode='removed'`)을 남기는 결함이 있었다(§B 서술, 형제 다섯 #1369~#1372 와 동일 클래스). 단일 `DELETE … WHERE id = $1 AND workspace_id = $2` 문은 DB 단에서 원자적이므로 동시 두 건 중 정확히 하나만 1행을 지우고, 나머지는 `affected: 0` 을 받아 404 로 종료한다 — 새 락을 들이지 않고도 레이스를 닫는 올바른 선택이다. 판정을 `affected === 0` **명시 비교**로 한 것도 옳다 — `null`/`undefined`(드라이버 미보고)를 falsy 로 오판하면 정상 삭제가 404 로 뒤집히는데, 이를 방지하는 대조군 테스트(`it.each([[undefined],[null]])`, `workspaces.service.spec.ts:1518-1531`)가 함께 추가되어 이 회귀를 구조적으로 막는다.
  - 제안: 없음(정상). 참고로 unit 테스트(`workspaces.service.spec.ts:1453-1569`)와 e2e 테스트(`member-remove-concurrency.e2e-spec.ts`) 모두 이 판정 경로를 잘 커버한다.

- **[INFO]** e2e 동시성 테스트(`member-remove-concurrency.e2e-spec.ts`)의 레이스 구성이 견고하다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:88-118` (첫 테스트), `:167-193` (자가 탈퇴 테스트)
  - 상세: 별도 커넥션(`locker`)이 대상 멤버 행을 `SELECT … FOR UPDATE` 로 잡아 두고 두 `DELETE` 요청을 `Promise.all` 로 동시 발사한 뒤, `Promise.race` 로 1.5초 안에 둘 다 아직 끝나지 않았음을 먼저 확인(공허성 가드)하고 나서 `COMMIT` 으로 함께 푸는 방식이다. 이는 애플리케이션 레벨의 `setTimeout` 인터리빙에 의존하지 않고 DB 행 락으로 결정적 겹침을 만드는 정석적인 방법이며, 두 요청 모두 무락 조회·가드(owner 금지·admin 확인)를 통과한 뒤 `DELETE` 문에서만 대기하도록 정확히 겨냥한다. `finally` 블록에서 `pending?.catch(() => undefined)` 로 뒤처리해 다음 테스트로 미해결 프라미스(unhandled rejection)가 새지 않도록 한 점도 적절하다.
  - 제안: 없음(정상).

## 요약

핵심 변경(`removeMember()`에 원자적 `DELETE`+`affected === 0` 명시 비교 도입)은 무락 `findOne`→`remove(entity)` 조합이 갖던 "동시 제거 두 건이 둘 다 감사를 남기는" 레이스를 새 락 없이 정확하게 닫으며, 판별자 오염(`null`/`undefined`를 0 으로 오판)까지 막는 대조군 테스트와 실제 DB 행 락으로 겹침을 만드는 e2e 테스트가 함께 추가되어 검증 수준이 높다. 다만 `member.role === 'owner'` 가드가 여전히 무락 스냅샷 위에 있어, 그 검사와 `DELETE` 사이에 동시 `transferOwnership()` 이 대상을 owner 로 승격시키면 owner 가 삭제될 수 있는 TOCTOU 가 남아 있다 — 이는 이번 PR 이 새로 만든 결함이 아니라 이미 실측 재현되고 후보 처방까지 문서화된, 의도적으로 범위 밖에 둔 별개의 결함이다. 코드 커밋 자체가 이 사실을 주석으로 자기-문서화하고 있으므로 은폐된 리스크는 아니지만, shipped 코드에 남아 있는 실측된 권한 우회 경로라는 점은 리뷰 기록에 남긴다.

## 위험도

LOW
