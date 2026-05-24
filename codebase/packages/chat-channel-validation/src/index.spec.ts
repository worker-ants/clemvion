import {
  SLACK_SIGNING_SECRET_REGEX,
  DISCORD_PUBLIC_KEY_REGEX,
  isValidSlackSigningSecret,
  isValidDiscordPublicKey,
} from './index';

describe('SLACK_SIGNING_SECRET_REGEX (lowercase hex 32)', () => {
  it('valid — lowercase hex 32', () => {
    expect(
      SLACK_SIGNING_SECRET_REGEX.test('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'),
    ).toBe(true);
  });

  it('invalid — uppercase hex (외부 Slack HMAC 검증 실패 회피)', () => {
    expect(
      SLACK_SIGNING_SECRET_REGEX.test('A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6'),
    ).toBe(false);
  });

  it('invalid — 너무 짧음 (31 chars)', () => {
    expect(
      SLACK_SIGNING_SECRET_REGEX.test('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d'),
    ).toBe(false);
  });

  it('invalid — 너무 김 (33 chars)', () => {
    expect(
      SLACK_SIGNING_SECRET_REGEX.test('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a'),
    ).toBe(false);
  });

  it('invalid — non-hex char 포함', () => {
    expect(
      SLACK_SIGNING_SECRET_REGEX.test('z1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'),
    ).toBe(false);
  });

  it('invalid — 빈 문자열', () => {
    expect(SLACK_SIGNING_SECRET_REGEX.test('')).toBe(false);
  });
});

describe('DISCORD_PUBLIC_KEY_REGEX (lowercase hex 64)', () => {
  it('valid — lowercase hex 64', () => {
    expect(
      DISCORD_PUBLIC_KEY_REGEX.test(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      ),
    ).toBe(true);
  });

  it('invalid — uppercase hex (외부 Discord ed25519 verify 실패 회피)', () => {
    expect(
      DISCORD_PUBLIC_KEY_REGEX.test(
        'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
      ),
    ).toBe(false);
  });

  it('invalid — 너무 짧음 (Slack hex32 입력)', () => {
    expect(
      DISCORD_PUBLIC_KEY_REGEX.test('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'),
    ).toBe(false);
  });

  it('invalid — 너무 김 (65 chars)', () => {
    expect(
      DISCORD_PUBLIC_KEY_REGEX.test(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789a',
      ),
    ).toBe(false);
  });

  it('invalid — non-hex char 포함', () => {
    expect(
      DISCORD_PUBLIC_KEY_REGEX.test(
        'zbcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      ),
    ).toBe(false);
  });

  it('invalid — 빈 문자열', () => {
    expect(DISCORD_PUBLIC_KEY_REGEX.test('')).toBe(false);
  });
});

describe('isValidSlackSigningSecret helper', () => {
  it('정규식 export 와 동일 결과', () => {
    expect(isValidSlackSigningSecret('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toBe(
      true,
    );
    expect(isValidSlackSigningSecret('invalid')).toBe(false);
  });
});

describe('isValidDiscordPublicKey helper', () => {
  it('정규식 export 와 동일 결과', () => {
    expect(
      isValidDiscordPublicKey(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      ),
    ).toBe(true);
    expect(isValidDiscordPublicKey('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toBe(
      false,
    );
  });
});
