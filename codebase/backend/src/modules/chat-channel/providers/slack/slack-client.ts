import { Injectable, Logger } from '@nestjs/common';
import type {
  SlackAuthTestResult,
  SlackChatPostMessageResult,
} from './slack.types';

/**
 * Slack Web API HTTP client.
 *
 * Spec [providers/slack §3] — `https://slack.com/api/{method}` 위에 동작.
 * Phase 1 = method 시그니처 + stub. Phase 2 (Inbound auth.test) / Phase 3 (Outbound chat.postMessage)
 * 에서 본문 채움.
 *
 * 의도된 quirk:
 *   - 5초 timeout + 3회 지수 백오프 (1s / 2s / 4s) — Spec §8 비기능. Phase 3 에서 구현.
 *   - Slack rate limit (`Retry-After` 헤더) 존중 — 응답 헤더 파싱 후 큐잉. Phase 3.
 *   - URL 은 BASE 고정 (`api.slack.com` 만), 사용자 입력 미반영 — SSRF 차단.
 *   - bot token 은 매 호출 인자로 받음 (singleton client + multi-tenant).
 */
// Phase 2/3 에서 fetch URL prefix 로 사용. eslint underscore prefix 로 unused 경고 회피.
const _SLACK_API_BASE = 'https://slack.com/api';
void _SLACK_API_BASE;

@Injectable()
export class SlackClient {
  private readonly logger = new Logger(SlackClient.name);

  /**
   * `auth.test` — bot identity 조회. setupChannel 의 부수효과로 호출.
   *
   * Spec §3.1 — `{ ok, team_id, user_id, bot_id, url, team, user }` 반환.
   *
   * @param botToken — `xoxb-*` 형식. caller (TriggersService) 가 SecretResolver.resolve 후 전달.
   */
  authTest(_botToken: string): Promise<SlackAuthTestResult> {
    // Phase 2 에서 fetch 호출 구현.
    return Promise.reject(new Error('SlackClient.authTest — Phase 2 미구현'));
  }

  /**
   * `chat.postMessage` — text / mrkdwn / blocks 발송. AI Multi Turn / Button Presentation 등에 사용.
   *
   * Spec §5.1 — Slack mrkdwn parse + 3500자 분할은 caller (renderer) 가 책임.
   *
   * @param botToken — `xoxb-*`
   * @param params — channel, text, blocks 등
   */
  chatPostMessage(
    _botToken: string,
    _params: {
      channel: string;
      text: string;
      blocks?: unknown[];
      thread_ts?: string;
    },
  ): Promise<SlackChatPostMessageResult> {
    // Phase 3 에서 fetch 호출 구현.
    return Promise.reject(
      new Error('SlackClient.chatPostMessage — Phase 3 미구현'),
    );
  }

  /**
   * `files.uploadV2` — carousel/chart/table 의 image fallback path (Spec §5.4 photo enum).
   * v1 에서는 거의 호출되지 않음 (v1 = text fallback 우선).
   */
  filesUploadV2(
    _botToken: string,
    _params: {
      channel_id: string;
      filename: string;
      file: Buffer;
      initial_comment?: string;
    },
  ): Promise<{ ok: boolean; error?: string }> {
    return Promise.reject(
      new Error('SlackClient.filesUploadV2 — Phase 3 미구현'),
    );
  }

  /**
   * `auth.revoke` — bot token rotation 의 24h grace 종료 시 cron 호출.
   * Spec §3.2 — 별 step 으로 ChatChannelTokenRotatorService 가 수행.
   */
  authRevoke(_botToken: string): Promise<{ ok: boolean; revoked?: boolean }> {
    return Promise.reject(new Error('SlackClient.authRevoke — Phase 4 미구현'));
  }
}
