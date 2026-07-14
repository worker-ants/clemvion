import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, Logger, UseGuards, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../../common/decorators';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { RetryTurnService } from '../execution-engine/retry-turn.service';
import {
  ExecutionError,
  InvalidExecutionStateError,
  RetryLastTurnError,
} from '../execution-engine/workflow-errors';
import { ErrorCode } from '../../nodes/core/error-codes';
import { ExecutionsService } from '../executions/executions.service';
import { ExecutionEventType } from './websocket.service';
import { corsOriginCallback } from '../../common/utils/cors-origins';
import { WsErrorCode } from './ws-error-codes';
import { WsRateLimitGuard } from './ws-rate-limit.guard';
import { WsRateLimiterService } from './ws-rate-limiter.service';
import { CHANNEL_AUTHORIZER, ChannelAuthorizer } from './channel-authorizer';

const MAX_SUBSCRIPTIONS_PER_CONNECTION = 20;

/**
 * §7.1 UNKNOWN_TYPE 판정용 — 등록된 `@SubscribeMessage` 이벤트 화이트리스트.
 * 이 집합에 없는 이벤트가 들어오면 `onAny` 가 UNKNOWN_TYPE `error` 를 emit 한다.
 * 새 핸들러 추가 시 본 집합도 함께 갱신한다(핸들러↔집합 동기 유지).
 */
const KNOWN_WS_EVENTS: ReadonlySet<string> = new Set([
  'subscribe',
  'unsubscribe',
  'ping',
  'execution.submit_form',
  'execution.click_button',
  'execution.submit_message',
  'execution.end_conversation',
  'execution.retry_last_turn',
]);

// 'kb:' = Knowledge Base 문서 처리 진행 채널 (kb:${documentId})
// 'background:run:' = Background 본문 실행 run-level 이벤트 채널
const VALID_CHANNEL_PREFIXES = [
  'execution:',
  'workflow:',
  'notifications:',
  'kb:',
  'background:run:',
];

function isValidChannel(channel: string): boolean {
  return VALID_CHANNEL_PREFIXES.some((prefix) => channel.startsWith(prefix));
}

/**
 * refactor 03 C-4 — 인증된 WS 소켓. `handleConnection` 이 JWT 검증 성공 시
 * `userId`/`workspaceId` 를 enrich 한다(실패 시 즉시 disconnect). 명령·구독
 * 핸들러는 이 단언으로 식별자에 접근하며, 핸들러별 인라인 `Socket & {...}`
 * 단언을 단일 alias 로 통합한다.
 *
 * 주의: 인가 DTO 인 `ChannelAuthorizerContext`(channel-authorizer.ts)와 필드
 * 교집합(workspaceId/userId)이 있으나 역할이 다르다 — 본 타입은 socket 형태
 * 단언, 후자는 authorizer 입력 DTO. 혼용 금지.
 */
type AuthenticatedSocket = Socket & {
  userId?: string;
  workspaceId?: string;
};

// refactor 03 C-4 — 명령 핸들러(submitForm·clickButton·submitMessage·
// endConversation·retryLastTurn)의 반복 인증/소유권 거부 메시지 상수.
// 값은 명문 wire 문자열 — 변경 금지(테스트가 정확한 값을 검증).
// subscribe(§3.3) 경로는 채널 인가(channelAuthorizers)가 담당하는 별개 계약이라
// 본 상수를 공유하지 않고 자체 리터럴을 유지한다(경로 간 커플링 차단).
const MSG_NOT_AUTHENTICATED = 'Not authenticated';
const MSG_NOT_AUTHORIZED_EXECUTION = 'Not authorized for this execution';

// @Public() bypasses the global JwtAuthGuard for WebSocket message handlers.
// Authentication is handled manually in handleConnection() via JWT verification.
@Public()
// §7.1 — 모든 @SubscribeMessage 핸들러에 socket 당 60 msg/min rate-limit 적용.
// 초과 시 WsException(RATE_LIMITED) → 클라이언트 `exception` 이벤트.
@UseGuards(WsRateLimitGuard)
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
   * refactor 02 M-7 — 채널 prefix 별 인가 전략은 각 도메인 모듈이 `CHANNEL_AUTHORIZER` 로
   * 등록한 `ChannelAuthorizer[]` 를 주입받는다. `handleSubscribe` 가 첫 매칭 authorizer 의
   * `authorize` 만 호출(OCP — 신규 채널 = 해당 모듈 provider 1개, gateway 무수정). prefix 는
   * 상호 배타라 주입 순서 무관. `execution:`/`workflow:`/`kb:`/`background:run:` 는 도메인 모듈,
   * `notifications:` 는 WS-local provider.
   */
  constructor(
    private readonly jwtService: JwtService,
    // refactor 02 M-7 — engine/retry/executions 는 **inbound command**(continueX·retryLastTurn·
    // snapshot 의 verifyOwnership) 전용으로 유지. authorizer 가 아니라 M-7 역전 대상 아님.
    @Inject(forwardRef(() => ExecutionEngineService))
    private readonly executionEngineService: ExecutionEngineService,
    @Inject(forwardRef(() => RetryTurnService))
    private readonly retryTurnService: RetryTurnService,
    @Inject(forwardRef(() => ExecutionsService))
    private readonly executionsService: ExecutionsService,
    // refactor 02 M-7 — 채널 authorizer 배열 주입(옛 workflows/kb/background-runs 서비스
    // forwardRef + 인라인 배열 제거). 각 도메인 모듈이 CHANNEL_AUTHORIZER multi-provider 로 등록.
    @Inject(CHANNEL_AUTHORIZER)
    private readonly channelAuthorizers: ChannelAuthorizer[],
    // §7.1 — WS 명령 rate-limit(socket 당 60/min) 카운터. Guard 가 소비, 본 gateway 가
    // handleDisconnect 에서 release. onAny UNKNOWN_TYPE 검출과 함께 §7.1 하드닝을 구성.
    private readonly wsRateLimiter: WsRateLimiterService,
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

      // 활성 워크스페이스 클레임은 activeWorkspaceId(결정2 = B). 전환기 dual-read 로
      // legacy workspaceId 도 수용한다 — 본 게이트웨이는 HTTP 전략과 별개로 raw decode 하므로
      // 여기서도 명시적으로 dual-read 한다.
      const payload: {
        sub: string;
        activeWorkspaceId?: string;
        workspaceId?: string;
      } = this.jwtService.verify(token);
      const enrichedClient = client as AuthenticatedSocket;
      enrichedClient.userId = payload.sub;
      enrichedClient.workspaceId =
        payload.activeWorkspaceId ?? payload.workspaceId;

      this.subscriptions.set(client.id, new Set());

      // §7.1 UNKNOWN_TYPE — Socket.IO 는 미등록 이벤트를 silent drop 하므로, onAny 로
      // 잡아 전용 코드를 `error` 이벤트로 알린다. 등록된 핸들러 이벤트(KNOWN_WS_EVENTS)는
      // guard 파이프라인이 rate-limit 을 처리하므로 여기서 무시한다.
      client.onAny((event: string) => {
        if (KNOWN_WS_EVENTS.has(event)) return;
        // 미등록 이벤트도 rate-limit 예산을 소비한다 — onAny 는 @UseGuards 파이프라인
        // **밖**이라 별도 카운트하지 않으면 미등록 이벤트 flood 로 60/min 제한을 우회하고
        // error emit 을 증폭할 수 있다(§7.1 하드닝의 구멍). 초과분은 조용히 drop.
        if (!this.wsRateLimiter.consume(client.id)) return;
        client.emit('error', {
          code: WsErrorCode.UNKNOWN_TYPE,
          message: `Unknown message type: ${event}`,
        });
      });

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
      // M-3 — disconnect 경로의 leave 는 socket.io 가 disconnect 시 모든 room 을
      // auto-leave 하므로 방어적·redundant 다. best-effort 로 fire-and-forget(void)
      // 유지 — 소켓이 이미 끊기는 중이라 await 실익이 없다(명시 leave await 는
      // 사용자 개시 unsubscribe 경로에서 수행한다).
      for (const channel of channels) {
        void client.leave(channel);
      }
    }
    this.subscriptions.delete(client.id);
    // §7.1 — rate-limit 카운터 정리(누수 방지).
    this.wsRateLimiter.release(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { channel: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{
    event: string;
    // §3.3/§3.4/§7.1 — 실패 시 평문 `error` 문자열에 더해 구조화 `code` 를 additive 로
    // 동봉한다(기존 클라이언트는 error 로 계속 동작, 신규는 code 로 분기).
    data: { success: boolean; channel?: string; error?: string; code?: string };
  }> {
    const { channel } = data;

    if (!channel || !isValidChannel(channel)) {
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: 'Invalid channel',
          code: WsErrorCode.INVALID_MESSAGE,
        },
      };
    }

    const clientSubs = this.subscriptions.get(client.id);
    if (!clientSubs) {
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: 'Not authenticated',
          code: WsErrorCode.UNAUTHENTICATED,
        },
      };
    }

    if (clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION) {
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: `Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached`,
          code: WsErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
        },
      };
    }

    // W-13: 채널별 인가는 strategy 맵을 lookup — 새 채널 추가 시 본 함수
    // 본문을 건드리지 않고 channelAuthorizers 만 확장하면 된다 (OCP).
    const enriched = client as AuthenticatedSocket;
    const workspaceId = enriched.workspaceId ?? '';
    const userId = enriched.userId ?? '';
    const authorizer = this.channelAuthorizers.find((a) => a.matches(channel));
    // refactor 02 M-7 W-5 (fail-closed): `isValidChannel` 을 통과한 채널은 매칭 authorizer 가
    // 반드시 있어야 한다. 현재 VALID_CHANNEL_PREFIXES 의 모든 prefix 에 authorizer 가
    // 존재하므로 정상 경로에서는 도달 불가하나, 새 prefix 만 추가하고 authorizer 등록을
    // 누락하면 인가 없이 join 되는 구멍이 생긴다 — 기본 거부로 봉인.
    if (!authorizer) {
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: 'Not authorized for this channel',
          code: WsErrorCode.FORBIDDEN,
        },
      };
    }
    // workspace 가 가입되지 않은 소켓이 인가 대상 채널을 구독하려 시도하면
    // 즉시 거부 — handleConnection 이 인증 실패 시 disconnect 하므로 정상
    // 경로에서 도달 불가하지만 의도를 코드로 명시 (side-effect W#2 보강).
    // (notifications: 는 user 단위지만, 인증된 소켓은 JWT 에 workspaceId 를
    // 함께 담으므로 본 가드는 정상 경로를 막지 않는다. userId 검증은 authorizer.)
    if (!workspaceId) {
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: 'Not authenticated',
          code: WsErrorCode.UNAUTHENTICATED,
        },
      };
    }
    const rejection = await authorizer.authorize(channel, {
      workspaceId,
      userId,
    });
    if (rejection) {
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: rejection.error,
          code: WsErrorCode.FORBIDDEN,
        },
      };
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
          code: WsErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
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
          code: WsErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
        },
      };
    }
    // M-3 (06 concurrency) — join 을 await 하고 실패 시 tentative-add 를 롤백한다.
    // 현 in-memory adapter 에선 join 이 동기 완결이라 무영향이나, Redis adapter
    // 도입 시 join 은 비동기가 되어 실패 시 clientSubs 와 실제 room 멤버십이
    // 어긋날 수 있다(구독했다고 응답했으나 이벤트 미수신). 선제 방어.
    try {
      await client.join(channel);
    } catch (err) {
      clientSubs.delete(channel);
      this.logger.warn(
        `Client ${client.id} join(${channel}) 실패 — 구독 롤백: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {
        event: 'subscribed',
        data: {
          success: false,
          error: 'Subscription failed — please retry',
          code: WsErrorCode.INTERNAL_ERROR,
        },
      };
    }
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
      // refactor 03 C-4 (review W2) — 함수 스코프의 `workspaceId`(상단에서 이미
      // `enriched.workspaceId ?? ''` 로 산출)를 재사용. 중복 단언 제거.
      void this.emitExecutionSnapshot(client, executionId, workspaceId);
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
      // refactor 03 C-4 (review INFO-2) — 구독 경로의 IDOR 이중 방어. 명령 핸들러용
      // `verifyExecutionOwnership` helper(boolean)와 의도적으로 분리한다: 여기서는
      // 실패를 ack 가 아니라 snapshot skip(아래 catch)으로 흡수하기 때문.
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
    } catch (err: unknown) {
      // Missing/forbidden executions just skip the snapshot — the client
      // will treat the absent event the same as "no prior state".
      this.logger.debug(
        `Skipped snapshot for ${executionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @MessageBody() data: { channel: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ event: string; data: { success: boolean; channel: string } }> {
    const { channel } = data;
    const clientSubs = this.subscriptions.get(client.id);

    if (clientSubs) {
      clientSubs.delete(channel);
    }
    // M-3 — leave 도 await (best-effort). clientSubs 는 이미 정리했으므로 leave
    // 실패는 warn 만; unsubscribe 는 성공으로 응답한다(멤버십은 disconnect 시 정리).
    try {
      await client.leave(channel);
    } catch (err) {
      this.logger.warn(
        `Client ${client.id} leave(${channel}) 실패 (best-effort): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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

  /**
   * refactor 03 C-4 — 명령 핸들러 5종 전용(submitForm·clickButton·submitMessage·
   * endConversation·retryLastTurn) 인증 컨텍스트 추출. `handleConnection` 이
   * enrich 한 `userId` 가 없으면(미인증 소켓) null 을 반환하고, 호출 핸들러가
   * 자신의 ack shape 으로 거부 ack 를 조립한다. `workspaceId` 는 인증 JWT 에 함께
   * 담기지만 누락 시 ''(`verifyOwnership` 가 소유 불일치로 처리 — NotFound 통일)로
   * 정규화한다.
   *
   * 본 helper 는 ack payload 를 만들지 않는다 — §7.2(§4.2) 의 ack wire shape 분리
   * (continuation 4종 flat `error: string` vs retry_last_turn nested
   * `error:{code,message}`)는 각 핸들러가 소유해야 보존된다.
   *
   * subscribe 경로에는 적용하지 않는다 — 채널 인가는 `channelAuthorizers`(OCP, 02
   * M-7)가 담당하며, 본 helper 도입은 그 구조를 우회하게 된다.
   */
  private getCommandAuthContext(
    client: Socket,
  ): { userId: string; workspaceId: string } | null {
    const enriched = client as AuthenticatedSocket;
    if (!enriched.userId) {
      return null;
    }
    return { userId: enriched.userId, workspaceId: enriched.workspaceId ?? '' };
  }

  /**
   * refactor 03 C-4 — 명령 핸들러 공통: execution 의 workspace 소유 검증.
   * `verifyOwnership` 은 NotFound 로 통일(Forbidden 금지 — executionId 존재 추론
   * 차단, §7.1 IDOR 정책·sibling handler 일치). 소유 불일치·부재·DB 오류는 모두
   * false 로 환원한다.
   *
   * 판단(boolean)만 담당하고 ack 는 만들지 않는다 — 호출 핸들러가 자신의 shape 으로
   * 조립한다: continuation 4종은 flat `{success:false, error:
   * MSG_NOT_AUTHORIZED_EXECUTION}`, retry_last_turn 은 nested `{success:false,
   * resumed:false, error:{code:NOT_FOUND, message:'Execution not found'}}`(의도된
   * 분리, §4.2).
   */
  private async verifyExecutionOwnership(
    executionId: string,
    workspaceId: string,
  ): Promise<boolean> {
    try {
      await this.executionsService.verifyOwnership(executionId, workspaceId);
      return true;
    } catch {
      return false;
    }
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
      errorCode?: string;
    };
  }> {
    // refactor 03 C-4 — 인증 + IDOR(소유권) 가드 공통 helper. 거부 ack 는 본
    // 핸들러의 flat shape(§7.2)으로 직접 조립한다.
    const auth = this.getCommandAuthContext(client);
    if (!auth) {
      return {
        event: 'execution.form_submitted',
        data: { success: false, error: MSG_NOT_AUTHENTICATED },
      };
    }
    if (
      !(await this.verifyExecutionOwnership(data.executionId, auth.workspaceId))
    ) {
      return {
        event: 'execution.form_submitted',
        data: { success: false, error: MSG_NOT_AUTHORIZED_EXECUTION },
      };
    }

    try {
      // Phase 2.5 — publish 가 BullMQ enqueue 반환 (queued + jobId). spec §7.4
      // 라우팅 원칙상 정상 enqueue 시 queued=true. queued=false 이면 enqueue
      // 실패 — success: false ack 로 client 재시도 유도.
      const result = await this.executionEngineService.continueExecution(
        data.executionId,
        data.formData,
      );
      if (!result.queued) {
        return {
          event: 'execution.form_submitted',
          data: {
            success: false,
            error: 'Continuation could not be queued. Please try again.',
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
    } catch (err: unknown) {
      return this.buildContinuationErrorAck(
        'execution.form_submitted',
        err,
        'Form submission failed',
      );
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
      errorCode?: string;
    };
  }> {
    // refactor 03 C-4 — 인증 + IDOR(소유권) 가드 공통 helper (flat ack §7.2).
    const auth = this.getCommandAuthContext(client);
    if (!auth) {
      return {
        event: 'execution.click_button.ack',
        data: { success: false, error: MSG_NOT_AUTHENTICATED },
      };
    }
    if (
      !(await this.verifyExecutionOwnership(data.executionId, auth.workspaceId))
    ) {
      return {
        event: 'execution.click_button.ack',
        data: { success: false, error: MSG_NOT_AUTHORIZED_EXECUTION },
      };
    }

    try {
      // F-6 — 클라이언트가 nodeId 를 실으면 publisher 가 실제 대기 노드와 대조한다
      // (§7.5.1 nodeId 불일치, EIA `/interact` 와 대칭). 미제공 시 undefined → 검사 skip.
      const result = await this.executionEngineService.continueButtonClick(
        data.executionId,
        data.buttonId,
        data.nodeId,
      );
      if (!result.queued) {
        return {
          event: 'execution.click_button.ack',
          data: {
            success: false,
            error: 'Continuation could not be queued. Please try again.',
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
    } catch (err: unknown) {
      return this.buildContinuationErrorAck(
        'execution.click_button.ack',
        err,
        'Button click failed',
      );
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
      errorCode?: string;
    };
  }> {
    // refactor 03 C-4 — 인증 + IDOR(소유권) 가드 공통 helper (flat ack §7.2).
    // (subscription 체크는 첫 단계 방어, 실제 권한 검증은 verifyOwnership 가 담당.)
    const auth = this.getCommandAuthContext(client);
    if (!auth) {
      return {
        event: 'execution.submit_message.ack',
        data: { success: false, error: MSG_NOT_AUTHENTICATED },
      };
    }
    if (
      !(await this.verifyExecutionOwnership(data.executionId, auth.workspaceId))
    ) {
      return {
        event: 'execution.submit_message.ack',
        data: { success: false, error: MSG_NOT_AUTHORIZED_EXECUTION },
      };
    }

    try {
      // F-6 — nodeId 제공 시 publisher 가 대기 노드와 대조 (§7.5.1).
      const result = await this.executionEngineService.continueAiConversation(
        data.executionId,
        data.message,
        data.nodeId,
      );
      if (!result.queued) {
        return {
          event: 'execution.submit_message.ack',
          data: {
            success: false,
            error: 'Continuation could not be queued. Please try again.',
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
    } catch (err: unknown) {
      return this.buildContinuationErrorAck(
        'execution.submit_message.ack',
        err,
        'Message submission failed',
      );
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
      errorCode?: string;
    };
  }> {
    // refactor 03 C-4 — 인증 + IDOR(소유권) 가드 공통 helper (flat ack §7.2).
    const auth = this.getCommandAuthContext(client);
    if (!auth) {
      return {
        event: 'execution.end_conversation.ack',
        data: { success: false, error: MSG_NOT_AUTHENTICATED },
      };
    }
    if (
      !(await this.verifyExecutionOwnership(data.executionId, auth.workspaceId))
    ) {
      return {
        event: 'execution.end_conversation.ack',
        data: { success: false, error: MSG_NOT_AUTHORIZED_EXECUTION },
      };
    }

    try {
      // F-6 — nodeId 제공 시 publisher 가 대기 노드와 대조 (§7.5.1).
      const result = await this.executionEngineService.endAiConversation(
        data.executionId,
        data.nodeId,
      );
      if (!result.queued) {
        return {
          event: 'execution.end_conversation.ack',
          data: {
            success: false,
            error: 'Continuation could not be queued. Please try again.',
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
    } catch (err: unknown) {
      return this.buildContinuationErrorAck(
        'execution.end_conversation.ack',
        err,
        'End conversation failed',
      );
    }
  }

  /**
   * spec/5-system/6-websocket-protocol.md §4.2 — `execution.retry_last_turn`.
   *
   * AI Agent multi-turn 의 retryable error 종결 후, 동일 nodeId 의 새
   * NodeExecution row 를 spawn 해 마지막 LLM turn 을 재실행한다. 다른
   * continuation 명령 (대기중 row 재개) 과 달리, validate + atomic consume +
   * 새 row spawn (`retryLastTurn`) 후 `retry_last_turn` continuation job 을
   * publish 해 worker 로 handoff 한다.
   *
   * ack 형태 (spec §4.2):
   *  - 성공: `{ success: true, executionId, nodeExecutionId, resumed: true }`
   *  - 실패: nested `{ success: false, executionId, nodeExecutionId,
   *          resumed: false, error: { code, message } }`
   *    (continuation 명령의 평면 `errorCode` 와 다른 계층 — 의도된 분리).
   */
  @SubscribeMessage('execution.retry_last_turn')
  async handleRetryLastTurn(
    @MessageBody() data: { executionId: string; nodeExecutionId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{
    event: string;
    data: {
      success: boolean;
      executionId?: string;
      nodeExecutionId?: string;
      resumed?: boolean;
      error?: { code: string; message: string };
    };
  }> {
    const event = 'execution.retry_last_turn.ack';
    // refactor 03 C-4 — 인증 + IDOR(소유권) 가드 공통 helper. 거부 ack 는 본
    // 핸들러의 nested shape(§4.2: { error: { code, message } })으로 직접 조립한다 —
    // continuation 4종(flat)과 의도적으로 다른 계층이라 UNAUTHENTICATED/NOT_FOUND
    // 코드와 'Execution not found' 문구를 helper 가 아닌 핸들러가 소유한다.
    const auth = this.getCommandAuthContext(client);
    if (!auth) {
      return {
        event,
        data: {
          success: false,
          executionId: data.executionId,
          nodeExecutionId: data.nodeExecutionId,
          resumed: false,
          error: {
            code: WsErrorCode.UNAUTHENTICATED,
            message: MSG_NOT_AUTHENTICATED,
          },
        },
      };
    }

    // verifyOwnership 은 NotFound 로 통일 — Forbidden 으로 응답하면 attacker 가
    // executionId 의 존재 여부를 추론할 수 있다 (sibling handler 정책 일치, S1).
    if (
      !(await this.verifyExecutionOwnership(data.executionId, auth.workspaceId))
    ) {
      return {
        event,
        data: {
          success: false,
          executionId: data.executionId,
          nodeExecutionId: data.nodeExecutionId,
          resumed: false,
          error: {
            code: WsErrorCode.NOT_FOUND,
            message: 'Execution not found',
          },
        },
      };
    }

    // W3: spawnedNodeExecutionId 를 outer scope 에 보존해 publish 실패 시 row 마감.
    let spawnedNodeExecutionId: string | undefined;
    try {
      // 1. validate + atomic consume + spawn 새 row.
      ({ spawnedNodeExecutionId } = await this.retryTurnService.retryLastTurn(
        data.executionId,
        data.nodeExecutionId,
      ));
      // 2. spawn 된 row 로 multi-turn loop 재진입을 worker 에 handoff.
      const publishResult =
        await this.executionEngineService.publishRetryLastTurn(
          data.executionId,
          spawnedNodeExecutionId,
        );
      if (!publishResult.queued) {
        // Redis 장애 등 publish 실패 — _retryState 는 이미 소비됐으므로 재시도
        // 시 RETRY_STATE_NOT_FOUND 가 된다. client 에 실패를 알린다.
        // W3: spawn 된 RUNNING row 를 FAILED 로 마감해 zombie row 방지.
        void this.executionEngineService.markSpawnedRowFailedOnPublishError(
          spawnedNodeExecutionId,
          'queued=false',
        );
        return {
          event,
          data: {
            success: false,
            executionId: data.executionId,
            nodeExecutionId: data.nodeExecutionId,
            resumed: false,
            error: {
              code: WsErrorCode.INTERNAL_ERROR,
              message: 'Retry could not be queued. Please try again.',
            },
          },
        };
      }
      return {
        event,
        data: {
          success: true,
          executionId: data.executionId,
          nodeExecutionId: data.nodeExecutionId,
          resumed: true,
        },
      };
    } catch (err: unknown) {
      // W3: publish 가 throw 한 경우에도 spawn 된 row 를 FAILED 로 마감한다.
      if (spawnedNodeExecutionId) {
        void this.executionEngineService.markSpawnedRowFailedOnPublishError(
          spawnedNodeExecutionId,
          'publish threw',
        );
      }
      const code =
        err instanceof RetryLastTurnError
          ? err.code
          : err instanceof InvalidExecutionStateError
            ? err.code
            : WsErrorCode.INTERNAL_ERROR;
      // 보안 — RetryLastTurnError / InvalidExecutionStateError 의 message 는
      // 고정 client-safe 문자열. 그 외는 일반화한 메시지.
      const message =
        err instanceof RetryLastTurnError ||
        err instanceof InvalidExecutionStateError
          ? err.message
          : 'Retry failed';
      return {
        event,
        data: {
          success: false,
          executionId: data.executionId,
          nodeExecutionId: data.nodeExecutionId,
          resumed: false,
          error: { code, message },
        },
      };
    }
  }

  /**
   * A-1 typed-error (§7.5.2) — continuation 핸들러 4종 catch 공통화 + 누출 차단.
   * (원래 변경 2.3/review W-8 에서 도입)
   *
   * client-safe 표면과 내부 진단을 분리한다:
   *
   * - typed `ExecutionError`(`InvalidExecutionStateError` 등)면 그 클래스의 **고정
   *   client-safe `message`** + `code` 를 surface 하고, `serverDetail` 은 서버 로그에만.
   * - 그 외 임의(plain) `Error` / unknown 은 **내부 `error.message` 를 client 에
   *   전달하지 않는다** — 고정 generic fallback + `EXECUTION_INTERNAL_ERROR` 로 축약하고
   *   원본 message/stack 은 서버 로그에만 기록한다 (누출 차단 보안 게이트).
   *
   * 아키텍처 불변식: 4종 continuation 핸들러(submitForm·clickButton·submitMessage·endConversation)
   * 의 catch 블록은 모두 이 메서드를 거친다 — frontend `localizeAckError` 가 "모든 continuation
   * ack 의 error 필드는 client-safe" 임을 가정하므로, 신규 continuation 핸들러 추가 시
   * 반드시 이 메서드를 사용해야 한다 (§7.5.2).
   *
   * worker 측 `RESUME_*`(§7.5.1)는 본 동기 ack 경로 밖 — 후행 `execution.cancelled` 통지.
   *
   * @param event WS ack 이벤트 이름 (예: `execution.form_submitted`).
   * @param error catch 블록에서 받은 throw 값.
   * @param fallbackMessage plain(non-typed) Error 에만 사용되는 client-side 고정 메시지.
   *   typed `ExecutionError` 가 아닌 경우에만 이 값이 `error` 필드로 노출되며, 내부
   *   `error.message` 는 절대 client 에 전달하지 않는다 (누출 차단).
   */
  private buildContinuationErrorAck(
    event: string,
    error: unknown,
    fallbackMessage: string,
  ): {
    event: string;
    data: { success: false; error: string; errorCode?: string };
  } {
    if (error instanceof ExecutionError) {
      if (error.serverDetail) {
        this.logger.warn(`[${event}] ${error.code}: ${error.serverDetail}`);
      }
      return {
        event,
        data: { success: false, error: error.message, errorCode: error.code },
      };
    }
    // 비-typed / unknown — 내부 message 는 절대 client 에 전달하지 않는다.
    this.logger.warn(
      `[${event}] continuation failed (internal): ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
    return {
      event,
      data: {
        success: false,
        error: fallbackMessage,
        errorCode: ErrorCode.EXECUTION_INTERNAL_ERROR,
      },
    };
  }

  broadcastToChannel(channel: string, event: string, payload: unknown): void {
    this.server.to(channel).emit(event, payload);
  }
}
