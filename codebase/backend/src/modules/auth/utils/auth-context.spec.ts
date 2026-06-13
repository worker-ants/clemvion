import { authContextFromRequest } from './auth-context';
import type { Request } from 'express';

describe('authContextFromRequest (refactor 04 C-1 — DRY)', () => {
  const ORIGINAL = process.env.TRUST_CF_CONNECTING_IP;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TRUST_CF_CONNECTING_IP;
    else process.env.TRUST_CF_CONNECTING_IP = ORIGINAL;
  });

  it('extracts client IP (XFF first) and User-Agent', () => {
    delete process.env.TRUST_CF_CONNECTING_IP; // CF 신뢰 off → XFF 첫 IP
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'UA/1' },
      ip: '9.9.9.9',
      socket: {},
    } as unknown as Request;

    expect(authContextFromRequest(req)).toEqual({
      ip: '1.2.3.4',
      userAgent: 'UA/1',
    });
  });

  it('returns null userAgent when header absent', () => {
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4' },
      ip: '9.9.9.9',
      socket: {},
    } as unknown as Request;

    expect(authContextFromRequest(req).userAgent).toBeNull();
  });
});
