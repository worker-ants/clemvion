import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: `AlertRuleDto.threshold` 가 **wire 에서 문자열**임을 실 HTTP 응답으로 고정한다.
 *
 * ## 왜 e2e 여야 하는가 — 정적 가드가 구조적으로 못 보는 자리
 *
 * `alert_rule.threshold` 는 `numeric(12,4)` 이고 TypeORM 은 이 타입을 정밀도 보존을 위해
 * **문자열**로 준다. 컨트롤러는 엔티티를 그대로 내보내므로 응답의 그 필드도 문자열인데,
 * 2026-09-04 이전의 `AlertRuleDto` 는 `threshold: number` 라고 문서화하고 있었다 — 즉
 * **OpenAPI 만 거짓말을 하고 있었다**(프런트엔드는 이미 읽기 `string`/쓰기 `number` 로
 * 손수 갈라 두었다).
 *
 * 그것을 잡아내라고 세운 `findNumericAsNumber` 가드는 **선언 대 선언**의 정적 비교다 —
 * 엔티티 `@Column` 의 타입 텍스트와 DTO 필드의 타입 텍스트를 맞춰 볼 뿐, 실제 응답이
 * 무엇을 싣는지는 보지 않는다. 컨트롤러(`list`/`create`/`update`)에 반환 타입 표기가 없어
 * `tsc` 도 이 둘을 대조하지 않는다. **런타임에서 한 번 확인해야 축이 닫힌다**
 * (`20_39_25` W4 / `19_43_18` W1).
 *
 * 쓰기(`POST`/`PATCH`)는 `number` 를 받고 읽기는 `string` 을 내주는 **비대칭이 정상**이라는
 * 것까지 함께 고정한다 — 어느 한쪽만 보면 "직렬화가 왕복한다" 는 잘못된 결론이 나온다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('알림 규칙 threshold 의 wire 타입 (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('alert-thr'),
      db,
    );
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('ALR'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  function headers() {
    return {
      Authorization: `Bearer ${ownerToken}`,
      'X-Workspace-Id': workspaceId,
    } as const;
  }

  /**
   * ## 값이 **정수가 아니어야** 분기가 갈린다
   *
   * 처음엔 `10`/`15` 를 보냈다 — 그러면 `Math.round`/`parseInt` 가 끼어들어 정밀도를 잃어도
   * 단언이 전부 통과한다 (`21_25_50` INFO#2). **입력 집합 자체가 커버리지**이므로 소수부
   * 4자리를 가진 값을 쓴다: `numeric(12,4)` 의 scale 을 꽉 채워, 잘리면 반드시 어긋난다.
   */
  const CREATED_THRESHOLD = 12.3456;
  const PATCHED_THRESHOLD = 7.0625;

  it('POST → GET → PATCH 세 응답 모두 threshold 가 문자열이다', async () => {
    // 쓰기는 number 를 받는다 — 비대칭의 한쪽.
    const created = await request(BASE_URL)
      .post('/api/alerts')
      .set(headers())
      .send({
        type: 'failure_rate',
        threshold: CREATED_THRESHOLD,
        channel: 'in_app',
      });
    expect(created.status).toBe(201);

    const createdRule = created.body.data as { id: string; threshold: unknown };
    expect(typeof createdRule.threshold).toBe('string');
    // 값도 확인한다 — 타입만 보면 무엇을 담아도 통과하는 공허한 단언이 된다.
    expect(Number(createdRule.threshold)).toBe(CREATED_THRESHOLD);

    // GET 은 **DB 를 다시 읽는다** — POST/PATCH 응답은 저장 직후의 in-memory 엔티티라
    // 문자열이긴 해도 컬럼 scale 이 실려 있지 않을 수 있다. `numeric(12,4)` 가 wire 까지
    // 온다는 주장은 이 자리에서만 강하게 물을 수 있다.
    const listed = await request(BASE_URL).get('/api/alerts').set(headers());
    expect(listed.status).toBe(200);
    const rows = listed.body.data as Array<{ id: string; threshold: unknown }>;
    const mine = rows.find((r) => r.id === createdRule.id);
    expect(mine).toBeDefined();
    expect(typeof mine?.threshold).toBe('string');
    // 소수부까지 정확히 왕복한다 — scale 4 를 꽉 채운 값이라 반올림·절삭이 있으면 어긋난다.
    expect(mine?.threshold).toBe('12.3456');

    const patched = await request(BASE_URL)
      .patch(`/api/alerts/${createdRule.id}`)
      .set(headers())
      .send({ threshold: PATCHED_THRESHOLD });
    expect(patched.status).toBe(200);
    const patchedRule = patched.body.data as { threshold: unknown };
    expect(typeof patchedRule.threshold).toBe('string');
    expect(Number(patchedRule.threshold)).toBe(PATCHED_THRESHOLD);

    // PATCH 뒤에도 DB 를 다시 읽어 확인한다 — 위 단언은 in-memory 값이라 저장 경로에서
    // 정밀도가 깎여도 통과한다.
    const relisted = await request(BASE_URL).get('/api/alerts').set(headers());
    const updated = (
      relisted.body.data as Array<{ id: string; threshold: unknown }>
    ).find((r) => r.id === createdRule.id);
    expect(updated?.threshold).toBe('7.0625');
  }, 60_000);
});
