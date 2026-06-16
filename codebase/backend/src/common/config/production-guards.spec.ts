/**
 * production fail-closed 가드 단위 테스트 (refactor 04 C-1·M-4·M-7).
 * 순수 함수라 env 맵을 주입해 전 분기를 검증한다 — 실제 부팅 불필요.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { jwtConfig } from './jwt.config';
import {
  assertProductionConfig,
  isFlagOn,
  isSwaggerEnabled,
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
    it('throws when empty string', () => {
      expect(() => assertProductionConfig(prodEnv({ JWT_SECRET: '' }))).toThrow(
        /JWT_SECRET/,
      );
    });
    it('throws for each known insecure/example value', () => {
      for (const bad of INSECURE_JWT_SECRETS) {
        expect(() =>
          assertProductionConfig(prodEnv({ JWT_SECRET: bad })),
        ).toThrow(/JWT_SECRET/);
      }
    });
    it('throws when shorter than the minimum length (CWE-521)', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({ JWT_SECRET: 'short-but-not-blocklisted' }),
        ),
      ).toThrow(/JWT_SECRET/);
    });
    it('passes for a sufficiently long random secret', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ JWT_SECRET: 'x'.repeat(48) })),
      ).not.toThrow();
    });
  });

  describe('ENCRYPTION_KEY (04 M-4)', () => {
    it('throws when unset', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ ENCRYPTION_KEY: undefined })),
      ).toThrow(/ENCRYPTION_KEY/);
    });
    it('throws when empty string', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ ENCRYPTION_KEY: '' })),
      ).toThrow(/ENCRYPTION_KEY/);
    });
    it('throws for each known public example key', () => {
      for (const bad of KNOWN_EXAMPLE_ENCRYPTION_KEYS) {
        expect(() =>
          assertProductionConfig(prodEnv({ ENCRYPTION_KEY: bad })),
        ).toThrow(/ENCRYPTION_KEY/);
      }
    });
    // INFO-12: 유효한 non-example 키는 통과해야 함 (JWT_SECRET 의 긍정 케이스와 대칭).
    it('passes for a valid non-example key', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ ENCRYPTION_KEY: VALID_ENC })),
      ).not.toThrow();
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
    // isFlagOn 은 정확히 'true'/'1' 만 ON — 비표준 truthy 값은 모두 OFF 로 본다.
    it.each(['TRUE', 'yes', 'on', '0', ''])(
      'does NOT throw for non-standard flag value %p (treated as off)',
      (v) => {
        expect(() =>
          assertProductionConfig(prodEnv({ MCP_ALLOW_INSECURE_URL: v })),
        ).not.toThrow();
      },
    );
  });

  it('does NOT throw for ALLOW_PRIVATE_HOST_TARGETS=true (warn-only policy, handled in main.ts)', () => {
    expect(() =>
      assertProductionConfig(prodEnv({ ALLOW_PRIVATE_HOST_TARGETS: 'true' })),
    ).not.toThrow();
  });

  it('fail-fast: throws the first violation only (stub before secrets)', () => {
    // 검사 순서 계약 고정 — OAUTH_STUB 가 JWT_SECRET 보다 먼저 평가되므로 둘 다
    // 위반해도 OAUTH_STUB 메시지로 throw 된다 (순서 변경 시 본 테스트가 탐지).
    expect(() =>
      assertProductionConfig(
        prodEnv({ OAUTH_STUB_MODE: 'true', JWT_SECRET: '' }),
      ),
    ).toThrow(/OAUTH_STUB_MODE/);
  });

  it('passes when MCP_ALLOW_INSECURE_URL is undefined (unset)', () => {
    expect(() =>
      assertProductionConfig(prodEnv({ MCP_ALLOW_INSECURE_URL: undefined })),
    ).not.toThrow();
  });
});

// INFO-13: isFlagOn 독립 단위 테스트 — main.ts + assertProductionConfig 양쪽에서
// 재사용되는 계약을 고정한다. 비표준 truthy 값이 OFF 로 처리됨을 명시적으로 검증.
describe('isFlagOn', () => {
  it.each(['true', '1'])('returns true for ON value: %p', (v) => {
    expect(isFlagOn(v)).toBe(true);
  });

  it.each([undefined, '', 'TRUE', 'True', 'yes', 'on', '0', 'false', 'off'])(
    'returns false for non-ON value: %p',
    (v) => {
      expect(isFlagOn(v)).toBe(false);
    },
  );
});

// 04 M-1: Swagger 노출 게이팅. non-production 은 항상 노출, production 은 기본
// 미노출 + ENABLE_SWAGGER_IN_PROD opt-in 만 노출. main.ts 부팅 게이팅 계약을 고정한다.
describe('isSwaggerEnabled (04 M-1)', () => {
  it.each(['development', 'test', undefined])(
    'is enabled in non-production (NODE_ENV=%p) regardless of opt-in flag',
    (nodeEnv) => {
      expect(isSwaggerEnabled({ NODE_ENV: nodeEnv })).toBe(true);
      // opt-in 플래그는 non-production 노출에 영향 없음.
      expect(
        isSwaggerEnabled({
          NODE_ENV: nodeEnv,
          ENABLE_SWAGGER_IN_PROD: 'false',
        }),
      ).toBe(true);
    },
  );

  it('is disabled in production by default', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it.each(['true', '1'])(
    'is enabled in production only via ENABLE_SWAGGER_IN_PROD opt-in (%p)',
    (flag) => {
      expect(
        isSwaggerEnabled({
          NODE_ENV: 'production',
          ENABLE_SWAGGER_IN_PROD: flag,
        }),
      ).toBe(true);
    },
  );

  it.each(['', 'TRUE', 'yes', 'on', '0', 'false'])(
    'stays disabled in production for non-ON opt-in value (%p)',
    (flag) => {
      expect(
        isSwaggerEnabled({
          NODE_ENV: 'production',
          ENABLE_SWAGGER_IN_PROD: flag,
        }),
      ).toBe(false);
    },
  );
});

// W3 / INFO-14: INSECURE_JWT_SECRETS · KNOWN_EXAMPLE_ENCRYPTION_KEYS 동기화 의무를
// CI 회귀 방어선으로 고정한다. .env.example 또는 jwt.config.ts dev fallback 변경 시
// 누락이 자동으로 탐지된다.
describe('blacklist Set sync — .env.example & jwt.config.ts', () => {
  // .env.example 에서 JWT_SECRET placeholder 값을 파싱한다.
  // 행 형식: `JWT_SECRET=<value>` (주석 아님, 미주석 행만)
  function parseEnvExampleValue(
    content: string,
    key: string,
  ): string | undefined {
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match?.[1]?.trim();
  }

  // `.env.example` 읽기를 describe 최상위가 아닌 beforeAll 로 미룬다 — 최상위에서
  // 동기 read 하면 파일 부재/경로 불일치 시 Jest 수집 단계에서 throw 돼 *파일 전체*
  // 스위트가 로드 불가가 된다. beforeAll 안이면 이 블록만 실패한다.
  let envExampleContent: string;
  beforeAll(() => {
    const envExamplePath = path.resolve(__dirname, '../../../.env.example');
    envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');
  });

  it('INSECURE_JWT_SECRETS contains the .env.example JWT_SECRET placeholder', () => {
    const placeholder = parseEnvExampleValue(envExampleContent, 'JWT_SECRET');
    expect(placeholder).toBeDefined();
    expect(INSECURE_JWT_SECRETS.has(placeholder!)).toBe(true);
  });

  it('INSECURE_JWT_SECRETS contains the jwt.config.ts dev fallback', () => {
    // jwtConfig 는 registerAs 가 반환한 팩토리 함수 자체이므로, 직접 호출하면
    // 설정 객체를 반환한다 — process.env.JWT_SECRET 미설정 시 dev fallback
    // 'dev-jwt-secret' 가 cfg.secret 으로 반환된다.
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      const cfg = jwtConfig();
      expect(INSECURE_JWT_SECRETS.has(cfg.secret)).toBe(true);
    } finally {
      if (originalSecret !== undefined) {
        process.env.JWT_SECRET = originalSecret;
      }
    }
  });

  it('KNOWN_EXAMPLE_ENCRYPTION_KEYS contains the .env.example ENCRYPTION_KEY placeholder', () => {
    const placeholder = parseEnvExampleValue(
      envExampleContent,
      'ENCRYPTION_KEY',
    );
    expect(placeholder).toBeDefined();
    expect(KNOWN_EXAMPLE_ENCRYPTION_KEYS.has(placeholder!)).toBe(true);
  });
});
