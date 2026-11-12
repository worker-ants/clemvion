// 봇 토큰 재발급이 실패하면 그 요청이 쓴 비밀을 재발급 전 값으로 되돌린다(NERV Task `CLE-T-Q353Y4`).
// 근거: [채팅 데이터 「봇 토큰 라이프사이클」](CLE-CHAT-DATA#봇-토큰-라이프사이클)
//
// 종전엔 되돌리지 않았다. provider 등록이 실패해도 primary 행에는 거부된 새 토큰이 남았고, 유예 백업(v2) 행은
// 트리거의 `chat_channel_token_v2` 가 가리키지 않는 채로 남거나 유예 중이던 옛 토큰을 덮었다.
//
// e2e 에는 provider mock 이 없어 재발급은 늘 4단계(setupChannel)에서 실패한다. 네트워크가 닿으면 provider 가
// 가짜 토큰을 거부해 400 `BOT_TOKEN_INVALID`, 닿지 않으면 502 `CHAT_CHANNEL_SETUP_FAILED` 다. 어느 쪽이든
// 되돌리는 경로는 같다. 상태 코드 변환은 `triggers.service.spec.ts` 가 고정한다.
//
// 되돌린 값은 복호화해서 본다. 같은 평문도 쓸 때마다 IV 가 달라 암호문으로는 비교할 수 없다. 러너는 서버와 같은
// `ENCRYPTION_KEY` 를 받는다(`docker-compose.e2e.yml`).
//
// 이 파일도 `secret_store` 행을 만들고 raw `DELETE FROM trigger` 로는 지워지지 않는다. 그 고아 행이
// 무해한 이유는 `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 주석이 정본이다.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import crypto from 'node:crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import {
  decryptSecret,
  encryptSecret,
  parseMasterKey,
} from '../src/modules/secret-store/secret-crypto';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const ORIGINAL_TOKEN = '111:e2eRotationUndoOriginal';
const NEW_TOKEN = '333:e2eRotationUndoRejected';
const GRACE_TOKEN = '000:e2eRotationUndoGrace';

describe('채팅 채널 봇 토큰 재발급 실패 시 되돌리기 (e2e)', () => {
  let db: Client;
  let key: Buffer;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  const createdTriggerIds: string[] = [];

  const post = (path: string, body: Record<string, unknown>) =>
    request(BASE_URL)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send(body);

  const refsOf = (triggerId: string) => ({
    primary: `secret://triggers/${triggerId}/bot-token`,
    v2: `secret://triggers/${triggerId}/bot-token.v2`,
  });

  /** 행이 없으면 `undefined`. */
  const readPlaintext = async (ref: string): Promise<string | undefined> => {
    const row = (
      await db.query<{ encrypted: Buffer }>(
        'SELECT encrypted FROM secret_store WHERE ref = $1',
        [ref],
      )
    ).rows[0];
    return row ? decryptSecret(key, ref, row.encrypted) : undefined;
  };

  const readRotationColumns = async (triggerId: string) =>
    (
      await db.query<{
        chat_channel_token_v2: string | null;
        chat_channel_rotated_at: Date | null;
      }>(
        'SELECT chat_channel_token_v2, chat_channel_rotated_at FROM trigger WHERE id = $1',
        [triggerId],
      )
    ).rows[0];

  const createTelegramTrigger = async (): Promise<string> => {
    const res = await post('/api/triggers', {
      workflowId,
      type: 'webhook',
      name: uniqueName('rotation-undo'),
      endpointPath: crypto.randomUUID(),
      chatChannel: { provider: 'telegram', botToken: ORIGINAL_TOKEN },
    });
    // 외부 setWebhook 은 e2e 에 mock 이 없어 실패하지만 생성은 성공한다
    // (`chat-channel-trigger-create.e2e-spec.ts` 머리 주석).
    expect(res.status).toBe(201);
    const id = res.body.data.id as string;
    createdTriggerIds.push(id);
    return id;
  };

  const rotate = (triggerId: string) =>
    post(`/api/triggers/${triggerId}/chat-channel/rotate-bot-token`, {
      newBotToken: NEW_TOKEN,
    });

  const expectSetupFailure = (res: request.Response) => {
    const expectedCode: Record<number, string> = {
      400: 'BOT_TOKEN_INVALID',
      502: 'CHAT_CHANNEL_SETUP_FAILED',
    };
    expect(Object.keys(expectedCode)).toContain(String(res.status));
    expect(res.body.error.code).toBe(expectedCode[res.status]);
  };

  beforeAll(async () => {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) {
      throw new Error(
        'ENCRYPTION_KEY 가 없다. docker-compose.e2e.yml 의 backend-e2e-runner 환경을 확인한다.',
      );
    }
    key = parseMasterKey(rawKey);
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('rotation-undo'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('ROTATION-UNDO'),
    );
    const wf = await post('/api/workflows', {
      name: uniqueName('rotation-undo-wf'),
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

  it('유예 백업이 없던 트리거 — 실패하면 primary 는 원래 토큰이고 v2 행은 남지 않는다', async () => {
    const triggerId = await createTelegramTrigger();
    const refs = refsOf(triggerId);
    expect(await readPlaintext(refs.primary)).toBe(ORIGINAL_TOKEN);

    const res = await rotate(triggerId);

    // 피해 단언을 상태 코드 단언보다 먼저 둔다. 되돌리기가 빠지면 상태 코드와 무관하게 여기서 드러난다.
    expect(await readPlaintext(refs.primary)).toBe(ORIGINAL_TOKEN);
    expect(await readPlaintext(refs.v2)).toBeUndefined();
    expect(await readRotationColumns(triggerId)).toEqual({
      chat_channel_token_v2: null,
      chat_channel_rotated_at: null,
    });
    expectSetupFailure(res);
    expect(JSON.stringify(res.body)).not.toContain('e2eRotationUndo');
  });

  it('유예 중이던 트리거 — 실패하면 v2 는 유예 중이던 옛 토큰으로 돌아오고 회전 컬럼은 그대로다', async () => {
    const triggerId = await createTelegramTrigger();
    const refs = refsOf(triggerId);
    // 앞선 재발급이 성공해 유예 중인 상태를 만든다. e2e 에서는 재발급이 성공하지 않아 행을 직접 쓴다.
    const rotatedAt = new Date(Date.now() - 60 * 60 * 1000);
    await db.query(
      'INSERT INTO secret_store (ref, workspace_id, encrypted) VALUES ($1, $2, $3)',
      [refs.v2, workspaceId, encryptSecret(key, refs.v2, GRACE_TOKEN)],
    );
    await db.query(
      'UPDATE trigger SET chat_channel_token_v2 = $2, chat_channel_rotated_at = $3 WHERE id = $1',
      [triggerId, refs.v2, rotatedAt],
    );

    const res = await rotate(triggerId);

    expect(await readPlaintext(refs.primary)).toBe(ORIGINAL_TOKEN);
    expect(await readPlaintext(refs.v2)).toBe(GRACE_TOKEN);
    expect(await readRotationColumns(triggerId)).toEqual({
      chat_channel_token_v2: refs.v2,
      chat_channel_rotated_at: rotatedAt,
    });
    expectSetupFailure(res);
  });
});
