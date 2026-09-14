# 동시성(Concurrency) 리뷰 — trigger-config-lost-update (2026-09-14 23:01:18)

## 대상 요약

`trigger.config` lost-update(동시 PATCH 가 `chatChannel.inboundSigningRef` 를 지워 인입 서명
검증이 fail-open 되는 결함)를 advisory lock(`pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`)
+ 락 안 재읽기로 닫는 변경이다. 이번 라운드는 이전 라운드(`review/code/2026/09/14/18_17_44`)가
검토한 3개 창(`chat-channel-binder.service.ts` 성공/실패, `rotateBotToken`) 이후, `update()` 창 1을
같은 락 안으로 옮기고 `remove()`·`normalizeNotificationSecretRef`·`promoteRotatedNotificationSecrets`·
`revokePerTriggerToken`·`cleanupRotatedChatChannelTokens`·`SchedulesService.update()` 등 7곳을
추가로 닫은 뒤의 최종 상태다. 코드(`trigger-config-lock.ts`, `chat-channel-binder.service.ts`,
`triggers.service.ts`, `schedules.service.ts`, `hooks.service.ts`)를 직접 열어 확인했다.

## 발견사항

- **[WARNING]** `rotateBotToken` 이 `chatChannel` 을 락 안에서 통째로 교체하는데, 그 값(`mergedChannel`)이 **락 획득 이전에 읽은 스냅샷**으로 만들어진다 — `inboundSigningRef` 축은 닫혔지만 다른 필드(`uiMapping`/`rateLimitPerMinute`/`languageLocale`/`languageHints`)는 여전히 lost-update 에 노출된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken()` 함수. `mergedChannel` 계산부(`const mergedChannel: ChatChannelConfig = { ...mergedConfig, ...(result.configUpdates ?? {}), botTokenRef, inboundSigningRef };`, `mergedConfig` 는 함수 최상단 `findById` 시점의 `chatChannelCfg` 를 스프레드)와, 그 값을 그대로 쓰는 병합 콜백 `(freshConfig) => ({ ...freshConfig, chatChannel: mergedChannel })` (`rewriteTriggerConfigLocked` 세 번째 인자로 넘기는 자리)
  - 상세: `mergedChannel` 은 `rotateBotToken` 함수 **최상단**의 `findById(id, workspaceId)` 로 읽은 `trigger.config.chatChannel` 을 베이스로 만들어진다. 락 안에서 재읽은 `freshConfig` 는 `chatChannel` **자체를 전혀 참조하지 않고** 통째로 `mergedChannel` 로 덮어쓴다 — 이는 이 PR 이 CHANGELOG·plan 문서에서 스스로 세 번 반복해 지적한 "컨테이너만 다시 읽는 것으로는 부족하다 — 하위 키까지 재읽어야 한다" 결함과 **같은 축**이다(`mergeIntoFreshSubKey` 를 `notification`·`interaction` 세 자리에 통일한 바로 그 패턴). `plan/in-progress/trigger-config-lost-update.md:161-164` 는 "`rotateBotToken` 도 같은 게이트를 가지는가" 를 실측했지만, 그 실측은 **`inboundSigningRef` presence 축 하나**로 좁혀져 있었다("그 경로의 `mergedChannel` 은 «이번 회전의 산출»이고 `inboundSigningRef` presence 를 요청 시작 시점 상태로 게이팅하지 않는다. 그래서 재조율은 불필요"). `ChatChannelConfig` 에는 그 축과 무관하게 사용자가 `PATCH /api/triggers/:id`(`chatChannel: {...}`)로 언제든 바꿀 수 있는 필드(`uiMapping`·`rateLimitPerMinute`·`languageLocale`·`languageHints`)가 더 있고, `ChatChannelUpdateConfigDto` 는 `botToken`·`inboundSigningPlaintext` 만 `OmitType` 하므로 이 필드들은 정상적으로 PATCH 대상이다. 시나리오: (1) `rotateBotToken` 이 `findById` 로 `chatChannelCfg`(예: `rateLimitPerMinute: 30`)를 읽는다 → (2) `adapter.setupChannel` 호출 중(외부 HTTP, 락 밖) 동시에 `PATCH /api/triggers/:id { chatChannel: { provider, rateLimitPerMinute: 99 } }` 가 `update()` 창 1을 거쳐 커밋된다(같은 락을 잡지만 `rotateBotToken` 은 아직 락을 잡기 **전** 단계다) → (3) `rotateBotToken` 이 락을 잡고 `rewriteTriggerConfigLocked` 를 부르면, 재읽은 `freshConfig.chatChannel.rateLimitPerMinute === 99` 를 **전혀 보지 않고** `mergedChannel.rateLimitPerMinute === 30`(1단계 스냅샷)으로 되쓴다 — 방금 커밋된 PATCH 값이 조용히 사라진다. 보안 유의미(fail-open)한 값은 아니지만, 이 PR 이 닫으려는 것과 동일한 클래스의 lost-update 이고, 관련 unit 테스트(`triggers.service.spec.ts` `'rotateBotToken — 손대지 않은 config 키가 살아남는다'`, line ~4082)는 최상위 `config` 키(`untouchedByThisRequest`)만 검증하고 `chatChannel` **내부** 서브필드가 두 읽기 사이에서 달라지는 경우는 fixture 로 만들지 않아 이 갭을 못 잡는다(두 상태의 `chatChannel` 이 `inboundSigningRef` 외에는 동일하다).
  - 제안: `mergeIntoFreshSubKey` 와 같은 원리로, `chatChannel` 도 재읽은 `freshConfig.chatChannel` 을 베이스로 삼고 그 위에 이번 회전이 산출한 필드(`botTokenRef`·`inboundSigningRef`·`result.configUpdates`)만 얹도록 바꾼다 — 예: `(freshConfig) => ({ ...freshConfig, chatChannel: { ...(asObject(freshConfig?.chatChannel) ?? chatChannelCfg), ...(result.configUpdates ?? {}), botTokenRef, inboundSigningRef } })`. 회귀 테스트는 `withRef`/`withoutRef` 의 `chatChannel` 에 `rateLimitPerMinute` 같은 차별화 필드를 넣어 두 상태가 다르게 판정되게 해야 한다(이 저장소가 이미 지킨 "대조군은 두 상태가 다르게 판정하는 값이어야 한다" 규율).

- **[WARNING]** `SchedulesService.update()` 의 trigger `name`/`isActive` 컬럼 동기화가 `trigger-config` advisory lock 도메인 밖에 있어, `TriggersService.update()` 창 1의 전체 엔티티 저장과 경합하면 조용히 되돌아갈 수 있다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `update()` 의 `await this.triggerRepository.update({ id: trigger.id }, patch);` 호출부(컬럼 한정 갱신으로 이번 PR 이 새로 바꾼 자리). 대응하는 창은 `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 창 1의 `this.triggerRepository.manager.transaction(async (m) => { await acquireTriggerConfigLock(m, trigger.id); const fresh = await m.findOne(Trigger, ...); ...; return m.save(Trigger, target); })`
  - 상세: 이번 PR 은 `SchedulesService.update()` 의 트리거 동기화를 `save(trigger)`(엔티티 통째 저장 — `config` 까지 되씀, CRITICAL#1 대상)에서 `update({id}, {name, isActive})`(컬럼 한정)로 바꿔 `config`/`inboundSigningRef` 를 잃는 경로는 닫았다. 다만 이 `update()` 호출은 `acquireTriggerConfigLock` 을 **잡지 않는다** — `trigger-config:<id>` 락과 무관하게 아무 때나 실행된다. 반면 `TriggersService.update()` 창 1은 락을 잡은 뒤 `fresh` 를 재읽고, 그 `fresh` 에 이번 요청이 명시하지 않은 필드(예: `isActive` 를 이 PATCH 가 건드리지 않았다면)를 그대로 둔 채 `m.save(Trigger, target)` 로 **엔티티 전체**를 다시 쓴다. 시나리오: (1) 요청 X = `PATCH /api/triggers/:id`(schedule 타입 트리거, `isActive` 미포함 body)가 락을 잡고 `fresh`(`isActive: true`)를 읽는다 → (2) 그 사이 요청 Y = `PATCH /api/schedules/:id`(`isActive: false`)가 (락과 무관하게) `triggerRepository.update({id}, {isActive: false})` 를 커밋한다 → (3) 요청 X 가 `target = Object.assign(fresh, defined, {config: mergedConfig})` 로 저장을 마친다 — `defined` 에 `isActive` 가 없으므로 `target.isActive` 는 `fresh.isActive === true`(1단계 스냅샷)이고, 이 저장이 Y 가 방금 커밋한 `false` 를 **덮어쓴다**. 결과: 사용자가 스케줄 화면에서 트리거를 비활성화했는데 무관한 트리거 PATCH 가 거의 동시에 오면 활성 상태로 되돌아간다 — `isActive` 는 실행 여부를 가르는 값이라 관측성 수준(`lastTriggeredAt`)보다 영향이 크다. 이 레이스 자체는 이 PR 이 새로 만든 것은 아니다(종전엔 양쪽 다 `save(entity)` 라 `config` 를 포함해 더 넓게 깨져 있었다) — 이 PR 은 `config` 축은 닫았지만 `name`/`isActive` 축은 그대로 남겼다. plan 문서(`plan/in-progress/trigger-config-lost-update.md:545`)가 같은 클래스의 다른 사례(`rotateNotificationSecret` 이 락 도메인 밖이라 창 1 의 저장이 그 사이 커밋된 `notificationSecretV2` 회전을 되돌릴 수 있다, "보안 성격")를 8라운드 W4 로 이미 후속 등재했는데, `SchedulesService.update()` 이 자리는 그 표에 없다.
  - 제안: 최소한 plan 의 8라운드 후속 표(§ "후속(developer 범위)")에 `rotateNotificationSecret`(W4)과 같은 항목으로 `SchedulesService.update()` 의 trigger name/isActive 동기화를 추가해 스코프를 명시한다. 근본 수정은 그 write 도 `acquireTriggerConfigLock` 을 잡거나(다른 모듈에서 `triggers/` 내부 락 유틸을 참조해야 하므로 순환 방향 검토 필요), `TriggersService.update()` 창 1이 컬럼 단정 갱신으로 전환될 후속(§D 가 이미 "창 1 은 이 PR 로 넓히지 않는다" 고 명시한 그 항목)에서 함께 닫는다.

- **[INFO]** `assertChatChannelAlreadySetUp`/`assertAuthConfigInWorkspace` 검증이 락 이전(pre-lock) `trigger` 스냅샷을 기준으로 한다 — TOCTOU 이지만 데이터 훼손이 아니라 400 판정의 좁은 창
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()`, `findByIdForUpdate` 로 읽은 `trigger` 를 `assertChatChannelAlreadySetUp(trigger, chatChannel)`(chatChannel 존재 여부 검증)·`assertAuthConfigInWorkspace(rest.authConfigId, workspaceId)` 에 그대로 넘기는 자리(락 획득 **이전**)
  - 상세: 이 검증들은 락 안에서 재읽은 `fresh` 가 아니라 함수 최상단의 `trigger` 를 본다. 동시 요청이 그 사이 `chatChannel` 을 처음 확립하거나(예: 다른 PATCH 가 방금 `provider` 를 세팅) 삭제해도, 이 검증은 이전 상태로 400/통과를 판정한다. 실질적으로는 검증 실패가 최악의 경우라 데이터 훼손으로 이어지지 않고(뒤이은 창 1의 락 안 재읽기+병합이 실제 쓰기를 보호한다), 발생 빈도도 낮다(동일 트리거에 대한 동시 `chatChannel` 최초-설정 PATCH 자체가 드묾).
  - 제안: 조치 불요 수준. 필요하면 이 검증들을 락 안에서 재읽은 `fresh` 로 재실행하도록 옮길 수 있으나, 이 PR 의 핵심(데이터 lost-update)과는 다른 축이라 낮은 우선순위.

## 검증한 것 (문제 없음으로 판정)

- **핵심 결함(inboundSigningRef fail-open)은 잘 닫혔다.** `chat-channel-binder.service.ts` 의
  `survivesWithFresh(freshConfig)` 가 요청 시작 시점 게이트와 재읽은 행의 ref presence 를 OR로
  묶어 성공/실패 두 경로 모두에서 재발을 막고, `update()` 창 1도 `previousInboundSigningRef` 를
  재읽은 `fresh.config` 에서 다시 뽑는다. `rotateBotToken` 은 `inboundSigningRef` 를 항상
  명시적으로 싣기 때문에(`buildSecretRef` 로 trigger id 에서 결정론적으로 재유도) 그 경로에서
  presence 유실은 없다 — 위 첫 번째 발견사항은 이 축이 아니라 `chatChannel` 의 **다른** 필드 축이다.
- **락 배치·데드락**: 모든 락 획득 경로(`update()` 창 1, `chat-channel-binder.service.ts` 성공·실패,
  `rotateBotToken`, `remove()`)가 트랜잭션당 정확히 하나의 advisory lock 만 잡고, 외부 HTTP 호출은
  전부 락 **밖**에서 끝낸 뒤 진입한다 — 중첩·역순 락 획득이 없어 lock-ordering 데드락 조건이
  성립하지 않는다. `remove()` 만 `SET LOCAL lock_timeout`(5s)을 두어 삭제 후 정리가 안 되는 창을
  드러나는 오류로 바꾼다 — 다른 경로는 무한 대기이고 임계 구간이 「읽기+병합+쓰기」로 짧다는 근거가
  명시돼 있다.
- **하위 키 병합**: `mergeIntoFreshSubKey` 가 `notification`·`interaction` 세 자리
  (`normalizeNotificationSecretRef`·`promoteRotatedNotificationSecrets`·`revokePerTriggerToken`)에서
  재읽은 서브키 위에 패치만 얹도록 통일돼 있고, 대응하는 유닛 테스트가 "두 읽기가 다른 값을
  본다"는 판별 fixture(`withoutRef`/`withRef`, `untouchedByThisRequest`)로 실제 재발을 잡는다.
- **삭제 경합**: `remove()` 가 삭제도 같은 `trigger-config` 락을 잡아, `save(entity)` 의
  read-then-INSERT 재생성(고아 부활) 경로와 「읽었을 땐 있었는데 저장 직전 삭제」 경합을 함께
  막는다 — `update()` 창 1도 `fresh` 가 `null` 이면 `assertTriggerFound` 로 404를 던져 같은 부활
  경로를 막는다.
- **e2e 판별력**: `trigger-config-lost-update.e2e-spec.ts` 는 advisory lock 을 테스트가 직접 쥐어
  두 요청의 인터리빙을 우연이 아니라 강제로 만들고, 세 개의 서로 다른 축(PATCH 값 생존·
  inboundSigningRef 생존·손대지 않은 키 생존)을 각각 다른 단언으로 커버한다 — "분기를 못 가르는
  fixture" 함정을 피한 설계다. 다만 이 e2e 는 PATCH-vs-PATCH 겹침만 재현하고
  PATCH-vs-`rotateBotToken` 겹침은 다루지 않아 위 첫 번째 발견사항을 잡지 못한다.
- **테스트 mock 배선**: `trigger-transaction-mock.ts::withTransactionMock` 이 `manager.transaction`
  콜백을 실제로 실행하고 `query`/`findOne`/`save`/`update`/`remove` 를 기존 repo mock 으로
  위임한다 — no-op mock 이었다면 다수 케이스가 조용히 vacuous 해졌을 것을 실측(53건 RED)으로
  확인했다는 근거가 주석에 있다.

## 참고 (절차 투명성 — 이슈로 집계하지 않음)

리뷰 중 `triggers.service.ts` 를 직접 `Read` 했을 때 `cleanupRotatedChatChannelTokens` 부분이
`trigger.chatChannelTokenV2 = null; ...; await this.triggerRepository.save(trigger);` (컬럼 한정
`update()` 로 바뀌기 **이전** 형태)로 관측된 순간이 있었다. `git diff HEAD` / `md5sum` 으로
재확인한 결과 파일은 커밋 HEAD 와 정확히 일치하는 정상 상태였다(빈 diff, 동일 md5) — 병렬
fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은 워킹트리를 동시에 mutate" 상황으로 보인다.
저장소에 잔여 이상 상태는 없다. 다음 라운드 리뷰어를 위해 기록만 남긴다.

## 요약

핵심 목표인 `chatChannel.inboundSigningRef` lost-update/fail-open 은 advisory lock + 락 안
재읽기 + presence 게이트 재계산으로 견고하게 닫혔고, 데드락·락 배치·삭제 경합·하위 키 병합
모두 확인한 범위에서 문제가 없다. 다만 같은 PR 이 CHANGELOG 에서 스스로 "1라운드의 함정을
7라운드에 반복했다"고 적은 클래스(컨테이너 재읽기만으로는 하위 값을 못 지킨다)가 두 자리 더
남아 있다 — `rotateBotToken` 의 `chatChannel` 비보안 필드(uiMapping·rateLimitPerMinute 등)와
`SchedulesService.update()` 의 trigger name/isActive 컬럼 동기화(advisory lock 도메인 밖)다.
둘 다 보안 우회는 아니지만 사용자가 관측 가능한 설정/활성 상태를 좁은 창에서 조용히 잃을 수
있는 실재하는 lost-update이며, 관련 테스트 fixture 가 이 두 축을 판별하지 못해 회귀 감지도
안 된다. 두 건 모두 이 PR 이 이미 정립한 수정 패턴(`mergeIntoFreshSubKey`, 공유 lock 도메인
확장)으로 닫을 수 있는 좁은 범위라 차단 사유는 아니지만, 다음 라운드 또는 plan 후속 목록에
명시적으로 등재할 가치가 있다.

## 위험도

MEDIUM
