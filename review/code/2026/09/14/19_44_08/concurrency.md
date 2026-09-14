# 동시성(Concurrency) 리뷰 — trigger-config-lost-update (3라운드)

## 검토 범위

`trigger.config` lost-update(동시 PATCH/rotate/웹훅 인입이 서로의 `chatChannel.inboundSigningRef`
를 되돌려 인입 서명 검증이 fail-open 되는 결함)를 트리거 단위 `pg_advisory_xact_lock` + 락 안
재읽기로 닫는 변경의 **3번째 리뷰 라운드**다. 이전 두 라운드(`18_17_44`, `19_07_43`)가 이미
핵심 프리미티브(`trigger-config-lock.ts`)와 락 배치·데드락·격리수준을 확인해 뒀으므로, 이번
라운드는 (1) 그 두 라운드가 지적한 WARNING(웹훅 hot path·창 1)이 실제로 닫혔는지 재확인하고
(2) 새로 바뀐 코드 경로에서 아직 보고되지 않은 동시성 결함이 있는지를 중심으로 봤다.

## 발견사항

### WARNING — 창 1(`update()`)의 `save(target)` 는 트리거가 그 사이 삭제되면 «no-op」이 아니라 **되살린다** (INSERT)

- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:582` (`const target = fresh ?? trigger;`, 뒤이은 `:584` `return m.save(Trigger, target);`)
- 상세: 이번 라운드가 창 1(`update()`)을 advisory lock 안으로 옮기면서 `fresh = await m.findOne(Trigger, {...})` 가 `null` 이면(트리거가 그 사이 삭제됨) `target = fresh ?? trigger` 가 **요청 시작 시점의 stale `trigger` 엔티티**로 대체되고, 그 위에 PATCH 값을 얹어 그대로 `m.save(Trigger, target)` 를 부른다. 이 파일의 새 프리미티브 `rewriteTriggerConfigLocked`(`trigger-config-lock.ts:108-109`, `if (!fresh) return false;`)는 같은 상황을 명시적으로 skip 하는데, 창 1 은 그 가드를 갖고 있지 않다.
  이 vendored TypeORM(`codebase/backend/node_modules/typeorm`)의 `save()` 내부 동작을 직접 확인했다 — `SubjectDatabaseEntityLoader.js:108-110` 이 대상 id 로 재조회해 못 찾으면 `subject.databaseEntity` 는 `undefined` 로 남긴 채 `subject.databaseEntityLoaded = true` 를 무조건 세팅하고, `Subject.js` 의 `mustBeInserted` 게터(`get mustBeInserted() { return this.canBeInserted && !this.databaseEntity; }`)는 이 상태에서 **`true`** 가 된다(`EntityPersistExecutor.js:74-75` 가 `save()` 호출에 `canBeInserted: true` 를 준다). 반면 `mustBeUpdated` 는 `databaseEntityLoaded===false || (databaseEntityLoaded && databaseEntity)` 조건이 `(false || false)` 로 거짓이 되어 **`false`** 다. 즉 TypeORM 은 이 엔티티를 "조용히 0행 UPDATE" 가 아니라 **"새로 INSERT 해야 하는 엔티티"** 로 판단한다. `Trigger.id` 는 `@PrimaryGeneratedColumn('uuid')`(`entities/trigger.entity.ts:33`)라 이미 값이 있으면 그 값을 그대로 써서 INSERT 하므로, **삭제된 트리거가 같은 id 로 다시 생성된다.**
  `remove()`(`triggers.service.ts:893-922`)는 이 advisory lock 을 잡지 않고(`triggerRepository.remove(trigger)` 는 락 밖) `teardownChatChannel`·`secrets.deleteByPrefix`·(schedule 타입이면) BullMQ job 해제·CASCADE 로 `schedule` row 삭제까지 먼저 끝낸다. 그 직후 `update()` 가 이 레이스를 밟으면, 되살아난 트리거는 **이미 지워진 secret store ref·존재하지 않는 schedule row·해제된 BullMQ job** 을 그대로 참조하는 고아 상태로 부활한다 — `config` 의 `botTokenRef`/`inboundSigningRef` 는 가리키는 secret row 가 없고, `type==='schedule'` 이면 대응 `schedule` row 없이 트리거만 존재한다.
  이 레이스 자체는 **이 PR 이 새로 만든 것이 아니다** — `save(entity)` 의 위 TypeORM 동작은 종전 코드(`Object.assign(trigger, ...); await this.triggerRepository.save(trigger);`)에도 동일하게 있었다. 다만 `plan/in-progress/trigger-config-lost-update.md` §D 후속표가 "`remove()` 가 같은 락을 안 잡는다 → 삭제 레이스의 좁은 창, **데이터 손상은 없다**(INFO#6)" 라고 적은 근거는 `rewriteTriggerConfigLocked` 의 `!fresh → false` skip 을 보고 내린 판단이라, **창 1 자신의 `save()` 경로에는 그대로 적용되지 않는다** — 그쪽은 skip 이 아니라 되살리기다. 이번 리뷰에서 창 1 을 락 안으로 옮기며 재조회를 추가한 것은 옳은 방향이지만, "재조회 결과가 없다" 는 분기를 `rewriteTriggerConfigLocked` 와 다르게 처리하지 않았다는 점이 이번 diff 가 남긴 공백이다.
- 제안: 창 1 에도 같은 skip 을 추가한다 — `if (!fresh) throw new NotFoundException(...)` (또는 best-effort 로 조용히 반환) 을 `const fresh = await m.findOne(...)` 직후에 두어, `target = fresh ?? trigger` 의 폴백 경로 자체를 없앤다. `plan` §D 의 INFO#6 서술도 "두 자리(`rewriteTriggerConfigLocked` skip vs 창 1 `save`)의 처분이 다르다" 로 정정이 필요하다.

## 검증한 것 (이전 라운드 WARNING 이 실제로 닫혔는지 재확인)

- **`19_07_43` WARNING#1(웹훅 hot path)** — `hooks.service.ts:227-236`(`handleWebhook`), `:695-704`(`handleChatChannelWebhook`) 둘 다 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger);` 에서 `triggerRepository.update({id}, {lastTriggeredAt})` 컬럼 한정 갱신으로 바뀌었다. 이제 `config` 를 전혀 싣지 않으므로 이 hot path 는 이 PR 이 닫으려는 fail-open 클래스에서 완전히 빠진다. `hooks.service.spec.ts:201-224` 가 `save` 미호출 + `update` patch 의 key 가 정확히 `['lastTriggeredAt']` 하나뿐임을 단언해, "patch 에 `config` 가 섞이는" 재발 형태까지 커버한다.
- **`19_07_43` WARNING#2 / 창 1 자체의 lost-update** — `update()`(`triggers.service.ts:548-586`) 가 이제 `acquireTriggerConfigLock` → `m.findOne`(락 안 재읽기) → `Object.assign(target, ...)` → `m.save(Trigger, target)` 순서로, 형제 창(`rotateBotToken`·binder)이 같은 락 안에서 커밋한 `chatChannelHealth` 등 컬럼을 더 이상 스냅샷으로 덮지 않는다. `저장 대상을 재읽은 행으로` 라는 처방이 코드에 정확히 반영돼 있다.
- **presence 게이트 재계산(`survivesWithFresh`)** — `chat-channel-binder.service.ts:209-211` 이 요청 시작 시점 값과 락 안 재읽기 값을 OR 로 묶는 구조는 전 라운드와 동일하게 유지돼 있고, 이번 라운드 diff 는 이 로직 자체를 건드리지 않았다.
- **락 배치·데드락** — 네 호출부(binder 성공/실패, `rotateBotToken`, 창 1) 모두 단일 락(`trigger-config:<triggerId>`)만 잡고 외부 HTTP 호출은 락 밖에 있다는 이전 라운드 판정은 이번 diff 로 바뀌지 않았다. 여러 락을 서로 다른 순서로 잡는 코드 경로는 여전히 없어 lock-ordering 데드락 조건이 성립하지 않는다.
- **테스트 배선** — `trigger-transaction-mock.ts` 의 `withTransactionMock` 이 `manager.transaction` 콜백을 실제로 실행하고 `findOne`/`save`/`update` 를 기존 repo mock 에 위임한다. no-op 이었다면 13개 케이스가 조용히 vacuous 해졌을 것이라는 주석의 뮤테이션 실측(그 부분 자체를 다시 실행하지는 않았으나, 방법론과 대상이 재현 가능한 형태로 기록돼 있어 타당하다고 판단)과 `trigger-config-lock.spec.ts` 가 락 순서·스프레드 순서·`!fresh` skip 분기를 독립적으로 단언하는 구조는 견고하다.
- **e2e 판별력** — `trigger-config-lost-update.e2e-spec.ts` 가 advisory lock 을 테스트가 직접 쥐어 "B 가 읽는 시점엔 ref 없음 → A 가 그 사이 확립 → B 가 뒤늦게 쓴다" 는 인터리빙을 결정적으로 재현하고, 세 단언(PATCH 값 생존·ref 생존·손대지 않은 키 생존)이 서로 다른 자리를 물어 하나만 남기는 편집이 나머지를 통과시키지 않는 구조다.

## 확인했지만 새 결함으로 집계하지 않은 것 (이미 문서화·수용됨)

- `lock_timeout` 부재(무기한 대기) — 임계 구간이 「읽기+머지+쓰기」로 유계라는 근거가 JSDoc·plan 양쪽에 있고 이번 diff 로 전제가 깨지지 않았다.
- `chatChannelHealth` 등 상태 컬럼이 이 PR 이 건드리지 않은 다른 경로(`hooks.service.ts` 의 `markChatChannelRateLimited`, cron 두 곳 등)에서 여전히 락 밖에서 쓰일 수 있다는 점 — 보안 무관 관측성 lost-update로 이미 후속 등재.
- advisory lock 32비트 해시 공간을 `exec-cap:*` 과 공유 — 과직렬화일 뿐 정확성 훼손 아님, 이미 별도 리뷰·planner 항목으로 등재됨.
- `revokePerTriggerToken`·`normalizeNotificationSecretRef`·`promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens`·`schedules.service.ts#update` 의 무가드 `save()` — 같은 클래스지만 이 PR 범위 밖으로 명시적으로 미룬 항목들이고, 재확인 결과 이번 diff 가 그 경계를 넓히지 않았다.

## 요약

이전 두 라운드가 지적한 두 WARNING(웹훅 hot path 의 전체-엔티티 저장, 창 1 자신이 형제 창의 컬럼 커밋을 되돌리는 문제)은 이번 라운드에서 실제로 닫혔고, 각각 회귀를 잡는 테스트(hot path 컬럼-한정 단언, e2e 인터리빙)가 붙어 있다. 핵심 프리미티브(`rewriteTriggerConfigLocked`)의 락 배치·재읽기·presence 게이트·데드락 부재는 재확인 결과 여전히 견고하다. 다만 이번 라운드가 창 1 을 락 안으로 옮기며 추가한 재조회(`fresh`)가 `null` 인 경우(트리거가 그 사이 삭제된 경우)를 `rewriteTriggerConfigLocked` 와 다르게 처리한다 — skip 하지 않고 stale 엔티티로 그대로 `save()` 를 불러, vendored TypeORM 의 `mustBeInserted`/`mustBeUpdated` 판정(`Subject.js`)에 따라 **삭제된 트리거를 같은 id 로 다시 INSERT** 하게 된다. 이 레이스 자체는 `save(entity)` 의 기존 TypeORM 동작이라 이번 PR 이 새로 만든 것은 아니지만, `remove()` 가 이 락에 참여하지 않는다는 사실을 "데이터 손상 없음" 으로 정리한 plan 의 기존 판단이 이 경로에는 그대로 적용되지 않는다는 점을 재조회 추가가 새로 드러냈다. `!fresh` 분기에서 skip 하도록 창 1 에도 같은 가드를 추가할 것을 권고한다.

## 위험도

MEDIUM
