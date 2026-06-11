/**
 * production fail-closed 가드 단위 테스트 (refactor 04 C-1·M-4·M-7).
 * 순수 함수라 env 맵을 주입해 전 분기를 검증한다 — 실제 부팅 불필요.
 */
import {
  assertProductionConfig,
  INSECURE_JWT_SECRETS,
  KNOWN_EXAMPLE_ENCRYPTION_KEYS,
} from './production-guards';

const VALID_JWT = 'a-real-long-random-production-jwt-secret-0123456789';
const VALID_ENC =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

function prodEnv(over: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: VALID_JWT,
    ENCRYPTION_KEY: VALID_ENC,
    ...over,
  };
}

describe('assertProductionConfig', () => {
  it('is a no-op outside production regardless of insecure values', () => {
    for (const nodeEnv of ['development', 'test', undefined]) {
      expect(() =>
        assertProductionConfig({
          NODE_ENV: nodeEnv,
          OAUTH_STUB_MODE: 'true',
          LLM_STUB_MODE: 'true',
          JWT_SECRET: 'dev-jwt-secret',
          ENCRYPTION_KEY: '',
          MCP_ALLOW_INSECURE_URL: 'true',
        }),
      ).not.toThrow();
    }
  });

  it('passes when all production secrets/flags are valid', () => {
    expect(() => assertProductionConfig(prodEnv())).not.toThrow();
  });

  it('throws when OAUTH_STUB_MODE=true in production', () => {
    expect(() =>
      assertProductionConfig(prodEnv({ OAUTH_STUB_MODE: 'true' })),
    ).toThrow(/OAUTH_STUB_MODE/);
  });

  it('throws when LLM_STUB_MODE=true in production', () => {
    expect(() =>
      assertProductionConfig(prodEnv({ LLM_STUB_MODE: 'true' })),
    ).toThrow(/LLM_STUB_MODE/);
  });

  describe('JWT_SECRET (04 C-1)', () => {
    it('throws when unset', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ JWT_SECRET: undefined })),
      ).toThrow(/JWT_SECRET/);
    });
    it('throws for each known insecure/example value', () => {
      for (const bad of INSECURE_JWT_SECRETS) {
        expect(() =>
          assertProductionConfig(prodEnv({ JWT_SECRET: bad })),
        ).toThrow(/JWT_SECRET/);
      }
    });
  });

  describe('ENCRYPTION_KEY (04 M-4)', () => {
    it('throws when unset', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ ENCRYPTION_KEY: undefined })),
      ).toThrow(/ENCRYPTION_KEY/);
    });
    it('throws for each known public example key', () => {
      for (const bad of KNOWN_EXAMPLE_ENCRYPTION_KEYS) {
        expect(() =>
          assertProductionConfig(prodEnv({ ENCRYPTION_KEY: bad })),
        ).toThrow(/ENCRYPTION_KEY/);
      }
    });
  });

  describe('MCP_ALLOW_INSECURE_URL (04 M-7)', () => {
    it.each(['true', '1'])('throws when set to %s in production', (v) => {
      expect(() =>
        assertProductionConfig(prodEnv({ MCP_ALLOW_INSECURE_URL: v })),
      ).toThrow(/MCP_ALLOW_INSECURE_URL/);
    });
    it('passes when false/unset', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ MCP_ALLOW_INSECURE_URL: 'false' })),
      ).not.toThrow();
    });
  });

  it('does NOT throw for ALLOW_PRIVATE_HOST_TARGETS=true (warn-only policy, handled in main.ts)', () => {
    expect(() =>
      assertProductionConfig(prodEnv({ ALLOW_PRIVATE_HOST_TARGETS: 'true' })),
    ).not.toThrow();
  });
});
