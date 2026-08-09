import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';

import { createDbClient, uniqueName } from './helpers/db';

/**
 * e2e: `SecretResolverService.deleteByPrefix()` 가 LIKE 메타문자를 **거부**하는 가드의
 * 존재 근거를 실 Postgres 에게 직접 묻는다
 * (`spec/conventions/secret-store.md §2.1` · `plan/in-progress/backend-lint-gate-broken-on-main.md`).
 *
 * ## 왜 e2e 인가
 *
 * 단위 스위트(`src/modules/secret-store/secret-resolver.service.spec.ts`)의 in-memory
 * repository 는 삭제 대상을 `startsWith` 로 고른다. `_`·`%` 가 섞인 패턴에서 그 근사는
 * 실제보다 **적게** 지우므로, 가드가 막으려는 과다삭제를 재현하기는커녕 정반대로 움직인다
 * — "가드가 없으면 실 Postgres 가 과다삭제한다" 가 그 스위트에서는 주석으로만 서 있었다
 * (`#1109` ai-review INFO 7).
 *
 * mock 에 LIKE 해석기를 심는 선택지는 버렸다. **테스트가 DB 를 흉내 내다 틀릴** 새 위험을
 * 만드는 쪽이고, 그렇게 얻는 확신은 결국 "내가 구현한 LIKE" 에 대한 것이다. 여기서는 흉내
 * 내지 않고 진짜 Postgres 에 같은 형태의 쿼리를 던진다.
 *
 * ## 이 스펙이 덮지 않는 것 (알려진 경계)
 *
 * 서비스는 러너 프로세스 밖(backend 컨테이너)에 있어 여기서 직접 호출할 수 없다. 그래서
 * 이 스펙은 **DB 의 의미론**만 고정하고, 그 의미론이 `deleteByPrefix` 에 실제로 적용된다는
 * 연결 — 쿼리가 `LIKE` 이고 바인딩이 `<prefix>%` 이며 `ESCAPE` 절이 없다는 사실 — 은 단위
 * 스위트가 단언한다. 둘 중 하나가 깨지면 나머지 하나의 전제도 다시 봐야 한다.
 *
 * 또한 이 위험이 **실재하는 이유**가 스키마에 있다: `secret_store` 의 CHECK 제약
 * (`V063__secret_store.sql`)은 ref 의 resourceId 자리를 `[^/]+` 로만 제한해 `_`·`%` 를
 * 허용한다. 즉 "prefix 에 메타문자가 없다" 는 성질은 DB 가 아니라 **애플리케이션 가드만이**
 * 세워 준다.
 */
describe('secret_store prefix 삭제 — LIKE 와일드카드 의미론 (e2e)', () => {
  let db: Client;

  // 다른 스펙의 row 를 건드리지 않도록 모든 ref 를 이 네임스페이스 안에 가둔다.
  // `uniqueName` 산출물은 영숫자·하이픈뿐이라 그 자체가 와일드카드를 품지 않는다.
  const ns = uniqueName('like');
  const workspaceId = randomUUID();
  const scopePattern = `secret://triggers/${ns}-%`;

  // 한 글자만 다른 이웃 리소스 둘 — `_` 하나로 양쪽이 매칭되는 구도를 만든다.
  const refA = `secret://triggers/${ns}-a1/token`;
  const refB = `secret://triggers/${ns}-b1/token`;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.query('DELETE FROM secret_store WHERE ref LIKE $1', [
      scopePattern,
    ]);
    await db.end();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM secret_store WHERE ref LIKE $1', [
      scopePattern,
    ]);
    for (const ref of [refA, refB]) {
      await db.query(
        'INSERT INTO secret_store (ref, workspace_id, encrypted) VALUES ($1, $2, $3)',
        [ref, workspaceId, Buffer.from('ciphertext-placeholder')],
      );
    }
  });

  /** `deleteByPrefix` 가 만드는 것과 같은 형태의 삭제 — 지운 행 수를 돌려준다. */
  async function deleteByLikePattern(pattern: string): Promise<number> {
    const res = await db.query('DELETE FROM secret_store WHERE ref LIKE $1', [
      pattern,
    ]);
    return res.rowCount ?? 0;
  }

  async function survivingRefs(): Promise<string[]> {
    const res = await db.query<{ ref: string }>(
      'SELECT ref FROM secret_store WHERE ref LIKE $1 ORDER BY ref',
      [scopePattern],
    );
    return res.rows.map((r) => r.ref);
  }

  it('가드가 통과시키는 형태 — 메타문자 없는 prefix 는 순수 접두사 일치다', async () => {
    // 이 형태(`secret://triggers/{uuid}/`)가 유일한 프로덕션 호출부의 모양이다.
    const affected = await deleteByLikePattern(`secret://triggers/${ns}-a1/%`);

    expect(affected).toBe(1);
    expect(await survivingRefs()).toEqual([refB]);
  });

  it('`_` 는 임의 1글자다 — 가드가 없으면 이웃 리소스까지 지워진다', async () => {
    // 시드된 어느 ref 에도 `_` 가 리터럴로 없다는 것을 먼저 고정한다. 즉 이 패턴을
    // **리터럴로** 해석하면 대상은 0건이고, 그것이 호출자의 의도다.
    expect([refA, refB].some((ref) => ref.includes('_'))).toBe(false);

    const affected = await deleteByLikePattern(`secret://triggers/${ns}-_1/%`);

    // 의도 0건 vs 실제 2건 — 이 차이가 가드의 존재 이유다. 삭제는 되돌릴 수 없다.
    expect(affected).toBe(2);
    expect(await survivingRefs()).toEqual([]);
  });

  it('`%` 는 임의 문자열이다 — 같은 scope 의 모든 리소스가 지워진다', async () => {
    expect([refA, refB].some((ref) => ref.includes('%'))).toBe(false);

    const affected = await deleteByLikePattern(
      `secret://triggers/${ns}-%/token`,
    );

    expect(affected).toBe(2);
    expect(await survivingRefs()).toEqual([]);
  });
});
