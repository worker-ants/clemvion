import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Socket, Server } from 'socket.io';
import { WebsocketGateway } from './websocket.gateway';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';

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
    it('should reject invalid channel', () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      getSubscriptions().set('client-1', new Set());

      const result = gateway.handleSubscribe(
        { channel: 'invalid:123' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Invalid channel');
    });

    it('should accept valid execution channel', () => {
      const { socket, join } = createMockSocket({ id: 'client-1' });
      getSubscriptions().set('client-1', new Set());

      const result = gateway.handleSubscribe(
        { channel: 'execution:exec-123' },
        socket,
      );
      expect(result.data.success).toBe(true);
      expect(result.data.channel).toBe('execution:exec-123');
      expect(join).toHaveBeenCalledWith('execution:exec-123');
    });

    it('should reject when max subscriptions reached', () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      const subs = new Set<string>();
      for (let i = 0; i < 20; i++) {
        subs.add(`execution:exec-${i}`);
      }
      getSubscriptions().set('client-1', subs);

      const result = gateway.handleSubscribe(
        { channel: 'execution:exec-new' },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('Maximum subscriptions');
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
    it('should reject unauthenticated client', () => {
      const { socket } = createMockSocket({ id: 'no-auth' });

      const result = gateway.handleSubmitForm(
        { executionId: 'exec-1', formData: { approved: true } },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Not authenticated');
    });

    it('should call continueExecution on success', () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string }).userId = 'user-1';

      const result = gateway.handleSubmitForm(
        { executionId: 'exec-1', formData: { approved: true } },
        socket,
      );
      expect(result.data.success).toBe(true);
    });

    it('should return error when continueExecution throws', () => {
      const { socket } = createMockSocket({ id: 'client-1' });
      (socket as Socket & { userId?: string }).userId = 'user-1';

      const mockEngine = module.get(ExecutionEngineService);
      (mockEngine.continueExecution as jest.Mock).mockImplementation(() => {
        throw new Error('No pending continuation');
      });

      const result = gateway.handleSubmitForm(
        { executionId: 'non-existent', formData: {} },
        socket,
      );
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe('Form submission failed');
    });
  });

  describe('broadcastToChannel', () => {
    it('should emit to the correct channel', () => {
      const emitFn = jest.fn();
      const mockServer = {
        to: jest.fn().mockReturnValue({ emit: emitFn }),
      };
      setServer(mockServer as unknown as Server);

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
