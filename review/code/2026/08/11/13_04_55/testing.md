# 테스트(Testing) 리뷰 — trigger-rotation-audit (라운드 4, `13_04_55`)

## 배경

직전 라운드(`12_56_06`)는 NONE 이었고, maintainability 가 유일하게 WARNING(같은 `it()` 안에
자매 둘을 담아 "앞이 뒤를 가린다"고 진단문만 써 놓고 구조는 안 바꿨다)을, testing 은 같은 자리를
INFO 로 수렴시켰다. 이번 델타는 커밋 `3db28b205` 하나 — 그 지적을 실제로 처분해 `it()` 하나를
`rotateNotificationSecret` / `revokePerTriggerToken` 전용 두 개로 분리했다. production 코드
변경은 0. **형태가 바뀌었으므로 증거를 처음부터 재구축**했다.

## 검증 방법 (직접 재현, repo 밖 scratch)

기존 scratch 사본(`/private/tmp/.../scratchpad/mutation-test-2/backend`, `node_modules` 는
`ln -s` 로 repo 쪽 링크)의 `src/`를 이번 라운드의 최신 워킹트리로 새로 `cp -R` 갱신해 분리된
`it()` 두 개를 반영한 뒤, 뮤테이션 전 `triggers.service.ts` 를 별도 백업(`.orig2`)해 두고 매
뮤턴트 적용 후 **`cp` 로 원복**했다(`git checkout` 미사용). 매 원복 뒤 `diff -q` 로 바이트 단위
일치를 확인했다.

**운영상 특이사항**: 이번 라운드는 같은 세션 디렉터리(`review/code/2026/08/11/13_04_55/`)에
`security.md`/`maintainability.md`/`requirement.md` 가 이미 존재하는 것으로 보아 다른 reviewer
들이 **동시에** 같은 워크트리에서 돌고 있었다. 검증 도중 실제 저장소의
`codebase/backend/src/modules/triggers/triggers.service.ts` 가 **3회** 예고 없이 mutant B
(`revokePerTriggerToken` 의 `save`↔`recordAudit` 순서 반전)와 바이트 단위로 동일한 내용으로
dirty 상태가 됐다가 사라지는 것을 `git status --short` 로 관측했다 — 내 스크립트는 매번 scratch
경로(`/private/tmp/...`)만 대상으로 했고 실제 저장소 경로는 건드리지 않았으므로(모든 명령이 절대
경로였고, 뮤턴트 A 적용 시점의 diff 는 mutant A 내용이었는데 이후 시점엔 mutant B 내용으로
바뀌어 있어 내 자신의 잔여 상태가 아니라 **다른 프로세스의 쓰기**임을 시사) 다른 reviewer(들)가
같은 저장소 파일을 직접 뮤테이션하는 것으로 추정된다. 매번 `git restore --source=HEAD --` 로
즉시 원복하고 다음 단계로 넘어갔으며, 이 리뷰를 작성/제출하는 시점 기준 `git status --short` 는
clean 이다. **이는 이 PR 의 코드/테스트 결함이 아니라 리뷰 하니스의 동시성 위험**이므로 위험도
판정에는 반영하지 않지만, 다른 reviewer 의 산출물(특히 mutation 근거를 실제 저장소 파일에서
구했다고 주장하는 리포트)이 있다면 **repo-밖 scratch 를 실제로 썼는지** 별도 확인이 필요하다.

## 재현 1 — 분리된 두 테스트가 각각 자기 뮤턴트만 잡는가

`triggers.service.ts`(scratch 사본)에서 각 메서드의 `await this.triggerRepository.save(trigger)`
와 `await this.recordAudit({...})` 순서를 **한쪽 메서드만** 반전한 사본을 만들어
`jest -t "저장이 실패하면 감사를 남기지 않는다"` (3건 매칭: notification 분리본·interaction
분리본·기존 `create/update` 회귀)로 돌렸다.

| 뮤턴트 (범위) | 실제 조작 | 결과 |
|---|---|---|
| A — `rotateNotificationSecret` 만 반전 | `:924-931` 순서 반전 | **notification 테스트만 FAIL** (`:2453`, "Received number of calls: 1") — interaction 테스트·`create/update` 테스트는 GREEN (2 passed) |
| B — `revokePerTriggerToken` 만 반전 | `:972-979` 순서 반전 | **interaction 테스트만 FAIL** (`:2467`, "Received number of calls: 1") — notification 테스트·`create/update` 테스트는 GREEN (2 passed) |

두 뮤턴트 모두 **정확히 자기 테스트에서만** RED, 자매 테스트와 무관한 회귀(`create/update`)는
매번 GREEN — 커밋 메시지가 주장한 "뮤턴트와 실패 테스트가 1:1 대응"이 실측과 일치한다. 분리
전(단일 `it()`)에서 관측됐던 "A→앞 단언만 실패, B→라인 번호로 뒤 절반을 역산해야 확인 가능"
문제는 해소됐다 — 이제 실패 리포트의 테스트 이름 자체가 어느 자매인지 알려준다.

## 재현 2 — mock 셋업 누락으로 인한 vacuous 여부

분리된 두 `it()` 각각을 직접 읽었다(`triggers.service.spec.ts:2440-2468`):

- `rotateNotificationSecret` 쪽(`:2440-2454`): `triggerRepo.save` 를 `mockRejectedValue`,
  `triggerRepo.findOne` 을 `config: { notification: { url: ... } }` 로 **자체 설정** — validation
  을 통과해 `save()` 까지 도달하는 경로가 이 `it()` 안에 완결돼 있다.
- `revokePerTriggerToken` 쪽(`:2456-2468`): 마찬가지로 `save` mockRejectedValue +
  `findOne` 을 `config: { interaction: { tokenStrategy: 'per_trigger' } }` 로 **자체 설정**.

두 `it()` 모두 분리 이전 원본에 있던 mock 설정을 각자 완전한 형태로 복제해 가져갔다 — 어느 한쪽도
누락 없이 자기 완결적이다. 언마운트된(unmutated) baseline 재실행 결과 3건(두 분리 테스트 +
`create/update` 회귀) 전부 GREEN — 비어 있는 단언(vacuous pass)이 아니라 실제로 `save()` 실패
경로에 도달해 `.rejects.toThrow('db down')` 와 `not.toHaveBeenCalled()` 를 모두 검증한다.

## 재현 3 — 분리로 인한 다른 테스트 격리 훼손 여부

`describe('TriggersService — 감사 로깅 (trigger.*)')` 의 `beforeEach` 가 매 `it()` 마다
`Test.createTestingModule` 을 새로 `compile()` 하고 `triggerRepo`/`auditLogs` 를 다시 획득한다
(`:2303-2321`) — mock 상태가 테스트 간 공유되지 않는 구조라 `it()` 를 둘로 쪼개도 격리가 깨질
여지가 없다. 전체 스위트 재실행(`src/modules/triggers/` + `src/modules/audit-logs/`, scratch)
결과 **7 suites / 172 passed / 1 skipped** — 커밋 메시지의 "172 passed (직전 171 → +1, 하나가
둘로 갈렸다)" 주장과 정확히 일치. 다른 테스트의 회귀는 없다.

## 발견사항

- **[INFO/PASS]** `it()` 분리(커밋 `3db28b205`)가 의도한 효과를 낸다 — 뮤턴트 A/B 각각 자기
  테스트에서만 RED, 자매·이웃 테스트는 GREEN. mock 셋업 복제 누락 없음(양쪽 다 자체완결). 격리
  훼손 없음(172 passed, `beforeEach` 매회 재구성). 새 CRITICAL 없음.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2440-2468`
  - 상세: 위 "재현 1~3" 참조.

- **[INFO]** 리뷰 세션 도중(본 리뷰 작성자 외) 실제 저장소의
  `codebase/backend/src/modules/triggers/triggers.service.ts` 가 mutant 내용과 바이트 단위로
  일치하는 상태로 3회 dirty 관측됨 — 이 PR 의 결함은 아니고 동시 실행 중인 다른 reviewer(들)의
  mutation 스크립트가 scratch 대신 실제 워크트리 파일을 직접 건드리는 것으로 추정된다. 매번
  `git restore --source=HEAD --` 로 즉시 원복했고 현재 `git status --short` 는 clean. 다른
  reviewer 산출물 중 "실제 저장소에서 뮤테이션했다"는 근거 서술이 있다면 그 결과의 신뢰성을
  별도로 확인할 필요가 있다(review 위험도에는 미반영).

## 요약

새 델타(커밋 `3db28b205`)는 직전 라운드 maintainability WARNING / testing INFO 를 실제로
해소한다 — 자매를 담던 `it()` 하나를 `rotateNotificationSecret`/`revokePerTriggerToken` 전용 두
개로 분리했고, repo 밖 scratch 에서 독립 재현한 결과 뮤턴트 A·B 각각 정확히 자기 테스트에서만
RED, mock 셋업은 양쪽 다 자체완결(vacuous 아님), 전체 스위트 172 passed 로 다른 테스트 격리도
훼손되지 않았다. 커밋 메시지의 실측 주장(1:1 대응, 172 passed)이 그대로 재현됐다. 새 CRITICAL
없음. (검증 도중 다른 reviewer 로 추정되는 프로세스가 실제 저장소 파일을 일시적으로 mutate 하는
것을 관측했으나 이 PR 자체의 결함이 아니며 매번 즉시 원복해 최종 상태는 clean.)

## 위험도

NONE — 지적됐던 WARNING/INFO 는 형태 변경(테스트 분리) 후 재구축한 증거로 해소가 확인됐고, 새
CRITICAL 은 없다.

STATUS: OK
