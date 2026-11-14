import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';
import { randomUUID } from 'crypto';

import { createDbClient, uniqueEmail } from './helpers/db';
import { TEST_PASSWORD, registerAndLogin } from './helpers/auth';
import { raceUnderHeldLock } from './helpers/concurrency';

/**
 * e2e: 동시 WebAuthn credential 삭제 — 이 결함 클래스의 **아홉 번째이자 마지막** 짝.
 *
 * 삭제는 2026-11-14 부터 `POST …/credentials/:id/delete { password }` 다(CLE-T-Q6E11N). 비밀번호
 * 확인은 삭제 트랜잭션 전에 끝나므로 아래 겹침은 그대로 만들어진다.
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
 * 현재 판정 경로는 이렇다. `deleteCredential` 은 사용자 행을 잠근 트랜잭션 안에서 대상을 다시
 * 조회하고, 지는 요청은 그 조회(`findOne`)에서 404 를 받는다. 인증 중 counter 역행 삭제도 같은
 * 잠금을 거친다(CLE-T-HQQNEA). DELETE 의 `affected === 0` 은 잠금을 거치지 않는 삭제가 새로 생길 때를
 * 대비한 보조 판정이다.
 *
 * 판별력: 잠금과 재조회가 없던 코드는 **둘 다 204** 를 돌려주고 감사 행이 **2** 가 된다.
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
        .post(`/api/auth/2fa/webauthn/credentials/${targetId}/delete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ password: TEST_PASSWORD })
        .then(
          (res) => ({ status: res.status, code: res.body?.error?.code }),
          () => ({ status: -1, code: undefined as string | undefined }),
        );

    // 먼저 사용자 행을 잠근 요청은 DELETE 에서 이 락을 기다리고, 다른 요청은 그 사용자 행 잠금을
    // 기다린다. 공허성 가드(겹침을 실제로 만들었는가)는 헬퍼가 건다 — `helpers/concurrency.ts`.
    const results = (
      await raceUnderHeldLock<{ status: number; code?: string }>(
        locker,
        {
          sql: 'SELECT id FROM webauthn_credential WHERE id = $1 FOR UPDATE',
          params: [targetId],
        },
        [fireDelete, fireDelete],
      )
    ).sort((a, b) => a.status - b.status);

    // 하나는 지우고(204), 다른 하나는 이미 없다(404 WEBAUTHN_CREDENTIAL_NOT_FOUND).
    expect(results.map((r) => r.status)).toEqual([204, 404]);
    expect(results[1].code).toBe('WEBAUTHN_CREDENTIAL_NOT_FOUND');

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
   * WARNING #4 반증(review/code/2026/09/21/18_03_54) — 서로 **다른** credential 두 개를 동시에
   * 지우면 두 개수 확인이 서로 상대의 커밋 전 상태를 읽어 **둘 다** `remaining === 1` 로 보고,
   * `webauthn_recovery_codes` 가 NULL 로 바뀌지 않을 수 있다는 지적이었다.
   *
   * 2026-11-14 부터 `deleteCredential` 은 사용자 행을 잠근 트랜잭션 안에서 조회 · 삭제 · 개수
   * 확인 · 복구 코드 비우기를 한다(CLE-T-9KCQ7Y). 같은 사용자의 두 삭제는 차례로 돌고, 나중
   * 요청은 앞 요청이 커밋한 뒤에 세므로 0 을 본다. 그래서 복구 코드는 NULL 로 수렴한다.
   * 그 전에는 트랜잭션이 없어 각 DELETE 가 바로 커밋되는 순서 논증으로 같은 결론을 냈다.
   *
   * **이 테스트는 두 요청이 실제로 겹칠 때만 검증력이 있다.** `locker` 가 A · B 두 행을
   * `FOR UPDATE` 로 잠그면 먼저 사용자 행을 잠근 요청은 자기 DELETE 에서, 다른 요청은 사용자 행
   * 잠금에서 기다린다. 공허성 가드가 "락을 놓기 전엔 둘 다 끝나지 않았다"를 단언한다.
   * 사용자 행 잠금을 빼면 두 트랜잭션이 서로의 커밋 전 상태를 읽어 이 테스트가 RED 가 될 수 있다.
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
        .post(`/api/auth/2fa/webauthn/credentials/${id}/delete`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ password: TEST_PASSWORD })
        .then(
          (res) => ({ status: res.status }),
          () => ({ status: -1 }),
        );

    // 두 행을 모두 잠근다. 먼저 사용자 행을 잠근 요청은 자기 DELETE 에서 이 락을 기다리고,
    // 다른 요청은 사용자 행 잠금을 기다린다. 락을 놓으면 둘이 차례로 돈다.
    // 공허성 가드(겹침을 실제로 만들었는가)는 헬퍼가 건다 — `helpers/concurrency.ts`.
    const results = (
      await raceUnderHeldLock(
        locker,
        {
          sql: 'SELECT id FROM webauthn_credential WHERE id = ANY($1::uuid[]) FOR UPDATE',
          params: [[idA, idB]],
        },
        [() => fireDelete(idA), () => fireDelete(idB)],
      )
    ).sort((a, b) => a.status - b.status);

    // 서로 다른 credential 이라 소유권 충돌 없이 둘 다 지운다(둘 다 204).
    expect(results.map((r) => r.status)).toEqual([204, 204]);

    const after = await db.query<{ codes: string[] | null }>(
      `SELECT webauthn_recovery_codes AS codes FROM "user" WHERE id = $1`,
      [otherUserId],
    );
    expect(after.rows[0].codes).toBeNull();
  }, 60_000);
});
