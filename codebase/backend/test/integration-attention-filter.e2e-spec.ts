import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: GET /api/integrations?status=attention — virtual filter value
 * (spec/2-navigation/4-integration.md §2.3 + §9.1 Rationale "Attention 가상
 * 필터값"). The backend rewrites `attention` into the union
 *   Expired ∪ Error ∪ (Connected AND token_expires_at within 7d).
 *
 * pending_install is excluded by design — that's an active external flow
 * the user is in the middle of, not something to surface as attention.
 *
 * Unit tests cover the query-builder side (mock); this suite confirms the
 * SQL actually returns the expected rows from a real Postgres against
 * real Integration rows.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Integrations list — attention virtual filter (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('attn'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('ATTN'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  async function createIntegration(name: string): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/integrations')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({
        serviceType: 'http',
        name,
        authType: 'api_key',
        credentials: {
          base_url: 'https://api.example.com',
          location: 'header',
          key_name: 'X-Api-Key',
          value: 'sk-attn',
        },
        scope: 'personal',
      });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  }

  async function forceState(
    id: string,
    status: string,
    tokenExpiresAt: Date | null,
  ): Promise<void> {
    await db.query(
      `UPDATE integration
         SET status = $2,
             token_expires_at = $3
       WHERE id = $1`,
      [id, status, tokenExpiresAt],
    );
  }

  async function listAttention(): Promise<string[]> {
    const res = await request(BASE_URL)
      .get('/api/integrations')
      .query({ status: 'attention', limit: 50 })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    const rows = res.body.data as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  it('returns the union of expired ∪ error ∪ (connected within 7d) and excludes pending_install', async () => {
    const expired = await createIntegration(uniqueName('attn-expired'));
    const errored = await createIntegration(uniqueName('attn-error'));
    const expiring = await createIntegration(uniqueName('attn-expiring'));
    const farOut = await createIntegration(uniqueName('attn-faraway'));
    const fresh = await createIntegration(uniqueName('attn-fresh'));
    const pending = await createIntegration(uniqueName('attn-pending'));

    const now = Date.now();
    await forceState(expired, 'expired', null);
    await forceState(errored, 'error', null);
    await forceState(
      expiring,
      'connected',
      new Date(now + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    );
    await forceState(
      farOut,
      'connected',
      new Date(now + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    );
    await forceState(fresh, 'connected', null);
    await forceState(pending, 'pending_install', null);

    const ids = await listAttention();
    expect(ids).toEqual(expect.arrayContaining([expired, errored, expiring]));
    expect(ids).not.toContain(farOut);
    expect(ids).not.toContain(fresh);
    expect(ids).not.toContain(pending);
  });

  it('counts a token expiring just under the 7-day boundary as attention', async () => {
    const justInside = await createIntegration(uniqueName('attn-edge-in'));
    await forceState(
      justInside,
      'connected',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 - 60_000), // 7d - 1 min
    );
    const ids = await listAttention();
    expect(ids).toContain(justInside);
  });

  it('does not count a token expiring well past the 7-day boundary as attention', async () => {
    const justOutside = await createIntegration(uniqueName('attn-edge-out'));
    await forceState(
      justOutside,
      'connected',
      new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days
    );
    const ids = await listAttention();
    expect(ids).not.toContain(justOutside);
  });

  it('rejects unknown status filter values with 400', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations')
      .query({ status: 'totally-bogus' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(400);
  });

  it('accepts attention as a valid filter value', async () => {
    const res = await request(BASE_URL)
      .get('/api/integrations')
      .query({ status: 'attention' })
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
  });
});
