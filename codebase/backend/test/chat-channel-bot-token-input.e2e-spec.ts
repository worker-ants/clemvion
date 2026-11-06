// 봇 토큰 입력은 1~256자의 보이는 ASCII(U+0021~U+007E)만 받는다(NERV Task `CLE-T-FX354C`).
// 근거: [채팅 채널 「R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다」](CLE-CHAT-CORE#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다)
//
// 공백 · 제어 문자 · ASCII 밖 문자가 든 토큰은 `Authorization` 헤더에 실을 수 없어 fetch 가 요청을 만들지
// 못했다. 생성은 그 전에 시크릿을 저장했고 재발급은 502 `CHAT_CHANNEL_SETUP_FAILED` 였다. 이제 두 경로 모두
// 시크릿을 건드리기 전에 400 으로 거부한다. 재발급 거부는 저장된 봇 토큰 행이 그대로인지(같은 암호문)와
// 유예 백업(v2) 행이 생기지 않았는지까지 본다. 응답에 입력 토큰이 실리지 않는지도 본다.
//
// 이 파일도 `secret_store` 행을 만들고 raw `DELETE FROM trigger` 로는 지워지지 않는다. 그 고아 행이
// 무해한 이유는 `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 주석이 정본이다.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('채팅 채널 봇 토큰 입력 형식 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  let triggerId: string;
  const createdTriggerIds: string[] = [];

  const post = (path: string, body: Record<string, unknown>) =>
    request(BASE_URL)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send(body);

  const createTrigger = async (botToken: string) => {
    const res = await post('/api/triggers', {
      workflowId,
      type: 'webhook',
      name: uniqueName('bot-token-input'),
      endpointPath: crypto.randomUUID(),
      chatChannel: { provider: 'telegram', botToken },
    });
    if (res.status === 201) createdTriggerIds.push(res.body.data.id as string);
    return res;
  };

  const readSecret = async (ref: string) =>
    (
      await db.query<{ encrypted: Buffer }>(
        'SELECT encrypted FROM secret_store WHERE ref = $1',
        [ref],
      )
    ).rows[0];

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('bot-token-input'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('BOT-TOKEN-INPUT'),
    );
    const wf = await post('/api/workflows', {
      name: uniqueName('bot-token-input-wf'),
    });
    workflowId = wf.body.data.id as string;

    // 재발급 대상 트리거. 외부 setWebhook 은 e2e 에 mock 이 없어 실패하지만 생성은 성공한다
    // (`chat-channel-trigger-create.e2e-spec.ts` 머리 주석).
    const created = await createTrigger('111:e2eBotTokenInputOriginal');
    expect(created.status).toBe(201);
    triggerId = created.body.data.id as string;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  it.each([
    ['앞 공백', ' 111:e2eLeakProbe'],
    ['줄바꿈', '111:e2e\nLeakProbe'],
    ['ASCII 밖 문자', '111:e2eLeakProbé'],
  ])(
    '생성: 봇 토큰에 %s 이 있으면 400 VALIDATION_ERROR · 트리거를 만들지 않는다',
    async (_label, botToken) => {
      const res = await createTrigger(botToken);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body.error.details)).toContain(
        'chatChannel.botToken',
      );
      expect(JSON.stringify(res.body)).not.toContain('LeakProbe');
    },
  );

  it.each([
    ['앞 공백', ' 222:e2eLeakProbe'],
    ['CR LF', '222:e2e\r\nLeakProbe'],
    ['NUL', '222:e2eLeakProbe\u0000'],
    ['257자', `222:${'L'.repeat(253)}`],
  ])(
    '재발급: newBotToken 에 %s 이 있으면 400 INVALID_BOT_TOKEN · 저장된 토큰 · 유예 백업은 그대로',
    async (_label, newBotToken) => {
      const botTokenRef = `secret://triggers/${triggerId}/bot-token`;
      const v2Ref = `secret://triggers/${triggerId}/bot-token.v2`;
      const before = await readSecret(botTokenRef);
      expect(before).toBeDefined();

      const res = await post(
        `/api/triggers/${triggerId}/chat-channel/rotate-bot-token`,
        { newBotToken },
      );

      // 피해 단언을 상태 코드 단언보다 먼저 둔다 — 거부 위치가 시크릿 쓰기 뒤로 밀리면 여기서 드러난다.
      const after = await readSecret(botTokenRef);
      expect(after.encrypted.equals(before.encrypted)).toBe(true);
      expect(await readSecret(v2Ref)).toBeUndefined();

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_BOT_TOKEN');
      expect(JSON.stringify(res.body)).not.toContain('LeakProbe');
      expect(JSON.stringify(res.body)).not.toContain('LLLL');
    },
  );
});
