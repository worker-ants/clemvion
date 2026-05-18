import { BackgroundRunEventType, WebsocketService } from './websocket.service';

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

    it('preserves nested object reference identity when no credential key is present', () => {
      // GC-pressure 최적화: 자식 변경이 없으면 sanitize 가 새 객체를 만들지
      // 않고 원본 참조를 그대로 반환해야 한다 (Review 후속 #14 / W-25).
      const inner = { count: 3, label: 'ok' };
      const outer = { status: 'completed', detail: { inner } };
      service.emitBackgroundRunEvent(
        'bg-run-1',
        BackgroundRunEventType.BACKGROUND_RUN_COMPLETED,
        outer,
      );
      const payload = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      // backgroundRunId / timestamp 가 spread 로 추가되므로 payload 자체는 새 객체.
      // detail / detail.inner 두 레벨이 모두 원본 참조 그대로 보존되는지 확인.
      expect(payload.detail).toBe(outer.detail);
      expect((payload.detail as { inner: typeof inner }).inner).toBe(inner);
    });

    it('동일 객체 reference 재방문 시 sanitize 결과를 WeakMap 캐시로 재사용 (C-4)', () => {
      // ForEach 가 같은 outer 객체를 N회 emit 하는 시나리오. 두 emit 모두에서
      // detail/inner 가 원본과 동일 참조를 그대로 통과해야 한다 (변경 없음 → 원본 반환).
      const inner = { count: 1, label: 'ok' };
      const outer = { status: 'ok', detail: inner };
      service.emitBackgroundRunEvent(
        'bg-run-1',
        BackgroundRunEventType.BACKGROUND_RUN_COMPLETED,
        outer,
      );
      service.emitBackgroundRunEvent(
        'bg-run-1',
        BackgroundRunEventType.BACKGROUND_RUN_COMPLETED,
        outer,
      );
      const p1 = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      const p2 = gateway.broadcastToChannel.mock.calls[1][2] as Record<
        string,
        unknown
      >;
      expect(p1.detail).toBe(inner);
      expect(p2.detail).toBe(inner);
    });

    it('redacts the whole subtree when sanitize depth exceeds MAX_SANITIZE_DEPTH', () => {
      // depth 초과 경로에서는 credential 키 매칭을 더 수행할 수 없으므로
      // 보수적으로 [REDACTED_DEPTH] 로 통째 마스킹 (Review 후속 #4).
      // MAX_SANITIZE_DEPTH = 10 — 11단계 깊이 페이로드 끝에 credential 을 박아
      // 통째 마스킹이 되는지 검증.
      let deep: Record<string, unknown> = { api_key: 'should-not-leak' };
      for (let i = 0; i < 12; i++) deep = { next: deep };
      service.emitBackgroundRunEvent(
        'bg-run-1',
        BackgroundRunEventType.BACKGROUND_RUN_COMPLETED,
        { wrapper: deep },
      );
      const payload = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      // 직렬화해서 어디에도 평문 secret 이 남아있지 않은지 strict 검증.
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain('should-not-leak');
      expect(serialized).toContain('[REDACTED_DEPTH]');
    });
  });
});
