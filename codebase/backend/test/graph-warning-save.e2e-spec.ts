import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/conventions/cross-node-warning-rules.md (parallel-p2 결정 D + E + I)
 *
 * Cross-node graphWarningRules 의 backend save-validate enforcement 을 실 HTTP +
 * 실 DB 트랜잭션 경로로 검증한다. saveCanvas (POST /api/workflows/:id/save) 는
 * 같은 트랜잭션 안에서 graphWarningRules 를 평가하고, severity 'error' rule 이
 * 하나라도 triggered 되면 BadRequestException({ code: 'GRAPH_VALIDATION_FAILED' })
 * (HTTP 400) 으로 저장을 차단한다 (transaction rollback).
 *
 * 대표 error rule 은 `parallel:nested-depth-exceeded` — Parallel 노드의 분기 body
 * 안에 또 Parallel 이 있고, 그 내부 Parallel 의 분기 body 안에 또 Parallel 이 있어
 * 중첩 깊이가 3 이 되면 reject. rule 정의의 SSOT 는 shared package
 * `@workflow/graph-warning-rules` 이며 frontend canvas 와 공유된다.
 *
 * 분기 body 탐지는 `collectParallelBranchBodyNodeIds` 가 source=ParallelNodeId 이고
 * sourceHandle (= Edge entity 의 sourcePort) 가 `branch_N` 패턴인 edge 의 target
 * 부터 BFS 로 수집한다. 따라서 nested 를 만들려면 외부 Parallel → 내부 Parallel 로
 * 가는 edge 의 sourcePort 가 `branch_0` 이어야 한다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const MANUAL_TRIGGER_TYPE = 'manual_trigger';

interface CanvasNode {
  id: string;
  type: string;
  category: string;
  label: string;
  positionX: number;
  positionY: number;
  config?: Record<string, unknown>;
}

interface CanvasEdge {
  sourceNodeId: string;
  sourcePort?: string;
  targetNodeId: string;
  targetPort?: string;
}

/** 워크플로우에 항상 존재해야 하는 Manual Trigger 노드 1개. */
function manualTrigger(): CanvasNode {
  return {
    id: randomUUID(),
    type: MANUAL_TRIGGER_TYPE,
    category: 'trigger',
    label: 'Start',
    positionX: 0,
    positionY: 0,
  };
}

function parallelNode(label: string, x: number): CanvasNode {
  return {
    id: randomUUID(),
    type: 'parallel',
    category: 'logic',
    label,
    positionX: x,
    positionY: 0,
    config: { branchCount: 2, waitAll: true },
  };
}

describe('Graph Warning Save Validate (e2e)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('gwsave'), db);
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('GWSAVE'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  async function createWorkflow(): Promise<string> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('gwsave-wf') });
    expect(res.status).toBe(201);
    return res.body.data.id;
  }

  function save(id: string, nodes: CanvasNode[], edges: CanvasEdge[]) {
    return request(BASE_URL)
      .post(`/api/workflows/${id}/save`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ nodes, edges });
  }

  it('A. 3-level nested Parallel → 400 GRAPH_VALIDATION_FAILED', async () => {
    const id = await createWorkflow();

    const trigger = manualTrigger();
    // 외부 → 중간 → 내부 Parallel 을 각자의 분기 body (branch_0) 로 중첩.
    // depth = 3 이므로 parallel:nested-depth-exceeded (severity error) triggered.
    const outer = parallelNode('Outer', 200);
    const middle = parallelNode('Middle', 400);
    const inner = parallelNode('Inner', 600);

    const nodes = [trigger, outer, middle, inner];
    const edges: CanvasEdge[] = [
      // trigger → outer (일반 흐름)
      { sourceNodeId: trigger.id, sourcePort: 'out', targetNodeId: outer.id, targetPort: 'in' },
      // outer 의 분기 body 안에 middle Parallel
      { sourceNodeId: outer.id, sourcePort: 'branch_0', targetNodeId: middle.id, targetPort: 'in' },
      // middle 의 분기 body 안에 inner Parallel  → depth 3 성립
      { sourceNodeId: middle.id, sourcePort: 'branch_0', targetNodeId: inner.id, targetPort: 'in' },
    ];

    const res = await save(id, nodes, edges);
    expect(res.status).toBe(400);
    // GlobalExceptionFilter 는 에러를 `{ error: { code, message, details } }` 로 감싼다.
    expect(res.body.error.code).toBe('GRAPH_VALIDATION_FAILED');
    // details.errors 에 해당 rule 이 포함되어야 한다.
    const errors = (res.body.error.details?.errors ?? []) as Array<{
      ruleId: string;
      severity: string;
    }>;
    expect(
      errors.some((e) => e.ruleId === 'parallel:nested-depth-exceeded'),
    ).toBe(true);
  }, 30_000);

  it('B. 2-level nested Parallel → 200 저장 성공 (depth 2 는 허용)', async () => {
    const id = await createWorkflow();

    const trigger = manualTrigger();
    const outer = parallelNode('Outer2', 200);
    const inner = parallelNode('Inner2', 400);

    const nodes = [trigger, outer, inner];
    const edges: CanvasEdge[] = [
      { sourceNodeId: trigger.id, sourcePort: 'out', targetNodeId: outer.id, targetPort: 'in' },
      // outer 분기 body 안에 inner Parallel 1개 → depth 2, error rule 미triggered.
      { sourceNodeId: outer.id, sourcePort: 'branch_0', targetNodeId: inner.id, targetPort: 'in' },
    ];

    const res = await save(id, nodes, edges);
    // POST 기본 201 (saveCanvas 컨트롤러는 @HttpCode override 없음).
    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    // 저장된 노드가 응답에 반영되어야 한다.
    const savedNodes = res.body.data.nodes as Array<{ id: string }>;
    expect(Array.isArray(savedNodes)).toBe(true);
    expect(savedNodes.length).toBe(3);
  }, 30_000);

  it('C. 단일 Parallel (non-nested) → 200 저장 성공', async () => {
    const id = await createWorkflow();

    const trigger = manualTrigger();
    const solo = parallelNode('Solo', 200);

    const nodes = [trigger, solo];
    const edges: CanvasEdge[] = [
      { sourceNodeId: trigger.id, sourcePort: 'out', targetNodeId: solo.id, targetPort: 'in' },
    ];

    const res = await save(id, nodes, edges);
    expect(res.status).toBe(201);
    expect(res.body.data.nodes.length).toBe(2);
  }, 30_000);
});
