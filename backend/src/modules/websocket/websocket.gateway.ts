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
import { ExecutionEventType } from './websocket.service';

const MAX_SUBSCRIPTIONS_PER_CONNECTION = 20;

const VALID_CHANNEL_PREFIXES = ['execution:', 'workflow:', 'notifications:'];

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

      const payload: { sub: string } = this.jwtService.verify(token);
      (client as Socket & { userId?: string }).userId = payload.sub;

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
  handleSubscribe(
    @MessageBody() data: { channel: string },
    @ConnectedSocket() client: Socket,
  ): {
    event: string;
    data: { success: boolean; channel?: string; error?: string };
  } {
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
  handleSubmitForm(
    @MessageBody() data: { executionId: string; formData: unknown },
    @ConnectedSocket() client: Socket,
  ): {
    event: string;
    data: { success: boolean; error?: string };
  } {
    // Verify the client is authenticated
    const userId = (client as Socket & { userId?: string }).userId;
    if (!userId) {
      return {
        event: 'execution.form_submitted',
        data: { success: false, error: 'Not authenticated' },
      };
    }

    try {
      this.executionEngineService.continueExecution(
        data.executionId,
        data.formData,
      );
      return { event: 'execution.form_submitted', data: { success: true } };
    } catch {
      return {
        event: 'execution.form_submitted',
        data: { success: false, error: 'Form submission failed' },
      };
    }
  }

  @SubscribeMessage('execution.click_button')
  handleClickButton(
    @MessageBody()
    data: { executionId: string; nodeId?: string; buttonId: string },
    @ConnectedSocket() client: Socket,
  ): {
    event: string;
    data: {
      success: boolean;
      executionId?: string;
      buttonId?: string;
      resumed?: boolean;
      error?: string;
    };
  } {
    const userId = (client as Socket & { userId?: string }).userId;
    if (!userId) {
      return {
        event: 'execution.click_button.ack',
        data: { success: false, error: 'Not authenticated' },
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
  handleSubmitMessage(
    @MessageBody()
    data: { executionId: string; nodeId: string; message: string },
    @ConnectedSocket() client: Socket,
  ): {
    event: string;
    data: { success: boolean; error?: string };
  } {
    const userId = (client as Socket & { userId?: string }).userId;
    if (!userId) {
      return {
        event: 'execution.submit_message.ack',
        data: { success: false, error: 'Not authenticated' },
      };
    }

    // Verify client is subscribed to this execution's channel
    const clientChannels = this.subscriptions.get(client.id);
    if (!clientChannels?.has(`execution:${data.executionId}`)) {
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
    } catch {
      return {
        event: 'execution.submit_message.ack',
        data: { success: false, error: 'Message submission failed' },
      };
    }
  }

  @SubscribeMessage('execution.end_conversation')
  handleEndConversation(
    @MessageBody() data: { executionId: string; nodeId: string },
    @ConnectedSocket() client: Socket,
  ): {
    event: string;
    data: { success: boolean; error?: string };
  } {
    const userId = (client as Socket & { userId?: string }).userId;
    if (!userId) {
      return {
        event: 'execution.end_conversation.ack',
        data: { success: false, error: 'Not authenticated' },
      };
    }

    // Verify client is subscribed to this execution's channel
    const clientChannels = this.subscriptions.get(client.id);
    if (!clientChannels?.has(`execution:${data.executionId}`)) {
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
    } catch {
      return {
        event: 'execution.end_conversation.ack',
        data: { success: false, error: 'End conversation failed' },
      };
    }
  }

  broadcastToChannel(channel: string, event: string, payload: unknown): void {
    this.server.to(channel).emit(event, payload);
  }
}
