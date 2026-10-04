// 트리거 `config` JSONB 안의 시크릿 참조가 다른 트리거의 비밀을 가리키지 못하게 막는다(NERV Task `CLE-T-M9QKKX`).
// 근거: [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)
// 근거: [트리거 관리 「PATCH 본문 계약」](CLE-TRIG-MANAGE#patch-본문-계약)
// 판정 표는 `trigger-config-internal-fields.spec.ts` 가 덮는다.
//
// `chatChannel.botTokenRef` · `chatChannel.inboundSigningRef` · `notification.signing.secretRef` 는
// `secret://triggers/<triggerId>/…` 문자열이다. 타입 필드 `chatChannel` 은 이 키들을 막지만
// 원시 `config` 는 `@IsObject` 뿐이라 그대로 저장됐다. 시크릿 저장소의 `resolve` · `rotate` 는 참조만
// 보고 워크스페이스를 확인하지 않는다. 그래서 다른 워크스페이스 트리거의 id 를 아는 사용자가 자기
// 트리거에 그 참조를 심고 봇 토큰을 재발급하면 상대 트리거의 토큰을 덮어쓸 수 있었다.
//
// 공격 순서를 그대로 밟고 **피해 단언(상대의 `secret_store` 행이 그대로인가)을 상태 코드 단언보다
// 먼저** 둔다. 고치기 전 코드에서는 이 파일이 피해를 측정값으로 보여 주며 RED 였다(피해자 행의
// `workspace_id` 가 공격자 워크스페이스로 바뀌었다).
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

interface SecretRow {
  workspace_id: string;
  encrypted: Buffer;
}

interface Actor {
  token: string;
  workspaceId: string;
  workflowId: string;
}

describe('트리거 config 안의 시크릿 참조 (e2e)', () => {
  let db: Client;
  let victim: Actor;
  let attacker: Actor;
  let victimTriggerId: string;
  let victimBotTokenRef: string;
  const createdTriggerIds: string[] = [];

  async function setupActor(label: string): Promise<Actor> {
    const owner = await registerAndLogin(BASE_URL, uniqueEmail(label), db);
    const workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName(label.toUpperCase()),
    );
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName(`${label}-wf`) });
    return {
      token: owner.accessToken,
      workspaceId,
      workflowId: wf.body.data.id as string,
    };
  }

  function api(actor: Actor) {
    return {
      post: (path: string, body: Record<string, unknown>) =>
        request(BASE_URL)
          .post(path)
          .set('Authorization', `Bearer ${actor.token}`)
          .set('X-Workspace-Id', actor.workspaceId)
          .send(body),
      patch: (path: string, body: Record<string, unknown>) =>
        request(BASE_URL)
          .patch(path)
          .set('Authorization', `Bearer ${actor.token}`)
          .set('X-Workspace-Id', actor.workspaceId)
          .send(body),
    };
  }

  /** 시크릿 행을 읽는다. 없으면 전제가 깨진 것이라 바로 실패한다. */
  async function mustReadSecret(ref: string): Promise<SecretRow> {
    const r = await db.query<SecretRow>(
      'SELECT workspace_id, encrypted FROM secret_store WHERE ref = $1',
      [ref],
    );
    if (!r.rows[0]) throw new Error(`secret_store 에 ${ref} 행이 없다`);
    return r.rows[0];
  }

  /** 피해자 봇 토큰 행이 그대로(같은 워크스페이스 · 같은 암호문)인지 본다. */
  async function expectVictimTokenUntouched(before: SecretRow) {
    const after = await mustReadSecret(victimBotTokenRef);
    expect(after.workspace_id).toBe(victim.workspaceId);
    expect(after.encrypted.equals(before.encrypted)).toBe(true);
  }

  /** 공격자 트리거를 만들고 성공했으면 정리 목록에 넣는다. */
  async function attackerCreate(body: Record<string, unknown>) {
    const res = await api(attacker).post('/api/triggers', {
      workflowId: attacker.workflowId,
      type: 'webhook',
      name: uniqueName('attacker-trigger'),
      endpointPath: crypto.randomUUID(),
      ...body,
    });
    if (res.status === 201) createdTriggerIds.push(res.body.data.id as string);
    return res;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    victim = await setupActor('ref-victim');
    attacker = await setupActor('ref-attacker');

    // 피해자 트리거. 생성 때 봇 토큰이 시크릿 저장소에 들어간다(외부 setWebhook 은 e2e 에 mock 이
    // 없어 실패하지만 생성은 성공한다 — chat-channel-trigger-create.e2e-spec.ts 머리 주석).
    const res = await api(victim).post('/api/triggers', {
      workflowId: victim.workflowId,
      type: 'webhook',
      name: uniqueName('victim-trigger'),
      endpointPath: crypto.randomUUID(),
      chatChannel: { provider: 'telegram', botToken: '111:e2eVictimBotToken' },
    });
    expect(res.status).toBe(201);
    victimTriggerId = res.body.data.id as string;
    createdTriggerIds.push(victimTriggerId);
    victimBotTokenRef = `secret://triggers/${victimTriggerId}/bot-token`;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  it('[전제] 피해자의 봇 토큰이 피해자 워크스페이스 소유로 저장돼 있다', async () => {
    const row = await mustReadSecret(victimBotTokenRef);
    expect(row.workspace_id).toBe(victim.workspaceId);
  });

  it('생성: config 에 다른 트리거의 botTokenRef 를 심어도 그 비밀을 재발급할 수 없다', async () => {
    const before = await mustReadSecret(victimBotTokenRef);

    const created = await attackerCreate({
      config: {
        chatChannel: { provider: 'telegram', botTokenRef: victimBotTokenRef },
      },
    });
    // 고치기 전에는 201 이었다. 그때의 피해를 재려고 재발급까지 밟는다(고친 뒤에는 이 분기를 타지 않는다).
    if (created.status === 201) {
      await api(attacker).post(
        `/api/triggers/${created.body.data.id as string}/chat-channel/rotate-bot-token`,
        { newBotToken: '222:e2eAttackerBotToken' },
      );
    }

    await expectVictimTokenUntouched(before);
    expect(created.status).toBe(400);
    expect(created.body.error.code).toBe('VALIDATION_ERROR');
    expect(created.body.error.details).toEqual({
      field: 'config.chatChannel.botTokenRef',
      code: 'INVALID_FIELD',
    });
  });

  it('수정: PATCH config 로 다른 트리거의 botTokenRef 를 심어도 그 비밀을 재발급할 수 없다', async () => {
    const plain = await attackerCreate({ config: {} });
    expect(plain.status).toBe(201);
    const attackerTriggerId = plain.body.data.id as string;
    const before = await mustReadSecret(victimBotTokenRef);

    const patched = await api(attacker).patch(
      `/api/triggers/${attackerTriggerId}`,
      {
        config: {
          chatChannel: { provider: 'telegram', botTokenRef: victimBotTokenRef },
        },
      },
    );
    // 고치기 전에는 200 이었다(위 생성 케이스와 같은 이유로 재발급까지 밟는다).
    if (patched.status === 200) {
      await api(attacker).post(
        `/api/triggers/${attackerTriggerId}/chat-channel/rotate-bot-token`,
        { newBotToken: '333:e2eAttackerBotToken' },
      );
    }

    await expectVictimTokenUntouched(before);
    expect(patched.status).toBe(400);
    expect(patched.body.error.details).toEqual({
      field: 'config.chatChannel.botTokenRef',
      code: 'INVALID_FIELD',
    });
  });

  // 둘째 방어선: 저장 경계가 막기 전에 이미 저장된 행. 재발급이 저장된 참조 대신 자기 트리거 id 로
  // 참조를 만들므로 피해자 비밀에 닿지 않는다.
  it('이미 저장된 행에 다른 트리거의 botTokenRef 가 있어도 재발급은 그 비밀에 닿지 않는다', async () => {
    const created = await attackerCreate({
      chatChannel: {
        provider: 'telegram',
        botToken: '444:e2eAttackerOwnToken',
      },
    });
    expect(created.status).toBe(201);
    const attackerTriggerId = created.body.data.id as string;
    await db.query(
      `UPDATE trigger SET config = jsonb_set(config, '{chatChannel,botTokenRef}', to_jsonb($2::text))
       WHERE id = $1`,
      [attackerTriggerId, victimBotTokenRef],
    );
    const before = await mustReadSecret(victimBotTokenRef);

    // setWebhook 은 e2e 에 mock 이 없어 502 로 끝나지만 비밀 쓰기는 그 전에 일어난다.
    await api(attacker).post(
      `/api/triggers/${attackerTriggerId}/chat-channel/rotate-bot-token`,
      { newBotToken: '555:e2eAttackerBotToken' },
    );

    await expectVictimTokenUntouched(before);
    const own = await mustReadSecret(
      `secret://triggers/${attackerTriggerId}/bot-token`,
    );
    expect(own.workspace_id).toBe(attacker.workspaceId);
  });

  it.each([
    [
      'config.chatChannel.inboundSigningRef',
      (ref: string) => ({
        chatChannel: { provider: 'slack', inboundSigningRef: ref },
      }),
    ],
    // 평문도 원시 config 에서는 제거되지 않아 JSONB 에 남는다.
    [
      'config.chatChannel.botToken',
      () => ({
        chatChannel: { provider: 'telegram', botToken: '111:e2ePlainToken' },
      }),
    ],
    [
      'config.notification.signing.secretRef',
      (ref: string) => ({
        notification: {
          url: 'https://example.com/hook',
          signing: { secretRef: ref },
        },
      }),
    ],
  ])('생성: %s 를 실으면 400', async (field, buildConfig) => {
    const ref = `secret://triggers/${victimTriggerId}/inbound-signing`;
    const res = await attackerCreate({ config: buildConfig(ref) });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ field, code: 'INVALID_FIELD' });
  });

  // 원시 config 로 chatChannel 을 붙이는 경로 자체는 이 Task 밖이다(NERV Task `CLE-T-EA7B5M`). 그래서
  // 양성 사례는 chatChannel 없는 config 로 고정한다.
  it('내부 필드가 없는 config 는 생성 · 수정 모두 그대로 받는다', async () => {
    const created = await attackerCreate({
      config: { custom: { note: 'created' } },
    });
    expect(created.status).toBe(201);
    const patched = await api(attacker).patch(
      `/api/triggers/${created.body.data.id as string}`,
      { config: { custom: { note: 'kept' } } },
    );
    expect(patched.status).toBe(200);
    expect(patched.body.data.config.custom).toEqual({ note: 'kept' });
  });
});
