import {
  decideNotificationSigning,
  newNotificationSigningSecret,
  notificationWithSigningRef,
  signingWithRef,
} from './notification-signing-secret';

// 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체), [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)
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

describe('newNotificationSigningSecret', () => {
  it('wsk_ 와 64자리 hex 다', () => {
    expect(newNotificationSigningSecret()).toMatch(/^wsk_[a-f0-9]{64}$/);
    expect(newNotificationSigningSecret()).not.toBe(
      newNotificationSigningSecret(),
    );
  });
});

const REF = 'secret://triggers/t1/notification-signing';

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
