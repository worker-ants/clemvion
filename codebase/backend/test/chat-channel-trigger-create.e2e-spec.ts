import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: 트리거 생성 multi-provider 진입 — POST /api/triggers 의 chat-channel 분기.
 *
 * SoT:
 *   - spec/4-nodes/7-trigger/providers/_overview.md §1 (v1 supported: telegram/slack/discord)
 *   - spec/conventions/secret-store.md §5.5 (b) provider-issued plaintext 흐름
 *   - spec/4-nodes/7-trigger/providers/{slack,discord}.md §6
 *   - plan/in-progress/trigger-create-multi-provider-ui.md Commit 5
 *
 * 본 e2e 는 POST /api/triggers 의 DTO 진입 가드 + service 의 provider 분기 검증.
 * 외부 API (auth.test / GET /applications/@me / Telegram setWebhook) 는 e2e mock 이
 * 없으므로 호출 시 chatChannelHealth=degraded 로 떨어지지만 trigger 생성 자체는
 * 성공 (CCH-SE-01 — 자동 비활성화 X). 본 e2e 의 관심사는 진입 가드의 status code +
 * 응답 sanitize.
 *
 * inbound HTTP 흐름 검증은 chat-channel-{slack,discord}.e2e-spec.ts 별 e2e 가 담당.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const SLACK_SIGNING_SECRET_HEX32 = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const DISCORD_PUBLIC_KEY_HEX64 =
  'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

describe('POST /api/triggers — chat-channel multi-provider (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  const createdTriggerIds: string[] = [];

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('chat-mp'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('CHATMP'),
    );

    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('chat-mp-wf') });
    workflowId = wf.body.data.id;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  function postTrigger(body: Record<string, unknown>) {
    return request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send(body);
  }

  function uniqueEndpoint(label: string): string {
    return `e2e-mp-${label}-${crypto.randomBytes(8).toString('hex')}`;
  }

  describe('telegram — server-issued inboundSigning (회귀)', () => {
    it('telegram trigger 생성 → 201 + hasBotToken=true + plaintext strip', async () => {
      const res = await postTrigger({
        workflowId,
        type: 'webhook',
        name: uniqueName('hook-tg'),
        endpointPath: uniqueEndpoint('tg'),
        config: {
          chatChannel: {
            provider: 'telegram',
            botToken: '111:e2eTelegramBotToken',
          },
        },
      });
      expect(res.status).toBe(201);
      const trigger = res.body.data as {
        id: string;
        config: { chatChannel: Record<string, unknown> };
      };
      createdTriggerIds.push(trigger.id);

      const chatChannel = trigger.config.chatChannel;
      expect(chatChannel.provider).toBe('telegram');
      expect(chatChannel.hasBotToken).toBe(true);
      // plaintext / ref 는 응답에 절대 없어야 함 (sanitizeChatChannelForResponse).
      expect(chatChannel).not.toHaveProperty('botToken');
      expect(chatChannel).not.toHaveProperty('botTokenRef');
      expect(chatChannel).not.toHaveProperty('inboundSigningRef');
      expect(chatChannel).not.toHaveProperty('inboundSigning');
      expect(chatChannel).not.toHaveProperty('inboundSigningPlaintext');
    });

    it('telegram + inboundSigningPlaintext 입력 → 400 (server-issued 만)', async () => {
      const res = await postTrigger({
        workflowId,
        type: 'webhook',
        name: uniqueName('hook-tg-bad'),
        endpointPath: uniqueEndpoint('tg-bad'),
        config: {
          chatChannel: {
            provider: 'telegram',
            botToken: '111:bad',
            inboundSigningPlaintext: SLACK_SIGNING_SECRET_HEX32,
          },
        },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual({
        field: 'inboundSigningPlaintext',
      });
    });
  });

  describe('slack — provider-issued signing secret hex32', () => {
    it('valid plaintext → 201 + hasBotToken=true + plaintext strip', async () => {
      const res = await postTrigger({
        workflowId,
        type: 'webhook',
        name: uniqueName('hook-sl'),
        endpointPath: uniqueEndpoint('sl'),
        config: {
          chatChannel: {
            provider: 'slack',
            botToken: 'xoxb-e2e-slack-token',
            inboundSigningPlaintext: SLACK_SIGNING_SECRET_HEX32,
          },
        },
      });
      // 외부 API (auth.test) mock 없으므로 setupChannel 실패 → degraded health.
      // 그러나 trigger 자체는 생성됨 (CCH-SE-01). 응답 201.
      expect(res.status).toBe(201);
      const trigger = res.body.data as {
        id: string;
        config: { chatChannel: Record<string, unknown> };
      };
      createdTriggerIds.push(trigger.id);

      expect(trigger.config.chatChannel.provider).toBe('slack');
      expect(trigger.config.chatChannel.hasBotToken).toBe(true);
      expect(trigger.config.chatChannel).not.toHaveProperty(
        'inboundSigningPlaintext',
      );
      expect(trigger.config.chatChannel).not.toHaveProperty(
        'inboundSigningRef',
      );
    });

    it('plaintext 누락 → 400', async () => {
      const res = await postTrigger({
        workflowId,
        type: 'webhook',
        name: uniqueName('hook-sl-miss'),
        endpointPath: uniqueEndpoint('sl-miss'),
        config: {
          chatChannel: {
            provider: 'slack',
            botToken: 'xoxb-e2e-slack-token',
          },
        },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual({
        field: 'inboundSigningPlaintext',
      });
    });

    it('잘못된 hex32 형식 → 400', async () => {
      const res = await postTrigger({
        workflowId,
        type: 'webhook',
        name: uniqueName('hook-sl-bad'),
        endpointPath: uniqueEndpoint('sl-bad'),
        config: {
          chatChannel: {
            provider: 'slack',
            botToken: 'xoxb-e2e-slack-token',
            inboundSigningPlaintext: 'not-hex-32-chars',
          },
        },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual({
        field: 'inboundSigningPlaintext',
      });
    });
  });

  describe('discord — provider-issued ed25519 public key hex64', () => {
    it('valid plaintext → 201 + hasBotToken=true', async () => {
      const res = await postTrigger({
        workflowId,
        type: 'webhook',
        name: uniqueName('hook-dc'),
        endpointPath: uniqueEndpoint('dc'),
        config: {
          chatChannel: {
            provider: 'discord',
            botToken: 'discord-e2e-bot-token',
            inboundSigningPlaintext: DISCORD_PUBLIC_KEY_HEX64,
          },
        },
      });
      expect(res.status).toBe(201);
      const trigger = res.body.data as {
        id: string;
        config: { chatChannel: Record<string, unknown> };
      };
      createdTriggerIds.push(trigger.id);

      expect(trigger.config.chatChannel.provider).toBe('discord');
      expect(trigger.config.chatChannel.hasBotToken).toBe(true);
      expect(trigger.config.chatChannel).not.toHaveProperty(
        'inboundSigningPlaintext',
      );
    });

    it('잘못된 hex64 형식 (32만 입력) → 400', async () => {
      const res = await postTrigger({
        workflowId,
        type: 'webhook',
        name: uniqueName('hook-dc-bad'),
        endpointPath: uniqueEndpoint('dc-bad'),
        config: {
          chatChannel: {
            provider: 'discord',
            botToken: 'discord-e2e-bot-token',
            inboundSigningPlaintext: SLACK_SIGNING_SECRET_HEX32, // 32 chars only
          },
        },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual({
        field: 'inboundSigningPlaintext',
      });
    });
  });

  describe('DTO enum 가드', () => {
    it('미등록 provider (e.g. whatsapp) → 400', async () => {
      const res = await postTrigger({
        workflowId,
        type: 'webhook',
        name: uniqueName('hook-bad-provider'),
        endpointPath: uniqueEndpoint('bad'),
        config: {
          chatChannel: {
            provider: 'whatsapp',
            botToken: 'fake',
          },
        },
      });
      expect(res.status).toBe(400);
    });
  });
});
