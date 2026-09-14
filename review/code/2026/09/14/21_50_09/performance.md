# 성능(Performance) 리뷰

## 검토 범위

`trigger.config` lost-update 를 막기 위해 도입된 트리거 단위 advisory lock
(`codebase/backend/src/modules/triggers/trigger-config-lock.ts`, 신규)과 그 배선 4곳
(`triggers.service.ts#update`·`#remove`·`#rotateBotToken`, `chat-channel-binder.service.ts#setupChatChannel`
성공/실패 경로), 그리고 웹훅 인입 hot path 를 `save(entity)` 에서 컬럼 한정 `update()` 로 바꾼
`hooks.service.ts#touchLastTriggeredAt` 를 성능 관점에서 분석했다. 테스트·가드(AST 정적분석)
파일은 런타임 성능과 무관해 범위에서 제외했다.

## 발견사항

- **[WARNING]** 상한 없는 advisory lock 대기 + 작은 기본 커넥션 풀 → 같은 트리거에 대한
  동시 쓰기 폭주가 **인스턴스 전체**의 DB 커넥션 풀을 고갈시킬 수 있다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39` (`acquireTriggerConfigLock`, `options.timeoutMs` 미지정 시 무한 대기) ·
    `codebase/backend/src/modules/triggers/triggers.service.ts:588` (`update()` 창 1 트랜잭션) ·
    `codebase/backend/src/modules/triggers/triggers.service.ts:1236` (`rotateBotToken` → `rewriteTriggerConfigLocked`) ·
    `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:266`,`310` (`setupChatChannel` 성공/실패 경로)
  - 상세: `pg_advisory_xact_lock` 은 트랜잭션이 잡고 있는 동안 **TypeORM 커넥션 풀에서 커넥션을 점유한 채** 대기한다. 풀 크기 기본값은 `DB_POOL_MAX` 미설정 시 **10**
    (`codebase/backend/src/common/config/database.config.ts:14`). 같은 트리거 id 에 대해 `PATCH /api/triggers/:id`·`rotateBotToken`·
    (setupChannel 완료 후의) binder 재쓰기가 동시에 N건 몰리면, 이 함수 자체의 임계 구간이
    "DB 왕복 두 번" 으로 유계라는 근거(같은 파일 JSDoc, 78~117행)는 **한 요청의 보유 시간**만 설명할 뿐 **동시 요청 수만큼 커넥션이 동시에 점유되는 것**은 막지 못한다. `remove()` 경로에만 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5초) 가 있고, `update()`·`rotateBotToken`·binder 경로에는 `lock_timeout` 이 없어(`trigger-config-lock.ts:107`의 "대기에 상한이 없다" 절) N ≥ poolMax 가 되는 순간 그 트리거와 무관한 다른 요청들도 커넥션을 못 받아 인스턴스 전체가 정체된다 — 단일 트리거를 겨눈 동시 PATCH 폭주(악의적이든 클라이언트 버그 재시도든)가 **다른 워크스페이스/트리거**까지 끌고 가는 blast radius 확대 지점이다.
  - 제안: (a) 삭제 경로처럼 `update()`/`rotateBotToken`/binder 경로에도 짧은 `lock_timeout` (예: 수 초)을 기본값으로 걸어 "조용한 정체"를 "드러나는 409/503" 로 바꾸거나, (b) 같은 트리거 id 에 대한 동시 PATCH 를 애플리케이션 레벨에서 짧게 rate-limit/직렬화해 풀 점유 커넥션 수 자체를 낮게 유지할 것. 최소한 회귀 캐너리로 "poolMax 개수만큼 동시 PATCH 를 같은 트리거에 보내면 다른 트리거 조회가 타임아웃되지 않는다" 를 부하 테스트에 남기는 것을 권장한다.

- **[INFO]** `chatChannel` 을 포함한 PATCH 한 번이 같은 트리거에 대해 advisory lock 을 **두 번** 잡는다(각각 별도 트랜잭션)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:588`(창 1, `update()` 내부) 와 `triggers.service.ts:668`→`chat-channel-binder.service.ts:266`(`setupChatChannel` 이 또 `rewriteTriggerConfigLocked` 호출)
  - 상세: `update()` 가 먼저 락을 잡고 병합·저장한 뒤 커밋하고, `chatChannel` 이 있으면 곧이어 `setupChatChannel` 이 (외부 adapter 호출 후) 같은 트리거 id 로 다시 락을 잡는다. "외부 호출을 락 안에 두지 않는다" 는 설계 제약상 불가피하지만, 그 결과로 요청 하나가 advisory lock 획득 + 트랜잭션 커밋을 **두 세트** 필요로 해 DB 왕복이 늘어난다.
  - 제안: 현재 설계 제약(외부 호출 배제)을 지키는 한 구조적으로 합치기는 어렵다 — 별도 조치 불요. 다만 위 WARNING 의 lock_timeout 도입 시 두 락 모두에 일관되게 적용해야 함을 기록해 둔다.

- **[INFO]** 웹훅 인입 hot path 의 쓰기 방식 개선 확인 — 회귀 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:224`,`683`(호출부), `:973`(`touchLastTriggeredAt` 정의)
  - 상세: 종전 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger);` 는 `findOne` 으로 적재된 엔티티 전체(잠재적으로 큰 `config` JSONB 포함)를 **인입 메시지마다** 다시 쓰는 구조였다. `touchLastTriggeredAt` 이 컬럼 한정 `update({id}, {lastTriggeredAt})` 로 바꾸면서 hot path 의 쓰기 폭(row 전체 → 컬럼 1개)과 WAL 발생량이 줄었다 — lost-update 수정과 별개로 순수 성능 이득이다. 새 회귀는 관측되지 않았다.

- **[INFO]** advisory lock 키가 32-bit 해시 공간을 공유 — 저확률 충돌 시 무관한 트리거끼리 불필요하게 직렬화될 수 있다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:18`(`TRIGGER_CONFIG_LOCK_PREFIX`), `:25`(`triggerConfigLockKey`), `:60`(`pg_advisory_xact_lock(hashtext($1))`)
  - 상세: `hashtext()` 는 32-bit 정수를 돌려주고 그대로 `pg_advisory_xact_lock(bigint)` 로 캐스트된다. 트리거 수·동시 PATCH 량이 매우 커지면(생일 역설 기준 대략 √(2^32)≈65,536 규모) 서로 다른 트리거가 우연히 같은 락 키에 걸려 불필요하게 순서를 기다릴 수 있다. 정확성에는 영향이 없다(초과 직렬화일 뿐) — 순수 지연 문제다.
  - 제안: 현재 트리거 규모에서는 실질적 위험이 낮아 조치 불필요. 트리거 수가 수만 단위로 늘어나는 로드맵이 있다면 `pg_advisory_xact_lock_shared`/two-key 버전(`pg_advisory_xact_lock(int, int)` 등)으로 충돌 공간을 넓히는 것을 후속 검토 대상으로만 기록해 둔다.

## 요약

이번 변경의 핵심 트레이드오프(외부 provider 호출을 advisory lock 밖에 두고, 임계 구간을 "읽기+병합+쓰기"로 좁혀 보유 시간을 유계화한 것)는 이미 코드 내 JSDoc 이 스스로 근거를 대며 잘 설계되어 있고, 웹훅 hot path 를 `save()`→컬럼 한정 `update()` 로 바꾼 것은 순수한 성능 개선이다. 다만 그 근거("보유 시간이 짧다")는 **한 요청**의 관점이고, `update()`/`rotateBotToken`/binder 세 경로에는 `remove()` 와 달리 `lock_timeout` 이 없어 같은 트리거를 겨눈 동시 요청 폭주가 커넥션 풀(기본 10) 전체를 점유해 무관한 요청까지 정체시킬 수 있는 새 자원 고갈 벡터가 생겼다. 그 외에는 chatChannel PATCH 의 이중 락 획득, 저확률 해시 충돌 정도의 경미한 지연 요소만 있다.

## 위험도

MEDIUM
