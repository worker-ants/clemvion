import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

const MAX_SUBSCRIPTIONS_PER_CONNECTION = 20;

const VALID_CHANNEL_PREFIXES = ['execution:', 'workflow:', 'notifications:'];

function isValidChannel(channel: string): boolean {
  return VALID_CHANNEL_PREFIXES.some((prefix) => channel.startsWith(prefix));
}

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

  constructor(private readonly jwtService: JwtService) {}

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

    clientSubs.add(channel);
    void client.join(channel);
    this.logger.debug(`Client ${client.id} subscribed to ${channel}`);

    return {
      event: 'subscribed',
      data: { success: true, channel },
    };
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

  broadcastToChannel(channel: string, event: string, payload: unknown): void {
    this.server.to(channel).emit(event, payload);
  }
}
