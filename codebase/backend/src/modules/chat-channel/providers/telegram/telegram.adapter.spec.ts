/**
 * TelegramAdapter 단위 테스트.
 *
 * [ai-review W4] TelegramAdapter (setupChannel / teardownChannel / sendMessage / ackInteraction) 미테스트.
 * Spec [providers/telegram.md §3]: Bot API 호출 매핑.
 * CCH-SE-02: secretToken 발급 및 저장 검증.
 * Secret store 통합: botTokenRef → SecretResolverService.resolve() 경유 (SUMMARY#25).
 */
import { TelegramAdapter } from './telegram.adapter';
import {
  TelegramClient,
  TelegramApiResponse,
  TelegramGetMeResult,
} from './telegram-client';
import { SecretResolverService } from '../../../secret-store/secret-resolver.service';
import { ChatChannelConfig, ChannelUpdate, ChannelMessage } from '../../types';

const makeMockClient = (): jest.Mocked<TelegramClient> =>
  ({
    setWebhook: jest.fn(),
    deleteWebhook: jest.fn(),
    getMe: jest.fn(),
    sendMessage: jest.fn(),
    sendPhoto: jest.fn(),
    sendChatAction: jest.fn(),
    answerCallbackQuery: jest.fn(),
  }) as unknown as jest.Mocked<TelegramClient>;

const BOT_TOKEN_PLAIN = 'test-bot-token-123';
const BOT_TOKEN_REF = 'secret://triggers/t1/bot-token';

/** SecretResolverService mock: BOT_TOKEN_REF → BOT_TOKEN_PLAIN, 그 외 throw. */
const makeSecretsMock = (): jest.Mocked<SecretResolverService> =>
  ({
    resolve: jest.fn(async (ref: string) => {
      if (ref === BOT_TOKEN_REF) return BOT_TOKEN_PLAIN;
      throw new Error(`Unexpected resolve ref: ${ref}`);
    }),
    store: jest.fn().mockResolvedValue(undefined),
    rotate: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByPrefix: jest.fn().mockResolvedValue(0),
    exists: jest.fn().mockResolvedValue(false),
  }) as unknown as jest.Mocked<SecretResolverService>;

const baseConfig: ChatChannelConfig = {
  provider: 'telegram',
  botTokenRef: BOT_TOKEN_REF,
  botIdentity: undefined,
  uiMapping: undefined,
  rateLimitPerMinute: undefined,
  languageHints: undefined,
};

const okResult = <T>(result: T): TelegramApiResponse<T> => ({
  ok: true,
  result,
});

const failResult = (description: string): TelegramApiResponse<never> => ({
  ok: false,
  description,
  error_code: 400,
});

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter;
  let client: jest.Mocked<TelegramClient>;
  let secrets: jest.Mocked<SecretResolverService>;

  beforeEach(() => {
    client = makeMockClient();
    secrets = makeSecretsMock();
    adapter = new TelegramAdapter(client, secrets);
  });

  describe('provider', () => {
    it('provider 식별자는 "telegram"', () => {
      expect(adapter.provider).toBe('telegram');
    });
  });

  describe('setupChannel()', () => {
    const callbackUrl = 'https://example.com/hooks/abc';

    beforeEach(() => {
      client.setWebhook.mockResolvedValue(okResult(true));
      client.getMe.mockResolvedValue(
        okResult<TelegramGetMeResult>({
          id: 1001,
          is_bot: true,
          first_name: 'TestBot',
          username: 'test_bot',
        }),
      );
    });

    it('botTokenRef 를 resolve 해 setWebhook 을 callbackUrl 과 함께 호출하고 SetupResult 를 반환한다', async () => {
      const result = await adapter.setupChannel(baseConfig, callbackUrl);

      expect(secrets.resolve).toHaveBeenCalledWith(BOT_TOKEN_REF);
      expect(client.setWebhook).toHaveBeenCalledWith(
        BOT_TOKEN_PLAIN,
        expect.objectContaining({ url: callbackUrl }),
      );
      expect(result.registeredAt).toBeTruthy();
      expect(result.identity).toEqual({ botId: 1001, username: 'test_bot' });
    });

    it('매 setupChannel 마다 새 issuedSecretToken 을 발급해 setWebhook 에 전달한다 (CCH-SE-02)', async () => {
      const result = await adapter.setupChannel(baseConfig, callbackUrl);

      const [, params] = client.setWebhook.mock.calls[0];
      expect(params.secret_token).toBeTruthy();
      expect(typeof params.secret_token).toBe('string');
      expect(params.secret_token!.length).toBeGreaterThan(0);
      // SetupResult 에 issuedSecretToken 포함 (caller 가 secret store 에 저장)
      expect(result.issuedSecretToken).toBe(params.secret_token);
    });

    it('setWebhook 실패 시 Error 를 throw 한다', async () => {
      client.setWebhook.mockResolvedValue(failResult('Forbidden'));

      await expect(
        adapter.setupChannel(baseConfig, callbackUrl),
      ).rejects.toThrow(/setWebhook failed/i);
    });

    it('getMe 실패 시 Error 를 throw 한다', async () => {
      client.getMe.mockResolvedValue(failResult('Unauthorized'));

      await expect(
        adapter.setupChannel(baseConfig, callbackUrl),
      ).rejects.toThrow(/getMe failed/i);
    });

    it('setupChannel 반환값의 configUpdates 에 botIdentity 가 포함된다 (secretToken 은 issuedSecretToken 으로 분리)', async () => {
      const result = await adapter.setupChannel(baseConfig, callbackUrl);
      expect(result.issuedSecretToken).toBeTruthy();
      expect(result.configUpdates?.botIdentity?.username).toBe('test_bot');
    });

    it('botTokenRef 미설정 시 NotFoundException throw', async () => {
      const configNoRef: ChatChannelConfig = { provider: 'telegram' };
      await expect(
        adapter.setupChannel(configNoRef, callbackUrl),
      ).rejects.toThrow(/botTokenRef 미설정/);
    });
  });

  describe('teardownChannel()', () => {
    it('deleteWebhook 을 botToken 으로 호출한다 (best-effort)', async () => {
      client.deleteWebhook.mockResolvedValue(okResult(true));
      await adapter.teardownChannel(baseConfig);
      expect(client.deleteWebhook).toHaveBeenCalledWith(
        BOT_TOKEN_PLAIN,
        expect.objectContaining({ drop_pending_updates: true }),
      );
    });

    it('deleteWebhook 실패 시에도 예외 없이 완료된다 (best-effort 계약)', async () => {
      client.deleteWebhook.mockResolvedValue(failResult('Webhook not found'));
      await expect(
        adapter.teardownChannel(baseConfig),
      ).resolves.toBeUndefined();
    });

    it('botToken resolve 실패 시 deleteWebhook 미호출 + 예외 없이 완료 (best-effort)', async () => {
      secrets.resolve.mockRejectedValueOnce(new Error('secret not found'));
      await expect(
        adapter.teardownChannel(baseConfig),
      ).resolves.toBeUndefined();
      expect(client.deleteWebhook).not.toHaveBeenCalled();
    });
  });

  describe('parseUpdate()', () => {
    it('유효한 Telegram text message → ChannelUpdate 반환', async () => {
      const raw = {
        update_id: 100,
        message: {
          chat: { id: 9999, type: 'private' },
          from: { id: 888, is_bot: false },
          text: 'hello',
          date: 1700000000,
        },
      };
      const result = await adapter.parseUpdate(raw, baseConfig);
      expect(result).not.toBeNull();
      expect(result?.conversationKey).toBe('9999');
      expect(result?.command.kind).toBe('text_message');
    });

    it('group chat update → null 반환 (side-effect 없음 — sendMessage 미호출)', async () => {
      const raw = {
        update_id: 101,
        message: {
          chat: { id: 1234, type: 'group' },
          from: { id: 888, is_bot: false },
          text: 'hi',
          date: 1700000000,
        },
      };
      const result = await adapter.parseUpdate(raw, baseConfig);
      expect(result).toBeNull();
      // pure 계약 검증 — parseUpdate 는 sendMessage 를 절대 호출하지 않는다 (CCH-AD-04 / convention §1.1)
      expect(client.sendMessage).not.toHaveBeenCalled();
    });

    it('봇 메시지 (from.is_bot=true) → null 반환 (side-effect 없음)', async () => {
      const raw = {
        update_id: 102,
        message: {
          chat: { id: 5678, type: 'private' },
          from: { id: 999, is_bot: true },
          text: 'bot reply',
          date: 1700000000,
        },
      };
      const result = await adapter.parseUpdate(raw, baseConfig);
      expect(result).toBeNull();
      expect(client.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage()', () => {
    const mockMsgResult = okResult({
      message_id: 42,
      date: 1700000000,
      chat: { id: 9999 },
    });

    it('text 메시지를 MarkdownV2 로 sendMessage API 에 전달한다', async () => {
      client.sendMessage.mockResolvedValue(mockMsgResult);
      const msg: ChannelMessage = {
        conversationKey: '9999',
        body: { kind: 'text', text: 'hello world' },
      };
      const result = await adapter.sendMessage(msg, baseConfig);
      expect(secrets.resolve).toHaveBeenCalledWith(BOT_TOKEN_REF);
      expect(client.sendMessage).toHaveBeenCalledWith(
        BOT_TOKEN_PLAIN,
        expect.objectContaining({
          chat_id: '9999',
          text: 'hello world',
          parse_mode: 'MarkdownV2',
        }),
      );
      expect(result.externalMsgId).toBe('42');
    });

    it('buttons 메시지 — inline_keyboard 와 함께 sendMessage 호출', async () => {
      client.sendMessage.mockResolvedValue(mockMsgResult);
      const msg: ChannelMessage = {
        conversationKey: '9999',
        body: {
          kind: 'buttons',
          text: '선택해주세요',
          buttons: [
            { id: 'btn-1', label: '옵션 A', type: 'callback' },
            { id: 'btn-2', label: '옵션 B', type: 'callback' },
          ],
        },
      };
      await adapter.sendMessage(msg, baseConfig);
      const [, params] = client.sendMessage.mock.calls[0];
      expect(params.reply_markup).toBeTruthy();
    });

    it('sendMessage API 실패 시 Error throw', async () => {
      client.sendMessage.mockResolvedValue(failResult('Bad Request'));
      const msg: ChannelMessage = {
        conversationKey: '9999',
        body: { kind: 'text', text: 'test' },
      };
      await expect(adapter.sendMessage(msg, baseConfig)).rejects.toThrow(
        /sendMessage failed/i,
      );
    });
  });

  describe('ackInteraction()', () => {
    it('button_callback update → answerCallbackQuery 호출', async () => {
      client.answerCallbackQuery.mockResolvedValue(okResult(true));
      const update: ChannelUpdate = {
        conversationKey: '9999',
        channelUserKey: '888',
        command: {
          kind: 'button_callback',
          callbackData: 'btn-id-1',
          callbackQueryId: 'cq-abc',
        },
        idempotencyKey: '100',
        receivedAt: new Date().toISOString(),
      };
      await adapter.ackInteraction(update, baseConfig);
      expect(secrets.resolve).toHaveBeenCalledWith(BOT_TOKEN_REF);
      expect(client.answerCallbackQuery).toHaveBeenCalledWith(
        BOT_TOKEN_PLAIN,
        expect.objectContaining({ callback_query_id: 'cq-abc' }),
      );
    });

    it('text_message update → answerCallbackQuery 미호출 (noop)', async () => {
      const update: ChannelUpdate = {
        conversationKey: '9999',
        channelUserKey: '888',
        command: { kind: 'text_message', text: 'hello' },
        idempotencyKey: '101',
        receivedAt: new Date().toISOString(),
      };
      await adapter.ackInteraction(update, baseConfig);
      expect(client.answerCallbackQuery).not.toHaveBeenCalled();
    });
  });
});
