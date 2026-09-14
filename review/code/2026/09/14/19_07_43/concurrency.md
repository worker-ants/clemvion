# 동시성(Concurrency) 리뷰

## 검토 범위

`trigger.config` lost-update(동시 PATCH/rotate 가 서로의 `chatChannel.inboundSigningRef` 를
되돌려 인입 서명 검증이 fail-open 되는 결함)를 트리거 단위 `pg_advisory_xact_lock` + 락 안
재읽기로 닫는 변경. 핵심 파일:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규 헬퍼)
- `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts` (신규, 헬퍼 계약 unit)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (`setupChatChannel` 두 쓰기 경로)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`update()` 창 1, `rotateBotToken()`)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규 e2e, 실제 인터리빙 재현)
- 테스트 인프라: `trigger-transaction-mock.ts`, `triggers.web-chat.spec.ts`, `endpoint-path-conflict-wrap-guard.ts` 등

## 발견사항

### 새로 추가된 락·재읽기 로직 자체 — 결함 없음 (확인 완료)

- 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:80-112` (`rewriteTriggerConfigLocked`)
- 상세: `manager.transaction(async (m) => {...})` 안에서 (1) `pg_advisory_xact_lock(hashtext(key))` 획득 → (2) `m.findOne` 재읽기 → (3) `merge(fresh.config ?? {})` → (4) `m.update`. 락은 같은 트랜잭션의 같은 커넥션에서 잡혀 재읽기가 "커밋된 최신 상태"를 보는 것이 보장되고, `merge` 콜백이 던지면 트랜잭션 롤백과 함께 `pg_advisory_xact_lock`(xact-scoped)이 자동 해제돼 락 누수 경로가 없다. 락 획득이 읽기보다 먼저라는 순서, `columns`/`config` 스프레드 순서(`config` 가 뒤에 와야 함), 행이 사라진 경우(`!fresh`) skip+`merge` 미호출 세 가지를 `trigger-config-lock.spec.ts` 가 각각 독립적으로 단언한다(`calls` 배열로 호출 순서까지 관측). 네 호출부(`chat-channel-binder.service.ts:266,303`, `triggers.service.ts:549-576`(직접 `manager.transaction`), `triggers.service.ts:1149`)가 전부 같은 `triggerConfigLockKey(triggerId)` 를 사용해 같은 트리거의 쓰기끼리만 직렬화하고 다른 트리거는 막지 않는다. 단일 락 자원만 쓰고 요청 안에서 중첩·병렬 획득이 없어 데드락 순서 문제도 없다.
- 제안: 없음 — 이 부분은 견고하다.

### `survivesWithFresh` 게이트(OR 병합) — lost-update 방지 로직 검증 완료

- 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:206-241` (`survivesWithFresh`, `buildChannel`)
- 상세: `inboundSigningRef` 보존 여부를 "요청 시작 시점 스냅샷의 presence" **OR** "락 안에서 재읽은 행의 presence" 로 판정한다. OR 이므로 두 시점 중 하나라도 ref 가 있었으면 살아남는 단조(monotonic) 성질이 있어, 동시 요청이 그 사이 ref 를 처음 확립하는 인터리빙에서도 유실되지 않는다. `triggers.service.ts:559-562` 도 같은 방식으로 `previousInboundSigningRef` 를 락 안 재읽기로 갱신한다. `trigger-config-lost-update.e2e-spec.ts` 가 advisory lock 을 테스트가 직접 쥐어 "B 가 읽는 시점엔 ref 없음 → A 가 그 사이 확립 → B 가 뒤늦게 쓰기"라는 정확한 인터리빙을 결정적으로 재현하고, 서로 다른 세 지점(PATCH 값 생존/ref 생존/손대지 않은 키 생존)을 독립적으로 단언한다.
- 제안: 없음.

### WARNING — 같은 결함 클래스의 잠금-미적용 자리가 hot path 에 남아 있다 (문서화된 후속이지만 보안 영향이 과소평가됨)

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:227-228`(`handleWebhook`) 및 `:687-688`(`handleChatChannelWebhook`) — **본 diff 밖의 기존 코드**, 이 PR 은 건드리지 않음.
- 상세: 두 자리 모두 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger);` 로 **엔티티 전체**를 저장한다. `trigger` 는 요청 진입 시 한 번 읽힌 뒤(`handleWebhook:111-116` 또는 가드가 preload) 재조회 없이 그대로 이 지점까지 온다 — 그 사이 `executionEngineService.execute(...)`, `channelConversationService.upsert(...)` 등 여러 await 지점을 지난다. `save(entity)` 는 로드 시점의 `trigger.config` 를 통째로 다시 쓰므로, 이 request 가 처리되는 동안 **다른** 요청(PATCH·`rotateBotToken`·동시 chat 메시지)이 같은 트리거의 `config`(특히 `chatChannel.inboundSigningRef`)를 커밋하면 이 저장이 그것을 조용히 되돌린다 — 이번 PR 이 닫은 것과 **동일한 fail-open 클래스**다. 게다가 이 경로는 **인입 chat 메시지/웹훅마다** 실행되는 hot path라, PATCH-vs-PATCH 보다 겹침 빈도가 훨씬 높다.
  이 자리는 `plan/in-progress/trigger-config-lost-update.md:321-355`("같은 클래스의 자리가 넷보다 많다")에서 **이미 전수 열거로 발견되어** `hooks.service.ts:228 · :688` 로 명시 등재됐고, "hot path 에 트랜잭션을 새로 얹는 판단은 자리별 근거가 필요하다"는 이유로 **의도적으로 이 PR 범위 밖 후속**으로 미뤄졌다 — 은폐되거나 놓친 것이 아니라 서술된 트레이드오프다. 다만 plan 의 서술은 이를 "lastTriggeredAt hot path" 라는 **일반적 lost-update** 로만 프레이밍하고 있어, 이 자리가 구체적으로 **이번 PR 이 막으려는 바로 그 보안 속성(`inboundSigningRef` presence → 인입 서명 검증)** 을 되돌릴 수 있다는 점은 plan 표에 드러나 있지 않다. 후속 우선순위를 매길 때 "일반 lost-update"보다 "서명 검증 fail-open 재노출 가능"으로 격상해 다뤄야 한다.
- 제안: 후속 작업 우선순위를 (일반 관측성 lost-update가 아니라) 보안 재발 위험으로 재분류. 최소 조치로는 `chatChannel` 이 설정된 트리거에 한해 `lastTriggeredAt` 갱신을 `rewriteTriggerConfigLocked` 로 옮기거나(락 안에서 `columns: { lastTriggeredAt }` 만 갱신하고 `config` 는 재읽은 값을 그대로 보존), 최소한 `trigger.config` 를 건드리지 않는 `repository.update(id, { lastTriggeredAt })`(컬럼 한정 update)로 바꿔 이 경로가 `config` 를 암묵적으로 재작성하지 않게 하는 방법이 있다.

### WARNING — 동일 파일 안에 `config` 를 명시적으로 재작성하는 cron 두 곳도 잠금 밖 (문서화된 후속)

- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `promoteRotatedNotificationSecrets` (약 1189-1250줄, `trigger.config = { ...trigger.config, notification: updatedNotification }` 뒤 `save(trigger)`) 및 `cleanupRotatedChatChannelTokens` (약 1261-1300줄, `chatChannelTokenV2`/`chatChannelRotatedAt` 를 null 로 두고 `save(trigger)`). 둘 다 **본 diff 밖**.
- 상세: 두 함수 모두 `createQueryBuilder().getMany()` 로 후보 행을 한 번에 fetch 한 뒤 루프를 돌며 행마다 `await this.secrets.rotate/resolve/delete(...)`, `await this.tryRevokeOldBotToken(...)` 같은 외부 I/O 를 거쳐 `save(trigger)` 한다. 이 I/O 구간에 동시 PATCH/rotateBotToken 이 같은 행의 `config` 를 커밋하면 배치가 로드 시점의 스냅샷으로 되돌려 쓴다 — `trigger-config-lock.ts` 가 겨누는 것과 같은 lost-update 형태다. 이 역시 `plan/in-progress/trigger-config-lost-update.md:344-350` 표에 `triggers.service.ts` `normalizeNotificationSecretRef`/`revokeInteractionToken`/`promoteNotificationSecrets`(cron) 로 명시 등재되어 "이 PR 로 넓히지 않는다"고 결정된 항목이다. 빈도는 hooks.service.ts 쪽보다 낮다(1시간 주기 cron, 트리거당 24h 유예 이후 1회) — 그래서 WARNING 으로 hooks.service.ts 항목보다 낮게 둔다.
- 제안: 별도 항목이 아니라 위 hooks.service.ts 항목과 **같은 후속 작업**으로 묶어 `rewriteTriggerConfigLocked` 제네릭화(트리거 타입 하드코딩 제거, plan INFO#4 가 이미 지적) 후 일괄 적용을 검토.

### INFO — 확인됨: 새 공유 블로킹 자원(락)에 timeout 없음 — 이미 문서화·수용된 트레이드오프

- 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:53-63`
- 상세: `SET LOCAL lock_timeout` 없이 `pg_advisory_xact_lock` 을 무기한 대기한다. 임계 구간에 외부 호출이 없어 보유 시간이 "DB 왕복 두 번"으로 유계라는 근거가 JSDoc 에 있고, 이전 라운드 리뷰(WARNING#3)에서 이미 지적·수용된 사항이다. 재확인 결과 네 호출부 모두 임계 구간 안에 `await adapter.setupChannel`/`secrets.*` 같은 외부 호출을 두지 않는 것을 확인했다(락 안 코드는 `query`/`findOne`/`update` 뿐). 다만 커넥션 풀 크기가 작고 같은 트리거에 대한 요청이 폭주하면, 대기 중인 요청들이 커넥션을 하나씩 점유한 채 블록되어 풀 고갈로 번질 수 있다는 점은 여전히 유효한 잠재 리스크다 — 이미 알려진 트레이드오프이므로 새 발견으로 집계하지 않는다.
- 제안: 없음 (이미 추적됨). 향후 임계 구간에 로직을 추가할 때는 JSDoc 의 경고대로 `lock_timeout` 을 동반할 것.

### INFO — 확인됨: advisory lock 키의 32비트 해시 공간 공유 — 이미 planner 항목으로 등재

- 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:6-18` (`triggerConfigLockKey`), `hashtext($1)` 호출부(`trigger-config-lock.ts:81-83`, `triggers.service.ts:551-553`)
- 상세: `hashtext()` 는 int4 를 반환하므로 `trigger-config:<id>` 와 `exec-cap:<workspaceId>`(execution-engine) 등 서로 다른 lock 네임스페이스가 32비트 공간을 공유한다. 충돌 시 무관한 두 자원이 서로를 불필요하게 직렬화(과직렬화)하지만 데이터 손상은 없다 — JSDoc 이 이를 인지하고 `plan/in-progress/trigger-config-lost-update.md:309`(§`--impl-prep` 등재 항목)에 planner 범위 후속으로 이미 올라가 있다.
- 제안: 없음 (planner 턴에서 처리될 항목).

## 요약

새로 추가된 `rewriteTriggerConfigLocked` + 트리거 단위 advisory lock 은 "락 획득 → 락 안 재읽기 → OR 기반 presence 게이트 재계산 → 병합·쓰기" 순서를 네 호출부 모두에서 일관되게 지키고, 락 순서·재읽기 시점·행 삭제 분기를 겨냥한 unit(`trigger-config-lock.spec.ts`)과 실제 DB 레벨 인터리빙을 결정적으로 만드는 e2e(`trigger-config-lost-update.e2e-spec.ts`)로 검증돼 있어 diff 자체의 동시성 설계에는 결함을 찾지 못했다. 다만 이번 조사에서 `plan/in-progress/trigger-config-lost-update.md` 가 이미 전수 열거해 둔 "같은 클래스의 자리가 넷보다 많다" 항목 — 특히 `hooks.service.ts:228/688` 의 hot-path 전체 엔티티 `save()` — 는 재확인 결과 일반적인 lost-update 를 넘어 이번 PR 이 막으려는 **바로 그 인입 서명 fail-open 을 다시 열 수 있는 자리**임이 드러난다. 의도적으로 범위를 좁힌 문서화된 후속이라 이 PR 을 막을 사유는 아니지만, 후속 우선순위 재평가가 필요하다.

## 위험도

MEDIUM
