import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  createInvitation,
} from './helpers/auth';

/**
 * e2e: 상태를 바꾸는 POST 액션 · 초대 취소의 **성공 코드** — `plan/complete/post-status-openapi.md`.
 *
 * 정적 가드 `http-status-advertised` 는 «선언(`@HttpCode` · Nest 기본값) = OpenAPI 광고» 를, 그 가드
 * spec 의 캐너리는 «Nest 가 선언한 코드를 싣는다» 를 최소 앱으로 고정한다. 둘 다 **이 라우트들이 실제
 * 스택(가드 · 인터셉터 · 필터)을 지나** 그 코드로 끝까지 나가는지는 보지 않는다. 그 칸을 여기서 본다.
 *
 * 대상은 성공 코드가 바뀌었는데(또는 광고가 바뀌었는데) 성공 경로를 실제 요청으로 부르는 e2e 가 없던
 * 라우트다(`/ai-review` `review/code/2026/09/26/10_00_52` testing WARNING 1). 나머지 대상 라우트
 * (저장 · 자격 증명 교체 · 연결 테스트 · OAuth 시작 · 스케줄 미리보기 · 이양 · 어시스턴트 SSE)는 각자의
 * e2e 가 200 으로 조였다. 재인증 · scope 추가 · 지식 베이스 검색은 외부 OAuth · 임베딩에 닿아 여기서
 * 부르지 않는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

describe('POST 액션 · 초대 취소의 성공 코드 (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('act200'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('ACT200'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('인증 설정 키 재발급 → 200 (새 키를 싣는다)', async () => {
    const create = await request(BASE_URL)
      .post('/api/auth-configs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('act200-key'), type: 'api_key', config: {} });
    expect(create.status).toBe(201);
    const id = (create.body.data as { id: string }).id;

    const res = await request(BASE_URL)
      .post(`/api/auth-configs/${id}/regenerate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(res.status).toBe(200);
    expect((res.body.data as { id: string }).id).toBe(id);
  });

  it('초대 수락 → 200 · 이어서 나가기 → 200', async () => {
    const invitee = await registerAndLogin(
      BASE_URL,
      uniqueEmail('act200-invitee'),
      db,
    );
    await createInvitation(
      BASE_URL,
      ownerToken,
      workspaceId,
      invitee.email,
      'editor',
    );
    const tokenRow = await db.query<{ token: string }>(
      `SELECT token FROM workspace_invitation
         WHERE workspace_id = $1 AND email = $2
         ORDER BY created_at DESC
         LIMIT 1`,
      [workspaceId, invitee.email],
    );

    const accept = await request(BASE_URL)
      .post('/api/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: tokenRow.rows[0].token });
    expect(accept.status).toBe(200);
    expect((accept.body.data as { workspaceId: string }).workspaceId).toBe(
      workspaceId,
    );

    const leave = await request(BASE_URL)
      .post(`/api/workspaces/${workspaceId}/leave`)
      .set('Authorization', `Bearer ${invitee.accessToken}`);
    expect(leave.status).toBe(200);
    expect(leave.body.data).toEqual({ ok: true });

    // 상태 코드만 보면 «아무 일도 안 하고 200» 과 구별되지 않는다 — 멤버십이 실제로 빠졌는지 본다.
    const member = await db.query(
      'SELECT 1 FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, invitee.userId],
    );
    expect(member.rowCount).toBe(0);
  });

  it('초대 취소 → 200 { ok: true } (광고와 같다)', async () => {
    const invitationId = await createInvitation(
      BASE_URL,
      ownerToken,
      workspaceId,
      uniqueEmail('act200-revoked'),
      'viewer',
    );

    const res = await request(BASE_URL)
      .delete(`/api/workspaces/${workspaceId}/invitations/${invitationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ok: true });

    const row = await db.query(
      'SELECT 1 FROM workspace_invitation WHERE id = $1',
      [invitationId],
    );
    expect(row.rowCount).toBe(0);
  });
});
