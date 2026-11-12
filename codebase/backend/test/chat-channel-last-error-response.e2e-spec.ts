// 트리거 응답의 `chatChannelLastError` 는 저장된 원문에서 자격 증명 모양만 가린다(NERV Task `CLE-T-H2C1RT`).
// 근거: [채팅 채널 「R-CC-26 마지막 오류 필드는 프로바이더 원문을 싣고 자격 증명 모양만 가린다」](CLE-CHAT-CORE#r-cc-26-마지막-오류-필드는-프로바이더-원문을-싣고-자격-증명-모양만-가린다)
//
// 저장값은 진단에 쓰는 프로바이더 원문이라 그대로 둔다. 가리는 일은 응답을 만들 때
// `TriggersService.sanitizeForResponse` 가 한다. 마스킹 규칙은 단위 테스트(`triggers.service.spec.ts`)가
// 덮고, 이 파일은 단건 조회와 목록 조회의 HTTP 왕복에서 원문이 나가지 않는지를 덮는다.
//
// 오류 원문은 실제 실패로 만들기 어려워 DB 에 직접 쓴다. 문구는 단위 테스트의 사례와 같다.
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

describe('채팅 채널 마지막 오류의 응답 마스킹 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let triggerId: string;

  const authed = (req: request.Test) =>
    req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

  const setStoredLastError = (raw: string) =>
    db.query(
      `UPDATE trigger SET chat_channel_health = 'degraded', chat_channel_last_error = $2 WHERE id = $1`,
      [triggerId, raw],
    );

  const readStoredLastError = async () =>
    (
      await db.query<{ chat_channel_last_error: string | null }>(
        'SELECT chat_channel_last_error FROM trigger WHERE id = $1',
        [triggerId],
      )
    ).rows[0]?.chat_channel_last_error;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('last-error'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('LAST-ERROR'),
    );
    const wf = await authed(request(BASE_URL).post('/api/workflows')).send({
      name: uniqueName('last-error-wf'),
    });
    const created = await authed(request(BASE_URL).post('/api/triggers')).send({
      workflowId: wf.body.data.id as string,
      type: 'webhook',
      name: uniqueName('last-error'),
      endpointPath: crypto.randomUUID(),
      chatChannel: { provider: 'telegram', botToken: '111:e2eLastErrorBot' },
    });
    // 외부 setWebhook 은 e2e 에 mock 이 없어 실패하지만 생성은 성공한다
    // (`chat-channel-trigger-create.e2e-spec.ts` 머리 주석).
    expect(created.status).toBe(201);
    triggerId = created.body.data.id as string;
  }, 60_000);

  afterAll(async () => {
    await db
      .query('DELETE FROM trigger WHERE id = $1', [triggerId])
      .catch(() => undefined);
    await db.end();
  });

  it.each([
    {
      label: '헤더 값에 실린 Bearer 토큰',
      stored:
        'Slack auth.test failed: Headers.append: "Bearer xoxb-AAA\nBBBB" is an invalid header value.',
      secret: 'xoxb-AAA',
      expected:
        'Slack auth.test failed: Headers.append: "***" is an invalid header value.',
    },
    {
      label: '옛 오류 문구에 남은 시크릿 참조',
      stored:
        'Telegram getMe failed: Secret not found: secret://triggers/7b0f2c1e-1111-4222-8333-944455556666/bot-token.v2',
      secret: 'secret://',
      expected: 'Telegram getMe failed: Secret not found: ***',
    },
  ])(
    '$label 은 단건 · 목록 응답에서 가리고 저장값은 원문 그대로다',
    async ({ stored, secret, expected }) => {
      await setStoredLastError(stored);

      const detail = await authed(
        request(BASE_URL).get(`/api/triggers/${triggerId}`),
      );
      const list = await authed(
        request(BASE_URL).get('/api/triggers?limit=100'),
      );

      expect(JSON.stringify(detail.body)).not.toContain(secret);
      expect(JSON.stringify(list.body)).not.toContain(secret);
      expect(detail.status).toBe(200);
      expect(detail.body.data.chatChannelLastError).toBe(expected);
      expect(list.status).toBe(200);
      const row = (
        list.body.data as Array<{ id: string; chatChannelLastError: string }>
      ).find((r) => r.id === triggerId);
      expect(row?.chatChannelLastError).toBe(expected);
      expect(await readStoredLastError()).toBe(stored);
    },
  );

  it('자격 증명 모양이 없는 프로바이더 오류 코드는 가리지 않는다', async () => {
    const stored = 'Slack chat.postMessage failed: channel_not_found';
    await setStoredLastError(stored);

    const detail = await authed(
      request(BASE_URL).get(`/api/triggers/${triggerId}`),
    );

    expect(detail.status).toBe(200);
    expect(detail.body.data.chatChannelLastError).toBe(stored);
  });
});
