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
});
