import {
  decideNotificationSigning,
  newNotificationSigningSecret,
  notificationWithSigningRef,
  readStoredSigningSecret,
  signingWithRef,
} from './notification-signing-secret';

// 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체), [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)
const REF = 'secret://triggers/t1/notification-signing';

describe('decideNotificationSigning', () => {
  it('secret:// 형식 참조가 있으면 다시 만든다', () => {
    expect(
      decideNotificationSigning({
        signing: { secretRef: 'secret://triggers/t1/notification-signing' },
      }),
    ).toEqual({ kind: 'rederive' });
  });

  it('참조가 있으면 옛 평문이 함께 있어도 다시 만든다(발송과 같은 우선순위)', () => {
    expect(
      decideNotificationSigning({
        signing: {
          secretRef: 'secret://triggers/t1/notification-signing',
          secret: 'legacy',
        },
      }),
    ).toEqual({ kind: 'rederive' });
  });

  it('참조가 없고 옛 평문이 있으면 옮긴다', () => {
    expect(
      decideNotificationSigning({ signing: { secret: 'legacy-plain' } }),
    ).toEqual({ kind: 'migrate', plaintext: 'legacy-plain' });
  });

  it('형식이 틀린 참조는 없는 것으로 본다', () => {
    expect(
      decideNotificationSigning({ signing: { secretRef: 'not-a-ref' } }),
    ).toEqual({ kind: 'issue' });
    expect(
      decideNotificationSigning({
        signing: { secretRef: 'not-a-ref', secret: 'legacy' },
      }),
    ).toEqual({ kind: 'migrate', plaintext: 'legacy' });
  });

  it('빈 문자열 평문은 없는 것으로 보고 발급한다', () => {
    expect(decideNotificationSigning({ signing: { secret: '' } })).toEqual({
      kind: 'issue',
    });
  });

  it('notification · signing 이 없거나 객체가 아니면 발급한다', () => {
    expect(decideNotificationSigning(undefined)).toEqual({ kind: 'issue' });
    expect(decideNotificationSigning({})).toEqual({ kind: 'issue' });
    expect(decideNotificationSigning({ signing: 'x' })).toEqual({
      kind: 'issue',
    });
    expect(decideNotificationSigning('x')).toEqual({ kind: 'issue' });
  });
});

// 판정과 발송 처리기(`NotificationWebhookProcessor.resolveSigningSecret`)가 이 함수 하나로 «있음» 을 읽는다
// (NERV Task `CLE-T-EQDYC1`). 둘이 갈리면 발송이 «없음» 으로 보는 행을 판정이 «있음» 으로 보고 발급하지 않는다.
describe('readStoredSigningSecret', () => {
  it.each([
    [
      'secret:// 형식 참조',
      { secretRef: REF },
      { kind: 'ref', secretRef: REF },
    ],
    [
      '참조와 옛 평문이 함께 있으면 참조가 앞선다',
      { secretRef: REF, secret: 'legacy' },
      { kind: 'ref', secretRef: REF },
    ],
    [
      '비어 있지 않은 옛 평문',
      { secret: 'legacy-plain' },
      { kind: 'legacy', plaintext: 'legacy-plain' },
    ],
    [
      '형식이 틀린 참조 옆의 옛 평문',
      { secretRef: 'not-a-ref', secret: 'legacy' },
      { kind: 'legacy', plaintext: 'legacy' },
    ],
    ['형식이 틀린 참조만', { secretRef: 'not-a-ref' }, { kind: 'none' }],
    ['빈 문자열 평문', { secret: '' }, { kind: 'none' }],
    ['문자열이 아닌 값', { secretRef: 1, secret: 2 }, { kind: 'none' }],
    ['빈 설정', {}, { kind: 'none' }],
    ['객체가 아닌 설정', 'x', { kind: 'none' }],
    ['없는 설정', undefined, { kind: 'none' }],
  ])('%s', (_label, signing, expected) => {
    expect(readStoredSigningSecret(signing)).toEqual(expected);
  });

  it('판정은 이 함수의 결과를 그대로 따른다', () => {
    const cases: unknown[] = [
      { secretRef: REF },
      { secret: 'legacy' },
      { secret: '' },
      { secretRef: 'not-a-ref' },
      undefined,
    ];
    for (const signing of cases) {
      const presence = readStoredSigningSecret(signing);
      const decision = decideNotificationSigning({ signing });
      expect(decision.kind).toBe(
        presence.kind === 'ref'
          ? 'rederive'
          : presence.kind === 'legacy'
            ? 'migrate'
            : 'issue',
      );
    }
  });
});

describe('newNotificationSigningSecret', () => {
  it('wsk_ 와 64자리 hex 다', () => {
    expect(newNotificationSigningSecret()).toMatch(/^wsk_[a-f0-9]{64}$/);
    expect(newNotificationSigningSecret()).not.toBe(
      newNotificationSigningSecret(),
    );
  });
});

describe('signingWithRef', () => {
  it('참조를 싣고 옛 평문 키를 뺀다', () => {
    expect(
      signingWithRef({ algorithm: 'hmac-sha256', secret: 'legacy' }, REF),
    ).toEqual({ algorithm: 'hmac-sha256', secretRef: REF });
  });

  it('저장된 다른 참조를 주어진 참조로 바꾼다(행의 값을 복사하지 않는다)', () => {
    expect(
      signingWithRef(
        { secretRef: 'secret://triggers/OTHER/notification-signing' },
        REF,
      ),
    ).toEqual({ secretRef: REF });
  });

  it('없음 · 문자열 · 배열은 빈 설정으로 본다', () => {
    expect(signingWithRef(undefined, REF)).toEqual({ secretRef: REF });
    expect(signingWithRef('abc', REF)).toEqual({ secretRef: REF });
    expect(signingWithRef(['x'], REF)).toEqual({ secretRef: REF });
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const input = { secret: 'legacy' };
    signingWithRef(input, REF);
    expect(input).toEqual({ secret: 'legacy' });
  });
});

describe('notificationWithSigningRef', () => {
  it('나머지 키는 그대로 두고 signing 만 바꾼다', () => {
    expect(
      notificationWithSigningRef(
        {
          url: 'https://x.example/cb',
          events: ['execution.completed'],
          signing: { algorithm: 'hmac-sha256', secret: 'legacy' },
        },
        REF,
      ),
    ).toEqual({
      url: 'https://x.example/cb',
      events: ['execution.completed'],
      signing: { algorithm: 'hmac-sha256', secretRef: REF },
    });
  });

  it('signing 이 없으면 만든다', () => {
    expect(
      notificationWithSigningRef({ url: 'https://x.example' }, REF),
    ).toEqual({
      url: 'https://x.example',
      signing: { secretRef: REF },
    });
  });

  it('notification 이 객체가 아니면 signing 만 가진 객체를 돌려준다', () => {
    expect(notificationWithSigningRef(null, REF)).toEqual({
      signing: { secretRef: REF },
    });
  });
});
