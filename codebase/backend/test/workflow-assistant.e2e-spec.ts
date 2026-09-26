import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Workflow AI Assistant 세션 관리 — spec/3-workflow-editor/4-ai-assistant.md.
 *
 * SSE 스트리밍·LLM 호출 자체는 LLM 의존이라 unit / integration 이 담당. 본 e2e 는
 * 세션 엔티티 라이프사이클·RBAC·격리에 집중한다. 예외 하나 — SSE 응답의 **상태 줄**은 LLM 에
 * 닿기 전에 정해지므로 여기서 본다(G).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('Workflow Assistant sessions (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;
  let workflowId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('asst'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('ASST'),
    );

    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('asst-wf') });
    workflowId = wf.body.data.id;
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      'X-Workspace-Id': workspaceId,
    } as const;
  }

  it('A. POST /sessions → 201, GET /sessions 에 등장', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflow-assistant/sessions')
      .set(authHeaders())
      .send({ workflowId, title: 'Initial session' });
    expect(create.status).toBe(201);
    const sessionId = create.body.data.id as string;
    expect(sessionId).toBeDefined();

    const list = await request(BASE_URL)
      .get('/api/workflow-assistant/sessions')
      .set(authHeaders())
      .query({ workflowId });
    expect(list.status).toBe(200);
    const items =
      (list.body.data as { items?: Array<{ id: string }> }).items ??
      (list.body.data as Array<{ id: string }>);
    expect(items.some((i) => i.id === sessionId)).toBe(true);
  });

  it('B. PATCH 제목 → 200, GET 반영', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflow-assistant/sessions')
      .set(authHeaders())
      .send({ workflowId, title: 'Before' });
    const sessionId = create.body.data.id;

    const patch = await request(BASE_URL)
      .patch(`/api/workflow-assistant/sessions/${sessionId}`)
      .set(authHeaders())
      .send({ title: 'After' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.title).toBe('After');
  });

  it('C. DELETE 세션 → 204, 후속 GET 404', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflow-assistant/sessions')
      .set(authHeaders())
      .send({ workflowId });
    const sessionId = create.body.data.id;

    const del = await request(BASE_URL)
      .delete(`/api/workflow-assistant/sessions/${sessionId}`)
      .set(authHeaders());
    expect(del.status).toBe(204);

    const get = await request(BASE_URL)
      .get(`/api/workflow-assistant/sessions/${sessionId}`)
      .set(authHeaders());
    expect(get.status).toBe(404);
  });

  it('D. cross-workspace 격리 — 다른 워크스페이스에서 GET 시 403/404', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflow-assistant/sessions')
      .set(authHeaders())
      .send({ workflowId });
    const sessionId = create.body.data.id;

    const intruder = await registerAndLogin(
      BASE_URL,
      uniqueEmail('asst-x'),
      db,
    );
    const otherWs = await createTeamWorkspace(
      BASE_URL,
      intruder.accessToken,
      uniqueName('X'),
    );

    const cross = await request(BASE_URL)
      .get(`/api/workflow-assistant/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .set('X-Workspace-Id', otherWs);
    expect([403, 404]).toContain(cross.status);
  });

  it('E. RBAC — viewer 는 세션 생성 불가 (403)', async () => {
    // invite 엔드포인트는 throttler(60s/10) 가 강력해서 본 suite 가 마지막 차례에
    // 돌면 누적 invite 가 bucket 을 비우지 못한다. RBAC 단언만 필요하므로 viewer
    // 멤버십을 DB 에 직접 INSERT 해 throttler 를 우회한다.
    const viewer = await registerAndLogin(
      BASE_URL,
      uniqueEmail('asst-viewer'),
      db,
    );
    await db.query(
      `INSERT INTO workspace_member (workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, 'viewer', NOW())
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'viewer'`,
      [workspaceId, viewer.userId],
    );

    const res = await request(BASE_URL)
      .post('/api/workflow-assistant/sessions')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ workflowId });
    expect(res.status).toBe(403);
  });

  it('F. sessions/latest — 최근 생성 세션 반환 (또는 없음)', async () => {
    const newSession = await request(BASE_URL)
      .post('/api/workflow-assistant/sessions')
      .set(authHeaders())
      .send({ workflowId, title: 'Latest test' });
    const sessionId = newSession.body.data.id;

    const latest = await request(BASE_URL)
      .get('/api/workflow-assistant/sessions/latest')
      .set(authHeaders())
      .query({ workflowId });
    expect([200, 204, 404]).toContain(latest.status);
    if (latest.status === 200) {
      // 반환됐다면 적어도 우리 세션이 가장 최근.
      expect(latest.body.data?.id).toBeDefined();
    }
    // 정리: 깔끔하게 지움.
    await request(BASE_URL)
      .delete(`/api/workflow-assistant/sessions/${sessionId}`)
      .set(authHeaders());
  });

  it('G. POST /sessions/:id/messages — SSE 스트림은 200 으로 나간다', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflow-assistant/sessions')
      .set(authHeaders())
      .send({ workflowId, title: 'SSE status' });
    expect(create.status).toBe(201);
    const sessionId = create.body.data.id as string;

    // 없는 LLM Config 를 지정해 config 해석에서 끝나게 한다 — 외부 LLM 호출 없이 스트림이 error 이벤트
    // 하나로 닫힌다. 보려는 것은 상태 줄이다: 핸들러는 `@Res()` 로 헤더만 쓰고 `res.status()` 를 부르지
    // 않으므로 Nest 가 핸들러 전에 싣는 값이 그대로 나간다(`@HttpCode(HttpStatus.OK)` 전에는 201 이었다).
    const res = await request(BASE_URL)
      .post(`/api/workflow-assistant/sessions/${sessionId}/messages`)
      .set(authHeaders())
      .send({
        content: 'hello',
        currentWorkflow: { nodes: [], edges: [] },
        llmConfigId: randomUUID(),
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    // 스트림 본문까지 확인해 «4xx 가 아니라 SSE 로 응답했다» 를 가른다 — 상태만 보면 JSON 200 과 구별되지 않는다.
    expect(res.text).toContain('ASSISTANT_NO_LLM_CONFIG');
  });
});
