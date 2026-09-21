import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { randomUUID } from 'crypto';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin } from './helpers/auth';

/**
 * e2e: 동시 WebAuthn credential DELETE — 이 결함 클래스의 **아홉 번째이자 마지막** 짝.
 *
 * 보호 대상: 두 요청이 겹쳐도 **`user.2fa_disabled` 감사 행은 하나**이고, 진 쪽은 404 를 받는다.
 *
 * **이 자리가 앞선 세 PR 이 「마지막」을 틀리게 만든 원인이다.** 서비스가 이미
 * `credentialRepo.delete({ id })` 를 쓰고 있어 «`remove(entity)` 를 찾자» 는 축으로 안 걸리고,
 * 감사는 서비스가 아니라 **`webauthn.controller.ts`** 가 남기므로 «서비스에서 감사를 찾자» 는
 * 축으로도 안 걸린다. 바꾸는 것도 `remove`→`delete` 가 아니라 **버려지던 `affected` 를 판정에
 * 쓰는 것**이다.
 *
 * credential 은 **SQL 로 직접 INSERT** 한다 — 이 테스트의 대상은 동시 삭제이지 WebAuthn 등록
 * 의식이 아니고, ceremony 를 태우면 fixture 가 주제를 가린다.
 *
 * 겹침은 테스트가 만든다 — `webauthn_credential` 행 자체를 `SELECT … FOR UPDATE` 로 쥔다.
 *
 * 판별력: 고치기 전 코드는 **둘 다 204** 를 돌려주고 감사 행이 **2** 가 된다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('WebAuthn credential delete concurrency (e2e)', () => {
  let db: Client;
  /** 락을 쥐는 쪽 — 요청이 도는 동안 열려 있어야 하므로 별도 커넥션이다. */
  let locker: Client;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('wadel'), db);
    token = owner.accessToken;
    userId = owner.userId;
  }, 60_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('두 DELETE 가 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', async () => {
    // 두 개를 넣는다 — 하나만 넣으면 `remaining === 0` 이 되어 복구 코드 NULL 화 경로가
    // 함께 타고, 그러면 이 테스트가 «감사 중복» 과 «복구 코드 경로» 둘을 동시에 본다.
    // 대상 하나 + 남는 하나로 두면 판별자가 감사 중복 하나로 좁혀진다.
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO webauthn_credential (user_id, credential_id, public_key, device_name)
            VALUES ($1, $2, '\\x00'::bytea, 'target'),
                   ($1, $3, '\\x00'::bytea, 'survivor')
         RETURNING id`,
      [userId, `cred-${randomUUID()}`, `cred-${randomUUID()}`],
    );
    expect(inserted.rows).toHaveLength(2);
    const targetId = inserted.rows[0].id;

    const fireDelete = () =>
      request(BASE_URL)
        .delete(`/api/auth/2fa/webauthn/credentials/${targetId}`)
        .set('Authorization', `Bearer ${token}`)
        .then(
          (res) => ({ status: res.status, code: res.body?.error?.code }),
          () => ({ status: -1, code: undefined as string | undefined }),
        );

    let pending: Promise<{ status: number; code?: string }[]> | undefined;
    await locker.query('BEGIN');
    try {
      await locker.query(
        'SELECT id FROM webauthn_credential WHERE id = $1 FOR UPDATE',
        [targetId],
      );

      // 둘 다 무락 `findOne` + 소유권 비교를 통과한 뒤 DELETE 에서 이 락을 기다린다.
      pending = Promise.all([fireDelete(), fireDelete()]);

      // 공허성 가드 — 락을 놓기 **전에** 둘 다 아직 끝나지 않았음을 관측한다. 먼저 끝났다면 이
      // fixture 는 겹침을 만들지 못한 것이고, 아래 단언은 고치기 전 코드도 통과시킨다.
      const raced = await Promise.race([
        pending.then(() => 'settled' as const),
        new Promise<'pending'>((resolve) =>
          setTimeout(() => resolve('pending'), 1_500),
        ),
      ]);
      expect(raced).toBe('pending');

      await locker.query('COMMIT');
      const results = (await pending).sort((a, b) => a.status - b.status);

      // 하나는 지우고(204), 다른 하나는 이미 없다(404 WEBAUTHN_CREDENTIAL_NOT_FOUND).
      expect(results.map((r) => r.status)).toEqual([204, 404]);
      expect(results[1].code).toBe('WEBAUTHN_CREDENTIAL_NOT_FOUND');
    } finally {
      await locker.query('ROLLBACK').catch(() => undefined);
      await pending?.catch(() => undefined);
    }

    // 감사는 컨트롤러가 남기고 `resourceId` 는 **credential 이 아니라 사용자**다
    // (`resourceType: 'user'`). 대상 credential 은 `details.credentialId` 에 실린다 —
    // 형제들처럼 `resource_id` 로 좁히면 이 자리에서는 틀린다.
    const audits = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_log
        WHERE resource_type = 'user' AND resource_id = $1
          AND action = 'user.2fa_disabled'
          AND details->>'credentialId' = $2`,
      [userId, targetId],
    );
    expect(audits.rows[0].count).toBe('1');
  }, 60_000);

  /**
   * WARNING #4 반증(review/code/2026/09/21/18_03_54) — 리뷰어는 서로 **다른**
   * credential 두 개를 동시에 지우면 두 `countCredentials` 가 서로 상대의 커밋 전
   * 스냅샷을 읽어 **둘 다** `remaining === 1` 로 오판하고, 그 결과 `webauthn_recovery_codes`
   * 가 NULL 화되지 않을 수 있다고 주장했다.
   *
   * 순서상 불가능하다: `deleteCredential` 은 트랜잭션이 없어 각 요청의 DELETE 는 그
   * 자리에서 즉시 커밋되고, 그 뒤에야 자신의 `countCredentials` 가 돈다(delete → count
   * 는 같은 요청 안의 프로그램 순서라 실시간 순서이기도 하다). R1(A 삭제)의 커밋을 t1,
   * count 를 t2(t1<t2), R2(B 삭제)의 커밋을 t3, count 를 t4(t3<t4) 라 하면, 커밋은
   * Postgres WAL 상 전순서이므로 WLOG t1<t3 다. 그러면 R2 의 count(t4>t3>t1) 는 A·B
   * 모두 이미 커밋된 뒤라 반드시 0 을 본다 — 즉 **나중에 커밋하는 쪽이 항상 0 을 본다.**
   * 따라서 최소 한쪽은 반드시 NULL 화를 수행하며, 논쟁이 되는 「둘 다 1 로 오판」은
   * t1<t3 와 t3<t4 와 t4<t1(R2 가 1 을 보려면 A 가 t4 시점에 아직 살아 있어야 함)이
   * 동시에 성립해야 하는 모순이라 발생할 수 없다.
   *
   * **이 논증은 두 요청이 실제로 겹칠 때만 검증력이 있다** — 우연히 순차 처리되면
   * (R1 이 delete+count+update 를 전부 끝낸 뒤 R2 가 시작) 위 산술이 애초에 시험대에
   * 오르지 않고도 테스트가 초록이 될 수 있다(테스트 리뷰,
   * `review/code/2026/09/21/18_31_57/testing.md` WARNING). 그래서 위 첫 번째 `it` 과
   * 같은 기법으로 겹침을 **관측**한다 — `locker` 가 `BEGIN` 후 A·B 두 행을 모두
   * `FOR UPDATE` 로 잠그면, 두 DELETE 요청은 무락 `findOne`·소유권 비교를 통과한 뒤
   * 각자의 `DELETE` 문에서 그 잠금을 기다리며 대기한다 — 이것이 논쟁이 된 인터리빙
   * (둘 다 삭제 전 상태를 관측한 뒤 진행)이고, 아래 공허성 가드가 "락을 놓기 전엔 둘 다
   * 아직 안 끝났음"을 단언해 이 겹침이 실제로 일어났음을 보증한다.
   *
   * 이 테스트는 그 산술을 **겹침을 강제한 상태에서** e2e 로 고정한다 — 통과하면 리뷰어
   * 주장이 반증된 것이고, 누군가 이 메서드를 트랜잭션으로 감싸(delete 를 count 시점까지
   * 커밋 지연) 위 순서 논증의 전제를 깨면 그때 RED 가 되는 캐너리다.
   */
  it('서로 다른 credential 두 개를 동시 삭제해도 복구 코드는 NULL 로 수렴한다 (WARNING #4 반증)', async () => {
    // 위 테스트의 잔존 credential(survivor)과 섞이지 않도록 별도 사용자로 격리한다.
    const other = await registerAndLogin(BASE_URL, uniqueEmail('wadel2'), db);
    const otherToken = other.accessToken;
    const otherUserId = other.userId;

    const inserted = await db.query<{ id: string }>(
      `INSERT INTO webauthn_credential (user_id, credential_id, public_key, device_name)
            VALUES ($1, $2, '\\x00'::bytea, 'a'),
                   ($1, $3, '\\x00'::bytea, 'b')
         RETURNING id`,
      [otherUserId, `cred-${randomUUID()}`, `cred-${randomUUID()}`],
    );
    expect(inserted.rows).toHaveLength(2);
    const [idA, idB] = inserted.rows.map((r) => r.id);

    // 등록 ceremony 를 태우지 않고 복구 코드를 직접 심는다 — 세팅됐음을 먼저
    // 단언해야 아래 NULL 단언이 공허하지 않다.
    await db.query(
      `UPDATE "user" SET webauthn_recovery_codes = ARRAY[$2, $3]::text[] WHERE id = $1`,
      [otherUserId, 'seed-hash-1', 'seed-hash-2'],
    );
    const seeded = await db.query<{ codes: string[] | null }>(
      `SELECT webauthn_recovery_codes AS codes FROM "user" WHERE id = $1`,
      [otherUserId],
    );
    expect(seeded.rows[0].codes).toEqual(['seed-hash-1', 'seed-hash-2']);

    const fireDelete = (id: string) =>
      request(BASE_URL)
        .delete(`/api/auth/2fa/webauthn/credentials/${id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .then(
          (res) => ({ status: res.status }),
          () => ({ status: -1 }),
        );

    let pending: Promise<{ status: number }[]> | undefined;
    await locker.query('BEGIN');
    try {
      // 두 행을 모두 잠근다 — 공유 락으로 줄 세우는 것이 아니라, A·B 각자의 `DELETE`
      // 가 각자의 행 잠금을 기다리게 만들어 둘을 동시에 대기 상태로 묶는다.
      await locker.query(
        'SELECT id FROM webauthn_credential WHERE id = ANY($1::uuid[]) FOR UPDATE',
        [[idA, idB]],
      );

      // 둘 다 무락 `findOne` + 소유권 비교를 통과한 뒤 각자의 DELETE 에서 이 락을
      // 기다린다 — 이것이 논쟁이 된 인터리빙이다.
      pending = Promise.all([fireDelete(idA), fireDelete(idB)]);

      // 공허성 가드 — 락을 놓기 **전에** 둘 다 아직 끝나지 않았음을 관측한다. 먼저
      // 끝났다면 이 fixture 는 겹침을 만들지 못한 것이고, 아래 단언은 고치기 전
      // 코드도 통과시킨다.
      const raced = await Promise.race([
        pending.then(() => 'settled' as const),
        new Promise<'pending'>((resolve) =>
          setTimeout(() => resolve('pending'), 1_500),
        ),
      ]);
      expect(raced).toBe('pending');

      await locker.query('COMMIT');
      const results = (await pending).sort((a, b) => a.status - b.status);

      // 서로 다른 credential 이라 소유권 충돌 없이 둘 다 지운다(둘 다 204).
      expect(results.map((r) => r.status)).toEqual([204, 204]);
    } finally {
      await locker.query('ROLLBACK').catch(() => undefined);
      await pending?.catch(() => undefined);
    }

    const after = await db.query<{ codes: string[] | null }>(
      `SELECT webauthn_recovery_codes AS codes FROM "user" WHERE id = $1`,
      [otherUserId],
    );
    expect(after.rows[0].codes).toBeNull();
  }, 60_000);
});
