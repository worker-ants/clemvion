# 테스트(Testing) 리뷰 — trigger-rotation-audit (재확인 라운드, `12_56_06`)

## 배경

직전 라운드(`12_37_14`)에서 낸 WARNING: `rotateNotificationSecret`/`revokePerTriggerToken` 의
"실패 시 감사 미기록" 테스트가 `save()` 실패가 아니라 사전 validation 예외만 흉내 내, 감사를
상태변경(`save()`) **앞**으로 옮기는 뮤턴트가 두 메서드 모두에서 GREEN 으로 생존했다.

수정 커밋 `f5d485a52` — `triggers.service.spec.ts` 에 `저장이 실패하면 감사를 남기지 않는다
(회전 2종 — 검증이 아니라 save 가 던진다)` 1건 추가(:2434-2454). `RESOLUTION.md`(`12_37_14`)에
"둘 다 반전 RED(:2444)" · "`revokePerTriggerToken` 만 반전 RED(:2453)" 라고 자체 실측이 적혀
있다. 이번 라운드는 그 주장을 **독립적으로 재현**해 판정한다.

## 검증 방법 (직접 재현)

워킹트리는 건드리지 않았다. `codebase/backend/src`(+ `jest.config.ts`/`tsconfig*.json`/
`package.json`)를 repo 밖 scratch
(`/private/tmp/.../scratchpad/mutation-test-2/backend`)로 `cp -R` 복사하고, `node_modules` 만
실제 repo 쪽으로 `ln -s` 해 그 사본에서 `jest` 를 직접 실행했다. 뮤테이션 전 `triggers.service.ts`
를 별도로 백업(`triggers.service.ts.orig`)해 두고, 각 뮤턴트 적용 후에는 **`cp` 로 백업을
원본 위치에 덮어써 원복**했다(`git checkout` 미사용). 매 원복 뒤 `diff -q` 로 바이트 단위 일치를
확인했다. 실제 저장소(`codebase/backend/src/modules/triggers/`)는 전 과정 동안 `git status
--short` 로 clean 유지를 확인했다.

## 재현 1 — 두 뮤턴트를 각각 단독으로 세웠다

지시대로 "한 테스트 안에서 앞 단언이 뒤 단언을 가리는" 위험을 피하려고, **`rotateNotificationSecret`
만 반전**한 사본과 **`revokePerTriggerToken` 만 반전**한 사본을 별도로 만들어 각각 신규 테스트
하나만 돌렸다(`jest -t "저장이 실패하면 감사를 남기지 않는다 \(회전 2종"`).

| 뮤턴트 (범위) | 실제 조작 | 결과 |
|---|---|---|
| A — `rotateNotificationSecret` 만, `revokePerTriggerToken` 은 원본 유지 | `recordAudit(...)` 블록을 `await this.triggerRepository.save(trigger);` **앞**으로 이동(:924-931 순서 반전) | **FAIL** — `:2444` (`Received number of calls: 1`, 회전 액션이 이미 기록된 채로 `save` 를 던짐) |
| B — `revokePerTriggerToken` 만, `rotateNotificationSecret` 은 원본 유지 | 같은 방식으로 `recordAudit` 를 `save()` 앞으로(:972-979 순서 반전) | **FAIL** — `:2453` (notification 쪽 전반부는 통과하고 interaction 쪽 후반부에서 실패 — 앞이 뒤를 가리지 않음을 실측으로 확인) |

두 뮤턴트 모두 **단독으로 RED**. 특히 B 는 A 가 무결한 상태에서도 후반부 단언(`:2453`)까지
정상 도달해 실패했다 — "앞 단언이 뒤를 가린다" 는 우려가 이 테스트에는 해당하지 않음을 직접
확인했다(원복 후 전체 스위트도 재확인: `codebase/backend/src/modules/triggers/` +
`src/modules/audit-logs/` 7 suites / **171 passed** / 1 skipped(무관한 기존 structural
anchor `:796`) — 커밋 메시지의 "171 passed" 주장과 일치).

**직전 WARNING 은 해소됐다.**

## 재현 2 — 신규 테스트가 vacuous 하지 않은지

- `rotateNotificationSecret` 쪽 mock: `config: { notification: { url: 'https://x.example/hook' } }`
  — validation 조건(`url` 이 string)을 만족해 `NOTIFICATION_NOT_CONFIGURED` 를 우회하고
  `triggerRepository.save()` 까지 도달한다. 실패는 `triggerRepo.save.mockRejectedValue(new
  Error('db down'))` 에서 나오고, 단언은 `.rejects.toThrow('db down')` 로 그 특정 에러를
  못박는다 — validation 예외(`BadRequestException`)와 혼동될 수 없다.
- `revokePerTriggerToken` 쪽 mock: `config: { interaction: { tokenStrategy: 'per_trigger' } }`
  — validation 조건(`tokenStrategy === 'per_trigger'`)을 만족해 `NOT_PER_TRIGGER_STRATEGY` 를
  우회하고 같은 `save()` 실패로 이어진다.
- 두 서브케이스 모두 원본(뮤테이션 없는) 소스에서 `.rejects.toThrow('db down')` +
  `expect(auditLogs.record).not.toHaveBeenCalled()` 가 통과하고(baseline GREEN), 재현 1 에서
  순서를 반전하면 정확히 그 자리에서만 RED 로 전환된다 — mock 설정이 실제로 각 메서드의
  `save()` 도달 경로에 배선돼 있음을 확인했다.

**신규 테스트는 vacuous 하지 않다.**

## 재현 3 — `rotateBotToken` 5→6 구간 갭 등재 확인

`plan/in-progress/spec-sync-auth-gaps.md:77-82` 에 "**회전 감사 mutation 잔여 갭 1건**
(2026-08-11, ai-review `12_37_14` testing INFO)" 항목이 실제로 존재한다 — `rotateBotToken`
의 실패경로 회귀가 4단계(`setupChannel`)에만 실패를 주입해 5→6 구간(웹훅 시크릿 저장 이후,
컬럼 갱신 이전)으로 감사를 옮기는 뮤턴트는 여전히 생존한다는 내용과, 그 테스트의 docstring 이
스스로 4단계로 범위를 좁혀 거짓 서술이 아니라는 caveat 이 함께 적혀 있다. **의도적 미수정으로
확인** — 재지적하지 않는다.

## 발견사항

- **[INFO/PASS]** 직전 라운드 WARNING(`rotateNotificationSecret`/`revokePerTriggerToken` 실패
  테스트가 사전 validation 만 흉내 냄) — repo 밖 scratch 사본에서 두 메서드를 각각 단독으로
  뮤테이션해 **둘 다 독립적으로 RED** 임을 재현으로 확인. 해소.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2434-2454` (신규
    테스트) · 대응 구현 `codebase/backend/src/modules/triggers/triggers.service.ts:902-936`,
    `946-981`
  - 상세: 위 "재현 1", "재현 2" 참조.

- **[INFO]** 신규 테스트 한 건이 두 메서드(notification/interaction)의 실패경로를 순차로
  검증한다(`it` 블록 하나에 두 서브케이스). 커밋(`f5d485a52`)이 이미 "왜 따로 실행해 확인했는지"
  를 스스로 설명해 뒀고(자매를 각각 단독으로 살려 확인), 이번 재현에서도 B(후반부)가 A(전반부)
  무결 상태에서 독립적으로 도달·실패함을 실측했으므로 은폐 위험은 없다. 다만 향후 셋 중 하나만
  실패하는 회귀가 생기면 리포트가 "몇 번째 서브케이스인지"를 스택트레이스 라인 번호로만
  알려준다 — 가독성 관점에서 두 개의 별도 `it` 로 쪼개는 편이 실패 시 진단은 더 빠르겠지만,
  현재도 라인 번호(:2444 vs :2453)로 구분 가능해 우선순위는 낮다.

- **[INFO/PASS]** `rotateBotToken` 5→6 구간 mutation 잔여 갭은 `plan/in-progress/
  spec-sync-auth-gaps.md:77-82` 에 등재돼 있음을 확인 — 재지적하지 않음.

## 요약

직전 라운드(`12_37_14`)에서 지적한 WARNING(회전 2종 자매 메서드의 "실패 시 감사 미기록" 테스트가
`save()` 실패가 아니라 사전 validation 예외만 흉내 내 순서-반전 뮤턴트가 생존)은 커밋
`f5d485a52` 의 신규 테스트로 해소됐다. repo 밖 scratch 사본에서 두 메서드를 각각 **단독으로**
뮤테이션해(자매가 서로를 가리지 않도록) 재현한 결과 둘 다 독립적으로 RED 였고, mock 설정이
실제로 각 메서드의 `save()` 도달 경로에 배선돼 vacuous 하지 않음도 확인했다. `rotateBotToken`
5→6 구간의 남은 mutation 갭은 plan 에 실제로 등재돼 있어 재지적하지 않는다.

## 위험도

NONE — 지적한 WARNING 은 직접 재현으로 해소가 확인됐고, 남은 갭(rotateBotToken 5→6 구간)은
의도적 등재·미수정으로 이미 추적 중이다.

STATUS: OK
