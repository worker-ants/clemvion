/**
 * refresh-cookie 단위 테스트 (04 M-5 — SameSite env 분리 + path 축소).
 */
import type Express from 'express';
import {
  getRefreshCookieSameSite,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from './refresh-cookie';

describe('getRefreshCookieSameSite (04 M-5)', () => {
  it('defaults to none when unset', () => {
    expect(getRefreshCookieSameSite({})).toBe('none');
  });

  it.each(['lax', 'strict', 'none'])('honors valid value %p', (v) => {
    expect(getRefreshCookieSameSite({ COOKIE_SAMESITE: v })).toBe(v);
  });

  it('is case-insensitive and trims', () => {
    expect(getRefreshCookieSameSite({ COOKIE_SAMESITE: '  Lax ' })).toBe('lax');
    expect(getRefreshCookieSameSite({ COOKIE_SAMESITE: 'STRICT' })).toBe(
      'strict',
    );
  });

  it('falls back to none for unrecognized values', () => {
    expect(getRefreshCookieSameSite({ COOKIE_SAMESITE: 'yes' })).toBe('none');
    expect(getRefreshCookieSameSite({ COOKIE_SAMESITE: '' })).toBe('none');
  });
});

describe('setRefreshTokenCookie (04 M-5)', () => {
  const origEnv = process.env.COOKIE_SAMESITE;
  afterEach(() => {
    if (origEnv === undefined) delete process.env.COOKIE_SAMESITE;
    else process.env.COOKIE_SAMESITE = origEnv;
  });

  function mockRes(): { cookie: jest.Mock } {
    return { cookie: jest.fn() };
  }

  it('sets httpOnly+secure cookie scoped to /api/auth with default SameSite=none', () => {
    delete process.env.COOKIE_SAMESITE;
    const res = mockRes();
    setRefreshTokenCookie(res as unknown as Express.Response, 'tok', {
      cookieDomain: '',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'tok',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      }),
    );
  });

  it('honors COOKIE_SAMESITE=lax', () => {
    process.env.COOKIE_SAMESITE = 'lax';
    const res = mockRes();
    setRefreshTokenCookie(res as unknown as Express.Response, 'tok', {
      cookieDomain: '',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'tok',
      expect.objectContaining({ sameSite: 'lax' }),
    );
  });

  it('uses the 30-day maxAge when rememberMe is set', () => {
    const res = mockRes();
    setRefreshTokenCookie(res as unknown as Express.Response, 'tok', {
      cookieDomain: '',
      rememberMe: true,
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'tok',
      expect.objectContaining({ maxAge: 30 * 24 * 60 * 60 * 1000 }),
    );
  });

  it('includes domain when provided', () => {
    const res = mockRes();
    setRefreshTokenCookie(res as unknown as Express.Response, 'tok', {
      cookieDomain: '.example.com',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'tok',
      expect.objectContaining({ domain: '.example.com' }),
    );
  });
});

describe('clearRefreshTokenCookie (04 M-5)', () => {
  it('clears the cookie on the same /api/auth path', () => {
    const res = { clearCookie: jest.fn() };
    clearRefreshTokenCookie(res as unknown as Express.Response, {
      cookieDomain: '',
    });
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
      path: '/api/auth',
    });
  });

  it('includes domain when provided (set/clear domain parity)', () => {
    const res = { clearCookie: jest.fn() };
    clearRefreshTokenCookie(res as unknown as Express.Response, {
      cookieDomain: '.example.com',
    });
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
      path: '/api/auth',
      domain: '.example.com',
    });
  });
});
