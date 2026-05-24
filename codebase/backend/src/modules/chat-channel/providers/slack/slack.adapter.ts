import { Injectable, Logger } from '@nestjs/common';
import { SecretResolverService } from '../../../secret-store/secret-resolver.service';
import type {
  ChannelMessage,
  ChannelUpdate,
  ChatChannelAdapter,
  ChatChannelConfig,
  EiaEvent,
  SendResult,
  SetupResult,
} from '../../types';
import { SlackClient } from './slack-client';

/**
 * Slack Chat Channel Adapter.
 *
 * Spec [providers/slack.md] — Web API + Events API + Interactivity 기반 Webhook-mode 어댑터.
 * Phase 1 = 6함수 stub (provider 식별자 + 기본 의존성 wiring). Phase 2 (parseUpdate / inbound auth)
 * / Phase 3 (renderNode / sendMessage) / Phase 4 (token rotation) 에서 본문 채움.
 *
 * Spec 의 핵심 결정 (Phase 1 단계에서는 stub 이라 동작 없음, Phase 2+ 에서 구체화):
 *   - Webhook-mode only (R-S-3). Socket Mode 는 v2.
 *   - DM 첫 메시지 자동 start (R-S-9). slash command 는 보조 명령.
 *   - typing no-op (R-S-5). Slack Web API 미지원.
 *   - Form 다단계 텍스트 시퀀스 (Convention §4 / R-S-6). modal 은 v2.
 *   - inboundSigningRef = signing secret HMAC (R-S-1) — Telegram 의 server-issued 와 달리 사용자 입력.
 *     `SetupResult.issuedInboundSigning` 은 항상 비움.
 */
@Injectable()
export class SlackAdapter implements ChatChannelAdapter {
  private readonly logger = new Logger(SlackAdapter.name);
  readonly provider = 'slack';

  constructor(
    private readonly client: SlackClient,
    private readonly secrets: SecretResolverService,
  ) {}

  private async resolveBotToken(config: ChatChannelConfig): Promise<string> {
    if (!config.botTokenRef) {
      throw new Error(
        'SlackAdapter: botTokenRef 미설정 — setupChannel 이전 상태.',
      );
    }
    return this.secrets.resolve(config.botTokenRef);
  }

  /**
   * Spec §3.1 — auth.test 로 bot identity 캐시.
   * Events API Request URL 은 Slack 앱 manifest 의 사전 등록 — 어댑터가 API 로 등록 안 함 (R-S-2).
   * `issuedInboundSigning` 은 비움 (Slack 은 provider-issued — 사용자가 manual 입력).
   */
  setupChannel(
    _config: ChatChannelConfig,
    _callbackUrl: string,
  ): Promise<SetupResult> {
    // Phase 2 에서 client.authTest + botIdentity 캐시 구현.
    return Promise.reject(
      new Error('SlackAdapter.setupChannel — Phase 2 미구현'),
    );
  }

  /**
   * Spec §3.2 — best-effort no-op. Slack 앱 uninstall 은 사용자가 workspace 에서 직접.
   * Bot token rotation 의 24h grace 종료 시 별 cron (`ChatChannelTokenRotatorService`) 이
   * `auth.revoke` 를 호출 — 본 함수의 책임 아님.
   */
  teardownChannel(_config: ChatChannelConfig): Promise<void> {
    // no-op (R-S-2 — Slack 앱 manifest 의 Request URL 은 우리가 revoke 못 함)
    return Promise.resolve();
  }

  /**
   * Spec §4 — Events API / Interactivity / Slash Commands 3종 envelope 분기.
   * url_verification 케이스는 null 반환 + caller (HooksService) 가 `{ challenge }` 200 응답 처리.
   */
  parseUpdate(
    _raw: unknown,
    _config: ChatChannelConfig,
  ): Promise<ChannelUpdate | null> {
    // Phase 2 에서 envelope 분기 + 명령 매핑 구현.
    return Promise.reject(
      new Error('SlackAdapter.parseUpdate — Phase 2 미구현'),
    );
  }

  /**
   * Spec §5 인터랙션 노드 UI 매핑 (5종).
   * Phase 3 에서 5.1 (AI Multi Turn) / 5.2 (Button) / 5.3 (Form 다단계) / 5.4 (시각형 v1 text)
   * / 5.5 (Typing no-op) 구현.
   */
  renderNode(
    _event: EiaEvent,
    _config: ChatChannelConfig,
  ): Promise<ChannelMessage[]> {
    // Phase 3 에서 EIA event 분기 + ChannelMessage 배열 합성.
    return Promise.reject(
      new Error('SlackAdapter.renderNode — Phase 3 미구현'),
    );
  }

  /**
   * Spec §3 — chat.postMessage / files.uploadV2 분기 + 5초 timeout + 3회 backoff + rate limit 큐.
   * typing kind 는 no-op (R-S-5) — silent skip.
   */
  sendMessage(
    _message: ChannelMessage,
    _config: ChatChannelConfig,
  ): Promise<SendResult> {
    // Phase 3 에서 client.chatPostMessage 등 호출 구현.
    return Promise.reject(
      new Error('SlackAdapter.sendMessage — Phase 3 미구현'),
    );
  }

  /**
   * Spec §4.2 — Interactivity 3초 ack 의무. HooksController 가 즉시 200 OK 응답을 반환하므로,
   * 본 함수의 책임은 비동기 후속 갱신 (response_url POST 등) — Phase 3 의 sendMessage 와 통합.
   */
  ackInteraction(
    _update: ChannelUpdate,
    _config: ChatChannelConfig,
  ): Promise<void> {
    // Slack 의 3초 ack 는 HTTP response 로 즉시 반환됨 (HooksController 책임).
    // 본 함수는 noop — 비동기 후속 갱신은 sendMessage 가 response_url 로 처리.
    return Promise.resolve();
  }
}
