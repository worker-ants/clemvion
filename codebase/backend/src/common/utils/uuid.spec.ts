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
   * 이 세 값이 **두 술어의 경계**다. 셋 다 Postgres 가 `uuid` 로 받아들이므로,
   * 이것들을 `isValidUuid` 로 걸러 400 을 내면 "그 워크스페이스의 멤버가 아니다"(403)
   * 여야 할 응답이 "요청이 잘못됐다"(400) 로 뒤바뀐다.
   *
   * **이 테스트 자체가 그 회귀 캐너리다** (자매: `workspace-context.util.spec.ts` 의
   * nil UUID 통과 테스트). 종전 이 주석은 `system-status.e2e-spec.ts` 를 캐너리로
   * 지목했으나 `#1112` 가 실측으로 반증했다 — 그 컨트롤러에는 `@Roles()` 도
   * `@WorkspaceId()` 도 없어 `RolesGuard` 가 술어 호출 이전에 통과시킨다. 즉 술어를
   * 조이는 회귀가 와도 그 e2e 는 GREEN 이다.
   *
   * **이 둘이 유일한 방어선이다** (실측: `isUuidShaped` 의 프로덕션 호출부는
   * `workspace-context.util.ts:74` 한 곳뿐이다). `roles.guard.spec.ts` 도 nil UUID 를
   * 쓰지만 그쪽은 **전역 라우트** 케이스라 같은 단축에 걸려 술어에 닿지 않으므로
   * 이 경계의 방어선으로 세면 안 된다.
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
