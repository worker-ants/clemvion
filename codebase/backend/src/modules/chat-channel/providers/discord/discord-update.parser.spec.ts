/**
 * parseDiscordUpdate / isDiscordPing 단위 테스트.
 */
import { isDiscordPing, parseDiscordUpdate } from './discord-update.parser';

function applicationCommand(opts: {
  sub?: string;
  text?: string;
  channelType?: number;
  bot?: boolean;
  id?: string;
}): unknown {
  return {
    id: opts.id ?? 'I001',
    application_id: 'A',
    type: 2,
    token: 't',
    version: 1,
    channel_id: 'C1',
    channel: { id: 'C1', type: opts.channelType ?? 1 },
    user: { id: 'U1', username: 'u', bot: opts.bot ?? false },
    data: opts.sub
      ? {
          name: 'workflow',
          options: [
            {
              name: opts.sub,
              type: 1,
              options: opts.text
                ? [{ name: 'message', value: opts.text }]
                : undefined,
            },
          ],
        }
      : undefined,
  };
}

function buttonClick(customId: string, channelType = 1): unknown {
  return {
    id: 'I002',
    application_id: 'A',
    type: 3,
    token: 't',
    version: 1,
    channel_id: 'C1',
    channel: { id: 'C1', type: channelType },
    user: { id: 'U1', username: 'u' },
    data: { component_type: 2, custom_id: customId },
  };
}

describe('parseDiscordUpdate — PING', () => {
  it('type=1 → null (caller 가 handshake 응답)', () => {
    expect(
      parseDiscordUpdate({
        id: 'I',
        type: 1,
        token: 't',
        version: 1,
        application_id: 'A',
      }),
    ).toBeNull();
  });

  it('isDiscordPing — type=1 → true', () => {
    expect(isDiscordPing({ type: 1 })).toBe(true);
    expect(isDiscordPing({ type: 2 })).toBe(false);
    expect(isDiscordPing(null)).toBe(false);
  });
});

describe('parseDiscordUpdate — APPLICATION_COMMAND', () => {
  it('sub=start → start', () => {
    const upd = parseDiscordUpdate(applicationCommand({ sub: 'start' }));
    expect(upd).toMatchObject({
      command: { kind: 'start' },
      conversationKey: 'C1',
      channelUserKey: 'U1',
      idempotencyKey: 'I001',
    });
  });

  it('sub=cancel → cancel', () => {
    expect(
      parseDiscordUpdate(applicationCommand({ sub: 'cancel' }))?.command,
    ).toEqual({
      kind: 'cancel',
    });
  });

  it('sub=reply text → text_message', () => {
    expect(
      parseDiscordUpdate(applicationCommand({ sub: 'reply', text: 'hello' }))
        ?.command,
    ).toEqual({ kind: 'text_message', text: 'hello' });
  });

  it('sub=reply 빈 text → null', () => {
    expect(parseDiscordUpdate(applicationCommand({ sub: 'reply' }))).toBeNull();
  });

  it('sub=help → null (caller 처리)', () => {
    expect(parseDiscordUpdate(applicationCommand({ sub: 'help' }))).toBeNull();
  });

  it('bot user → null', () => {
    expect(
      parseDiscordUpdate(applicationCommand({ sub: 'start', bot: true })),
    ).toBeNull();
  });

  it('guild channel (type=0) → null', () => {
    expect(
      parseDiscordUpdate(applicationCommand({ sub: 'start', channelType: 0 })),
    ).toBeNull();
  });
});

describe('parseDiscordUpdate — MESSAGE_COMPONENT', () => {
  it('BUTTON → button_callback (custom_id)', () => {
    expect(parseDiscordUpdate(buttonClick('btn-123'))?.command).toEqual({
      kind: 'button_callback',
      callbackData: 'btn-123',
      callbackQueryId: '',
    });
  });

  it('SELECT_MENU → button_callback (values[0])', () => {
    const upd = parseDiscordUpdate({
      id: 'I003',
      application_id: 'A',
      type: 3,
      token: 't',
      version: 1,
      channel_id: 'C1',
      channel: { id: 'C1', type: 1 },
      user: { id: 'U1' },
      data: { component_type: 3, values: ['opt-2'] },
    });
    expect(upd?.command).toEqual({
      kind: 'button_callback',
      callbackData: 'opt-2',
      callbackQueryId: '',
    });
  });

  it('guild channel button → null', () => {
    expect(parseDiscordUpdate(buttonClick('b', 0))).toBeNull();
  });

  it('§4.1 __open_form__ → open_form_modal (interactionId + interactionToken)', () => {
    const upd = parseDiscordUpdate(buttonClick('__open_form__'));
    expect(upd).toMatchObject({
      conversationKey: 'C1',
      channelUserKey: 'U1',
      command: {
        kind: 'open_form_modal',
        openContext: { interactionId: 'I002', interactionToken: 't' },
      },
      idempotencyKey: 'I002',
    });
  });

  // C-11 §5.1(b): "Reply" 버튼 → open_form_modal + openContext.modal='reply'.
  it('§5.1(b) __reply__ → open_form_modal (modal=reply 마커)', () => {
    const upd = parseDiscordUpdate(buttonClick('__reply__'));
    expect(upd).toMatchObject({
      conversationKey: 'C1',
      channelUserKey: 'U1',
      command: {
        kind: 'open_form_modal',
        openContext: {
          interactionId: 'I002',
          interactionToken: 't',
          modal: 'reply',
        },
      },
    });
  });
});

describe('parseDiscordUpdate — MODAL_SUBMIT', () => {
  it('TEXT_INPUT → text_message (concat values)', () => {
    const upd = parseDiscordUpdate({
      id: 'I004',
      application_id: 'A',
      type: 5,
      token: 't',
      version: 1,
      channel_id: 'C1',
      channel: { id: 'C1', type: 1 },
      user: { id: 'U1' },
      data: {
        custom_id: 'modal_reply',
        components: [
          {
            type: 1,
            components: [
              { type: 4, custom_id: 'reply_text', value: 'hello discord' },
            ],
          },
        ],
      },
    });
    expect(upd?.command).toEqual({
      kind: 'text_message',
      text: 'hello discord',
    });
  });

  it('빈 components → null', () => {
    expect(
      parseDiscordUpdate({
        id: 'I',
        application_id: 'A',
        type: 5,
        token: 't',
        version: 1,
        channel_id: 'C1',
        channel: { id: 'C1', type: 1 },
        user: { id: 'U1' },
        data: { components: [] },
      }),
    ).toBeNull();
  });

  it('§4.1 clemvion_form → form_submission (custom_id = field name 평탄화)', () => {
    const upd = parseDiscordUpdate({
      id: 'I005',
      application_id: 'A',
      type: 5,
      token: 't',
      version: 1,
      channel_id: 'C1',
      channel: { id: 'C1', type: 1 },
      user: { id: 'U1' },
      data: {
        custom_id: 'clemvion_form',
        components: [
          {
            type: 1,
            components: [{ type: 4, custom_id: 'name', value: 'Bob' }],
          },
          {
            type: 1,
            components: [{ type: 4, custom_id: 'email', value: 'b@x.io' }],
          },
        ],
      },
    });
    expect(upd?.command).toEqual({
      kind: 'form_submission',
      fields: { name: 'Bob', email: 'b@x.io' },
    });
  });

  it('§4.1 clemvion_reply → text_message (단일 TEXT_INPUT 값)', () => {
    const upd = parseDiscordUpdate({
      id: 'I006',
      application_id: 'A',
      type: 5,
      token: 't',
      version: 1,
      channel_id: 'C1',
      channel: { id: 'C1', type: 1 },
      user: { id: 'U1' },
      data: {
        custom_id: 'clemvion_reply',
        components: [
          {
            type: 1,
            components: [{ type: 4, custom_id: 'reply', value: 'hi there' }],
          },
        ],
      },
    });
    expect(upd?.command).toEqual({ kind: 'text_message', text: 'hi there' });
  });
});

describe('parseDiscordUpdate — 기타', () => {
  it('null / non-object → null', () => {
    expect(parseDiscordUpdate(null)).toBeNull();
    expect(parseDiscordUpdate('x')).toBeNull();
  });

  it('미지원 type (4=autocomplete) → null', () => {
    expect(
      parseDiscordUpdate({
        id: 'I',
        application_id: 'A',
        type: 4,
        token: 't',
        version: 1,
        channel_id: 'C1',
        channel: { id: 'C1', type: 1 },
        user: { id: 'U1' },
      }),
    ).toBeNull();
  });
});
