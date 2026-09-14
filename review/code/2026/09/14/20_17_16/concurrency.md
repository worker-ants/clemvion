# 동시성(Concurrency) 코드 리뷰 — trigger-config-lost-update

## 검토 범위

이번 라운드(`20_17_16`)는 이전 세 라운드(`18_17_44` → `19_07_43` → `19_44_08`)를 거쳐
security/testing/concurrency CRITICAL 이 모두 닫힌 뒤의 상태다. 실제 코드는
`trigger-config-lock.ts`(신규) · `chat-channel-binder.service.ts` · `triggers.service.ts` ·
`hooks.service.ts`(hot path 두 자리) 및 관련 테스트에 국한된다. `trigger-config-lock.ts`,
`chat-channel-binder.service.ts` `setupChatChannel`, `triggers.service.ts` `update()`/
`rotateBotToken()`/`remove()` 전체를 `Read` 로 직접 열어 대조했고, 관련 spec·e2e 파일도 확인했다.
저장소에 뮤테이션은 가하지 않았다(`git status --short` 재확인, 리뷰 산출물 디렉터리만 존재).

## 발견사항

- **[WARNING]** `remove()` 가 창 1(`update()`)의 락을 공유하지 않아, `!fresh` 가드가 막는 것은
  "이미 삭제된 뒤" 뿐이고 "트랜잭션 도중 삭제" 는 여전히 트리거를 부활시킬 수 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:548-601`
    (`update()` 의 `manager.transaction` 블록 — `acquireTriggerConfigLock` 550,
    `m.findOne` 557-560, `if (!fresh) throw ...` 592-597, `m.save(Trigger, fresh)` 599),
    같은 파일 `:908-929`(`remove()` — `acquireTriggerConfigLock` 호출이 어디에도 없다,
    `triggerRepository.remove(trigger)` 929)
  - 상세: 이번 PR 은 "삭제된 트리거의 부활"(`m.save(entity)` 는 PK 로 재조회해 행이 없으면
    INSERT 한다)을 막으려고 락 안에서 재읽은 뒤 `!fresh` 면 404 를 던지는 가드를 추가했다
    (직전 커밋 `369852b4f`). 이 가드는 **읽기 시점**의 존재만 확인한다. `remove()` 는
    `trigger-config:<id>` advisory lock 을 전혀 잡지 않으므로, 이 트랜잭션의 `m.findOne`
    (557) 이 행을 본 **직후**, `Object.assign`·`mergeExternalConfig` 계산을 거쳐
    `m.save(Trigger, fresh)`(599)가 실제로 실행되기 **전** 사이의 창에서 `remove()` 가
    같은 트리거를 지우고 커밋하면, `save()` 는 (자신의 내부 존재-확인 쿼리 시점 기준으로)
    행이 없다고 판단해 다시 **INSERT** 한다 — teardown·secret 삭제·BullMQ 해제까지 끝난
    트리거가 그대로 부활한다. 이는 이 PR 이 세 라운드에 걸쳐 반복해서 만들었다가 고친 것과
    **같은 결함 클래스**이고, 이번엔 "고친 자리 안"에 남아 있는 형태다.
    형제 세 창(`rewriteTriggerConfigLocked` 경유)은 `m.update()` 를 쓰므로 같은 창에서
    `remove()` 가 끼어들어도 0-row 갱신(조용한 no-op)일 뿐 부활은 없다 — **`m.save()` 를
    쓰는 창 1 만 갖는 고유한 위험**이다. 게다가 `Trigger.workflow`/`Trigger.workspace` 는
    `onDelete: 'CASCADE'` 이므로(`codebase/backend/src/modules/triggers/entities/trigger.entity.ts:39-47`),
    워크플로/워크스페이스 삭제가 걸어 오는 **DB 레벨 CASCADE DELETE** 도 같은 창을 만든다 —
    이쪽은 애초에 애플리케이션 레이어 락으로 막을 수 있는 지점도 아니다.
  - **근거(plan 의 유예가 실측 없이 넓게 쓰였다)**: `plan/in-progress/trigger-config-lost-update.md:394`
    는 이 갭을 "후속" 표에 등재하며 *"«데이터 손상 없음» 은 창 1 의 `!fresh` 처리를 넣은 뒤에야
    참이 됐다 … 지금은 네 창 모두 «행이 없으면 쓰지 않는다»"* 라고 적는다. 이 문장은 창 1 도
    나머지 셋과 **같은 보장**을 갖는 것처럼 읽히지만, 위에서 보였듯 창 1 의 보장은 "읽기
    시점" 한정이고 "쓰기 시점" 에는 적용되지 않는다 — 나머지 셋(update 기반)과 질적으로
    다른 잔여 위험이다. 테스트도 이 구분을 반영한다: `triggers.service.spec.ts:3799-3814`
    의 "그 사이 삭제된 트리거를 되살리지 않는다" 케이스는 `freshFindOne: () => undefined`
    로 **읽기 시점에 이미 없는** 경우만 만든다 — "읽었을 땐 있었는데 쓰기 전에 사라지는"
    시나리오는 어디에도 재현되지 않는다(`withTransactionMock` 은 `findOne`/`update`/`save`
    를 각각 독립적으로 위임할 뿐, 두 시점 사이의 상태 변화를 시뮬레이션하는 훅이 없다).
  - 제안: 두 갈래 중 하나. (a) `remove()` 도 같은 트랜잭션 안에서
    `acquireTriggerConfigLock(m, trigger.id)` 를 잡은 뒤 삭제하도록 만들어 창 1 과 완전히
    직렬화한다(다만 CASCADE 경로는 이걸로 못 막는다). (b) `m.save(Trigger, fresh)` 대신
    `m.update(Trigger, { id: trigger.id }, patch)` + `affected` 카운트 확인으로 바꿔 형제
    세 창과 같은 "조용한 no-op" 실패 모드로 낮춘다 — 다만 plan(§D)이 이미 기록했듯 `save`→
    `update` 전환은 반환 엔티티·subscriber·UNIQUE 충돌 경로가 함께 바뀌어 단위 6건이 깨진
    이력이 있으므로 그 계약을 먼저 테스트로 고정해야 한다. 급한 차단 사유는 아니지만(창이
    좁고, 이미 부분적으로 인지·추적되고 있음), plan 의 "지금은 네 창 모두 «행이 없으면
    쓰지 않는다»" 서술은 창 1 한정으로 정정하는 편이 다음 사람의 오판을 막는다.

- **[INFO]** (기존 지적 재확인, 변화 없음) advisory lock 대기에 상한이 없다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-46`
    (`acquireTriggerConfigLock`)
  - 상세: `SELECT pg_advisory_xact_lock(hashtext($1))` 에 `lock_timeout` 이 없어 같은
    트리거의 동시 PATCH/rotate 는 무한정 대기한다. `trigger-config-lock.ts` JSDoc(77-87줄)
    이 이 트레이드오프와 그 근거(임계 구간이 DB 왕복 두 번으로 유계, 외부 호출 배제)를
    스스로 명시하고 있고, `review/code/2026/09/14/18_17_44` concurrency WARNING#3 로 이미
    한 번 지적·수용됐다. 새로운 위험이 아니라 재확인.
  - 제안: 이미 문서화된 대로, 임계 구간에 외부 호출/긴 계산이 들어가는 변경을 할 때 반드시
    `SET LOCAL lock_timeout` 을 함께 추가할 것.

- **[INFO]** hot path(`hooks.service.ts`) fail-open 재발 경로가 컬럼 한정 `update()` 로
  올바르게 닫혔음을 확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:226-236`(`handleWebhook`),
    `:695-705`(chat-channel 인입 경로)
  - 상세: 두 자리 모두 `trigger.lastTriggeredAt = new Date(); await
    this.triggerRepository.save(trigger);` 를 `triggerRepository.update({id}, {lastTriggeredAt})`
    로 바꿔, 인입 메시지마다 요청 시작 시점의 `config` 스냅샷을 되쓰던 경로를 제거했다.
    `hooks.service.spec.ts:189-224`(`handleWebhook`) · `:798-835`(chat-channel 인입)가
    `save` 미호출 + `update` 페이로드가 `lastTriggeredAt` 단일 키임을 함께 단언해, 부재
    단언과 형태 단언을 모두 걸고 있다 — 한쪽만 걸면 통과하던 이전 라운드의 결함류가
    재발하기 어렵다. 새 결함 아님, 수정 확인 목적의 기록.

- **[INFO]** 네 쓰기 창(`update()` 창 1 · binder 성공/실패 · `rotateBotToken`)이 동일한
  `trigger-config:<id>` advisory lock 만 사용해, 서로 다른 리소스에 대한 락 획득 순서 역전이
  없다 — 데드락 가능성 낮음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-46`,
    `chat-channel-binder.service.ts:264-278, 303-314`, `triggers.service.ts:548-550, 1174-1184`
  - 상세: 각 트랜잭션은 "advisory lock 하나 → 재읽기 → 쓰기" 외에 다른 락을 추가로
    요구하지 않는다. `remove()` 는 이 락을 요구하지 않으므로 락을 놓고 기다리는 관계 자체가
    성립하지 않아(위 WARNING 은 대기가 아니라 순서 없는 인터리빙 문제다) 데드락과는 다른
    범주다. 데드락 관점에서는 안전.

## 요약

핵심 lost-update/fail-open 결함(동시 PATCH 가 `inboundSigningRef` 를 지워 인입 서명 검증이
fail-open 되는 것)은 advisory lock + 락 안 재읽기 + presence 게이트 재계산으로 4개 창
전부에서 닫혔고, hot path(`hooks.service.ts`)의 컬럼 한정 `update()` 전환도 회귀 테스트와
함께 올바르게 배선돼 있다. 다만 이번 수정이 새로 추가한 "삭제된 트리거 부활 방지" 가드
(`update()` 의 `if (!fresh) throw`)는 **읽기 시점**만 보장하고 **쓰기 시점**은 보장하지
않는다 — `remove()`(및 워크플로/워크스페이스 삭제가 거는 DB CASCADE)가 같은 advisory lock 을
전혀 잡지 않기 때문에, 창 1(`m.save()` 사용)에 한해 "읽었을 땐 있었는데 저장 직전에 사라지는"
좁은 창이 여전히 남아 있고, 이 경우 TypeORM 의 `save()` 는 다시 그 트리거를 INSERT 로
부활시킬 수 있다. plan 문서(`§D` 후속 표)가 이 잔여 위험을 이미 인지·등재는 했지만 "지금은
네 창 모두 «행이 없으면 쓰지 않는다»" 라는 문장이 `update()`-기반 세 창과 `save()`-기반
한 창을 같은 보장 수준으로 묶어 실제보다 넓게 읽힌다는 점, 그리고 그 구분을 검증하는 테스트가
없다는 점을 WARNING 으로 남긴다. 락 대기 무상한은 기존에 문서화·수용된 트레이드오프의
재확인이며 데드락 위험은 낮다.

## 위험도

LOW
