/**
 * parseSlackUpdate / extractSlackChallenge 단위 테스트.
 *
 * Spec [providers/slack §4] — 3종 envelope 분기 + DM-only + bot 무시 + idempotencyKey.
 */
import { extractSlackChallenge, parseSlackUpdate } from './slack-update.parser';

function eventCallback(
  event: Record<string, unknown>,
  eventId = 'Ev0001',
): Record<string, unknown> {
  return { type: 'event_callback', event_id: eventId, event };
}

function interactivity(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return { payload: JSON.stringify(payload) };
}

function slashCommand(
  text: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    command: '/workflow',
    text,
    user_id: 'U1',
    channel_id: 'D1',
    team_id: 'T1',
    trigger_id: 'trg.001',
    ...extras,
  };
}

describe('parseSlackUpdate — Events API', () => {
  it('DM message → text_message', () => {
    const upd = parseSlackUpdate(
      eventCallback({
        type: 'message',
        channel: 'D123',
        channel_type: 'im',
        user: 'U123',
        text: 'hello',
      }),
    );
    expect(upd).toMatchObject({
      conversationKey: 'D123',
      channelUserKey: 'U123',
      command: { kind: 'text_message', text: 'hello' },
      idempotencyKey: 'Ev0001',
    });
  });

  it('DM file_shared → file_upload (mimeType placeholder, HooksService 가 files.info 보강)', () => {
    const upd = parseSlackUpdate(
      eventCallback({
        type: 'file_shared',
        channel: 'D123',
        user: 'U123',
        file_id: 'F999',
      }),
    );
    expect(upd?.command).toEqual({
      kind: 'file_upload',
      fileId: 'F999',
      mimeType: 'application/octet-stream',
    });
  });

  it('channel/group/mpim 의 message → null (caller 가 groupChatRefusal)', () => {
    for (const ct of ['channel', 'group', 'mpim']) {
      const upd = parseSlackUpdate(
        eventCallback({
          type: 'message',
          channel: 'C1',
          channel_type: ct,
          user: 'U1',
          text: 'hi',
        }),
      );
      expect(upd).toBeNull();
    }
  });

  it('bot_id 존재 시 → null', () => {
    const upd = parseSlackUpdate(
      eventCallback({
        type: 'message',
        channel_type: 'im',
        channel: 'D1',
        user: 'U1',
        text: 'hi',
        bot_id: 'B1',
      }),
    );
    expect(upd).toBeNull();
  });

  it('subtype = bot_message → null', () => {
    const upd = parseSlackUpdate(
      eventCallback({
        type: 'message',
        channel_type: 'im',
        channel: 'D1',
        user: 'U1',
        text: 'hi',
        subtype: 'bot_message',
      }),
    );
    expect(upd).toBeNull();
  });

  it('event_id 부재 → null (idempotencyKey 없음)', () => {
    const raw = {
      type: 'event_callback',
      event: {
        type: 'message',
        channel_type: 'im',
        channel: 'D1',
        user: 'U1',
        text: 'hi',
      },
    };
    expect(parseSlackUpdate(raw)).toBeNull();
  });

  it('url_verification → null (parser 차원). challenge 추출은 별 함수', () => {
    const raw = { type: 'url_verification', challenge: 'xyz123', token: 'tok' };
    expect(parseSlackUpdate(raw)).toBeNull();
    expect(extractSlackChallenge(raw)).toBe('xyz123');
  });

  it('app_mention 단독 event 는 v1 미처리 (DM 안의 mention 은 message 로 흡수)', () => {
    const upd = parseSlackUpdate(
      eventCallback({
        type: 'app_mention',
        channel: 'C1',
        user: 'U1',
        text: '<@bot> hi',
      }),
    );
    expect(upd).toBeNull();
  });
});

describe('parseSlackUpdate — Interactivity', () => {
  it('block_actions button click → button_callback (idempotencyKey = trigger_id)', () => {
    const upd = parseSlackUpdate(
      interactivity({
        type: 'block_actions',
        team: { id: 'T1' },
        user: { id: 'U1' },
        channel: { id: 'D1' },
        trigger_id: 'trg.x',
        actions: [{ action_id: 'a1', value: 'btn-123' }],
      }),
    );
    expect(upd).toMatchObject({
      conversationKey: 'D1',
      channelUserKey: 'U1',
      command: {
        kind: 'button_callback',
        callbackData: 'btn-123',
        callbackQueryId: '',
      },
      idempotencyKey: 'trg.x',
    });
  });

  it('static_select → button_callback (selected_option.value)', () => {
    const upd = parseSlackUpdate(
      interactivity({
        type: 'block_actions',
        team: { id: 'T1' },
        user: { id: 'U1' },
        channel: { id: 'D1' },
        trigger_id: 'trg.x',
        actions: [{ action_id: 'a1', selected_option: { value: 'opt-2' } }],
      }),
    );
    expect(upd?.command).toEqual({
      kind: 'button_callback',
      callbackData: 'opt-2',
      callbackQueryId: '',
    });
  });

  it('view_submission 등 v1 미처리 → null', () => {
    const upd = parseSlackUpdate(
      interactivity({
        type: 'view_submission',
        team: { id: 'T1' },
        user: { id: 'U1' },
        channel: { id: 'D1' },
        trigger_id: 'trg.x',
        view: { id: 'v1', state: { values: {} } },
      }),
    );
    expect(upd).toBeNull();
  });

  it('§4.1 block_actions __open_form__ → open_form_modal (openContext.triggerId)', () => {
    const upd = parseSlackUpdate(
      interactivity({
        type: 'block_actions',
        team: { id: 'T1' },
        user: { id: 'U1' },
        channel: { id: 'D1' },
        trigger_id: 'trg.open',
        actions: [{ action_id: '__open_form__' }],
      }),
    );
    expect(upd).toMatchObject({
      conversationKey: 'D1',
      channelUserKey: 'U1',
      command: {
        kind: 'open_form_modal',
        openContext: { triggerId: 'trg.open' },
      },
      idempotencyKey: 'trg.open',
    });
  });

  it('§4.1 view_submission callback_id=clemvion_form → form_submission (평탄화)', () => {
    const upd = parseSlackUpdate(
      interactivity({
        type: 'view_submission',
        team: { id: 'T1' },
        user: { id: 'U1' },
        trigger_id: 'trg.sub',
        view: {
          id: 'V1',
          callback_id: 'clemvion_form',
          private_metadata: 'D1',
          state: {
            values: {
              name: { v: { type: 'plain_text_input', value: 'Alice' } },
              role: {
                v: {
                  type: 'static_select',
                  selected_option: { value: 'admin' },
                },
              },
              when: { v: { type: 'datepicker', selected_date: '2026-05-28' } },
            },
          },
        },
      }),
    );
    expect(upd).toMatchObject({
      conversationKey: 'D1',
      channelUserKey: 'U1',
      command: {
        kind: 'form_submission',
        fields: { name: 'Alice', role: 'admin', when: '2026-05-28' },
      },
      idempotencyKey: 'V1',
    });
  });

  it('§4.1 view_submission checkboxes → comma-joined value', () => {
    const upd = parseSlackUpdate(
      interactivity({
        type: 'view_submission',
        user: { id: 'U1' },
        view: {
          id: 'V2',
          callback_id: 'clemvion_form',
          private_metadata: 'D9',
          state: {
            values: {
              opts: {
                v: {
                  type: 'checkboxes',
                  selected_options: [{ value: 'a' }, { value: 'b' }],
                },
              },
            },
          },
        },
      }),
    );
    expect(upd?.command).toEqual({
      kind: 'form_submission',
      fields: { opts: 'a,b' },
    });
  });

  it('payload 가 잘못된 JSON → null', () => {
    expect(parseSlackUpdate({ payload: 'not json' })).toBeNull();
  });

  it('trigger_id 부재 → null', () => {
    const upd = parseSlackUpdate(
      interactivity({
        type: 'block_actions',
        user: { id: 'U1' },
        channel: { id: 'D1' },
        actions: [{ action_id: 'a', value: 'x' }],
      }),
    );
    expect(upd).toBeNull();
  });
});

describe('parseSlackUpdate — Slash Commands', () => {
  it('빈 text → start', () => {
    expect(parseSlackUpdate(slashCommand(''))).toMatchObject({
      command: { kind: 'start' },
      conversationKey: 'D1',
      channelUserKey: 'U1',
      idempotencyKey: 'trg.001',
    });
  });

  it('"start" → start', () => {
    expect(parseSlackUpdate(slashCommand('start'))?.command).toEqual({
      kind: 'start',
    });
  });

  it('"cancel" → cancel', () => {
    expect(parseSlackUpdate(slashCommand('cancel'))?.command).toEqual({
      kind: 'cancel',
    });
  });

  it('"reply hello" → text_message (text = "hello")', () => {
    expect(
      parseSlackUpdate(slashCommand('reply hello world'))?.command,
    ).toEqual({
      kind: 'text_message',
      text: 'hello world',
    });
  });

  it('"reply" 만 (rest 없음) → null (empty message)', () => {
    expect(parseSlackUpdate(slashCommand('reply'))).toBeNull();
  });

  it('일반 text (sub-command 아님) → text_message (전체)', () => {
    expect(parseSlackUpdate(slashCommand('hi how are you'))?.command).toEqual({
      kind: 'text_message',
      text: 'hi how are you',
    });
  });

  it('trigger_id 부재 → null', () => {
    const upd = parseSlackUpdate(
      slashCommand('start', { trigger_id: undefined }),
    );
    expect(upd).toBeNull();
  });
});

describe('parseSlackUpdate — 기타', () => {
  it('null / non-object → null', () => {
    expect(parseSlackUpdate(null)).toBeNull();
    expect(parseSlackUpdate(undefined)).toBeNull();
    expect(parseSlackUpdate('string')).toBeNull();
    expect(parseSlackUpdate(123)).toBeNull();
  });

  it('미지원 envelope → null', () => {
    expect(parseSlackUpdate({ unknown: 'shape' })).toBeNull();
  });
});

describe('extractSlackChallenge', () => {
  it('url_verification + challenge string → challenge 반환', () => {
    expect(
      extractSlackChallenge({ type: 'url_verification', challenge: 'abc' }),
    ).toBe('abc');
  });

  it('다른 type → null', () => {
    expect(
      extractSlackChallenge({ type: 'event_callback', challenge: 'abc' }),
    ).toBeNull();
  });

  it('challenge 부재 → null', () => {
    expect(extractSlackChallenge({ type: 'url_verification' })).toBeNull();
  });

  it('null / non-object → null', () => {
    expect(extractSlackChallenge(null)).toBeNull();
    expect(extractSlackChallenge('x')).toBeNull();
  });
});
