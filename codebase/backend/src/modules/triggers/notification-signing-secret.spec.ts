import {
  decideNotificationSigning,
  newNotificationSigningSecret,
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
