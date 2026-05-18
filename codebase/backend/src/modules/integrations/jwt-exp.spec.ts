import { parseJwtExp } from './jwt-exp';

/**
 * `parseJwtExp` — JWT payload 의 `exp` claim 을 epoch ms 로 추출.
 *
 * Cafe24 의 access_token / refresh_token 은 JWT 이므로 `exp` 가 만료 시각의
 * canonical SoT (RFC 7519, Unix epoch seconds — UTC absolute). signature 검증
 * 없이 base64url payload segment 만 디코드 — 본 용도는 *우리가 받은 토큰의
 * 만료 시각* 추출이지 위조 방어가 아님 (Cafe24 API 가 호출 시점에 검증).
 *
 * spec/2-navigation/4-integration.md §10.5 + Rationale "Cafe24 token 만료
 * SoT — JWT exp 격상 (2026-05-18)".
 */

function base64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt(
  payload: unknown,
  options?: { headerSegment?: string },
): string {
  const header =
    options?.headerSegment ?? base64url('{"alg":"RS256","typ":"JWT"}');
  const payloadSeg = base64url(JSON.stringify(payload));
  // signature segment 는 base64url 의 빈 영역 또는 더미. 본 helper 는 검증 안 함.
  const signature = 'sig-not-verified';
  return `${header}.${payloadSeg}.${signature}`;
}

describe('parseJwtExp', () => {
  it('정상 JWT — exp 가 있으면 epoch ms 로 반환', () => {
    const expSec = Math.floor(Date.now() / 1000) + 7200; // 2h 후
    const token = makeJwt({ exp: expSec, iat: expSec - 7200 });
    expect(parseJwtExp(token)).toBe(expSec * 1000);
  });

  it('정상 JWT — exp 만 있는 minimal payload', () => {
    const expSec = 1234567890;
    const token = makeJwt({ exp: expSec });
    expect(parseJwtExp(token)).toBe(expSec * 1000);
  });

  it('exp 누락 — null', () => {
    const token = makeJwt({ iat: 1234567890, sub: 'user-1' });
    expect(parseJwtExp(token)).toBeNull();
  });

  it('exp 가 숫자가 아님 (string) — null', () => {
    const token = makeJwt({ exp: '1234567890' });
    expect(parseJwtExp(token)).toBeNull();
  });

  it('exp 가 boolean — null', () => {
    const token = makeJwt({ exp: true });
    expect(parseJwtExp(token)).toBeNull();
  });

  it('exp 가 NaN — null', () => {
    const token = makeJwt({ exp: Number.NaN });
    expect(parseJwtExp(token)).toBeNull();
  });

  it('exp 가 Infinity — null (Number.isFinite 차단)', () => {
    const token = makeJwt({ exp: Number.POSITIVE_INFINITY });
    expect(parseJwtExp(token)).toBeNull();
  });

  it('segment 개수 != 3 (header.payload 만) — null', () => {
    const token = `${base64url('{}')}.${base64url('{"exp":1}')}`;
    expect(parseJwtExp(token)).toBeNull();
  });

  it('segment 개수 != 3 (단일) — null', () => {
    expect(parseJwtExp('not-a-jwt')).toBeNull();
  });

  it('payload segment base64 오류 — null', () => {
    const token = `${base64url('{}')}.@@@invalid@@@.sig`;
    expect(parseJwtExp(token)).toBeNull();
  });

  it('payload JSON 오류 — null', () => {
    const malformedPayload = base64url('not-json{');
    const token = `${base64url('{}')}.${malformedPayload}.sig`;
    expect(parseJwtExp(token)).toBeNull();
  });

  it('payload 가 JSON object 가 아님 (string) — null', () => {
    const stringPayload = base64url('"just-a-string"');
    const token = `${base64url('{}')}.${stringPayload}.sig`;
    expect(parseJwtExp(token)).toBeNull();
  });

  it('payload 가 JSON object 가 아님 (number) — null', () => {
    const numberPayload = base64url('1234567890');
    const token = `${base64url('{}')}.${numberPayload}.sig`;
    expect(parseJwtExp(token)).toBeNull();
  });

  it('payload 가 JSON array — null', () => {
    const arrayPayload = base64url('[1,2,3]');
    const token = `${base64url('{}')}.${arrayPayload}.sig`;
    expect(parseJwtExp(token)).toBeNull();
  });

  it('빈 문자열 — null', () => {
    expect(parseJwtExp('')).toBeNull();
  });

  it('null — null', () => {
    expect(parseJwtExp(null)).toBeNull();
  });

  it('undefined — null', () => {
    expect(parseJwtExp(undefined)).toBeNull();
  });

  it('non-string (number) — null', () => {
    expect(parseJwtExp(1234567890 as unknown as string)).toBeNull();
  });

  it('non-string (object) — null', () => {
    expect(parseJwtExp({ exp: 1 } as unknown as string)).toBeNull();
  });

  it('exp = 0 — null (sentinel; 의미적으로 만료 시각으로 부적합)', () => {
    // exp=0 은 1970-01-01 — 사실상 무의미한 값. 0 을 falsy 로 reject 해
    // 정상 fallback chain 으로 강하시키는 게 안전.
    const token = makeJwt({ exp: 0 });
    expect(parseJwtExp(token)).toBeNull();
  });

  it('exp 음수 — null (의미적으로 부적합)', () => {
    const token = makeJwt({ exp: -1 });
    expect(parseJwtExp(token)).toBeNull();
  });

  it('Cafe24-like JWT payload (additional claims) — exp 정확 추출', () => {
    // Cafe24 의 실제 access_token payload 와 유사한 shape — exp 외 여러
    // claim 이 있어도 exp 만 정확히 추출되는지 확인.
    const expSec = 1779000000;
    const token = makeJwt({
      exp: expSec,
      iat: expSec - 7200,
      iss: 'cafe24',
      mall_id: 'gehrig0301',
      user_id: 'admin',
      scopes: ['mall.read_product'],
    });
    expect(parseJwtExp(token)).toBe(expSec * 1000);
  });
});
