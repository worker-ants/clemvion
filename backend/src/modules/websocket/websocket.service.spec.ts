import {
  BackgroundRunEventType,
  WebsocketService,
} from './websocket.service';

describe('WebsocketService', () => {
  let service: WebsocketService;
  let gateway: { broadcastToChannel: jest.Mock };

  beforeEach(() => {
    gateway = { broadcastToChannel: jest.fn() };
    service = new WebsocketService(gateway as never);
  });

  describe('emitBackgroundRunEvent', () => {
    it('routes payload to `background:run:<id>` channel with backgroundRunId + timestamp', () => {
      service.emitBackgroundRunEvent(
        'bg-run-1',
        BackgroundRunEventType.BACKGROUND_RUN_STARTED,
        {
          executionId: 'exec-1',
          parentNodeExecutionId: 'pne-1',
          startedAt: '2026-05-15T05:04:37.000Z',
        },
      );

      expect(gateway.broadcastToChannel).toHaveBeenCalledTimes(1);
      const [channel, eventType, payload] =
        gateway.broadcastToChannel.mock.calls[0];
      expect(channel).toBe('background:run:bg-run-1');
      expect(eventType).toBe('execution.background_run.started');
      expect(payload).toMatchObject({
        backgroundRunId: 'bg-run-1',
        executionId: 'exec-1',
        parentNodeExecutionId: 'pne-1',
        startedAt: '2026-05-15T05:04:37.000Z',
      });
      expect(typeof (payload as { timestamp: string }).timestamp).toBe(
        'string',
      );
    });

    it('skips emit when backgroundRunId is empty (no channel to route to)', () => {
      service.emitBackgroundRunEvent(
        '',
        BackgroundRunEventType.BACKGROUND_RUN_COMPLETED,
        { status: 'completed' },
      );
      expect(gateway.broadcastToChannel).not.toHaveBeenCalled();
    });

    it('redacts credential-shaped keys in payload via sanitizePayloadForWs', () => {
      service.emitBackgroundRunEvent(
        'bg-run-1',
        BackgroundRunEventType.BACKGROUND_RUN_COMPLETED,
        {
          status: 'failed',
          errorMessage: 'pg failure',
          nested: { api_key: 'super-secret', otherField: 'ok' },
        },
      );

      const payload = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      const nested = payload.nested as Record<string, unknown>;
      expect(nested.api_key).toBe('[REDACTED]');
      expect(nested.otherField).toBe('ok');
      // errorMessage 키 자체는 credential 패턴이 아니므로 보존된다 (processor
      // 측 sanitizeErrorMessage 가 길이 cap / stack/connection 패턴 제거 담당).
      expect(payload.errorMessage).toBe('pg failure');
    });
  });
});
