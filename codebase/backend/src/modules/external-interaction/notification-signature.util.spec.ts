import {
  buildSignatureHeader,
  buildSignedPayload,
  computeHmacSignature,
  verifySignatureHeader,
} from './notification-signature.util';
import { createHmac } from 'crypto';

const SECRET = 'wsk_test-secret-do-not-use-in-prod';
const RAW = '{"type":"execution.completed","executionId":"e-1"}';
const TS = 1_700_000_000; // 2023-11-14T22:13:20Z (테스트 기준 시간)

describe('notification-signature util', () => {
  it('buildSignedPayload — canonical "{ts}.{rawBody}"', () => {
    expect(buildSignedPayload(TS, RAW)).toBe(`${TS}.${RAW}`);
  });

  it('computeHmacSignature — Node crypto HMAC 와 일치', () => {
    const expected = createHmac('sha256', SECRET)
      .update(`${TS}.${RAW}`)
      .digest('hex');
    expect(computeHmacSignature('hmac-sha256', SECRET, TS, RAW)).toBe(expected);
  });

  it('computeHmacSignature — sha512 알고리즘 지원', () => {
    const expected = createHmac('sha512', SECRET)
      .update(`${TS}.${RAW}`)
      .digest('hex');
    expect(computeHmacSignature('hmac-sha512', SECRET, TS, RAW)).toBe(expected);
  });

  it('computeHmacSignature — 다른 secret 이면 결과 다름', () => {
    const a = computeHmacSignature('hmac-sha256', SECRET, TS, RAW);
    const b = computeHmacSignature('hmac-sha256', 'other-secret', TS, RAW);
    expect(a).not.toBe(b);
  });

  it('buildSignatureHeader — 단일 서명 형식', () => {
    const header = buildSignatureHeader(TS, 'deadbeef');
    expect(header).toBe(`t=${TS},v1=deadbeef`);
  });

  it('buildSignatureHeader — secondary 가 있고 다르면 v1= 두 개', () => {
    const header = buildSignatureHeader(TS, 'aaaa', 'bbbb');
    expect(header).toBe(`t=${TS},v1=aaaa,v1=bbbb`);
  });

  it('buildSignatureHeader — secondary 가 primary 와 같으면 중복 제거', () => {
    const header = buildSignatureHeader(TS, 'aaaa', 'aaaa');
    expect(header).toBe(`t=${TS},v1=aaaa`);
  });

  describe('verifySignatureHeader', () => {
    function makeHeader(
      secret: string,
      algo: 'sha256' | 'sha512' = 'sha256',
    ): string {
      const hex = createHmac(algo, secret).update(`${TS}.${RAW}`).digest('hex');
      return `t=${TS},v1=${hex}`;
    }

    it('valid — 동일 secret + tolerance 안', () => {
      const header = makeHeader(SECRET);
      const r = verifySignatureHeader(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS,
      });
      expect(r).toEqual({ valid: true });
    });

    it('valid — tolerance 경계 (default 5분)', () => {
      const header = makeHeader(SECRET);
      const r = verifySignatureHeader(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS + 5 * 60,
      });
      expect(r.valid).toBe(true);
    });

    it('invalid — tolerance 초과', () => {
      const header = makeHeader(SECRET);
      const r = verifySignatureHeader(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS + 5 * 60 + 1,
      });
      expect(r).toMatchObject({
        valid: false,
        reason: 'timestamp_outside_window',
      });
    });

    it('invalid — 잘못된 secret', () => {
      const header = makeHeader('wrong-secret');
      const r = verifySignatureHeader(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS,
      });
      expect(r).toMatchObject({ valid: false, reason: 'mismatch' });
    });

    it('invalid — 변조된 rawBody', () => {
      const header = makeHeader(SECRET);
      const r = verifySignatureHeader(
        header,
        RAW + 'tampered',
        SECRET,
        'hmac-sha256',
        { nowSec: TS },
      );
      expect(r).toMatchObject({ valid: false, reason: 'mismatch' });
    });

    it('invalid — 헤더 형식 깨짐', () => {
      expect(verifySignatureHeader(null, RAW, SECRET)).toMatchObject({
        valid: false,
        reason: 'malformed',
      });
      expect(verifySignatureHeader('', RAW, SECRET)).toMatchObject({
        valid: false,
        reason: 'malformed',
      });
      expect(verifySignatureHeader('garbage', RAW, SECRET)).toMatchObject({
        valid: false,
        reason: 'malformed',
      });
      expect(verifySignatureHeader('t=abc,v1=zz', RAW, SECRET)).toMatchObject({
        valid: false,
        reason: 'malformed',
      });
      expect(verifySignatureHeader(`t=${TS}`, RAW, SECRET)).toMatchObject({
        valid: false,
        reason: 'malformed',
      });
    });

    it('rotation — 두 v1= 중 하나만 매칭되어도 valid', () => {
      const correct = createHmac('sha256', SECRET)
        .update(`${TS}.${RAW}`)
        .digest('hex');
      const rotated = createHmac('sha256', 'old-secret')
        .update(`${TS}.${RAW}`)
        .digest('hex');
      const header = `t=${TS},v1=${rotated},v1=${correct}`;
      const r = verifySignatureHeader(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS,
      });
      expect(r.valid).toBe(true);
    });

    it('rotation — 모든 v1= 가 매칭 안 되면 mismatch', () => {
      const a = createHmac('sha256', 'a').update(`${TS}.${RAW}`).digest('hex');
      const b = createHmac('sha256', 'b').update(`${TS}.${RAW}`).digest('hex');
      const header = `t=${TS},v1=${a},v1=${b}`;
      const r = verifySignatureHeader(header, RAW, SECRET, 'hmac-sha256', {
        nowSec: TS,
      });
      expect(r).toMatchObject({ valid: false, reason: 'mismatch' });
    });

    it('sha512 알고리즘 지정 통과', () => {
      const hex = createHmac('sha512', SECRET)
        .update(`${TS}.${RAW}`)
        .digest('hex');
      const header = `t=${TS},v1=${hex}`;
      const r = verifySignatureHeader(header, RAW, SECRET, 'hmac-sha512', {
        nowSec: TS,
      });
      expect(r.valid).toBe(true);
    });
  });
});
