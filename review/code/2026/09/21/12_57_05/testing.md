# 테스트(Testing) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정

## 대상
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (unit, 신규 `describe('removeMember — 동시 제거')` 블록 추가 + 기존 테스트 1건 보정)
- `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`removeMember()` — `remove(member)` → 원자적 `delete({id, workspaceId})` + `affected===0` 판정)
- `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` (신규 e2e, 행 락 기반 결정적 재현)
- `plan/in-progress/member-dup-remove.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 코드 아님, 테스트 관점 리뷰 대상에서 제외

## 발견사항

- **[WARNING]** 신규 `removeMember — 동시 제거` describe 블록에 "요청자가 admin/owner 가 아니면 `ADMIN_REQUIRED` 로 거부하고 `delete` 를 타지 않는다" 를 검증하는 테스트가 없다. 파일 전체를 봐도 `removeMember()` 에 대해 이 분기를 커버하는 테스트가 하나도 없다(`ADMIN_REQUIRED` 관련 기존 테스트는 전부 `updateWorkspaceSettings` 용, `workspaces.service.spec.ts:524,536,548`).
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1453` (describe 블록 전체) / 대응 구현: `codebase/backend/src/modules/workspaces/workspaces.service.ts:803` (`assertAdmin` 호출)
  - 상세: 이 PR 이 `assertAdmin` 바로 다음 줄부터를 완전히 재작성했고(무조건 `remove()` → 원자적 `delete`+`affected` 판정), 이 describe 블록은 owner-가드·self-위임·affected 판정까지 촘촘히 커버했음에도 "권한 없는 요청자" 케이스만 비어 있다. 이 갭 자체는 이 PR 이 새로 만든 것은 아니지만(가드 로직 자체는 손대지 않음), 이번에 `removeMember` 전용 describe 를 새로 만든 자리이므로 자연스러운 위치였다. 향후 누군가 `assertAdmin` 을 `delete` 뒤로 옮기는 실수(권한 검사가 삭제 이후로 밀리는 회귀)를 해도 이 describe 블록의 어떤 테스트도 잡지 못한다 — 모든 케이스가 `wireFindOne` 의 catch-all 분기(`{ id: 'mem-req', role: 'owner' }`)로 항상 admin 통과를 가정한다.
  - 제안: `it('admin 이 아니면 ADMIN_REQUIRED 이고 delete 를 시도하지 않는다', ...)` 를 추가 — `wireFindOne` 의 catch-all 리턴을 `{ role: 'editor' }` 로 오버라이드하고 `memberRepo.delete` 가 호출되지 않았음을 단언.

- **[INFO]** `getAudit()` 헬퍼가 `audit logging (결정4=B)` describe(:1154)와 신규 `removeMember — 동시 제거` describe(:1458)에 동일하게 중복 정의돼 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1458`
  - 상세: 두 describe 가 형제 블록이라 스코프 상 어쩔 수 없이 재정의한 것으로 보이나(같은 파일 안에서 하나로 못 올릴 이유는 없음), 파일 최상위(`describe('WorkspacesService', ...)` 바로 아래)로 끌어올리면 중복이 사라진다.
  - 제안: 급하지 않음 — 다음에 이 파일을 만질 때 최상위로 하나만 남기는 정리를 고려.

- **[INFO]** `it('진 쪽은 404 이고 감사를 남기지 않는다', ...)` 가 `NotFoundException` 발생과 감사 미호출은 단언하지만 `memberRepo.delete` 가 실제로 호출됐는지는 확인하지 않는다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1500`
  - 상세: `beforeEach` 가 `wireFindOne` 으로 항상 유효한 대상을 리턴하도록 세팅해 두었으므로 이 테스트에서 `NotFoundException` 의 유일한 발생원은 `affected===0` 분기임은 구조상 보장되지만, `expect(memberRepo.delete).toHaveBeenCalledWith({...})` 를 추가하면 "어느 분기에서 404 가 났는지"를 테스트 자체가 스스로 증명하게 되어 향후 리팩터로 두 NotFound 분기(대상 없음 vs affected 0)가 뒤섞여도 계속 의미 있게 남는다.
  - 제안: 선택적 보강.

- **[INFO]** `it.each([[undefined], [null]])` 대조군 테스트는 `affected === 0` 판정의 오귀속(`!affected`)을 정확히 겨냥한 좋은 설계다(플랜에 기록된 뮤턴트 검증: `=== 0` → `!affected` 뮤턴트가 이 대조군으로 2건 RED). 다만 이 테스트는 `getAudit().record` 가 호출됐다는 사실만 보고 payload(`resourceId`, `details.mode` 등)까지는 재확인하지 않는다 — 그 부분은 happy-path 테스트(:1483)가 이미 커버하므로 의도적 최소 단언으로 보이며 문제 삼을 정도는 아니다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1518`

- **[INFO]** `wireFindOne` 의 catch-all 분기가 요청자 멤버십을 항상 `role: 'owner'` 로 고정한다. `removeMember` 를 admin(owner 가 아닌)이 호출하는 경로는 이 describe 블록 안에서 한 번도 실행되지 않는다(대신 `assertAdmin` 은 owner/admin 둘 다 통과시키므로 실제 분기 커버리지 손실은 없음 — `ADMIN_ROLES = {owner, admin}`).
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1467`
  - 상세: 실질적 리스크는 낮다(두 역할이 같은 코드 경로를 타므로) — 참고용으로만 기록.

- **[INFO]** e2e (`member-remove-concurrency.e2e-spec.ts`) 는 형제 다섯 개(#1369~#1372)의 패턴을 그대로 따르되, 이 라우트 고유의 차이(200 vs 204, `mode='removed'` 필터)를 정확히 반영했고, 락을 놓기 **전** `Promise.race` 로 "아직 안 끝남"을 관측하는 공허성 가드(vacuousness guard)까지 갖췄다 — 과거 프로젝트에서 반복 지적된 "레이스가 실제로 안 걸렸는데 우연히 통과" 문제를 구조적으로 차단한다. 자가 탈퇴 위임 경계(`leaveWorkspace` 로 위임되면 이 PR 의 수정 대상이 아님)를 별도 e2e 테스트로 고정해 "위임 경계가 조용히 사라지는" 회귀까지 대비한 점도 좋다. 특별한 결함 없음.
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:61`, `:139`

- **[INFO]** owner 승격 TOCTOU(동시 `transferOwnership` 이 owner 가드를 우회하는 문제)는 이 PR 이 의도적으로 커버하지 않는다 — plan(`plan/in-progress/member-dup-remove.md` §C-2)과 consistency SUMMARY(WARNING 4)에 이미 프로브 결과와 함께 별도 트래킹돼 있다. 테스트 관점에서도 이 경계를 넘지 않은 것이 합리적(같은 diff 에서 `affected===0` 판별자의 의미를 둘로 늘리면 이번 PR 의 핵심 판별자 자체가 흐려진다는 근거가 타당함). 재-flag 불필요.

## 요약

새로 추가된 `removeMember — 동시 제거` unit describe 블록은 대상 실패(404)·owner 가드·자가 탈퇴 위임·그리고 `affected` 판정의 `null`/`undefined` 대조군까지 촘촘히 커버하며, 플랜에 기록된 두 건의 뮤테이션 테스트(`=== 0`→`!affected`, 404 분기 제거)가 각각 예측한 개수만큼 정확히 RED 를 냈다는 근거도 남겨 신뢰도가 높다. `wireFindOne` 헬퍼가 호출 순서가 아니라 `where` 절 형태로 두 `findOne` 호출을 구분하는 방식은 call-order mock 의 취약성을 피한 좋은 설계다. e2e 는 형제 다섯 개와 다른 두 지점(200 상태 코드·`mode` 필터)을 정확히 인지했고 락-기반 결정적 재현과 공허성 가드까지 갖춰 flaky 위험이 낮다. 유일하게 눈에 띄는 갭은 `removeMember()` 자체에 대한 권한 거부(`ADMIN_REQUIRED`) 테스트가 신규 describe 블록에도, 파일 전체에도 없다는 점이며, 이는 이번 PR 이 건드린 코드 바로 위 분기라 회귀 방지 관점에서 추가할 가치가 있다. 나머지는 전부 INFO 수준의 사소한 개선 여지(헬퍼 중복, 보조 단언 강화)이며 병합을 막을 사유는 아니다.

## 위험도

LOW
