# 성능(Performance) Review — trigger-config-lost-update

## 검토 범위

`trigger.config` lost-update 를 advisory lock(`pg_advisory_xact_lock`) + "락 안 재읽기" 로
막는 수정. 코드 변경은 5개 파일 — `trigger-config-lock.ts`(신규) ·
`chat-channel-binder.service.ts` · `triggers.service.ts` · `hooks.service.ts` ·
`chat-channel-input-rules.ts`. 나머지는 테스트/mock/정적 가드/plan·review 산출물이라
런타임 성능과 무관해 대상에서 제외했다.

## 발견사항

- **[INFO][긍정]** 웹훅 hot path 가 full-entity `save()` 에서 컬럼 한정 `update()` 로 바뀌어 매 인입 메시지의 쓰기 비용이 줄었다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `touchLastTriggeredAt` (신규, 함수 정의부), 호출부 두 곳(`handleWebhook`·interaction ack 경로)
  - 상세: 종전엔 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger)` 로, 인입 메시지마다(가장 빈번한 경로) `config`(JSONB, 잠재적으로 큰 blob) 를 포함한 엔티티 전체를 다시 직렬화·저장했다. `touchLastTriggeredAt` 은 `triggerRepository.update({id}, {lastTriggeredAt})` 한 컬럼만 쓴다. 이 PR 의 1차 목적(lost-update 방지)의 부산물이지만, hot path 쓰기 비용을 줄이는 방향의 개선이라 긍정적으로 기록한다.
  - 제안: 없음(이미 개선됨).

- **[INFO][긍정]** `update()` 의 사전 검증 조회가 불필요한 JOIN 을 뺐다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `findByIdForUpdate` (신규 private 메서드), `update()` 첫 줄
  - 상세: `update()` 는 이제 검증 전용으로 `relations: ['workflow']` 없는 가벼운 `findByIdForUpdate` 를 쓰고, 저장 직전 락 안에서 `relations: ['workflow']` 를 실은 재조회를 한 번만 한다. 원래는 이 재조회 필요성 자체가 이전 리뷰 라운드에서 "PATCH 마다 같은 JOIN SELECT 가 두 번 돈다" 로 지적됐던 것(코드 주석에 그 근거가 남아 있음)인데, 이번 구현이 JOIN 없는 조회와 JOIN 있는 조회를 분리해 그 중복을 이미 없앴다.
  - 제안: 없음(이미 개선됨).

- **[WARNING]** `TriggersService.update()` 가 PATCH 1건당 SELECT 를 2회(비-JOIN 1회 + JOIN 1회) + advisory lock 획득 + UPDATE 로 늘렸다 — 트랜잭션 경계·락 획득 자체도 왕복이 추가된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` — `findByIdForUpdate` 호출부와 그 아래 `this.triggerRepository.manager.transaction(async (m) => { await acquireTriggerConfigLock(...); const fresh = await m.findOne(Trigger, {...}); ...; return m.save(Trigger, target); })` 블록
  - 상세: 종전 경로는 `findById`(JOIN SELECT 1회) → `save(trigger)`(UPDATE, TypeORM 내부 처리) 로 왕복이 상대적으로 적었다. 새 경로는 `findByIdForUpdate`(SELECT) → `BEGIN` → `SELECT pg_advisory_xact_lock(...)` → `findOne`(JOIN SELECT) → `save`(UPDATE) → `COMMIT` 순으로, PATCH 1건당 DB 왕복 횟수가 대략 2배로 늘었다. lost-update 방지를 위해 "락 안에서 최신 행을 다시 읽어야" 한다는 요구 자체는 정당하고 이미 위 긍정 항목처럼 JOIN 중복은 없앴으므로 설계는 합리적이지만, 순수 왕복 횟수 증가는 사실이라 지연시간(레이턴시) 관점에서 기록한다. PATCH 는 초당 대량 호출되는 hot path 가 아니므로 이 정도 증가가 문제를 일으킬 가능성은 낮다.
  - 제안: 별도 조치 불요. 다만 이 트리거 config 경로가 향후 더 빈번히 호출되는 용도로 재사용된다면 왕복 횟수를 재측정할 것.

- **[WARNING]** advisory lock 대기에 상한이 없어(delete 경로 제외), 경합 시 DB 커넥션 풀이 트리거 하나의 대기열에 묶여 앱 전역 풀 고갈로 번질 수 있다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `acquireTriggerConfigLock`(옵션 미지정 시 `lock_timeout` 안 걸림) — 호출부: `triggers.service.ts` `update()` 트랜잭션 블록, `chat-channel-binder.service.ts` 두 자리(성공/실패), `triggers.service.ts` `rotateBotToken`(`rewriteTriggerConfigLocked` 경유). `remove()`(delete) 만 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 로 상한이 있다.
  - 상세: `manager.transaction()` 안에서 `pg_advisory_xact_lock` 대기가 걸리면, 그 트랜잭션이 점유한 커넥션은 잠금이 풀릴 때까지 반환되지 않는다. 같은 트리거를 겨냥한 동시 PATCH/setupChannel/rotate 요청이 여러 개 몰리면(예: 클라이언트 재시도 폭주, 자동화 스크립트의 동일 트리거 반복 PATCH), 그 수만큼의 커넥션이 "일 안 하고 대기만" 하는 상태로 묶인다. 앱 전역 TypeORM 커넥션 풀(`configService.get('database.poolMax')`)은 트리거별로 분리돼 있지 않고 전 요청이 공유하므로, 특정 트리거 하나에 대한 경합이 충분히 몰리면 그 트리거와 무관한 다른 요청까지 커넥션을 못 받아 지연되는 방향으로 번질 수 있다. 코드 자체 JSDoc(`trigger-config-lock.ts:98-108`)이 "임계 구간이 DB 왕복 두 번으로 짧다"는 근거로 이 설계를 의도적으로 선택했다고 명시하고 있어 간과된 결함은 아니지만, 그 완화(`lock_timeout`)가 delete 경로에만 적용돼 있고 나머지 세 경로(update/binder/rotate)에는 비대칭적으로 없다.
  - 제안: 지금 막을 필요는 없다(설계 근거가 명시적이고 임계 구간이 짧다). 다만 운영 중 특정 트리거에 대한 PATCH/rotate 폭주가 관측되면(타임아웃·큐잉 로그), delete 와 동일하게 `acquireTriggerConfigLock(m, id, { timeoutMs: ... })` 를 나머지 세 호출부에도 넓혀 "조용한 지연" 대신 "드러나는 오류(+ 클라이언트 재시도)" 로 바꾸는 편이 커넥션 풀 보호에 유리하다.

- **[INFO]** `chat-channel-binder.service.ts` 의 성공/실패 경로가 단일 `UPDATE` 1회에서 트랜잭션+락+SELECT+UPDATE(약 4~5회 왕복)로 늘었다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `rewriteTriggerConfigLocked` 호출 두 곳(성공 경로, catch 블록)
  - 상세: 종전엔 `this.triggerRepository.update({id}, {config: newConfig, ...})` 단일 쿼리였다. 이제는 `manager.transaction` 안에서 `BEGIN → advisory lock → m.findOne(Trigger, {where:{id}}) → m.update(...) → COMMIT` 을 거친다. lost-update 방지를 위해 "락 안 재읽기" 가 반드시 필요하므로 정당한 트레이드오프이고, 이 경로는 트리거 생성/수정 시 chatChannel 설정 시점에만 호출되는 비-hot-path 라 전체 처리량에 미치는 영향은 낮다.
  - 제안: 조치 불요. 대량 트리거 일괄 생성/마이그레이션 스크립트가 이 경로를 반복 호출하는 용도로 쓰인다면 왕복 증가를 감안해 배치 크기·동시성을 조절할 것.

- **[INFO]** N+1 패턴·루프 내 DB 호출은 발견되지 않음
  - 상세: 이번 diff 의 모든 신규/변경 쓰기는 단일 트리거 단위(PK 기준)의 read-merge-write 이며, 반복문 안에서 개별 트리거를 순회하며 쿼리하는 코드는 없다. e2e 스펙(`trigger-config-lost-update.e2e-spec.ts`)의 대기(`SETTLE_MS = 300` 고정 1회)도 폴링 루프가 아니라 단일 `setTimeout` 이라 성능 관점에서 지적할 점이 없다.

## 요약

이번 변경의 핵심 트레이드오프는 "lost-update 방지를 위해 트리거 단위 advisory lock + 락 안 재읽기를 추가한다"는 것이고, 그 대가로 PATCH/chatChannel-setup/rotate 경로마다 DB 왕복 횟수가 늘었다(대략 1~2회 → 4~5회). 반대로 가장 빈번한 hot path 인 웹훅 인입 처리(`lastTriggeredAt` 갱신)는 오히려 full-entity `save()` 에서 컬럼 한정 `update()` 로 최적화됐고, PATCH 사전 검증도 불필요한 JOIN 을 이미 뺀 상태다. 남은 항목은 두 가지 WARNING 인데, 하나는 요청당 왕복 증가(설계상 불가피하고 이미 중복 JOIN 은 제거됨)이고 다른 하나는 advisory lock 대기 상한 부재로 인한 잠재적 커넥션 풀 경합(설계 근거는 명시돼 있고 delete 경로만 상한이 있는 비대칭 상태)이다. 루프 내 DB 호출·대규모 메모리 적재·캐싱 필요·블로킹 동기 I/O 오용 등 더 심각한 클래스의 결함은 발견되지 않았다.

## 위험도

LOW
