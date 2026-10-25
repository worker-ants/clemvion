import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import {
  registerAndLogin,
  createTeamWorkspace,
  inviteAndAccept,
} from './helpers/auth';
// 공허성 가드 대기 시간은 한 곳에서 온다(`integration-rotate-concurrency.e2e-spec.ts` 와 같은 이유).
import { VACUITY_GUARD_MS } from './helpers/concurrency';

/**
 * e2e: 개인 통합 사용 판정 — 노드는 워크플로우 작성자 본인의 개인 통합만 쓴다(CLE-INT-MANAGE 「개인 통합 사용 판정」,
 * CLE-PLAT-DATA 「참조의 소속」 의 「통합 참조」, NERV Task `CLE-T-1BQZ10`).
 *
 * 판정 함수와 경로별 규칙은 unit 이 덮는다. 여기서는 unit 이 mock 으로 건너뛰는 것을 실제 Postgres 로 본다.
 *
 * - 판정에 넘길 사실을 모으는 원시 SQL(통합 행 · 워크스페이스 멤버 · 실행 중인 노드의 워크플로우 작성자)
 * - 캔버스 저장이 워크플로우 행을 잠근 뒤 저장된 노드를 기준선으로 읽는가(아래 「동시 저장」)
 * - 거절이 없는 통합과 같은 응답 · 같은 노드 출력인가
 *
 * 액터: Owner(워크스페이스 소유자, 실행 · 복원 · 멤버 제거를 한다) · Alice(Editor, 개인 통합 둘의 소유자이자 워크플로우
 * 작성자) · Bob(Editor, Alice 의 워크플로우를 편집한다).
 *
 * 테스트는 순서대로 돈다(`maxWorkers: 1`, 한 파일 안 순차). 뒤 테스트가 앞 테스트가 남긴 상태를 쓴다. 각 테스트 첫 줄에 그
 * 전제를 적는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** 어느 통합도 아닌 UUID(v4 형식). 거절 응답이 «없는 통합» 과 같은지 대조하는 기준이다. */
const ABSENT_ID = '0b7e4c1d-2f3a-4b5c-8d6e-7f8091a2b3c4';
/**
 * SSRF 가드가 막는 주소. HTTP Request 노드는 통합 조회를 마친 뒤에 이 가드를 보므로 `HTTP_BLOCKED` 는 «통합 조회를
 * 통과했다» 는 뜻이다. 외부로 요청이 나가지 않는다.
 */
const BLOCKED_URL = 'http://127.0.0.1:9/';
const TERMINAL = ['completed', 'failed', 'cancelled'];

type Actor = { userId: string; accessToken: string };
type CanvasNode = Record<string, unknown>;
interface UsageWorkflow {
  workflowId: string;
  authorIsIntegrationOwner: boolean;
}
interface ClearedRef {
  nodeId: string;
  nodeLabel: string;
  field: string;
}

describe('개인 통합 사용 판정 (e2e)', () => {
  let db: Client;
  /** 동시 저장 테스트에서 워크플로우 행 잠금을 쥐는 쪽 — 요청이 도는 동안 열려 있어야 하므로 별도 커넥션이다. */
  let locker: Client;
  let owner: Actor;
  let alice: Actor;
  let bob: Actor;
  let ws: string;
  let aliceMemberId: string;
  /** Alice 의 개인 통합. 처음 캔버스가 쓴다. */
  let personalA: string;
  /** Alice 의 다른 개인 통합. 동시 저장 테스트에서 «Alice 가 방금 바꿔 넣은 값» 이다. */
  let personalA2: string;

  /** Alice 가 작성한 워크플로우: Start → Fetch(personalA). */
  let aliceWf: string;
  const aliceTrigger = randomUUID();
  const aliceNode = randomUUID();
  /** Bob 이 작성한 워크플로우. 노드 참조는 판정 도입 전 데이터처럼 SQL 로 personalA 를 넣는다. */
  let bobWf: string;
  const bobTrigger = randomUUID();
  const bobNode = randomUUID();

  const as = (actor: Actor) => ({
    get: (url: string) =>
      request(BASE_URL)
        .get(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws),
    post: (url: string, body: object = {}) =>
      request(BASE_URL)
        .post(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws)
        .send(body),
    patch: (url: string, body: object) =>
      request(BASE_URL)
        .patch(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws)
        .send(body),
    delete: (url: string) =>
      request(BASE_URL)
        .delete(url)
        .set('Authorization', `Bearer ${actor.accessToken}`)
        .set('X-Workspace-Id', ws),
  });

  /** 응답에서 «없는 통합과 같은가» 를 대조할 부분. 요청마다 달라지는 값은 뺀다. */
  const answerOf = (res: request.Response) => ({
    status: res.status,
    code: res.body?.error?.code,
    message: res.body?.error?.message,
    details: res.body?.error?.details,
  });

  const httpConfig = (integrationId: string | null) =>
    integrationId === null
      ? { method: 'GET', url: BLOCKED_URL, authentication: 'none' }
      : {
          method: 'GET',
          url: BLOCKED_URL,
          authentication: 'integration',
          integrationId,
        };

  const triggerNode = (id: string): CanvasNode => ({
    id,
    type: 'manual_trigger',
    category: 'trigger',
    label: 'Start',
    positionX: 0,
    positionY: 0,
    config: {},
  });

  const httpNode = (
    id: string,
    label: string,
    integrationId: string | null,
  ): CanvasNode => ({
    id,
    type: 'http_request',
    category: 'integration',
    label,
    positionX: 200,
    positionY: 0,
    config: httpConfig(integrationId),
  });

  const canvas = (triggerId: string, node: CanvasNode) => ({
    nodes: [triggerNode(triggerId), node],
    edges: [
      {
        sourceNodeId: triggerId,
        sourcePort: 'out',
        targetNodeId: node.id,
        targetPort: 'in',
      },
    ],
  });

  const createHttpIntegration = async (
    actor: Actor,
    scope: string,
  ): Promise<string> => {
    const res = await as(actor).post('/api/integrations', {
      serviceType: 'http',
      name: uniqueName(`ipu-${scope}`),
      authType: 'bearer_token',
      credentials: { token: `e2e-ipu-${scope}` },
      scope,
    });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  };

  const createWorkflow = async (actor: Actor): Promise<string> => {
    const res = await as(actor).post('/api/workflows', {
      name: uniqueName('ipu-wf'),
    });
    expect(res.status).toBe(201);
    return (res.body.data as { id: string }).id;
  };

  const readRef = async (nodeId: string): Promise<string | null> => {
    const r = await db.query<{ ref: string | null }>(
      `SELECT config->>'integrationId' AS ref FROM node WHERE id = $1`,
      [nodeId],
    );
    expect(r.rows).toHaveLength(1);
    return r.rows[0].ref;
  };

  /** 판정 도입 전에 저장된 참조를 흉내 낸다 — 저장 API 는 이제 이 값을 받지 않는다. */
  const writeLegacyRef = async (nodeId: string, integrationId: string) => {
    await db.query(
      `UPDATE node
          SET config = config || jsonb_build_object('authentication', 'integration', 'integrationId', $2::text)
        WHERE id = $1`,
      [nodeId, integrationId],
    );
  };

  /** Owner 가 실행하고 노드 출력의 `error` 를 읽는다. 판정은 실행한 사람이 아니라 워크플로우 작성자를 본다. */
  const runAndReadNodeError = async (
    workflowId: string,
    nodeId: string,
  ): Promise<{ code?: string; message?: string }> => {
    const exec = await as(owner).post(`/api/workflows/${workflowId}/execute`);
    expect(exec.status).toBe(202);
    const executionId = (exec.body.data as { executionId: string }).executionId;
    const deadline = Date.now() + 15_000;
    let status = '';
    while (Date.now() < deadline) {
      const res = await as(owner).get(`/api/executions/${executionId}`);
      if (res.status === 200) {
        status = (res.body.data as { status: string }).status;
        if (TERMINAL.includes(status)) break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(TERMINAL).toContain(status);
    const r = await db.query<{
      output_data: { output?: { error?: { code?: string; message?: string } } };
    }>(
      `SELECT output_data FROM node_execution
         WHERE execution_id = $1 AND node_id = $2
         ORDER BY started_at DESC LIMIT 1`,
      [executionId, nodeId],
    );
    expect(r.rows).toHaveLength(1);
    return r.rows[0].output_data?.output?.error ?? {};
  };

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();

    owner = await registerAndLogin(BASE_URL, uniqueEmail('ipu-own'), db);
    ws = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('IPU'),
    );
    alice = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('ipu-alice'),
      'editor',
      db,
    );
    bob = await inviteAndAccept(
      BASE_URL,
      owner.accessToken,
      ws,
      uniqueEmail('ipu-bob'),
      'editor',
      db,
    );
    const member = await db.query<{ id: string }>(
      'SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2',
      [ws, alice.userId],
    );
    aliceMemberId = member.rows[0].id;

    personalA = await createHttpIntegration(alice, 'personal');
    personalA2 = await createHttpIntegration(alice, 'personal');

    aliceWf = await createWorkflow(alice);
    const aliceSave = await as(alice).post(
      `/api/workflows/${aliceWf}/save`,
      canvas(aliceTrigger, httpNode(aliceNode, 'Fetch', personalA)),
    );
    expect(aliceSave.status).toBe(200);

    bobWf = await createWorkflow(bob);
    const bobSave = await as(bob).post(
      `/api/workflows/${bobWf}/save`,
      canvas(bobTrigger, httpNode(bobNode, 'Fetch', null)),
    );
    expect(bobSave.status).toBe(200);
    await writeLegacyRef(bobNode, personalA);
  }, 120_000);

  afterAll(async () => {
    await locker.end();
    await db.end();
  });

  it('사용처 — 워크플로우마다 작성자가 통합 소유자인지 알리고 작성자 id 는 싣지 않는다', async () => {
    // 전제: aliceWf · bobWf 의 노드가 모두 personalA 를 가리킨다(bobWf 는 판정 도입 전 데이터).
    const res = await as(alice).get(`/api/integrations/${personalA}/usages`);
    expect(res.status).toBe(200);
    const byWorkflow = new Map(
      (res.body.data as UsageWorkflow[]).map((w) => [w.workflowId, w]),
    );
    expect(byWorkflow.get(aliceWf)?.authorIsIntegrationOwner).toBe(true);
    expect(byWorkflow.get(bobWf)?.authorIsIntegrationOwner).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain(bob.userId);
  });

  it('노드 생성 · 수정 — 작성자와 저장자가 모두 소유자일 때만 받고, 거절은 없는 통합과 같은 400 이다', async () => {
    const scratch = await createWorkflow(alice);
    const createIn = (actor: Actor, workflowId: string, ref: string) =>
      as(actor).post(`/api/workflows/${workflowId}/nodes`, {
        type: 'http_request',
        category: 'integration',
        label: uniqueName('Fetch'),
        positionX: 0,
        positionY: 0,
        config: httpConfig(ref),
      });

    const absent = await createIn(alice, scratch, ABSENT_ID);
    expect(absent.status).toBe(400);
    expect(absent.body.error.message).toBe('Integration not found');
    // 저장자가 소유자가 아니다(작성자는 소유자).
    expect(answerOf(await createIn(bob, scratch, personalA))).toEqual(
      answerOf(absent),
    );
    // 작성자가 소유자가 아니다(저장자는 소유자).
    expect(answerOf(await createIn(alice, bobWf, personalA))).toEqual(
      answerOf(await createIn(alice, bobWf, ABSENT_ID)),
    );

    const created = await createIn(alice, scratch, personalA);
    expect(created.status).toBe(201);
    const nodeId = (created.body.data as { id: string }).id;

    const patchRef = (actor: Actor, ref: string) =>
      as(actor).patch(`/api/nodes/${nodeId}`, { config: httpConfig(ref) });
    expect(answerOf(await patchRef(bob, personalA2))).toEqual(
      answerOf(await patchRef(alice, ABSENT_ID)),
    );
    expect(await readRef(nodeId)).toBe(personalA);
    expect((await patchRef(alice, personalA2)).status).toBe(200);
    expect(await readRef(nodeId)).toBe(personalA2);
  });

  it('캔버스 저장 — 저장된 값과 같은 참조는 검사하지 않고, 바꾼 참조만 검사한다', async () => {
    // 전제: aliceWf 의 Fetch 가 personalA 를 가리킨다.
    // Bob 이 노드 이름만 바꾼다. personalA 는 Bob 이 쓸 수 없지만 저장된 값 그대로라 검사하지 않는다.
    const keep = await as(bob).post(
      `/api/workflows/${aliceWf}/save`,
      canvas(aliceTrigger, httpNode(aliceNode, 'Fetch (Bob)', personalA)),
    );
    expect(keep.status).toBe(200);
    expect(await readRef(aliceNode)).toBe(personalA);

    // Bob 이 참조를 Alice 의 다른 개인 통합으로 바꾸면 거절한다.
    const change = await as(bob).post(
      `/api/workflows/${aliceWf}/save`,
      canvas(aliceTrigger, httpNode(aliceNode, 'Fetch (Bob)', personalA2)),
    );
    expect(change.status).toBe(400);
    expect(change.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Integration not found',
      details: [
        { field: 'nodes[1].config.integrationId', code: 'INVALID_FIELD' },
      ],
    });
    expect(await readRef(aliceNode)).toBe(personalA);
  });

  /**
   * 동시 저장 — 낡은 캔버스 저장이 그 사이 바뀐 참조를 되돌리지 못한다(NERV Task `CLE-T-1BQZ10` W15).
   *
   * Bob 의 캔버스는 personalA 를 담은 채 낡았다. 그 사이 Alice 가 참조를 personalA2 로 바꿔 커밋한다. Bob 의 저장이 Alice 의
   * 커밋 전에 기준선을 읽으면 personalA 는 «저장된 값 그대로» 라 검사를 건너뛰고, 쓰는 시점에는 personalA2 를 personalA 로
   * 되돌린다. Bob 이 직접 넣었다면 거절됐을 값이다. 그래서 캔버스 저장은 워크플로우 행을 먼저 잠그고 그 뒤에 기준선을 읽는다.
   *
   * **겹침을 우연에 맡기지 않는다.** 두 저장을 `Promise.all` 로 걸면 순서가 매번 달라 고치기 전 코드도 자주 통과한다. 그래서
   * 테스트가 워크플로우 행 잠금(`FOR NO KEY UPDATE`)을 쥔 채 Alice 의 저장을 SQL 로 대신하고, 그동안 Bob 의 저장을 건다.
   * 선례는 `integration-rotate-concurrency.e2e-spec.ts` 다.
   *
   * 판별력: 기준선 읽기를 잠금 앞으로 옮긴 뮤턴트에서 Bob 의 저장은 200 이라 ①이 RED 다. 참조도 personalA 로 돌아가 다음
   * 테스트의 사본이 personalA 를 가리킨다(2026-10-25 실측).
   * 잠금 줄만 지운 뮤턴트는 판별 대상이 아니다. 바로 뒤의 버전 UPDATE 가 같은 행 잠금을 잡아 기준선 읽기가 여전히 잠금
   * 뒤에 오므로 동작이 같다.
   */
  it('동시 저장 — 잠금을 기다린 저장은 그 사이 바뀐 참조를 기준선으로 보고 거절한다', async () => {
    // 전제: aliceWf 의 Fetch 는 이름 'Fetch (Bob)', 참조 personalA 다. Bob 의 캔버스는 이 상태 그대로다(값 변화 없음).
    let pending:
      Promise<{ settled: true; status: number; err?: Error }> | undefined;
    await locker.query('BEGIN');
    try {
      await locker.query(
        'SELECT id FROM workflow WHERE id = $1 FOR NO KEY UPDATE',
        [aliceWf],
      );
      // Alice 의 저장을 대신한다 — 잠금을 쥔 저장이 참조를 personalA2 로 바꿨다.
      await locker.query(
        `UPDATE node SET config = jsonb_set(config, '{integrationId}', to_jsonb($2::text)) WHERE id = $1`,
        [aliceNode, personalA2],
      );

      pending = as(bob)
        .post(
          `/api/workflows/${aliceWf}/save`,
          canvas(aliceTrigger, httpNode(aliceNode, 'Fetch (Bob)', personalA)),
        )
        .then(
          (res) => ({ settled: true as const, status: res.status }),
          (err: Error) => ({ settled: true as const, status: -1, err }),
        );

      // 공허성 가드 — 잠금을 놓기 전에 Bob 의 저장이 아직 끝나지 않았음을 본다. 먼저 끝났다면 겹침이 없었다.
      const raced = await Promise.race([
        pending,
        new Promise<{ settled: false }>((resolve) =>
          setTimeout(() => resolve({ settled: false }), VACUITY_GUARD_MS),
        ),
      ]);
      expect(raced.settled).toBe(false);

      await locker.query('COMMIT');
      // ① 기준선은 Alice 가 커밋한 personalA2 라 Bob 의 personalA 는 바꾼 참조다.
      expect((await pending).status).toBe(400);
      // ② Alice 의 값이 남는다.
      expect(await readRef(aliceNode)).toBe(personalA2);
    } finally {
      // 정상 경로에서는 이미 COMMIT 됐으므로 no-op 이다. 단언이 실패해 COMMIT 을 못 탔을 때만 잠금을 풀어 pending 을 끝낸다.
      await locker.query('ROLLBACK').catch(() => undefined);
      await pending;
    }
  });

  it('복제 · 가져오기 — 요청자가 쓸 수 없는 참조는 비우고 응답으로 알린다', async () => {
    // 전제: aliceWf 의 Fetch 가 personalA2 를 가리킨다.
    const copiedNodeOf = async (workflowId: string): Promise<string> => {
      const r = await db.query<{ id: string }>(
        `SELECT id FROM node WHERE workflow_id = $1 AND type = 'http_request'`,
        [workflowId],
      );
      expect(r.rows).toHaveLength(1);
      return r.rows[0].id;
    };
    const expectCleared = async (res: request.Response) => {
      expect(res.status).toBe(201);
      const data = res.body.data as {
        id: string;
        clearedIntegrationRefs: ClearedRef[];
      };
      const nodeId = await copiedNodeOf(data.id);
      expect(data.clearedIntegrationRefs).toEqual([
        { nodeId, nodeLabel: 'Fetch (Bob)', field: 'config.integrationId' },
      ]);
      expect(await readRef(nodeId)).toBeNull();
    };
    const expectKept = async (res: request.Response) => {
      expect(res.status).toBe(201);
      const data = res.body.data as {
        id: string;
        clearedIntegrationRefs: ClearedRef[];
      };
      expect(data.clearedIntegrationRefs).toEqual([]);
      expect(await readRef(await copiedNodeOf(data.id))).toBe(personalA2);
    };

    await expectCleared(
      await as(bob).post(`/api/workflows/${aliceWf}/duplicate`),
    );
    await expectKept(
      await as(alice).post(`/api/workflows/${aliceWf}/duplicate`),
    );

    const exported = await as(bob).get(`/api/workflows/${aliceWf}/export`);
    expect(exported.status).toBe(200);
    await expectCleared(
      await as(bob).post('/api/workflows/import', exported.body.data),
    );
    await expectKept(
      await as(alice).post('/api/workflows/import', exported.body.data),
    );
  });

  it('실행 — 작성자가 소유자가 아니면 없는 통합과 같이 실패하고, 실행한 사람은 보지 않는다', async () => {
    // 전제: aliceWf → personalA2(작성자 Alice), bobWf → personalA(작성자 Bob, 판정 도입 전 데이터).
    // Owner 가 둘 다 실행한다. Alice 의 워크플로우는 통합 조회를 통과해 SSRF 가드까지 간다.
    expect((await runAndReadNodeError(aliceWf, aliceNode)).code).toBe(
      'HTTP_BLOCKED',
    );
    const rejected = await runAndReadNodeError(bobWf, bobNode);
    expect(rejected.message).toBe('Integration not found');

    await writeLegacyRef(bobNode, ABSENT_ID);
    expect(await runAndReadNodeError(bobWf, bobNode)).toEqual(rejected);
  }, 60_000);

  it('소유자가 멤버에서 빠지면 그 개인 통합은 실행 · 버전 복원에서 쓰지 않는다', async () => {
    // 전제: aliceWf 의 Fetch 는 personalA2 를, 최신 버전 스냅샷은 personalA 를 가리킨다(동시 저장의 Alice 쪽 변경은 SQL
    // 이라 버전이 없다). 복원은 지금 저장된 값과 다른 참조만 판정한다(REQ-WFVER-026).
    const latestVersion = async (): Promise<string> => {
      const list = await as(owner).get(`/api/workflows/${aliceWf}/versions`);
      expect(list.status).toBe(200);
      const versions = list.body.data as Array<{ id: string }>;
      expect(versions.length).toBeGreaterThanOrEqual(1);
      return versions[0].id;
    };
    const restore = async () =>
      as(owner).post(
        `/api/workflows/${aliceWf}/versions/${await latestVersion()}/restore`,
      );

    // 대조군 — 소유자가 멤버인 동안 Owner 의 복원은 바뀐 참조를 판정하고 남긴다(복원은 저장자를 보지 않는다).
    const kept = await restore();
    expect(kept.status).toBe(200);
    expect(kept.body.data.clearedIntegrationRefs).toEqual([]);
    expect(await readRef(aliceNode)).toBe(personalA);

    const removed = await as(owner).delete(
      `/api/workspaces/${ws}/members/${aliceMemberId}`,
    );
    expect(removed.status).toBe(200);

    expect((await runAndReadNodeError(aliceWf, aliceNode)).message).toBe(
      'Integration not found',
    );

    // 지금 저장된 값과 같은 참조는 판정하지 않으므로 남는다.
    const same = await restore();
    expect(same.status).toBe(200);
    expect(same.body.data.clearedIntegrationRefs).toEqual([]);
    expect(await readRef(aliceNode)).toBe(personalA);

    // 저장된 값이 다르면 판정하고, 소유자가 멤버가 아니라 비운다.
    await writeLegacyRef(aliceNode, personalA2);
    const cleared = await restore();
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.clearedIntegrationRefs).toEqual([
      {
        nodeId: aliceNode,
        nodeLabel: 'Fetch (Bob)',
        field: 'config.integrationId',
      },
    ]);
    expect(await readRef(aliceNode)).toBeNull();
  }, 60_000);
});
