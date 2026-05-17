import {
  __resetCorsOriginsCache,
  assertCorsOriginsConfigured,
  corsOriginCallback,
  getAllowedOrigins,
  isOriginAllowed,
} from './cors-origins';

describe('cors-origins (W-1)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    __resetCorsOriginsCache();
    delete process.env.CORS_ORIGINS;
    delete process.env.FRONTEND_URL;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getAllowedOrigins', () => {
    it('CORS_ORIGINS 미설정 + FRONTEND_URL 미설정 → wildcard fallback', () => {
      expect(getAllowedOrigins()).toEqual(['*']);
    });

    it('FRONTEND_URL 만 설정 → 단일 도메인 (단일 운영 호환)', () => {
      process.env.FRONTEND_URL = 'https://app.example.com';
      expect(getAllowedOrigins()).toEqual(['https://app.example.com']);
    });

    it('CORS_ORIGINS 가 FRONTEND_URL 보다 우선', () => {
      process.env.CORS_ORIGINS = 'https://app.example.com,https://admin.example.com';
      process.env.FRONTEND_URL = 'https://ignored.example.com';
      expect(getAllowedOrigins()).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
      ]);
    });

    it('후행 슬래시 제거 + 공백 트리밍 + 빈 항목 무시', () => {
      process.env.CORS_ORIGINS = ' https://a.example.com/ , ,https://b.example.com ';
      expect(getAllowedOrigins()).toEqual([
        'https://a.example.com',
        'https://b.example.com',
      ]);
    });

    it('CORS_ORIGINS 가 빈 문자열 → fallback (FRONTEND_URL 무시: undefined 가 아니라 "")', () => {
      // CORS_ORIGINS="" 은 명시적 wipe 가 아니라 운영 실수로 본다.
      process.env.CORS_ORIGINS = '';
      expect(getAllowedOrigins()).toEqual(['*']);
    });

    it('env 변경 시 캐시 재계산', () => {
      process.env.FRONTEND_URL = 'https://a.example.com';
      expect(getAllowedOrigins()).toEqual(['https://a.example.com']);
      process.env.FRONTEND_URL = 'https://b.example.com';
      expect(getAllowedOrigins()).toEqual(['https://b.example.com']);
    });
  });

  describe('isOriginAllowed', () => {
    it('origin 미지정 (same-origin) → true', () => {
      process.env.CORS_ORIGINS = 'https://app.example.com';
      expect(isOriginAllowed(undefined)).toBe(true);
    });

    it('wildcard 모드 → 모든 origin true', () => {
      expect(isOriginAllowed('https://attacker.example.com')).toBe(true);
    });

    it('allowlist 매칭 → true', () => {
      process.env.CORS_ORIGINS = 'https://app.example.com,https://admin.example.com';
      expect(isOriginAllowed('https://app.example.com')).toBe(true);
      expect(isOriginAllowed('https://admin.example.com')).toBe(true);
    });

    it('allowlist 비매칭 → false', () => {
      process.env.CORS_ORIGINS = 'https://app.example.com';
      expect(isOriginAllowed('https://attacker.example.com')).toBe(false);
    });

    it('후행 슬래시 정규화 — request origin 에 슬래시가 붙어 와도 매칭', () => {
      process.env.CORS_ORIGINS = 'https://app.example.com';
      expect(isOriginAllowed('https://app.example.com/')).toBe(true);
    });
  });

  describe('corsOriginCallback', () => {
    it('허용된 origin → callback(null, true)', () => {
      process.env.CORS_ORIGINS = 'https://app.example.com';
      const cb = jest.fn();
      corsOriginCallback('https://app.example.com', cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('차단된 origin → callback(null, false)', () => {
      process.env.CORS_ORIGINS = 'https://app.example.com';
      const cb = jest.fn();
      corsOriginCallback('https://attacker.example.com', cb);
      expect(cb).toHaveBeenCalledWith(null, false);
    });
  });

  describe('assertCorsOriginsConfigured', () => {
    it('production + wildcard → throw', () => {
      process.env.NODE_ENV = 'production';
      expect(() => assertCorsOriginsConfigured()).toThrow(/CORS misconfiguration/);
    });

    it('production + 명시 설정 → 통과', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGINS = 'https://app.example.com';
      expect(() => assertCorsOriginsConfigured()).not.toThrow();
    });

    it('development + wildcard → 통과 (편의)', () => {
      process.env.NODE_ENV = 'development';
      expect(() => assertCorsOriginsConfigured()).not.toThrow();
    });

    it('test + wildcard → 통과', () => {
      process.env.NODE_ENV = 'test';
      expect(() => assertCorsOriginsConfigured()).not.toThrow();
    });
  });
});
