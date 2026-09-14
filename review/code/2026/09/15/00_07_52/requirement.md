# 요구사항(Requirement) 리뷰 — trigger-config-lost-update (11라운드, 2026-09-15 00:07)

## 검토 방법

`git diff origin/main...HEAD` 로 `codebase/backend` 변경 17개 파일 전체를 `Read`/`grep` 으로
직접 열어 확인했다(프롬프트가 크기 제한으로 생략한 파일들도 포함). 핵심 대상:
`trigger-config-lock.ts`(신규) · `triggers.service.ts` · `chat-channel-binder.service.ts` ·
`hooks.service.ts` · `schedules.service.ts` · `chat-channel-input-rules.ts` · 대응 테스트/e2e ·
`plan/in-progress/trigger-config-lost-update.md`(10라운드 리뷰 처분 이력) · `CHANGELOG.md`.

이 PR 은 이미 같은 워크트리에서 10라운드 `/ai-review` 를 거쳤고(`review/code/2026/09/14/18_17_44`
~`23_38_09`), 매 라운드의 Critical/Warning 이 plan 문서에 처분 근거와 함께 기록돼 있다. 본
라운드(11번째)는 **그 처분들이 실제 코드에 반영됐는지**, 그리고 **CHANGELOG/plan 이 주장하는
수치·범위가 실측과 일치하는지**를 독립적으로 재검증하는 데 집중했다.

## 발견사항

### 검증 완료 — CHANGELOG/plan 의 정량적 주장이 실제 코드와 일치한다

- **[INFO]** "config 를 다시 쓰는 모든 자리를 닫았다" (CHANGELOG) 의 실측 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`, `schedules.service.ts`,
    `hooks/hooks.service.ts` 전체
  - 상세: `grep -rn "triggerRepository\.save\|\.save(trigger\|\.save(Trigger"` 로 전수 확인한
    결과, 기존 행을 통째로 저장하는 `save(entity)` 호출은 **0건**이다. 남은 `save(` 세 곳
    (`triggers.service.ts:492` `create()`, `schedules.service.ts:173` `create()`,
    `triggers.service.ts:669` `update()` 내부 `m.save(Trigger, target)`)은 각각 신규 INSERT
    두 곳 + 락 안에서 재읽은 최신 행을 대상으로 하는 한 곳으로, plan §D "전수 재확인: 프로덕션의
    `save(` 는 이제 3건이고 전부 신규 INSERT" 주장과 정확히 일치한다. `hooks.service.ts` 도
    `save(` 호출이 0건으로, "웹훅 인입 두 자리를 컬럼 한정 `update` 로 바꿨다" 는 서술과 일치한다.
  - CHANGELOG 가 열거한 "일곱 군데 더"(`notification secret 정규화·회전` 2 + `per-trigger 토큰
    폐기` 1 + `승격 cron 둘` 2 + `chat-channel v2 정리 cron` 1 + `schedule 편집 동기화` 1 = 7)도
    `normalizeNotificationSecretRef`·`rotateNotificationSecret`·`revokePerTriggerToken`·
    `promoteRotatedNotificationSecrets`(두 분기)·`cleanupRotatedChatChannelTokens`·
    `SchedulesService.update` 여섯 함수·일곱 쓰기 지점으로 코드에서 그대로 확인된다.
  - 제안: 없음(정합 확인).

- **[INFO]** "대기 상한은 삭제만 둔다" 주장의 실측 재확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63`,
    `triggers.service.ts:1027`(유일하게 `timeoutMs` 를 넘기는 `acquireTriggerConfigLock` 호출)
  - 상세: `grep -n "acquireTriggerConfigLock("` 로 4개 호출부를 전수 확인했다 — `timeoutMs` 를
    넘기는 곳은 `remove()`(삭제 경로) 단 하나이고, 나머지(창 1, `rewriteTriggerConfigLocked`
    내부, `rotateBotToken` 등 lock 헬퍼 경유 호출)는 모두 무한 대기다. CHANGELOG/plan 의
    "삭제만 5초 상한" 서술과 정확히 일치.
  - 제안: 없음.

### 잔여 항목 — 이미 developer 자신이 실측·문서화하고 planner/후속 범위로 넘긴 것 재확인

- **[INFO]** `spec/5-system/15-chat-channel.md` 의 `code:` glob 이 신규 `trigger-config-lock.ts`
  를 여전히 안 문다 (spec fidelity, 회색지대 — 코드 결함 아님)
  - 위치: `spec/5-system/15-chat-channel.md:4-20`(특히 8행 `chat-channel-*.ts` glob) vs
    `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(신규, "trigger-config-"
    로 시작해 그 glob 에 안 걸림)
  - 상세: R-CC-22 가 "`triggers/` 안의 chat-channel 부분은 명시 경로 대신 glob 으로 잡는다" 고
    이미 세 번 재발(#1317·#1319·#1320)을 막으려 도입한 절인데, 이번에 신설된
    `trigger-config-lock.ts` 는 이름이 `chat-channel-` 로 시작하지 않아 그 glob 밖에 있다.
    다만 이는 이 PR 의 developer 가 스스로 실측해 `plan/in-progress/trigger-config-lost-update.md`
    §D `--impl-prep` 등재 표에 "planner 범위 — 이 브랜치에서 고치지 않는다" 로 이미 명시한
    항목이고, `spec/` 쓰기 권한이 developer 에게 없다는 이 저장소의 역할 경계와도 일치한다.
    **새로 발견한 결함이 아니라 기존 추적 항목의 재확인**이다.
  - 제안: 조치 불요(이미 등재·추적됨). `project-planner` 가 `spec/5-system/15-chat-channel.md`
    §7 tree 갱신 시 함께 반영.

- **[INFO]** `normalizeNotificationSecretRef` 가 락 재쓰기의 `false`(삭제 경합) 를 관측하지
  않는다 — 형제 동기 경로(`revokePerTriggerToken`·`rotateBotToken`·창 1)와 취급이 다르다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:830-876`
    (`normalizeNotificationSecretRef`, `rewriteTriggerConfigLocked` 반환값 미사용)
  - 상세: `create()`/`update()` 양쪽에서 호출되는 이 메서드는 `secrets.rotate(ref, ...)` 로
    먼저 secret store 에 평문을 이관한 뒤 `rewriteTriggerConfigLocked` 로 `config.notification`
    을 재작성하는데, 그 결과(`false`=삭제 경합으로 skip)를 버린다. 동기 요청 경로인
    `revokePerTriggerToken`(1156행 `if (!wroteInteraction) this.throwTriggerNotFound();`)이나
    `rotateBotToken`(`if (!wrote) this.throwTriggerNotFound();`)과 대칭이 아니다. 다만 실측하면
    영향은 "인증서명 fail-open" 이 아니라 — secret store 에 남는 **고아 시크릿**(트리거 삭제
    직후의 좁은 창) 수준이고, developer 스스로 이미 9라운드 처분표에 INFO#6 으로 등재해
    "5라운드 W1(secret store 원자성) 대상 목록에 이 함수도 넣는다" 로 후속 처리를 예고했다.
    보안에 직결되는 이 PR 의 핵심 결함(`inboundSigningRef` fail-open) 과는 다른 축이라 이번
    배치를 막을 사유는 아니다.
  - 제안: 조치 불요(이미 후속 등재). 재확인 차원의 기록.

### 신규로 짚을 만한 것 — 낮은 확신, 실제로는 문제 없음으로 판정

- **[INFO]** `TriggersService.update()` 의 `assertChatChannelAlreadySetUp`/provider 전환 검증이
  락 이전 스냅샷(`trigger.config`, `findByIdForUpdate` 결과)을 본다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:575-577`
    (`if (chatChannel) assertChatChannelAlreadySetUp(trigger, chatChannel);`) vs 이후
    623행부터 시작하는 advisory-lock 트랜잭션 안의 재읽기(`fresh`)
  - 상세: 이 검증은 잠금 이전에 읽은 `trigger.config.chatChannel.provider` 를 근거로 "이미
    설정된 채널인가" · "provider 전환을 시도하는가" 를 판정한다. 처음엔 TOCTOU 후보로 보였으나,
    `chat-channel-input-rules.ts:198-224` 와 `spec/2-navigation/2-trigger-list.md` R-12(
    "provider 변경은 트리거 삭제·재생성만 허용")를 대조한 결과 **`chatChannel.provider` 는
    일단 설정되면 이 코드베이스의 어떤 경로도 변경하지 않는 불변값**이다 — 그래서 잠금 전/후
    스냅샷이 갈릴 여지가 없고, 이 검증을 락 밖에 두어도 실질적 TOCTOU 는 발생하지 않는다.
    이 PR 이 닫는 `inboundSigningRef` lost-update 축과도 무관하다.
  - 제안: 조치 불요 — 확인 차원의 기록(리뷰 결과 결함 아님으로 판정).

## 요약

이 PR 은 이미 10라운드의 적대적 코드 리뷰를 거쳤고, 매 라운드의 Critical/Warning 이
`plan/in-progress/trigger-config-lost-update.md` 에 실측·처분 근거와 함께 기록돼 있다. 이번
(11번째) 라운드에서는 그 처분들이 실제 코드에 정확히 반영됐는지를 `grep`/`Read` 로 독립
재검증했다 — `save(entity)` 전수 스캔(0건 잔존, 3건 모두 INSERT-only), lock timeout 사용처
전수 스캔(삭제 경로 1곳만), CHANGELOG 가 열거한 "일곱 자리"·"두 자리"(hooks) 의 실제 코드
대응까지 모두 일치를 확인했다. `trigger-config-lock.ts`(핵심 유틸)·`chat-channel-binder.service.ts`
(성공/실패 두 경로가 `buildChannel`/`survivesWithFresh` 를 공유)·`triggers.service.ts`(창
1~4 + 후속 7곳)·`hooks.service.ts`(`touchLastTriggeredAt` 공유 헬퍼) 전부 CHANGELOG/plan 의
서술과 line-level 로 부합했다. e2e 테스트(`trigger-config-lost-update.e2e-spec.ts`)는 세 개의
독립 단언(B 의 PATCH 값 생존·A 의 신규 ref 생존·A 의 손대지 않은 키 생존)으로 결함 클래스
전체를 겨냥하고, unit 테스트(`trigger-config-lock.spec.ts` 등)는 "락이 읽기보다 먼저" ·
"행 삭제 시 false + merge 미호출" 등 서비스 레이어로는 만들 수 없는 분기까지 별도로 고정한다.
새로 발견한 CRITICAL/WARNING 급 결함은 없다. 남은 항목(`spec/` glob 미포함,
`normalizeNotificationSecretRef` 의 skip 미관측)은 developer 스스로 실측해 이미 planner/후속
범위로 명시적으로 넘긴 것이고, 영향도 이 PR 의 핵심 위협모델(인입 서명 fail-open)과는 다른
축(문서 커버리지 gap·고아 시크릿)이라 이번 배치를 막을 사유가 아니다.

## 위험도

LOW
