import { parseTelegramUpdate } from './telegram-update.parser';

describe('parseTelegramUpdate', () => {
  it('non-object → null', async () => {
    expect(parseTelegramUpdate(null)).toBeNull();
    expect(parseTelegramUpdate('foo')).toBeNull();
    expect(parseTelegramUpdate(42)).toBeNull();
  });

  it('update_id 가 number 가 아니면 → null', () => {
    expect(
      parseTelegramUpdate({ message: { chat: { id: 1, type: 'private' } } }),
    ).toBeNull();
  });

  it('text /start → command.kind=start', () => {
    const result = parseTelegramUpdate({
      update_id: 100,
      message: {
        chat: { id: 555, type: 'private' },
        from: { id: 999 },
        text: '/start',
      },
    });
    expect(result?.command).toEqual({ kind: 'start' });
    expect(result?.conversationKey).toBe('555');
    expect(result?.channelUserKey).toBe('999');
    expect(result?.idempotencyKey).toBe('100');
  });

  it('text /start <param> → command.kind=start', () => {
    const r = parseTelegramUpdate({
      update_id: 101,
      message: {
        chat: { id: 1, type: 'private' },
        from: { id: 2 },
        text: '/start hello',
      },
    });
    expect(r?.command.kind).toBe('start');
  });

  it('/cancel → command.kind=cancel', () => {
    const r = parseTelegramUpdate({
      update_id: 102,
      message: {
        chat: { id: 1, type: 'private' },
        from: { id: 2 },
        text: '/cancel',
      },
    });
    expect(r?.command.kind).toBe('cancel');
  });

  it('일반 텍스트 → text_message', () => {
    const r = parseTelegramUpdate({
      update_id: 103,
      message: {
        chat: { id: 1, type: 'private' },
        from: { id: 2 },
        text: 'hello world',
      },
    });
    expect(r?.command).toEqual({ kind: 'text_message', text: 'hello world' });
  });

  it('미지원 명령 → null', () => {
    expect(
      parseTelegramUpdate({
        update_id: 104,
        message: {
          chat: { id: 1, type: 'private' },
          from: { id: 2 },
          text: '/unknown',
        },
      }),
    ).toBeNull();
  });

  it('callback_query → button_callback', () => {
    const r = parseTelegramUpdate({
      update_id: 105,
      callback_query: {
        id: 'cbq-1',
        from: { id: 999 },
        message: { chat: { id: 555, type: 'private' } },
        data: 'btn-uuid-abc',
      },
    });
    expect(r?.command).toEqual({
      kind: 'button_callback',
      callbackData: 'btn-uuid-abc',
      callbackQueryId: 'cbq-1',
    });
  });

  it('group chat → null (CCH-CV-05)', () => {
    expect(
      parseTelegramUpdate({
        update_id: 106,
        message: {
          chat: { id: 1, type: 'group' },
          from: { id: 2 },
          text: 'hi',
        },
      }),
    ).toBeNull();
    expect(
      parseTelegramUpdate({
        update_id: 107,
        message: {
          chat: { id: 1, type: 'supergroup' },
          from: { id: 2 },
          text: 'hi',
        },
      }),
    ).toBeNull();
  });

  it('다른 봇 메시지 (is_bot=true) → null', () => {
    expect(
      parseTelegramUpdate({
        update_id: 108,
        message: {
          chat: { id: 1, type: 'private' },
          from: { id: 2, is_bot: true },
          text: 'hi',
        },
      }),
    ).toBeNull();
  });

  it('document → file_upload', () => {
    const r = parseTelegramUpdate({
      update_id: 109,
      message: {
        chat: { id: 1, type: 'private' },
        from: { id: 2 },
        document: { file_id: 'fid-1', mime_type: 'application/pdf' },
      },
    });
    expect(r?.command).toEqual({
      kind: 'file_upload',
      fileId: 'fid-1',
      mimeType: 'application/pdf',
    });
  });

  it('photo (배열) → 가장 큰 해상도 file_upload', () => {
    const r = parseTelegramUpdate({
      update_id: 110,
      message: {
        chat: { id: 1, type: 'private' },
        from: { id: 2 },
        photo: [{ file_id: 'small' }, { file_id: 'large' }],
      },
    });
    expect(r?.command).toEqual({
      kind: 'file_upload',
      fileId: 'large',
      mimeType: 'image/jpeg',
    });
  });

  it('contact → contact_share', () => {
    const r = parseTelegramUpdate({
      update_id: 111,
      message: {
        chat: { id: 1, type: 'private' },
        from: { id: 2 },
        contact: { phone_number: '+8210-0000-0000' },
      },
    });
    expect(r?.command).toEqual({
      kind: 'contact_share',
      phone: '+8210-0000-0000',
    });
  });

  it('callback_query 의 group chat → null', () => {
    expect(
      parseTelegramUpdate({
        update_id: 112,
        callback_query: {
          id: 'cbq',
          from: { id: 1 },
          message: { chat: { id: 2, type: 'group' } },
          data: 'd',
        },
      }),
    ).toBeNull();
  });
});
