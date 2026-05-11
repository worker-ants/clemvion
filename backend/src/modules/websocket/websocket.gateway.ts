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
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { ExecutionEventType } from './websocket.service';

const MAX_SUBSCRIPTIONS_PER_CONNECTION = 20;

// 'kb:' = Knowledge Base 문서 처리 진행 채널 (kb:${documentId})
const VALID_CHANNEL_PREFIXES = [
  'execution:',
  'workflow:',
  'notifications:',
  'kb:',
];

function isValidChannel(channel: string): boolean {
  return VALID_CHANNEL_PREFIXES.some((prefix) => channel.startsWith(prefix));
}

// @Public() bypasses the global JwtAuthGuard for WebSocket message handlers.
// Authentication is handled manually in handleConnection() via JWT verification.
@Public()
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
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

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => ExecutionEngineService))
    private readonly executionEngineService: ExecutionEngineService,
    @Inject(forwardRef(() => ExecutionsService))
    private readonly executionsService: ExecutionsService,
    @Inject(forwardRef(() => KnowledgeBaseService))
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {}

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

    // `kb:${documentId}` 채널은 가입자 workspace 의 문서만 구독 허용.
    // documentId UUID 추측으로 타 workspace 의 임베딩/그래프 진행 이벤트를 엿보는 것을 차단.
    if (channel.startsWith('kb:')) {
      const enriched = client as Socket & { workspaceId?: string };
      const workspaceId = enriched.workspaceId ?? '';
      const documentId = channel.slice('kb:'.length);
      const allowed = await this.knowledgeBaseService
        .verifyDocumentOwnership(documentId, workspaceId)
        .catch(() => false);
      if (!allowed) {
        return {
          event: 'subscribed',
          data: { success: false, error: 'Not authorized for this document' },
        };
      }
    }

    // Detect first-time subscription so we only send the snapshot once. A
    // re-subscribe (e.g. after the hook re-binds without actually
    // disconnecting) must not re-emit — the client's store would merge
    // a second snapshot and double-append terminal rows.
    const isNewSubscription = !clientSubs.has(channel);
    clientSubs.add(channel);
    void client.join(channel);
    this.logger.debug(`Client ${client.id} subscribed to ${channel}`);

    // Send a one-shot snapshot to the subscribing client only. This replaces
    // the old REST `GET /executions/:id` polling loop: timeline and detail
    // state is now fully hydrated from WS events (snapshot + incremental).
    if (isNewSubscription && channel.startsWith('execution:')) {
      const executionId = channel.slice('execution:'.length);
      void this.emitExecutionSnapshot(client, executionId);
    }

    return {
      event: 'subscribed',
      data: { success: true, channel },
    };
  }

  private async emitExecutionSnapshot(
    client: Socket,
    executionId: string,
  ): Promise<void> {
    try {
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
    data: { success: boolean; error?: string };
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
      this.executionEngineService.continueExecution(
        data.executionId,
        data.formData,
      );
      return { event: 'execution.form_submitted', data: { success: true } };
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
      this.executionEngineService.continueButtonClick(
        data.executionId,
        data.buttonId,
      );
      return {
        event: 'execution.click_button.ack',
        data: {
          success: true,
          executionId: data.executionId,
          buttonId: data.buttonId,
          resumed: true,
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
    data: { success: boolean; error?: string };
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
      this.executionEngineService.continueAiConversation(
        data.executionId,
        data.message,
      );
      return { event: 'execution.submit_message.ack', data: { success: true } };
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
    data: { success: boolean; error?: string };
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
      this.executionEngineService.endAiConversation(data.executionId);
      return {
        event: 'execution.end_conversation.ack',
        data: { success: true },
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
