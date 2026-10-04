// 이미 저장된 트리거 `config` 의 시크릿 참조를 읽는 쪽이 다른 트리거의 비밀을 쓰지 않는다(NERV Task
// `CLE-T-XYR067`).
// 근거: [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)
//
// `CLE-T-M9QKKX` 가 요청 본문으로 참조를 심는 입력을 막았다. 그 전에 저장된 행에는 다른 트리거의
// 참조(`secret://triggers/<다른 id>/…`)가 남아 있을 수 있다. 시크릿 저장소의 `resolve` 는 참조만 보고
// 소유를 확인하지 않으므로 읽는 쪽이 저장된 값을 그대로 쓰면 그 비밀이 다른 트리거를 위해 쓰인다.
//
// e2e 에는 Slack · Telegram API mock 이 없어 발송 · 해제에 쓰인 토큰은 관측할 수 없다. 그래서 응답으로
// 관측되는 인바운드 서명 검증을 잰다. 피해자 서명 비밀로 서명한 요청을 오염된 공격자 트리거로 보낸다.
// 고치기 전 코드에서는 피해자 비밀로 검증해 통과했다(200). 발송 · 해제 · 알림 서명은 단위 테스트가 덮는다.
//
// 뒤의 세 케이스는 시크릿 저장소의 `rotate` 와 운영 점검 · 정리 SQL(`scripts/ops/2026-10-04-trigger-
// secret-ref-*.sql`)을 실제 스키마에서 잰다. 고치기 전 코드에서는 다른 워크스페이스 소유 행을 rotate 가
// 덮어써 소유가 바뀌었다.
//
// 이 파일도 `secret_store` 행을 만들고 raw `DELETE FROM trigger` 로는 지워지지 않는다. 그 고아 행이
// 무해한 이유는 `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 주석이 정본이다.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client, type QueryResult } from 'pg';
import crypto, { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import { nextE2eClientIp } from './helpers/e2e-client-ip';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const OPS_DIR = path.resolve(__dirname, '../scripts/ops');
/** Slack signing secret 형식(hex 32자). 피해자 트리거만 이 값을 안다. */
const VICTIM_SLACK_SIGNING_SECRET = 'c0ffee00c0ffee00c0ffee00c0ffee00';
/** 참조 자리에 잘못 들어간 평문 흉내. 점검 출력에 나오면 안 된다. */
const PLAINTEXT_IN_SLOT = '123456:e2e-plaintext-in-ref-slot';

interface Actor {
  token: string;
  workspaceId: string;
  workflowId: string;
}

interface CreatedTrigger {
  id: string;
  endpointPath: string;
}

function signSlack(body: string, ts: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
    .update(`v0:${ts}:${body}`)
    .digest('hex');
  return `v0=${hmac}`;
}

describe('저장된 트리거 config 의 시크릿 참조 읽기 (e2e)', () => {
  let db: Client;
  let victim: Actor;
  let attacker: Actor;
  let victimTrigger: CreatedTrigger;
  let poisonedTriggerId: string;
  let plaintextTriggerId: string;
  const createdTriggerIds: string[] = [];

  /** `scripts/ops/` 의 SQL 파일을 그대로 실행하고 문장별 결과를 돌려준다. */
  async function runOpsSql(file: string): Promise<QueryResult[]> {
    const sql = readFileSync(path.join(OPS_DIR, file), 'utf8');
    const result = (await db.query(sql)) as unknown as
      QueryResult | QueryResult[];
    return Array.isArray(result) ? result : [result];
  }

  async function secretWorkspace(ref: string): Promise<string | undefined> {
    const r = await db.query<{ workspace_id: string }>(
      'SELECT workspace_id FROM secret_store WHERE ref = $1',
      [ref],
    );
    return r.rows[0]?.workspace_id;
  }

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

  async function createTrigger(
    actor: Actor,
    body: Record<string, unknown>,
  ): Promise<CreatedTrigger> {
    const endpointPath = crypto.randomUUID();
    const res = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${actor.token}`)
      .set('X-Workspace-Id', actor.workspaceId)
      .send({
        workflowId: actor.workflowId,
        type: 'webhook',
        name: uniqueName('stored-ref-trigger'),
        endpointPath,
        ...body,
      });
    expect(res.status).toBe(201);
    const id = res.body.data.id as string;
    createdTriggerIds.push(id);
    return { id, endpointPath };
  }

  /** 피해자 서명 비밀로 서명한 Slack url_verification 요청을 보낸다. */
  function sendVictimSignedHandshake(endpointPath: string) {
    const challenge = `e2e-challenge-${crypto.randomUUID()}`;
    const body = JSON.stringify({ type: 'url_verification', challenge });
    const ts = String(Math.floor(Date.now() / 1000));
    return request(BASE_URL)
      .post(`/api/hooks/${endpointPath}`)
      .set('x-forwarded-for', nextE2eClientIp())
      .set('content-type', 'application/json')
      .set(
        'x-slack-signature',
        signSlack(body, ts, VICTIM_SLACK_SIGNING_SECRET),
      )
      .set('x-slack-request-timestamp', ts)
      .send(body);
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    victim = await setupActor('stored-ref-victim');
    attacker = await setupActor('stored-ref-attacker');

    // 생성 때 봇 토큰과 서명 비밀이 시크릿 저장소에 들어간다. 외부 등록은 e2e 에 mock 이 없어
    // 실패하지만 생성은 성공한다(chat-channel-trigger-create.e2e-spec.ts 머리 주석).
    victimTrigger = await createTrigger(victim, {
      chatChannel: {
        provider: 'slack',
        botToken: 'xoxb-e2e-victim-token',
        inboundSigningPlaintext: VICTIM_SLACK_SIGNING_SECRET,
      },
    });
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  it('[전제] 피해자 서명 비밀로 서명한 요청은 피해자 트리거에서 통과한다', async () => {
    // 이 단언이 없으면 아래 401 은 서명이 틀려서 나온 것일 수 있다.
    const res = await sendVictimSignedHandshake(victimTrigger.endpointPath);
    expect(res.status).toBe(200);
    expect(res.body.challenge).toEqual(expect.any(String));
  });

  it('오염된 행이 다른 트리거의 inboundSigningRef 를 가리켜도 인바운드 검증에 그 비밀을 쓰지 않는다', async () => {
    const attackerTrigger = await createTrigger(attacker, { config: {} });
    poisonedTriggerId = attackerTrigger.id;
    // 요청 본문으로는 막혔으므로(CLE-T-M9QKKX) SQL 로 그 전에 저장된 행을 흉내 낸다.
    await db.query(
      `UPDATE trigger SET config = jsonb_set(config, '{chatChannel}', $2::jsonb) WHERE id = $1`,
      [
        attackerTrigger.id,
        JSON.stringify({
          provider: 'slack',
          botTokenRef: `secret://triggers/${victimTrigger.id}/bot-token`,
          inboundSigningRef: `secret://triggers/${victimTrigger.id}/inbound-signing`,
        }),
      ],
    );

    const res = await sendVictimSignedHandshake(attackerTrigger.endpointPath);

    // 고치기 전에는 피해자 비밀로 검증해 200 이었다. 자기 트리거의 서명 비밀은 없으므로 401 이다.
    expect(res.status).toBe(401);
    expect(res.body.challenge).toBeUndefined();
  });

  it('rotate 는 다른 워크스페이스 소유로 바뀐 비밀 행을 덮어쓰지 않는다', async () => {
    const victimBotTokenRef = `secret://triggers/${victimTrigger.id}/bot-token`;
    // CLE-T-M9QKKX 이전 공격의 흔적을 흉내 낸다. 그때 rotate 는 행의 workspace_id 까지 공격자 것으로 바꿨다.
    await db.query('UPDATE secret_store SET workspace_id = $2 WHERE ref = $1', [
      victimBotTokenRef,
      attacker.workspaceId,
    ]);

    const res = await request(BASE_URL)
      .post(`/api/triggers/${victimTrigger.id}/chat-channel/rotate-bot-token`)
      .set('Authorization', `Bearer ${victim.token}`)
      .set('X-Workspace-Id', victim.workspaceId)
      .send({ newBotToken: 'xoxb-e2e-victim-token-2' });

    // 고치기 전에는 덮어쓰며 소유가 피해자에게 돌아왔다. 이제는 거부하고 행을 그대로 둔다. 정리는 운영
    // 절차가 한다(아래 두 케이스).
    expect(await secretWorkspace(victimBotTokenRef)).toBe(attacker.workspaceId);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret://');
  });

  it('운영 점검 SQL 이 워크스페이스가 다른 비밀 행과 다른 트리거를 가리키는 참조를 찾는다', async () => {
    // 알림 서명 슬롯도 다른 트리거를 가리키게 한다.
    await db.query(
      `UPDATE trigger SET config = jsonb_set(config, '{notification}', $2::jsonb) WHERE id = $1`,
      [
        poisonedTriggerId,
        JSON.stringify({
          signing: {
            secretRef: `secret://triggers/${victimTrigger.id}/notification-signing`,
          },
        }),
      ],
    );
    // 참조 자리에 평문이 든 행. 점검은 값을 가리고 정리는 건드리지 않는다.
    const plaintextTrigger = await createTrigger(attacker, { config: {} });
    plaintextTriggerId = plaintextTrigger.id;
    await db.query(
      `UPDATE trigger SET config = jsonb_set(config, '{chatChannel}', $2::jsonb) WHERE id = $1`,
      [
        plaintextTriggerId,
        JSON.stringify({
          provider: 'telegram',
          botTokenRef: PLAINTEXT_IN_SLOT,
        }),
      ],
    );

    const [mismatchedSecrets, foreignRefs] = await runOpsSql(
      '2026-10-04-trigger-secret-ref-audit.sql',
    );

    expect(mismatchedSecrets.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: `secret://triggers/${victimTrigger.id}/bot-token`,
          trigger_id: victimTrigger.id,
          trigger_workspace_id: victim.workspaceId,
          secret_workspace_id: attacker.workspaceId,
        }),
      ]),
    );
    // 피해자 자신의 서명 비밀 행은 워크스페이스가 같아 점검 대상이 아니다.
    expect(
      mismatchedSecrets.rows.map((row: { ref: string }) => row.ref),
    ).not.toContain(`secret://triggers/${victimTrigger.id}/inbound-signing`);
    const poisoned = foreignRefs.rows.filter(
      (row: { trigger_id: string }) => row.trigger_id === poisonedTriggerId,
    );
    expect(poisoned.map((row: { path: string }) => row.path).sort()).toEqual([
      'chatChannel.botTokenRef',
      'chatChannel.inboundSigningRef',
      'notification.signing.secretRef',
    ]);
    const plaintext = foreignRefs.rows.filter(
      (row: { trigger_id: string }) => row.trigger_id === plaintextTriggerId,
    );
    expect(plaintext).toEqual([
      expect.objectContaining({
        path: 'chatChannel.botTokenRef',
        stored_ref: null,
      }),
    ]);
    expect(JSON.stringify(foreignRefs.rows)).not.toContain(PLAINTEXT_IN_SLOT);
  });

  it('운영 정리 SQL 은 교차 행만 고치고 다시 돌려도 바뀌는 행이 없으며 소유자가 다시 재발급할 수 있다', async () => {
    const victimSigningRef = `secret://triggers/${victimTrigger.id}/inbound-signing`;
    const victimSigningBefore = await secretWorkspace(victimSigningRef);
    expect(victimSigningBefore).toBe(victim.workspaceId);

    await runOpsSql('2026-10-04-trigger-secret-ref-cleanup.sql');

    // 교차 행은 지워지고 같은 워크스페이스의 행은 그대로다.
    expect(
      await secretWorkspace(`secret://triggers/${victimTrigger.id}/bot-token`),
    ).toBeUndefined();
    expect(await secretWorkspace(victimSigningRef)).toBe(victim.workspaceId);
    const fixed = await db.query<{ config: Record<string, unknown> }>(
      'SELECT config FROM trigger WHERE id = $1',
      [poisonedTriggerId],
    );
    expect(fixed.rows[0].config).toMatchObject({
      chatChannel: {
        botTokenRef: `secret://triggers/${poisonedTriggerId}/bot-token`,
        inboundSigningRef: `secret://triggers/${poisonedTriggerId}/inbound-signing`,
      },
      notification: {
        signing: {
          secretRef: `secret://triggers/${poisonedTriggerId}/notification-signing`,
        },
      },
    });
    // 평문이 든 슬롯은 손대지 않아 점검에 남는다.
    const untouched = await db.query<{ config: Record<string, unknown> }>(
      'SELECT config FROM trigger WHERE id = $1',
      [plaintextTriggerId],
    );
    expect(untouched.rows[0].config).toMatchObject({
      chatChannel: { botTokenRef: PLAINTEXT_IN_SLOT },
    });

    const mine = new Set([victimTrigger.id, poisonedTriggerId]);
    const [mismatchedSecrets, foreignRefs] = await runOpsSql(
      '2026-10-04-trigger-secret-ref-audit.sql',
    );
    expect(
      mismatchedSecrets.rows.filter((row: { trigger_id: string }) =>
        mine.has(row.trigger_id),
      ),
    ).toEqual([]);
    expect(
      foreignRefs.rows.filter((row: { trigger_id: string }) =>
        mine.has(row.trigger_id),
      ),
    ).toEqual([]);
    expect(
      foreignRefs.rows.filter(
        (row: { trigger_id: string }) => row.trigger_id === plaintextTriggerId,
      ),
    ).toHaveLength(1);

    // 두 번째 정리는 우리 행을 하나도 바꾸지 않는다.
    const second = await runOpsSql('2026-10-04-trigger-secret-ref-cleanup.sql');
    const touchedAgain = second
      .flatMap((result) => result.rows ?? [])
      .filter((row: { trigger_id?: string }) =>
        [...mine, plaintextTriggerId].includes(row.trigger_id ?? ''),
      );
    expect(touchedAgain).toEqual([]);

    // 외부 등록은 e2e 에 mock 이 없어 실패하지만 비밀 쓰기는 그 전에 일어난다.
    await request(BASE_URL)
      .post(`/api/triggers/${victimTrigger.id}/chat-channel/rotate-bot-token`)
      .set('Authorization', `Bearer ${victim.token}`)
      .set('X-Workspace-Id', victim.workspaceId)
      .send({ newBotToken: 'xoxb-e2e-victim-token-3' });
    expect(
      await secretWorkspace(`secret://triggers/${victimTrigger.id}/bot-token`),
    ).toBe(victim.workspaceId);
  });
});
