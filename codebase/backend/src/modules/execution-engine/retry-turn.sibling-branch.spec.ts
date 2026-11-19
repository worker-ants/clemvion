import { RetryTurnService } from './retry-turn.service';
import { ExecutionContextService } from './context/execution-context.service';
import { NodeExecutionStatus } from '../node-executions/entities/node-execution.entity';
import { ExecutionStatus } from '../executions/entities/execution.entity';
import { NodeEventType } from '../websocket/websocket-events.types';
import { PARK_RELEASED } from '../../shared/execution-resume/process-turn-result';

// ────────────────────────────────────────────────────────────────────────────
// CLE-T-DJ3VC8 — 병렬 분기 안에서 실패한 AI 노드의 마지막 턴 재시도.
//
// Parallel 의 errorPolicy 가 `continue` 면 한 분기가 실패해도 다른 분기는 계속 돌고
// 실행은 `running` 이다. 이때 실패한 분기의 노드 실행에 재시도가 들어오면 재진입이
// 본 흐름과 같은 실행을 함께 몬다. 이 파일은 행 상태를 메모리 저장소에 두고 그
// 이야기를 순서대로 따라간다. 단위 단언(SQL 형태 · 이벤트 순서)은
// `retry-turn.service.spec.ts` 가 맡는다.
//
// 저장소는 서비스가 쓰는 조건부 UPDATE 형태만 해석한다. 모르는 SQL 이 오면 던져서
// 해석기가 조용히 통과시키지 않게 한다. 실행 행의 UPDATE 는 같은 실행의 형제 재시도를
// 하나만 들여보내는 실행 단위 claim(CLE-T-T9HZX7)이다.
// ────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string };

const EXEC = 'exec-par';
const PARALLEL_NE = 'ne-parallel';
const FAILED_NE = 'ne-branch-a';
const SIBLING_NE = 'ne-branch-b';
const AI_NODE = 'n-ai-a';

function createStore() {
  const nodeRows = new Map<string, Row>();
  const execution: Row = {
    id: EXEC,
    status: ExecutionStatus.RUNNING,
    finishedAt: null,
    error: null,
    durationMs: null,
  };
  let seq = 0;

  function makeQb(target: 'node' | 'execution' = 'node') {
    const conds: Array<[string, Record<string, unknown>]> = [];
    let setValues: Record<string, unknown> = {};
    const params: Record<string, unknown> = {};
    const qb = {
      update: () => qb,
      set: (v: Record<string, unknown>) => {
        setValues = v;
        return qb;
      },
      where: (sql: string, p: Record<string, unknown> = {}) => {
        conds.push([sql, p]);
        Object.assign(params, p);
        return qb;
      },
      andWhere: (sql: string, p: Record<string, unknown> = {}) => {
        conds.push([sql, p]);
        Object.assign(params, p);
        return qb;
      },
      execute: () => {
        const rows = target === 'node' ? [...nodeRows.values()] : [execution];
        const matches = rows.filter((row) =>
          conds.every(([sql]) => {
            if (sql === 'id = :id') return row.id === params.id;
            if (sql === 'status = :running')
              return row.status === params.running;
            if (target === 'execution' && sql === 'status = :failed')
              return row.status === params.failed;
            if (target === 'execution' && sql === 'finished_at IS NOT NULL')
              return row.finishedAt != null;
            const m =
              /^jsonb_exists\((input_data|output_data), :retryStateKey\)$/.exec(
                sql,
              );
            if (m) {
              const col = m[1] === 'input_data' ? 'inputData' : 'outputData';
              const obj = row[col] as Record<string, unknown> | null;
              return (
                !!obj && Object.hasOwn(obj, params.retryStateKey as string)
              );
            }
            throw new Error(`해석하지 못하는 조건: ${sql}`);
          }),
        );
        for (const row of matches) {
          for (const [k, v] of Object.entries(setValues)) {
            if (typeof v !== 'function') {
              row[k] = v;
              continue;
            }
            const expr = (v as () => string)();
            const m =
              /^(input_data|output_data) - CAST\(:retryStateKey AS text\)$/.exec(
                expr,
              );
            if (!m) throw new Error(`해석하지 못하는 SET 식: ${expr}`);
            const next = { ...(row[k] as Record<string, unknown>) };
            delete next[params.retryStateKey as string];
            row[k] = next;
          }
        }
        return Promise.resolve({ affected: matches.length });
      },
    };
    return qb;
  }

  const nodeExecutionRepository = {
    findOneBy: ({ id }: { id: string }) =>
      Promise.resolve(nodeRows.get(id) ?? null),
    save: (row: Row) => {
      nodeRows.set(row.id, row);
      return Promise.resolve(row);
    },
    createQueryBuilder: () => makeQb(),
  };
  // 서비스는 읽은 엔티티를 고친다. 저장소 행과 갈라 두어야 DB 에 실제로 쓴 값만 본다.
  const executionRepository = {
    findOneBy: ({ id }: { id: string }) =>
      Promise.resolve(id === EXEC ? { ...execution } : null),
    createQueryBuilder: () => makeQb('execution'),
  };
  const dataSource = {
    transaction: (cb: (m: unknown) => Promise<unknown>) =>
      cb({
        createQueryBuilder: () => makeQb(),
        create: (_t: unknown, data: Record<string, unknown>) => {
          seq += 1;
          return { id: `ne-spawned-${seq}`, startedAt: new Date(), ...data };
        },
        save: (_t: unknown, row: Row) => {
          nodeRows.set(row.id, row);
          return Promise.resolve(row);
        },
      }),
  };
  return {
    nodeRows,
    execution,
    nodeExecutionRepository,
    executionRepository,
    dataSource,
  };
}

describe('RetryTurnService — 병렬 분기 안의 마지막 턴 재시도 (CLE-T-DJ3VC8)', () => {
  let store: ReturnType<typeof createStore>;
  let service: RetryTurnService;
  let emitNode: jest.Mock;
  let processAiResumeTurn: jest.Mock;
  let contextService: ExecutionContextService;
  let driver: Record<string, jest.Mock>;

  beforeEach(() => {
    store = createStore();
    // Parallel 노드 실행 아래 두 분기. A 는 재시도 가능한 오류로 실패했고 B 는 아직 돈다.
    store.nodeRows.set(PARALLEL_NE, {
      id: PARALLEL_NE,
      executionId: EXEC,
      nodeId: 'n-parallel',
      status: NodeExecutionStatus.RUNNING,
    });
    store.nodeRows.set(FAILED_NE, {
      id: FAILED_NE,
      executionId: EXEC,
      nodeId: AI_NODE,
      status: NodeExecutionStatus.FAILED,
      parentNodeExecutionId: PARALLEL_NE,
      startedAt: new Date(Date.now() - 60_000),
      finishedAt: new Date(Date.now() - 60_000),
      outputData: {
        output: {
          error: {
            code: 'LLM_RATE_LIMIT',
            message: 'rate limited',
            details: { retryable: true },
          },
        },
        _retryState: {
          messages: [{ role: 'user', content: 'hi' }],
          turnCount: 1,
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        },
      },
    });
    store.nodeRows.set(SIBLING_NE, {
      id: SIBLING_NE,
      executionId: EXEC,
      nodeId: 'n-branch-b',
      status: NodeExecutionStatus.RUNNING,
      parentNodeExecutionId: PARALLEL_NE,
    });

    emitNode = jest.fn().mockResolvedValue(undefined);
    processAiResumeTurn = jest.fn();
    contextService = new ExecutionContextService();
    driver = {
      rehydrateContext: jest.fn(),
      buildRetryReentryState: jest.fn(),
      contextKeyOf: jest.fn((ctx: { executionId: string }) => ctx.executionId),
      clearLlmDefaultConfigCache: jest.fn(),
    };
    service = new RetryTurnService(
      store.executionRepository as unknown as never,
      store.nodeExecutionRepository as unknown as never,
      {
        findOneBy: jest.fn(({ id }: { id: string }) =>
          Promise.resolve({ id, type: 'ai_agent' }),
        ),
      } as unknown as never,
      store.dataSource as unknown as never,
      contextService,
      {
        emitNode,
        emitExecution: jest.fn(),
        emitTerminalExecution: jest.fn(),
      } as unknown as never,
      {} as unknown as never,
      { processAiResumeTurn } as unknown as never,
      driver as unknown as never,
    );
  });

  function retryStateOf(id: string): unknown {
    return (store.nodeRows.get(id)?.outputData as Record<string, unknown>)
      ._retryState;
  }

  it('다른 분기가 도는 동안(실행 running)에는 거절하고, 실행이 failed 로 끝난 뒤에는 받는다', async () => {
    // 1) 분기 B 가 아직 돈다. 실행은 running 이다.
    await expect(service.retryLastTurn(EXEC, FAILED_NE)).rejects.toMatchObject({
      code: 'INVALID_EXECUTION_STATE',
    });
    // `_retryState` 는 그대로라 나중에 다시 시도할 수 있다. 새 행도 없다.
    expect(retryStateOf(FAILED_NE)).toBeDefined();
    expect(store.nodeRows.size).toBe(3);

    // 2) 분기 B 가 끝나고 Parallel 이 실패를 올려 실행이 failed 로 끝났다.
    store.nodeRows.get(SIBLING_NE)!.status = NodeExecutionStatus.COMPLETED;
    store.nodeRows.get(PARALLEL_NE)!.status = NodeExecutionStatus.FAILED;
    store.execution.status = ExecutionStatus.FAILED;
    store.execution.finishedAt = new Date();

    const { spawnedNodeExecutionId } = await service.retryLastTurn(
      EXEC,
      FAILED_NE,
    );

    // 새 행은 같은 Parallel 노드 실행 아래에 running 으로 생긴다.
    const spawned = store.nodeRows.get(spawnedNodeExecutionId)!;
    expect(spawned).toMatchObject({
      executionId: EXEC,
      nodeId: AI_NODE,
      status: NodeExecutionStatus.RUNNING,
      parentNodeExecutionId: PARALLEL_NE,
    });
    expect(
      (spawned.inputData as Record<string, unknown>)._retryState,
    ).toBeDefined();
    // 원래 행의 `_retryState` 는 소비됐고 다른 출력은 남는다.
    expect(retryStateOf(FAILED_NE)).toBeUndefined();
    expect(
      (store.nodeRows.get(FAILED_NE)!.outputData as Record<string, unknown>)
        .output,
    ).toBeDefined();
    // 두 번째 시도는 이미 소비된 상태라 거절된다.
    await expect(service.retryLastTurn(EXEC, FAILED_NE)).rejects.toMatchObject({
      code: 'RETRY_STATE_NOT_FOUND',
    });
  });

  it('명령은 받았지만 워커가 꺼내기 전에 실행이 running 으로 바뀌면 새 행을 failed 로 마감하고 node.failed 를 낸다', async () => {
    store.execution.status = ExecutionStatus.FAILED;
    store.execution.finishedAt = new Date();
    const { spawnedNodeExecutionId } = await service.retryLastTurn(
      EXEC,
      FAILED_NE,
    );
    // 같은 실행의 다른 재시도가 먼저 재진입해 실행을 running 으로 돌려놨다.
    store.execution.status = ExecutionStatus.RUNNING;

    await service.applyRetryLastTurn(EXEC, spawnedNodeExecutionId);

    const spawned = store.nodeRows.get(spawnedNodeExecutionId)!;
    expect(spawned.status).toBe(NodeExecutionStatus.FAILED);
    expect(spawned.error).toEqual({
      message: 'Retry re-entry rejected: execution is no longer failed',
    });
    // 배달 claim 으로 키는 지워졌으니 같은 배달이 다시 와도 재진입하지 않는다.
    expect(
      (spawned.inputData as Record<string, unknown>)._retryState,
    ).toBeUndefined();
    expect(processAiResumeTurn).not.toHaveBeenCalled();
    expect(emitNode).not.toHaveBeenCalledWith(
      EXEC,
      AI_NODE,
      NodeEventType.NODE_STARTED,
      expect.anything(),
    );
    // 클라이언트는 새 행의 node.failed 로 거절을 안다(CLE-T-T9HZX7).
    expect(emitNode).toHaveBeenCalledWith(
      EXEC,
      AI_NODE,
      NodeEventType.NODE_FAILED,
      expect.objectContaining({
        nodeExecutionId: spawnedNodeExecutionId,
        parentNodeExecutionId: PARALLEL_NE,
        error: 'Retry re-entry rejected: execution is no longer failed',
      }),
    );
    // 실행 상태는 건드리지 않는다.
    expect(store.execution.status).toBe(ExecutionStatus.RUNNING);
  });

  // CLE-T-T9HZX7 — 두 분기가 모두 재시도 가능한 오류로 실패해 실행이 `failed` 로
  // 끝났다. 두 행에 각각 재시도를 누르면 명령 시점 확인과 배달 claim 은 행마다 따로라
  // 둘 다 통과한다. 실행 행의 조건부 UPDATE 가 하나만 들여보낸다.
  it('같은 실행의 형제 재시도 둘이 함께 오면 하나만 재진입하고 다른 하나는 node.failed 로 거절한다', async () => {
    const sibling = store.nodeRows.get(SIBLING_NE)!;
    sibling.nodeId = 'n-ai-b';
    sibling.status = NodeExecutionStatus.FAILED;
    sibling.finishedAt = new Date(Date.now() - 30_000);
    sibling.outputData = JSON.parse(
      JSON.stringify(store.nodeRows.get(FAILED_NE)!.outputData),
    ) as Record<string, unknown>;
    store.nodeRows.get(PARALLEL_NE)!.status = NodeExecutionStatus.FAILED;
    store.execution.status = ExecutionStatus.FAILED;
    store.execution.finishedAt = new Date(Date.now() - 20_000);
    store.execution.error = { message: 'Parallel branch failed' };
    store.execution.durationMs = 40_000;

    const first = await service.retryLastTurn(EXEC, FAILED_NE);
    const second = await service.retryLastTurn(EXEC, SIBLING_NE);

    driver.rehydrateContext.mockImplementation(() =>
      Promise.resolve(contextService.createContext(EXEC, 'wf')),
    );
    driver.buildRetryReentryState.mockReturnValue({
      resumeState: { messages: [] },
      initialAction: { type: 'ai_message' },
    });
    let duringTurn: Row | undefined;
    // 첫 재시도의 턴이 도는 동안 두 번째 배달이 워커에 닿는다. 턴 끝 전이 전이라 실행은
    // 아직 `failed` 다.
    processAiResumeTurn.mockImplementationOnce(async () => {
      duringTurn = { ...store.execution };
      await service.applyRetryLastTurn(EXEC, second.spawnedNodeExecutionId);
      return PARK_RELEASED;
    });

    await service.applyRetryLastTurn(EXEC, first.spawnedNodeExecutionId);

    expect(processAiResumeTurn).toHaveBeenCalledTimes(1);
    // 이긴 쪽이 옛 실패 필드를 DB 에서 비웠고 그 빈 finished_at 이 표시다.
    expect(duringTurn).toMatchObject({
      status: ExecutionStatus.FAILED,
      finishedAt: null,
      error: null,
      durationMs: null,
    });
    const loser = store.nodeRows.get(second.spawnedNodeExecutionId)!;
    expect(loser.status).toBe(NodeExecutionStatus.FAILED);
    expect(loser.error).toEqual({
      message:
        'Retry re-entry rejected: another retry of this execution is running',
    });
    expect(emitNode).toHaveBeenCalledWith(
      EXEC,
      'n-ai-b',
      NodeEventType.NODE_FAILED,
      expect.objectContaining({
        nodeExecutionId: second.spawnedNodeExecutionId,
      }),
    );
    expect(emitNode).not.toHaveBeenCalledWith(
      EXEC,
      'n-ai-b',
      NodeEventType.NODE_STARTED,
      expect.anything(),
    );
    // 이긴 쪽의 새 행은 그대로 running 이다.
    expect(store.nodeRows.get(first.spawnedNodeExecutionId)!.status).toBe(
      NodeExecutionStatus.RUNNING,
    );
  });
});
