import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../../common/decorators';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ExecutionsService } from '../executions/executions.service';
import { BackgroundRunsService } from '../executions/background-runs/background-runs.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { ExecutionEventType } from './websocket.service';
import { corsOriginCallback } from '../../common/utils/cors-origins';

const MAX_SUBSCRIPTIONS_PER_CONNECTION = 20;

// 'kb:' = Knowledge Base 문서 처리 진행 채널 (kb:${documentId})
// 'background:run:' = Background 본문 실행 run-level 이벤트 채널
const VALID_CHANNEL_PREFIXES = [
  'execution:',
  'workflow:',
  'notifications:',
  'kb:',
  'background:run:',
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidChannel(channel: string): boolean {
  return VALID_CHANNEL_PREFIXES.some((prefix) => channel.startsWith(prefix));
}

/**
 * UUID 채널 ID 검증 — `background:run:<id>` 와 같이 UUID v4 가 식별자인
 * 채널에서 임의 문자열이 DB 쿼리로 전달되는 것을 방어 (W-6). 빈 문자열 /
 * 비-UUID 형식이면 false → handleSubscribe 가 'Not authorized' 로 응답.
 */
function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

// @Public() bypasses the global JwtAuthGuard for WebSocket message handlers.
// Authentication is handled manually in handleConnection() via JWT verification.
@Public()
@WebSocketGateway({
  // W-1: HTTP CORS 와 동일 allowlist 적용 (단일 helper). dev/test 에서
  // CORS_ORIGINS·FRONTEND_URL 미설정 시 wildcard 로 fallback.
  cors: { origin: corsOriginCallback, credentials: true },
  namespace: '/ws',
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  /** Maps socket.id -> set of channels */
  private subscriptions = new Map<string, Set<string>>();

  /**
   * 채널 prefix 별 인가 전략. handleSubscribe 가 첫 매칭 strategy 의
   * `authorize` 만 호출한다. 새 채널 타입을 추가할 때 본 배열만 확장하면
   * subscribe 로직 자체는 건드리지 않는다 (W-13: OCP 개선).
   *
   * `null` 반환 = 인가 통과. 그 외는 `{ error }` 로 거부 메시지 명시.
   */
  private channelAuthorizers: Array<{
    matches: (channel: string) => boolean;
    authorize: (
      channel: string,
      workspaceId: string,
    ) => Promise<{ error: string } | null>;
  }>;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => ExecutionEngineService))
    private readonly executionEngineService: ExecutionEngineService,
    @Inject(forwardRef(() => ExecutionsService))
    private readonly executionsService: ExecutionsService,
    @Inject(forwardRef(() => BackgroundRunsService))
    private readonly backgroundRunsService: BackgroundRunsService,
    @Inject(forwardRef(() => KnowledgeBaseService))
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {
    this.channelAuthorizers = [
      {
        matches: (channel) => channel.startsWith('kb:'),
        authorize: async (channel, workspaceId) => {
          const documentId = channel.slice('kb:'.length);
          const allowed = await this.knowledgeBaseService
            .verifyDocumentOwnership(documentId, workspaceId)
            .catch(() => false);
          return allowed ? null : { error: 'Not authorized for this document' };
        },
      },
      {
        matches: (channel) => channel.startsWith('background:run:'),
        authorize: async (channel, workspaceId) => {
          const backgroundRunId = channel.slice('background:run:'.length);
          // W-6: UUID 형식 검증 — 비-UUID 입력 차단 (DB 쿼리 진입 전).
          if (!isValidUuid(backgroundRunId)) {
            return { error: 'Not authorized for this background run' };
          }
          const allowed = await this.backgroundRunsService
            .verifyBackgroundRunOwnership(backgroundRunId, workspaceId)
            .catch(() => false);
          return allowed
            ? null
            : { error: 'Not authorized for this background run' };
        },
      },
    ];
  }

  handleConnection(client: Socket): void {
    try {
      const token =
        (client.handshake.query['token'] as string) ||
        (client.handshake.auth?.token as string);

      if (!token) {
        this.logger.warn(
          `Connection rejected: no token provided (${client.id})`,
        );
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload: { sub: string; workspaceId?: string } =
        this.jwtService.verify(token);
      const enrichedClient = client as Socket & {
        userId?: string;
        workspaceId?: string;
      };
      enrichedClient.userId = payload.sub;
      enrichedClient.workspaceId = payload.workspaceId;

      this.subscriptions.set(client.id, new Set());
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch {
      this.logger.warn(`Connection rejected: invalid token (${client.id})`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const channels = this.subscriptions.get(client.id);
    if (channels) {
      for (const channel of channels) {
        void client.leave(channel);
      }
    }
    this.subscriptions.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { channel: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{
    event: string;
    data: { success: boolean; channel?: string; error?: string };
  }> {
    const { channel } = data;

    if (!channel || !isValidChannel(channel)) {
      return {
        event: 'subscribed',
        data: { success: false, error: 'Invalid channel' },
      };
    }

    const clientSubs = this.subscriptions.get(client.id);
    if (!clientSubs) {
      return {
        event: 'subscribed',
        data: { success: false, error: 'Not authenticated' },
      };
    }

    if (clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION) {
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: `Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached`,
        },
      };
    }

    // W-13: 채널별 인가는 strategy 맵을 lookup — 새 채널 추가 시 본 함수
    // 본문을 건드리지 않고 channelAuthorizers 만 확장하면 된다 (OCP).
    const enriched = client as Socket & { workspaceId?: string };
    const workspaceId = enriched.workspaceId ?? '';
    const authorizer = this.channelAuthorizers.find((a) => a.matches(channel));
    if (authorizer) {
      // workspace 가 가입되지 않은 소켓이 인가 대상 채널을 구독하려 시도하면
      // 즉시 거부 — handleConnection 이 인증 실패 시 disconnect 하므로 정상
      // 경로에서 도달 불가하지만 의도를 코드로 명시 (side-effect W#2 보강).
      if (!workspaceId) {
        return {
          event: 'subscribed',
          data: { success: false, error: 'Not authenticated' },
        };
      }
      const rejection = await authorizer.authorize(channel, workspaceId);
      if (rejection) {
        return {
          event: 'subscribed',
          data: { success: false, error: rejection.error },
        };
      }
    }

    // 원자 블록: authorize() await 이후의 한도 검사와 Set add 를 한 동기 구간
    // 안에 묶는다. JS event-loop 가 single-thread 라 이 두 동작 사이에 다른
    // subscribe 핸들러가 끼어들 수 없지만, tentative-add + 사후 검증 패턴으로
    // 만에 하나 향후 add 후 다른 await 가 들어가는 리팩토링이 일어나도
    // last-write-wins 가 한도를 초과하지 않도록 가드한다.
    // Detect first-time subscription so we only send the snapshot once. A
    // re-subscribe (e.g. after the hook re-binds without actually
    // disconnecting) must not re-emit — the client's store would merge
    // a second snapshot and double-append terminal rows.
    const isNewSubscription = !clientSubs.has(channel);
    if (
      isNewSubscription &&
      clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION
    ) {
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: `Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached`,
        },
      };
    }
    clientSubs.add(channel);
    if (clientSubs.size > MAX_SUBSCRIPTIONS_PER_CONNECTION) {
      // tentative-add 사후 가드. add 가 size 를 한도 너머로 밀어 올렸다면
      // 즉시 롤백하고 거부. Set.add 가 이미 있는 키면 size 증가 없으므로
      // 재구독 경로에는 영향 없음.
      clientSubs.delete(channel);
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: `Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached`,
        },
      };
    }
    void client.join(channel);
    this.logger.debug(`Client ${client.id} subscribed to ${channel}`);

    // Send a one-shot snapshot to the subscribing client only. This replaces
    // the old REST `GET /executions/:id` polling loop: timeline and detail
    // state is now fully hydrated from WS events (snapshot + incremental).
    //
    // CRIT — IDOR 차단: snapshot 발행 전 workspace 소유 검증. `findById` 는
    // workspace 필터를 적용하지 않으므로 channel 만 추측한 사용자가 타
    // workspace Execution 의 nodeExecutions 스냅샷을 받을 수 있었다. REST
    // endpoint 의 `verifyOwnership` 와 동일 정책으로 정렬.
    if (isNewSubscription && channel.startsWith('execution:')) {
      const executionId = channel.slice('execution:'.length);
      const enriched = client as Socket & { workspaceId?: string };
      void this.emitExecutionSnapshot(
        client,
        executionId,
        enriched.workspaceId ?? '',
      );
    }

    return {
      event: 'subscribed',
      data: { success: true, channel },
    };
  }

  private async emitExecutionSnapshot(
    client: Socket,
    executionId: string,
    userWorkspaceId: string,
  ): Promise<void> {
    try {
      // CRIT — IDOR 차단: workspace 소유 검증 후에만 snapshot 발행.
      // `verifyOwnership` 은 NotFound 로 통일 — Forbidden 으로 응답하면
      // attacker 가 executionId 존재 여부를 추론할 수 있다.
      await this.executionsService.verifyOwnership(
        executionId,
        userWorkspaceId,
      );
      const snapshot = await this.executionsService.findById(executionId);
      client.emit(ExecutionEventType.EXECUTION_SNAPSHOT, {
        executionId,
        execution: snapshot,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      // Missing/forbidden executions just skip the snapshot — the client
      // will treat the absent event the same as "no prior state".
      this.logger.debug(
        `Skipped snapshot for ${executionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { channel: string },
    @ConnectedSocket() client: Socket,
  ): { event: string; data: { success: boolean; channel: string } } {
    const { channel } = data;
    const clientSubs = this.subscriptions.get(client.id);

    if (clientSubs) {
      clientSubs.delete(channel);
    }
    void client.leave(channel);
    this.logger.debug(`Client ${client.id} unsubscribed from ${channel}`);

    return {
      event: 'unsubscribed',
      data: { success: true, channel },
    };
  }

  @SubscribeMessage('ping')
  handlePing(): { event: string; data: { timestamp: number } } {
    return {
      event: 'pong',
      data: { timestamp: Date.now() },
    };
  }

  @SubscribeMessage('execution.submit_form')
  async handleSubmitForm(
    @MessageBody() data: { executionId: string; formData: unknown },
    @ConnectedSocket() client: Socket,
  ): Promise<{
    event: string;
    data: {
      success: boolean;
      executionId?: string;
      resumed?: boolean;
      queued?: boolean;
      error?: string;
    };
  }> {
    // Verify the client is authenticated
    const enriched = client as Socket & {
      userId?: string;
      workspaceId?: string;
    };
    if (!enriched.userId) {
      return {
        event: 'execution.form_submitted',
        data: { success: false, error: 'Not authenticated' },
      };
    }

    // CRIT #1 — IDOR 차단.
    try {
      await this.executionsService.verifyOwnership(
        data.executionId,
        enriched.workspaceId ?? '',
      );
    } catch {
      return {
        event: 'execution.form_submitted',
        data: { success: false, error: 'Not authorized for this execution' },
      };
    }

    try {
      // Phase 2.5 — publish 가 BullMQ enqueue 반환 (queued + jobId). spec §7.4
      // 라우팅 원칙상 정상 enqueue 시 queued=true. jobId=null 이면 Redis
      // 장애로 본 분기에서 success: false 응답 후 client 재시도 유도.
      const result = await this.executionEngineService.continueExecution(
        data.executionId,
        data.formData,
      );
      if (result.jobId === null) {
        return {
          event: 'execution.form_submitted',
          data: {
            success: false,
            error: 'Continuation enqueue failed (Redis unavailable)',
          },
        };
      }
      return {
        event: 'execution.form_submitted',
        data: {
          success: true,
          executionId: data.executionId,
          resumed: true,
          queued: result.queued,
        },
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Form submission failed';
      return {
        event: 'execution.form_submitted',
        data: { success: false, error: message },
      };
    }
  }

  @SubscribeMessage('execution.click_button')
  async handleClickButton(
    @MessageBody()
    data: { executionId: string; nodeId?: string; buttonId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{
    event: string;
    data: {
      success: boolean;
      executionId?: string;
      buttonId?: string;
      resumed?: boolean;
      queued?: boolean;
      error?: string;
    };
  }> {
    const enriched = client as Socket & {
      userId?: string;
      workspaceId?: string;
    };
    if (!enriched.userId) {
      return {
        event: 'execution.click_button.ack',
        data: { success: false, error: 'Not authenticated' },
      };
    }

    // CRIT #1 — IDOR 차단. workspace 소유 검증.
    try {
      await this.executionsService.verifyOwnership(
        data.executionId,
        enriched.workspaceId ?? '',
      );
    } catch {
      return {
        event: 'execution.click_button.ack',
        data: { success: false, error: 'Not authorized for this execution' },
      };
    }

    try {
      const result = await this.executionEngineService.continueButtonClick(
        data.executionId,
        data.buttonId,
      );
      if (result.jobId === null) {
        return {
          event: 'execution.click_button.ack',
          data: {
            success: false,
            error: 'Continuation enqueue failed (Redis unavailable)',
          },
        };
      }
      return {
        event: 'execution.click_button.ack',
        data: {
          success: true,
          executionId: data.executionId,
          buttonId: data.buttonId,
          resumed: true,
          queued: result.queued,
        },
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Button click failed';
      return {
        event: 'execution.click_button.ack',
        data: { success: false, error: message },
      };
    }
  }

  @SubscribeMessage('execution.submit_message')
  async handleSubmitMessage(
    @MessageBody()
    data: { executionId: string; nodeId: string; message: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{
    event: string;
    data: {
      success: boolean;
      executionId?: string;
      resumed?: boolean;
      queued?: boolean;
      error?: string;
    };
  }> {
    const enriched = client as Socket & {
      userId?: string;
      workspaceId?: string;
    };
    if (!enriched.userId) {
      return {
        event: 'execution.submit_message.ack',
        data: { success: false, error: 'Not authenticated' },
      };
    }

    // CRIT #1 — IDOR 차단. workspace 소유 검증 (subscription 체크는 첫 단계
    // 방어, 실제 권한 검증은 verifyOwnership 가 담당).
    try {
      await this.executionsService.verifyOwnership(
        data.executionId,
        enriched.workspaceId ?? '',
      );
    } catch {
      return {
        event: 'execution.submit_message.ack',
        data: { success: false, error: 'Not authorized for this execution' },
      };
    }

    try {
      const result = await this.executionEngineService.continueAiConversation(
        data.executionId,
        data.message,
      );
      if (result.jobId === null) {
        return {
          event: 'execution.submit_message.ack',
          data: {
            success: false,
            error: 'Continuation enqueue failed (Redis unavailable)',
          },
        };
      }
      return {
        event: 'execution.submit_message.ack',
        data: {
          success: true,
          executionId: data.executionId,
          resumed: true,
          queued: result.queued,
        },
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Message submission failed';
      return {
        event: 'execution.submit_message.ack',
        data: { success: false, error: message },
      };
    }
  }

  @SubscribeMessage('execution.end_conversation')
  async handleEndConversation(
    @MessageBody() data: { executionId: string; nodeId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{
    event: string;
    data: {
      success: boolean;
      executionId?: string;
      resumed?: boolean;
      queued?: boolean;
      error?: string;
    };
  }> {
    const enriched = client as Socket & {
      userId?: string;
      workspaceId?: string;
    };
    if (!enriched.userId) {
      return {
        event: 'execution.end_conversation.ack',
        data: { success: false, error: 'Not authenticated' },
      };
    }

    // CRIT #1 — IDOR 차단.
    try {
      await this.executionsService.verifyOwnership(
        data.executionId,
        enriched.workspaceId ?? '',
      );
    } catch {
      return {
        event: 'execution.end_conversation.ack',
        data: { success: false, error: 'Not authorized for this execution' },
      };
    }

    try {
      const result = await this.executionEngineService.endAiConversation(
        data.executionId,
      );
      if (result.jobId === null) {
        return {
          event: 'execution.end_conversation.ack',
          data: {
            success: false,
            error: 'Continuation enqueue failed (Redis unavailable)',
          },
        };
      }
      return {
        event: 'execution.end_conversation.ack',
        data: {
          success: true,
          executionId: data.executionId,
          resumed: true,
          queued: result.queued,
        },
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'End conversation failed';
      return {
        event: 'execution.end_conversation.ack',
        data: { success: false, error: message },
      };
    }
  }

  broadcastToChannel(channel: string, event: string, payload: unknown): void {
    this.server.to(channel).emit(event, payload);
  }
}
