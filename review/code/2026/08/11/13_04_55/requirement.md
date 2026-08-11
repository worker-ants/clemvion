# 요구사항(Requirement) 리뷰 — `13_04_55` (4차 재확인 라운드)

## 확인 범위 (호출자 지시)

직전 라운드(`12_56_06`)는 NONE 이었다. 이번 델타는 커밋 `3db28b205` 하나 — `triggers.service.spec.ts`
의 결합 테스트(`저장이 실패하면 감사를 남기지 않는다 (회전 2종 — 검증이 아니라 save 가 던진다)`)를
`rotateNotificationSecret`/`revokePerTriggerToken` 각각의 `it()` 로 분리한 것뿐이다. 코드(운영) 변경
없음, spec 변경 없음 — `git show 3db28b205 --stat` 확인 결과 변경 파일은
`triggers.service.spec.ts` + `plan/in-progress/spec-sync-auth-gaps.md` + 리뷰 산출물뿐이다.

## 1. 분리된 두 테스트가 불변식을 여전히 온전히 표현하는가

원본(결합) 테스트는 한 `it()` 안에서 두 시나리오를 순차 실행했다:

```
save.mockRejectedValue('db down')
findOne → notification 유효 config
expect(rotateNotificationSecret(...)).rejects.toThrow('db down')
expect(auditLogs.record).not.toHaveBeenCalled()   // ①

findOne → interaction 유효 config
expect(revokePerTriggerToken(...)).rejects.toThrow('db down')
expect(auditLogs.record).not.toHaveBeenCalled()   // ②
```

분리 후 각 `it()` 는 `save`/`findOne` mock 설정 → `rejects.toThrow('db down')` → `auditLogs.record`
`not.toHaveBeenCalled()` 3단을 **그대로 각자 반복**한다 — 어느 한쪽도 assertion 을 줄이거나
완화하지 않았다(`git show 3db28b205 -- codebase/backend/.../triggers.service.spec.ts` 로 diff 직접
대조). 오히려 원본 ②의 `not.toHaveBeenCalled()` 는 "①에서도 안 불렸고 ②에서도 안 불렸다"는
누적 상태를 보는 것이었는데, 분리 후에는 `beforeEach` 가 매 `it()` 마다 새 `moduleRef`/새
`auditLogs` mock 을 만들기 때문에(`:2303-2320` 확인) 각 테스트가 **자기 메서드 호출 하나만**을
정확히 겨냥한다 — 판별력이 오히려 명확해졌다(약해지지 않았다).

**독립 재현.** 리뷰 중 이 워크스페이스에 이미 존재하던(이 커밋과 무관한, 아래 §4 참고) `save()`↔
`recordAudit()` 순서 반전 뮤턴트가 `rotateNotificationSecret` 에만 걸린 상태를 관측했다:

```
$ npx jest triggers.service.spec.ts -t "저장이 실패하면 감사를 남기지 않는다"
FAIL … rotateNotificationSecret — 저장이 실패하면 감사를 남기지 않는다   ← RED
```

같은 상태로 전체 스위트를 돌리면 실패는 정확히 그 1건뿐이고(`revokePerTriggerToken — 저장이
실패하면 감사를 남기지 않는다` 는 GREEN) — 커밋 메시지가 주장한 표(A: notification 만 반전 →
notification RED · interaction GREEN)와 **정확히 일치**한다. 분리가 "뮤턴트 1:1 대응"을 실제로
만들어냈다는 주장은 우연히도 라이브로 검증됐다.

결론: 불변식("회전이 실패하면 감사를 남기지 않는다")은 두 갈래(`rotateNotificationSecret`,
`revokePerTriggerToken`) 각각에서 여전히 온전히, 오히려 더 정밀하게 표현된다.

## 2. spec 6곳 ↔ 코드 line-level 일치 유지 여부

이 커밋은 spec 파일도 production 코드도 건드리지 않는다(`git log --oneline -- spec/5-system/1-auth.md
spec/conventions/audit-actions.md spec/data-flow/1-audit.md spec/5-system/15-chat-channel.md
spec/2-navigation/2-trigger-list.md spec/5-system/14-external-interaction-api.md CHANGELOG.md
codebase/backend/src/modules/audit-logs/audit-action.const.ts` → 마지막 손댄 커밋은 각각
`d71a53127`(spec 4곳, planner 턴)·`f5d485a52`(CHANGELOG/const, 라운드2 fix)이고 `3db28b205` 는
이 목록에 없음). `12_56_06` 라운드가 이미 6곳 전부 재확인해 NONE 판정을 냈고, 그 이후 아무것도
바뀌지 않았으므로 **일치 상태는 그대로 유지된다.** 새로 열어 재검증할 대상이 없다.

## 3. PR 전체 전수 점검 — 약속(회전/폐기 3종 감사)을 빠짐없이 이행했는가

- **감사 3건 배선** — `triggers.service.ts` (커밋된 HEAD 상태, `git show HEAD:...`):
  - `rotateNotificationSecret` — `save()` (`:924`) → `recordAudit(TRIGGER_NOTIFICATION_SECRET_ROTATED)` (`:925-931`) 순서 정확.
  - `revokePerTriggerToken` — `save()` (`:972`) → `recordAudit(TRIGGER_INTERACTION_TOKEN_REVOKED)` (`:973-979`) 순서 정확.
  - `rotateBotToken` — 6단계 오케스트레이션의 마지막 컬럼 갱신(`:1108-1110`) 뒤에
    `recordAudit(TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED)` (`:1113-1119`) — "컬럼 갱신이 끝난 뒤에
    기록한다" 주석과 실제 위치 일치.
- **컨트롤러 배선** — `triggers.controller.ts` 세 핸들러 모두 `@Roles('editor')` (`:177,205,239`)
  로 보호되고 `@CurrentUser('sub') userId` 를 받아 서비스로 전달(`:195,223,251`) — 감사 필수
  필드인 `userId` 누락 없음.
- **테스트 커버리지** — 3종 각각에 대해 "성공 시 정확한 액션명으로 기록"(`:2369`,`:2388`) +
  "검증 예외로 실패하면 기록 안 함"(`:2410`, notification 만 — revoke 쪽은 이 층위 테스트가
  원래 없었고 이번 커밋도 추가하지 않았으나, 아래 save-실패 테스트가 더 엄격한 상위 방어선이라
  실질 갭 아님. `12_56_06` 라운드가 이미 확인) + "**save() 자체가 실패하면 기록 안 함**"
  (`:2440`,`:2456` — 이번 커밋이 분리한 자리, 회전 2종 모두 존재) 세 층위가 갖춰져 있다.
  `rotateBotToken` 은 별도 describe(`:1652`)에서 성공/실패 회귀를 갖추고 있으며, 5→6 구간
  (컬럼 갱신 직후) 뮤턴트 잔여 1건은 `plan/in-progress/spec-sync-auth-gaps.md:77-82` 에 INFO
  로 정확히 등재된 채 그대로 열려 있다 — 이번 커밋이 다루지 않았고 다뤄야 할 이유도 없다
  (선언된 범위 밖).
- **plan 체크리스트** — `spec-sync-auth-gaps.md:56` "트리거 시크릿/토큰 회전 3종 감사" 항목은
  `[x]` 완료로 정확히 표기돼 있고, 남은 두 항목(`:69` 적재 실패 관측 부재,`:77` mutation 잔여
  1건,`:83` 주석 비대화)은 전부 "이 PR 범위 밖" 또는 "다음 확장 시점" 으로 명시적으로 defer
  됐다 — 상태 서술과 실제 코드 상태가 어긋나지 않는다.
- TODO/FIXME/HACK/XXX — 이번 델타(`git show 3db28b205 -- triggers.service.spec.ts`) 전수
  grep 0건.

**결론: PR 이 원래 약속한 회전/폐기 3종 감사는 배선·검증·문서(spec/CHANGELOG/plan) 전 층위에서
빠짐없이 이행됐다. 이번 델타(테스트 분리)는 그 이행의 증거(mutation 판별력)를 강화했을 뿐 아무것도
후퇴시키지 않았다.**

## 4. 참고 (이번 커밋과 무관한 관측 — 발견사항 아님)

리뷰 중 워크스페이스에 **커밋되지 않은** 로컬 변경이 하나 떠 있는 것을 관측했다:
`triggers.service.ts` 의 `rotateNotificationSecret` 에서 `save()`↔`recordAudit()` 순서가
바뀌어 있었다(`git diff` 로 확인, `git status` 에도 잡힘). `git show HEAD:...` 로 대조하면
커밋된 내용은 정상 순서(`save()` 먼저)이므로 이것은 **이 PR 의 코드가 아니라** 같은 워크트리를
공유하는 다른(동시) 프로세스의 뮤테이션 실측 산출물로 보인다 — 정황(정확히 §1 에서 언급된
"A 뮤턴트"와 동일 위치·동일 방향)이 이를 뒷받침한다. 본 리뷰는 이 파일을 건드리지 않았고
복원(`cp`)도 하지 않았다 — 그 프로세스가 스스로 정리할 것으로 보이며, 리뷰 종료 후에도 남아
있다면 `git diff codebase/backend/src/modules/triggers/triggers.service.ts` 로 잔존 여부를
push 전에 확인할 필요가 있다(관례상 `cp` 원복, `git checkout` 금지).

## 요약

새 델타(`3db28b205`)는 결합 테스트 하나를 `rotateNotificationSecret`/`revokePerTriggerToken`
각각의 독립 `it()` 로 분리했을 뿐이며, assertion 강도(throws + `auditLogs.record` 미호출)를
양쪽 모두 그대로 보존한다 — 오히려 매 테스트가 독립 `moduleRef`/`auditLogs` mock 을 쓰게 되어
"어느 자매가 실패했는지"의 판별력이 이전보다 명확해졌다. 리뷰 중 라이브로 관측된(이 커밋과
무관한 동시-세션 뮤테이션) `save()`↔`recordAudit()` 순서 반전 상태에서 정확히 `rotateNotificationSecret`
테스트만 RED·`revokePerTriggerToken` 테스트는 GREEN 이었던 것이 커밋 메시지의 주장(뮤턴트-테스트
1:1 대응)을 독립적으로 뒷받침한다. spec 6곳은 이 델타가 건드리지 않아 `12_56_06` 의 NONE 판정이
그대로 유지되고, PR 전체를 마지막으로 훑어도 회전/폐기 3종 감사는 배선·테스트·문서 전 층위에서
빠짐없이 이행돼 있다(잔여 두 항목은 의도적으로 defer된 것으로 plan 에 정확히 반영). 새 CRITICAL
없음.

## 위험도

NONE

STATUS: OK
