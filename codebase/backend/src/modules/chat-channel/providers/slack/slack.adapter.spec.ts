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

  describe('renderNode / sendMessage — Phase 3 placeholder', () => {
    it('renderNode → Phase 3 미구현', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      await expect(
        adapter.renderNode(
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
        ),
      ).rejects.toThrow(/Phase 3/);
    });

    it('sendMessage → Phase 3 미구현', async () => {
      const adapter = new SlackAdapter(makeClient(), makeSecretsMock());
      await expect(
        adapter.sendMessage(
          { conversationKey: 'D1', body: { kind: 'text', text: 'hi' } },
          SLACK_CONFIG,
        ),
      ).rejects.toThrow(/Phase 3/);
    });
  });
});
