# 부작용(Side Effect) Review

## 검토 범위

`trigger.config` lost-update 수정 전체(신규 `trigger-config-lock.ts`, `chat-channel-binder.service.ts`
· `triggers.service.ts` · `hooks.service.ts` 의 write-site 4곳, 관련 테스트/가드 유틸)를 실제
소스로 직접 열어 확인했다. 이 브랜치는 이미 4라운드의 `/ai-review`(18_17_44 · 19_07_43 ·
19_44_08 및 그 사이 정정 커밋)를 거쳤으므로, 그 라운드들이 이미 지적·수정한 항목(창 1의
삭제-트리거 부활 CRITICAL, hooks 인입 hot path 두 자리 중 한 자리 누락 CRITICAL 등)은 현재
HEAD 코드에서 실제로 반영됐는지만 직접 대조하고, 새 지적으로 다시 세지 않았다. `review/`·
`plan/`·`CHANGELOG.md` 는 이번 diff 의 산출물/문서이므로 런타임 부작용 관점에서는 해당 없음.

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 의 "삭제됨 → 쓰기 skip" 신호가 `setupChatChannel`
  성공 경로의 listener 등록까지는 이어지지 않는다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:266-284`
    (`await rewriteTriggerConfigLocked(...)` 뒤 반환값을 버리고 곧바로
    `this.channelListenerRegistry.register(trigger.id, chatChannelCfg.provider)` 호출)
  - 상세: `rewriteTriggerConfigLocked` 는 락 안 재읽기에서 행이 없으면(동시 `remove()`)
    `false` 를 반환해 "조용히 아무것도 안 했다" 를 호출부가 관측할 수 있게 설계됐다
    (`trigger-config-lock.ts` JSDoc `@returns`). 그런데 바로 이 호출부는 그 반환값을
    버리고 무조건 `channelListenerRegistry.register()` 를 부른다. `adapter.setupChannel()`
    은 외부 HTTP 호출이라 임의로 오래 걸릴 수 있고 그동안 락을 잡지 않으므로, 이 구간에
    `remove()`(같은 advisory lock 을 잡지 않음 — `database.md` 가 이미 "삭제 레이스의 좁은
    창"으로 추적 중인 사실)가 끼어들어 트리거를 완전히 삭제하면: config 쓰기는 올바르게
    skip 되지만, 이미 삭제된 `remove()` 가 호출한 `unregister(trigger.id)` 뒤에 이 `register()`
    가 다시 실행되어 **삭제된 트리거의 listener entry 가 in-memory registry 에 되살아난다.**
    이 항목을 지워 줄 후속 `unregister` 호출은 없다 — 그 트리거는 이미 삭제됐으므로
    프로세스가 재시작되기 전까지 registry 에 유령 entry 로 남는다.

    실제 영향은 제한적이다 — `ChatChannelDispatcher.handle()` 은 `listenerRegistry.has()`
    를 사전 가드로만 쓰고, 그 뒤 `triggerRepository.findOne()` 이 null 이면
    `"DB lookup 실패 (trigger 삭제됨?)"` 경고와 함께 스킵하도록 이미 방어돼 있다
    (`chat-channel.dispatcher.ts:140-145`) — 즉 이 유령 entry 는 크래시나 메시지 오배달로
    이어지지 않고, warn 로그 + 해제되지 않는 Map 엔트리 하나로 그친다. 이번 PR 이 새로
    만든 취약점은 아니다 — 이 호출 순서(쓰기 → 무조건 register) 자체는 origin/main 에도
    있었고, 종전의 `triggerRepository.update()` 도 영향받은 row 수를 확인하지 않았으므로
    같은 gap 이 이미 있었다. 다만 이 PR 이 "쓰기가 조용히 스킵될 수 있다" 는 것을 처음으로
    **명시적인 반환값**으로 만들어 놓고도, 그 신호가 정확히 필요한 이 이벤트/콜백 자리에는
    배선하지 않았다 — 기존 아키텍처 리뷰(`review/code/2026/09/14/18_17_44/architecture.md`
    INFO)가 "반환값이 세 호출부 어디에서도 관측되지 않는다"고 일반적으로 지적한 것의 구체적
    소비처 중 하나다.
  - 제안: 차단 사유 아님(다운스트림이 이미 관대하게 처리). 여유가 있으면
    `if (await rewriteTriggerConfigLocked(...)) { this.channelListenerRegistry.register(...); }`
    로 바꿔 삭제-경합 시 유령 등록 자체를 막을 수 있다.

## 확인한 것 — 이전 라운드가 지적한 CRITICAL 이 현재 HEAD 에 실제로 반영됨

- **창 1 삭제-트리거 부활(`19_44_08` side_effect CRITICAL)**: 현재
  `triggers.service.ts:592-597` 이 락 안 재읽기(`fresh`)가 없으면 `NotFoundException` 을
  던지고 `m.save()` 를 부르지 않는다(`fresh ?? trigger` 폴백 제거 확인). `save()` 의
  insert-on-missing-row 시맨틱으로 삭제된 트리거가 되살아나는 경로가 닫혀 있다.
- **hooks hot path 두 자리 중 한 자리 누락(`19_44_08` testing CRITICAL#2)**: 현재
  `hooks.service.ts:227-236`(`handleWebhook`)과 `:695-704`(chat-channel 인입) 두 곳 모두
  `save(trigger)` 가 아니라 `triggerRepository.update({id}, {lastTriggeredAt})` 로 바뀌어
  있고, `hooks.service.spec.ts` 에 대칭 테스트(부재 단언 + 패치 키 단언) 두 벌이 각각
  붙어 있다.

## 확인한 것 — 부작용 없음으로 판정

- **전역 변수 / 환경 변수**: 새로 읽거나 쓰는 것 없음. `TRIGGER_CONFIG_LOCK_PREFIX`·
  `TRIGGER_ENTITY` 는 모듈 스코프 `export const` 로, 프로세스 전역 mutable 상태가 아니다.
- **시그니처/공개 API**: `rewriteTriggerConfigLocked`·`acquireTriggerConfigLock`·
  `triggerConfigLockKey`·`extractInboundSigningRef` 는 전부 신규 export 로 기존 함수
  시그니처를 바꾸지 않는다. `TriggersService.update()`/`create()`/`rotateBotToken()` 의
  파라미터·반환 타입도 변경 없음(내부 구현만 교체).
- **TypeORM 리스너/subscriber 우회**: `save()` → `update()` 전환 지점(`hooks.service.ts`
  2곳)에 대해 저장소 전체를 `grep -rn "EntitySubscriberInterface\|@BeforeUpdate\|@AfterUpdate"`
  로 재확인 — 0건. 우회로 인한 부작용 없음.
- **네트워크 호출**: `adapter.setupChannel`·`this.secrets.rotate`·`this.secrets.resolve` 의
  호출 횟수·순서·인자는 이번 diff 로 바뀌지 않는다. 바뀐 것은 그 호출들이 끝난 **뒤**의
  DB 쓰기 경로뿐이고, 세 곳 모두 "외부 호출을 락 밖에 둔다"는 제약이 실제로 지켜진다
  (`trigger-config-lock.ts` JSDoc 대로 `manager.transaction()` 진입 전에 이미
  `adapter.setupChannel`/`secrets.rotate` 가 끝나 있음을 각 호출부에서 직접 확인).
- **파일시스템**: 해당 없음.
- **테스트 인프라 격리**: `withTransactionMock`(신규)은 인자로 받은 mock 을 스프레드해 새
  객체를 반환하거나(이미 `manager` 있으면 원본 참조 그대로 반환 — 이 경우도 mutate 하지
  않음) 두 spec 파일(`triggers.service.spec.ts`, `triggers.web-chat.spec.ts`) 사이에 상태를
  공유하지 않는다. `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture 변경은
  `src/repo-guards/__tests__/` 하위 정적 분석 전용 코드로 런타임에 로드되지 않고, 스캔
  대상도 `triggerRepository`/`Trigger` 엔티티 저장으로 한정돼 있어 무관한 코드를 잘못
  집어내는 부작용이 없다.
- **이벤트/콜백(그 외)**: `channelListenerRegistry.register` **호출 조건식 자체**(성공
  경로에서만)는 이번 diff 로 바뀌지 않았다 — 위 INFO 항목이 지적하는 것은 그 호출 앞의
  새 반환값이 배선되지 않았다는 것이지, 호출 여부·순서가 새로 바뀐 것이 아니다.

## 요약

핵심 수정(창 2~4 의 advisory-lock 재읽기, 창 1 의 삭제 스킵, `hooks.service.ts` 컬럼 한정
update)은 이전 라운드들이 지적한 부작용(삭제된 트리거 부활, hot path 한 자리 누락)을 실제로
닫았음을 소스 대조로 확인했다. 이번 라운드에서 새로 찾은 것은 하나 — `setupChatChannel` 성공
경로가 `rewriteTriggerConfigLocked` 의 "쓰기 skip" 신호를 무시하고 `channelListenerRegistry`
에 무조건 재등록해, 삭제-경합 시 해제되지 않는 유령 listener entry 를 남길 수 있다는 점이다.
다만 `ChatChannelDispatcher.handle()` 이 registry-DB 불일치를 이미 warn+skip 으로 관대하게
처리하도록 설계돼 있어 실제 피해(크래시·오배달)로 이어지지 않는 INFO 수준이며, 이 gap 자체도
이 PR 이 새로 만든 것이 아니라 기존에 있던 것이다. 전역 변수·환경 변수·시그니처·공개 API·
TypeORM 리스너 우회·네트워크 호출·파일시스템 관점에서는 지적할 사항이 없다.

## 위험도

LOW
