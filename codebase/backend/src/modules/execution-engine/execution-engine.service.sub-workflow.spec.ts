import { createEmptyConversationThread } from '../../shared/conversation-thread/conversation-thread.types';
import { ExecutionEngineService } from './execution-engine.service';
import { SUB_WORKFLOW_MAX_RECURSION_DEPTH } from '../../nodes/core/node-types.constants';
import {
  WorkflowForbiddenWorkspaceError,
  ExecutionCancelledError,
} from './workflow-errors';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { isDryRun } from '../../nodes/core/dry-run.util';
import { ExecutionContextService } from './context/execution-context.service';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
} from '../../nodes/core/node-handler.interface';
import { mockOutput } from './__test__/mock-output';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  mockEdges,
  mockHandler,
  mockNodes,
  withWorkspace,
  workflowId,
} from './__test-utils__/engine-service-harness';
import { findExecutionStatusUpdate } from './__test-utils__/raw-update-params';

/**
 * ExecutionEngineService 단위 테스트: Sub-Workflow 호출(executeInline · executeSync/Async · executeBackgroundSubgraph · callStack push/pop).
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      handlerRegistry,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
      mockWorkflowRepo,
    } = h);
  });

  describe('executeInline — Sub-Workflow parent linking', () => {
    let contextService: ExecutionContextService;

    beforeEach(() => {
      contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
    });

    it('stamps parent_node_execution_id on every child created during inline run', async () => {
      mockNodeExecutionRepo.create.mockClear();
      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );

      await service.executeInline(
        workflowId,
        { foo: 'bar' },
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'workflow-node-row-1',
        },
      );

      // Every NodeExecution.create call inside the inline run must carry
      // the parent id we passed.
      const createCalls = mockNodeExecutionRepo.create.mock.calls as Array<
        [Partial<NodeExecution>]
      >;
      expect(createCalls.length).toBeGreaterThan(0);
      for (const [arg] of createCalls) {
        expect(arg.parentNodeExecutionId).toBe('workflow-node-row-1');
      }
    });

    // ai-review C2 (2026-07-26) — mutation 실측: executeInline 상단(§2.3)의
    // `assertExecutionNotCancelled` 가드를 제거해도 이전엔 407/407 GREEN 이었다
    // (커버리지 0). 이 노드는 부모 executionId 를 그대로 쓰는 sync sub-workflow 라,
    // 부모가 노드 실행 도중 외부 cancel 되면 하류 노드가 dispatch 되지 않아야 한다.
    // node-1 → node-2 → node-3 (default 3-node 선형 그래프) 를 그대로 재사용한다.
    it('노드 1 실행 중 Execution 이 외부에서 cancelled 로 바뀌면 executeInline 이 하류를 dispatch 하지 않고 ExecutionCancelledError 를 던진다 (§2.3 C2)', async () => {
      (mockHandler.execute as jest.Mock).mockClear();
      let calls = 0;
      (mockHandler.execute as jest.Mock).mockImplementation(async () => {
        calls++;
        return mockOutput({ ok: true });
      });

      // executeInline 은 루프 진입 전 "execution meta" 조회(1건) + 루프 매 노드
      // 경계마다 assertExecutionNotCancelled(§2.3) 조회를 순서대로 수행한다.
      // 1) execution meta lookup — 무관.
      // 2) node-1 dispatch 전 cancel 체크 — 통과(아직 RUNNING).
      // 3) node-2 dispatch 전 cancel 체크 — 외부 cancel 관측(CANCELLED) → throw.
      const runningRow = {
        id: executionId,
        workflowId,
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
      };
      const cancelledRow = {
        id: executionId,
        workflowId,
        status: ExecutionStatus.CANCELLED,
        startedAt: new Date(),
      };
      mockExecutionRepo.findOneBy
        .mockResolvedValueOnce(runningRow)
        .mockResolvedValueOnce(runningRow)
        .mockResolvedValueOnce(cancelledRow);

      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );

      await expect(
        service.executeInline(
          workflowId,
          { foo: 'bar' },
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'workflow-node-row-cancel',
          },
        ),
      ).rejects.toThrow(ExecutionCancelledError);

      // node-1 만 dispatch 되고 node-2/node-3(하류)는 dispatch 되지 않는다.
      expect(calls).toBe(1);
    });

    it('restores context.parentNodeExecutionId after the inline run (happy path)', async () => {
      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );
      context.parentNodeExecutionId = 'outer-parent';

      await service.executeInline(
        workflowId,
        {},
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'inner-parent',
        },
      );

      expect(context.parentNodeExecutionId).toBe('outer-parent');
    });

    it('restores context.parentNodeExecutionId even when a child handler throws', async () => {
      const throwingHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(() => Promise.reject(new Error('boom'))),
      };
      handlerRegistry.register('test_node', throwingHandler);

      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );
      context.parentNodeExecutionId = 'outer-parent';

      await expect(
        service.executeInline(
          workflowId,
          {},
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'inner-parent',
          },
        ),
      ).rejects.toThrow();

      // finally block must restore regardless of success/failure.
      expect(context.parentNodeExecutionId).toBe('outer-parent');
    });

    // ENG-RC-* — executeInline 경로도 main path 와 동일하게 핸들러에 rawConfig 를
    // 노출해야 한다. Sub-Workflow inline run 이 raw echo 패턴을 따를 수 있도록 보장.
    it('exposes rawConfig in executeInline path (sub-workflow inline run)', async () => {
      const inlineNode: Partial<Node> = {
        id: 'inline-target',
        workflowId,
        type: 'template',
        category: NodeCategory.PRESENTATION,
        label: 'Inline Target',
        config: { content: 'Hello {{ name }}' },
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValue([inlineNode]);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      const captureSpy = jest
        .fn<
          Promise<NodeHandlerOutput>,
          [unknown, Record<string, unknown>, ExecutionContext]
        >()
        .mockResolvedValue(mockOutput({ ok: true }));
      handlerRegistry.register('template', {
        validate: () => ({ valid: true, errors: [] }),
        execute: captureSpy,
      });

      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );
      await service.executeInline(
        workflowId,
        { name: 'Alice' },
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'inline-parent',
        },
      );

      expect(captureSpy).toHaveBeenCalledTimes(1);
      const ctxArg = captureSpy.mock.calls[0][2];
      // executeInline 경로에서도 rawConfig 가 주입되어야 함
      expect(ctxArg.rawConfig).toBeDefined();
      expect(ctxArg.rawConfig?.content).toBe('Hello {{ name }}');
    });

    // WARN #17 (Architecture) — sub-workflow 의 trigger 는 manual_trigger 만 허용.
    // 다른 trigger 타입 (webhook/schedule) 이 진입점에 있으면 silent skip 이
    // 아니라 명시적 throw 한다 (spec/4-nodes/2-flow/1-workflow.md 박스 참조).
    it('throws INVALID_SUB_WORKFLOW_TRIGGER when sub-workflow contains non-manual trigger', async () => {
      const subTriggerNode: Partial<Node> = {
        id: 'webhook-trigger-in-sub',
        workflowId,
        type: 'webhook_trigger',
        category: NodeCategory.TRIGGER,
        label: 'Webhook',
        config: {},
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValue([subTriggerNode]);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );

      await expect(
        service.executeInline(
          workflowId,
          {},
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'parent-x',
          },
        ),
      ).rejects.toThrow(/INVALID_SUB_WORKFLOW_TRIGGER/);
    });

    it('차단: 호출자 workspace 와 sub-workflow workspace 불일치 (W-6)', async () => {
      mockWorkflowRepo.findOneBy.mockResolvedValueOnce({
        id: workflowId,
        workspaceId: 'ws-target',
        name: 'cross-ws-target',
      });
      const context = contextService.createContext(executionId, workflowId);
      context.variables = {
        ...(context.variables ?? {}),
        __workspaceId: 'ws-attacker',
      };

      await expect(
        service.executeInline(
          workflowId,
          {},
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'p',
          },
        ),
      ).rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/);
    });

    it('통과: 동일 workspace (W-6)', async () => {
      mockWorkflowRepo.findOneBy.mockResolvedValueOnce({
        id: workflowId,
        workspaceId: 'ws-1',
        name: 'same-ws-target',
      });
      const manualTriggerNode: Partial<Node> = {
        id: 'manual-trigger-same-ws',
        workflowId,
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        label: 'Manual',
        config: {},
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValueOnce([manualTriggerNode]);
      mockEdgeRepo.findBy.mockResolvedValueOnce([]);

      const context = contextService.createContext(executionId, workflowId);
      context.variables = {
        ...(context.variables ?? {}),
        __workspaceId: 'ws-1',
      };

      await expect(
        service.executeInline(
          workflowId,
          { x: 1 },
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'p',
          },
        ),
      ).resolves.toBeDefined();
    });

    it('차단(fail-closed): 호출자 workspace 컨텍스트 누락 (W-6)', async () => {
      // __workspaceId 가 없는 컨텍스트 — 옛/미마이그레이션 진입을 모사. fail-closed
      // 전환 후에는 격리 증명 불가이므로 통과하지 않고 차단해야 한다.
      mockWorkflowRepo.findOneBy.mockResolvedValueOnce({
        id: workflowId,
        workspaceId: 'ws-target',
        name: 'no-caller-ctx-target',
      });
      const context = contextService.createContext(executionId, workflowId);
      // 의도적으로 withWorkspace 미적용 — context.variables.__workspaceId 부재.

      await expect(
        service.executeInline(
          workflowId,
          {},
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'p',
          },
        ),
      ).rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/);
    });

    it('passes manual_trigger through pass-through (input forwarded as output)', async () => {
      const manualTriggerNode: Partial<Node> = {
        id: 'manual-trigger-in-sub',
        workflowId,
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        label: 'Manual',
        config: {},
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValue([manualTriggerNode]);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );

      // throw 하지 않아야 함 — manual_trigger 는 정상 pass-through.
      // 반환값은 마지막 노드 (= manual_trigger 자체) 의 output 인 입력 그대로.
      await expect(
        service.executeInline(
          workflowId,
          { passed: 'through' },
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'parent-y',
          },
        ),
      ).resolves.toEqual({ passed: 'through' });
    });
  });

  // CRIT #5 — executeSync / executeAsync 가 Sub-Workflow handler 가 직접
  // 호출하는 public API 임에도 완전 미테스트 상태였다. workflow-not-found,
  // FAILED / CANCELLED 상태 전파, timeout 경로의 최소 커버리지를 확보한다.
  describe('executeSync / executeAsync — Sub-Workflow public API', () => {
    beforeEach(() => {
      // 노드 0개로 단축 — runExecution 이 그래프 순회 없이 빠르게 끝나
      // appendExecutionPath 의 findOneBy 호출이 발생하지 않는다. 본 describe
      // 의 모든 테스트는 executeSync 의 후처리 경로 (status 분기 / timeout 경로)
      // 만 검증하므로 노드 그래프는 무관하다.
      mockNodeRepo.findBy.mockResolvedValue([]);
      mockEdgeRepo.findBy.mockResolvedValue([]);
    });

    // 재귀 한도는 공용 상수 SUB_WORKFLOW_MAX_RECURSION_DEPTH 하나다(CLE-T-YWRJTV).
    // 한도와 같은 깊이는 통과해 워크플로우 조회까지 가고, 한도를 넘으면 조회 전에 막힌다.
    describe.each([
      [
        'executeSync',
        (depth: number) =>
          service.executeSync(
            'nonexistent-wf',
            {},
            { timeoutMs: 0, recursionDepth: depth },
          ),
      ],
      [
        'executeAsync',
        (depth: number) =>
          service.executeAsync('nonexistent-wf', {}, { recursionDepth: depth }),
      ],
    ])('%s — 서브 워크플로우 재귀 한도', (_name, call) => {
      it('한도와 같은 깊이는 재귀 검사를 통과한다', async () => {
        mockWorkflowRepo.findOneBy.mockResolvedValueOnce(null);
        await expect(call(SUB_WORKFLOW_MAX_RECURSION_DEPTH)).rejects.toThrow(
          'Workflow not found: nonexistent-wf',
        );
      });

      it('한도를 넘는 깊이는 워크플로우를 읽기 전에 거부한다', async () => {
        const depth = SUB_WORKFLOW_MAX_RECURSION_DEPTH + 1;
        await expect(call(depth)).rejects.toThrow(
          `Sub-workflow recursion depth ${depth} exceeds maximum ${SUB_WORKFLOW_MAX_RECURSION_DEPTH}`,
        );
        expect(mockWorkflowRepo.findOneBy).not.toHaveBeenCalled();
      });
    });

    describe('executeSync', () => {
      it('throws when workflow does not exist', async () => {
        mockWorkflowRepo.findOneBy.mockResolvedValueOnce(null);
        await expect(
          service.executeSync('nonexistent-wf', {}, { timeoutMs: 0 }),
        ).rejects.toThrow('Workflow not found: nonexistent-wf');
      });

      // INFO #19 — runExecution 은 savedExecution 참조를 in-place mutation 하므로
      // 테스트는 runExecution 을 spy 하여 in-memory 상태를 직접 set 한다.
      // (이전 패턴은 mockExecutionRepo.findOneBy 로 post-execution 재조회를
      // 가로챘으나, INFO #19 적용으로 success path 의 findOneBy 가 제거됐다.)
      const stubRunExecution = (
        mutator: (execution: Record<string, unknown>) => void,
      ) =>
        jest
          .spyOn(
            service as unknown as {
              runExecution: (...args: unknown[]) => Promise<unknown>;
            },
            'runExecution',
          )
          .mockImplementation(async (execution: unknown) => {
            mutator(execution as Record<string, unknown>);
          });

      it('returns SubWorkflowResult shape on COMPLETED', async () => {
        const spy = stubRunExecution((execution) => {
          execution.status = ExecutionStatus.COMPLETED;
          execution.outputData = { final: 'value' };
        });
        const result = await service.executeSync(
          workflowId,
          { foo: 'bar' },
          { timeoutMs: 0, parentWorkspaceId: 'ws-1' },
        );
        expect(result.executionId).toBe(executionId);
        expect(result.output).toEqual({ final: 'value' });
        expect(result.status).toBe(ExecutionStatus.COMPLETED);
        spy.mockRestore();
      });

      // W-6 fail-closed — public sub-workflow API 도 parentWorkspaceId 없으면 차단.
      // typed error 계층 검증 (dev 1b — message regex 외 instanceof 가드).
      it('throws WORKFLOW_FORBIDDEN_WORKSPACE when parentWorkspaceId is absent (fail-closed)', async () => {
        await expect(
          service.executeSync(workflowId, {}, { timeoutMs: 0 }),
        ).rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/);
        await expect(
          service.executeSync(workflowId, {}, { timeoutMs: 0 }),
        ).rejects.toBeInstanceOf(WorkflowForbiddenWorkspaceError);
      });

      // W-6 — parentWorkspaceId 가 존재하나 target workspace 와 불일치 → 차단.
      it('throws WORKFLOW_FORBIDDEN_WORKSPACE when parentWorkspaceId mismatches target', async () => {
        await expect(
          service.executeSync(
            workflowId,
            {},
            { timeoutMs: 0, parentWorkspaceId: 'ws-other' },
          ),
        ).rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/);
      });

      it('throws when sub-workflow status is FAILED', async () => {
        const spy = stubRunExecution((execution) => {
          execution.status = ExecutionStatus.FAILED;
          execution.error = { message: 'inner failure' };
        });
        await expect(
          service.executeSync(
            workflowId,
            {},
            { timeoutMs: 0, parentWorkspaceId: 'ws-1' },
          ),
        ).rejects.toThrow('Sub-workflow execution failed: inner failure');
        spy.mockRestore();
      });

      it('throws when sub-workflow status is CANCELLED', async () => {
        const spy = stubRunExecution((execution) => {
          execution.status = ExecutionStatus.CANCELLED;
        });
        await expect(
          service.executeSync(
            workflowId,
            {},
            { timeoutMs: 0, parentWorkspaceId: 'ws-1' },
          ),
        ).rejects.toThrow('Sub-workflow execution was cancelled');
        spy.mockRestore();
      });

      // CRIT #5 — timeout 경로 보강. graph traversal 이 hang 됐을 때
      // executeSync 가 (1) Promise.race 의 timeout 가지로 reject 되고,
      // (2) 후처리 catch 블록이 reloaded execution 을 FAILED 로 마킹해
      // 영구 stuck 상태가 남지 않는지 확인한다.
      it('times out when runExecution hangs and marks execution FAILED', async () => {
        // runExecution 을 영구 hang 으로 모킹 — 외부 timeout 만 reject 한다.
        const runExecutionSpy = jest
          .spyOn(
            service as unknown as {
              runExecution: (...args: unknown[]) => Promise<unknown>;
            },
            'runExecution',
          )
          .mockImplementation(() => new Promise<unknown>(() => undefined));

        // catch 블록의 reloaded.status 가 RUNNING (즉 COMPLETED/FAILED 가
        // 아닌 상태) 이어야 FAILED 로 전환되는 path 가 검증된다.
        mockExecutionRepo.findOneBy.mockResolvedValueOnce({
          id: executionId,
          status: ExecutionStatus.RUNNING,
          startedAt: new Date(Date.now() - 100),
        });
        mockExecutionRepo.save.mockClear();

        await expect(
          service.executeSync(
            workflowId,
            {},
            { timeoutMs: 50, parentWorkspaceId: 'ws-1' },
          ),
        ).rejects.toThrow(/timed out after 50ms/);

        // ai-review WARNING #1 (2026-07-27, 7차 라운드) — guarded
        // `updateExecutionStatus`(raw UPDATE) 경유로 바뀌어 더 이상 full-entity
        // `.save()` 를 호출하지 않는다(형제 `finalizeFailedExecution` 과 동일 패턴).
        const failedUpdate = findExecutionStatusUpdate(
          mockExecutionRepo.query.mock.calls,
          ExecutionStatus.FAILED,
        );
        expect(failedUpdate).toBeDefined();
        expect(failedUpdate!.error).toMatch(/timed out after 50ms/);

        runExecutionSpy.mockRestore();
      });

      // ai-review WARNING #1 (2026-07-27, 7차 라운드) — 위 두 회귀는 `findOneBy`
      // mock 을 고정값(RUNNING/CANCELLED)으로 관측해 초기 `TERMINAL_STATUSES`
      // 가드만 검증했을 뿐, guarded UPDATE 자체의 race 보호(reload 이후 실제 DB
      // 커밋 사이의 좁은 창)는 재현하지 않았다는 지적을 닫는다. reload 는 RUNNING
      // 을 관측하지만(초기 가드 통과), guarded UPDATE 가 도달하는 순간엔 동시
      // Stop 이 DB 를 이미 CANCELLED 로 커밋해 `WHERE status IN (non-terminal)`
      // 가 0행 매칭(no-op)하는 시나리오를 직접 재현한다. 가드가 제거되면(naked
      // `save()` 로 되돌아가면) 아래 단언이 RED 가 된다.
      it('timeout 경로 — reload 이후 guarded UPDATE 를 동시 cancel 이 선점하면(0행) naked save 로 폴백하지 않는다 (실제 race)', async () => {
        const runExecutionSpy = jest
          .spyOn(
            service as unknown as {
              runExecution: (...args: unknown[]) => Promise<unknown>;
            },
            'runExecution',
          )
          .mockImplementation(() => new Promise<unknown>(() => undefined));
        const warnSpy = jest
          .spyOn(
            (service as unknown as { logger: { warn: (m: string) => void } })
              .logger,
            'warn',
          )
          .mockImplementation(() => undefined);

        mockExecutionRepo.findOneBy.mockResolvedValueOnce({
          id: executionId,
          status: ExecutionStatus.RUNNING,
          startedAt: new Date(Date.now() - 100),
        });
        mockExecutionRepo.save.mockClear();
        // guarded UPDATE 가 0행 매칭 — 동시 cancel 선점 시뮬레이션.
        mockExecutionRepo.query.mockResolvedValueOnce([]);

        await expect(
          service.executeSync(
            workflowId,
            {},
            { timeoutMs: 50, parentWorkspaceId: 'ws-1' },
          ),
        ).rejects.toThrow(/timed out after 50ms/);

        const failedSaveCall = mockExecutionRepo.save.mock.calls.find(
          ([entity]) =>
            (entity as { status?: ExecutionStatus }).status ===
            ExecutionStatus.FAILED,
        );
        expect(failedSaveCall).toBeUndefined();

        // C-4 — 선점을 **관측 가능하게** 남기는지까지 본다. 이 전제(0행 매칭)는
        // 이미 세팅돼 있었지만 warn 은 단언되지 않아, 로그 블록을 통째로 지워도
        // RED 가 안 났다. 형제 종결 경로(`failFirstSegmentSetup`)는 같은 상황에
        // warn 을 남기므로, 여기만 조용하면 "왜 이 실행만 FAILED 가 안 찍혔나" 를
        // 로그로 추적할 수 없다.
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /executeSync\(.*\): 동시 cancel 이 이미 terminal 로 선점/,
          ),
        );

        runExecutionSpy.mockRestore();
      });

      // 2026-07-27 — 위 timeout 경로의 terminal 가드가 `COMPLETED`/`FAILED` 만
      // 인라인 열거하고 **CANCELLED 를 누락**해, 동시 Stop 으로 이미 취소된
      // sub-execution 을 FAILED 로 덮어쓰던 결함의 회귀 고정. 본 PR 이 닫아온
      // "취소가 조용히 소실된다" 와 같은 클래스다.
      //   가드를 `TERMINAL_STATUSES` 단일 출처 비교로 바꿔 해소했다 — 인라인 열거는
      //   원소가 조용히 빠질 수 있고, 실제로 빠졌다.
      it('timeout 경로가 이미 CANCELLED 인 sub-execution 을 FAILED 로 덮어쓰지 않는다', async () => {
        const runExecutionSpy = jest
          .spyOn(
            service as unknown as {
              runExecution: (...args: unknown[]) => Promise<unknown>;
            },
            'runExecution',
          )
          .mockImplementation(() => new Promise<unknown>(() => undefined));

        // 동시 Stop 이 이미 CANCELLED 로 마감한 상태를 재조회가 관측한다.
        mockExecutionRepo.findOneBy.mockResolvedValueOnce({
          id: executionId,
          status: ExecutionStatus.CANCELLED,
          startedAt: new Date(Date.now() - 100),
        });
        mockExecutionRepo.save.mockClear();

        await expect(
          service.executeSync(
            workflowId,
            {},
            { timeoutMs: 50, parentWorkspaceId: 'ws-1' },
          ),
        ).rejects.toThrow(/timed out after 50ms/);

        // 취소를 FAILED 로 덮어쓰는 save 가 있어서는 안 된다.
        const failedSaveCall = mockExecutionRepo.save.mock.calls.find(
          ([entity]) =>
            (entity as { status?: ExecutionStatus }).status ===
            ExecutionStatus.FAILED,
        );
        expect(failedSaveCall).toBeUndefined();

        runExecutionSpy.mockRestore();
      });
    });

    describe('executeAsync', () => {
      it('throws when workflow does not exist', async () => {
        mockWorkflowRepo.findOneBy.mockResolvedValueOnce(null);
        await expect(
          service.executeAsync('nonexistent-wf', {}),
        ).rejects.toThrow('Workflow not found: nonexistent-wf');
      });

      it('returns executionId immediately (fire-and-forget)', async () => {
        const result = await service.executeAsync(
          workflowId,
          { foo: 'bar' },
          {
            parentWorkspaceId: 'ws-1',
          },
        );
        expect(result).toBe(executionId);
      });

      // CLE-T-Y2F1NG — 비동기 자식 실행은 부모의 dry-run 을 실행 행에 남기고 그 값으로
      // `__dryRun` 을 만든다. 끊기면 dry-run 재실행의 자식 안 부수효과 노드가 실제로 돈다.
      it.each([
        ['true', true, true],
        ['false', false, false],
        ['미지정', undefined, false],
      ])(
        'dryRun=%s → 자식 실행 행의 dryRun 과 자식 노드 context 의 __dryRun 이 같은 값이다',
        async (_label, dryRun, expected) => {
          // 이 describe 는 노드 0개로 줄여 두었다. 자식 노드 context 를 보려고 기본
          // 그래프(test_node)로 되돌린다.
          mockNodeRepo.findBy.mockResolvedValue(mockNodes);
          mockEdgeRepo.findBy.mockResolvedValue(mockEdges);
          const base = mockExecutionRepo.create() as Partial<Execution>;
          mockExecutionRepo.create.mockClear();
          mockExecutionRepo.create.mockImplementationOnce(
            (entity: Partial<Execution>) => ({ ...base, ...entity }),
          );
          const seenContexts: ExecutionContext[] = [];
          (mockHandler.execute as jest.Mock).mockImplementation(
            async (
              input: unknown,
              _config: unknown,
              context: ExecutionContext,
            ) => {
              seenContexts.push(context);
              return mockOutput({ processed: true, input });
            },
          );

          await service.executeAsync(
            workflowId,
            { foo: 'bar' },
            {
              parentWorkspaceId: 'ws-1',
              parentExecutionId: 'parent-1',
              dryRun,
            },
          );
          await flushPromises();

          expect(mockExecutionRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              parentExecutionId: 'parent-1',
              dryRun: expected,
            }),
          );
          expect(seenContexts.length).toBeGreaterThan(0);
          for (const ctx of seenContexts) {
            expect(ctx.variables['__dryRun']).toBe(expected);
          }
        },
      );

      // W-6 fail-closed — executeAsync 도 parentWorkspaceId 없으면 차단.
      it('throws WORKFLOW_FORBIDDEN_WORKSPACE when parentWorkspaceId is absent (fail-closed)', async () => {
        await expect(
          service.executeAsync(workflowId, { foo: 'bar' }),
        ).rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/);
      });

      // W-6 — parentWorkspaceId 존재하나 target workspace 와 불일치 → 차단.
      it('throws WORKFLOW_FORBIDDEN_WORKSPACE when parentWorkspaceId mismatches target', async () => {
        await expect(
          service.executeAsync(
            workflowId,
            { foo: 'bar' },
            {
              parentWorkspaceId: 'ws-other',
            },
          ),
        ).rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/);
      });

      // M-4 (06 concurrency, Option B) — executeAsync 의 fire-and-forget
      // `runExecution` 이 setup 단계에서 throw 하면 catch 가
      // `failFirstSegmentSetup` 로 best-effort terminal 마감한다(RUNNING/PENDING
      // 잔류 방지 — 큐 경로 W5 와 동일 계약).
      type M4AsyncFailSubject = {
        runExecution: (...args: unknown[]) => Promise<void>;
        failFirstSegmentSetup: (
          executionId: string,
          error: unknown,
        ) => Promise<void>;
        logger: { error: jest.Mock };
      };

      it('M-4: runExecution setup throw 시 failFirstSegmentSetup 로 best-effort 마감', async () => {
        const svc = service as unknown as M4AsyncFailSubject;
        const runSpy = jest
          .spyOn(svc, 'runExecution')
          .mockRejectedValueOnce(new Error('setup-throw-m4'));
        const failSpy = jest
          .spyOn(svc, 'failFirstSegmentSetup')
          .mockResolvedValue(undefined);

        const result = await service.executeAsync(
          workflowId,
          { foo: 'bar' },
          {
            parentWorkspaceId: 'ws-1',
          },
        );
        expect(result).toBe(executionId);
        // fire-and-forget catch 체인(비동기)이 settle 하도록 flush.
        await new Promise((r) => setImmediate(r));

        expect(failSpy).toHaveBeenCalledWith(executionId, expect.any(Error));

        runSpy.mockRestore();
        failSpy.mockRestore();
      });

      // M-4 — `failFirstSegmentSetup` 자체가 throw(2차 실패)해도 fire-and-forget
      // 컨텍스트라 unhandled rejection 없이 로그로 흡수한다(큐 경로 W7 와 동일).
      it('M-4: failFirstSegmentSetup 2차 실패는 로그로 흡수 (unhandled rejection 없음)', async () => {
        const svc = service as unknown as M4AsyncFailSubject;
        const runSpy = jest
          .spyOn(svc, 'runExecution')
          .mockRejectedValueOnce(new Error('primary-error-m4'));
        const failSpy = jest
          .spyOn(svc, 'failFirstSegmentSetup')
          .mockRejectedValueOnce(new Error('secondary-error-m4'));
        const errorSpy = jest.spyOn(svc.logger, 'error');

        await expect(
          service.executeAsync(
            workflowId,
            { foo: 'bar' },
            {
              parentWorkspaceId: 'ws-1',
            },
          ),
        ).resolves.toBe(executionId);
        await new Promise((r) => setImmediate(r));

        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('secondary error'),
        );

        runSpy.mockRestore();
        failSpy.mockRestore();
        errorSpy.mockRestore();
      });
    });
  });

  describe('executeBackgroundSubgraph', () => {
    it('forks context: mutating snapshot vars must not affect job snapshot', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_workflowId, _input, options) => {
          // Mutate the cloned context as if a body node ran.
          options.context.variables.touched = true;
          options.context.nodeOutputCache['extra-node'] = { v: 1 };
          return Promise.resolve(undefined);
        });

      const job = {
        executionId,
        parentNodeExecutionId: 'parent-1',
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: { foo: 1 },
        variables: { keep: 'me' },
        nodeOutputCache: { 'node-1': { hello: 'world' } },
        expressionContext: { workspaceId: 'ws-1' },
        conversationThread: createEmptyConversationThread(),
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      };

      await service.executeBackgroundSubgraph(job);

      // Mutations stayed inside the inline execution context.
      expect(job.variables).toEqual({ keep: 'me' });
      expect(job.nodeOutputCache).toEqual({
        'node-1': { hello: 'world' },
      });
      expect(inlineSpy).toHaveBeenCalledWith(
        workflowId,
        { foo: 1 },
        expect.objectContaining({
          executionId,
          parentNodeExecutionId: 'parent-1',
          entryNodeIds: ['node-2'],
        }),
      );
      inlineSpy.mockRestore();
    });

    // 큐 작업의 구조화 출력 캐시 스냅샷은 본문 context 에 사본으로 들어간다. 필드가 없는 옛
    // 작업은 빈 구조화 캐시로 시작해 예전처럼 flat 값으로 읽는다(CLE-T-JDYHCF 5번).
    describe('구조화 출력 캐시 스냅샷 복원', () => {
      const runCapturingStructured = async (
        job: Parameters<ExecutionEngineService['executeBackgroundSubgraph']>[0],
      ) => {
        let captured: Record<string, unknown> | undefined;
        const inlineSpy = jest
          .spyOn(service, 'executeInline')
          .mockImplementation((_w, _i, options) => {
            captured = options.context.structuredOutputCache;
            options.context.structuredOutputCache['body-node'] = {
              output: 'written by body',
            } as never;
            return Promise.resolve(undefined);
          });
        try {
          await service.executeBackgroundSubgraph(job);
        } finally {
          inlineSpy.mockRestore();
        }
        return captured;
      };

      it('작업에 스냅샷이 있으면 본문 context 에 사본으로 넣는다', async () => {
        const snapshot = {
          'node-1': { output: [1, 2, 3], port: 'success' },
        };
        const job = {
          executionId,
          parentNodeExecutionId: 'parent-1',
          backgroundRunId: 'bg-run-1',
          workspaceId: 'ws-1',
          workflowId,
          bodyEntryNodeIds: ['node-2'],
          input: {},
          variables: {},
          nodeOutputCache: {},
          structuredOutputCache: snapshot,
          expressionContext: {},
          conversationThread: createEmptyConversationThread(),
          config: { notifyOnFailure: false, maxDurationMs: 0 },
        } as unknown as Parameters<
          ExecutionEngineService['executeBackgroundSubgraph']
        >[0];

        const captured = await runCapturingStructured(job);

        expect(captured).not.toBe(snapshot);
        expect(captured?.['node-1']).toEqual({
          output: [1, 2, 3],
          port: 'success',
        });
        // 본문이 쓴 항목은 작업 스냅샷으로 새지 않는다.
        expect(snapshot).not.toHaveProperty('body-node');
      });

      it('스냅샷이 없는 옛 작업은 빈 구조화 캐시로 시작한다', async () => {
        const job = {
          executionId,
          parentNodeExecutionId: 'parent-1',
          backgroundRunId: 'bg-run-legacy',
          workspaceId: 'ws-1',
          workflowId,
          bodyEntryNodeIds: ['node-2'],
          input: {},
          variables: {},
          nodeOutputCache: { 'node-1': { hello: 'world' } },
          expressionContext: {},
          conversationThread: createEmptyConversationThread(),
          config: { notifyOnFailure: false, maxDurationMs: 0 },
        };

        const captured = await runCapturingStructured(job);

        expect(captured).toEqual({
          'body-node': { output: 'written by body' },
        });
      });
    });

    // race 회귀 차단: 본문 context 는 부모 executionId 가 아닌 bgKey 로 등록돼야
    // 하고(격리), executeBackgroundSubgraph 가 자체 finally 로 정리해야 한다
    // (근거: [Background 노드 「격리 계약」](CLE-NODE-BACKGROUND#격리-계약) ·
    // [실행 컨텍스트 「규칙」](CLE-EXEC-CONTEXT#규칙) 의 4번).
    const makeBgJob = (over: Record<string, unknown> = {}) => ({
      executionId,
      parentNodeExecutionId: 'parent-1',
      backgroundRunId: 'bg-run-1',
      workspaceId: 'ws-1',
      workflowId,
      bodyEntryNodeIds: ['node-2'],
      input: {},
      variables: {},
      nodeOutputCache: {},
      expressionContext: {},
      conversationThread: createEmptyConversationThread(),
      config: { notifyOnFailure: false, maxDurationMs: 0 },
      ...over,
    });

    it('registers the body context under a bgKey (isolated from parent executionId) and cleans it up in finally', async () => {
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      let capturedKey: string | undefined;
      let capturedExecId: string | undefined;
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_w, _i, options) => {
          capturedKey = options.context._contextKey;
          capturedExecId = options.context.executionId;
          return Promise.resolve(undefined);
        });

      await service.executeBackgroundSubgraph(makeBgJob());

      const bgKey = `bg:${executionId}:bg-run-1`;
      // 본문 context 는 bgKey 로 격리 등록, executionId 필드는 메인 ID 유지.
      expect(capturedKey).toBe(bgKey);
      expect(capturedExecId).toBe(executionId);
      // 부모 executionId 키로는 본문 context 가 등록되지 않는다 (키 충돌 없음).
      expect(contextService.getContext(executionId)).toBeUndefined();
      // finally 가 bgKey context 를 정리.
      expect(contextService.getContext(bgKey)).toBeUndefined();
      inlineSpy.mockRestore();
    });

    // CLE-T-Y2F1NG — 워커가 작업 스냅샷의 `__dryRun` 을 본문 context 로 그대로 옮긴다.
    // 본문 노드의 부수효과 가드(`isDryRun`)가 이 값을 읽는다.
    it.each([
      ['true', true],
      ['false', false],
    ])(
      '작업 스냅샷의 __dryRun=%s 이 본문 context 로 이어진다',
      async (_label, dryRun) => {
        let captured: boolean | undefined;
        const inlineSpy = jest
          .spyOn(service, 'executeInline')
          .mockImplementation((_w, _i, options) => {
            captured = isDryRun(options.context);
            return Promise.resolve(undefined);
          });

        await service.executeBackgroundSubgraph(
          makeBgJob({
            backgroundRunId: `bg-run-dry-${dryRun}`,
            variables: { __dryRun: dryRun },
          }),
        );

        expect(captured).toBe(dryRun);
        inlineSpy.mockRestore();
      },
    );

    it('cleans up the bgKey context even when the body throws', async () => {
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockRejectedValue(new Error('boom'));

      await expect(
        service.executeBackgroundSubgraph(
          makeBgJob({ backgroundRunId: 'bg-run-err' }),
        ),
      ).rejects.toThrow('boom');

      expect(
        contextService.getContext(`bg:${executionId}:bg-run-err`),
      ).toBeUndefined();
      inlineSpy.mockRestore();
    });

    // ai-review W2 (2026-07-26) — 본문은 부모와 같은 executionId 를 공유하므로
    // §2.3 가드(executeInline 내부)가 외부 cancel 을 관측하면 ExecutionCancelledError
    // 가 여기로 도달한다. re-throw 하면 BackgroundExecutionProcessor 가 일반 실패로
    // 처리해 허위 실패 알림 + BullMQ 재시도를 유발한다 — ParkReleaseSignal 과
    // 동일하게 swallow(graceful 종료, 재throw 없음)해야 한다.
    it('swallows ExecutionCancelledError from the body (§2.3) — no re-throw, no retry/failure notification', async () => {
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockRejectedValue(
          new ExecutionCancelledError('Execution cancelled externally'),
        );

      // BackgroundExecutionProcessor.process() 의 catch(re-throw → 실패
      // 알림/재시도)에 도달하지 않으려면 executeBackgroundSubgraph 가 reject 하면
      // 안 된다.
      await expect(
        service.executeBackgroundSubgraph(
          makeBgJob({ backgroundRunId: 'bg-run-cancelled' }),
        ),
      ).resolves.toBeUndefined();

      // finally 의 bgKey context 정리는 다른 예외 경로와 동일하게 수행돼야 한다.
      expect(
        contextService.getContext(`bg:${executionId}:bg-run-cancelled`),
      ).toBeUndefined();
      inlineSpy.mockRestore();
    });

    // ai-review W14/W18 (2026-07-26) — background 본문은 부모와 같은 executionId
    // 를 공유해 `executeInline`→컨테이너 경로가 `containerCancelCheckedAtMs` 에
    // 동일 키로 set() 할 수 있다. background 는 fire-and-forget 이라 부모
    // `runExecution` finally 가 먼저 이 키를 지운 뒤에도 본문이 계속 실행되며
    // 다시 set() 될 수 있고, `executeBackgroundSubgraph` 자체가 정리하지 않으면
    // 이후 아무도 지우지 않아 무한 성장 누수로 남는다(실측: 두 delete 를 모두
    // 제거해도 415/415 GREEN — 회귀 커버리지 0이었다). 본문이 set() 한 상태를
    // 직접 시뮬레이션해 `executeBackgroundSubgraph` finally 가 정리하는지 단언한다.
    it('cleans up containerCancelCheckedAtMs for the shared executionId in finally (W14 background leak regression)', async () => {
      const priv = () =>
        service as unknown as {
          containerCancelCheckedAtMs: Map<string, number>;
        };
      // 본문이 컨테이너 아이템/반복 경계에서 set() 한 상태를 재현.
      priv().containerCancelCheckedAtMs.set(executionId, Date.now());
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockResolvedValue(undefined);

      await service.executeBackgroundSubgraph(
        makeBgJob({ backgroundRunId: 'bg-run-w14-cleanup' }),
      );

      expect(priv().containerCancelCheckedAtMs.has(executionId)).toBe(false);
      inlineSpy.mockRestore();
    });

    it('derives bgKey suffix from parentNodeExecutionId when backgroundRunId is empty (legacy job)', async () => {
      let capturedKey: string | undefined;
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_w, _i, options) => {
          capturedKey = options.context._contextKey;
          return Promise.resolve(undefined);
        });

      await service.executeBackgroundSubgraph(
        makeBgJob({ backgroundRunId: '', parentNodeExecutionId: 'parent-9' }),
      );

      expect(capturedKey).toBe(`bg:${executionId}:parent-9`);
      inlineSpy.mockRestore();
    });

    it("falls back to a 'root' bgKey suffix when backgroundRunId and parentNodeExecutionId are both empty", async () => {
      let capturedKey: string | undefined;
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_w, _i, options) => {
          capturedKey = options.context._contextKey;
          return Promise.resolve(undefined);
        });

      await service.executeBackgroundSubgraph(
        makeBgJob({ backgroundRunId: '', parentNodeExecutionId: '' }),
      );

      expect(capturedKey).toBe(`bg:${executionId}:root`);
      inlineSpy.mockRestore();
    });

    it('rejects when body exceeds maxDurationMs', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 200)),
        );

      const job = {
        executionId,
        parentNodeExecutionId: 'parent-1',
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
        config: { notifyOnFailure: false, maxDurationMs: 50 },
      };

      await expect(service.executeBackgroundSubgraph(job)).rejects.toThrow(
        /maxDurationMs/,
      );
      inlineSpy.mockRestore();
    });

    it('does not apply timeout when maxDurationMs is 0', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockResolvedValue(undefined);

      await service.executeBackgroundSubgraph({
        executionId,
        parentNodeExecutionId: 'parent-1',
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      });

      expect(inlineSpy).toHaveBeenCalled();
      inlineSpy.mockRestore();
    });

    it('forwards every body entry node id to executeInline so all forward-reachable body nodes get scheduled', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockResolvedValue(undefined);

      await service.executeBackgroundSubgraph({
        executionId,
        parentNodeExecutionId: 'parent-1',
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2', 'node-3', 'node-7'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      });

      const passed = inlineSpy.mock.calls[0][2];
      expect(passed.entryNodeIds).toEqual(['node-2', 'node-3', 'node-7']);
      // executeInline runs the topological sort itself; we just verify that
      // the entry seeds reach it intact so the body subgraph can be expanded.
      inlineSpy.mockRestore();
    });

    it('stamps parentNodeExecutionId on every NodeExecution created during the body run', async () => {
      // Capture the parentNodeExecutionId that executeInline will use for
      // any child NodeExecution created during the body subgraph run.
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_workflowId, _input, options) => {
          // Mimic a body node creating a NodeExecution row — the engine's
          // createNodeExecution helper reads context.parentNodeExecutionId
          // when callers don't pass an explicit parent. executeInline sets
          // context.parentNodeExecutionId from options.parentNodeExecutionId.
          expect(options.parentNodeExecutionId).toBe('background-parent-row');
          return Promise.resolve(undefined);
        });

      await service.executeBackgroundSubgraph({
        executionId,
        parentNodeExecutionId: 'background-parent-row',
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      });

      expect(inlineSpy).toHaveBeenCalled();
      inlineSpy.mockRestore();
    });

    it('passes a fresh executedNodes Set so body execution does not collide with the main flow', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockResolvedValue(undefined);

      await service.executeBackgroundSubgraph({
        executionId,
        parentNodeExecutionId: 'parent-1',
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: { 'node-1': { from: 'main' } },
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      });

      const passed = inlineSpy.mock.calls[0][2];
      // A new Set, not the main run's executedNodes — body must be free to
      // re-execute nodes that the main flow already executed (e.g. when the
      // user wires a body branch back through a node also reachable from main).
      expect(passed.executedNodes).toBeInstanceOf(Set);
      expect(passed.executedNodes.size).toBe(0);
      // The snapshot of nodeOutputCache from the main flow IS available to
      // the body via context, but it lives on the cloned context object —
      // not on the executedNodes set.
      expect(passed.context.nodeOutputCache).toEqual({
        'node-1': { from: 'main' },
      });
      inlineSpy.mockRestore();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // WARNING #8 (ai-review) — executeInline 의 _callStack push/pop 동작.
  // invokerNodeId 있을 때 push, 정상 반환 후 pop, 예외 시에도 finally pop.
  // exec-park D6, spec §7.5.
  // ──────────────────────────────────────────────────────────────────────
  describe('executeInline — _callStack push/pop (WARNING #8)', () => {
    let contextService: ExecutionContextService;

    beforeEach(() => {
      contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('invokerNodeId 있을 때 frame 이 _callStack 에 push 된다', async () => {
      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );
      context._callStack = [];

      let capturedStack: unknown[] | undefined;
      // mockHandler.execute 에서 _callStack 상태를 캡처한다.
      (mockHandler.execute as jest.Mock).mockImplementationOnce(
        async (_input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
          // 핸들러 실행 중 _callStack 상태 캡처
          capturedStack = ctx._callStack ? [...ctx._callStack] : undefined;
          return { config: {}, output: { result: 'ok' } };
        },
      );

      await service.executeInline(
        workflowId,
        {},
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'parent-exec',
          invokerNodeId: 'node-invoker-wf-1',
        },
      );

      // 핸들러 실행 중 _callStack 에 frame 이 push 됐어야 한다.
      expect(capturedStack).toBeDefined();
      expect(capturedStack).toContainEqual(
        expect.objectContaining({
          workflowId,
          invokerNodeId: 'node-invoker-wf-1',
          recursionDepth: 1,
        }),
      );
    });

    it('정상 반환 후 _callStack 이 pop 된다 (frame 제거)', async () => {
      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );
      context._callStack = [];

      (mockHandler.execute as jest.Mock).mockResolvedValue({
        config: {},
        output: { result: 'done' },
      });

      await service.executeInline(
        workflowId,
        {},
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'parent-exec',
          invokerNodeId: 'node-invoker-wf-2',
        },
      );

      // 반환 후 _callStack 이 비어있어야 한다 (pop 됨).
      expect(context._callStack).toHaveLength(0);
    });

    it('핸들러가 throw 해도 finally 로 _callStack 이 pop 된다', async () => {
      const throwingHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(() => Promise.reject(new Error('handler-throw'))),
      };
      handlerRegistry.register('test_node', throwingHandler);

      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );
      context._callStack = [];

      await expect(
        service.executeInline(
          workflowId,
          {},
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'parent-exec',
            invokerNodeId: 'node-invoker-wf-3',
          },
        ),
      ).rejects.toThrow('handler-throw');

      // 예외가 발생해도 finally 에서 pop — _callStack 비어있음.
      expect(context._callStack).toHaveLength(0);
    });

    it('invokerNodeId 없으면 _callStack 에 push 하지 않는다', async () => {
      const context = withWorkspace(
        contextService.createContext(executionId, workflowId),
      );
      context._callStack = [];

      (mockHandler.execute as jest.Mock).mockResolvedValue({
        config: {},
        output: { ok: true },
      });

      await service.executeInline(
        workflowId,
        {},
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'parent-exec',
          // invokerNodeId 없음
        },
      );

      // invokerNodeId 미전달 → push 없음 → length 그대로.
      expect(context._callStack).toHaveLength(0);
    });
  });
});
