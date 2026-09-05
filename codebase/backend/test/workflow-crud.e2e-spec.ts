import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
  type DtoContract,
} from '../src/shared/testing/response-contract';
import { WorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';

/**
 * e2e: 워크플로우 CRUD 의 실 인프라 검증.
 *
 * 핵심:
 *   - POST /workflows 가 Manual Trigger 노드를 자동 생성 (saveCanvas 의 "정확히 하나"
 *     invariant 와 짝)
 *   - duplicate 가 새 ID + " (Copy)" 접미 + isActive=false 로 독립 생성하고, 노드·엣지를
 *     포함한 캔버스 전체를 새 UUID 로 재매핑해 복사 (data-flow §1.5). 버전 이력은 비승계
 *   - DELETE 후 GET 404
 *   - 동시 PATCH 가 마지막 쓰기로 수렴 (실패 없이)
 *
 * 권한·격리 invariants 는 workspace-rbac.e2e-spec.ts 가 담당. 본 spec 은 단일 owner
 * 단일 워크스페이스 하에서의 CRUD 의미만 본다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/**
 * C 케이스(duplicate 캔버스 복사) 전용 5노드 그래프 saveCanvas payload.
 * Manual Trigger → Loop(HTTP 를 container 로 소유) → Agent(Tool 을 toolOwner
 * 로 소유) — container 축과 toolOwner 축을 다른 노드로 갈라 두면 duplicate()
 * 의 UUID 재매핑이 두 축을 뒤바꿔도 관측된다. 노드 id 는 UUID 여야 한다 —
 * SaveCanvasNodeDto 의 containerId/toolOwnerId 가 `@IsUUID()` 라 임시 문자열
 * id 를 참조로 넘기면 저장이 400 으로 거부된다(프론트엔드도 새 노드에 UUID 를
 * 발급한다). 반환된 UUID 는 호출부에서 재사용하지 않는다(이후 단언은 전부
 * export 의 label 기반 index 로 대조).
 */
function buildFiveNodeGraphPayload() {
  const nTrig = randomUUID();
  const nLoop = randomUUID();
  const nHttp = randomUUID();
  const nAgent = randomUUID();
  const nTool = randomUUID();

  return {
    nodes: [
      {
        id: nTrig,
        type: 'manual_trigger',
        category: 'trigger',
        label: 'Manual Trigger',
        positionX: 0,
        positionY: 0,
      },
      {
        id: nLoop,
        type: 'loop',
        category: 'logic',
        label: 'Loop',
        positionX: 200,
        positionY: 0,
      },
      {
        id: nHttp,
        type: 'http_request',
        category: 'integration',
        label: 'HTTP',
        positionX: 240,
        positionY: 60,
        config: { url: 'https://example.com', method: 'GET' },
        containerId: nLoop,
      },
      {
        id: nAgent,
        type: 'ai_agent',
        category: 'ai',
        label: 'Agent',
        positionX: 400,
        positionY: 0,
      },
      {
        id: nTool,
        type: 'http_request',
        category: 'integration',
        label: 'Tool',
        positionX: 440,
        positionY: 60,
        toolOwnerId: nAgent,
      },
    ],
    edges: [
      {
        sourceNodeId: nTrig,
        sourcePort: 'out',
        targetNodeId: nLoop,
        targetPort: 'in',
        type: 'data',
      },
      {
        sourceNodeId: nLoop,
        sourcePort: 'out',
        targetNodeId: nAgent,
        targetPort: 'in',
        type: 'data',
      },
    ],
  };
}

describe('Workflow CRUD (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  let workflowContract: DtoContract;

  beforeAll(async () => {
    workflowContract = await contractForDto(WorkflowDto);
    db = createDbClient();
    await db.connect();

    const owner = await registerAndLogin(BASE_URL, uniqueEmail('wfcrud'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('WFCRUD'),
    );
  }, 60_000);

  afterAll(async () => {
    await db.end();
  });

  it('A. create → list 에 포함 / Manual Trigger 노드 자동 생성', async () => {
    const name = uniqueName('wf-a');
    const createRes = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name });
    expect(createRes.status).toBe(201);
    const id = (createRes.body.data as { id: string }).id;

    // list 에 등장.
    const listRes = await request(BASE_URL)
      .get('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(listRes.status).toBe(200);
    const items =
      (listRes.body.data as { items?: Array<{ id: string }> }).items ??
      (listRes.body.data as Array<{ id: string }>);
    const ids = items.map((w: { id: string }) => w.id);
    expect(ids).toContain(id);

    // 목록 응답 1건이 `WorkflowDto` 선언과 맞는지 통째로 대조한다 (API 규약 §5.4).
    // 이 컨트롤러는 엔티티를 그대로 반환하므로 DTO 선언을 강제하는 것이 이 단언뿐이다.
    const mine = items.find((w: { id: string }) => w.id === id);
    expect(mine).toBeDefined();
    assertMatchesContract(mine, workflowContract);

    // Manual Trigger 노드 1개 자동 생성.
    const nodeRows = await db.query<{ type: string }>(
      'SELECT type FROM node WHERE workflow_id = $1',
      [id],
    );
    expect(nodeRows.rows.length).toBe(1);
    expect(nodeRows.rows[0].type).toBe('manual_trigger');
  });

  it('B. PATCH 이름·설명 → 후속 GET 에 반영', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-b'), description: 'before' });
    const id = create.body.data.id;

    const newName = uniqueName('wf-b-edited');
    const patch = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: newName, description: 'after' });
    expect(patch.status).toBe(200);

    const get = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(get.status).toBe(200);
    expect(get.body.data.name).toBe(newName);
    expect(get.body.data.description).toBe('after');
  });

  it('B2. PATCH settings.maxConcurrentExecutions — 검증 게이트(§8, workspace 대칭)', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-cap') });
    const id = create.body.data.id;

    // 0 (양의 정수 아님) → 400.
    const zero = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ settings: { maxConcurrentExecutions: 0 } });
    expect(zero.status).toBe(400);

    // 미지 settings 키 → 400 (forbidNonWhitelisted — workspace settings DTO 대칭).
    const unknownKey = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ settings: { bogusKey: 1 } });
    expect(unknownKey.status).toBe(400);

    // 양의 정수 → 200 + 후속 GET 에 영속.
    const ok = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ settings: { maxConcurrentExecutions: 5 } });
    expect(ok.status).toBe(200);

    const get = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(get.status).toBe(200);
    expect(get.body.data.settings?.maxConcurrentExecutions).toBe(5);
  });

  it('C. duplicate → 새 ID, " (Copy)" 접미, isActive=false, 캔버스 전체 복사', async () => {
    const baseName = uniqueName('wf-c');
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: baseName, isActive: true });
    const id = create.body.data.id;

    // 복제 대상 그래프를 실제로 만들어 둔다. 빈 캔버스를 복제하면 "노드를 안
    // 옮긴다" 는 회귀가 관측되지 않는다 (본 케이스가 과거 그 상태였다).
    const save = await request(BASE_URL)
      .post(`/api/workflows/${id}/save`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send(buildFiveNodeGraphPayload());
    // 저장이 막히면 이 케이스 전체가 무의미해지므로, 상태 코드만 보지 말고 원인
    // (code/message)을 실패 메시지에 실어 한 번에 진단되게 한다.
    if (save.status >= 400) {
      throw new Error(
        `saveCanvas ${save.status}: ${JSON.stringify(save.body)}`,
      );
    }
    expect([200, 201]).toContain(save.status);

    const dup = await request(BASE_URL)
      .post(`/api/workflows/${id}/duplicate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(dup.status).toBe(201);
    const dupId = dup.body.data.id;
    expect(dupId).not.toBe(id);
    expect(dup.body.data.name).toBe(`${baseName} (Copy)`);
    expect(dup.body.data.isActive).toBe(false);
    // 버전 이력은 승계하지 않는다 — 원본은 save 로 2 가 됐고 사본은 1 로 시작.
    expect(dup.body.data.currentVersion).toBe(1);

    // 사본의 캔버스를 export 로 관측한다 (노드 간 참조가 인덱스로 정규화돼 나와
    // UUID 재매핑 결과를 그대로 대조할 수 있다).
    const dupExport = await request(BASE_URL)
      .get(`/api/workflows/${dupId}/export`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(dupExport.status).toBe(200);

    const nodes = dupExport.body.data.nodes as Array<{
      label: string;
      config: Record<string, unknown>;
      containerIndex: number | null;
      toolOwnerIndex: number | null;
    }>;
    const edges = dupExport.body.data.edges as Array<{
      sourceNodeIndex: number;
      targetNodeIndex: number;
      sourcePort: string;
      targetPort: string;
    }>;
    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(2);

    const idx = (label: string) => nodes.findIndex((n) => n.label === label);
    expect(nodes[idx('HTTP')].containerIndex).toBe(idx('Loop'));
    expect(nodes[idx('HTTP')].toolOwnerIndex).toBeNull();
    expect(nodes[idx('Tool')].toolOwnerIndex).toBe(idx('Agent'));
    expect(nodes[idx('Tool')].containerIndex).toBeNull();
    expect(nodes[idx('HTTP')].config).toMatchObject({
      url: 'https://example.com',
    });

    const edgePairs = edges.map(
      (e) =>
        `${nodes[e.sourceNodeIndex].label}->${nodes[e.targetNodeIndex].label}`,
    );
    expect(edgePairs.sort()).toEqual(
      ['Loop->Agent', 'Manual Trigger->Loop'].sort(),
    );

    // 사본의 노드는 원본과 다른 row 다 — 원본 노드 UUID 를 재사용하지 않는다.
    const dupNodeIds = await db.query<{ id: string }>(
      'SELECT id FROM node WHERE workflow_id = $1',
      [dupId],
    );
    const origNodeIds = await db.query<{ id: string }>(
      'SELECT id FROM node WHERE workflow_id = $1',
      [id],
    );
    expect(dupNodeIds.rows).toHaveLength(5);
    expect(origNodeIds.rows).toHaveLength(5);
    const origSet = new Set(origNodeIds.rows.map((r) => r.id));
    for (const row of dupNodeIds.rows) {
      expect(origSet.has(row.id)).toBe(false);
    }

    // 원본은 그대로 (이름·활성 상태·캔버스 모두).
    const original = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(original.body.data.name).toBe(baseName);
    expect(original.body.data.isActive).toBe(true);

    // 사본에 버전 스냅샷 row 를 만들지 않는다.
    const dupVersions = await db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM workflow_version WHERE workflow_id = $1',
      [dupId],
    );
    expect(dupVersions.rows[0].count).toBe('0');
  });

  it('D. DELETE → 204 그리고 후속 GET 404', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-d') });
    const id = create.body.data.id;

    const del = await request(BASE_URL)
      .delete(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(del.status).toBe(204);

    const get = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(get.status).toBe(404);

    // 노드 cascade 삭제 확인.
    const nodeRows = await db.query(
      'SELECT id FROM node WHERE workflow_id = $1',
      [id],
    );
    expect(nodeRows.rows.length).toBe(0);
  });

  it('E. 동시 PATCH — 모두 200, last-write 가 GET 에 반영 (실패 없음)', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-e') });
    const id = create.body.data.id;

    const [r1, r2, r3] = await Promise.all([
      request(BASE_URL)
        .patch(`/api/workflows/${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({ description: 'v1' }),
      request(BASE_URL)
        .patch(`/api/workflows/${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({ description: 'v2' }),
      request(BASE_URL)
        .patch(`/api/workflows/${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Workspace-Id', workspaceId)
        .send({ description: 'v3' }),
    ]);
    // 동시 PATCH 가 충돌 없이 모두 200 — last-write-wins 정책.
    expect([r1.status, r2.status, r3.status].every((s) => s === 200)).toBe(
      true,
    );

    const final = await request(BASE_URL)
      .get(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(final.status).toBe(200);
    expect(['v1', 'v2', 'v3']).toContain(final.body.data.description);
  });

  it('F. export → 같은 형태로 import → 별도 워크플로우 생성', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-f'), description: 'original' });
    const id = create.body.data.id;

    const exportRes = await request(BASE_URL)
      .get(`/api/workflows/${id}/export`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.name).toBeDefined();
    expect(Array.isArray(exportRes.body.data.nodes)).toBe(true);

    const importRes = await request(BASE_URL)
      .post('/api/workflows/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send(exportRes.body.data);
    expect([200, 201]).toContain(importRes.status);
    const newId = importRes.body.data.id;
    expect(newId).not.toBe(id);
  });

  it('G. import settings.maxConcurrentExecutions — round-trip 영속 + 미지키 400 (§8, patch 대칭)', async () => {
    const create = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('wf-g') });
    const id = create.body.data.id;

    // cap 설정(patch) → export 에 settings 가 실린다.
    const patch = await request(BASE_URL)
      .patch(`/api/workflows/${id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ settings: { maxConcurrentExecutions: 5 } });
    expect(patch.status).toBe(200);

    const exportRes = await request(BASE_URL)
      .get(`/api/workflows/${id}/export`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(exportRes.body.data.settings?.maxConcurrentExecutions).toBe(5);

    // export JSON 을 그대로 import → 새 워크플로우에 settings 영속.
    const importRes = await request(BASE_URL)
      .post('/api/workflows/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send(exportRes.body.data);
    expect([200, 201]).toContain(importRes.status);
    const newId = importRes.body.data.id;
    const getNew = await request(BASE_URL)
      .get(`/api/workflows/${newId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId);
    expect(getNew.body.data.settings?.maxConcurrentExecutions).toBe(5);

    // 미지 settings 키 import → 400 (strict, UpdateWorkflowDto 대칭).
    const badImport = await request(BASE_URL)
      .post('/api/workflows/import')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ ...exportRes.body.data, settings: { bogusKey: 1 } });
    expect(badImport.status).toBe(400);
  });
});
