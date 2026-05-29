import { Injectable, Logger } from '@nestjs/common';
import type {
  SlackAuthTestResult,
  SlackChatPostMessageResult,
} from './slack.types';

/**
 * Slack Web API HTTP client.
 *
 * Spec [providers/slack §3] — `https://slack.com/api/{method}` 위에 동작.
 *
 * 의도된 quirk:
 *   - 5초 timeout + 3회 지수 백오프 (1s / 2s / 4s) — Spec §8 비기능.
 *   - Slack rate limit (`Retry-After` 헤더, status 429) 존중 — 응답 헤더 파싱 후 wait.
 *   - URL 은 BASE 고정 (`api.slack.com` 만), 사용자 입력 미반영 — SSRF 차단.
 *   - bot token 은 매 호출 인자로 받음 (singleton client + multi-tenant).
 */
const SLACK_API_BASE = 'https://slack.com/api';

@Injectable()
export class SlackClient {
  private readonly logger = new Logger(SlackClient.name);
  /** override 가능 (e2e fake 등) — production 은 const. */
  protected baseUrl: string = SLACK_API_BASE;

  /**
   * `auth.test` — bot identity 조회. setupChannel 의 부수효과로 호출.
   * Spec §3.1 — `{ ok, team_id, user_id, bot_id, url, team, user }` 반환.
   */
  authTest(botToken: string): Promise<SlackAuthTestResult> {
    return this.call<SlackAuthTestResult>(botToken, 'auth.test', {});
  }

  /**
   * `chat.postMessage` — text / mrkdwn / blocks 발송.
   * Spec §5.1 — Slack mrkdwn 의 escape 는 caller (renderer) 책임.
   */
  chatPostMessage(
    botToken: string,
    params: {
      channel: string;
      text: string;
      blocks?: unknown[];
      thread_ts?: string;
    },
  ): Promise<SlackChatPostMessageResult> {
    return this.call<SlackChatPostMessageResult>(
      botToken,
      'chat.postMessage',
      params as unknown as Record<string, unknown>,
    );
  }

  /**
   * `views.open` — §4.1 native form modal open. `open_form_modal` command 처리 시
   * HooksService → SlackAdapter.openFormModal 가 호출. trigger_id (3초 유효) + modal view.
   * Spec [providers/slack §5.3] / chat-channel-adapter §4.1.
   */
  viewsOpen(
    botToken: string,
    payload: { trigger_id: string; view: unknown },
  ): Promise<{ ok: boolean; error?: string }> {
    return this.call<{ ok: boolean; error?: string }>(
      botToken,
      'views.open',
      payload as unknown as Record<string, unknown>,
    );
  }

  /**
   * `files.uploadV2` — v1 carousel/chart/table fallback path (Spec §5.4). Phase 3 후속.
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
      new Error(
        'SlackClient.filesUploadV2 — Phase 3 후속 (v1 = text fallback)',
      ),
    );
  }

  /**
   * `auth.revoke` — bot token rotation 의 24h grace 종료 시 cron 호출 (Phase 4).
   */
  authRevoke(botToken: string): Promise<{ ok: boolean; revoked?: boolean }> {
    return this.call<{ ok: boolean; revoked?: boolean }>(
      botToken,
      'auth.revoke',
      {},
    );
  }

  /**
   * Generic Slack Web API call. 5초 timeout + 3회 지수 백오프 — CCH-SE-01.
   * 429 Too Many Requests 시 `Retry-After` 헤더의 초만큼 wait 후 재시도 (counted as one attempt).
   */
  protected async call<T extends { ok: boolean }>(
    botToken: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}/${method}`;
    const attempts = 3;
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${botToken}`,
            'content-type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify(params),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.status === 429) {
          // Slack rate limit — Retry-After 헤더 (초) 만큼 wait.
          const retryAfter = Number(res.headers.get('retry-after') ?? '1');
          const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000;
          lastError = new Error(
            `Slack ${method} 429 retry-after=${retryAfter}`,
          );
          if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
        } else if (!res.ok) {
          // 4xx / 5xx — body 가 JSON 일 수도 plaintext 일 수도.
          const body = (await res
            .json()
            .catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as T;
          if (res.status >= 400 && res.status < 500) {
            // 4xx 는 재시도 무의미.
            return body;
          }
          lastError = new Error(`Slack ${method} HTTP ${res.status}`);
        } else {
          // 2xx — Slack Web API 는 200 OK 에도 `{ ok: false, error }` 형식 반환 가능.
          const body = (await res.json()) as T;
          return body;
        }
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
      }
      if (i < attempts - 1) {
        const delay = 1000 * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    this.logger.warn(
      `SlackClient.${method} 3회 재시도 실패: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
    return {
      ok: false,
      error:
        lastError instanceof Error
          ? lastError.message
          : 'Unknown error in SlackClient',
    } as unknown as T;
  }
}
