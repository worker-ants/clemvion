import { BadRequestException } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';

import { CHAT_CHANNEL_BLOCKED_FIELDS } from './chat-channel-rejection-messages.const';
import { CreateTriggerDto } from './dto/create-trigger.dto';
import { UpdateTriggerDto } from './dto/update-trigger.dto';
import {
  assertConfigCarriesNoInternalFields,
  assertRawConfigAccepted,
  CONFIG_INTERNAL_FIELDS,
  RAW_CONFIG_TYPED_KEYS,
} from './trigger-config-internal-fields';

function rejection(
  config: unknown,
  assert: (config: unknown) => void = assertConfigCarriesNoInternalFields,
): Record<string, unknown> | null {
  try {
    assert(config);
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

  it('대상은 타입 필드의 차단 다섯 필드와 notification.signing.secretRef · interaction.triggerToken 이다', () => {
    expect(CONFIG_INTERNAL_FIELDS.map((f) => f.path.join('.'))).toEqual([
      ...CHAT_CHANNEL_BLOCKED_FIELDS.map((f) => `chatChannel.${f}`),
      'notification.signing.secretRef',
      'interaction.triggerToken',
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
    // 트리거 단위 토큰은 서버가 만든다. 원시 config 로 심으면 그 값이 가드를 통과하는 토큰이 된다(NERV Task `CLE-T-EQDYC1`).
    [
      'config.interaction.triggerToken',
      {
        interaction: {
          enabled: true,
          tokenStrategy: 'per_trigger',
          triggerToken: 'itk_planted',
        },
      },
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

  it('트리거 단위 토큰 거부 메시지는 재발급 경로를 안내하고 받은 값을 싣지 않는다', () => {
    const res = rejection({ interaction: { triggerToken: 'itk_planted' } });
    expect(res?.message).toContain('/interaction/revoke-token');
    expect(JSON.stringify(res)).not.toContain('itk_planted');
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
    [
      '토큰 없는 per_trigger 인터랙션',
      { interaction: { enabled: true, tokenStrategy: 'per_trigger' } },
    ],
  ])('%s 는 통과한다', (_label, config) => {
    expect(rejection(config)).toBeNull();
  });
});

// 근거: [트리거 관리 「PATCH 본문 계약」](CLE-TRIG-MANAGE#patch-본문-계약). 결정은 NERV Task `CLE-T-EA7B5M`.
describe('assertRawConfigAccepted', () => {
  const REF = 'secret://triggers/other-trigger/bot-token';
  const rawRejection = (config: unknown) =>
    rejection(config, assertRawConfigAccepted);

  it('타입 키는 notification · interaction · chatChannel 셋이다', () => {
    expect([...RAW_CONFIG_TYPED_KEYS]).toEqual([
      'notification',
      'interaction',
      'chatChannel',
    ]);
  });

  it.each([
    ['notification', { url: 'https://hooks.example.com/x' }],
    ['interaction', { enabled: true, tokenStrategy: 'per_trigger' }],
    ['chatChannel', { provider: 'telegram' }],
  ])('원시 config 의 %s 키는 값이 있어도 거부한다', (key, value) => {
    expect(rawRejection({ [key]: value })).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { field: `config.${key}`, code: 'INVALID_FIELD' },
    });
  });

  it.each([
    ['null', null],
    ['빈 객체', {}],
    ['문자열', 'telegram'],
  ])('타입 키의 값이 %s 여도 거부한다', (_label, value) => {
    expect(rawRejection({ chatChannel: value })).toMatchObject({
      details: { field: 'config.chatChannel', code: 'INVALID_FIELD' },
    });
  });

  it('타입 키 거부 메시지는 최상위 키로 보내라고 안내하고 받은 값을 싣지 않는다', () => {
    const res = rawRejection({
      notification: { url: 'https://hooks.example.com/planted' },
    });
    expect(res?.message).toContain('config.notification');
    expect(JSON.stringify(res)).not.toContain('hooks.example.com/planted');
  });

  it('내부 필드 거부가 먼저 돌아 기존 경로를 그대로 보고한다', () => {
    expect(
      rawRejection({ chatChannel: { provider: 'telegram', botTokenRef: REF } }),
    ).toMatchObject({
      details: { field: 'config.chatChannel.botTokenRef' },
    });
  });

  it.each([
    ['최상위 값', { ref: REF }, 'config.ref'],
    [
      '중첩 객체',
      { custom: { nested: { ref: REF } } },
      'config.custom.nested.ref',
    ],
    [
      '배열 원소',
      { custom: { refs: ['plain', REF] } },
      'config.custom.refs[1]',
    ],
    ['배열 안 객체', { list: [{ a: 1 }, { ref: REF }] }, 'config.list[1].ref'],
    ['배열 안 배열', { grid: [['x'], ['y', REF]] }, 'config.grid[1][1]'],
    [
      '내부 필드 목록에 없는 이름',
      { custom: { botTokenRef: REF } },
      'config.custom.botTokenRef',
    ],
    ['접두만 있는 값', { custom: { ref: 'secret://' } }, 'config.custom.ref'],
  ])(
    'secret:// 로 시작하는 문자열 값은 위치와 상관없이 거부한다: %s',
    (_label, config, field) => {
      expect(rawRejection(config)).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { field, code: 'INVALID_FIELD' },
      });
    },
  );

  it('secret:// 값이 여럿이면 키 순서대로 깊이 우선으로 처음 만난 값을 보고한다', () => {
    expect(
      rawRejection({ a: { b: [{ c: REF }] }, d: REF, e: { f: REF } }),
    ).toMatchObject({ details: { field: 'config.a.b[0].c' } });
  });

  it('타입 키 거부가 secret:// 값 거부보다 먼저다', () => {
    expect(
      rawRejection({ custom: { ref: REF }, interaction: { enabled: false } }),
    ).toMatchObject({ details: { field: 'config.interaction' } });
  });

  it('secret:// 거부 메시지는 받은 값을 싣지 않는다', () => {
    const res = rawRejection({ custom: { ref: REF } });
    expect(res?.message).toContain('config.custom.ref');
    expect(JSON.stringify(res)).not.toContain(REF);
  });

  it('아주 깊이 중첩된 값도 스택을 넘치지 않고 끝까지 본다', () => {
    let deep: unknown = REF;
    for (let i = 0; i < 20_000; i += 1) deep = { n: deep };
    const res = rawRejection({ deep });
    expect(res).toMatchObject({ details: { code: 'INVALID_FIELD' } });
    expect((res?.details as { field: string }).field).toMatch(
      /^config\.deep(\.n)+$/,
    );
  });

  it.each([
    ['config 없음', undefined],
    ['config 가 null', null],
    ['빈 config', {}],
    ['평범한 사용자 키', { custom: { note: 'raw' }, tags: ['a', 'b'], n: 1 }],
    [
      'secret:// 가 중간에 있는 문자열',
      { note: 'see secret://triggers/x/bot-token' },
    ],
    ['키 이름만 secret://', { 'secret://triggers/x/bot-token': 'value' }],
    ['숫자 · 불리언 · null 값', { a: 0, b: false, c: null }],
  ])('%s 는 통과한다', (_label, config) => {
    expect(rawRejection(config)).toBeNull();
  });
});

// 같은 사실(요청 본문 최상위의 타입 필드 = `@ValidateNested` 로 검증하는 필드)이 DTO 와 `RAW_CONFIG_TYPED_KEYS` 에 따로
// 적혀 있다. 한쪽만 늘면 원시 `config` 우회가 다시 열리므로 DTO 의 중첩 검증 메타데이터와 목록을 대조한다.
describe('RAW_CONFIG_TYPED_KEYS 와 트리거 DTO 의 타입 필드', () => {
  function nestedValidatedFields(dto: new () => object): string[] {
    return getMetadataStorage()
      .getTargetValidationMetadatas(dto, '', true, false)
      .filter((metadata) => metadata.type === 'nestedValidation')
      .map((metadata) => metadata.propertyName)
      .sort();
  }

  it.each([
    ['CreateTriggerDto', CreateTriggerDto],
    ['UpdateTriggerDto', UpdateTriggerDto],
  ])('%s 의 중첩 검증 필드가 목록과 같다', (_name, dto) => {
    expect(nestedValidatedFields(dto)).toEqual(
      [...RAW_CONFIG_TYPED_KEYS].sort(),
    );
  });
});
