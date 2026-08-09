import { BadRequestException } from '@nestjs/common';
import {
  normalizeWorkspaceHeader,
  resolveRequestWorkspaceContext,
} from './workspace-context.util';

/**
 * 픽스처는 **실제 형태의 UUID** 다. 종전에는 `'ws1'`·`'header-ws'` 같은 임의 문자열이었는데,
 * `X-Workspace-Id` 는 Postgres `uuid` 컬럼으로 흘러가므로 그 문자열들은 프로덕션에서
 * 존재할 수 없는 값이었다 — 헤더 형식 검증이 붙은 지금은 400 을 받는다.
 */
const HEADER_WS = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const TOKEN_WS = 'bbbbbbbb-2222-4222-9222-bbbbbbbbbbbb';
const OTHER_WS = 'cccccccc-3333-4333-a333-cccccccccccc';

describe('normalizeWorkspaceHeader', () => {
  it('returns undefined when header is absent', () => {
    expect(normalizeWorkspaceHeader(undefined)).toBeUndefined();
  });

  it('returns the string as-is for a single header', () => {
    expect(normalizeWorkspaceHeader(HEADER_WS)).toBe(HEADER_WS);
  });

  it('returns the first value for a duplicated (array) header', () => {
    expect(normalizeWorkspaceHeader([HEADER_WS, OTHER_WS])).toBe(HEADER_WS);
  });

  it('returns undefined for an empty array header', () => {
    // 형태상 도달 가능하다 (프록시가 빈 헤더 목록을 넘기는 경우). `raw[0]` 가
    // `undefined` 이므로 "헤더 없음" 과 같은 취급이어야 한다 — 고정해 둔다.
    expect(normalizeWorkspaceHeader([])).toBeUndefined();
  });
});

describe('resolveRequestWorkspaceContext', () => {
  it('prefers the header over the token claim (header-first)', () => {
    const ctx = resolveRequestWorkspaceContext(
      { 'x-workspace-id': HEADER_WS },
      TOKEN_WS,
    );
    expect(ctx.workspaceId).toBe(HEADER_WS);
    expect(ctx.headerWorkspaceId).toBe(HEADER_WS);
  });

  it('falls back to the token claim when no header is present', () => {
    const ctx = resolveRequestWorkspaceContext({}, TOKEN_WS);
    expect(ctx.workspaceId).toBe(TOKEN_WS);
    expect(ctx.headerWorkspaceId).toBeUndefined();
    expect(ctx.membershipUnverified).toBe(false);
  });

  it('reports membershipUnverified only when the header overrides the token', () => {
    const overridden = resolveRequestWorkspaceContext(
      { 'x-workspace-id': OTHER_WS },
      TOKEN_WS,
    );
    expect(overridden.membershipUnverified).toBe(true);

    const same = resolveRequestWorkspaceContext(
      { 'x-workspace-id': TOKEN_WS },
      TOKEN_WS,
    );
    expect(same.membershipUnverified).toBe(false);
  });

  it('reports membershipUnverified when a header is present and the token has no claim', () => {
    // 토큰이 워크스페이스를 확정하지 못한 상태에서 헤더만 온 조합. `jwt.strategy` 가
    // 검증해 둔 멤버십이 **없으므로** 가드가 DB 로 재검증해야 한다 — 이 조합이
    // `false` 로 뒤집히면 헤더만으로 타 워크스페이스에 들어갈 수 있다.
    const ctx = resolveRequestWorkspaceContext(
      { 'x-workspace-id': HEADER_WS },
      undefined,
    );
    expect(ctx.workspaceId).toBe(HEADER_WS);
    expect(ctx.membershipUnverified).toBe(true);
  });

  it('normalizes a duplicated header to its first value', () => {
    const ctx = resolveRequestWorkspaceContext(
      { 'x-workspace-id': [OTHER_WS, HEADER_WS] },
      TOKEN_WS,
    );
    expect(ctx.workspaceId).toBe(OTHER_WS);
    expect(ctx.headerWorkspaceId).toBe(OTHER_WS);
    expect(ctx.membershipUnverified).toBe(true);
  });

  it('returns undefined workspaceId when neither header nor token is present', () => {
    const ctx = resolveRequestWorkspaceContext({}, undefined);
    expect(ctx.workspaceId).toBeUndefined();
    expect(ctx.membershipUnverified).toBe(false);
  });

  describe('형식이 깨진 X-Workspace-Id 헤더', () => {
    /**
     * 종전에는 그대로 `getMemberRole` 로 흘러가 TypeORM `QueryFailedError`
     * (`invalid input syntax for type uuid`, SQLSTATE 22P02)가 났고,
     * `GlobalExceptionFilter` 는 23505 만 매핑하므로 **500 INTERNAL_ERROR 로 마스킹**됐다.
     * 클라이언트 입력 오류가 서버 오류로 보이는 상태다. 이 결함은 개정 전 가드에도
     * 있었다 — P0 멤버십 PR 이 표면을 `@WorkspaceId()` 라우트로 넓혔을 뿐이다.
     */
    it.each([
      ['임의 문자열', 'not-a-uuid'],
      ['빈 것 같지만 공백', '   '],
      ['잘린 UUID', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaa'],
      ['하이픈 없음', 'aaaaaaaa11114111811 1aaaaaaaaaaaa'],
      ['SQL 조각처럼 보이는 값', "' OR 1=1--"],
    ])('%s → 400 VALIDATION_ERROR', (_label, raw) => {
      // 캡처-재던지기. `toThrow` 용 1회 + `getResponse()` 용 1회로 **두 번 호출**하면,
      // 첫 단언이 실패했을 때 두 번째가 조용히 건너뛰어지고 catch 블록이 아예 안 돌아
      // code 단언이 vacuous 해진다 — `workspace.decorator.spec.ts` 가 같은 이유로
      // 기각해 둔 패턴이라 여기서도 같은 형태를 쓴다 (ai-review 2차 WARNING #4).
      let caught: unknown;
      expect(() => {
        try {
          resolveRequestWorkspaceContext({ 'x-workspace-id': raw }, TOKEN_WS);
        } catch (err) {
          caught = err;
          throw err;
        }
      }).toThrow(BadRequestException);
      expect((caught as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      );
    });

    it('토큰 클레임은 검증하지 않는다 — 서버가 서명한 값이라 클라이언트 입력이 아니다', () => {
      // 여기서 던지면 **서버 버그를 클라이언트 오류(400)로 보고**하게 된다.
      const ctx = resolveRequestWorkspaceContext({}, 'legacy-non-uuid');
      expect(ctx.workspaceId).toBe('legacy-non-uuid');
    });

    it('Postgres 가 파싱할 수 있는 값은 통과시킨다 (nil UUID — 403 이 400 으로 뒤바뀌지 않도록)', () => {
      const nil = '00000000-0000-0000-0000-000000000000';
      const ctx = resolveRequestWorkspaceContext(
        { 'x-workspace-id': nil },
        TOKEN_WS,
      );
      expect(ctx.workspaceId).toBe(nil);
      expect(ctx.membershipUnverified).toBe(true);
    });

    it('중복 헤더는 **채택된 첫 값**만 검증한다', () => {
      // 두 번째 값이 쓰레기여도 첫 값이 유효하면 통과 — 검증 대상은 실제로 쓰이는 값이다.
      expect(
        resolveRequestWorkspaceContext(
          { 'x-workspace-id': [HEADER_WS, 'garbage'] },
          TOKEN_WS,
        ).workspaceId,
      ).toBe(HEADER_WS);

      // 반대로 첫 값이 쓰레기면 뒤에 유효한 값이 있어도 거부한다.
      expect(() =>
        resolveRequestWorkspaceContext(
          { 'x-workspace-id': ['garbage', HEADER_WS] },
          TOKEN_WS,
        ),
      ).toThrow(BadRequestException);
    });
  });
});
