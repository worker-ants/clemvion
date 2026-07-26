import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: spec/conventions/node-cancellation.md — 외부 cancel 이 **다단계 워크플로우의
 * 진행 중 노드를 지나 전파**되어 실행이 `cancelled` 로 확정되는지.
 *
 * ## 왜 e2e 인가 (이 시나리오의 커버리지는 0 이었다)
 *
 * `node-cancellation-inflight-followups.md` §3. 두 plan 이 서로에게 미룬 순환 참조로
 * 이 시나리오의 e2e 가 **한 번도 작성되지 않았다** — 2026-07-17 grooming 이 실측으로
 * 확인했다. 기존 `cancelled` 단언은 전부 **노드 dispatch 전 회수**다:
 * `execution-concurrency-cap`(큐 대기 타임아웃/orphan) · `webchat-idle-reaper`(idle).
 * 즉 "노드가 이미 돌고 있을 때" 의 전파는 아무도 잠그고 있지 않았다.
 *
 * 단위 테스트(`database-query.handler.spec.ts` §2.1)가 driver-level in-flight cancel
 * (pg_cancel_backend / KILL QUERY)과 AbortError→cancelled 분류를 결정적으로 검증한다.
 * 여기서 검증하는 것은 그 위층 — **엔진이 다음 노드로 넘어가지 않고 실행을 cancelled 로
 * 확정하는가**.
 *
 * ## 기전 규명 완료(2026-07-26) — 가드가 없어서 특정되지 않았던 것이었다
 *
 * 초안 주석은 `context.abortSignal?.throwIfAborted()` 를 근거로 들었으나 **틀렸다**:
 * `abortSignal` 대입은 저장소 전체에서 `parallel-executor.ts`(parallel branch 전용) 한 곳뿐이라
 * 이 **선형·비-resume 경로에서는 항상 undefined** 다. 후속 라운드에 "guarded UPDATE" 를 대안
 * 근거로 들었으나 그 역시 §7.5 resume-claim 전용 경로였다. (ai-review 2R 에서 독립 reviewer
 * 3명이 수렴 지적.) **결론: 그 시점엔 보장하는 코드가 실제로 없었다** — e2e 는 `waitForTerminalStatus`
 * 가 stop 직후 즉시 반환하는 타이밍 덕에 통과하고 있었을 뿐(노드 A 가 아직 busy-wait 중일 때
 * 하류를 조회해 가드 없이도 통과하는 구조), 우연이 아니라 진짜 결함이었다.
 *
 * 수정: `ExecutionEngineService.assertExecutionNotCancelled()` 를 노드 경계 가드로 도입해
 * `runExecution`/`runNodeDispatchLoop`/`executeInline` 세 순회 루프 전부에 배치했다(§2.3).
 * 노드 사이마다 Execution 행을 다시 읽어 외부 cancel(DB UPDATE)을 관측하고
 * `ExecutionCancelledError` 로 dispatch 를 중단한다. 엔진 단위 테스트
 * (`execution-engine.service.spec.ts` 의 "선형 경로 외부 cancel 전파" / "재개 중 외부 cancel..."
 * describe)가 이 계약을 mutation 검증까지 마쳐 결정적으로 고정한다 — 가드를 한 줄씩 제거하면
 * 각각 RED, 복원하면 GREEN. 본 e2e 는 그 위에서 HTTP 왕복 + 실 DB 를 통한 통합 확인이다.
 * 관측 시점도 함께 고쳤다 — A 의 종료를 기다린 뒤 하류를 조회하도록(옛 관측은 A 가 아직
 * busy-wait 중일 때 조회해 가드 없이도 통과했다).
 *
 * ## 결정적 하네스 (flaky 회피 설계)
 *
 * 원 plan 은 "느린 쿼리 + 타이밍 맞춘 외부 cancel" 이 필요해 flaky 하다고 판단해 보류했다.
 * 그 전제를 두 가지로 깬다:
 *
 *  1. **고정 sleep 으로 타이밍을 맞추지 않는다.** `node_execution` 행이 `running` 이 되는
 *     것을 폴링해 "노드가 실제로 진행 중" 을 관측한 뒤에만 stop 을 쏜다. 경합이 아니라
 *     관측된 상태에 반응하므로 느린 CI 에서도 순서가 뒤집히지 않는다.
 *  2. **in-flight 중단 자체를 단언하지 않는다.** code 노드(isolated-vm)는 driver-level
 *     중단 대상이 아니라 best-effort 로 완주한다(spec 이 명시한 정상 동작). 그래서
 *     "얼마나 빨리 끊겼나" 대신 **전파의 결과**만 본다: 실행이 `cancelled` 로 확정되고
 *     **하류 노드가 절대 실행되지 않는다**. 이 단언은 A 가 언제 끝나든 성립한다.
 *
 * 즉 타이밍 의존 축을 단언에서 제거했기 때문에 결정적이다. 그 대가로 driver-level
 * 중단(§1)은 여기서 다루지 않는다 — 그쪽은 단위 테스트가 이미 결정적으로 잠근다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const MANUAL_TRIGGER_TYPE = 'manual_trigger';
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;

/**
 * 진행 중 노드가 열어 두는 창(ms). 관측(폴링) 후 stop 을 쏘므로 타이밍 맞추기용이
 * 아니라, **stop 왕복이 끝나기 전에 노드가 먼저 끝나버리지 않게** 하는 여유다.
 * 노드 config 의 `timeout`(초)보다 반드시 작아야 한다 — 크면 노드가 timeout 으로
 * failed 가 되어 cancel 전파가 아닌 다른 경로를 재게 된다.
 *
 * 5초인 이유: 폴링이 `running` 을 100ms 주기로 관측하고 stop 은 단일 HTTP 왕복이라
 * 실사용 여유는 수백 ms 면 충분하다. 이 노드는 busy-wait(아래 참고)이라 그동안 코어
 * 하나를 점유하므로, 마진은 넉넉하되 낭비하지 않는 값으로 잡는다.
 */
const INFLIGHT_WINDOW_MS = 5_000;
const CODE_TIMEOUT_SEC = 30;

interface CanvasNode {
  id: string;
  type: string;
  category: string;
  label: string;
  positionX: number;
  positionY: number;
  config?: Record<string, unknown>;
}

describe('노드 취소 전파 (e2e, node-cancellation.md §5)', () => {
  let db: Client;
  let ownerToken: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('cancelprop'),
      db,
    );
    ownerToken = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      ownerToken,
      uniqueName('CANCELPROP'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  const authHeader = () => ({ Authorization: `Bearer ${ownerToken}` });

  /**
   * trigger → A(진행 중 창을 여는 code) → B(도달하면 안 되는 code).
   * B 가 실행되면 "전파 실패" 가 관측 가능해진다 — 이 워크플로가 2단계인 이유.
   */
  async function createTwoStepWorkflow(): Promise<{
    workflowId: string;
    slowNodeId: string;
    downstreamNodeId: string;
  }> {
    const res = await request(BASE_URL)
      .post('/api/workflows')
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('cancel-prop-wf') });
    expect(res.status).toBe(201);
    const workflowId = res.body.data.id as string;

    const trigger: CanvasNode = {
      id: randomUUID(),
      type: MANUAL_TRIGGER_TYPE,
      category: 'trigger',
      label: 'Start',
      positionX: 0,
      positionY: 0,
    };
    const slow: CanvasNode = {
      id: randomUUID(),
      type: 'code',
      category: 'data',
      label: 'InFlight',
      positionX: 240,
      positionY: 0,
      config: {
        language: 'javascript',
        // **busy-wait 인 이유**: code 노드는 하드닝으로 `setTimeout`/`setInterval`/
        // `setImmediate`/`queueMicrotask` 를 isolate 의 globalThis 에서 **삭제**한다
        // (`code.handler.ts` 의 delete 목록). 그래서 창을 여는 유일한 수단이 동기
        // 루프다. `Date` 는 삭제 대상이 아니다(dayjs 스냅샷도 이에 기댄다).
        // isolated-vm 의 `timeout` 은 wall-clock 이라 CODE_TIMEOUT_SEC 안에서 끝난다.
        code:
          `const __end = Date.now() + ${INFLIGHT_WINDOW_MS};\n` +
          `while (Date.now() < __end) {}\n` +
          `return { ok: true };`,
        timeout: CODE_TIMEOUT_SEC,
      },
    };
    const downstream: CanvasNode = {
      id: randomUUID(),
      type: 'code',
      category: 'data',
      label: 'MustNotRun',
      positionX: 480,
      positionY: 0,
      config: {
        language: 'javascript',
        code: 'return { reached: true };',
        timeout: 5,
      },
    };
    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({
        nodes: [trigger, slow, downstream],
        edges: [
          {
            sourceNodeId: trigger.id,
            sourcePort: 'out',
            targetNodeId: slow.id,
            targetPort: 'in',
          },
          {
            // code 노드의 출력 포트는 `success`/`error` 다 (`code.schema.ts`).
            // `out` 으로 쓰면 엣지가 어디에도 붙지 않아 하류가 조용히 도달 불가가
            // 되고, "하류가 실행되지 않았다" 단언이 **취소와 무관하게** 참이 된다.
            // 실제로 이 파일의 초안이 그렇게 vacuous 하게 통과했고, 아래 대조군
            // 테스트가 그것을 잡아냈다.
            sourceNodeId: slow.id,
            sourcePort: 'success',
            targetNodeId: downstream.id,
            targetPort: 'in',
          },
        ],
      });
    expect([200, 201]).toContain(save.status);
    return {
      workflowId,
      slowNodeId: slow.id,
      downstreamNodeId: downstream.id,
    };
  }

  async function execute(workflowId: string): Promise<string> {
    const res = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(res.status).toBe(202);
    return (res.body.data as { executionId: string }).executionId;
  }

  async function getStatus(executionId: string): Promise<string> {
    const res = await request(BASE_URL)
      .get(`/api/executions/${executionId}`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId);
    return res.status === 200
      ? (res.body.data as { status: string }).status
      : '';
  }

  /** 노드 단위 상태는 DB 로 직접 본다 — 같은 파일군의 확립된 관행. */
  async function nodeStatus(
    executionId: string,
    nodeId: string,
  ): Promise<string | null> {
    const r = await db.query<{ status: string }>(
      `SELECT status FROM node_execution WHERE execution_id = $1 AND node_id = $2`,
      [executionId, nodeId],
    );
    return r.rows[0]?.status ?? null;
  }

  async function waitUntil<T>(
    probe: () => Promise<T>,
    done: (v: T) => boolean,
    timeoutMs: number,
    label: string,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let last: T = await probe();
    while (!done(last)) {
      if (Date.now() > deadline) {
        throw new Error(`timeout waiting for ${label} — last=${String(last)}`);
      }
      await new Promise((r) => setTimeout(r, 100));
      last = await probe();
    }
    return last;
  }

  /** terminal 도달 대기 — `waitForNodeRunning` 과 대칭. */
  async function waitForTerminalStatus(
    executionId: string,
    label: string,
  ): Promise<string> {
    return waitUntil(
      () => getStatus(executionId),
      (s) => (TERMINAL_STATUSES as readonly string[]).includes(s),
      60_000,
      label,
    );
  }

  /** "그 노드가 실제로 진행 중" 을 관측한다 — 이 파일의 결정성이 여기 달려 있다. */
  async function waitForNodeRunning(
    executionId: string,
    nodeId: string,
  ): Promise<void> {
    await waitUntil(
      () => nodeStatus(executionId, nodeId),
      (s) => s === 'running',
      30_000,
      'in-flight node to start running',
    );
  }

  it('진행 중 노드가 있는 실행을 stop 하면 cancelled 로 확정되고 하류 노드는 실행되지 않는다', async () => {
    const { workflowId, slowNodeId, downstreamNodeId } =
      await createTwoStepWorkflow();
    const executionId = await execute(workflowId);

    // (1) 고정 sleep 이 아니라 **관측**: A 가 실제로 running 이 될 때까지 기다린다.
    await waitForNodeRunning(executionId, slowNodeId);

    // (2) 노드가 진행 중인 바로 그 순간 외부 cancel.
    const stop = await request(BASE_URL)
      .post(`/api/executions/${executionId}/stop`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(stop.status).toBe(200);

    // (3) 전파의 결과 — 실행이 terminal 로 가면 그것은 cancelled 여야 한다.
    //     A 의 완주를 기다리므로 INFLIGHT_WINDOW_MS + 여유를 준다.
    const finalStatus = await waitForTerminalStatus(
      executionId,
      'execution to reach a terminal status',
    );
    expect(finalStatus).toBe('cancelled');

    // (4-pre) **관측 시점 고정.** stop 은 Execution 행을 동기로 cancelled 로 바꾸므로
    //     위 waitForTerminalStatus 는 노드 A 가 아직 busy-wait 중이어도 **즉시** 반환한다.
    //     그 시점에 하류를 조회하면 "아직 안 만들어진 행"을 "안 만들어질 행"으로 오독해
    //     가드가 없어도 통과한다(2026-07-26 실측: 엔진에 dispatch 사전 cancel 체크가
    //     아예 없던 동안에도 이 단언이 통과했다). A 가 실제로 끝난 뒤에 판정한다.
    await waitUntil(
      () => nodeStatus(executionId, slowNodeId),
      (s) => s !== null && s !== 'running' && s !== 'pending',
      60_000,
      'slow node A to reach a terminal status',
    );
    // A 종료 후 루프가 하류를 dispatch 할 여유를 준다 — 가드가 없다면 이 창에서
    // 하류 행이 생긴다(그러면 아래 단언이 실패한다).
    await new Promise((r) => setTimeout(r, 2_000));

    // (4) 다단계의 핵심 — 하류 노드는 실행되지 않는다.
    //
    // **허용 집합 양성 비교**(배제 방식 아님): `not.toBe('completed')` 류는 취소와
    // 무관한 별개 버그로 `failed` 같은 다른 상태에 도달해도 통과해, "하류가 도달하지
    // 않았다" 는 주장이 거짓 양성으로 성립한다(ai-review testing WARNING 4).
    // 허용되는 결과는 둘뿐이다: 행 자체가 없거나(dispatch 전에 끊김) `cancelled`.
    const downstream = await nodeStatus(executionId, downstreamNodeId);
    expect([null, 'cancelled']).toContain(downstream);
  }, 120_000);

  it('[대조군] stop 하지 않으면 하류 노드가 실제로 실행된다 (위 단언의 비-vacuity)', async () => {
    // 이 테스트가 없으면 위 단언이 **엉뚱한 이유로** 통과할 수 있다: 워크플로가
    // 실제로 체인되지 않으면(엣지 오류 등) 하류 노드는 cancel 과 무관하게 애초에
    // 실행되지 않으므로 `not.toBe('completed')` 가 공허하게 참이 된다.
    // 같은 워크플로를 취소 없이 돌려 하류가 정말 도달 가능함을 고정한다.
    const { workflowId, downstreamNodeId } = await createTwoStepWorkflow();
    const executionId = await execute(workflowId);

    const finalStatus = await waitForTerminalStatus(
      executionId,
      'uncancelled execution to finish',
    );
    expect(finalStatus).toBe('completed');
    expect(await nodeStatus(executionId, downstreamNodeId)).toBe('completed');
  }, 120_000);

  it('취소된 실행은 재-stop 을 거부한다 (terminal 재진입 방지)', async () => {
    const { workflowId, slowNodeId } = await createTwoStepWorkflow();
    const executionId = await execute(workflowId);
    await waitForNodeRunning(executionId, slowNodeId);
    expect(
      (
        await request(BASE_URL)
          .post(`/api/executions/${executionId}/stop`)
          .set(authHeader())
          .set('X-Workspace-Id', workspaceId)
          .send({})
      ).status,
    ).toBe(200);

    await waitForTerminalStatus(
      executionId,
      'execution to reach a terminal status',
    );

    // terminal 이 된 뒤의 stop 은 400 — "이미 완료/실패/취소된 실행" 계약.
    const second = await request(BASE_URL)
      .post(`/api/executions/${executionId}/stop`)
      .set(authHeader())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(second.status).toBe(400);
  }, 120_000);
});
