import { Injectable, Logger } from '@nestjs/common';

/**
 * Telegram Bot API HTTP client.
 *
 * Spec [providers/telegram §3] — `https://api.telegram.org/bot{token}/{method}` 위에 동작.
 * Phase 1 = method 시그니처와 단위 테스트만. Phase 2 가 본문 채움.
 *
 * 의도된 quirk:
 *   - 5초 timeout + 3회 지수 백오프 (CCH-SE-01) 는 sendMessage 등 구체 메서드에 적용 (Phase 2/PR-E).
 *   - SSRF 차단: URL 은 BASE 고정, 사용자 입력 미반영.
 *   - parse_mode 는 호출자가 결정 (renderer 가 MarkdownV2 escape 후 set).
 */
const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

/** sendMessage 등의 공통 옵션. */
export interface TelegramSendMessageParams {
  chat_id: string | number;
  text: string;
  parse_mode?: 'MarkdownV2' | 'Markdown' | 'HTML';
  reply_markup?: unknown;
  reply_to_message_id?: number;
}

export interface TelegramSendPhotoParams {
  chat_id: string | number;
  /** URL string or multipart buffer reference. v1 은 buffer multipart (Phase 5/PR-D). */
  photo: string | Buffer;
  caption?: string;
  parse_mode?: 'MarkdownV2' | 'Markdown' | 'HTML';
  reply_markup?: unknown;
}

export interface TelegramSetWebhookParams {
  url: string;
  secret_token?: string;
  allowed_updates?: string[];
  drop_pending_updates?: boolean;
}

export interface TelegramAnswerCallbackQueryParams {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
}

export interface TelegramGetMeResult {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: { id: number };
  text?: string;
}

/** params 객체 → Record<string, unknown> 변환 (TS 의 structural type incompat 회피). */
function toRecord<T extends object>(params: T): Record<string, unknown> {
  return params as unknown as Record<string, unknown>;
}

/**
 * Phase 1 = 메서드 시그니처 + 본문 NotImplemented (sendMessage / setWebhook 등은 Phase 2 채움).
 *
 * NestJS provider — singleton. 토큰은 매 호출에 인자로 받는다 (provider별 instance 분리 X) —
 * 동일 backend 인스턴스가 여러 trigger 의 토큰을 다룬다.
 */
@Injectable()
export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);
  /** override 가능 (e2e fake 등) — production 은 const. */
  protected baseUrl: string = TELEGRAM_API_BASE;

  async setWebhook(
    token: string,
    params: TelegramSetWebhookParams,
  ): Promise<TelegramApiResponse<true>> {
    return this.call<true>(token, 'setWebhook', toRecord(params));
  }

  async deleteWebhook(
    token: string,
    params: { drop_pending_updates?: boolean } = {},
  ): Promise<TelegramApiResponse<true>> {
    return this.call<true>(token, 'deleteWebhook', toRecord(params));
  }

  async getMe(token: string): Promise<TelegramApiResponse<TelegramGetMeResult>> {
    return this.call<TelegramGetMeResult>(token, 'getMe', {});
  }

  async sendMessage(
    token: string,
    params: TelegramSendMessageParams,
  ): Promise<TelegramApiResponse<TelegramMessage>> {
    return this.call<TelegramMessage>(token, 'sendMessage', toRecord(params));
  }

  async sendPhoto(
    token: string,
    params: TelegramSendPhotoParams,
  ): Promise<TelegramApiResponse<TelegramMessage>> {
    return this.call<TelegramMessage>(token, 'sendPhoto', toRecord(params));
  }

  async sendChatAction(
    token: string,
    params: { chat_id: string | number; action: 'typing' | 'upload_photo' },
  ): Promise<TelegramApiResponse<true>> {
    return this.call<true>(token, 'sendChatAction', toRecord(params));
  }

  async answerCallbackQuery(
    token: string,
    params: TelegramAnswerCallbackQueryParams,
  ): Promise<TelegramApiResponse<true>> {
    return this.call<true>(
      token,
      'answerCallbackQuery',
      toRecord(params),
    );
  }

  /**
   * Generic Bot API call. 5초 timeout, 3회 지수 백오프 (1s/2s/4s) — CCH-SE-01.
   * 본 메서드는 단위 테스트에서 mock 하기 쉽도록 단일 진입점으로 격리.
   */
  protected async call<T>(
    token: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<TelegramApiResponse<T>> {
    const url = `${this.baseUrl}/bot${token}/${method}`;
    const attempts = 3;
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(params),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          // Telegram returns JSON even on 4xx/5xx — parse for description.
          const body = (await res.json().catch(() => ({}))) as TelegramApiResponse<T>;
          if (res.status >= 400 && res.status < 500) {
            // 4xx 는 재시도 무의미 — 즉시 반환.
            return body;
          }
          lastError = new Error(
            `Telegram ${method} HTTP ${res.status} ${body.description ?? ''}`,
          );
        } else {
          const body = (await res.json()) as TelegramApiResponse<T>;
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
      `TelegramClient.${method} 3회 재시도 실패: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
    return {
      ok: false,
      description:
        lastError instanceof Error
          ? lastError.message
          : 'Unknown error in TelegramClient',
    };
  }
}
