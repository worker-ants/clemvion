import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
} from '../src/shared/testing/response-contract';
import { WebAuthnAvailabilityDto } from '../src/modules/auth/webauthn/dto/responses/webauthn-response.dto';
import { NotificationRotateSecretDto } from '../src/modules/triggers/dto/responses/trigger-secret-issue-response.dto';

/**
 * e2e: 새로 광고한 성공 응답 DTO 가 **실제 응답과 맞는가** — `plan/complete/success-advert.md`.
 *
 * 성공 응답을 광고하지 않던 라우트에 응답 DTO 를 붙였다. 광고가 실제와 다르면(필수인데 빠진 키 · 선언하지 않은 키) 생성된
 * OpenAPI 가 새로 틀린다 — `assertMatchesContract` 가 선언되지 않은 키까지 문다(api-convention §5.4 «검증 층»). 이 파일은 다른
 * e2e 가 부르지 않던 두 라우트를 맡는다. workflow-assistant 세션은 `workflow-assistant.e2e-spec.ts`, interaction token 재발급은
 * `chat-channel-trigger-create.e2e-spec.ts` 가 같은 대조를 한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('새로 광고한 성공 응답의 계약 (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;
  const createdTriggerIds: string[] = [];

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('advc'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('ADVC'),
    );
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('advc-wf') });
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

  it('WebAuthn 활성 여부 — WebAuthnAvailabilityDto', async () => {
    const res = await request(BASE_URL).get(
      '/api/auth/2fa/webauthn/availability',
    );
    expect(res.status).toBe(200);
    assertMatchesContract(
      res.body.data,
      await contractForDto(WebAuthnAvailabilityDto),
    );
  });

  it('notification secret 회전 — NotificationRotateSecretDto', async () => {
    const created = await request(BASE_URL)
      .post('/api/triggers')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        workflowId,
        type: 'webhook',
        name: uniqueName('advc-notify'),
        endpointPath: randomUUID(),
        notification: {
          url: 'https://hooks.example.com/wf-callback',
          events: ['execution.completed'],
        },
      });
    expect(created.status).toBe(201);
    const triggerId = created.body.data.id as string;
    createdTriggerIds.push(triggerId);

    const res = await request(BASE_URL)
      .post(`/api/triggers/${triggerId}/notification/rotate-secret`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    assertMatchesContract(
      res.body.data,
      await contractForDto(NotificationRotateSecretDto),
    );
  });
});
