# 테스트(Testing) 리뷰 — trigger-rotation-audit

## 검증 방법 (직접 재현)

지시대로 워킹트리는 건드리지 않고, `codebase/backend`(src + jest.config.ts + tsconfig.json)를
repo 밖 scratch(`/private/tmp/.../scratchpad/mutation-test/backend`)로 복사하고 `node_modules`
만 실제 repo 쪽으로 symlink 해 그 사본에서 `jest`를 직접 실행했다. 복사 직전/직후 매번
`git status --short -- <대상 파일>` 로 워킹트리가 깨끗한지 확인했다(이 저장소는 리뷰 도중에도
다른 세션이 실제로 커밋하는 것을 두 번 관측했다 — `8b2ae7164` → `9eb2c6088` 로 HEAD 가
리뷰 중 이동했고, 이후 `audit-action.const.ts`/`spec/5-system/1-auth.md` 에도 미커밋 편집이
나타났다. 이는 이 리뷰의 대상 코드가 아니라 병렬 세션의 흔적이라 판단해 반영하지 않고, HEAD
가 안정된 시점 — 현재 `9eb2c6088`, `git status` clean — 의 스냅샷만 mutation 대상으로 삼았다).

### 재현 1 — 지난 CRITICAL 의 두 뮤턴트

- **뮤턴트 A(감사 호출 완전 삭제)**: `rotateBotToken` 의 `recordAudit(...)` 7줄 블록을 scratch
  사본에서 통째로 삭제 → `감사 — 성공 시 trigger.chat_channel_bot_token_rotated 를 남긴다`
  1건 **FAIL**(`Number of calls: 0`). **RED 확인.**
- **뮤턴트 B(조기 발화)**: 같은 블록을 step 3(`primary botTokenRef` 저장) 직후, step
  4(`setupChannel`) 호출 **이전**으로 옮김 → `감사 — 오케스트레이션이 중간에 실패하면
  남기지 않는다` 1건 **FAIL**(`Received number of calls: 1`, `setupChannel` 이 던졌는데도
  감사가 이미 찍힘). **RED 확인.** 같은 mutant 로 `rotateBotToken` describe 전체(10건)를
  돌려도 실패는 이 1건뿐 — 새 테스트가 정확히 이 결함류만 잡고 다른 케이스를 오염시키지
  않는다.

두 뮤턴트 모두 커밋 메시지(`9eb2c6088`)의 주장("두 뮤턴트 모두 이제 RED")과 내 직접 실측이
일치한다. **지난 CRITICAL(테스트 부재)은 해소됐다.**

### 재현 2 — 신규 회귀 2건의 vacuous 여부

- 성공 케이스: 뮤턴트 A(호출 삭제)에서 FAIL 하므로 실제로 `auditLogs.record` 호출 여부와
  인자(`workspaceId`/`userId`/`action`/`resourceType`/`resourceId`)를 검증하고 있다.
  `action` 을 상수(`AUDIT_ACTIONS.X`)가 아니라 문자열 리터럴로 박아 상수 오염까지 방어하는
  설계도 확인(`triggers.service.spec.ts:1781-1782`).
- 실패 케이스: 뮤턴트 B(조기 발화)에서 FAIL 하므로 "실제 6단계 실패 후 감사 미기록"을
  검증하고 있다. `mockAdapter.setupChannel.mockRejectedValueOnce` 로 실제 4단계를 실패시켜
  `.rejects.toBeDefined()` + `not.toHaveBeenCalled()` 를 함께 확인 — 진짜 실패 경로다.

**신규 회귀 2건은 vacuous 하지 않다.**

## 발견사항

- **[WARNING]** `rotateNotificationSecret`/`revokePerTriggerToken` 은 "실패 시 감사 미기록"을
  똑같이 검증하지 못한다 — `rotateBotToken` 과 달리 실제 상태변경(`triggerRepository.save`)
  실패가 아니라 **사전 validation 예외**로만 그 사실을 흉내 낸다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2410-2421`
    (`rotateNotificationSecret 가 던지면 감사를 남기지 않는다`) · 같은 파일
    `revokePerTriggerToken` 관련 858-899 (이 메서드는 이 종류의 감사 실패 테스트가 **아예
    없다**) · 대응 구현은 `codebase/backend/src/modules/triggers/triggers.service.ts:902-981`
    (`rotateNotificationSecret`/`revokePerTriggerToken`, 두 곳 다 `save()` 직후에
    `recordAudit` 호출 — 현재 순서는 **맞다**)
  - 상세: `rotateNotificationSecret 가 던지면 감사를 남기지 않는다` 테스트는
    `config: {}` (notification 미설정)로 **`NOTIFICATION_NOT_CONFIGURED` validation 예외**를
    유도한다 — 이 예외는 `triggerRepository.save()` 도달 전에 던져지므로, "감사가
    `save()` 완료 **이후**에 기록되는가"는 전혀 검증하지 않는다(검증 없이도 항상 통과하는
    성질). 직접 재현: scratch 사본에서 두 메서드 모두 `recordAudit(...)` 호출을
    `triggerRepository.save(trigger)` **호출 이전**으로 옮기는 뮤턴트를 적용했더니(즉
    "저장 실패해도 이미 감사가 찍히는" 원래 CRITICAL 과 같은 결함류), 두 메서드 모두 관련
    테스트 전부 **GREEN**(생존) — `revokePerTriggerToken` 4건 전부 통과, `rotateNotificationSecret`
    4건 전부 통과. 같은 파일의 `create`/`update` 는 이미 이 불변식을 정확히 잠그는 선례가
    있다(`triggers.service.spec.ts:2513-2532` `저장이 실패하면 감사를 남기지 않는다
    (create/update)` — `triggerRepo.save.mockRejectedValue(...)` 로 진짜 저장 실패를
    유도). `rotateBotToken` 의 신규 실패 테스트는 자기 docstring 이 "실패 경로는
    `setupChannel`(4단계) 실패로 만든다" 라고 범위를 정확히 좁혀 적어 과대주장이 없는
    반면, `rotateNotificationSecret` 쪽 docstring("실패하면 남기지 않는다")은 일반화된
    문구라 실제로 검증한 범위(사전 validation)보다 넓게 읽힌다. 라이브 결함은 아니다 —
    현재 소스 순서(save 후 recordAudit)는 정확하다. 다만 미래에 누군가 (예: `create()`
    의 "감사를 먼저 남긴다" W6 패턴을 이 자리에도 무심코 적용하는 리팩터를 하면) 조용히
    "회전은 실패했는데 감사만 남는" 거짓 기록을 재도입해도 현재 테스트는 못 잡는다 —
    정확히 이번 커밋(`9eb2c6088`)이 `rotateBotToken` 에 대해 닫으려 했던 결함류가 나머지
    두 자매 메서드에는 그대로 남아 있다.
  - 제안: `create`/`update` 의 `저장이 실패하면 감사를 남기지 않는다` 패턴을 그대로 재사용해
    `triggerRepo.save.mockRejectedValue(...)` 기반 실패 테스트를 `rotateNotificationSecret`·
    `revokePerTriggerToken` 각각에 추가. CRITICAL 로 올리지 않는 이유: (1) 현재 구현
    순서는 올바르다(라이브 버그 없음), (2) 발현하려면 "DB 저장 실패" + "향후 순서를 흔드는
    리팩터" 두 조건이 겹쳐야 한다, (3) 이번 PR 이 명시적으로 검증하겠다고 약속한 범위는
    `rotateBotToken` 1건이었고 그 CRITICAL 은 실측대로 해소됐다.

- **[INFO]** `rotateBotToken` 자체도 6단계 중 5→6단계 구간(`secrets.rotate` 웹훅 시크릿
  저장 이후, `triggerRepository.update` 컬럼 갱신 이전) 으로 감사를 옮기는 뮤턴트는 여전히
  생존한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1090-1119` (5·6단계
    구간) · 테스트는 `triggers.service.spec.ts:1774-1799`
  - 상세: 직접 재현 — `recordAudit` 를 "6. trigger 컬럼 갱신" 주석 직전(5단계 완료 후,
    6단계 `triggerRepository.update` 호출 전)으로 옮겨도 `rotateBotToken` describe 10건이
    전부 GREEN. 신규 실패 테스트는 스스로 "4단계 실패로 만든다"고 범위를 밝혀 두었으므로
    과대주장은 아니지만, 6단계 오케스트레이션 중 감사 이전에 실행되는 나머지 두 단계
    (5·6단계)에 대한 mutation coverage 는 비어 있다는 사실 자체는 남는다.
  - 제안: 필요하면 `triggerRepo.update.mockRejectedValueOnce(...)` 로 6단계 실패 케이스를
    추가해 "컬럼 갱신 자체가 실패해도 감사가 안 남는다"까지 잠글 수 있다. 우선순위는 낮음
    — `update()` 는 순수 컬럼 갱신이라 실패 확률이 setupChannel(외부 API) 보다 훨씬
    낮고, 이 mock 은 현재도 항상 resolve 한다.

- **[INFO/PASS]** `triggers.controller.spec.ts` 의 신규 "userId 배선" 3건은 위치 고정
  positional assertion(`toHaveBeenCalledWith(id, WS, USER)` / `(id, WS, 'tok', USER)`)을
  써서 인자 스왑을 실제로 잡는 구조다 — `objectContaining` 이었다면 놓쳤을 스왑이다. 컨트롤러
  구현(`triggers.controller.ts:192-265`)의 실제 인자 순서와 대조해 일치 확인.

- **[INFO/PASS]** `.claude/tests/test_consistency_bundle_priority.py` 의 `rank == 0` →
  `rank < tier0_size` 완화는 근거(실측 재현 사례, "같은 브랜치가 같은 디렉터리의 다른 spec 을
  커밋하면 tier 0 이 여럿"日)가 코드/주석에 명시돼 있고, 앞의 `assertTrue(got["tier0"], ...)`
  단언이 "tier 0 이탈"을 여전히 잡아 vacuous 하지 않다. 이 PR 의 핵심 대상(트리거 감사)과는
  무관한 harness 드라이브바이 수정.

## 요약

지시받은 CRITICAL(`rotateBotToken` 감사 미검증, 뮤턴트 2종 GREEN)은 repo 밖 scratch 사본에서
직접 뮤테이션을 재현해 두 뮤턴트 모두 현재 RED 임을 확인했고, 신규 회귀 2건 모두 실제 실패
경로(`setupChannel` 4단계 실패)로 동작해 vacuous 하지 않다 — **해소 확인**. 다만 같은 검증을
하는 과정에서 자매 메서드(`rotateNotificationSecret`/`revokePerTriggerToken`)의 "실패 시 감사
미기록" 테스트가 실제로는 저장(`save`) 실패가 아니라 사전 validation 예외만 흉내 내고 있어,
"감사가 상태변경 완료 이전에 기록되도록 옮겨지는" 같은 결함류의 뮤턴트가 여전히 GREEN 으로
생존함을 새로 발견했다(WARNING — 라이브 버그 아님, 순서 자체는 현재 올바름). 두 파일 모두
`create`/`update` 에 이미 있는 "저장 실패 시 감사 미기록" 패턴을 그대로 재사용하면 닫을 수
있는 저비용 항목이다. 리뷰 도중 이 워킹트리에 다른 세션의 실제 커밋(HEAD 이동)과 미커밋 편집이
관측됐으나 리뷰 대상 코드와 무관해 판정에 반영하지 않았다.

## 위험도

LOW — 지시된 CRITICAL 은 직접 재현으로 해소가 확인됐고, 신규 발견은 라이브 결함이 아닌
mutation-coverage 잔여 갭(WARNING/INFO)이다.
