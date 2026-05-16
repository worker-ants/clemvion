import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { WebsocketGateway } from './websocket.gateway';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ExecutionsService } from '../executions/executions.service';
import { BackgroundRunsService } from '../executions/background-runs/background-runs.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';

function createMockSocket(overrides: Record<string, unknown> = {}): {
  socket: Socket;
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
} {
  const join = jest.fn();
  const leave = jest.fn();
  const emit = jest.fn();
  const disconnect = jest.fn();
  const socket = {
    id: 'client-1',
    handshake: { query: {}, auth: {} },
    join,
    leave,
    emit,
    disconnect,
    ...overrides,
  } as unknown as Socket;
  return { socket, join, leave, emit, disconnect };
}

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        WebsocketGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
          },
        },
        {
          provide: ExecutionEngineService,
          useValue: {
            continueExecution: jest.fn(),
            cancelWaitingExecution: jest.fn(),
          },
        },
        {
          provide: ExecutionsService,
          useValue: {
            findById: jest.fn().mockRejectedValue(new Error('not found')),
            // CRIT #1 — IDOR 차단을 위해 verifyOwnership 호출. 테스트에서는
            // 기본적으로 통과시키고, 거부 케이스를 별도 테스트에서 override.
            verifyOwnership: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: KnowledgeBaseService,
          useValue: {
            // 기본 통과 — 거부 케이스는 별도 테스트에서 override
            verifyDocumentOwnership: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: BackgroundRunsService,
          useValue: {
            // 기본 통과 — 거부 케이스는 별도 테스트에서 override
            verifyBackgroundRunOwnership: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    gateway = module.get<WebsocketGateway>(WebsocketGateway);
  });

  function getSubscriptions(): Map<string, Set<string>> {
    return (gateway as unknown as { subscriptions: Map<string, Set<string>> })
      .subscriptions;
  }

  function setServer(server: unknown): void {
    (gateway as unknown as { server: unknown }).server = server;
  }

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handlePing', () => {
    it('should return pong with timestamp', () => {
      const result = gateway.handlePing();
      expect(result.event).toBe('pong');
      expect(result.data.timestamp).toBeDefined();
      expect(typeof result.data.timestamp).toBe('number');
    });
  });

  describe('handleSubscribe', () => {
    it('should reject invalid channel', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      getSubscriptions().set('client-1', new Set());

      const result = await gateway.handleSubscribe(
        { channel: 'invalid:123' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Invalid channel');
    });

    it('should accept valid execution channel', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      getSubscriptions().set('client-1', new Set());

      const result = await gateway.handleSubscribe(
        { channel: 'execution:exec-123' },
        socket,
      );
      expect(result.data.success).toBe(true);
      expect(result.data.channel).toBe('execution:exec-123');
      expect(join).toHaveBeenCalledWith('execution:exec-123');
    });

    it('should accept kb channel when ownership verified', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());

      const result = await gateway.handleSubscribe(
        { channel: 'kb:doc-abc' },
        socket,
      );
      expect(result.data.success).toBe(true);
      expect(result.data.channel).toBe('kb:doc-abc');
      expect(join).toHaveBeenCalledWith('kb:doc-abc');
      const kbService = module.get(KnowledgeBaseService);
      expect(kbService.verifyDocumentOwnership).toHaveBeenCalledWith(
        'doc-abc',
        'ws-1',
      );
    });

    it('should reject kb channel when ownership check fails (cross-workspace)', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-attacker';
      getSubscriptions().set('client-1', new Set());
      const kbService = module.get(KnowledgeBaseService);
      (kbService.verifyDocumentOwnership as jest.Mock).mockResolvedValueOnce(
        false,
      );

      const result = await gateway.handleSubscribe(
        { channel: 'kb:doc-victim' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for this document');
      expect(join).not.toHaveBeenCalled();
    });

    it('should reject kb channel when verifyDocumentOwnership throws', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());
      const kbService = module.get(KnowledgeBaseService);
      (kbService.verifyDocumentOwnership as jest.Mock).mockRejectedValueOnce(
        new Error('PG connection refused'),
      );

      const result = await gateway.handleSubscribe(
        { channel: 'kb:doc-abc' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for this document');
      expect(join).not.toHaveBeenCalled();
    });

    it('should accept background:run channel when ownership verified', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());

      const result = await gateway.handleSubscribe(
        { channel: 'background:run:8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234' },
        socket,
      );
      expect(result.data.success).toBe(true);
      expect(result.data.channel).toBe(
        'background:run:8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234',
      );
      expect(join).toHaveBeenCalledWith(
        'background:run:8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234',
      );
      const bgRunsService = module.get(BackgroundRunsService);
      expect(bgRunsService.verifyBackgroundRunOwnership).toHaveBeenCalledWith(
        '8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234',
        'ws-1',
      );
    });

    it('should reject background:run channel when ownership check fails (cross-workspace)', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-attacker';
      getSubscriptions().set('client-1', new Set());
      const bgRunsService = module.get(BackgroundRunsService);
      (
        bgRunsService.verifyBackgroundRunOwnership as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await gateway.handleSubscribe(
        { channel: 'background:run:8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for this background run');
      expect(join).not.toHaveBeenCalled();
    });

    it('should reject background:run channel when the id is not a UUID (W-6 — defense in depth)', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());
      const bgRunsService = module.get(BackgroundRunsService);
      // verify* must not be called when UUID validation fails (saves DB roundtrip).
      const verifySpy = bgRunsService.verifyBackgroundRunOwnership as jest.Mock;
      verifySpy.mockClear();

      const result = await gateway.handleSubscribe(
        { channel: 'background:run:not-a-uuid; DROP TABLE x;' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for this background run');
      expect(verifySpy).not.toHaveBeenCalled();
      expect(join).not.toHaveBeenCalled();
    });

    it('should reject background:run channel when verifyBackgroundRunOwnership throws (DB error)', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());
      const bgRunsService = module.get(BackgroundRunsService);
      (
        bgRunsService.verifyBackgroundRunOwnership as jest.Mock
      ).mockRejectedValueOnce(new Error('PG connection refused'));

      const result = await gateway.handleSubscribe(
        { channel: 'background:run:8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234' },
        socket,
      );
      // catch 가 `.catch(() => false)` 로 fail-safe — 권한 부재로 처리.
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for this background run');
      expect(join).not.toHaveBeenCalled();
    });

    it('should emit execution.snapshot to the subscribing client when execution exists', async () => {
      const { socket, emit } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());

      const fakeExecution = {
        id: 'exec-abc',
        status: 'running',
        nodeExecutions: [],
      };

      const findByIdMock = jest.mocked(module.get(ExecutionsService).findById);
      findByIdMock.mockResolvedValue(fakeExecution as never);

      await gateway.handleSubscribe({ channel: 'execution:exec-abc' }, socket);

      // emitExecutionSnapshot is fire-and-forget — wait a macrotask so the
      // awaited findById resolves and the emit side-effect lands.
      await new Promise((resolve) => setImmediate(resolve));

      expect(findByIdMock).toHaveBeenCalledWith('exec-abc');
      expect(emit).toHaveBeenCalledWith(
        'execution.snapshot',
        expect.objectContaining({
          executionId: 'exec-abc',
          execution: fakeExecution,
        }),
      );
    });

    it('should NOT emit execution.snapshot when workspace ownership check fails (IDOR block)', async () => {
      const { socket, emit } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-attacker';
      getSubscriptions().set('client-1', new Set());

      const execService = module.get(ExecutionsService);
      // verifyOwnership rejects on workspace mismatch — emitExecutionSnapshot
      // 가 try/catch 에서 swallow 하므로 .findById 는 호출되지 않아야 한다.
      (execService.verifyOwnership as jest.Mock).mockRejectedValueOnce(
        new Error('Execution not found'),
      );

      await gateway.handleSubscribe(
        { channel: 'execution:exec-victim' },
        socket,
      );
      await new Promise((resolve) => setImmediate(resolve));

      expect(execService.verifyOwnership).toHaveBeenCalledWith(
        'exec-victim',
        'ws-attacker',
      );
      expect(execService.findById).not.toHaveBeenCalled();
      const snapshotEmitted = emit.mock.calls.some(
        (call: unknown[]) => call[0] === 'execution.snapshot',
      );
      expect(snapshotEmitted).toBe(false);
    });

    it('should not re-emit snapshot on duplicate subscribe', async () => {
      const { socket, emit } = createMockSocket({ id: 'client-1' });
      const existing = new Set(['execution:exec-abc']);
      getSubscriptions().set('client-1', existing);

      const findByIdMock = jest.mocked(module.get(ExecutionsService).findById);
      findByIdMock.mockResolvedValue({ id: 'exec-abc' } as never);

      await gateway.handleSubscribe({ channel: 'execution:exec-abc' }, socket);
      await new Promise((resolve) => setImmediate(resolve));

      expect(findByIdMock).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it('should reject when max subscriptions reached', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      const subs = new Set<string>();
      for (let i = 0; i < 20; i++) {
        subs.add(`execution:exec-${i}`);
      }
      getSubscriptions().set('client-1', subs);

      const result = await gateway.handleSubscribe(
        { channel: 'execution:exec-new' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('Maximum subscriptions');
    });

    it('enforces MAX_SUBSCRIPTIONS across concurrent subscribe with deferred authorize (TOCTOU race)', async () => {
      // 시나리오: clientSubs.size === 19, MAX === 20.
      // 동시에 두 개의 인가 대상 채널(kb:doc-A, kb:doc-B) 을 subscribe 한다.
      // authorize 가 둘 다 yield 한 뒤 차례로 resolve 될 때, recheck + add 의
      // 원자성이 깨지면 size 가 21 까지 증가할 수 있다.
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      const subs = new Set<string>();
      for (let i = 0; i < 19; i++) subs.add(`execution:exec-${i}`);
      getSubscriptions().set('client-1', subs);

      // kb:doc 채널은 verifyDocumentOwnership 으로 인가 (async).
      const kbService = module.get(KnowledgeBaseService);
      // 두 호출 모두 deferred resolve 로 동시에 await 경계에 머무르게 한다.
      let resolveA: (v: boolean) => void = () => undefined;
      let resolveB: (v: boolean) => void = () => undefined;
      (kbService.verifyDocumentOwnership as jest.Mock)
        .mockImplementationOnce(
          () => new Promise<boolean>((r) => (resolveA = r)),
        )
        .mockImplementationOnce(
          () => new Promise<boolean>((r) => (resolveB = r)),
        );

      const pA = gateway.handleSubscribe({ channel: 'kb:doc-A' }, socket);
      const pB = gateway.handleSubscribe({ channel: 'kb:doc-B' }, socket);
      // 둘 다 authorize 단계에 진입한 뒤 동시 resolve.
      resolveA(true);
      resolveB(true);
      const [rA, rB] = await Promise.all([pA, pB]);

      // 정확히 한 개만 성공해야 한다 (20 한도). 둘 다 실패도 안 됨.
      const successes = [rA, rB].filter((r) => r.data.success).length;
      expect(successes).toBe(1);
      expect(subs.size).toBeLessThanOrEqual(20);
      // 실패한 쪽은 채널에 join 하지 않는다 (롤백/거부).
      expect(join).toHaveBeenCalledTimes(successes);
    });
  });

  describe('handleUnsubscribe', () => {
    it('should unsubscribe from channel', () => {
      const { socket, leave } = createMockSocket({ id: 'client-1' });
      const subs = new Set(['execution:exec-123']);
      getSubscriptions().set('client-1', subs);

      const result = gateway.handleUnsubscribe(
        { channel: 'execution:exec-123' },
        socket,
      );
      expect(result.data.success).toBe(true);
      expect(leave).toHaveBeenCalledWith('execution:exec-123');
    });
  });

  describe('handleConnection', () => {
    it('should disconnect client without token', () => {
      const { socket, emit, disconnect } = createMockSocket({
        id: 'client-no-token',
        handshake: { query: {}, auth: {} },
      });

      gateway.handleConnection(socket);
      expect(emit).toHaveBeenCalledWith('error', {
        message: 'Authentication required',
      });
      expect(disconnect).toHaveBeenCalled();
    });

    it('should accept client with valid token', () => {
      const { socket, disconnect } = createMockSocket({
        id: 'client-valid',
        handshake: { query: { token: 'valid-jwt' }, auth: {} },
      });

      gateway.handleConnection(socket);
      expect(disconnect).not.toHaveBeenCalled();
      expect(getSubscriptions().has('client-valid')).toBe(true);
    });
  });

  describe('handleDisconnect', () => {
    it('should cleanup subscriptions', () => {
      const { socket, leave } = createMockSocket({ id: 'client-1' });
      const subs = new Set(['execution:exec-1', 'workflow:wf-1']);
      getSubscriptions().set('client-1', subs);

      gateway.handleDisconnect(socket);
      expect(getSubscriptions().has('client-1')).toBe(false);
      expect(leave).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleSubmitForm', () => {
    it('should reject unauthenticated client', async () => {
      const { socket } = createMockSocket({ id: 'no-auth' });

      const result = await gateway.handleSubmitForm(
        { executionId: 'exec-1', formData: { approved: true } },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authenticated');
    });

    it('should call continueExecution on success', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';

      const result = await gateway.handleSubmitForm(
        { executionId: 'exec-1', formData: { approved: true } },
        socket,
      );
      expect(result.data.success).toBe(true);
    });

    it('should return error when continueExecution throws', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';

      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.continueExecution as jest.Mock).mockImplementation(() => {
        throw new Error('No pending continuation');
      });

      const result = await gateway.handleSubmitForm(
        { executionId: 'non-existent', formData: {} },
        socket,
      );
      expect(result.data.success).toBe(false);
      // Surface the underlying engine error so the client can render a
      // diagnostic toast instead of a generic placeholder.
      expect(result.data.error).toBe('No pending continuation');
    });

    it('should reject when ownership verification fails (IDOR guard)', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId =
        'workspace-attacker';

      const mockExecutions = module.get(ExecutionsService);
      (mockExecutions.verifyOwnership as jest.Mock).mockRejectedValueOnce(
        new Error('Execution not found'),
      );

      const result = await gateway.handleSubmitForm(
        { executionId: 'exec-victim', formData: {} },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for this execution');
    });
  });

  describe('broadcastToChannel', () => {
    it('should emit to the correct channel', () => {
      const emitFn = jest.fn();
      const mockServer = {
        to: jest.fn().mockReturnValue({ emit: emitFn }),
      };
      setServer(mockServer);

      gateway.broadcastToChannel('execution:exec-1', 'execution.started', {
        status: 'running',
      });

      expect(mockServer.to).toHaveBeenCalledWith('execution:exec-1');
      expect(emitFn).toHaveBeenCalledWith('execution.started', {
        status: 'running',
      });
    });
  });
});
