// 트리거 생성 · 수정 본문의 원시 `config` 계약을 실제 Postgres 위에서 고정한다(NERV Task `CLE-T-EA7B5M`).
// 근거: [트리거 관리 「PATCH 본문 계약」](CLE-TRIG-MANAGE#patch-본문-계약)
// 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체)
//
// 두 가지를 본다.
// - 원시 `config` 계약: 타입 키(`notification` · `interaction` · `chatChannel`)와 `secret://` 값은 400 이고, PATCH 는
//   저장된 `config` 위에 최상위 키 단위로 병합한다(값이 `null` 인 키는 지운다). 원시 `config` 만 보낸 PATCH 는
//   저장된 타입 키와 그 안의 서버가 만든 값을 지킨다.
// - 상세 드로어의 외부 인터랙션 카드(`external-interaction-card.tsx`)는 조회 응답의 `notification.signing` 을
//   저장 본문에 그대로 되보낸다. 응답은 `signing.secretRef` 를 지우므로 그 본문에는 참조가 없다. 이 PATCH 뒤에도
//   저장된 참조와 시크릿 저장소의 비밀이 그대로인지 본다(Task 본문 항목 5).
//
// 이 파일도 `secret_store` 행을 만들고 raw `DELETE FROM trigger` 로는 지워지지 않는다. 그 고아 행이
// 무해한 이유는 `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 주석이 정본이다.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { notificationSigningSecretRef } from '../src/modules/triggers/notification-signing-secret-ref';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const NOTIFICATION = {
  url: 'https://hooks.example.com/raw-config-contract',
  events: ['execution.completed'],
};
const PER_TRIGGER_ON = { enabled: true, tokenStrategy: 'per_trigger' };

interface TriggerRow {
  config: Record<string, unknown> & {
    interaction?: { triggerToken?: string };
    notification?: { signing?: { secretRef?: string } };
    chatChannel?: Record<string, unknown>;
  };
}

describe('트리거 원시 config 계약 (e2e)', () => {
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

  async function createTrigger(extra: object) {
    const res = await api().post('/api/triggers', {
      workflowId,
      type: 'webhook',
      name: uniqueName('raw-config'),
      endpointPath: crypto.randomUUID(),
      ...extra,
    });
    if (res.status === 201) createdTriggerIds.push(res.body.data.id as string);
    return res;
  }

  async function readTrigger(triggerId: string): Promise<TriggerRow> {
    const res = await db.query<TriggerRow>(
      'SELECT config FROM trigger WHERE id = $1',
      [triggerId],
    );
    if (!res.rows[0]) throw new Error(`trigger ${triggerId} 행이 없다`);
    return res.rows[0];
  }

  async function readSigningSecretRow(triggerId: string): Promise<Buffer> {
    const res = await db.query<{ encrypted: Buffer }>(
      'SELECT encrypted FROM secret_store WHERE ref = $1',
      [notificationSigningSecretRef(triggerId)],
    );
    if (!res.rows[0])
      throw new Error(`secret_store 에 ${triggerId} 의 서명 비밀 행이 없다`);
    return res.rows[0].encrypted;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('raw-config'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('RAWCFG'),
    );
    const wf = await api().post('/api/workflows', {
      name: uniqueName('raw-config-wf'),
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

  async function triggerExists(endpointPath: string): Promise<boolean> {
    const res = await db.query(
      'SELECT 1 FROM trigger WHERE endpoint_path = $1',
      [endpointPath],
    );
    return (res.rowCount ?? 0) > 0;
  }

  describe('생성 본문의 원시 config', () => {
    it.each([
      ['notification', { notification: NOTIFICATION }],
      ['interaction', { interaction: PER_TRIGGER_ON }],
      ['chatChannel', { chatChannel: { provider: 'telegram' } }],
      ['chatChannel', { chatChannel: null }],
    ])(
      'config.%s 는 값과 상관없이 400 이고 트리거가 생기지 않는다',
      async (key, config) => {
        const endpointPath = crypto.randomUUID();
        const res = await createTrigger({ endpointPath, config });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.details).toEqual({
          field: `config.${key}`,
          code: 'INVALID_FIELD',
        });
        expect(await triggerExists(endpointPath)).toBe(false);
      },
    );

    it('secret:// 로 시작하는 값은 위치와 상관없이 그 경로로 400 이다', async () => {
      const endpointPath = crypto.randomUUID();
      const res = await createTrigger({
        endpointPath,
        config: { custom: { refs: ['plain', 'secret://triggers/x/y'] } },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual({
        field: 'config.custom.refs[1]',
        code: 'INVALID_FIELD',
      });
      // 메시지에 받은 값을 되돌려 싣지 않는다.
      expect(JSON.stringify(res.body)).not.toContain('secret://triggers/x/y');
      expect(await triggerExists(endpointPath)).toBe(false);
    });

    it('내부 필드 · 타입 키 · secret:// 순서로 첫 위반 하나만 보고한다', async () => {
      const internal = await createTrigger({
        config: {
          chatChannel: { provider: 'telegram', botTokenRef: 'secret://x' },
        },
      });
      expect(internal.body.error.details.field).toBe(
        'config.chatChannel.botTokenRef',
      );
      const typed = await createTrigger({
        config: { notification: {}, custom: 'secret://x' },
      });
      expect(typed.body.error.details.field).toBe('config.notification');
    });

    it('타입 키와 secret:// 값이 없으면 받은 그대로 저장한다', async () => {
      const res = await createTrigger({
        config: { custom: { note: 'raw', list: [1, 'two'] } },
      });
      expect(res.status).toBe(201);
      const row = await readTrigger(res.body.data.id as string);
      expect(row.config.custom).toEqual({ note: 'raw', list: [1, 'two'] });
    });
  });

  describe('PATCH 본문의 원시 config — 최상위 키 병합', () => {
    async function createWithServerValues() {
      const created = await createTrigger({
        notification: NOTIFICATION,
        interaction: PER_TRIGGER_ON,
        config: { keep: 'stored', memo: { a: 1 } },
      });
      expect(created.status).toBe(201);
      const triggerId = created.body.data.id as string;
      return {
        triggerId,
        token: created.body.data.secrets.interactionToken as string,
      };
    }

    it('보낸 키만 바꾸고 저장된 타입 키와 서버가 만든 값을 지킨다', async () => {
      const { triggerId, token } = await createWithServerValues();
      const secretBefore = await readSigningSecretRow(triggerId);

      const res = await api().patch(`/api/triggers/${triggerId}`, {
        config: { memo: { b: 2 }, added: true },
      });
      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('secrets');

      const { config } = await readTrigger(triggerId);
      expect(config.keep).toBe('stored');
      // 보낸 키 아래는 병합하지 않고 그 값으로 바꾼다.
      expect(config.memo).toEqual({ b: 2 });
      expect(config.added).toBe(true);
      expect(config.interaction?.triggerToken).toBe(token);
      expect(config.notification?.signing?.secretRef).toBe(
        notificationSigningSecretRef(triggerId),
      );
      expect((await readSigningSecretRow(triggerId)).equals(secretBefore)).toBe(
        true,
      );
    });

    it('값이 null 인 키는 지운다', async () => {
      const { triggerId } = await createWithServerValues();
      const res = await api().patch(`/api/triggers/${triggerId}`, {
        config: { memo: null },
      });
      expect(res.status).toBe(200);
      const { config } = await readTrigger(triggerId);
      expect(config).not.toHaveProperty('memo');
      expect(config.keep).toBe('stored');
    });

    it('config 가 null 이면 보내지 않은 것으로 보고 저장된 config 를 바꾸지 않는다', async () => {
      const { triggerId } = await createWithServerValues();
      const before = (await readTrigger(triggerId)).config;
      const res = await api().patch(`/api/triggers/${triggerId}`, {
        config: null,
      });
      expect(res.status).toBe(200);
      expect((await readTrigger(triggerId)).config).toEqual(before);
    });

    it('저장된 chatChannel 과 그 서명 참조를 지운다면 인바운드 검증이 열리므로 그대로 둔다', async () => {
      const { triggerId } = await createWithServerValues();
      // 채팅 채널 설정은 외부 프로바이더 호출이 있어 생성 대신 저장 행에 직접 둔다. 병합은 타입 키 값을 보지 않는다.
      const chatChannel = {
        provider: 'slack',
        inboundSigningRef: `secret://triggers/${triggerId}/inbound-signing`,
      };
      await db.query(
        `UPDATE trigger SET config = config || jsonb_build_object('chatChannel', $2::jsonb) WHERE id = $1`,
        [triggerId, JSON.stringify(chatChannel)],
      );

      const res = await api().patch(`/api/triggers/${triggerId}`, {
        config: { added: true },
      });
      expect(res.status).toBe(200);
      expect((await readTrigger(triggerId)).config.chatChannel).toEqual(
        chatChannel,
      );
    });

    it.each(['notification', 'interaction', 'chatChannel'])(
      'config.%s 를 실은 PATCH 는 400 이고 저장된 config 가 그대로다',
      async (key) => {
        const { triggerId } = await createWithServerValues();
        const before = (await readTrigger(triggerId)).config;
        const res = await api().patch(`/api/triggers/${triggerId}`, {
          config: { [key]: {}, added: true },
        });
        expect(res.status).toBe(400);
        expect(res.body.error.details).toEqual({
          field: `config.${key}`,
          code: 'INVALID_FIELD',
        });
        expect((await readTrigger(triggerId)).config).toEqual(before);
      },
    );

    it('secret:// 값을 실은 PATCH 는 400 이고 저장된 config 가 그대로다', async () => {
      const { triggerId } = await createWithServerValues();
      const before = (await readTrigger(triggerId)).config;
      const res = await api().patch(`/api/triggers/${triggerId}`, {
        config: { list: [{ ref: 'ok' }, { ref: 'secret://triggers/x/y' }] },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual({
        field: 'config.list[1].ref',
        code: 'INVALID_FIELD',
      });
      expect((await readTrigger(triggerId)).config).toEqual(before);
    });
  });

  describe('외부 인터랙션 카드의 저장 본문', () => {
    // 카드는 조회 응답의 `signing` · `retry` 를 그대로 되보내고 인터랙션 설정을 늘 함께 싣는다.
    // 본문을 만드는 식은 `external-interaction-card.tsx` 의 `saveMutation` 과 같다.
    function cardSaveBody(detail: {
      config?: { notification?: Record<string, unknown> };
    }) {
      const notification = detail.config?.notification ?? {};
      return {
        notification: {
          url: NOTIFICATION.url,
          events: NOTIFICATION.events,
          ...(notification.signing ? { signing: notification.signing } : {}),
          ...(notification.retry ? { retry: notification.retry } : {}),
        },
        interaction: PER_TRIGGER_ON,
      };
    }

    it('응답의 signing 을 되보내도 저장된 secretRef 와 서명 비밀이 그대로다', async () => {
      const created = await createTrigger({
        notification: NOTIFICATION,
        interaction: PER_TRIGGER_ON,
      });
      expect(created.status).toBe(201);
      const triggerId = created.body.data.id as string;
      const ownRef = notificationSigningSecretRef(triggerId);
      expect(
        (await readTrigger(triggerId)).config.notification?.signing?.secretRef,
      ).toBe(ownRef);
      const secretBefore = await readSigningSecretRow(triggerId);

      const detail = await api().get(`/api/triggers/${triggerId}`);
      expect(detail.status).toBe(200);
      // 응답은 참조를 지운다. 그래서 카드가 되보내는 `signing` 에는 참조가 없다.
      expect(
        detail.body.data.config.notification?.signing?.secretRef,
      ).toBeUndefined();

      const res = await api().patch(
        `/api/triggers/${triggerId}`,
        cardSaveBody(detail.body.data),
      );
      expect(res.status).toBe(200);
      // 새로 발급하지 않았으므로 일회성 평문도 없다.
      expect(res.body.data).not.toHaveProperty('secrets');
      expect(
        (await readTrigger(triggerId)).config.notification?.signing?.secretRef,
      ).toBe(ownRef);
      expect((await readSigningSecretRow(triggerId)).equals(secretBefore)).toBe(
        true,
      );
    });
  });
});
