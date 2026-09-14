import { EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { Trigger } from './entities/trigger.entity';

/**
 * `trigger.config` 재작성을 **트리거 단위로 직렬화**하는 advisory lock key 접두어.
 *
 * ## ⚠️ 이 문자열은 **Redis 키가 아니다**
 *
 * `{도메인}:{식별자}` 라 `redis-keys.md` 의 Redis 키와 겉모양이 같지만, 실체는 Postgres
 * `pg_advisory_xact_lock(hashtext(...))` 의 **입력 문자열**이고 Redis 를 경유하지 않는다.
 * `redis-keys.md §4`(«인접 네임스페이스»)가 정확히 이 혼동을 막으려는 절인데 자매 사례
 * (`exec-cap:<workspaceId>`, `execution-engine.service.ts`)조차 아직 미등재다 — 두 계열의
 * §4 등재는 planner 항목으로 올렸다
 * (`--impl-prep` `review/consistency/2026/09/14/17_10_16` naming_collision WARNING#2).
 */
export const TRIGGER_CONFIG_LOCK_PREFIX = 'trigger-config';

// 상위 plan: `plan/in-progress/trigger-config-lost-update.md` — 창 넷의 실측, 설계 근거,
// 그리고 «같은 클래스가 더 있다» 는 전수 열거가 거기 있다. 이 파일만 읽으면 그 맥락이
// 드러나지 않는다 (`review/code/2026/09/14/18_17_44` documentation INFO#9).

/** 같은 트리거의 `config` 재작성끼리만 직렬화한다 — 다른 트리거는 병렬 유지. */
export function triggerConfigLockKey(triggerId: string): string {
  return `${TRIGGER_CONFIG_LOCK_PREFIX}:${triggerId}`;
}

/**
 * 이 트리거의 config 락을 잡는다 — **트랜잭션 안에서만** 부른다(`xact` 는 커밋/롤백 시
 * 자동 해제이므로 트랜잭션 밖에서 부르면 즉시 풀린다).
 *
 * 아래 `rewriteTriggerConfigLocked` 와 `TriggersService.update()` 의 인라인 구현이 이
 * 한 줄을 **각자 손으로 적고 있었다**. 락 획득 SQL 을 바꿀 일(예: `SET LOCAL lock_timeout`
 * 추가 — 위 «대기 상한» 절이 예고한 그 변경)이 생기면 한쪽만 고칠 위험이 구조적으로 남는다
 * (`/ai-review` `review/code/2026/09/14/19_07_43` architecture WARNING#4). 프리미티브로
 * 뽑아 두 자리가 같은 코드를 지나가게 한다.
 */
export async function acquireTriggerConfigLock(
  manager: Pick<EntityManager, 'query'>,
  triggerId: string,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  if (options.timeoutMs !== undefined) {
    // `SET LOCAL` 이라 트랜잭션이 끝나면 저절로 풀린다 — 세션에 남지 않는다.
    // 파라미터 바인딩이 안 되는 자리라 **정수임을 여기서 강제**한다(값은 호출부 상수).
    await manager.query(
      `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'`,
    );
  }
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    triggerConfigLockKey(triggerId),
  ]);
}

/**
 * 삭제 경로의 락 대기 상한.
 *
 * 다른 경로는 무한 대기가 낫다 — 기다렸다 쓰는 것이 정답이기 때문이다. **삭제만 다르다**:
 * `remove()` 는 락을 잡기 **전에** 되돌릴 수 없는 정리(provider teardown · secret 삭제 ·
 * BullMQ 해제)를 이미 끝냈으므로, 여기서 무한정 매달리면 «자원은 다 뜯겼는데 행은 남은»
 * 반쯤 삭제된 상태가 요청 타임아웃/프로세스 재시작과 함께 굳어진다
 * (`/ai-review` `review/code/2026/09/14/20_49_15` side_effect WARNING#2).
 *
 * 상한을 두면 그 상태가 **조용한 지연이 아니라 드러나는 오류**가 된다.
 */
export const TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000;

/**
 * **`trigger.config` 를 락 안에서 다시 읽어** 머지하고 쓴다 — lost update 방지.
 *
 * ## 왜 필요한가
 *
 * **배선**: 이 함수를 쓰는 곳은 **창 2·3·4**(binder 성공·실패 경로 · `rotateBotToken`)다.
 * 창 1(`TriggersService.update()`)은 `save(entity)` 의 계약을 보존해야 해서 같은 락을
 * **인라인으로** 잡는다 — `acquireTriggerConfigLock` 을 공유하지만 이 함수는 거치지 않는다.
 * (세 라운드 연속 지적된 혼동이라 여기 못박는다.)
 *
 * 네 자리가 «읽기 → (외부 호출) → 쓰기» 를 락 없이 이어 붙이고, 쓰기는 읽은 시점의
 * **in-memory 스냅샷**으로 `config` 를 통째로 재구성한다. 동시 PATCH 가 겹치면 나중에
 * 커밋되는 쪽이 먼저 반영된 키를 **옛 스냅샷으로 되돌려 쓴다** — 잃는 것이
 * `chatChannel.inboundSigningRef` 라 **인입 서명 검증이 fail-open 으로 되돌아간다.**
 *
 * ## 외부 호출을 락 안에 두지 않는다 — 기각된 선례가 그 이유다
 *
 * `spec/2-navigation/4-integration.md` 가 Cafe24 토큰 갱신에서
 * `pg_advisory_xact_lock(hashtext(integrationId))` 를 **명시적으로 기각**했다. 사유는
 * *"lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고"* 다.
 *
 * **그 사유가 이 함수가 지키는 제약이다** — 호출부는 외부 호출을 **끝낸 뒤** 이것을 부르고,
 * 임계 구간은 «읽기 + 머지 + 쓰기» 뿐이라 provider 가 멈춰도 락·커넥션을 붙잡지 않는다.
 * 기각된 대안의 재도입이 아니라 **그 반론을 받은 설계**다.
 *
 * 락 자체의 선례는 `execution-engine.service.ts` 의 admission 직렬화이고, 그쪽 JSDoc 이
 * *"조건부 UPDATE 단독은 불충분"* 을 실측과 함께 적는다. `pg_advisory_xact_lock` 은
 * 트랜잭션 종료 시 자동 해제된다.
 *
 * ## 대기에 **상한이 없다**
 *
 * `lock_timeout` 을 걸지 않았으므로, 같은 트리거에 대한 동시 PATCH/rotate 는 앞선 요청이
 * 커밋할 때까지 **무한정 기다린다**. 이것은 선례(`execution-engine`)와 같은 선택이고, 임계
 * 구간에 외부 호출이 없어 보유 시간이 «DB 왕복 두 번» 으로 유계라는 것이 근거다 — 외부
 * 호출을 락 안에 두지 않는 위 제약이 곧 이 상한 부재를 감당 가능하게 만든다.
 *
 * **그래도 새 공유 블로킹 자원인 것은 맞다** (`/ai-review`
 * `review/code/2026/09/14/18_17_44` concurrency WARNING#3). 임계 구간에 외부 호출이나 긴
 * 계산을 들이는 변경을 한다면, 그때는 `SET LOCAL lock_timeout` 을 함께 넣어 실패를 조용한
 * 지연이 아니라 **드러나는 오류**로 바꿔야 한다.
 *
 * @param merge 락 안에서 읽은 **커밋된 최신** `config` 를 받아 새 `config` 를 만든다.
 *   호출부는 여기서 «presence 게이트» 를 **다시 계산**해야 한다 — 락 밖에서 만든 값을 그대로
 *   넣으면 이 함수가 막으려는 결함이 그대로 재발한다.
 * @param columns `config` 와 함께 쓸 «이번 호출의 결과» 컬럼(health·setupAt·lastError 등).
 *   이들은 머지 대상이 **아니다** — 이번 호출이 산출한 값이 곧 정답이다.
 * @returns 트리거가 그 사이 삭제됐으면 `false` (쓰기 skip).
 *
 *   **부재를 드러내는 방식이 창마다 다르다 — 의도된 비대칭이다.**
 *
 *   | 창 | 삭제 경합 시 |
 *   |---|---|
 *   | 창 1 `update()` (동기 요청) | **404 로 드러낸다** — 사용자가 보낸 변경이 반영되지 않았음을 알아야 한다 |
 *   | `rotateBotToken` (동기 요청) | **404 + 감사 미기록** — 위와 같은 이유 |
 *   | binder 성공/실패 경로 (저장 **뒤**의 best-effort 후속) | **`false` 로 감춘다** — 이미 응답이 나갔고, 실패를 던지면 성공한 저장을 되돌리는 것처럼 보인다 |
 *
 *   판단 기준은 «그 쓰기가 이번 요청의 **결과**인가, 뒤따르는 **부수 작업**인가» 다.
 */
export async function rewriteTriggerConfigLocked(
  manager: EntityManager,
  triggerId: string,
  merge: (freshConfig: Trigger['config']) => Trigger['config'],
  columns: QueryDeepPartialEntity<Trigger> = {},
): Promise<boolean> {
  return manager.transaction(async (m) => {
    await acquireTriggerConfigLock(m, triggerId);
    // **락을 잡은 뒤에 읽는다.** 이 시점의 행이 «커밋된 최신 상태» 이고, 동시 요청이 방금
    // 확립한 키는 여기에만 있다.
    //
    // 넘어온 in-memory `trigger.config` 를 쓰면 안 되는 이유는 별개로 있다 — `update()` 가
    // `mergeExternalConfig` 로 `config.chatChannel` 을 통째로 갈아치운 **뒤** 넘기므로 거기엔
    // 옛 ref 가 없다(`chat-channel-binder.service.ts` 의 R-CC-21 주석). **두 출처를 같은
    // 것으로 읽지 말 것** — 그 구분이 이 수정의 전제다.
    const fresh = await m.findOne(Trigger, { where: { id: triggerId } });
    if (!fresh) return false;
    // `config` 를 **뒤에** 둔다 — 스프레드 순서에 섞이면 호출부의 `columns` 가 실수로 덮는다.
    //
    // **캐스트가 필요한 이유는 nullable 이 아니라 JSONB 다.** `Trigger.config` 는
    // `Record<string, unknown>` 인데 TypeORM 의 `QueryDeepPartialEntity` 는 각 값을 다시
    // deep-partial 로 매핑하려 해서 `unknown` 값을 받지 못한다. 기존 호출부들이 통과한 것은
    // 객체 **리터럴**이라 값 타입이 구체적으로 추론됐기 때문이고, 여기처럼 blob 을 그대로
    // 넘기는 자리에서는 표현할 방법이 없다. 선례는 `workflows.service.ts` 의
    // `nodeRows as QueryDeepPartialEntity<Node>[]` 다.
    //
    // **이 캐스트가 무엇을 잃게 하는가**: `config` 안의 형태는 컴파일러가 더 이상 안 본다.
    // 그래서 `merge` 가 돌려준 값의 **모양을 보장하는 것은 호출부**이고, 그 계약을
    // `@param merge` 에 적어 뒀다. (`nullable-type-lie-cast` 가 겨누는 «null 을 non-null 로
    // 단언» 과는 다른 축이다 — 여기서 null 여부는 `fresh.config ?? {}` 가 이미 좁혔다.)
    const patch = {
      ...columns,
      config: merge(fresh.config ?? {}),
    } as QueryDeepPartialEntity<Trigger>;
    await m.update(Trigger, { id: triggerId }, patch);
    return true;
  });
}
