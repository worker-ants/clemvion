import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { WebsocketGateway } from './websocket.gateway';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { RetryTurnService } from '../execution-engine/retry-turn.service';
import {
  InvalidExecutionStateError,
  MessageTooLongError,
  RetryLastTurnError,
  FormValidationError,
} from '../execution-engine/workflow-errors';
import { ExecutionsService } from '../executions/executions.service';
import { BackgroundRunsService } from '../executions/background-runs/background-runs.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { CHANNEL_AUTHORIZER, ChannelAuthorizer } from './channel-authorizer';
import { NotificationsChannelAuthorizer } from './notifications-channel-authorizer';
import { ExecutionChannelAuthorizer } from '../executions/execution-channel-authorizer';
import { BackgroundRunChannelAuthorizer } from '../executions/background-runs/background-run-channel-authorizer';
import { KbChannelAuthorizer } from '../knowledge-base/kb-channel-authorizer';
import { WorkflowChannelAuthorizer } from '../workflows/workflow-channel-authorizer';

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
            // Phase 2.5 — publish 가 `{queued, jobId}` 반환. WS gateway 가
            // ack 에 `queued: result.queued` 동봉 + `jobId === null` 분기.
            continueExecution: jest
              .fn()
              .mockResolvedValue({ queued: true, jobId: 'mock-job-id' }),
            continueButtonClick: jest
              .fn()
              .mockResolvedValue({ queued: true, jobId: 'mock-job-id' }),
            continueAiConversation: jest
              .fn()
              .mockResolvedValue({ queued: true, jobId: 'mock-job-id' }),
            endAiConversation: jest
              .fn()
              .mockResolvedValue({ queued: true, jobId: 'mock-job-id' }),
            cancelWaitingExecution: jest.fn(),
            publishRetryLastTurn: jest
              .fn()
              .mockResolvedValue({ queued: true, jobId: 'mock-job-id' }),
            // W3: publish 실패 시 zombie row 방지 — 보상 메서드.
            markSpawnedRowFailedOnPublishError: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          // C-1 후속 ④ — retryLastTurn(validate+consume+spawn)은 엔진 delegator
          // 제거 후 RetryTurnService 가 직접 표면. gateway 가 본 서비스를 호출한다.
          provide: RetryTurnService,
          useValue: {
            retryLastTurn: jest
              .fn()
              .mockResolvedValue({ spawnedNodeExecutionId: 'ne-spawned' }),
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
        {
          provide: WorkflowsService,
          useValue: {
            // 04 M-6 — workflow: authorizer. 기본 통과(엔티티 반환),
            // 거부 케이스는 별도 테스트에서 mockRejectedValueOnce 로 override.
            findById: jest.fn().mockResolvedValue({ id: 'wf' }),
          },
        },
        // refactor 02 M-7 — gateway 가 인라인 배열 대신 CHANNEL_AUTHORIZER 를 주입받는다.
        // 실 authorizer 클래스들을 위 서비스 mock 위에 wiring + useFactory 로 집계(prod
        // websocket.module 과 동일 구조)하면 기존 subscribe 인가 동작 테스트
        // (verifyOwnership/findById 호출 검증)가 그대로 유효하며 DI 역전도 함께 검증된다.
        ExecutionChannelAuthorizer,
        BackgroundRunChannelAuthorizer,
        WorkflowChannelAuthorizer,
        KbChannelAuthorizer,
        NotificationsChannelAuthorizer,
        {
          provide: CHANNEL_AUTHORIZER,
          useFactory: (
            ...authorizers: ChannelAuthorizer[]
          ): ChannelAuthorizer[] => authorizers,
          inject: [
            ExecutionChannelAuthorizer,
            BackgroundRunChannelAuthorizer,
            WorkflowChannelAuthorizer,
            KbChannelAuthorizer,
            NotificationsChannelAuthorizer,
          ],
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

  describe('CHANNEL_AUTHORIZER 주입 (refactor 02 M-7)', () => {
    function injectedAuthorizers(): unknown[] {
      return (gateway as unknown as { channelAuthorizers: unknown[] })
        .channelAuthorizers;
    }

    it('injects all registered channel authorizers as an array', () => {
      // useFactory 집계가 5개 authorizer(execution/background:run/workflow/kb/
      // notifications)를 배열로 주입했는지 — module/spec wiring 동기화 가드.
      const authorizers = injectedAuthorizers();
      expect(Array.isArray(authorizers)).toBe(true);
      expect(authorizers).toHaveLength(5);
    });

    it('rejects a valid-prefix channel with no matching authorizer (fail-closed, W-5)', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());
      // VALID_CHANNEL_PREFIXES 와 authorizer 배열이 어긋난 상황을 강제(배열 비움).
      (
        gateway as unknown as { channelAuthorizers: unknown[] }
      ).channelAuthorizers = [];

      const result = await gateway.handleSubscribe(
        { channel: 'execution:11111111-1111-4111-8111-111111111111' },
        socket,
      );

      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for this channel');
      expect(join).not.toHaveBeenCalled();
    });
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
      // execution: 구독은 이제 workspace 소유 검증 authorizer 를 거친다 (IDOR fix).
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());

      const channel = 'execution:11111111-1111-4111-8111-111111111111';
      const result = await gateway.handleSubscribe({ channel }, socket);
      expect(result.data.success).toBe(true);
      expect(result.data.channel).toBe(channel);
      expect(join).toHaveBeenCalledWith(channel);
    });

    it('should accept kb channel when ownership verified', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());

      // kb document id 는 UUID(Document.id = @PrimaryGeneratedColumn('uuid')).
      const channel = 'kb:cccccccc-1111-4111-8111-cccccccccccc';
      const result = await gateway.handleSubscribe({ channel }, socket);
      expect(result.data.success).toBe(true);
      expect(result.data.channel).toBe(channel);
      expect(join).toHaveBeenCalledWith(channel);
      const kbService = module.get(KnowledgeBaseService);
      expect(kbService.verifyDocumentOwnership).toHaveBeenCalledWith(
        'cccccccc-1111-4111-8111-cccccccccccc',
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
        { channel: 'kb:dddddddd-2222-4222-8222-dddddddddddd' },
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
        { channel: 'kb:cccccccc-1111-4111-8111-cccccccccccc' },
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

    // 04 M-6 — workflow: 채널 authorizer (workflowId→workspace 소유 IDOR 차단).
    const WF_UUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    it('should accept workflow channel when ownership verified', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());

      const result = await gateway.handleSubscribe(
        { channel: `workflow:${WF_UUID}` },
        socket,
      );
      expect(result.data.success).toBe(true);
      expect(join).toHaveBeenCalledWith(`workflow:${WF_UUID}`);
      const wfService = module.get(WorkflowsService);
      expect(wfService.findById).toHaveBeenCalledWith(WF_UUID, 'ws-1');
    });

    it('should reject workflow channel when ownership check fails (cross-workspace IDOR)', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-attacker';
      getSubscriptions().set('client-1', new Set());
      const wfService = module.get(WorkflowsService);
      (wfService.findById as jest.Mock).mockRejectedValueOnce(
        new Error('Workflow not found'),
      );

      const result = await gateway.handleSubscribe(
        { channel: `workflow:${WF_UUID}` },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for this workflow');
      expect(join).not.toHaveBeenCalled();
    });

    it('should reject workflow channel when the id is not a UUID (defense in depth)', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());
      const wfService = module.get(WorkflowsService);
      const findSpy = wfService.findById as jest.Mock;
      findSpy.mockClear();

      const result = await gateway.handleSubscribe(
        { channel: 'workflow:not-a-uuid' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for this workflow');
      // 비-UUID 는 DB 조회 전 차단.
      expect(findSpy).not.toHaveBeenCalled();
      expect(join).not.toHaveBeenCalled();
    });

    // 04 M-6 — notifications:<userId> 채널 authorizer (JWT sub 일치, 선제 차단).
    it('should accept notifications channel for the matching user', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      const enriched = socket as Socket & {
        workspaceId?: string;
        userId?: string;
      };
      enriched.workspaceId = 'ws-1';
      enriched.userId = 'user-1';
      getSubscriptions().set('client-1', new Set());

      const result = await gateway.handleSubscribe(
        { channel: 'notifications:user-1' },
        socket,
      );
      expect(result.data.success).toBe(true);
      expect(join).toHaveBeenCalledWith('notifications:user-1');
    });

    it('should reject notifications channel for a different user (IDOR)', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      const enriched = socket as Socket & {
        workspaceId?: string;
        userId?: string;
      };
      enriched.workspaceId = 'ws-1';
      enriched.userId = 'user-1';
      getSubscriptions().set('client-1', new Set());

      const result = await gateway.handleSubscribe(
        { channel: 'notifications:user-2' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for these notifications');
      expect(join).not.toHaveBeenCalled();
    });

    // 04 후속 — userId 미설정 소켓이 notifications 채널을 구독 시도하면 거부(fail-closed).
    // (인증 미들웨어 회귀로 userId 가 비더라도 알림 누출이 없어야 한다.)
    it('should reject notifications channel when the socket has no userId', async () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      const enriched = socket as Socket & {
        workspaceId?: string;
        userId?: string;
      };
      enriched.workspaceId = 'ws-1'; // workspace 가드는 통과, userId 만 부재
      getSubscriptions().set('client-1', new Set());

      const result = await gateway.handleSubscribe(
        { channel: 'notifications:user-1' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authorized for these notifications');
      expect(join).not.toHaveBeenCalled();
    });

    it('should emit execution.snapshot to the subscribing client when execution exists', async () => {
      const { socket, emit } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      getSubscriptions().set('client-1', new Set());

      const execId = '11111111-1111-4111-8111-111111111111';
      const fakeExecution = {
        id: execId,
        status: 'running',
        nodeExecutions: [],
      };

      const findByIdMock = jest.mocked(module.get(ExecutionsService).findById);
      findByIdMock.mockResolvedValue(fakeExecution as never);

      await gateway.handleSubscribe({ channel: `execution:${execId}` }, socket);

      // emitExecutionSnapshot is fire-and-forget — wait a macrotask so the
      // awaited findById resolves and the emit side-effect lands.
      await new Promise((resolve) => setImmediate(resolve));

      expect(findByIdMock).toHaveBeenCalledWith(execId);
      expect(emit).toHaveBeenCalledWith(
        'execution.snapshot',
        expect.objectContaining({
          executionId: execId,
          execution: fakeExecution,
        }),
      );
    });

    it('should NOT join or emit execution.snapshot when workspace ownership check fails (IDOR block)', async () => {
      const { socket, emit, join } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-attacker';
      getSubscriptions().set('client-1', new Set());

      const execId = '22222222-2222-4222-8222-222222222222';
      const execService = module.get(ExecutionsService);
      // verifyOwnership 가 authorizer 단계(join 이전)에서 reject → 구독 자체가
      // 거부되어 room join·snapshot 모두 발생하지 않는다 (IDOR 차단의 핵심).
      (execService.verifyOwnership as jest.Mock).mockRejectedValueOnce(
        new Error('Execution not found'),
      );

      const result = await gateway.handleSubscribe(
        { channel: `execution:${execId}` },
        socket,
      );
      await new Promise((resolve) => setImmediate(resolve));

      expect(result.data.success).toBe(false);
      expect(execService.verifyOwnership).toHaveBeenCalledWith(
        execId,
        'ws-attacker',
      );
      expect(join).not.toHaveBeenCalled();
      expect(execService.findById).not.toHaveBeenCalled();
      const snapshotEmitted = emit.mock.calls.some(
        (call: unknown[]) => call[0] === 'execution.snapshot',
      );
      expect(snapshotEmitted).toBe(false);
    });

    it('should not re-emit snapshot on duplicate subscribe', async () => {
      const { socket, emit } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { workspaceId?: string }).workspaceId = 'ws-1';
      const execId = '11111111-1111-4111-8111-111111111111';
      const existing = new Set([`execution:${execId}`]);
      getSubscriptions().set('client-1', existing);

      const findByIdMock = jest.mocked(module.get(ExecutionsService).findById);
      findByIdMock.mockResolvedValue({ id: execId } as never);

      // 이미 구독 중(isNewSubscription=false) — authorizer 는 통과하나 snapshot 은
      // 재발행하지 않는다.
      await gateway.handleSubscribe({ channel: `execution:${execId}` }, socket);
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
      // 동시에 두 개의 인가 대상 채널(kb:<uuidA>, kb:<uuidB>) 을 subscribe 한다.
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

      const pA = gateway.handleSubscribe(
        { channel: 'kb:aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' },
        socket,
      );
      const pB = gateway.handleSubscribe(
        { channel: 'kb:bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb' },
        socket,
      );
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

    it('continueExecution 이 plain Error 를 throw 하면 내부 message 미전달 + generic fallback (§7.5.2)', async () => {
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
      // A-1 §7.5.2 — 비-typed Error 의 내부 message 는 client 에 전달하지 않고
      // 고정 generic fallback + EXECUTION_INTERNAL_ERROR 로 축약 (누출 차단).
      expect(result.data.error).toBe('Form submission failed');
      expect(result.data.errorCode).toBe('EXECUTION_INTERNAL_ERROR');
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

    it('변경 2.3 — InvalidExecutionStateError 면 ack 에 errorCode=INVALID_EXECUTION_STATE 동봉 (spec §7.5.1)', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';

      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.continueExecution as jest.Mock).mockRejectedValueOnce(
        new InvalidExecutionStateError('not waiting'),
      );

      const result = await gateway.handleSubmitForm(
        { executionId: 'exec-1', formData: {} },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.errorCode).toBe('INVALID_EXECUTION_STATE');
    });

    it('A-1 §7.5.2 — 비-typed 에러는 내부 message 미전달 + errorCode=EXECUTION_INTERNAL_ERROR (누출 차단)', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';

      const mockEngine = module.get(ExecutionEngineService);
      // 내부 식별자·SQL 원문을 담은 plain Error (누출 위험 시뮬레이션)
      (mockEngine.continueExecution as jest.Mock).mockRejectedValueOnce(
        new Error(
          'QueryFailedError: SELECT * FROM secret_internal_table WHERE id=42 — connection refused at 10.0.0.5:5432',
        ),
      );

      const result = await gateway.handleSubmitForm(
        { executionId: 'exec-1', formData: {} },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.errorCode).toBe('EXECUTION_INTERNAL_ERROR');
      // 보안 게이트: 내부 message(스택 힌트·SQL 원문·내부 IP/식별자)는 client ack 에 미포함
      expect(result.data.error).not.toContain('secret_internal_table');
      expect(result.data.error).not.toContain('10.0.0.5');
      expect(result.data.error).not.toContain('QueryFailedError');
      // 고정 generic fallback 만 노출
      expect(result.data.error).toBe('Form submission failed');
    });

    it('A-1 §7.5.2 — typed MessageTooLongError 는 고정 client-safe message + EXECUTION_MESSAGE_TOO_LONG (수치 미노출)', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';

      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.continueAiConversation as jest.Mock).mockRejectedValueOnce(
        new MessageTooLongError(10_000, 123_456),
      );

      const result = await gateway.handleSubmitMessage(
        { executionId: 'exec-1', message: 'x' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.errorCode).toBe('EXECUTION_MESSAGE_TOO_LONG');
      expect(result.data.error).toBe(
        'Message exceeds the maximum allowed length.',
      );
      // serverDetail 의 실제 길이 수치는 client ack 에 노출되지 않는다
      expect(result.data.error).not.toContain('123456');
      expect(result.data.error).not.toContain('123,456');
    });

    it('W-12 — FormValidationError → ack { errorCode: VALIDATION_ERROR } (spec form §4·§6.2)', async () => {
      // FormValidationError extends ExecutionError — buildContinuationErrorAck 가
      // typed ExecutionError 계층으로 code + message 를 surface 해야 한다.
      // 이 회귀 가드는 buildContinuationErrorAck 리팩터 시 VALIDATION_ERROR 가
      // EXECUTION_INTERNAL_ERROR 로 fallback 되는 silent regression 을 방지한다.
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';

      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.continueExecution as jest.Mock).mockRejectedValueOnce(
        new FormValidationError('email', '올바른 이메일 형식이 아닙니다.'),
      );

      const result = await gateway.handleSubmitForm(
        { executionId: 'exec-1', formData: { email: 'bad' } },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.errorCode).toBe('VALIDATION_ERROR');
      // client-safe 고정 검증 메시지 — field 값 미포함
      expect(result.data.error).toBe('올바른 이메일 형식이 아닙니다.');
    });

    it('Phase 2.5 — success ack 에 resumed + queued + executionId 동봉 (spec §4.2)', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';

      const result = await gateway.handleSubmitForm(
        { executionId: 'exec-1', formData: { approved: true } },
        socket,
      );
      expect(result.data).toMatchObject({
        success: true,
        executionId: 'exec-1',
        resumed: true,
        queued: true,
      });
    });

    it('Phase 2.5 — publish 가 queued=false 반환 (Redis 장애) 시 success=false + user-safe error 메시지', async () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';

      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.continueExecution as jest.Mock).mockResolvedValueOnce({
        queued: false,
        jobId: null,
      });

      const result = await gateway.handleSubmitForm(
        { executionId: 'exec-1', formData: {} },
        socket,
      );
      expect(result.data.success).toBe(false);
      // W20: user-safe message — no Redis infrastructure details exposed.
      expect(result.data.error).toMatch(/could not be queued/);
    });
  });

  describe('handleRetryLastTurn (spec WS §4.2)', () => {
    function authedSocket(): Socket {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';
      return socket;
    }

    it('success ack: { success:true, executionId, nodeExecutionId, resumed:true }', async () => {
      const result = await gateway.handleRetryLastTurn(
        { executionId: 'exec-1', nodeExecutionId: 'ne-failed' },
        authedSocket(),
      );
      expect(result.event).toBe('execution.retry_last_turn.ack');
      expect(result.data).toEqual({
        success: true,
        executionId: 'exec-1',
        nodeExecutionId: 'ne-failed',
        resumed: true,
      });
    });

    it('validate+consume+spawn then publish handoff with spawned id', async () => {
      const mockEngine = module.get(ExecutionEngineService);
      const mockRetry = module.get(RetryTurnService);
      await gateway.handleRetryLastTurn(
        { executionId: 'exec-1', nodeExecutionId: 'ne-failed' },
        authedSocket(),
      );
      expect(mockRetry.retryLastTurn).toHaveBeenCalledWith(
        'exec-1',
        'ne-failed',
      );
      expect(mockEngine.publishRetryLastTurn).toHaveBeenCalledWith(
        'exec-1',
        'ne-spawned',
      );
    });

    it('unauthenticated → nested error ack (resumed:false)', async () => {
      const { socket } = createMockSocket({ id: 'no-auth' });
      const result = await gateway.handleRetryLastTurn(
        { executionId: 'exec-1', nodeExecutionId: 'ne-failed' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.resumed).toBe(false);
      expect(result.data.error?.code).toBe('UNAUTHENTICATED');
    });

    // S1: ownership 실패 응답은 NOT_FOUND 로 통일 — sibling handler 의 IDOR
    // 방어 정책(ID enumeration 차단) 일치.
    it('ownership failure → nested NOT_FOUND error ack (IDOR enumeration defense)', async () => {
      const mockExecutions = module.get(ExecutionsService);
      (mockExecutions.verifyOwnership as jest.Mock).mockRejectedValueOnce(
        new Error('Execution not found'),
      );
      const result = await gateway.handleRetryLastTurn(
        { executionId: 'exec-victim', nodeExecutionId: 'ne-failed' },
        authedSocket(),
      );
      expect(result.data.success).toBe(false);
      expect(result.data.resumed).toBe(false);
      expect(result.data.error?.code).toBe('NOT_FOUND');
    });

    it('RetryLastTurnError → nested error ack with its code (RETRY_STATE_NOT_FOUND)', async () => {
      const mockRetry = module.get(RetryTurnService);
      (mockRetry.retryLastTurn as jest.Mock).mockRejectedValueOnce(
        RetryLastTurnError.notFound('gone'),
      );
      const result = await gateway.handleRetryLastTurn(
        { executionId: 'exec-1', nodeExecutionId: 'ne-failed' },
        authedSocket(),
      );
      expect(result.data).toMatchObject({
        success: false,
        executionId: 'exec-1',
        nodeExecutionId: 'ne-failed',
        resumed: false,
        error: { code: 'RETRY_STATE_NOT_FOUND' },
      });
    });

    it('NODE_NOT_RETRYABLE surfaces in nested error ack', async () => {
      const mockRetry = module.get(RetryTurnService);
      (mockRetry.retryLastTurn as jest.Mock).mockRejectedValueOnce(
        RetryLastTurnError.notRetryable('nope'),
      );
      const result = await gateway.handleRetryLastTurn(
        { executionId: 'exec-1', nodeExecutionId: 'ne-failed' },
        authedSocket(),
      );
      expect(result.data.error?.code).toBe('NODE_NOT_RETRYABLE');
    });

    it('RETRY_TOO_EARLY surfaces in nested error ack', async () => {
      const mockRetry = module.get(RetryTurnService);
      (mockRetry.retryLastTurn as jest.Mock).mockRejectedValueOnce(
        RetryLastTurnError.tooEarly('wait'),
      );
      const result = await gateway.handleRetryLastTurn(
        { executionId: 'exec-1', nodeExecutionId: 'ne-failed' },
        authedSocket(),
      );
      expect(result.data.error?.code).toBe('RETRY_TOO_EARLY');
    });

    it('InvalidExecutionStateError → nested INVALID_EXECUTION_STATE error ack', async () => {
      const mockRetry = module.get(RetryTurnService);
      (mockRetry.retryLastTurn as jest.Mock).mockRejectedValueOnce(
        new InvalidExecutionStateError('not failed'),
      );
      const result = await gateway.handleRetryLastTurn(
        { executionId: 'exec-1', nodeExecutionId: 'ne-failed' },
        authedSocket(),
      );
      expect(result.data.error?.code).toBe('INVALID_EXECUTION_STATE');
    });

    it('publish queued=false (Redis failure) → INTERNAL_ERROR nested ack', async () => {
      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.publishRetryLastTurn as jest.Mock).mockResolvedValueOnce({
        queued: false,
        jobId: null,
      });
      const result = await gateway.handleRetryLastTurn(
        { executionId: 'exec-1', nodeExecutionId: 'ne-failed' },
        authedSocket(),
      );
      expect(result.data.success).toBe(false);
      expect(result.data.resumed).toBe(false);
      expect(result.data.error?.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('handleSubmitMessage (§7.5.2 leak-block, I-11)', () => {
    function authedMessageSocket(): Socket {
      const { socket } = createMockSocket({ id: 'client-msg' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';
      return socket;
    }

    it('plain Error 를 throw 하면 내부 message 미전달 + EXECUTION_INTERNAL_ERROR fallback (§7.5.2)', async () => {
      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.continueAiConversation as jest.Mock).mockRejectedValueOnce(
        new Error('SELECT * FROM secrets WHERE id=999 — internal PG error'),
      );

      const result = await gateway.handleSubmitMessage(
        { executionId: 'exec-1', nodeId: 'node-1', message: 'hi' },
        authedMessageSocket(),
      );
      expect(result.data.success).toBe(false);
      // 보안 게이트: 내부 message/stack 은 client ack 에 미포함.
      expect(result.data.errorCode).toBe('EXECUTION_INTERNAL_ERROR');
      expect(result.data.error).toBe('Message submission failed');
      expect(result.data.error).not.toContain('secrets');
      expect(result.data.error).not.toContain('PG error');
    });

    it('typed MessageTooLongError 는 고정 message + EXECUTION_MESSAGE_TOO_LONG (수치 미노출)', async () => {
      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.continueAiConversation as jest.Mock).mockRejectedValueOnce(
        new MessageTooLongError(10_000, 200_001),
      );

      const result = await gateway.handleSubmitMessage(
        {
          executionId: 'exec-1',
          nodeId: 'node-1',
          message: 'x'.repeat(200_001),
        },
        authedMessageSocket(),
      );
      expect(result.data.success).toBe(false);
      expect(result.data.errorCode).toBe('EXECUTION_MESSAGE_TOO_LONG');
      expect(result.data.error).toBe(
        'Message exceeds the maximum allowed length.',
      );
      // 서버 로그 전용 수치가 client ack 에 노출되지 않는다.
      expect(result.data.error).not.toContain('200001');
      expect(result.data.error).not.toContain('10000');
    });
  });

  describe('handleEndConversation (§7.5.2 leak-block, I-10)', () => {
    function authedEndConvSocket(): Socket {
      const { socket } = createMockSocket({ id: 'client-end' });
      (socket as Socket & { userId?: string; workspaceId?: string }).userId =
        'user-1';
      (socket as Socket & { workspaceId?: string }).workspaceId = 'workspace-1';
      return socket;
    }

    it('plain Error 를 throw 하면 내부 message 미전달 + EXECUTION_INTERNAL_ERROR fallback (§7.5.2)', async () => {
      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.endAiConversation as jest.Mock).mockRejectedValueOnce(
        new Error('DB constraint violation — internal PG error detail'),
      );

      const result = await gateway.handleEndConversation(
        { executionId: 'exec-1', nodeId: 'node-1' },
        authedEndConvSocket(),
      );
      expect(result.data.success).toBe(false);
      // 보안 게이트: 내부 message/stack 은 client ack 에 미포함.
      expect(result.data.errorCode).toBe('EXECUTION_INTERNAL_ERROR');
      expect(result.data.error).toBe('End conversation failed');
      expect(result.data.error).not.toContain('DB constraint');
      expect(result.data.error).not.toContain('PG error');
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
