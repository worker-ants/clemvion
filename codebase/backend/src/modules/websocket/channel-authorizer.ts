/**
 * refactor 02 M-7 — WebSocket 구독 채널 인가 전략의 다형 인터페이스 + DI 토큰.
 *
 * 기존 `WebsocketGateway` 생성자가 6개 도메인 서비스를 forwardRef 로 직접 주입해
 * 인라인 `channelAuthorizers` 배열을 조립하던 구조를, **각 도메인 모듈이 자기 채널의
 * authorizer 를 `{ provide: CHANNEL_AUTHORIZER, multi: true }` 로 등록**하고 gateway 는
 * 그 배열만 주입받는 형태로 역전(gateway→도메인 서비스 역참조 제거, OCP — 신규 채널 =
 * provider 1개). 본 파일은 모듈 의존이 없는 순수 인터페이스/토큰이라 순환을 만들지 않는다.
 *
 * `matches` 가 채널 prefix 를 판정하고(상호 배타), `authorize` 는 인가 통과 시 `null`,
 * 거부 시 `{ error }` 를 반환한다(`handleSubscribe` 가 ack 의 `error` 로 전달).
 */
export interface ChannelAuthorizerContext {
  /** workspace-scoped 채널 소유 검증용 (대부분의 채널). */
  readonly workspaceId: string;
  /** user-scoped 채널(`notifications:`)용 — JWT sub. */
  readonly userId: string;
}

export interface ChannelAuthorizer {
  matches(channel: string): boolean;
  authorize(
    channel: string,
    ctx: ChannelAuthorizerContext,
  ): Promise<{ error: string } | null>;
}

/** multi-provider DI 토큰 — 각 도메인 모듈이 자기 ChannelAuthorizer 를 등록. */
export const CHANNEL_AUTHORIZER = Symbol('CHANNEL_AUTHORIZER');
