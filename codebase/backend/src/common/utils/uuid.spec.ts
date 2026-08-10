import { isUuidShaped, isValidUuid } from './uuid';

describe('isValidUuid', () => {
  it('accepts canonical lowercase UUIDs (v1–v5)', () => {
    expect(isValidUuid('11111111-1111-1111-8111-111111111111')).toBe(true); // v1
    expect(isValidUuid('11111111-1111-4111-8111-111111111111')).toBe(true); // v4
    expect(isValidUuid('8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234')).toBe(true);
  });

  it('accepts uppercase (case-insensitive)', () => {
    expect(isValidUuid('AAAAAAAA-1111-4111-8111-AAAAAAAAAAAA')).toBe(true);
  });

  it('rejects empty / non-string-shaped input', () => {
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('doc-abc')).toBe(false);
  });

  it('rejects wrong version / variant nibble', () => {
    // version nibble 0 (must be 1–5)
    expect(isValidUuid('11111111-1111-0111-8111-111111111111')).toBe(false);
    // version nibble 6 (out of 1–5)
    expect(isValidUuid('11111111-1111-6111-8111-111111111111')).toBe(false);
    // variant nibble 7 (must be 8/9/a/b)
    expect(isValidUuid('11111111-1111-4111-7111-111111111111')).toBe(false);
  });

  it('rejects malformed structure (length / separators / non-hex)', () => {
    expect(isValidUuid('11111111-1111-4111-8111-11111111111')).toBe(false); // short
    expect(isValidUuid('11111111-1111-4111-8111-1111111111111')).toBe(false); // long
    expect(isValidUuid('111111111111141118111111111111111111')).toBe(false); // no dashes
    expect(isValidUuid('gggggggg-1111-4111-8111-111111111111')).toBe(false); // non-hex
    expect(isValidUuid(' 11111111-1111-4111-8111-111111111111')).toBe(false); // leading space
  });
});

describe('isUuidShaped', () => {
  it('rejects the same garbage isValidUuid rejects', () => {
    expect(isUuidShaped('')).toBe(false);
    expect(isUuidShaped('not-a-uuid')).toBe(false);
    expect(isUuidShaped('11111111-1111-4111-8111-11111111111')).toBe(false); // short
    expect(isUuidShaped('11111111-1111-4111-8111-1111111111111')).toBe(false); // long
    expect(isUuidShaped('111111111111141118111111111111111111')).toBe(false); // no dashes
    expect(isUuidShaped('gggggggg-1111-4111-8111-111111111111')).toBe(false); // non-hex
    expect(isUuidShaped(' 11111111-1111-4111-8111-111111111111')).toBe(false); // leading space
  });

  /**
   * 이 세 값이 **두 술어의 경계**다. 왜 느슨한 술어를 골랐는가(403→400 뒤바뀜)와 앵커
   * 정정 이력은 `uuid.ts` 의 `isUuidShaped` docstring 이 SoT 다.
   *
   * **이 테스트 자체가 그 회귀 캐너리고, 자매는 `workspace-context.util.spec.ts` 의 nil
   * UUID 통과 테스트다. 그리고 이 둘이 유일한 방어선이다** — 실측: `isUuidShaped` 의
   * 프로덕션 호출부는 `workspace-context.util.ts:74` 한 곳뿐이다.
   * `roles.guard.spec.ts` 도 nil UUID 를 쓰지만 그쪽은 **전역 라우트** 케이스라 같은
   * 단축에 걸려 술어에 닿지 않으므로 이 경계의 방어선으로 세면 안 된다.
   */
  it('accepts UUID-shaped values that isValidUuid rejects (nil / v6+ / 비-RFC variant)', () => {
    const nil = '00000000-0000-0000-0000-000000000000';
    const v7 = '018f3c6b-1a0d-7e4a-9c1d-2f0e5a8b1234';
    const oddVariant = '11111111-1111-4111-7111-111111111111';

    for (const value of [nil, v7, oddVariant]) {
      expect(isUuidShaped(value)).toBe(true);
      expect(isValidUuid(value)).toBe(false);
    }
  });

  it('accepts what isValidUuid accepts (상위집합이다)', () => {
    for (const value of [
      '11111111-1111-1111-8111-111111111111',
      '8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234',
      'AAAAAAAA-1111-4111-8111-AAAAAAAAAAAA',
    ]) {
      expect(isValidUuid(value)).toBe(true);
      expect(isUuidShaped(value)).toBe(true);
    }
  });
});
