/**
 * DiscordAdapter 단위 테스트 — provider 식별자 + 6함수 wiring + setupChannel + parseUpdate
 * + sendMessage 핵심 분기.
 */
import { DiscordAdapter } from './discord.adapter';
import { DiscordClient } from './discord-client';
import type { SecretResolverService } from '../../../secret-store/secret-resolver.service';
import type { ChatChannelConfig } from '../../types';

function makeSecretsMock(): jest.Mocked<SecretResolverService> {
  return {
    resolve: jest.fn(async () => 'bot-token-discord'),
    store: jest.fn(),
    rotate: jest.fn(),
    delete: jest.fn(),
    deleteByPrefix: jest.fn(),
    exists: jest.fn(),
  } as unknown as jest.Mocked<SecretResolverService>;
}

const DISCORD_CONFIG: ChatChannelConfig = {
  provider: 'discord',
  botTokenRef: 'secret://triggers/t1/bot-token',
  inboundSigningRef: 'secret://triggers/t1/inbound-signing',
};

describe('DiscordAdapter', () => {
  it('provider 식별자 = "discord"', () => {
    const adapter = new DiscordAdapter(new DiscordClient(), makeSecretsMock());
    expect(adapter.provider).toBe('discord');
  });

  it('6함수 모두 노출', () => {
    const adapter = new DiscordAdapter(new DiscordClient(), makeSecretsMock());
    expect(typeof adapter.setupChannel).toBe('function');
    expect(typeof adapter.teardownChannel).toBe('function');
    expect(typeof adapter.parseUpdate).toBe('function');
    expect(typeof adapter.renderNode).toBe('function');
    expect(typeof adapter.sendMessage).toBe('function');
    expect(typeof adapter.ackInteraction).toBe('function');
  });

  describe('setupChannel', () => {
    it('정상 — getApplicationMe + putApplicationCommands → botIdentity 캐시 + issuedInboundSigning 비움', async () => {
      const client = new DiscordClient();
      const appSpy = jest.spyOn(client, 'getApplicationMe').mockResolvedValue({
        id: 'A123',
        name: 'workflow-bot',
        verify_key: 'pk',
      });
      const cmdSpy = jest
        .spyOn(client, 'putApplicationCommands')
        .mockResolvedValue([]);
      const adapter = new DiscordAdapter(client, makeSecretsMock());
      const result = await adapter.setupChannel(
        DISCORD_CONFIG,
        'https://x/hook',
      );
      expect(appSpy).toHaveBeenCalled();
      expect(cmdSpy).toHaveBeenCalledWith(
        'bot-token-discord',
        'A123',
        expect.any(Array),
      );
      expect(result.configUpdates?.botIdentity?.username).toBe('workflow-bot');
      expect(result.issuedInboundSigning).toBeUndefined();
    });

    it('getApplicationMe ok=false → throw', async () => {
      const client = new DiscordClient();
      jest
        .spyOn(client, 'getApplicationMe')
        .mockResolvedValue({ ok: false, code: 401, message: 'Unauthorized' });
      const adapter = new DiscordAdapter(client, makeSecretsMock());
      await expect(
        adapter.setupChannel(DISCORD_CONFIG, 'https://x'),
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  describe('parseUpdate — parser 위임', () => {
    it('PING (type=1) → null', async () => {
      const adapter = new DiscordAdapter(
        new DiscordClient(),
        makeSecretsMock(),
      );
      const upd = await adapter.parseUpdate(
        { id: 'I', type: 1, token: 't', version: 1, application_id: 'A' },
        DISCORD_CONFIG,
      );
      expect(upd).toBeNull();
    });

    it('APPLICATION_COMMAND start → start command', async () => {
      const adapter = new DiscordAdapter(
        new DiscordClient(),
        makeSecretsMock(),
      );
      const upd = await adapter.parseUpdate(
        {
          id: 'I001',
          application_id: 'A',
          type: 2,
          token: 't',
          version: 1,
          channel_id: 'C1',
          channel: { id: 'C1', type: 1 },
          user: { id: 'U1' },
          data: { name: 'workflow', options: [{ name: 'start', type: 1 }] },
        },
        DISCORD_CONFIG,
      );
      expect(upd?.command).toEqual({ kind: 'start' });
    });
  });

  describe('sendMessage', () => {
    it('text → postChannelMessage', async () => {
      const client = new DiscordClient();
      const spy = jest
        .spyOn(client, 'postChannelMessage')
        .mockResolvedValue({ id: 'M1', channel_id: 'C1' });
      const adapter = new DiscordAdapter(client, makeSecretsMock());
      const result = await adapter.sendMessage(
        { conversationKey: 'C1', body: { kind: 'text', text: 'hi' } },
        DISCORD_CONFIG,
      );
      expect(spy).toHaveBeenCalledWith(
        'bot-token-discord',
        'C1',
        expect.objectContaining({ content: 'hi' }),
      );
      expect(result.externalMsgId).toBe('M1');
    });

    it('typing → postChannelTyping (R-D-5 native)', async () => {
      const client = new DiscordClient();
      const spy = jest
        .spyOn(client, 'postChannelTyping')
        .mockResolvedValue({ ok: true });
      const adapter = new DiscordAdapter(client, makeSecretsMock());
      const result = await adapter.sendMessage(
        { conversationKey: 'C1', body: { kind: 'typing' } },
        DISCORD_CONFIG,
      );
      expect(spy).toHaveBeenCalledWith('bot-token-discord', 'C1');
      expect(result.externalMsgId).toBe('');
    });

    it('buttons → components (ACTION_ROW + BUTTON)', async () => {
      const client = new DiscordClient();
      const spy = jest
        .spyOn(client, 'postChannelMessage')
        .mockResolvedValue({ id: 'M2', channel_id: 'C1' });
      const adapter = new DiscordAdapter(client, makeSecretsMock());
      await adapter.sendMessage(
        {
          conversationKey: 'C1',
          body: {
            kind: 'buttons',
            text: '?',
            buttons: [
              { id: 'b1', label: 'OK', type: 'callback', style: 'primary' },
            ],
          },
        },
        DISCORD_CONFIG,
      );
      const call = spy.mock.calls[0][2];
      expect(Array.isArray(call.components)).toBe(true);
    });

    it('conversationKey 누락 → throw', async () => {
      const adapter = new DiscordAdapter(
        new DiscordClient(),
        makeSecretsMock(),
      );
      await expect(
        adapter.sendMessage(
          { conversationKey: '', body: { kind: 'text', text: 'x' } },
          DISCORD_CONFIG,
        ),
      ).rejects.toThrow(/conversationKey/);
    });
  });
});
