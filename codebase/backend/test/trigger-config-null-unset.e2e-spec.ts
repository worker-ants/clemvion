// 트리거 타입 필드 `notification` · `interaction` 의 `null` 해제 계약을 실제 서버 · Postgres 위에서 고정한다
// (NERV Task `CLE-T-73W6NQ`).
// 근거: [트리거 관리 「PATCH 본문 계약」](CLE-TRIG-MANAGE-API#patch-본문-계약)
//
// 두 필드는 키 단위로 병합되므로 `null` 말고는 블록을 지울 방법이 없다. 그래서 `null` 을 거부하지 않고 «해제» 로
// 받는다. 서버는 `null` 을 저장하지 않고 `config` 에서 그 키를 지운다. 세 가지를 본다.
// 1. PATCH `notification: null` 은 저장된 알림 설정 키를 지우고 다른 타입 키(`interaction` 과 토큰)는 그대로 둔다.
// 2. PATCH `interaction: null` 은 인터랙션 설정 키를 지운다. 트리거 단위 토큰도 그 키와 함께 사라진다.
// 3. 이 계약 전에 저장된 `null` 행(DB 에 직접 넣는다)은 옮기지 않는다. 다른 필드만 바꾸는 PATCH 는 그 값을 건드리지 않는다.
//
// 이 파일은 알림 서명 시크릿을 발급하므로 `secret_store` 행을 만들고 raw `DELETE FROM trigger` 로는 지워지지 않는다.
// 그 고아 행이 무해한 이유는 `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 주석이 정본이다.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const NOTIFICATION = {
  url: 'https://hooks.example.com/null-unset-e2e',
  events: ['execution.completed'],
};
const PER_TRIGGER_ON = { enabled: true, tokenStrategy: 'per_trigger' };

interface StoredConfig {
  notification?: unknown;
  interaction?: { triggerToken?: string } | null;
}

describe('트리거 타입 필드의 null 해제 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  const createdTriggerIds: string[] = [];

  function api() {
    return {
      post: (path: string, body: object = {}) =>
        request(BASE_URL)
          .post(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId)
          .send(body),
      patch: (path: string, body: object) =>
        request(BASE_URL)
          .patch(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId)
          .send(body),
      get: (path: string) =>
        request(BASE_URL)
          .get(path)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Workspace-Id', workspaceId),
    };
  }

  async function createTrigger(extra: object): Promise<string> {
    const res = await api().post('/api/triggers', {
      workflowId,
      type: 'webhook',
      name: uniqueName('null-unset'),
      endpointPath: crypto.randomUUID(),
      ...extra,
    });
    expect(res.status).toBe(201);
    const id = res.body.data.id as string;
    createdTriggerIds.push(id);
    return id;
  }

  async function storedConfig(
    triggerId: string,
  ): Promise<{ config: StoredConfig; keys: string[] }> {
    const res = await db.query<{ config: StoredConfig; keys: string[] }>(
      `SELECT config, ARRAY(SELECT jsonb_object_keys(config)) AS keys FROM trigger WHERE id = $1`,
      [triggerId],
    );
    return res.rows[0];
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('trigger-null-unset'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('TRGNUL'),
    );
    const wf = await api().post('/api/workflows', {
      name: uniqueName('trigger-null-unset-wf'),
    });
    workflowId = wf.body.data.id as string;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  it('PATCH notification: null 은 알림 설정 키를 지우고 interaction 과 토큰은 그대로 둔다', async () => {
    const triggerId = await createTrigger({
      notification: NOTIFICATION,
      interaction: PER_TRIGGER_ON,
    });
    const before = await storedConfig(triggerId);
    const issuedToken = before.config.interaction?.triggerToken;
    expect(issuedToken).toMatch(/^itk_/);

    const res = await api().patch(`/api/triggers/${triggerId}`, {
      notification: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('secrets');
    expect(res.body.data.config).not.toHaveProperty('notification');

    const after = await storedConfig(triggerId);
    expect(after.keys).not.toContain('notification');
    expect(after.config.interaction?.triggerToken).toBe(issuedToken);

    const read = await api().get(`/api/triggers/${triggerId}`);
    expect(read.status).toBe(200);
    expect(read.body.data.config).not.toHaveProperty('notification');
  });

  it('PATCH interaction: null 은 인터랙션 설정 키와 트리거 단위 토큰을 지우고 알림 설정은 그대로 둔다', async () => {
    const triggerId = await createTrigger({
      notification: NOTIFICATION,
      interaction: PER_TRIGGER_ON,
    });

    const res = await api().patch(`/api/triggers/${triggerId}`, {
      interaction: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('secrets');
    expect(res.body.data.config).not.toHaveProperty('interaction');

    const after = await storedConfig(triggerId);
    expect(after.keys).not.toContain('interaction');
    expect(after.keys).toContain('notification');
    expect(JSON.stringify(after.config)).not.toContain('itk_');
  });

  it('해제한 뒤 다시 켜면 새 트리거 단위 토큰을 발급한다', async () => {
    const triggerId = await createTrigger({ interaction: PER_TRIGGER_ON });
    const first = (await storedConfig(triggerId)).config.interaction
      ?.triggerToken;

    const cleared = await api().patch(`/api/triggers/${triggerId}`, {
      interaction: null,
    });
    expect(cleared.status).toBe(200);

    const turnedOn = await api().patch(`/api/triggers/${triggerId}`, {
      interaction: PER_TRIGGER_ON,
    });
    expect(turnedOn.status).toBe(200);
    const reissued = turnedOn.body.data.secrets?.interactionToken as string;
    expect(reissued).toMatch(/^itk_/);
    expect(reissued).not.toBe(first);
  });

  it('생성 본문의 null 은 키를 만들지 않는다', async () => {
    const triggerId = await createTrigger({
      notification: null,
      interaction: null,
    });
    const after = await storedConfig(triggerId);
    expect(after.keys).not.toContain('notification');
    expect(after.keys).not.toContain('interaction');
  });

  it('이 계약 전에 저장된 null 행은 옮기지 않고 다른 필드만 바꾸는 PATCH 도 그대로 둔다', async () => {
    const triggerId = await createTrigger({});
    await db.query(
      `UPDATE trigger SET config = config || '{"notification": null, "interaction": null}'::jsonb WHERE id = $1`,
      [triggerId],
    );

    const res = await api().patch(`/api/triggers/${triggerId}`, {
      name: uniqueName('renamed'),
    });
    expect(res.status).toBe(200);

    const after = await storedConfig(triggerId);
    expect(after.keys).toEqual(
      expect.arrayContaining(['notification', 'interaction']),
    );
    expect(after.config.notification).toBeNull();
    expect(after.config.interaction).toBeNull();
  });
});
