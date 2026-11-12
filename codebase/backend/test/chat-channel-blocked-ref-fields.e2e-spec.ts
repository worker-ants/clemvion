// 요청 본문의 `chatChannel.botTokenRef` · `chatChannel.inboundSigningRef` 는 그 트리거 자신의 참조여도
// 400 `VALIDATION_ERROR` 다(REQ-CHAT-078, NERV Task `CLE-T-SDB47R`).
// 근거: [채팅 채널 「봇 토큰 변경 단일 경로」](CLE-CHAT-CORE#봇-토큰-변경-단일-경로)
//
// 거부하는 층은 보낸 값에 따라 둘로 갈린다. 비어 있지 않은 문자열은 전역 `CustomValidationPipe` 가
// 중첩 경로(`chatChannel.<field>`)의 배열 `details` 로 막는다. `null` 과 `''` 는 `@IsEmpty()` 를 통과하고
// 서비스 가드(`chat-channel-input-rules.ts`)가 평평한 `<field>` 의 단일 object `details` 로 막는다.
// 두 층은 단위 테스트(`trigger-dto-validation.spec.ts`)가 덮고, 이 파일은 HTTP 왕복을 덮는다.
// 원시 `config.chatChannel.<field>` 갈래는 `trigger-config-internal-fields.e2e-spec.ts` 가 덮는다.
//
// 피해 단언(트리거가 생기지 않았는가, 저장된 비밀 · 설정이 그대로인가)을 상태 코드 단언보다 먼저 둔다.
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

type BlockedRefField = 'botTokenRef' | 'inboundSigningRef';

const REF_NAMES: Record<BlockedRefField, string> = {
  botTokenRef: 'bot-token',
  inboundSigningRef: 'inbound-signing',
};

interface Case {
  label: string;
  field: BlockedRefField;
  /** `undefined` 면 그 트리거 자신의 참조 문자열을 보낸다. */
  value?: null | '';
  expectedDetails: (field: BlockedRefField) => unknown;
}

// 비어 있지 않은 문자열 → 전역 파이프. `message` 는 단위 테스트가 고정하므로 여기서는 보지 않는다.
const pipeDetails = (field: BlockedRefField) => [
  expect.objectContaining({
    field: `chatChannel.${field}`,
    code: 'INVALID_FIELD',
  }),
];
// `null` · `''` → 서비스 가드.
const guardDetails = (field: BlockedRefField) => ({
  field,
  code: 'INVALID_FIELD',
});

const CASES: Case[] = [
  {
    label: 'botTokenRef 에 자기 참조',
    field: 'botTokenRef',
    expectedDetails: pipeDetails,
  },
  {
    label: 'inboundSigningRef 에 자기 참조',
    field: 'inboundSigningRef',
    expectedDetails: pipeDetails,
  },
  {
    label: 'botTokenRef 에 null',
    field: 'botTokenRef',
    value: null,
    expectedDetails: guardDetails,
  },
  {
    label: "inboundSigningRef 에 ''",
    field: 'inboundSigningRef',
    value: '',
    expectedDetails: guardDetails,
  },
];

describe('채팅 채널 요청 본문의 참조 필드 거부 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  /** PATCH 대상이자 생성 사례가 참조로 싣는 트리거. */
  let ownTriggerId: string;
  const createdTriggerIds: string[] = [];

  const authed = (req: request.Test) =>
    req
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);

  const ownRef = (field: BlockedRefField) =>
    `secret://triggers/${ownTriggerId}/${REF_NAMES[field]}`;

  const valueFor = (c: Case) =>
    c.value === undefined ? ownRef(c.field) : c.value;

  const readOwnState = async () => {
    const secrets = (
      await db.query<{ ref: string; encrypted: Buffer }>(
        'SELECT ref, encrypted FROM secret_store WHERE ref LIKE $1 ORDER BY ref',
        [`secret://triggers/${ownTriggerId}/%`],
      )
    ).rows.map((r) => ({ ref: r.ref, encrypted: r.encrypted.toString('hex') }));
    const config = (
      await db.query<{ config: Record<string, unknown> }>(
        'SELECT config FROM trigger WHERE id = $1',
        [ownTriggerId],
      )
    ).rows[0]?.config;
    return { secrets, config };
  };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('blocked-ref'),
      db,
    );
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('BLOCKED-REF'),
    );
    const wf = await authed(request(BASE_URL).post('/api/workflows')).send({
      name: uniqueName('blocked-ref-wf'),
    });
    workflowId = wf.body.data.id as string;

    const created = await authed(request(BASE_URL).post('/api/triggers')).send({
      workflowId,
      type: 'webhook',
      name: uniqueName('blocked-ref-own'),
      endpointPath: crypto.randomUUID(),
      chatChannel: { provider: 'telegram', botToken: '111:e2eBlockedRefOwn' },
    });
    // 외부 setWebhook 은 e2e 에 mock 이 없어 실패하지만 생성은 성공한다
    // (`chat-channel-trigger-create.e2e-spec.ts` 머리 주석).
    expect(created.status).toBe(201);
    ownTriggerId = created.body.data.id as string;
    createdTriggerIds.push(ownTriggerId);
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTriggerIds) {
      await db
        .query('DELETE FROM trigger WHERE id = $1', [id])
        .catch(() => undefined);
    }
    await db.end();
  });

  it.each(CASES)('생성: $label → 400, 트리거를 만들지 않는다', async (c) => {
    const name = uniqueName('blocked-ref-create');
    const res = await authed(request(BASE_URL).post('/api/triggers')).send({
      workflowId,
      type: 'webhook',
      name,
      endpointPath: crypto.randomUUID(),
      chatChannel: {
        provider: 'telegram',
        botToken: '222:e2eBlockedRefCreate',
        [c.field]: valueFor(c),
      },
    });
    if (res.status === 201) createdTriggerIds.push(res.body.data.id as string);

    const rows = await db.query('SELECT id FROM trigger WHERE name = $1', [
      name,
    ]);
    expect(rows.rowCount).toBe(0);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(c.expectedDetails(c.field));
  });

  it.each(CASES)(
    'PATCH: $label → 400, 저장된 비밀과 설정이 그대로다',
    async (c) => {
      const before = await readOwnState();
      expect(before.secrets.length).toBeGreaterThan(0);

      const res = await authed(
        request(BASE_URL).patch(`/api/triggers/${ownTriggerId}`),
      ).send({
        chatChannel: { provider: 'telegram', [c.field]: valueFor(c) },
      });

      expect(await readOwnState()).toEqual(before);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(c.expectedDetails(c.field));
    },
  );
});
