/**
 * SlackAdapter 단위 테스트 (Phase 2).
 * provider 식별자 + 핵심 함수 wiring + setupChannel + parseUpdate (parser 위임 검증).
 * Phase 3 의 renderNode / sendMessage 는 후속 turn 의 별 spec.
 */
import { SlackAdapter } from './slack.adapter';
import { SlackClient } from './slack-client';
import type { SecretResolverService } from '../../../secret-store/secret-resolver.service';
import type { ChatChannelConfig } from '../../types';

function makeSecretsMock(
  resolveImpl: () => Promise<string> = async () => 'xoxb-test-token',
): jest.Mocked<SecretResolverService> {
  return {
    resolve: jest.fn(resolveImpl),
    store: jest.fn(),
    rotate: jest.fn(),
    delete: jest.fn(),
    deleteByPrefix: jest.fn(),
    exists: jest.fn(),
  } as unknown as jest.Mocked<SecretResolverService>;
}

function makeClient(): SlackClient {
  return new SlackClient();
}

const SLACK_CONFIG: ChatChannelConfig = {
  provider: 'slack',
  botTokenRef: 'secret://triggers/t1/bot-token',
  inboundSigningRef: 'secret://triggers/t1/inbound-signing',
};

describe('SlackAdapter', () => {
  describe('식별자 + interface wiring', () => {
    it('provider 식별자 = "slack"', () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      expect(adapter.provider).toBe('slack');
    });

    it('ChatChannelAdapter 핵심 함수 노출', () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      expect(typeof adapter.setupChannel).toBe('function');
      expect(typeof adapter.teardownChannel).toBe('function');
      expect(typeof adapter.parseUpdate).toBe('function');
      expect(typeof adapter.renderNode).toBe('function');
      expect(typeof adapter.sendMessage).toBe('function');
      expect(typeof adapter.ackInteraction).toBe('function');
    });

    it('escapeControlText — slack mrkdwn <>& 만 escape, 마침표는 그대로', () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      expect(adapter.escapeControlText('a & b <c>')).toBe(
        'a &amp; b &lt;c&gt;',
      );
      expect(adapter.escapeControlText('받을 수 없어요.')).toBe(
        '받을 수 없어요.',
      );
    });

    it('teardownChannel — no-op (R-S-2)', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      await expect(
        adapter.teardownChannel(SLACK_CONFIG),
      ).resolves.toBeUndefined();
    });

    it('ackInteraction — response_url 이 없으면 no-op (3초 ack 는 defaultInteractionResponse 책임)', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      await expect(
        adapter.ackInteraction(
          {
            conversationKey: 'C1',
            channelUserKey: 'U1',
            command: {
              kind: 'button_callback',
              callbackData: 'b',
              callbackQueryId: '',
            },
            idempotencyKey: 'k',
            receivedAt: '2026-05-24T00:00:00Z',
          },
          SLACK_CONFIG,
        ),
      ).resolves.toBeUndefined();
    });
  });

  // 근거: CLE-CHAT-SLACK 「인바운드 응답」 · Slack 공식 문서(Handling user interaction) — Interactivity 는
  // 3초 안 HTTP 200 을 받아야 하고 빈 본문으로 충분하다. NERV Task `CLE-T-FCBG91`.
  describe('defaultInteractionResponse (Interactivity 3초 ack)', () => {
    const adapter = new SlackAdapter(makeClient(), makeSecretsMock());

    it.each([
      ['block_actions', { type: 'block_actions' }],
      ['view_submission', { type: 'view_submission' }],
    ])('Interactivity(%s) 는 200 빈 본문이다', (_label, payload) => {
      expect(
        adapter.defaultInteractionResponse(
          { payload: JSON.stringify(payload) },
          SLACK_CONFIG,
        ),
      ).toEqual({});
    });

    it.each([
      ['Events API', { type: 'event_callback', event: { type: 'message' } }],
      ['url_verification', { type: 'url_verification', challenge: 'c' }],
      [
        'command 가 있는 Events API',
        { type: 'event_callback', command: '/workflow', text: 'start' },
      ],
      ['text 가 없는 슬래시 명령', { command: '/workflow' }],
      ['payload 가 문자열이 아님', { payload: { type: 'block_actions' } }],
      ['null', null],
      ['문자열 본문', 'payload=x'],
    ])('%s 에는 기본 응답이 없다', (_label, raw) => {
      expect(
        adapter.defaultInteractionResponse(raw, SLACK_CONFIG),
      ).toBeUndefined();
    });
  });

  // 근거: [Slack 어댑터](CLE-CHAT-SLACK) · Slack 공식 문서(url_verification) — Request URL 을 등록할 때 온
  // challenge 를 그대로 돌려줘야 한다. 판별은 어댑터가 하고 HooksService 는 어댑터 훅만 부른다.
  // NERV Task `CLE-T-NMTWSN` · `CLE-T-0JEQRY` 2번.
  describe('handshakeResponse (url_verification)', () => {
    const adapter = new SlackAdapter(makeClient(), makeSecretsMock());

    it('url_verification 에는 challenge 를 그대로 돌려준다', () => {
      expect(
        adapter.handshakeResponse(
          { type: 'url_verification', challenge: 'ch-1' },
          SLACK_CONFIG,
        ),
      ).toEqual({ body: { challenge: 'ch-1' } });
    });

    it.each([
      ['challenge 가 빈 문자열', { type: 'url_verification', challenge: '' }],
      [
        'challenge 가 문자열이 아님',
        { type: 'url_verification', challenge: 1 },
      ],
      ['challenge 가 없음', { type: 'url_verification' }],
      ['Events API', { type: 'event_callback', challenge: 'c' }],
      ['Interactivity', { payload: JSON.stringify({ type: 'block_actions' }) }],
      ['null', null],
    ])('%s 는 핸드셰이크가 아니다', (_label, raw) => {
      expect(adapter.handshakeResponse(raw, SLACK_CONFIG)).toBeUndefined();
    });
  });

  // 근거: [Slack 어댑터 「인바운드 응답」](CLE-CHAT-SLACK) · Slack 공식 문서(Slash commands) — 슬래시
  // 명령은 3초 안에 HTTP 200 을 받아야 사용자에게 오류가 보이지 않는다. 응답 모양은 Discord 슬래시 명령
  // 선례(2026-11-12, NERV Task `CLE-T-TSEP9G`)를 따른다. 본인에게만 보이는 메시지로 help 는 도움말,
  // 나머지는 공통 수신 문구다. NERV Task `CLE-T-MGZRRP`.
  describe('defaultInteractionResponse (슬래시 명령 3초 응답)', () => {
    const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
    const slash = (
      text: string,
      command = '/workflow',
    ): Record<string, unknown> => ({
      command,
      text,
      user_id: 'U1',
      channel_id: 'D1',
      team_id: 'T1',
      trigger_id: 'trg.001',
    });
    const ephemeral = (text: string) => ({
      body: { response_type: 'ephemeral', text },
    });
    const DEFAULT_HELP_KO = [
      '/workflow start - 새 대화 시작',
      '/workflow cancel - 진행 중인 대화 취소',
      '/workflow reply - 진행 중인 대화에 답장',
      '/workflow help - 도움말',
    ].join('\n');

    it.each(['help', '  help  ', 'help me'])(
      '"%s" 는 본인에게만 보이는 기본 도움말이다',
      (text) => {
        expect(
          adapter.defaultInteractionResponse(slash(text), SLACK_CONFIG),
        ).toEqual(ephemeral(DEFAULT_HELP_KO));
      },
    );

    it('기본 도움말은 요청에 담긴 명령 이름과 en locale 을 따른다', () => {
      expect(
        adapter.defaultInteractionResponse(slash('help', '/bot'), {
          ...SLACK_CONFIG,
          languageLocale: 'en',
        }),
      ).toEqual(
        ephemeral(
          [
            '/bot start - Start a new conversation',
            '/bot cancel - Cancel the active conversation',
            '/bot reply - Reply to the active conversation',
            '/bot help - Show help',
          ].join('\n'),
        ),
      );
    });

    it('languageHints.help 가 있으면 그 문구다', () => {
      expect(
        adapter.defaultInteractionResponse(slash('help'), {
          ...SLACK_CONFIG,
          languageHints: { help: '도움말 문구' },
        }),
      ).toEqual(ephemeral('도움말 문구'));
    });

    it('빈 languageHints.help 는 무시하고 기본 도움말을 쓴다', () => {
      expect(
        adapter.defaultInteractionResponse(slash('help'), {
          ...SLACK_CONFIG,
          languageHints: { help: '' },
        }),
      ).toEqual(ephemeral(DEFAULT_HELP_KO));
    });

    it('문구의 mrkdwn 제어 문자(& < >)는 escape 한다', () => {
      expect(
        adapter.defaultInteractionResponse(slash('help'), {
          ...SLACK_CONFIG,
          languageHints: { help: 'a & <b>' },
        }),
      ).toEqual(ephemeral('a &amp; &lt;b&gt;'));
    });

    it.each(['', 'start', 'cancel', 'reply hello', 'hi there', 'Help'])(
      '"%s" 는 본인에게만 보이는 수신 문구다',
      (text) => {
        expect(
          adapter.defaultInteractionResponse(slash(text), SLACK_CONFIG),
        ).toEqual(ephemeral('요청을 받았습니다.'));
      },
    );

    it('languageHints.commandReceived 와 en locale 을 따른다', () => {
      expect(
        adapter.defaultInteractionResponse(slash('start'), {
          ...SLACK_CONFIG,
          languageHints: { commandReceived: '접수했어요' },
        }),
      ).toEqual(ephemeral('접수했어요'));
      expect(
        adapter.defaultInteractionResponse(slash('cancel'), {
          ...SLACK_CONFIG,
          languageLocale: 'en',
        }),
      ).toEqual(ephemeral('Request received.'));
    });
  });

  describe('setupChannel — auth.test 결과를 botIdentity 로 캐시 (Phase 2)', () => {
    it('정상 — auth.test ok → configUpdates.botIdentity 채움', async () => {
      const client = makeClient();
      jest.spyOn(client, 'authTest').mockResolvedValue({
        ok: true,
        team_id: 'T123',
        user_id: 'U456',
        user: 'workflow_bot',
        bot_id: 'B789',
      });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      const result = await adapter.setupChannel(SLACK_CONFIG, 'https://x/hook');
      expect(result.configUpdates?.botIdentity).toMatchObject({
        username: 'workflow_bot',
        teamId: 'T123',
      });
      expect(typeof result.configUpdates?.botIdentity?.botId).toBe('number');
      // Slack 은 provider-issued — issuedInboundSigning 비움.
      expect(result.issuedInboundSigning).toBeUndefined();
    });

    it('botTokenRef 미설정 → throw', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      await expect(
        adapter.setupChannel({ provider: 'slack' }, 'https://x/hook'),
      ).rejects.toThrow(/botTokenRef/);
    });

    it('auth.test ok=false → throw', async () => {
      const client = makeClient();
      jest.spyOn(client, 'authTest').mockResolvedValue({
        ok: false,
        error: 'invalid_auth',
      });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      await expect(
        adapter.setupChannel(SLACK_CONFIG, 'https://x/hook'),
      ).rejects.toThrow(/invalid_auth/);
    });

    /**
     * §1.1.2 — 자격 증명 거부만 `code` 를 부착한다.
     *
     * Slack 은 이 거부를 **HTTP 200 + `{ok:false, error}`** 로 알리므로 호출자의 401/403
     * message fallback 이 **원리적으로** 못 잡던 자리다 — 이 PR 의 실질 동기.
     */
    const thrownFor = async (error: string): Promise<unknown> => {
      const client = makeClient();
      jest.spyOn(client, 'authTest').mockResolvedValue({ ok: false, error });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      return adapter
        .setupChannel(SLACK_CONFIG, 'https://x/hook')
        .then(() => null)
        .catch((err: unknown) => err);
    };

    it.each([
      'invalid_auth',
      'not_authed',
      'account_inactive',
      'token_revoked',
      'token_expired',
    ])('auth.test error=%s → code BOT_TOKEN_INVALID 부착', async (error) => {
      expect(await thrownFor(error)).toMatchObject({
        code: 'BOT_TOKEN_INVALID',
        message: expect.stringContaining(error),
      });
    });

    it('ratelimited 처럼 자격 증명과 무관한 실패는 code 미부착 (호출자가 502)', async () => {
      const err = await thrownFor('ratelimited');
      expect(err).toBeInstanceOf(Error);
      expect((err as { code?: unknown }).code).toBeUndefined();
    });

    it('user_id / bot_id 모두 없음 → throw', async () => {
      const client = makeClient();
      jest.spyOn(client, 'authTest').mockResolvedValue({ ok: true });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      await expect(
        adapter.setupChannel(SLACK_CONFIG, 'https://x/hook'),
      ).rejects.toThrow();
    });
  });

  describe('parseUpdate — parser 위임 + pure 계약', () => {
    it('Events API DM message → text_message', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      const upd = await adapter.parseUpdate(
        {
          type: 'event_callback',
          event_id: 'Ev1',
          event: {
            type: 'message',
            channel: 'D1',
            channel_type: 'im',
            user: 'U1',
            text: 'hi',
          },
        },
        SLACK_CONFIG,
      );
      expect(upd?.command).toEqual({ kind: 'text_message', text: 'hi' });
    });

    it('url_verification → null (caller 가 challenge 응답)', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      const upd = await adapter.parseUpdate(
        { type: 'url_verification', challenge: 'x' },
        SLACK_CONFIG,
      );
      expect(upd).toBeNull();
    });
  });

  describe('renderNode (Phase 3) — renderer 위임', () => {
    it('ai_message → text ChannelMessage', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      const msgs = await adapter.renderNode(
        {
          type: 'execution.ai_message',
          executionId: 'e',
          triggerId: 't',
          workflowId: 'w',
          seq: 1,
          timestamp: '2026-05-24T00:00:00Z',
          message: 'hi',
          turnCount: 1,
        },
        SLACK_CONFIG,
      );
      expect(msgs[0].body).toEqual({ kind: 'text', text: 'hi' });
    });
  });

  describe('sendMessage (Phase 3)', () => {
    it('text → chat.postMessage 호출', async () => {
      const client = makeClient();
      const spy = jest
        .spyOn(client, 'chatPostMessage')
        .mockResolvedValue({ ok: true, channel: 'D1', ts: '123.456' });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      const result = await adapter.sendMessage(
        { conversationKey: 'D1', body: { kind: 'text', text: 'hi' } },
        SLACK_CONFIG,
      );
      expect(spy).toHaveBeenCalledWith(
        'xoxb-test-token',
        expect.objectContaining({ channel: 'D1', text: 'hi' }),
      );
      expect(result.externalMsgId).toBe('123.456');
    });

    it('buttons → Block Kit actions 포함', async () => {
      const client = makeClient();
      const spy = jest
        .spyOn(client, 'chatPostMessage')
        .mockResolvedValue({ ok: true, channel: 'D1', ts: '1.2' });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      await adapter.sendMessage(
        {
          conversationKey: 'D1',
          body: {
            kind: 'buttons',
            text: '선택?',
            buttons: [
              { id: 'b1', label: 'OK', type: 'callback', style: 'primary' },
            ],
          },
        },
        SLACK_CONFIG,
      );
      const call = spy.mock.calls[0][1];
      expect(call.text).toBe('선택?');
      expect(Array.isArray(call.blocks)).toBe(true);
    });

    it('typing → no-op (R-S-5, Slack Web API 미지원)', async () => {
      const client = makeClient();
      const spy = jest.spyOn(client, 'chatPostMessage');
      const adapter = new SlackAdapter(client, makeSecretsMock());
      const result = await adapter.sendMessage(
        { conversationKey: 'D1', body: { kind: 'typing' } },
        SLACK_CONFIG,
      );
      expect(spy).not.toHaveBeenCalled();
      expect(result.externalMsgId).toBe('');
    });

    it('chat.postMessage ok=false → throw', async () => {
      const client = makeClient();
      jest
        .spyOn(client, 'chatPostMessage')
        .mockResolvedValue({ ok: false, error: 'channel_not_found' });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      await expect(
        adapter.sendMessage(
          { conversationKey: 'D1', body: { kind: 'text', text: 'hi' } },
          SLACK_CONFIG,
        ),
      ).rejects.toThrow(/channel_not_found/);
    });

    it('conversationKey 누락 → throw', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      await expect(
        adapter.sendMessage(
          { conversationKey: '', body: { kind: 'text', text: 'hi' } },
          SLACK_CONFIG,
        ),
      ).rejects.toThrow(/conversationKey/);
    });

    it('form_modal → __open_form__ 버튼 actions block', async () => {
      const client = makeClient();
      const spy = jest
        .spyOn(client, 'chatPostMessage')
        .mockResolvedValue({ ok: true, channel: 'D1', ts: '9.9' });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      await adapter.sendMessage(
        {
          conversationKey: 'D1',
          body: {
            kind: 'form_modal',
            openLabel: '양식 작성하기',
            formConfig: {},
          },
        },
        SLACK_CONFIG,
      );
      const call = spy.mock.calls[0][1];
      expect(call.text).toBe('양식 작성하기');
      const block = (call.blocks as Array<Record<string, unknown>>)[0];
      const el = (block.elements as Array<Record<string, unknown>>)[0];
      expect(el.action_id).toBe('__open_form__');
    });
  });

  describe('§4.1 openFormModal', () => {
    it('views.open 호출 — view blocks block_id = field name + private_metadata=conversationKey', async () => {
      const client = makeClient();
      const spy = jest
        .spyOn(client, 'viewsOpen')
        .mockResolvedValue({ ok: true });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      const result = await adapter.openFormModal({
        config: SLACK_CONFIG,
        openContext: { triggerId: 'trg.x' },
        fields: [
          { name: 'email', label: 'Email', type: 'email', required: true },
          {
            name: 'role',
            label: 'Role',
            type: 'select',
            options: [{ label: 'Admin', value: 'admin' }],
          },
        ],
        conversationKey: 'D1',
        nodeId: 'node-1',
      });
      expect(result.httpResponse).toBeUndefined();
      const [token, payload] = spy.mock.calls[0];
      expect(token).toBe('xoxb-test-token');
      expect(payload.trigger_id).toBe('trg.x');
      const view = payload.view as {
        callback_id: string;
        private_metadata: string;
        blocks: Array<{ block_id: string }>;
      };
      expect(view.callback_id).toBe('clemvion_form');
      expect(view.private_metadata).toBe('D1');
      expect(view.blocks.map((b) => b.block_id)).toEqual(['email', 'role']);
    });
  });

  describe('§4.1 buildFormSubmissionResponse', () => {
    it('validationError → response_action errors (block_id 키)', () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      const r = adapter.buildFormSubmissionResponse({
        config: SLACK_CONFIG,
        validationError: { field: 'email', message: '형식 오류' },
      });
      expect(r.httpResponse).toEqual({
        response_action: 'errors',
        errors: { email: '형식 오류' },
      });
    });

    it('성공 (validationError 없음) → 빈 body', () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      const r = adapter.buildFormSubmissionResponse({ config: SLACK_CONFIG });
      expect(r.httpResponse).toBeUndefined();
    });
  });

  // C-12 §4.1 / R-S-7: file_shared → files.info 보강.
  describe('enrichInbound (file_upload → files.info)', () => {
    it('file_upload → mimeType/filename/urlPrivate 보강', async () => {
      const client = makeClient();
      jest.spyOn(client, 'filesInfo').mockResolvedValue({
        ok: true,
        file: {
          id: 'F1',
          name: 'photo.png',
          mimetype: 'image/png',
          url_private: 'https://files.slack.com/F1/photo.png',
        },
      });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      const enriched = await adapter.enrichInbound(
        {
          conversationKey: 'C1',
          channelUserKey: 'U1',
          command: {
            kind: 'file_upload',
            fileId: 'F1',
            mimeType: 'application/octet-stream',
          },
          idempotencyKey: 'e1',
          receivedAt: '2026-06-03T00:00:00Z',
        },
        SLACK_CONFIG,
      );
      expect(enriched.command).toEqual({
        kind: 'file_upload',
        fileId: 'F1',
        mimeType: 'image/png',
        filename: 'photo.png',
        urlPrivate: 'https://files.slack.com/F1/photo.png',
      });
    });

    it('file_upload 외 command 는 그대로 반환 (files.info 미호출)', async () => {
      const client = makeClient();
      const spy = jest.spyOn(client, 'filesInfo');
      const adapter = new SlackAdapter(client, makeSecretsMock());
      const update = {
        conversationKey: 'C1',
        channelUserKey: 'U1',
        command: { kind: 'text_message' as const, text: 'hi' },
        idempotencyKey: 'e2',
        receivedAt: '2026-06-03T00:00:00Z',
      };
      const out = await adapter.enrichInbound(update, SLACK_CONFIG);
      expect(out).toBe(update);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // C-12 §4.2: button_callback + response_url → replace_original POST.
  describe('ackInteraction (response_url 비동기 갱신)', () => {
    it('responseUrl 있으면 replace_original POST', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      await adapter.ackInteraction(
        {
          conversationKey: 'C1',
          channelUserKey: 'U1',
          command: {
            kind: 'button_callback',
            callbackData: 'b1',
            callbackQueryId: '',
          },
          idempotencyKey: 'k',
          receivedAt: '2026-06-03T00:00:00Z',
          responseUrl: 'https://hooks.slack.com/actions/resp',
        },
        SLACK_CONFIG,
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://hooks.slack.com/actions/resp',
        expect.objectContaining({ method: 'POST' }),
      );
      const body = JSON.parse(
        (fetchSpy.mock.calls[0][1] as { body: string }).body,
      );
      expect(body.replace_original).toBe(true);
      fetchSpy.mockRestore();
    });

    it('responseUrl 없으면 noop (fetch 미호출)', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      await adapter.ackInteraction(
        {
          conversationKey: 'C1',
          channelUserKey: 'U1',
          command: {
            kind: 'button_callback',
            callbackData: 'b1',
            callbackQueryId: '',
          },
          idempotencyKey: 'k',
          receivedAt: '2026-06-03T00:00:00Z',
        },
        SLACK_CONFIG,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  // C-12 §5.4: image → files.uploadV2 (실패 시 text fallback).
  describe('sendMessage(image) → files.uploadV2', () => {
    it('image bytes → filesUploadV2 호출', async () => {
      const client = makeClient();
      const uploadSpy = jest
        .spyOn(client, 'filesUploadV2')
        .mockResolvedValue({ ok: true });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      await adapter.sendMessage(
        {
          conversationKey: 'C1',
          body: {
            kind: 'image',
            bytes: Buffer.from('PNGDATA'),
            caption: 'chart',
            fallbackText: 'chart fallback',
          },
        },
        SLACK_CONFIG,
      );
      expect(uploadSpy).toHaveBeenCalledWith(
        'xoxb-test-token',
        expect.objectContaining({ channel_id: 'C1', initial_comment: 'chart' }),
      );
    });

    it('filesUploadV2 실패 → chat.postMessage text fallback', async () => {
      const client = makeClient();
      jest
        .spyOn(client, 'filesUploadV2')
        .mockResolvedValue({ ok: false, error: 'upload_failed' });
      const postSpy = jest
        .spyOn(client, 'chatPostMessage')
        .mockResolvedValue({ ok: true, channel: 'C1', ts: '1.1' });
      const adapter = new SlackAdapter(client, makeSecretsMock());
      await adapter.sendMessage(
        {
          conversationKey: 'C1',
          body: {
            kind: 'image',
            bytes: Buffer.from('PNGDATA'),
            fallbackText: 'chart fallback',
          },
        },
        SLACK_CONFIG,
      );
      expect(postSpy).toHaveBeenCalledWith(
        'xoxb-test-token',
        expect.objectContaining({ channel: 'C1', text: 'chart fallback' }),
      );
    });
  });
});
