import { Injectable, Logger } from '@nestjs/common';
import type {
  DiscordApiError,
  DiscordApplication,
  DiscordMessage,
} from './discord.types';

/**
 * Discord REST API HTTP client.
 *
 * Spec [providers/discord §3]:
 *   - `POST /channels/{channel_id}/messages` — chat 발송
 *   - `POST /channels/{channel_id}/typing` — typing indicator (10초 유지)
 *   - `PUT /applications/{app_id}/commands` — slash command bulk overwrite
 *   - `GET /applications/@me` — bot identity
 *
 * 의도된 quirk:
 *   - 5초 timeout + 3회 백오프
 *   - 429 Retry-After 존중 (Discord 의 rate limit bucket)
 *   - Authorization: `Bot <token>` 형식 (Slack 의 `Bearer` 와 다름)
 */
const DISCORD_API_BASE = 'https://discord.com/api/v10';

type DiscordCallSuccess<T> = T & { ok?: true };

@Injectable()
export class DiscordClient {
  private readonly logger = new Logger(DiscordClient.name);
  protected baseUrl: string = DISCORD_API_BASE;

  /** GET /applications/@me — bot identity. */
  getApplicationMe(
    botToken: string,
  ): Promise<DiscordApplication | DiscordApiError> {
    return this.call<DiscordApplication>(botToken, 'GET', '/applications/@me');
  }

  /** POST /channels/{id}/messages — chat 발송. */
  postChannelMessage(
    botToken: string,
    channelId: string,
    body: {
      content?: string;
      components?: unknown[];
      embeds?: unknown[];
    },
  ): Promise<DiscordMessage | DiscordApiError> {
    return this.call<DiscordMessage>(
      botToken,
      'POST',
      `/channels/${encodeURIComponent(channelId)}/messages`,
      body,
    );
  }

  /** POST /channels/{id}/typing — typing indicator (10초). */
  postChannelTyping(
    botToken: string,
    channelId: string,
  ): Promise<{ ok: boolean }> {
    return this.call<{ ok: boolean }>(
      botToken,
      'POST',
      `/channels/${encodeURIComponent(channelId)}/typing`,
    ).then((r) => ({
      ok: !('code' in r && r.code != null),
    }));
  }

  /** PUT /applications/{app_id}/commands — bulk overwrite slash commands. */
  putApplicationCommands(
    botToken: string,
    appId: string,
    commands: unknown[],
  ): Promise<unknown[] | DiscordApiError> {
    return this.call<unknown[]>(
      botToken,
      'PUT',
      `/applications/${encodeURIComponent(appId)}/commands`,
      commands,
    );
  }

  protected async call<T>(
    botToken: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T | DiscordApiError> {
    const url = `${this.baseUrl}${path}`;
    const attempts = 3;
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, {
          method,
          headers: {
            authorization: `Bot ${botToken}`,
            'content-type': 'application/json; charset=utf-8',
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('retry-after') ?? '1');
          const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000;
          lastError = new Error(
            `Discord ${method} ${path} 429 retry=${retryAfter}`,
          );
          if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
        } else if (!res.ok) {
          const errBody = (await res.json().catch(() => ({
            code: res.status,
            message: `HTTP ${res.status}`,
          }))) as DiscordApiError;
          if (res.status >= 400 && res.status < 500) {
            return { ...errBody, ok: false };
          }
          lastError = new Error(`Discord ${method} ${path} HTTP ${res.status}`);
        } else {
          // 204 No Content (typing) 도 가능.
          if (res.status === 204) return {} as T;
          const json = (await res.json()) as DiscordCallSuccess<T>;
          return json;
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
      `DiscordClient.${method} ${path} 3회 재시도 실패: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
    return {
      ok: false,
      message:
        lastError instanceof Error
          ? lastError.message
          : 'Unknown error in DiscordClient',
    };
  }
}
