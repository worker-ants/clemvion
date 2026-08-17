import { firstValueFrom, take, toArray } from 'rxjs';
import {
  BackgroundRunEventType,
  type ExecutionChannelEvent,
  ExecutionEventType,
  MAX_SANITIZE_DEPTH,
  NodeEventType,
  WebsocketService,
} from './websocket.service';

describe('WebsocketService', () => {
  let service: WebsocketService;
  let gateway: { broadcastToChannel: jest.Mock };

  /** Fanout Subject から次の 1件を取り出す共有ヘルパー (W-5: 중복 정의 통합). */
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

  /**
   * Fake ExecutionSeqAllocator — 실 Redis 없이 per-execution monotonic 발급 +
   * release 의미를 재현해 emit 의 seq 동봉/단조/해제 동작을 결정적으로 검증한다.
   * 실제 분산 발급(INCR)·degraded fallback 은 execution-seq-allocator.service.spec.ts 가 별도 커버.
   */
  function makeFakeAllocator(): {
    next: jest.Mock;
    release: jest.Mock;
  } {
    const counters = new Map<string, number>();
    return {
      next: jest.fn((id: string) => {
        const n = (counters.get(id) ?? 0) + 1;
        counters.set(id, n);
        return Promise.resolve(n);
      }),
      release: jest.fn((id: string) => {
        counters.delete(id);
      }),
    };
  }

  beforeEach(() => {
    gateway = { broadcastToChannel: jest.fn() };
    service = new WebsocketService(
      gateway as never,
      makeFakeAllocator() as never,
    );
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

    it('emitExecutionEvent 가 첫 호출 시 seq=1 부터 시작', async () => {
      await service.emitExecutionEvent(
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

    it('같은 execution 내 다중 emit 은 seq 가 1,2,3... 단조 증가', async () => {
      await service.emitExecutionEvent(
        'exec-A',
        ExecutionEventType.EXECUTION_STARTED,
        {},
      );
      await service.emitNodeEvent(
        'exec-A',
        'node-1',
        NodeEventType.NODE_STARTED,
        {},
      );
      await service.emitExecutionEvent(
        'exec-A',
        ExecutionEventType.AI_MESSAGE,
        {
          message: 'hi',
        },
      );
      await service.emitNodeEvent(
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

    it('서로 다른 execution 은 독립된 seq counter 를 사용', async () => {
      await service.emitExecutionEvent(
        'exec-X',
        ExecutionEventType.EXECUTION_STARTED,
        {},
      );
      await service.emitExecutionEvent(
        'exec-Y',
        ExecutionEventType.EXECUTION_STARTED,
        {},
      );
      await service.emitExecutionEvent(
        'exec-X',
        ExecutionEventType.AI_MESSAGE,
        {},
      );
      await service.emitExecutionEvent(
        'exec-Y',
        ExecutionEventType.AI_MESSAGE,
        {},
      );

      const calls = gateway.broadcastToChannel.mock.calls;
      // call[0] = exec-X seq 1, call[1] = exec-Y seq 1, call[2] = exec-X seq 2, call[3] = exec-Y seq 2
      expect((calls[0][2] as { seq: number }).seq).toBe(1);
      expect((calls[1][2] as { seq: number }).seq).toBe(1);
      expect((calls[2][2] as { seq: number }).seq).toBe(2);
      expect((calls[3][2] as { seq: number }).seq).toBe(2);
    });

    it('execution.completed / failed / cancelled 발송 후 counter 가 해제됨 (메모리 누수 방지)', async () => {
      await service.emitExecutionEvent(
        'exec-done',
        ExecutionEventType.EXECUTION_STARTED,
        {},
      );
      await service.emitExecutionEvent(
        'exec-done',
        ExecutionEventType.EXECUTION_COMPLETED,
        {},
      );
      // 같은 execution id 를 새 실행이 재사용하더라도 (e.g. test fixture) 다시 1 부터.
      await service.emitExecutionEvent(
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
    // nextFanoutEvent / collectFanoutEvents 는 상위 describe('WebsocketService')
    // 스코프에서 공유 (W-5: 중복 정의 해소).

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
      await service.emitExecutionEvent(
        'exec-1',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-1',
          message: 'hi',
        },
      );
      const fanout = await eventP;
      const payload = fanout.payload;
      expect(payload.triggerId).toBe('trg-A');
      // workflowId 도 첨부 — ChatChannelDispatcher.toChatChannelEvent 가 EiaEvent.base
      // 의 필수 필드로 요구. 누락 시 silent skip 회귀 (PR #318 fix).
      expect(payload.workflowId).toBe('wf-A');
      expect(payload.chatChannel).toEqual({
        provider: 'telegram',
        conversationKey: '12345',
        channelUserKey: 'user-1',
      });
    });

    it('wire envelope (gateway broadcast) 에는 triggerId/chatChannel 미주입 — WS spec §4.4 wire shape 보존', async () => {
      service.registerExecutionRouting('exec-1', {
        triggerId: 'trg-A',
        chatChannel: { provider: 'telegram', conversationKey: '12345' },
      });
      await service.emitExecutionEvent(
        'exec-1',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-1',
          message: 'hi',
        },
      );
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
      await service.emitExecutionEvent(
        'exec-manual',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-1',
          message: 'hi',
        },
      );
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
      await service.emitExecutionEvent(
        'exec-wh',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-1',
          message: 'hi',
        },
      );
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
      await service.emitExecutionEvent(
        'exec-2',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-1',
          message: 'first',
        },
      );
      await service.emitExecutionEvent(
        'exec-2',
        ExecutionEventType.EXECUTION_COMPLETED,
        { status: 'completed' },
      );
      // 같은 executionId 를 새 실행이 재사용했다고 가정. register 안 함.
      await service.emitExecutionEvent(
        'exec-2',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-2',
          message: 'reused',
        },
      );
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
      await service.emitExecutionEvent(
        'exec-3',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-1',
          message: 'hi',
        },
      );
      const fanout = await eventP;
      expect(fanout.payload).not.toHaveProperty('triggerId');
    });

    it('register 이전 emit (race) — 그 emit 은 첨부 없이 통과, 이후 register/emit 부터 첨부', async () => {
      const eventsP = collectFanoutEvents(service, 2);
      await service.emitExecutionEvent(
        'exec-race',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-1',
          message: 'before-register',
        },
      );
      service.registerExecutionRouting('exec-race', { triggerId: 'trg-late' });
      await service.emitExecutionEvent(
        'exec-race',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-2',
          message: 'after-register',
        },
      );
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
      await service.emitNodeEvent(
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
      await service.emitExecutionEvent(
        'exec-4',
        ExecutionEventType.AI_MESSAGE,
        {
          nodeId: 'n-1',
          message: 'hi',
        },
      );
      const fanout = await eventP;
      const chatChannel = fanout.payload.chatChannel as Record<string, unknown>;
      expect(chatChannel.api_key).toBe('[REDACTED]');
      expect(chatChannel.conversationKey).toBe('12345');
    });
  });

  // Spec [WS §4.4 llmCalls[] strip-only 결정 / EIA §6.5 / chat-channel CCH-MP-01]:
  // debug 전용 llmCalls (raw LLM 요청/응답) 는 인증 내부 WS(에디터) 채널에만
  // 전달하고, 외부 fanout (SSE / webhook / chat-channel) 에서는 strip 한다.
  // nextFanoutEvent 는 상위 describe('WebsocketService') 스코프 공유 헬퍼 사용 (W-5).
  describe('llmCalls strip — 외부 fanout 수신자 보호', () => {
    const aiPayload = {
      nodeId: 'n-1',
      message: 'hi',
      turnCount: 1,
      messages: [{ role: 'assistant', content: 'hi' }],
      metadata: { model: 'claude' },
      llmCalls: [
        {
          requestPayload: { system: 'SECRET PROMPT', messages: [] },
          responsePayload: { content: 'hi' },
          durationMs: 12,
        },
      ],
    };

    it('wire envelope (에디터 WS) 는 llmCalls 를 그대로 포함', async () => {
      await service.emitExecutionEvent(
        'exec-ws',
        ExecutionEventType.AI_MESSAGE,
        aiPayload,
      );
      const wire = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(wire.llmCalls).toBeDefined();
      expect(Array.isArray(wire.llmCalls)).toBe(true);
    });

    it('fanout envelope (외부: SSE/webhook/chat) 는 llmCalls 를 strip', async () => {
      const eventP = nextFanoutEvent(service);
      await service.emitExecutionEvent(
        'exec-fan',
        ExecutionEventType.AI_MESSAGE,
        aiPayload,
      );
      const fanout = await eventP;
      expect(fanout.payload).not.toHaveProperty('llmCalls');
      // 나머지 비-debug 필드는 외부 수신자에게도 그대로 유지
      expect(fanout.payload.message).toBe('hi');
      expect(fanout.payload.turnCount).toBe(1);
      expect(fanout.payload).toHaveProperty('messages');
      expect(fanout.payload).toHaveProperty('metadata');
    });

    it('strip 은 wire envelope 를 변형하지 않는다 (같은 emit 의 WS copy 보존)', async () => {
      const eventP = nextFanoutEvent(service);
      await service.emitExecutionEvent(
        'exec-both',
        ExecutionEventType.AI_MESSAGE,
        aiPayload,
      );
      const fanout = await eventP;
      const wire = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(wire.llmCalls).toBeDefined();
      expect(fanout.payload).not.toHaveProperty('llmCalls');
    });

    /**
     * **`waiting_for_input` 은 `llmCalls` 를 중첩해서 싣는다 — 종전 strip 은 최상위 전용이었다.**
     *
     * `stripExternalOnlyFields` 는 `EXTERNAL_STRIPPED_FIELDS`(=`['llmCalls']`)를
     * **depth-1 shallow delete** 했었다. 그런데 AI turn1 의
     * waiting emit 은 raw payload 를 최상위가 아니라 한 단계 아래에 넣는다
     * (`ai-turn-orchestrator.service.ts:615`):
     *
     *     turnDebug: { llmCalls: turnDebugHistory[0], metadata }
     *
     * `turnDebugHistory[i]` 는 `{turnIndex, llmCalls: LlmCallRecord[], …}` 이고
     * `LlmCallRecord` 는 `requestPayload`/`responsePayload` 를 갖는다
     * (`ai-turn-executor.ts:2336` · `llm-tracing/llm-call-record.ts:19`).
     *
     * WS §4.4(`6-websocket-protocol.md:519`)는 이 raw payload 가
     * **모든 외부 수신자**(EIA SSE · notification webhook · chat-channel)에서
     * strip 된다고 선언한다. 아래는 그 선언을 실제 wire 로 검증한다.
     *
     * 기존 strip 테스트는 **최상위 `llmCalls`** 만, 그것도 `AI_MESSAGE` 에서만 봤다 —
     * 이 경로는 아무도 보지 않았다.
     */
    it('waiting_for_input 의 중첩 turnDebug.llmCalls 도 외부 fanout 에 남으면 안 된다', async () => {
      const eventP = nextFanoutEvent(service);
      await service.emitExecutionEvent(
        'exec-waiting-nested',
        ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
        {
          status: 'waiting_for_input',
          waitingNodeId: 'n-ai',
          waitingNodeType: 'ai_agent',
          interactionType: 'ai_conversation',
          // 경로 2 — `buildConversationMetaFromResumeState:97` 이
          // `turnDebug: state.turnDebugHistory` 로 **전체 히스토리**를 싣는다.
          // WS §4.4:449 가 정의한 `nodeOutput.meta.turnDebug` 정본 shape.
          nodeOutput: {
            interactionType: 'ai_conversation',
            meta: {
              turnDebug: [
                {
                  turnIndex: 0,
                  llmCalls: [{ requestPayload: { system: 'SECRET PROMPT B' } }],
                  ragSources: [],
                },
              ],
            },
          },
          // 경로 1 — ai-turn-orchestrator.service.ts:615 의 실제 shape 그대로
          turnDebug: {
            llmCalls: {
              turnIndex: 0,
              llmCalls: [
                {
                  requestPayload: { system: 'SECRET PROMPT A', messages: [] },
                  responsePayload: { content: 'hi' },
                  durationMs: 12,
                },
              ],
              ragSources: [],
            },
            metadata: { model: 'claude', inputTokens: 10, outputTokens: 3 },
          },
        },
      );
      const fanout = await eventP;

      // 외부 수신자에게 raw LLM 요청/응답이 **어떤 경로로도** 도달해서는 안 된다.
      // 두 경로를 함께 본다 — 한쪽만 막으면 나머지가 남는다.
      const fanoutJson = JSON.stringify(fanout.payload);
      expect(fanoutJson).not.toContain('SECRET PROMPT A'); // top-level turnDebug
      expect(fanoutJson).not.toContain('SECRET PROMPT B'); // nodeOutput.meta.turnDebug

      // **대조군** — 인증된 에디터 WS 채널은 둘 다 그대로 받아야 한다. 이게 없으면
      // "payload 를 통째로 날려서" 통과하는 구현도 GREEN 이 된다 (`10_32_27` testing W6:
      // 같은 블록의 다른 strip 테스트는 전부 이 짝을 갖는데 이것만 빠져 있었다).
      const wireJson = JSON.stringify(
        gateway.broadcastToChannel.mock.calls[0][2],
      );
      expect(wireJson).toContain('SECRET PROMPT A');
      expect(wireJson).toContain('SECRET PROMPT B');
      // 비-debug 필드는 그대로 유지돼야 한다 (대조군 — 통째로 사라진 게 아님을 확인).
      expect(fanout.payload.waitingNodeId).toBe('n-ai');
      expect(fanout.payload.interactionType).toBe('ai_conversation');
    });

    /**
     * 재귀 strip 의 비용 근거를 단언한다 — 제거할 게 없으면 **새 객체를 만들지 않고
     * 입력을 그대로** 돌려준다(clone-on-write). 이게 깨지면 모든 실행 이벤트가
     * payload 전체를 복제하게 되므로, 성능 주장이 주석에만 있으면 안 된다.
     */
    it('제거할 필드가 없으면 fanout payload 가 wire envelope 과 동일 객체다 (할당 없음)', async () => {
      const eventP = nextFanoutEvent(service);
      await service.emitExecutionEvent(
        'exec-identity',
        ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
        {
          status: 'waiting_for_input',
          waitingNodeId: 'n-1',
          nodeOutput: {
            meta: { turnDebug: [{ turnIndex: 0, ragSources: [] }] },
          },
        },
      );
      const fanout = await eventP;
      const wire = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      // envelope **자체**의 동일성 — 종전엔 자식(`nodeOutput`) 하나만 봐서 최상위에서
      // 불필요한 재구성이 일어나는 회귀를 못 잡았다 (`10_32_27` testing W5).
      expect(fanout.payload).toBe(wire);
      // 중첩까지 복제되지 않았는지도 함께.
      expect(fanout.payload.nodeOutput).toBe(wire.nodeOutput);
    });

    /**
     * **strip 구현이 `__proto__` 를 만나도 안전해야 한다** (`10_32_27` security W1).
     *
     * 초판은 `out[k] = v` bracket 대입이라, `JSON.parse` 로 만들어진 own `__proto__`
     * 키를 만나면 (a) 그 키를 own property 로 남기지 않아 **값이 조용히 사라지고**
     * (b) 반환 객체의 프로토타입을 갈아쳐, 값이 `null` 이면 `hasOwnProperty` 조차 없는
     * 객체가 되어 하류에서 `TypeError` 로 죽을 수 있었다(CWE-1321).
     *
     * **fixture 가 위험 지점을 통과해야 한다.** 첫 판에는 `__proto__` 값 안에 strip 대상이
     * 없어서 `if (s !== v)` 대입 분기에 아예 들어가지 않았고, 뮤테이션(대입을 bracket 으로
     * 되돌림)에서 **테스트가 살아남았다** — 판별력 0이었다. `__proto__` 의 **값 안에**
     * `llmCalls` 를 넣어야 자식이 바뀌고, 그래야 `__proto__` 키로 대입이 일어난다.
     */
    it('payload 에 __proto__ 키가 있어도 값 손실·프로토타입 오염이 없다', async () => {
      const eventP = nextFanoutEvent(service);
      const hostile = JSON.parse(
        // `__proto__` 의 값이 strip 으로 **바뀌어야** 대입 분기를 탄다.
        '{"__proto__":{"polluted":true,"llmCalls":[{"requestPayload":{}}]},"keep":"ok"}',
      ) as Record<string, unknown>;
      await service.emitExecutionEvent(
        'exec-proto',
        ExecutionEventType.AI_MESSAGE,
        { nested: hostile },
      );
      const fanout = await eventP;
      const nested = (fanout.payload as Record<string, unknown>)
        .nested as Record<string, unknown>;

      // 비-strip 값은 살아 있다.
      expect(nested.keep).toBe('ok');
      // `__proto__` 는 own property 로 보존돼야 한다 — 사라지면 payload 손실이다.
      expect(Object.prototype.hasOwnProperty.call(nested, '__proto__')).toBe(
        true,
      );
      // 그 안의 strip 은 됐고, 나머지는 남았다.
      const inner = Object.getOwnPropertyDescriptor(nested, '__proto__')
        ?.value as Record<string, unknown>;
      expect(inner).not.toHaveProperty('llmCalls');
      expect(inner.polluted).toBe(true);
      // 프로토타입이 갈리지 않았다 — 표준 메서드가 그대로 있어야 한다.
      expect(Object.getPrototypeOf(nested)).toBe(Object.prototype);
      expect(typeof nested.hasOwnProperty).toBe('function');
      // 전역 오염도 없다.
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    /**
     * **깊이 경계 전수 — 리뷰어 결론이 갈렸던 자리다** (`11_02_16` CRITICAL 1).
     *
     * **종전에는** `stripDeep` 이 `depth >= MAX_SANITIZE_DEPTH` 에서 멈추고 형제
     * `sanitizePayloadForWs` 는 `depth > MAX_SANITIZE_DEPTH` 에서 `'[REDACTED_DEPTH]'`
     * 로 치환해 **경계 연산자가 어긋나 있었다**. testing reviewer 는 그 어긋남으로 depth 10
     * 에서 누출이 재현된다 했고, security/side_effect/requirement 셋은 "값은 이미 redact 돼
     * 필드명만 남는다" 고 반대 결론을 냈다.
     *
     * 아래 sweep 이 **누출 없음**을 확정했고, 같은 커밋에서 연산자를 형제와 같은 `>` 로
     * 통일했다 — 지금 두 함수의 경계는 동일하다. 이 문단은 그 이력의 기록이다.
     *
     * **논증 대신 실제 파이프라인으로 훑었고, 결론은 "누출 없음" 이다** — 필드명이 남는
     * 경우는 있어도 raw 내용은 어느 깊이에서도 나가지 않는다. testing 쪽 CRITICAL 은
     * 파이프라인이 아니라 두 함수 로직을 **복제한 스크립트**의 산물이었다.
     *
     * **각 케이스의 판별력을 실측해 둔다** (strip 을 no-op 으로 만든 뮤턴트에서 관측):
     *
     * | depth | strip 없이도 통과? | 무엇을 지키나 |
     * |---|---|---|
     * | `0` · `MAX-5` · `MAX-3` | **아니오 (RED)** | `stripDeep` 이 실제로 지운다 |
     * | `MAX-2` 이상 | 예 | 마커가 `MAX_SANITIZE_DEPTH` 밖이라 `sanitizePayloadForWs` 가 먼저 `[REDACTED_DEPTH]` 로 치환 |
     *
     * 전환점은 **`MAX-3` ↔ `MAX-2` 사이**다(둘 다 표본에 있다). 마커가 `llmCalls` 배열 안
     * 두 단계 더 들어가 있어, 노드 깊이 `MAX-2` 부터 마커 자체가 상한 밖으로 나간다.
     *
     * 즉 깊은 쪽은 **누출 테스트로서는 판별력이 없다**. 그래도 남겨 두는 이유는 그것이
     * 이 설계의 방어 구조 자체이기 때문이다 — 깊은 곳은 strip 이 아니라 sanitize 의 상한이
     * 막는다. 나중에 그 상한이 사라지면 여기가 RED 로 알려준다.
     *
     * **깊이는 상수 상대값으로 쓴다.** 리터럴로 박으면 `MAX_SANITIZE_DEPTH` 가 바뀌었을 때
     * 테스트는 계속 통과하면서 **경계 판별력만 조용히 잃는다**. 같은 파일 `:203` 의 자매
     * 경계 테스트가 이미 그 관례를 명시해 뒀는데 초판이 어겼다 (`12_06_20` maintainability W2).
     * 판별력 전환점(`MAX-3`)도 표본에 포함한다.
     */
    it.each([
      0,
      MAX_SANITIZE_DEPTH - 5,
      MAX_SANITIZE_DEPTH - 3,
      MAX_SANITIZE_DEPTH - 2,
      MAX_SANITIZE_DEPTH - 1,
      MAX_SANITIZE_DEPTH,
      MAX_SANITIZE_DEPTH + 1,
      MAX_SANITIZE_DEPTH + 2,
    ])(
      'depth %i 의 llmCalls raw 내용이 외부 fanout 에 남지 않는다',
      async (depth) => {
        const marker = `SECRET AT DEPTH ${depth}`;
        // depth 만큼 중첩한 뒤 그 자리에 llmCalls 를 놓는다.
        let node: Record<string, unknown> = {
          llmCalls: [{ requestPayload: { system: marker } }],
        };
        for (let i = 0; i < depth; i++) node = { nest: node };

        const eventP = nextFanoutEvent(service);
        await service.emitExecutionEvent(
          `exec-depth-${depth}`,
          ExecutionEventType.AI_MESSAGE,
          node,
        );
        const fanout = await eventP;

        expect(JSON.stringify(fanout.payload)).not.toContain(marker);
      },
    );

    it('llmCalls 없는 이벤트는 그대로 fanout (no-op strip)', async () => {
      const eventP = nextFanoutEvent(service);
      await service.emitExecutionEvent(
        'exec-plain',
        ExecutionEventType.AI_MESSAGE,
        { nodeId: 'n-1', message: 'hi' },
      );
      const fanout = await eventP;
      expect(fanout.payload.message).toBe('hi');
      expect(fanout.payload).not.toHaveProperty('llmCalls');
    });

    // W-1/W-4 방어심층화: emitNodeEvent fanout 도 strip 적용.
    // 현재 node 이벤트에 llmCalls 는 없으나, 미래 누출 경로를 차단하기 위해
    // emitExecutionEvent 와 동일 패턴으로 strip 을 걸어둔다.
    it('emitNodeEvent fanout 도 llmCalls 를 strip (방어심층화 — W-1/W-4)', async () => {
      const eventP = nextFanoutEvent(service);
      await service.emitNodeEvent(
        'exec-node-strip',
        'node-1',
        NodeEventType.NODE_COMPLETED,
        {
          output: { result: 'ok' },
          // 미래 node 이벤트에 llmCalls 가 포함되는 경우를 시뮬레이션
          llmCalls: [{ requestPayload: { system: 'SECRET' } }],
        },
      );
      const fanout = await eventP;
      // fanout 에 llmCalls 가 없어야 한다
      expect(fanout.payload).not.toHaveProperty('llmCalls');
      // wire envelope 에는 그대로 유지 (strip 은 fanout 전용)
      const wire = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(wire.llmCalls).toBeDefined();
      // 다른 필드는 보존
      expect(fanout.payload.nodeId).toBe('node-1');
    });
  });

  describe('emitNotificationEvent', () => {
    it('`notifications:<userId>` 채널에 notification.new 를 spec §4.4 shape 으로 emit', () => {
      service.emitNotificationEvent('user-42', {
        id: 'notif-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run xyz failed',
        resourceType: 'execution',
        resourceId: 'exec-9',
      });

      expect(gateway.broadcastToChannel).toHaveBeenCalledTimes(1);
      const [channel, event, payload] =
        gateway.broadcastToChannel.mock.calls[0];
      expect(channel).toBe('notifications:user-42');
      expect(event).toBe('notification.new');
      // WS spec §4.4 정확 shape — timestamp/seq 등 확장 필드 없음.
      expect(payload).toEqual({
        id: 'notif-1',
        type: 'execution_failed',
        title: 'Workflow failed',
        message: 'run xyz failed',
        resourceType: 'execution',
        resourceId: 'exec-9',
      });
    });

    it('resource attribution 누락 시 payload resource* 를 null 로 정규화', () => {
      service.emitNotificationEvent('user-1', {
        id: 'notif-2',
        type: 'team_invite',
        title: 'Invited',
        message: 'welcome',
      });

      const payload = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(payload.resourceType).toBeNull();
      expect(payload.resourceId).toBeNull();
    });

    it('userId 가 비면 no-op (채널 식별 불가)', () => {
      service.emitNotificationEvent('', {
        id: 'notif-3',
        type: 'x',
        title: 't',
        message: 'm',
      });
      expect(gateway.broadcastToChannel).not.toHaveBeenCalled();
    });

    it('broadcast 예외를 삼켜 적재 경로를 깨지 않는다 (best-effort)', () => {
      gateway.broadcastToChannel.mockImplementation(() => {
        throw new Error('socket server not ready');
      });
      expect(() =>
        service.emitNotificationEvent('user-1', {
          id: 'notif-4',
          type: 'x',
          title: 't',
          message: 'm',
        }),
      ).not.toThrow();
    });
  });

  /**
   * **자유 텍스트 값 안의 자격증명 마스킹** (EIA §R17 / 결정 2026-08-16).
   *
   * ## 표면마다 따로 단언하는 이유
   *
   * 두 emit(`emitExecutionEvent`·`emitNodeEvent`)이 한 헬퍼를 부르므로 한 번만
   * 검증하면 된다고 생각하기 쉽다. 그러면 **한쪽에서 호출을 지워도 스위트가 초록**이다 —
   * 이 저장소가 *"자매 넷 중 하나만"* 으로 반복해 겪은 형태다. 두 emit × (wire·fanout)
   * 네 조합을 각각 겨눈다.
   *
   * 무수정 프로브가 실증한 누출: `error`(Bearer 토큰) · `input`(자격증명 포함 URI) ·
   * `output`(스택 프래그먼트). 키 이름은 전부 credential 패턴이 **아니라서**
   * `sanitizePayloadForWs` 가 못 잡는다.
   */
  describe('값-패턴 마스킹 — emit 두 경로 × wire·fanout', () => {
    const LEAKY_ERROR =
      'Upstream rejected: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.LEAKED';
    const LEAKY_INPUT = { note: 'db=postgres://user:pw@db.internal:5432/prod' };

    it('① emitNodeEvent — fanout 은 error 값 안의 토큰을 마스킹', async () => {
      const eventP = nextFanoutEvent(service);
      await service.emitNodeEvent('e1', 'n1', NodeEventType.NODE_FAILED, {
        error: LEAKY_ERROR,
        input: LEAKY_INPUT,
      });
      const fanout = await eventP;
      expect(fanout.payload.error).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(fanout.payload.error).toContain('***');
      // 자격증명 포함 URI 는 scheme 보존 마스킹 → 호스트는 남고 자격증명만 사라진다
      expect(JSON.stringify(fanout.payload.input)).not.toContain('user:pw');
    });

    it('② emitNodeEvent — wire 도 마스킹 (R17 boundary parity: 수신 인구가 REST 와 동일)', async () => {
      await service.emitNodeEvent('e2', 'n1', NodeEventType.NODE_FAILED, {
        error: LEAKY_ERROR,
      });
      const wire = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(wire.error).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(wire.error).toContain('***');
    });

    it('③ emitExecutionEvent — fanout 마스킹 (비-종결 이벤트에는 이 층이 없었다)', async () => {
      const eventP = nextFanoutEvent(service);
      await service.emitExecutionEvent('e3', ExecutionEventType.AI_MESSAGE, {
        message: LEAKY_ERROR,
      });
      const fanout = await eventP;
      expect(fanout.payload.message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      // 양성 단언 — 없으면 "필드 소실/undefined" 회귀도 GREEN 이다 (`23_50_03` testing W3).
      expect(fanout.payload.message).toContain('***');
    });

    it('④ emitExecutionEvent — wire 도 마스킹', async () => {
      await service.emitExecutionEvent('e4', ExecutionEventType.AI_MESSAGE, {
        message: LEAKY_ERROR,
      });
      const wire = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(wire.message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(wire.message).toContain('***');
    });

    it('llmCalls 는 wire 에서 원문 유지 — 에디터 디버깅 탈출구 (strip-only 결정 보존)', async () => {
      // 이 예외가 없으면 WS §Rationale 이 "에디터 디버깅 가치를 훼손한다"며 기각한
      // 값-레벨 마스킹 상태가 된다. fanout 에서는 어차피 통째로 strip 된다.
      const eventP = nextFanoutEvent(service);
      await service.emitExecutionEvent('e5', ExecutionEventType.AI_MESSAGE, {
        message: 'ok',
        llmCalls: [{ requestPayload: { system: LEAKY_ERROR } }],
      });
      const fanout = await eventP;
      const wire = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      const calls = wire.llmCalls as Array<{
        requestPayload: { system: string };
      }>;
      expect(calls[0].requestPayload.system).toBe(LEAKY_ERROR);
      // 외부에는 필드 자체가 안 나간다
      expect(fanout.payload).not.toHaveProperty('llmCalls');
    });

    it('앞선 키-마스킹의 `[REDACTED]` 마커를 `***` 로 덮지 않는다 (계약 캐너리)', async () => {
      // sanitizePayloadForWs 가 credential 키를 `[REDACTED]` 로 먼저 마스킹한다.
      // 값-마스커가 그 위를 덮으면 같은 값이 표면마다 다르게 보인다.
      const eventP = nextFanoutEvent(service);
      await service.emitNodeEvent('e6', 'n1', NodeEventType.NODE_FAILED, {
        apiKey: 'sk-live-CONTROL',
      });
      const fanout = await eventP;
      const wire = gateway.broadcastToChannel.mock.calls[0][2] as Record<
        string,
        unknown
      >;
      expect(wire.apiKey).toBe('[REDACTED]');
      expect(fanout.payload.apiKey).toBe('[REDACTED]');
    });

    it('평범한 에러 메시지는 손상되지 않는다 (마스킹이 과하지 않음)', async () => {
      const eventP = nextFanoutEvent(service);
      await service.emitNodeEvent('e7', 'n1', NodeEventType.NODE_FAILED, {
        error: 'Node timed out after 30s',
      });
      const fanout = await eventP;
      expect(fanout.payload.error).toBe('Node timed out after 30s');
    });
  });
});
