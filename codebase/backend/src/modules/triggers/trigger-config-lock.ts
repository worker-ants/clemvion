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

/** `lock_timeout` 하한 — 0 은 «무제한» 이라 상한을 두려는 의도와 정반대가 된다. */
const MIN_LOCK_TIMEOUT_MS = 1;
/** `lock_timeout` 상한. 이보다 오래 기다릴 바엔 무한 대기와 구분이 없다. */
const MAX_LOCK_TIMEOUT_MS = 60_000;

/**
 * `SET LOCAL lock_timeout` 문자열에 **안전하게 보간할 수 있는 정수**로 좁힌다.
 *
 * `Math.trunc` 만으로는 부족하다 — `Math.trunc(NaN)` 은 `NaN`, `Math.trunc(Infinity)` 는
 * `Infinity` 라 그대로 `'NaNms'` · `'Infinityms'` 가 SQL 에 실린다. 음수도 마찬가지로
 * postgres 가 거부한다.
 *
 * **유한하지 않으면 clamp 하지 않고 던진다.** `NaN` 을 조용히 1ms 로 만들면 삭제 경로가
 * «왜인지 늘 타임아웃» 하는 상태가 되고, 그건 이 상수가 막으려던 «조용한 실패» 그 자체다.
 * 범위를 벗어난 **유한한** 값은 의도가 분명하므로 clamp 한다.
 */
function toLockTimeoutMs(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      `setLocalLockTimeout: timeoutMs 는 유한한 수여야 한다 (받은 값: ${String(value)})`,
    );
  }
  return Math.min(
    Math.max(Math.trunc(value), MIN_LOCK_TIMEOUT_MS),
    MAX_LOCK_TIMEOUT_MS,
  );
}

/**
 * 이 트랜잭션의 **모든** 락 대기에 상한을 건다(`SET LOCAL lock_timeout`). 트랜잭션이 끝나면 풀린다.
 *
 * 되돌릴 수 없는 정리를 락 **전에** 끝내는 삭제 경로가 쓴다 — 무한 대기는 «정리는 끝났는데 행은
 * 남은» 상태를 굳힌다. 파라미터 바인딩이 안 되는 자리라 값의 형태를 {@link toLockTimeoutMs} 가 보장한다.
 */
export async function setLocalLockTimeout(
  manager: Pick<EntityManager, 'query'>,
  timeoutMs: number,
): Promise<void> {
  await manager.query(
    `SET LOCAL lock_timeout = '${toLockTimeoutMs(timeoutMs)}ms'`,
  );
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
    //
    // **범위가 advisory lock 하나가 아니다.** `lock_timeout` 은 이 트랜잭션의 **모든** 락
    // 대기에 걸린다 — 바로 아래 advisory lock 뿐 아니라 뒤따르는 `DELETE` 의 행 잠금,
    // `Schedule.triggerId` CASCADE 연쇄까지. 그래서 다른 writer 가 그 행을 오래 붙잡고
    // 있으면 advisory lock 과 **무관한 사유로** `55P03` 이 날 수 있다(트랜잭션 롤백이라
    // 데이터 손상은 없다). 삭제 경로에서는 그것도 «드러나는 오류» 쪽이 낫다는 판단이다
    // (`/ai-review` `review/code/2026/09/14/21_18_21` side_effect WARNING#6).
    //
    // 파라미터 바인딩이 안 되는 자리다. 호출부는 **모듈 상수만** 넘기므로(실측: 두 자리 모두
    // `TRIGGER_DELETE_LOCK_TIMEOUT_MS`, 변수·사용자 입력 경로 0건) 현재 익스플로잇은 불가능
    // 하다. 그래도 보간이 남아 있는 한 **값의 형태를 이 함수가 스스로 보장**한다 — 다음
    // 호출부가 계산식을 넘겨도 SQL 이 깨지지 않게 (`/ai-review`
    // `review/code/2026/09/15/01_42_04` security·database INFO#2).
    await setLocalLockTimeout(manager, options.timeoutMs);
  }
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    triggerConfigLockKey(triggerId),
  ]);
}

/**
 * 삭제 경로의 락 대기 상한.
 *
 * 다른 경로는 무한 대기가 낫다 — 기다렸다 쓰는 것이 정답이기 때문이다. **삭제만 다르다**:
 * 삭제 경로는 락을 잡기 **전에** 되돌릴 수 없는 정리를 이미 끝냈으므로, 여기서 무한정
 * 매달리면 «자원은 다 뜯겼는데 행은 남은» 반쯤 삭제된 상태가 요청 타임아웃/프로세스
 * 재시작과 함께 굳어진다 (`/ai-review` `review/code/2026/09/14/20_49_15` side_effect
 * WARNING#2).
 *
 * **무엇을 먼저 끝냈는지는 소비자마다 다르다** — `TriggersService.remove()` 는 provider
 * teardown · secret 삭제 · listener 해제까지, `SchedulesService.remove()` 는 BullMQ job
 * 해제만. 공통점은 그것들이 **되돌릴 수 없다**는 것이고, 이 상수가 거는 것은 그 공통점이다.
 * 한때 앞 소비자의 정리 목록을 여기 나열했는데, 두 번째 소비자가 생기자 그 목록이 곧바로
 * 과대 서술이 됐다 (`/ai-review` `review/code/2026/09/15/01_42_04` documentation INFO#17).
 *
 * 상한을 두면 그 상태가 **조용한 지연이 아니라 드러나는 오류**가 된다.
 */
export const TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000;

/**
 * **`trigger.config` 를 락 안에서 다시 읽어** 머지하고 쓴다 — lost update 방지.
 *
 * ## 왜 필요한가
 *
 * **배선**: `trigger.config` 를 다시 쓰는 자리는 **창 1 하나를 빼고 전부** 이 함수를 지난다.
 * 창 1(`TriggersService.update()`)만 예외다 — `save(entity)` 의 계약(반환 엔티티·subscriber·
 * `endpointPath` UNIQUE 충돌 경로)을 보존해야 해서 같은 락을 **인라인으로** 잡는다.
 * `acquireTriggerConfigLock` 은 공유하지만 이 함수는 거치지 않는다.
 *
 * > **호출부를 세어 적지 않는다.** 한때 «창 2·3·4» 라고 못박아 뒀는데, 그 뒤 세 자리가 더
 * > 전환되면서 그 문장이 **과소 서술**이 됐다 — 같은 문장을 세 라운드에 걸쳐 «과대» 방향으로
 * > 고쳤다가 이번엔 반대 방향으로 틀린 것이다. 목록은 낡고 규칙은 안 낡는다.
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
 *   | `revokePerTriggerToken` (동기 요청) | **404** — 위와 같은 이유 |
 *   | binder 성공/실패 경로 (저장 **뒤**의 best-effort 후속) | **`false` 로 감춘다** — 이미 응답이 나갔고, 실패를 던지면 성공한 저장을 되돌리는 것처럼 보인다 |
 *   | `normalizeNotificationSecretRef` (요청 안의 정규화 부수 단계) | **관측하지 않는다** — 후속 등재분(9라운드 INFO#6) |
 *   | `promoteRotatedNotificationSecrets` (cron) | **조용히 skip** — 알릴 상대가 없다. 다만 «승격했다» 고 세지 않는다 |
 *
 *   `cleanupRotatedChatChannelTokens` 는 **이 표에 없다** — 이 함수를 거치지 않고 컬럼만
 *   직접 갱신하기 때문이다(`config` 미접촉). 한때 «cron 두 곳» 으로 묶어 적었는데, 그러면
 *   같은 JSDoc 안의 규칙(위 «배선»)과 표가 **서로 다른 집합**을 가리키게 된다.
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
    // **0행이면 그 사이 행이 사라졌다 — 락을 잡고 있어도 가능하다.**
    //
    // 위 `findOne` 은 advisory lock 아래의 평범한 SELECT 이지 행 잠금이 아니다. 그리고
    // `Trigger` 행을 지우는 경로는 **셋**이다:
    //
    //   1. `TriggersService.remove()` — 이 락을 잡는다
    //   2. `SchedulesService.remove()` 의 cascade — 이 락을 잡는다
    //   3. **`Workflow`·`Workspace` 삭제의 FK `onDelete: 'CASCADE'`** — DB 레벨이라
    //      advisory lock 을 **애초에 잡을 수 없다** (`trigger.entity.ts` 의 두 `@ManyToOne`)
    //
    // 3번이 `findOne` 과 이 `update` 사이에 커밋되면 매치가 0행이 된다. 그때 `true` 를
    // 돌려주면 호출부의 `if (wrote)` 가 거짓을 믿는다 — `rotateBotToken` 은 404 를 던지는
    // 대신 성공 응답을 주고, secret store 에는 새 토큰만 남는다.
    //
    // `affected` 가 `null`·`undefined` 인 경우(드라이버가 보고하지 않음)는 **판정하지
    // 않는다** — «모른다» 를 «없다» 로 읽으면 정상 쓰기를 실패로 뒤집는다.
    //
    // («삭제 경로 둘이 같은 락을 공유해 실무적으로 닫혀 있다» 고 적었던 것이 이 실측으로
    // 반증됐다 — `/ai-review` `review/code/2026/09/15/01_42_04` database INFO#19 를 닫으려
    // 전제를 재다가 드러났다. 주어를 «애플리케이션 코드가 지우는 경로» 로 잡아 **DB 가
    // 지우는 경로**를 세지 않은 것이 원인이다.)
    const result = await m.update(Trigger, { id: triggerId }, patch);
    if (result.affected === 0) return false;
    return true;
  });
}
