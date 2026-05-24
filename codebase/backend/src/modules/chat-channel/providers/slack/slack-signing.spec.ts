/**
 * Slack X-Slack-Signature 검증 단위 테스트.
 *
 * Spec [providers/slack §6 보안]: HMAC-SHA256(signing_secret, "v0:" + ts + ":" + raw_body)
 * + 5분 replay window + constant-time compare.
 */
import { createHmac } from 'node:crypto';
import { verifySlackSignature } from './slack-signing';

const SECRET = 'test-signing-secret';

function makeSignature(
  body: string,
  timestamp: string,
  secret = SECRET,
): string {
  const base = `v0:${timestamp}:${body}`;
  const hmac = createHmac('sha256', secret).update(base).digest('hex');
  return `v0=${hmac}`;
}

function nowSec(offsetSec = 0): string {
  return String(Math.floor(Date.now() / 1000) + offsetSec);
}

describe('verifySlackSignature', () => {
  describe('정상 케이스', () => {
    it('올바른 signature + 현재 timestamp → true', () => {
      const body = '{"event":{"type":"message"}}';
      const ts = nowSec();
      const sig = makeSignature(body, ts);
      expect(verifySlackSignature(body, sig, ts, SECRET)).toBe(true);
    });

    it('빈 body 도 검증 가능 — slash command 의 url-encoded form 케이스', () => {
      const body = '';
      const ts = nowSec();
      const sig = makeSignature(body, ts);
      expect(verifySlackSignature(body, sig, ts, SECRET)).toBe(true);
    });

    it('5분 window 의 경계 직전 (4분 59초) → true', () => {
      const body = 'payload=%7B%22type%22%3A%22block_actions%22%7D';
      const ts = nowSec(-(5 * 60 - 1));
      const sig = makeSignature(body, ts);
      expect(verifySlackSignature(body, sig, ts, SECRET)).toBe(true);
    });
  });

  describe('실패 — signature mismatch', () => {
    it('잘못된 signature → false', () => {
      const body = '{"event":{}}';
      const ts = nowSec();
      const wrong = 'v0=' + 'f'.repeat(64);
      expect(verifySlackSignature(body, wrong, ts, SECRET)).toBe(false);
    });

    it('다른 secret 로 만든 signature → false', () => {
      const body = '{"event":{}}';
      const ts = nowSec();
      const sig = makeSignature(body, ts, 'wrong-secret');
      expect(verifySlackSignature(body, sig, ts, SECRET)).toBe(false);
    });

    it('body 가 변조된 경우 → false (HMAC 입력 일부 변경)', () => {
      const ts = nowSec();
      const sig = makeSignature('original', ts);
      expect(verifySlackSignature('tampered', sig, ts, SECRET)).toBe(false);
    });

    it('timestamp 가 변조된 경우 → false', () => {
      const body = '{}';
      const realTs = nowSec();
      const sig = makeSignature(body, realTs);
      const fakeTs = String(Number(realTs) - 1);
      expect(verifySlackSignature(body, sig, fakeTs, SECRET)).toBe(false);
    });
  });

  describe('실패 — replay window', () => {
    it('5분 + 1초 과거 → false (Spec §8 replay 차단)', () => {
      const body = '{}';
      const ts = nowSec(-(5 * 60 + 1));
      const sig = makeSignature(body, ts);
      expect(verifySlackSignature(body, sig, ts, SECRET)).toBe(false);
    });

    it('5분 + 1초 미래 (clock skew 한계 초과) → false', () => {
      const body = '{}';
      const ts = nowSec(5 * 60 + 1);
      const sig = makeSignature(body, ts);
      expect(verifySlackSignature(body, sig, ts, SECRET)).toBe(false);
    });
  });

  describe('실패 — 형식 오류', () => {
    it('signature 가 "v0=" prefix 가 없으면 → false', () => {
      const body = '{}';
      const ts = nowSec();
      expect(verifySlackSignature(body, 'abc123', ts, SECRET)).toBe(false);
    });

    it('signature 가 빈 문자열 → false', () => {
      const ts = nowSec();
      expect(verifySlackSignature('{}', '', ts, SECRET)).toBe(false);
    });

    it('timestamp 가 숫자가 아니면 → false', () => {
      const body = '{}';
      const ts = 'not-a-number';
      const sig = makeSignature(body, ts);
      expect(verifySlackSignature(body, sig, ts, SECRET)).toBe(false);
    });

    it('timestamp 가 빈 문자열 → false', () => {
      const body = '{}';
      const sig = 'v0=' + 'a'.repeat(64);
      expect(verifySlackSignature(body, sig, '', SECRET)).toBe(false);
    });

    it('secret 이 빈 문자열 → false (signing key 미설정 — auth skip 책임은 caller)', () => {
      const body = '{}';
      const ts = nowSec();
      const sig = makeSignature(body, ts, '');
      expect(verifySlackSignature(body, sig, ts, '')).toBe(false);
    });
  });

  describe('constant-time compare', () => {
    it('같은 길이의 다른 signature 들 모두 false 반환 (timing attack 보호 검증은 별 통계 테스트)', () => {
      const body = '{}';
      const ts = nowSec();
      const real = makeSignature(body, ts);
      const fakes = [
        'v0=' + '0'.repeat(64),
        'v0=' + 'a'.repeat(64),
        'v0=' + 'f'.repeat(64),
        real.slice(0, -1) + (real.slice(-1) === '0' ? '1' : '0'), // 마지막 char 만 다름
      ];
      for (const fake of fakes) {
        expect(verifySlackSignature(body, fake, ts, SECRET)).toBe(false);
      }
    });
  });
});
