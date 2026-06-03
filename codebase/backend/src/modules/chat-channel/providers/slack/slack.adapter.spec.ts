/**
 * SlackAdapter 단위 테스트 (Phase 2).
 * provider 식별자 + 6함수 wiring + setupChannel + parseUpdate (parser 위임 검증).
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

    it('ChatChannelAdapter 6함수 모두 노출', () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      expect(typeof adapter.setupChannel).toBe('function');
      expect(typeof adapter.teardownChannel).toBe('function');
      expect(typeof adapter.parseUpdate).toBe('function');
      expect(typeof adapter.renderNode).toBe('function');
      expect(typeof adapter.sendMessage).toBe('function');
      expect(typeof adapter.ackInteraction).toBe('function');
    });

    it('teardownChannel — no-op (R-S-2)', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      await expect(
        adapter.teardownChannel(SLACK_CONFIG),
      ).resolves.toBeUndefined();
    });

    it('ackInteraction — no-op (3초 ack 는 HooksController 책임)', async () => {
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
