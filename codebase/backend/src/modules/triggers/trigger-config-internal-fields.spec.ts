import { BadRequestException } from '@nestjs/common';

import { CHAT_CHANNEL_BLOCKED_FIELDS } from './chat-channel-rejection-messages.const';
import {
  assertConfigCarriesNoInternalFields,
  CONFIG_INTERNAL_FIELDS,
} from './trigger-config-internal-fields';

function rejection(config: unknown): Record<string, unknown> | null {
  try {
    assertConfigCarriesNoInternalFields(config);
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return (err as BadRequestException).getResponse() as Record<
      string,
      unknown
    >;
  }
}

describe('assertConfigCarriesNoInternalFields', () => {
  const FOREIGN = 'secret://triggers/other-trigger/bot-token';

  it('대상은 타입 필드의 차단 다섯 필드와 notification.signing.secretRef 다', () => {
    expect(CONFIG_INTERNAL_FIELDS.map((f) => f.path.join('.'))).toEqual([
      ...CHAT_CHANNEL_BLOCKED_FIELDS.map((f) => `chatChannel.${f}`),
      'notification.signing.secretRef',
    ]);
  });

  it.each([
    [
      'config.chatChannel.botTokenRef',
      { chatChannel: { botTokenRef: FOREIGN } },
    ],
    [
      'config.chatChannel.inboundSigningRef',
      { chatChannel: { inboundSigningRef: FOREIGN } },
    ],
    [
      'config.chatChannel.inboundSigning',
      { chatChannel: { inboundSigning: 'issued' } },
    ],
    ['config.chatChannel.botToken', { chatChannel: { botToken: '111:plain' } }],
    [
      'config.chatChannel.inboundSigningPlaintext',
      { chatChannel: { inboundSigningPlaintext: 'a1b2' } },
    ],
    [
      'config.notification.signing.secretRef',
      { notification: { signing: { secretRef: FOREIGN } } },
    ],
  ])('%s 가 실리면 VALIDATION_ERROR · INVALID_FIELD', (field, config) => {
    expect(rejection(config)).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { field, code: 'INVALID_FIELD' },
    });
  });

  it.each([
    ['null', null],
    ['빈 문자열', ''],
    ['자기 트리거 형태의 참조', 'secret://triggers/self/bot-token'],
  ])('값이 %s 여도 키가 있으면 거부한다', (_label, value) => {
    expect(rejection({ chatChannel: { botTokenRef: value } })).not.toBeNull();
  });

  it('메시지는 필드 경로를 담고 받은 값을 되돌려 싣지 않는다', () => {
    const res = rejection({ chatChannel: { botTokenRef: FOREIGN } });
    expect(res?.message).toContain('config.chatChannel.botTokenRef');
    expect(JSON.stringify(res)).not.toContain(FOREIGN);
  });

  it('내부 필드가 여럿이면 목록 순서로 첫 필드를 보고한다', () => {
    expect(
      rejection({
        notification: { signing: { secretRef: FOREIGN } },
        chatChannel: { botToken: '111:plain', botTokenRef: FOREIGN },
      }),
    ).toMatchObject({ details: { field: 'config.chatChannel.botTokenRef' } });
  });

  it.each([
    ['config 없음', undefined],
    ['config 가 null', null],
    ['config 가 배열', [{ chatChannel: { botTokenRef: FOREIGN } }]],
    ['빈 config', {}],
    [
      '내부 필드가 없는 chatChannel',
      { chatChannel: { provider: 'telegram', uiMapping: {} } },
    ],
    [
      'signing 에 algorithm 만',
      { notification: { signing: { algorithm: 'hmac-sha256' } } },
    ],
    ['chatChannel 이 객체가 아님', { chatChannel: 'telegram' }],
    [
      'signing 이 배열',
      { notification: { signing: [{ secretRef: FOREIGN }] } },
    ],
    ['다른 키 아래의 같은 이름', { custom: { botTokenRef: FOREIGN } }],
  ])('%s 는 통과한다', (_label, config) => {
    expect(rejection(config)).toBeNull();
  });
});
