/**
 * SlackAdapter Phase 1 단위 테스트 — 6함수 stub 시그니처 + provider 식별자 + DI wiring.
 * 본 함수의 실제 동작 (parseUpdate / renderNode / sendMessage 등) 은 Phase 2/3 의 별 spec 에서 검증.
 */
import { SlackAdapter } from './slack.adapter';
import { SlackClient } from './slack-client';
import type { SecretResolverService } from '../../../secret-store/secret-resolver.service';
import type { ChatChannelConfig } from '../../types';

function makeSecretsMock(): jest.Mocked<SecretResolverService> {
  return {
    resolve: jest.fn(async () => 'xoxb-test-token'),
    store: jest.fn(),
    rotate: jest.fn(),
    delete: jest.fn(),
    deleteByPrefix: jest.fn(),
    exists: jest.fn(),
  } as unknown as jest.Mocked<SecretResolverService>;
}

const SLACK_CONFIG: ChatChannelConfig = {
  provider: 'slack',
  botTokenRef: 'secret://triggers/t1/bot-token',
  inboundSigningRef: 'secret://triggers/t1/inbound-signing',
};

describe('SlackAdapter (Phase 1 stub)', () => {
  let adapter: SlackAdapter;

  beforeEach(() => {
    adapter = new SlackAdapter(new SlackClient(), makeSecretsMock());
  });

  it('provider 식별자 = "slack"', () => {
    expect(adapter.provider).toBe('slack');
  });

  it('ChatChannelAdapter interface 6함수 모두 노출', () => {
    expect(typeof adapter.setupChannel).toBe('function');
    expect(typeof adapter.teardownChannel).toBe('function');
    expect(typeof adapter.parseUpdate).toBe('function');
    expect(typeof adapter.renderNode).toBe('function');
    expect(typeof adapter.sendMessage).toBe('function');
    expect(typeof adapter.ackInteraction).toBe('function');
  });

  it('teardownChannel — no-op (Spec §3.2, R-S-2 — Slack 앱 manifest 는 우리가 revoke 못 함)', async () => {
    await expect(
      adapter.teardownChannel(SLACK_CONFIG),
    ).resolves.toBeUndefined();
  });

  it('ackInteraction — no-op (3초 ack 는 HooksController 의 HTTP response 책임)', async () => {
    await expect(
      adapter.ackInteraction(
        {
          conversationKey: 'C123',
          channelUserKey: 'U123',
          command: {
            kind: 'button_callback',
            callbackData: 'btn-1',
            callbackQueryId: '',
          },
          idempotencyKey: 'evt-1',
          receivedAt: '2026-05-24T00:00:00Z',
        },
        SLACK_CONFIG,
      ),
    ).resolves.toBeUndefined();
  });

  describe('Phase 2/3 placeholder — 호출 시 명시적 에러', () => {
    it('setupChannel — Phase 2 미구현 에러', async () => {
      await expect(
        adapter.setupChannel(SLACK_CONFIG, 'https://example.com/hook'),
      ).rejects.toThrow(/Phase 2/);
    });

    it('parseUpdate — Phase 2 미구현 에러', async () => {
      await expect(adapter.parseUpdate({}, SLACK_CONFIG)).rejects.toThrow(
        /Phase 2/,
      );
    });

    it('renderNode — Phase 3 미구현 에러', async () => {
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

    it('sendMessage — Phase 3 미구현 에러', async () => {
      await expect(
        adapter.sendMessage(
          {
            conversationKey: 'C123',
            body: { kind: 'text', text: 'hi' },
          },
          SLACK_CONFIG,
        ),
      ).rejects.toThrow(/Phase 3/);
    });
  });
});
