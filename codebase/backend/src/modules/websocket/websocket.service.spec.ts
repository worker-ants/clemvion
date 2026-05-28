import { firstValueFrom, take, toArray } from 'rxjs';
import {
  BackgroundRunEventType,
  ExecutionChannelEvent,
  ExecutionEventType,
  MAX_SANITIZE_DEPTH,
  NodeEventType,
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

    it('redacts the full credential key pattern set (password/token/secret/...)', () => {
      // CREDENTIAL_KEY_PATTERN 이 api_key 외의 키들도 일관 마스킹하는지 회귀.
      // 패턴 목록에서 키를 추가/제거하면 본 테스트가 신호를 준다.
      const secrets = {
        password: 'pw',
        passwd: 'pw',
        pwd: 'pw',
        apiKey: 'k',
        secret: 's',
        token: 't',
        accessToken: 'at',
        refresh_token: 'rt',
        privateKey: 'pk',
        client_secret: 'cs',
        authorization: 'Bearer x',
        cookie: 'sid=1',
      };
      service.emitBackgroundRunEvent(
        'bg-run-1',
        BackgroundRunEventType.BACKGROUND_RUN_COMPLETED,
        { nested: { ...secrets, keep: 'ok' } },
      );
      const payload = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      const nested = payload.nested as Record<string, unknown>;
      for (const key of Object.keys(secrets)) {
        expect(nested[key]).toBe('[REDACTED]');
      }
      expect(nested.keep).toBe('ok');
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
      // MAX_SANITIZE_DEPTH 를 초과하는 깊이 페이로드 끝에 credential 을 박아
      // 통째 마스킹이 되는지 검증. 상수 변경 시 자동 추적되도록 매직넘버 대신 import.
      let deep: Record<string, unknown> = { api_key: 'should-not-leak' };
      for (let i = 0; i < MAX_SANITIZE_DEPTH + 2; i++) deep = { next: deep };
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

  describe('seq counter — execution 채널 monotonic 보장', () => {
    // WS spec §2.2 + EIA spec §R7: execution:{id} 채널의 모든 이벤트는 execution 별
    // monotonic seq 를 동봉해야 한다 (외부 SSE 의 `id:` 와 Notification `seq` 가
    // 같은 값을 공유). 본 PR2 의 phase P0 가 그 backend 구현을 담당.

    it('emitExecutionEvent 가 첫 호출 시 seq=1 부터 시작', () => {
      service.emitExecutionEvent(
        'exec-1',
        ExecutionEventType.EXECUTION_STARTED,
        { workflowId: 'wf-1' },
      );
      const payload = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(payload.seq).toBe(1);
    });

    it('같은 execution 내 다중 emit 은 seq 가 1,2,3... 단조 증가', () => {
      service.emitExecutionEvent(
        'exec-A',
        ExecutionEventType.EXECUTION_STARTED,
        {},
      );
      service.emitNodeEvent('exec-A', 'node-1', NodeEventType.NODE_STARTED, {});
      service.emitExecutionEvent('exec-A', ExecutionEventType.AI_MESSAGE, {
        message: 'hi',
      });
      service.emitNodeEvent(
        'exec-A',
        'node-1',
        NodeEventType.NODE_COMPLETED,
        {},
      );

      const seqs = gateway.broadcastToChannel.mock.calls.map(
        (c) => (c[2] as { seq: number }).seq,
      );
      expect(seqs).toEqual([1, 2, 3, 4]);
    });

    it('서로 다른 execution 은 독립된 seq counter 를 사용', () => {
      service.emitExecutionEvent(
        'exec-X',
        ExecutionEventType.EXECUTION_STARTED,
        {},
      );
      service.emitExecutionEvent(
        'exec-Y',
        ExecutionEventType.EXECUTION_STARTED,
        {},
      );
      service.emitExecutionEvent('exec-X', ExecutionEventType.AI_MESSAGE, {});
      service.emitExecutionEvent('exec-Y', ExecutionEventType.AI_MESSAGE, {});

      const calls = gateway.broadcastToChannel.mock.calls;
      // call[0] = exec-X seq 1, call[1] = exec-Y seq 1, call[2] = exec-X seq 2, call[3] = exec-Y seq 2
      expect((calls[0][2] as { seq: number }).seq).toBe(1);
      expect((calls[1][2] as { seq: number }).seq).toBe(1);
      expect((calls[2][2] as { seq: number }).seq).toBe(2);
      expect((calls[3][2] as { seq: number }).seq).toBe(2);
    });

    it('execution.completed / failed / cancelled 발송 후 counter 가 해제됨 (메모리 누수 방지)', () => {
      service.emitExecutionEvent(
        'exec-done',
        ExecutionEventType.EXECUTION_STARTED,
        {},
      );
      service.emitExecutionEvent(
        'exec-done',
        ExecutionEventType.EXECUTION_COMPLETED,
        {},
      );
      // 같은 execution id 를 새 실행이 재사용하더라도 (e.g. test fixture) 다시 1 부터.
      service.emitExecutionEvent(
        'exec-done',
        ExecutionEventType.EXECUTION_STARTED,
        {},
      );
      const seqs = gateway.broadcastToChannel.mock.calls.map(
        (c) => (c[2] as { seq: number }).seq,
      );
      expect(seqs).toEqual([1, 2, 1]);
    });

    it('emitKbEvent / emitBackgroundRunEvent 는 seq 를 동봉하지 않음 (execution 채널 한정)', () => {
      service.emitKbEvent('doc-1', 'document:embedding_started', {
        knowledgeBaseId: 'kb-1',
      });
      service.emitBackgroundRunEvent(
        'bg-1',
        BackgroundRunEventType.BACKGROUND_RUN_STARTED,
        {},
      );
      for (const call of gateway.broadcastToChannel.mock.calls) {
        const payload = call[2] as Record<string, unknown>;
        expect(payload).not.toHaveProperty('seq');
      }
    });
  });

  describe('execution routing context (internal fanout envelope 첨부)', () => {
    // Spec [chat-channel.md §3.1 CCH-AD-05]: ChatChannelDispatcher 가
    // execution 의 trigger 와 conversationKey 를 식별할 수 있어야 outbound
    // 발송이 가능. WebsocketService 가 (executionId → {triggerId, chatChannel})
    // 컨텍스트를 등록받아 emit 시점에 fanout envelope (executionEvents$ Subject)
    // 에 자동 첨부한다. wire envelope (gateway.broadcastToChannel) 에는
    // 첨부하지 않음 — WS spec §4.4 의 frontend wire shape 보존.

    async function nextFanoutEvent(
      svc: WebsocketService,
    ): Promise<ExecutionChannelEvent> {
      return firstValueFrom(svc.executionEvents$.pipe(take(1)));
    }

    async function collectFanoutEvents(
      svc: WebsocketService,
      n: number,
    ): Promise<ExecutionChannelEvent[]> {
      return firstValueFrom(svc.executionEvents$.pipe(take(n), toArray()));
    }

    it('register 된 execution 의 fanout envelope 에 triggerId + workflowId + chatChannel 첨부', async () => {
      service.registerExecutionRouting('exec-1', {
        triggerId: 'trg-A',
        workflowId: 'wf-A',
        chatChannel: {
          provider: 'telegram',
          conversationKey: '12345',
          channelUserKey: 'user-1',
        },
      });
      const eventP = nextFanoutEvent(service);
      service.emitExecutionEvent('exec-1', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-1',
        message: 'hi',
      });
      const fanout = await eventP;
      const payload = fanout.payload;
      expect(payload.triggerId).toBe('trg-A');
      // workflowId 도 첨부 — ChatChannelDispatcher.toEiaEvent 가 EiaEvent.base
      // 의 필수 필드로 요구. 누락 시 silent skip 회귀 (PR #318 fix).
      expect(payload.workflowId).toBe('wf-A');
      expect(payload.chatChannel).toEqual({
        provider: 'telegram',
        conversationKey: '12345',
        channelUserKey: 'user-1',
      });
    });

    it('wire envelope (gateway broadcast) 에는 triggerId/chatChannel 미주입 — WS spec §4.4 wire shape 보존', () => {
      service.registerExecutionRouting('exec-1', {
        triggerId: 'trg-A',
        chatChannel: { provider: 'telegram', conversationKey: '12345' },
      });
      service.emitExecutionEvent('exec-1', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-1',
        message: 'hi',
      });
      const wire = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(wire).not.toHaveProperty('triggerId');
      expect(wire).not.toHaveProperty('chatChannel');
      // wire envelope 의 다른 field 는 그대로 유지
      expect(wire.message).toBe('hi');
      expect(wire.executionId).toBe('exec-1');
    });

    it('register 안 한 execution (수동 실행 등) 은 fanout envelope 에도 routing context 없음', async () => {
      const eventP = nextFanoutEvent(service);
      service.emitExecutionEvent('exec-manual', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-1',
        message: 'hi',
      });
      const fanout = await eventP;
      expect(fanout.payload).not.toHaveProperty('triggerId');
      expect(fanout.payload).not.toHaveProperty('chatChannel');
    });

    it('triggerId 만 register 된 경우 (chatChannel 미설정 webhook trigger) chatChannel 미주입', async () => {
      // 일반 webhook 트리거 — triggerId 만 알려진 케이스. NotificationFanout 은
      // triggerId 만으로 통과하지만 ChatChannelDispatcher 는 chatChannel 까지 필요해
      // silent skip. 두 가드 모두 의도대로 동작하려면 triggerId/chatChannel 이
      // 독립적으로 register 가능해야 한다.
      service.registerExecutionRouting('exec-wh', { triggerId: 'trg-webhook' });
      const eventP = nextFanoutEvent(service);
      service.emitExecutionEvent('exec-wh', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-1',
        message: 'hi',
      });
      const fanout = await eventP;
      expect(fanout.payload.triggerId).toBe('trg-webhook');
      expect(fanout.payload).not.toHaveProperty('chatChannel');
    });

    it('terminal event 발송 후 routing context 자동 release — 같은 executionId 재사용 시 첨부 안 됨', async () => {
      service.registerExecutionRouting('exec-2', {
        triggerId: 'trg-A',
        chatChannel: { provider: 'telegram', conversationKey: '12345' },
      });
      const eventsP = collectFanoutEvents(service, 3);
      service.emitExecutionEvent('exec-2', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-1',
        message: 'first',
      });
      service.emitExecutionEvent(
        'exec-2',
        ExecutionEventType.EXECUTION_COMPLETED,
        { status: 'completed' },
      );
      // 같은 executionId 를 새 실행이 재사용했다고 가정. register 안 함.
      service.emitExecutionEvent('exec-2', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-2',
        message: 'reused',
      });
      const events = await eventsP;
      expect(events[0].payload.triggerId).toBe('trg-A');
      expect(events[1].payload.triggerId).toBe('trg-A');
      // 새 실행은 register 안 했으니 routing context 없음.
      expect(events[2].payload).not.toHaveProperty('triggerId');
    });

    it('releaseExecutionRouting 명시 호출 — terminal 이외 경로의 정리 (예: 엔진 에러로 정상 종료 안 됨)', async () => {
      service.registerExecutionRouting('exec-3', { triggerId: 'trg-A' });
      service.releaseExecutionRouting('exec-3');
      const eventP = nextFanoutEvent(service);
      service.emitExecutionEvent('exec-3', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-1',
        message: 'hi',
      });
      const fanout = await eventP;
      expect(fanout.payload).not.toHaveProperty('triggerId');
    });

    it('register 이전 emit (race) — 그 emit 은 첨부 없이 통과, 이후 register/emit 부터 첨부', async () => {
      const eventsP = collectFanoutEvents(service, 2);
      service.emitExecutionEvent('exec-race', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-1',
        message: 'before-register',
      });
      service.registerExecutionRouting('exec-race', { triggerId: 'trg-late' });
      service.emitExecutionEvent('exec-race', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-2',
        message: 'after-register',
      });
      const events = await eventsP;
      expect(events[0].payload).not.toHaveProperty('triggerId');
      expect(events[1].payload.triggerId).toBe('trg-late');
    });

    it('emitNodeEvent 도 fanout envelope 에 routing context 첨부 — emitExecutionEvent 와 동일 경로 공유', async () => {
      // `attachRoutingContext` 는 emit 메서드 양쪽에서 호출. emitNodeEvent
      // 의 fanout 도 NotificationFanout / ChatChannelDispatcher 가 구독하는
      // 같은 stream 으로 흘러가므로 동일하게 routing 첨부돼야 한다.
      service.registerExecutionRouting('exec-node', {
        triggerId: 'trg-N',
        chatChannel: { provider: 'telegram', conversationKey: '999' },
      });
      const eventP = nextFanoutEvent(service);
      service.emitNodeEvent(
        'exec-node',
        'node-1',
        NodeEventType.NODE_COMPLETED,
        { output: 'x' },
      );
      const fanout = await eventP;
      expect(fanout.payload.triggerId).toBe('trg-N');
      expect(fanout.payload.chatChannel).toEqual({
        provider: 'telegram',
        conversationKey: '999',
      });
      expect(fanout.payload.nodeId).toBe('node-1');
    });

    it('credential-shape 키가 chatChannel 안에 있으면 sanitize 가 마스킹 (defense in depth)', async () => {
      // chatChannel 자체는 conversationKey/channelUserKey 같은 비-secret 만 담는 게
      // 정상이지만, 호출자 회귀로 secret 이 섞일 위험에 대비해 fanout envelope 의
      // sanitize 가 일관 적용되는지 확인.
      service.registerExecutionRouting('exec-4', {
        triggerId: 'trg-A',
        chatChannel: {
          provider: 'telegram',
          conversationKey: '12345',
          api_key: 'should-not-leak',
        } as Record<string, unknown>,
      });
      const eventP = nextFanoutEvent(service);
      service.emitExecutionEvent('exec-4', ExecutionEventType.AI_MESSAGE, {
        nodeId: 'n-1',
        message: 'hi',
      });
      const fanout = await eventP;
      const chatChannel = fanout.payload.chatChannel as Record<string, unknown>;
      expect(chatChannel.api_key).toBe('[REDACTED]');
      expect(chatChannel.conversationKey).toBe('12345');
    });
  });
});
