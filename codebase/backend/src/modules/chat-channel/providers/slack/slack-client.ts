import { Injectable, Logger } from '@nestjs/common';
import type {
  SlackAuthTestResult,
  SlackChatPostMessageResult,
  SlackFilesInfoResult,
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
   * `files.info` — file_shared event 의 file 메타데이터(mimetype/name/url_private) 조회.
   * HooksService 가 inbound file_upload command 보강에 1회 호출 (R-S-7 normative).
   * Spec [providers/slack §4.1 / R-S-7].
   */
  filesInfo(botToken: string, fileId: string): Promise<SlackFilesInfoResult> {
    return this.call<SlackFilesInfoResult>(botToken, 'files.info', {
      file: fileId,
    });
  }

  /**
   * `files.uploadV2` — image/chart/table 등 시각형 노드의 PNG 업로드 (Spec §5.4).
   * multipart/form-data 직접 전송 — JSON 기반 `call()` 과 별도 경로. 5초 timeout +
   * 3회 지수 백오프 + 429 Retry-After 존중 (CCH-SE-01, `call()` 과 동일 정책).
   */
  async filesUploadV2(
    botToken: string,
    params: {
      channel_id: string;
      filename: string;
      file: Buffer;
      initial_comment?: string;
    },
  ): Promise<{ ok: boolean; error?: string }> {
    const url = `${this.baseUrl}/files.uploadV2`;
    const attempts = 3;
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const form = new FormData();
        form.append('channel_id', params.channel_id);
        form.append('filename', params.filename);
        form.append(
          'file',
          new Blob([new Uint8Array(params.file)]),
          params.filename,
        );
        if (params.initial_comment) {
          form.append('initial_comment', params.initial_comment);
        }
        const res = await fetch(url, {
          method: 'POST',
          // content-type 은 fetch 가 multipart boundary 와 함께 자동 설정.
          headers: { authorization: `Bearer ${botToken}` },
          body: form,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('retry-after') ?? '1');
          const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000;
          lastError = new Error(`Slack files.uploadV2 429 retry-after=${retryAfter}`);
          if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
        } else if (res.status >= 400 && res.status < 500) {
          return (await res
            .json()
            .catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as {
            ok: boolean;
            error?: string;
          };
        } else if (!res.ok) {
          lastError = new Error(`Slack files.uploadV2 HTTP ${res.status}`);
        } else {
          return (await res.json()) as { ok: boolean; error?: string };
        }
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
    this.logger.warn(
      `SlackClient.filesUploadV2 3회 재시도 실패: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
    return {
      ok: false,
      error:
        lastError instanceof Error
          ? lastError.message
          : 'Unknown error in filesUploadV2',
    };
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
