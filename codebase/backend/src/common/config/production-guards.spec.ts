/**
 * production fail-closed 가드 단위 테스트 (refactor 04 C-1·M-4·M-7).
 * 순수 함수라 env 맵을 주입해 전 분기를 검증한다 — 실제 부팅 불필요.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { jwtConfig } from './jwt.config';
import { llmConfig } from './llm.config';
import { mcpConfig } from './mcp.config';
import { isOAuthStubModeAllowed } from '../utils/oauth-stub-mode';
import { checkSsrfSafeUrl } from '../utils/ssrf-safe-url.util';
import {
  assertProductionConfig,
  isFlagOn,
  isSwaggerEnabled,
  INSECURE_JWT_SECRETS,
  INSECURE_INTERACTION_JWT_SECRETS,
  INSECURE_INTEGRATION_ENCRYPTION_KEYS,
  KNOWN_EXAMPLE_ENCRYPTION_KEYS,
  MIN_JWT_SECRET_LENGTH,
} from './production-guards';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

const VALID_JWT = 'a-real-long-random-production-jwt-secret-0123456789';
const VALID_ENC =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const VALID_INTEGRATION_ENC = 'a-real-random-production-integration-key-42';

function prodEnv(over: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: VALID_JWT,
    ENCRYPTION_KEY: VALID_ENC,
    INTEGRATION_ENCRYPTION_KEY: VALID_INTEGRATION_ENC,
    ...over,
  };
}

/** 가드가 던진 메시지. 던지지 않으면 테스트를 실패시킨다. */
function thrownMessage(env: NodeJS.ProcessEnv): string {
  try {
    assertProductionConfig(env);
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error('assertProductionConfig did not throw');
}

/** `process.env` 의 몇 키를 바꿔 `fn` 을 부르고 원래 값으로 되돌린다(`undefined` 는 키를 지운다). */
function withProcessEnv<T>(
  over: Record<string, string | undefined>,
  fn: () => T,
): T {
  const saved = Object.keys(over).map((k) => [k, process.env[k]] as const);
  const apply = (
    entries: ReadonlyArray<readonly [string, string | undefined]>,
  ) => {
    for (const [k, v] of entries) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  try {
    apply(Object.entries(over));
    return fn();
  } finally {
    apply(saved);
  }
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
          INTEGRATION_ENCRYPTION_KEY: '',
          MCP_ALLOW_INSECURE_URL: 'true',
        }),
      ).not.toThrow();
    }
  });

  it('passes when all production secrets/flags are valid', () => {
    expect(() => assertProductionConfig(prodEnv())).not.toThrow();
  });

  // 켜짐으로 보는 값은 `isFlagOn` 하나가 정한다 — 정확히 'true' · '1'. 기능이 실제로 켜지는 값이 이 안에
  // 드는지는 아래 「flag guard covers every value that turns the feature on」 이 본다.
  describe.each([
    'OAUTH_STUB_MODE',
    'LLM_STUB_MODE',
    'MCP_ALLOW_INSECURE_URL',
    'ALLOW_HTTP_HOOKS',
  ])('flag %s', (flag) => {
    it.each(['true', '1'])('throws when set to %p in production', (v) => {
      expect(() => assertProductionConfig(prodEnv({ [flag]: v }))).toThrow(
        new RegExp(flag),
      );
    });
    it.each(['TRUE', 'True', 'yes', 'on', '0', 'false', '', ' 1', 'true\n'])(
      'does NOT throw for non-standard value %p (treated as off)',
      (v) => {
        expect(() =>
          assertProductionConfig(prodEnv({ [flag]: v })),
        ).not.toThrow();
      },
    );
    it('passes when unset', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ [flag]: undefined })),
      ).not.toThrow();
    });
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
    // 앞뒤 공백을 뗀 값으로 검사한다(CLE-T-HD6SJ4). Secret · `.env` 로 옮기다 붙은 개행이 예시 값 대조와 길이
    // 하한을 빠져나가지 못하게 한다. 뗀 값은 검사에만 쓰고 서명에 쓰는 값(`jwt.config.ts`)은 바꾸지 않는다.
    it.each([' ', '\n', ' \t\n ', ' '.repeat(MIN_JWT_SECRET_LENGTH + 8)])(
      'throws when whitespace-only (%p)',
      (v) => {
        expect(() =>
          assertProductionConfig(prodEnv({ JWT_SECRET: v })),
        ).toThrow(/JWT_SECRET/);
      },
    );
    it.each(['{key}\n', ' {key} ', '\t{key}\r\n'])(
      'throws for a known example value padded with whitespace (%p)',
      (template) => {
        for (const bad of INSECURE_JWT_SECRETS) {
          expect(() =>
            assertProductionConfig(
              prodEnv({ JWT_SECRET: template.replace('{key}', bad) }),
            ),
          ).toThrow(/JWT_SECRET/);
        }
      },
    );
    it('measures the minimum length after trimming', () => {
      const short = 'x'.repeat(MIN_JWT_SECRET_LENGTH - 1);
      for (const padded of [`${short}\n`, ` ${short} `, `\t\t${short}`]) {
        // 원래 값은 하한 이상이지만 뗀 값은 하한보다 한 글자 짧다.
        expect(padded.length).toBeGreaterThanOrEqual(MIN_JWT_SECRET_LENGTH);
        expect(() =>
          assertProductionConfig(prodEnv({ JWT_SECRET: padded })),
        ).toThrow(/JWT_SECRET/);
      }
    });
    it('passes for a long non-example secret that has surrounding whitespace', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ JWT_SECRET: ` ${VALID_JWT}\n` })),
      ).not.toThrow();
    });
    it('does not echo the rejected value in the error message', () => {
      for (const bad of [
        'change-me-to-a-long-random-jwt-secret\n',
        'short-but-not-blocklisted',
      ]) {
        const message = thrownMessage(prodEnv({ JWT_SECRET: bad }));
        expect(message).toMatch(/JWT_SECRET/);
        expect(message).not.toContain(bad.trim());
      }
    });
  });

  describe('ENCRYPTION_KEY (04 M-4)', () => {
    it('throws when unset', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ ENCRYPTION_KEY: undefined })),
      ).toThrow(/\bENCRYPTION_KEY/);
    });
    it('throws when empty string', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ ENCRYPTION_KEY: '' })),
      ).toThrow(/\bENCRYPTION_KEY/);
    });
    it('throws for each known public example key', () => {
      for (const bad of KNOWN_EXAMPLE_ENCRYPTION_KEYS) {
        expect(() =>
          assertProductionConfig(prodEnv({ ENCRYPTION_KEY: bad })),
        ).toThrow(/\bENCRYPTION_KEY/);
      }
    });
    it.each([' ', '   ', '\n', ' \t\n '])(
      'throws when whitespace-only (%p)',
      (v) => {
        expect(() =>
          assertProductionConfig(prodEnv({ ENCRYPTION_KEY: v })),
        ).toThrow(/\bENCRYPTION_KEY/);
      },
    );
    // `.env` 에 옮기다 앞뒤 공백 · 끝 개행이 붙은 예시 키도 거부 목록을 빠져나가면 안 된다.
    it.each(['{key}\n', ' {key} ', '\t{key}\r\n'])(
      'throws for a known example key padded with whitespace (%p)',
      (template) => {
        for (const bad of KNOWN_EXAMPLE_ENCRYPTION_KEYS) {
          expect(() =>
            assertProductionConfig(
              prodEnv({ ENCRYPTION_KEY: template.replace('{key}', bad) }),
            ),
          ).toThrow(/\bENCRYPTION_KEY/);
        }
      },
    );
    // INFO-12: 유효한 non-example 키는 통과해야 함 (JWT_SECRET 의 긍정 케이스와 대칭).
    it('passes for a valid non-example key', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ ENCRYPTION_KEY: VALID_ENC })),
      ).not.toThrow();
    });
    it('does not echo the rejected value in the error message', () => {
      for (const bad of KNOWN_EXAMPLE_ENCRYPTION_KEYS) {
        const message = thrownMessage(prodEnv({ ENCRYPTION_KEY: bad }));
        expect(message).toMatch(/\bENCRYPTION_KEY/);
        expect(message).not.toContain(bad);
      }
    });
    // CLE-ACCT-SESSION 「암호화 키 검사」: 통합 키 목록은 마스터키 목록을 모두 담지만 반대는 아니다. 통합 키에만 있는
    // 예시 값을 마스터키 자리에 넣으면 막지 않는다. 지금의 비대칭을 고정한다 — 바꾸면 스펙도 함께 고친다.
    it('passes for an example value listed only for INTEGRATION_ENCRYPTION_KEY (documented asymmetry)', () => {
      const integrationOnly = [...INSECURE_INTEGRATION_ENCRYPTION_KEYS].filter(
        (v) => !KNOWN_EXAMPLE_ENCRYPTION_KEYS.has(v),
      );
      expect(integrationOnly.length).toBeGreaterThan(0);
      for (const v of integrationOnly) {
        expect(() =>
          assertProductionConfig(prodEnv({ ENCRYPTION_KEY: v })),
        ).not.toThrow();
      }
    });
  });

  // INTEGRATION_ENCRYPTION_KEY 는 통합 자격 증명 · 인증 설정 컬럼 transformer 의 키다. 키가 없으면
  // transformer 가 평문으로 저장하므로 운영 부팅을 막는다(finding 01a0e59c-eea2-7590-953c-2899ba1c5ad4).
  // 메시지에 `INTEGRATION_ENCRYPTION_KEY` 가 들어가 위 블록의 정규식은 단어 경계(\b)로 좁혔다.
  describe('INTEGRATION_ENCRYPTION_KEY', () => {
    it('throws when unset', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({ INTEGRATION_ENCRYPTION_KEY: undefined }),
        ),
      ).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });
    it.each(['', '   '])('throws when empty or blank (%p)', (v) => {
      expect(() =>
        assertProductionConfig(prodEnv({ INTEGRATION_ENCRYPTION_KEY: v })),
      ).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
    });
    it('throws for each known example value', () => {
      for (const bad of INSECURE_INTEGRATION_ENCRYPTION_KEYS) {
        expect(() =>
          assertProductionConfig(prodEnv({ INTEGRATION_ENCRYPTION_KEY: bad })),
        ).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
      }
    });
    // `.env` 에 옮기다 앞뒤 공백 · 끝 개행이 붙은 예시값도 거부 목록을 빠져나가면 안 된다.
    it.each(['{key}\n', ' {key} ', '\t{key}\r\n'])(
      'throws for a known example value padded with whitespace (%p)',
      (template) => {
        for (const bad of INSECURE_INTEGRATION_ENCRYPTION_KEYS) {
          expect(() =>
            assertProductionConfig(
              prodEnv({
                INTEGRATION_ENCRYPTION_KEY: template.replace('{key}', bad),
              }),
            ),
          ).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
        }
      },
    );
    it('INSECURE_INTEGRATION_ENCRYPTION_KEYS is a superset of KNOWN_EXAMPLE_ENCRYPTION_KEYS', () => {
      for (const bad of KNOWN_EXAMPLE_ENCRYPTION_KEYS) {
        expect(INSECURE_INTEGRATION_ENCRYPTION_KEYS.has(bad)).toBe(true);
      }
    });
    it('does not echo the rejected value in the error message', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({
            INTEGRATION_ENCRYPTION_KEY: 'change-me-to-a-32-byte-secret',
          }),
        ),
      ).toThrow(
        expect.objectContaining({
          message: expect.not.stringContaining('change-me-to-a-32-byte-secret'),
        }),
      );
    });
    // 길이 하한은 두지 않는다 — transformer 가 SHA-256 으로 키를 만들어 길이를 받고, 이미 짧은 키로
    // 암호화한 운영 행은 키를 바꾸면 복호화되지 않는다.
    it('passes for a short but non-example key (no minimum length)', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({ INTEGRATION_ENCRYPTION_KEY: 'short-key' }),
        ),
      ).not.toThrow();
    });
    it('passes for a valid non-example key', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({ INTEGRATION_ENCRYPTION_KEY: VALID_INTEGRATION_ENC }),
        ),
      ).not.toThrow();
    });
    // 조회에만 `trim()` 을 쓴다 — 예시값이 아닌 키는 앞뒤 공백이 있어도 거부하지 않는다
    // (transformer 가 읽는 키 값 자체를 가드가 바꾸거나 판정에서 달리 보지 않는다).
    it('passes for a non-example key that has surrounding whitespace', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({
            INTEGRATION_ENCRYPTION_KEY: ` ${VALID_INTEGRATION_ENC}\n`,
          }),
        ),
      ).not.toThrow();
    });
  });

  // CLE-T-0VV3VR — 실행 단위 인터랙션 토큰(`iext_*`)의 서명 비밀. 설정했을 때만 JWT_SECRET 과 같은 규칙으로 본다.
  describe('INTERACTION_JWT_SECRET (CLE-T-0VV3VR)', () => {
    const VALID_INTERACTION =
      'a-real-long-random-interaction-secret-9876543210';

    it('passes when unset (JWT_SECRET signs iext_* and is checked separately)', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ INTERACTION_JWT_SECRET: undefined })),
      ).not.toThrow();
    });

    it('passes for a sufficiently long random secret', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({ INTERACTION_JWT_SECRET: VALID_INTERACTION }),
        ),
      ).not.toThrow();
    });

    // 서명 비밀을 고르는 코드가 `??` 로 대체하므로 빈 문자열은 JWT_SECRET 으로 넘어가지 않는다 — «미설정» 이 아니다.
    it('throws when set to an empty string', () => {
      expect(() =>
        assertProductionConfig(prodEnv({ INTERACTION_JWT_SECRET: '' })),
      ).toThrow(/INTERACTION_JWT_SECRET/);
    });

    it.each([' ', '\n', ' \t\n ', ' '.repeat(MIN_JWT_SECRET_LENGTH + 8)])(
      'throws for a whitespace-only value (%p)',
      (v) => {
        expect(() =>
          assertProductionConfig(prodEnv({ INTERACTION_JWT_SECRET: v })),
        ).toThrow(/INTERACTION_JWT_SECRET/);
      },
    );

    it('throws for each known example value', () => {
      for (const bad of INSECURE_INTERACTION_JWT_SECRETS) {
        expect(() =>
          assertProductionConfig(prodEnv({ INTERACTION_JWT_SECRET: bad })),
        ).toThrow(/INTERACTION_JWT_SECRET/);
      }
    });

    it('INSECURE_INTERACTION_JWT_SECRETS is a superset of INSECURE_JWT_SECRETS', () => {
      for (const v of INSECURE_JWT_SECRETS) {
        expect(INSECURE_INTERACTION_JWT_SECRETS.has(v)).toBe(true);
      }
    });

    it.each(['{key}\n', ' {key} ', '\t{key}\r\n'])(
      'throws for an example value wrapped in whitespace (%p)',
      (template) => {
        for (const bad of INSECURE_INTERACTION_JWT_SECRETS) {
          expect(() =>
            assertProductionConfig(
              prodEnv({
                INTERACTION_JWT_SECRET: template.replace('{key}', bad),
              }),
            ),
          ).toThrow(/INTERACTION_JWT_SECRET/);
        }
      },
    );

    it('throws when shorter than the minimum length after trimming', () => {
      const short = 'x'.repeat(MIN_JWT_SECRET_LENGTH - 1);
      expect(() =>
        assertProductionConfig(prodEnv({ INTERACTION_JWT_SECRET: short })),
      ).toThrow(/INTERACTION_JWT_SECRET 가 너무 짧습니다/);
      // 공백으로 32자를 채워도 뗀 길이로 잰다.
      expect(() =>
        assertProductionConfig(
          prodEnv({ INTERACTION_JWT_SECRET: `${short}\n` }),
        ),
      ).toThrow(/INTERACTION_JWT_SECRET 가 너무 짧습니다/);
    });

    it('passes at exactly the minimum length', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({
            INTERACTION_JWT_SECRET: 'y'.repeat(MIN_JWT_SECRET_LENGTH),
          }),
        ),
      ).not.toThrow();
    });

    it('passes for a long non-example secret that has surrounding whitespace', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({ INTERACTION_JWT_SECRET: ` ${VALID_INTERACTION}\n` }),
        ),
      ).not.toThrow();
    });

    it('does not echo the rejected value in the error message', () => {
      for (const bad of [
        ...INSECURE_INTERACTION_JWT_SECRETS,
        'short-interaction-secret',
      ]) {
        const message = thrownMessage(prodEnv({ INTERACTION_JWT_SECRET: bad }));
        expect(message).not.toContain(bad);
      }
    });

    // JWT_SECRET 은 액세스 토큰도 서명하므로 INTERACTION_JWT_SECRET 이 유효해도 따로 막는다.
    it('still rejects an insecure JWT_SECRET when INTERACTION_JWT_SECRET is valid', () => {
      expect(() =>
        assertProductionConfig(
          prodEnv({
            INTERACTION_JWT_SECRET: VALID_INTERACTION,
            JWT_SECRET: 'dev-jwt-secret',
          }),
        ),
      ).toThrow(/JWT_SECRET 가 미설정이거나/);
    });

    it('is a no-op outside production', () => {
      expect(() =>
        assertProductionConfig({
          NODE_ENV: 'development',
          INTERACTION_JWT_SECRET:
            'change-me-to-a-long-random-interaction-secret',
        }),
      ).not.toThrow();
    });
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
});

// 가드가 막는 값 ⊇ 기능이 켜지는 값. 각 기능이 실제로 쓰는 판정(설정 모듈 · 헬퍼)을 불러 대조한다.
// 켜지는 값이 스펙 CLE-ACCT-SESSION 「운영 환경 가드」 에 적혀 있어 `onValues` 로 고정한다 — 판정을 바꾸면 스펙도 고친다.
describe('flag guard covers every value that turns the feature on', () => {
  const CANDIDATES = [
    'true',
    '1',
    'TRUE',
    'True',
    'yes',
    'on',
    'y',
    '0',
    'false',
    'off',
    '',
    ' true',
    'true ',
    ' 1',
    '1\n',
  ];
  const FEATURES: {
    flag: string;
    isOn: () => boolean;
    onValues: string[];
  }[] = [
    // OAuth 스텁의 단일 판정(W-74). 운영 환경에서는 늘 꺼지므로 NODE_ENV=test 로 판정만 본다.
    {
      flag: 'OAUTH_STUB_MODE',
      isOn: () => isOAuthStubModeAllowed(),
      onValues: ['true'],
    },
    {
      flag: 'LLM_STUB_MODE',
      isOn: () => llmConfig().stubMode,
      onValues: ['true'],
    },
    {
      flag: 'MCP_ALLOW_INSECURE_URL',
      isOn: () => mcpConfig().allowInsecureUrl,
      onValues: ['true', '1'],
    },
    // 알림 웹훅 URL 검사. 이 플래그는 http 스킴만 연다.
    {
      flag: 'ALLOW_HTTP_HOOKS',
      isOn: () => checkSsrfSafeUrl('http://example.com/hook').ok,
      onValues: ['1'],
    },
  ];

  it.each(FEATURES)('$flag', ({ flag, isOn, onValues }) => {
    const turnedOn = CANDIDATES.filter((v) =>
      withProcessEnv({ NODE_ENV: 'test', [flag]: v }, isOn),
    );
    expect(turnedOn).toEqual(onValues);
    for (const v of turnedOn) {
      expect(() => assertProductionConfig(prodEnv({ [flag]: v }))).toThrow(
        new RegExp(flag),
      );
    }
  });
});

// 정본 가드 목록(CLE-ACCT-SESSION 「운영 환경 가드」 표)과 코드를 잇는다. 함수가 읽는 환경 변수를 기록해 표의 첫 열과
// 견준다. 검사를 더하거나 빼면 표에 행을 더한 스펙이 승인되고 미러를 받을 때까지 이 테스트가 실패한다(의도).
describe('production guard list matches CLE-ACCT-SESSION 「운영 환경 가드」', () => {
  const SPEC_MIRROR = path.join(REPO_ROOT, 'spec/CLE-ACCT/CLE-ACCT-SESSION.md');

  function settingsInSpecTable(markdown: string): string[] {
    const start = markdown.indexOf('\n## 운영 환경 가드\n');
    // 헤딩이 바뀌었거나 미러 형식이 달라지면 빈 표끼리 비교해 통과하지 않도록 원인을 알린다.
    if (start < 0) {
      throw new Error(
        `${SPEC_MIRROR} 에서 「## 운영 환경 가드」 절을 찾지 못했다 — 헤딩이 바뀌었는지 확인한다.`,
      );
    }
    const rest = markdown.slice(start + 1);
    const end = rest.search(/\n#{2,3} /);
    const section = end === -1 ? rest : rest.slice(0, end);
    const rows = [...section.matchAll(/^\| `([A-Z][A-Z0-9_]*)`/gm)].map(
      (m) => m[1],
    );
    if (rows.length === 0) {
      throw new Error(
        '「운영 환경 가드」 절에서 `| \\`KEY\\`` 로 시작하는 표 행을 하나도 파싱하지 못했다 — 표 형식을 확인한다.',
      );
    }
    return rows;
  }

  function envKeysReadByGuard(): string[] {
    const read = new Set<string>();
    const env = new Proxy(prodEnv(), {
      get(target, prop, receiver) {
        if (typeof prop === 'string') read.add(prop);
        return Reflect.get(target, prop, receiver) as unknown;
      },
    });
    // 이 방식은 두 전제에 기댄다. 가드가 첫 위반에서 throw 하므로 모든 값이 유효해야 모든 검사가 값을 읽고, 가드는
    // `env.KEY` 로 직접 읽어야 한다(구조 분해 · `in` · 전체 복사는 get 트랩을 지난다고 보장하지 못한다).
    expect(() => assertProductionConfig(env)).not.toThrow();
    read.delete('NODE_ENV');
    // 읽은 키가 없으면 정렬한 두 빈 목록이 같지 않아도 원인이 흐려지므로 먼저 막는다.
    expect(read.size).toBeGreaterThan(0);
    return [...read];
  }

  it('the table rows equal the env vars assertProductionConfig reads', () => {
    const markdown = fs.readFileSync(SPEC_MIRROR, 'utf-8');
    expect(settingsInSpecTable(markdown).sort()).toEqual(
      envKeysReadByGuard().sort(),
    );
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

  it('INSECURE_INTEGRATION_ENCRYPTION_KEYS contains the .env.example INTEGRATION_ENCRYPTION_KEY placeholder', () => {
    const placeholder = parseEnvExampleValue(
      envExampleContent,
      'INTEGRATION_ENCRYPTION_KEY',
    );
    expect(placeholder).toBeDefined();
    expect(INSECURE_INTEGRATION_ENCRYPTION_KEYS.has(placeholder!)).toBe(true);
  });
});

/** 운영 비밀의 예시 값이 커밋된 저장소 파일(저장소 루트 기준). */
const EXAMPLE_FILES = [
  'codebase/backend/.env.example',
  'k8s/base/secret.example.yaml',
  'k8s/overlays/local/secret.yaml',
  'docker-compose.e2e.yml',
  'README.md',
];

// 저장소에 커밋된 예시 · 로컬 · e2e 설정의 `JWT_SECRET` 과 두 암호화 키 값이 운영 가드의 예시값 집합에 다 들어 있는지
// 본다. 누가 이 값을 그대로 운영에 복사해도 부팅이 막혀야 한다. 파일에 키 줄을 더하거나 값을 바꾸면
// 집합도 함께 고쳐야 이 테스트가 통과한다(옛 값은 집합에서 지우지 않는다).
describe('example key values committed in the repo are all rejected in production', () => {
  // `KEY=value` (dotenv · README) 와 `KEY: value` / `KEY: "value"` (YAML) 를 함께 받는다.
  const keyLine = (key: string) =>
    new RegExp(`^[ \\t]*${key}[ \\t]*[=:][ \\t]*"?([^"\\s#]+)"?`, 'gm');
  function valuesOf(content: string, key: string): string[] {
    return [...content.matchAll(keyLine(key))].map((m) => m[1]);
  }

  it.each(EXAMPLE_FILES)('%s', (rel) => {
    const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
    const jwtValues = valuesOf(content, 'JWT_SECRET');
    const encValues = valuesOf(content, 'ENCRYPTION_KEY');
    const integrationValues = valuesOf(content, 'INTEGRATION_ENCRYPTION_KEY');
    // 파일마다 세 키가 한 줄 이상 잡혀야 한다 — 정규식이 아무것도 못 잡아 통과하는 것을 막는다.
    expect(jwtValues.length).toBeGreaterThan(0);
    expect(encValues.length).toBeGreaterThan(0);
    expect(integrationValues.length).toBeGreaterThan(0);
    for (const v of jwtValues) {
      expect({
        key: 'JWT_SECRET',
        value: v,
        rejected: INSECURE_JWT_SECRETS.has(v),
      }).toEqual({
        key: 'JWT_SECRET',
        value: v,
        rejected: true,
      });
    }
    for (const v of encValues) {
      expect({
        key: 'ENCRYPTION_KEY',
        value: v,
        rejected: KNOWN_EXAMPLE_ENCRYPTION_KEYS.has(v),
      }).toEqual({
        key: 'ENCRYPTION_KEY',
        value: v,
        rejected: true,
      });
    }
    for (const v of integrationValues) {
      expect({
        key: 'INTEGRATION_ENCRYPTION_KEY',
        value: v,
        rejected: INSECURE_INTEGRATION_ENCRYPTION_KEYS.has(v),
      }).toEqual({
        key: 'INTEGRATION_ENCRYPTION_KEY',
        value: v,
        rejected: true,
      });
    }
  });
});

// CLE-T-0VV3VR — `INTERACTION_JWT_SECRET` 은 `.env.example` 에 주석 줄로만 있다. 운영자가 주석을 풀어 그대로 쓰는
// 경우를 막아야 하므로 주석 줄의 값도 예시 값으로 본다. 파일마다 이 키가 있을 필요는 없지만 전체에서 하나도 못 잡으면
// 정규식이 어긋난 것이라 실패시킨다.
describe('INTERACTION_JWT_SECRET example values committed in the repo (commented lines included) are rejected', () => {
  const interactionLine =
    /^[ \t]*#?[ \t]*INTERACTION_JWT_SECRET[ \t]*[=:][ \t]*"?([^"\s#]+)"?/gm;

  it('every committed example value is in INSECURE_INTERACTION_JWT_SECRETS', () => {
    const found: Array<{ file: string; value: string; rejected: boolean }> = [];
    for (const rel of EXAMPLE_FILES) {
      const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
      for (const m of content.matchAll(interactionLine)) {
        found.push({
          file: rel,
          value: m[1],
          rejected: INSECURE_INTERACTION_JWT_SECRETS.has(m[1]),
        });
      }
    }
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((f) => !f.rejected)).toEqual([]);
  });

  it('the guard rejects each committed example value in production', () => {
    for (const rel of EXAMPLE_FILES) {
      const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
      for (const m of content.matchAll(interactionLine)) {
        expect(() =>
          assertProductionConfig(prodEnv({ INTERACTION_JWT_SECRET: m[1] })),
        ).toThrow(/INTERACTION_JWT_SECRET/);
      }
    }
  });
});
