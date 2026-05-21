import { createHmac } from 'crypto';
import {
  verifyNotificationSignature,
  computeNotificationSignature,
} from './signature';

const SECRET = 'wsk_test';
const RAW = '{"x":1}';
const TS = 1_700_000_000;

describe('SDK signature', () => {
  it('computeNotificationSignature — node crypto 와 동일', () => {
    const expected = createHmac('sha256', SECRET)
      .update(`${TS}.${RAW}`)
      .digest('hex');
    expect(computeNotificationSignature('hmac-sha256', SECRET, TS, RAW)).toBe(
      expected,
    );
  });

  it('verifyNotificationSignature — valid', () => {
    const hex = createHmac('sha256', SECRET)
      .update(`${TS}.${RAW}`)
      .digest('hex');
    const header = `t=${TS},v1=${hex}`;
    expect(
      verifyNotificationSignature(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS,
      }),
    ).toEqual({ valid: true });
  });

  it('verifyNotificationSignature — mismatch', () => {
    const hex = createHmac('sha256', 'wrong')
      .update(`${TS}.${RAW}`)
      .digest('hex');
    const header = `t=${TS},v1=${hex}`;
    expect(
      verifyNotificationSignature(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS,
      }),
    ).toMatchObject({ valid: false, reason: 'mismatch' });
  });

  it('verifyNotificationSignature — timestamp window 초과', () => {
    const hex = createHmac('sha256', SECRET)
      .update(`${TS}.${RAW}`)
      .digest('hex');
    const header = `t=${TS},v1=${hex}`;
    expect(
      verifyNotificationSignature(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS + 1000,
      }),
    ).toMatchObject({ valid: false, reason: 'timestamp_outside_window' });
  });

  it('verifyNotificationSignature — malformed header', () => {
    expect(verifyNotificationSignature('', RAW, SECRET)).toMatchObject({
      valid: false,
      reason: 'malformed',
    });
    expect(verifyNotificationSignature(null, RAW, SECRET)).toMatchObject({
      valid: false,
      reason: 'malformed',
    });
    expect(verifyNotificationSignature('garbage', RAW, SECRET)).toMatchObject({
      valid: false,
      reason: 'malformed',
    });
  });

  it('verifyNotificationSignature — rotation (두 v1= 중 하나 매칭)', () => {
    const correct = createHmac('sha256', SECRET)
      .update(`${TS}.${RAW}`)
      .digest('hex');
    const rotated = createHmac('sha256', 'old')
      .update(`${TS}.${RAW}`)
      .digest('hex');
    const header = `t=${TS},v1=${rotated},v1=${correct}`;
    expect(
      verifyNotificationSignature(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS,
      }),
    ).toEqual({ valid: true });
  });

  describe('hex 입력 엄격 검증 [ai-review W14]', () => {
    it('invalid — v1= 에 non-hex 문자 포함', () => {
      const header = `t=${TS},v1=ZZZZ${'a'.repeat(60)}`; // Z 는 hex 아님
      expect(
        verifyNotificationSignature(header, RAW, SECRET, 'hmac-sha256', {
          nowSec: TS,
        }),
      ).toMatchObject({ valid: false, reason: 'malformed' });
    });

    it('invalid — v1= 홀수 길이 (`0x` 1바이트 미달)', () => {
      const header = `t=${TS},v1=abc`;
      expect(
        verifyNotificationSignature(header, RAW, SECRET, 'hmac-sha256', {
          nowSec: TS,
        }),
      ).toMatchObject({ valid: false, reason: 'malformed' });
    });

    it('valid — uppercase hex 도 허용', () => {
      const hex = createHmac('sha256', SECRET)
        .update(`${TS}.${RAW}`)
        .digest('hex')
        .toUpperCase();
      const header = `t=${TS},v1=${hex}`;
      expect(
        verifyNotificationSignature(header, RAW, SECRET, 'hmac-sha256', {
          nowSec: TS,
        }),
      ).toEqual({ valid: true });
    });
  });
});
