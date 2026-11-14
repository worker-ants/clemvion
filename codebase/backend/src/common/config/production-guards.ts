/**
 * 부팅 시 production fail-closed 가드 (refactor 04 C-1·M-4·M-7).
 *
 * `NODE_ENV=production` 에서 **비보안 stub / 미설정·예시 secret / 위험 플래그**가 켜진 채
 * 부팅하려 하면 즉시 throw 해 기동을 거부한다. 기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE`
 * 인라인 가드(옛 main.ts)를 같은 블록으로 응집하고, 서명 비밀(`JWT_SECRET` · `INTERACTION_JWT_SECRET`)의
 * 예시 값 · 짧은 값도 여기서 막는다.
 * 정본: NERV 스펙 `CLE-ACCT-SESSION-GUARD` 「운영 환경 가드」(미러 `spec/CLE-ACCT/CLE-ACCT-SESSION-GUARD.md`) 표가 이
 * 함수가 검사하는 대상의 전체 목록이다. 검사를 더하거나 빼면 표에도 행을 더하거나 뺀다 —
 * `production-guards.spec.ts` 가 이 함수가 읽는 환경 변수와 표의 첫 열을 대조한다.
 * `INTERACTION_JWT_SECRET` 의 서명 용도는 `CLE-EIA`(REQ-EIA-018)가 정하고, 이 함수가 무엇을 거부하는지는
 * 같은 표가 정한다(CLE-T-0VV3VR).
 *
 * **dev/test/e2e 영향 없음**: 전부 `NODE_ENV !== 'production'` 에서 early-return.
 * (e2e 는 `NODE_ENV=test` — docker-compose.e2e.yml.)
 *
 * `main.ts` bootstrap 첫 단계에서 `assertProductionConfig(process.env)` 1회 호출한다.
 * 순수 함수로 분리해 전 분기를 단위 테스트로 검증한다.
 *
 * **경계 — 본 모듈은 throw 정책(fail-closed) 전용**이다. 절대 금지 secret/flag 는 여기서
 * throw 하고, 정당 용도가 있는 플래그(예: `ALLOW_PRIVATE_HOST_TARGETS`)의 warn 정책은
 * 호출자(`main.ts`)가 담당한다 — 신규 플래그 추가 시 "throw 면 여기, warn 이면 main.ts" 가 기준.
 *
 * **의도적 비통합**: CORS·`WEBAUTHN_*` 등은 각 모듈에서 유지한다 — 모듈 로컬 컨텍스트(DI·요청
 * 시점)가 필요하거나 정당 용도(WebAuthn 미사용 셀프호스팅 boot 허용)가 달라서다. 본 모듈에는
 * **env 만으로 부팅 직전 판정 가능한 절대-금지 항목**만 넣는다. `InteractionTokenService` 생성자의
 * throw(`INTERACTION_JWT_SECRET` · `JWT_SECRET` 이 둘 다 없을 때)는 `main.ts` 를 거치지 않는 경로를 위한
 * 이중 방어로 남는다.
 */

/**
 * production 에서 거부되는 JWT_SECRET 값 — 코드 기본 sentinel(`jwt.config.ts`)과 저장소에 커밋된 예시 값
 * (`.env.example` · k8s 예시 · 로컬 overlay · e2e compose · 루트 README). 가드는 앞뒤 공백을 뗀 값으로
 * 이 목록을 조회한다.
 * **동기화 의무**: `jwt.config.ts` 의 dev fallback 이나 예시 파일의 JWT_SECRET 값을 바꾸면 *옛 값을 지우지
 * 말고* 새 값을 더한다 — 옛 예시 값으로 운영 중인 배포도 계속 막아야 한다. 예시 파일 목록과 값 대조는
 * `production-guards.spec.ts` 가 한다.
 */
export const INSECURE_JWT_SECRETS: ReadonlySet<string> = new Set([
  'dev-jwt-secret', // jwt.config.ts dev fallback
  'change-me-to-a-long-random-jwt-secret', // .env.example placeholder
  'REPLACE_ME_AT_LEAST_32_BYTES', // k8s/base/secret.example.yaml
  'local-dev-jwt-secret-change-me-32-bytes-minimum', // k8s/overlays/local/secret.yaml
  'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7', // docker-compose.e2e.yml
  '<secret>', // 루트 README.md 예시
]);

/**
 * production 에서 거부되는 INTERACTION_JWT_SECRET 값. `INSECURE_JWT_SECRETS` 의 상위 집합이다 — 이 변수를
 * 설정하지 않으면 `JWT_SECRET` 으로 서명하므로, JWT_SECRET 예시 값을 이 자리에 옮겨 넣는 실수도 막는다.
 * 나머지는 저장소에 커밋된 예시 값이다(주석 처리한 예시 줄 포함).
 * **동기화 의무**: 예시 파일의 INTERACTION_JWT_SECRET 값을 바꾸면 *옛 값을 지우지 말고* 새 값을 더한다.
 * 예시 파일 목록과 값 대조는 `production-guards.spec.ts` 가 한다.
 */
export const INSECURE_INTERACTION_JWT_SECRETS: ReadonlySet<string> = new Set([
  ...INSECURE_JWT_SECRETS,
  'change-me-to-a-long-random-interaction-secret', // codebase/backend/.env.example (주석 줄)
]);

/**
 * production 에서 거부되는 ENCRYPTION_KEY 값 — 공개 저장소에 커밋된 예시 키(`.env.example` ·
 * k8s 예시 · 로컬 overlay · e2e compose · 루트 README). 이 값을 그대로 운영에 쓰면 secret store
 * 전체가 사실상 평문이 된다.
 * **동기화 의무**: 예시 파일의 ENCRYPTION_KEY 값을 바꾸면 *옛 값을 이 Set 에서 제거하지 말고* 새
 * 값을 추가한다 — 옛 예시 키로 운영 중인 배포도 계속 차단해야 한다. 예시 파일 목록과 값 대조는
 * `production-guards.spec.ts` 가 한다.
 */
export const KNOWN_EXAMPLE_ENCRYPTION_KEYS: ReadonlySet<string> = new Set([
  // 현 `.env.example` placeholder (all-zero). since 2026-06.
  '0000000000000000000000000000000000000000000000000000000000000000',
  // 옛 `.env.example` 예시 키 (~2026-06) — 그 값으로 운영 중인 배포도 차단.
  // 지금은 k8s/overlays/local · docker-compose.e2e.yml 이 이 값을 쓴다.
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'REPLACE_ME_32_BYTE_HEX', // k8s/base/secret.example.yaml
  '<32-byte-hex>', // 루트 README.md 예시
]);

/**
 * production 에서 거부되는 INTEGRATION_ENCRYPTION_KEY 값. `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 의 상위
 * 집합이다. 저장소에 커밋된 예시 · 로컬 · e2e 설정의 값이다. `ENCRYPTION_KEY` 예시 키도 함께
 * 막는다(INTEGRATION_ENCRYPTION_KEY 자리에 ENCRYPTION_KEY 예시값을 넣는 실수). 반대로
 * ENCRYPTION_KEY 자리에 이 Set 의 나머지 값을 넣는 경우는 막지 않는다.
 * **동기화 의무**: 예시 파일의 INTEGRATION_ENCRYPTION_KEY 값을 바꾸면 *옛 값을 지우지 말고* 새 값을
 * 더한다. 예시 파일 목록과 값 대조는 `production-guards.spec.ts` 가 한다.
 */
export const INSECURE_INTEGRATION_ENCRYPTION_KEYS: ReadonlySet<string> =
  new Set([
    ...KNOWN_EXAMPLE_ENCRYPTION_KEYS,
    'change-me-to-a-32-byte-secret', // codebase/backend/.env.example
    'REPLACE_ME', // k8s/base/secret.example.yaml
    'local-integration-key', // k8s/overlays/local/secret.yaml
    '0123456789abcdef0123456789abcdef', // docker-compose.e2e.yml
  ]);

/**
 * 예시값 목록 조회 — 원문과 `trim()` 한 값을 모두 본다. `.env` · Secret 에 옮기다 앞뒤 공백이나
 * 끝 개행이 붙은 예시값(`' REPLACE_ME '` 등)이 거부 목록을 빠져나가지 않게 한다. 값을 다듬는 것은
 * 조회에만 쓴다 — transformer 등 실제 키 사용처가 읽는 값은 바꾸지 않는다.
 */
function isListedExample(set: ReadonlySet<string>, value: string): boolean {
  return set.has(value) || set.has(value.trim());
}

/**
 * .env boolean 토글이 ON 인지 — 정확히 문자열 `'true'` 또는 `'1'` 만 ON 으로 본다.
 * `'yes'`/`'on'`/`'TRUE'`/`''` 등은 모두 OFF (대소문자·동의어 미허용으로 오설정의 우연한
 * 활성화를 줄인다). warn 정책 가드(main.ts)도 같은 규칙을 쓰도록 export 한다.
 *
 * @param value 검사할 환경변수 값 (미설정이면 `undefined`).
 * @returns `true` 이면 플래그 활성 (`'true'` 또는 `'1'`), 그 외 모두 `false`.
 */
export function isFlagOn(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

/** production JWT_SECRET 최소 길이(바이트) — 약한 secret 무차별 대입 방어(CWE-521). */
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Swagger UI(`/docs`) 노출 여부 — 04 M-1.
 *
 * non-production 에서는 항상 노출(개발 편의)하고, production 에서는 기본 미노출
 * 한다(무인증 API 표면 정찰 차단 — OWASP 정보 노출). prod 디버깅이 정말 필요한
 * 배포는 `ENABLE_SWAGGER_IN_PROD=true` opt-in escape hatch 로 의도적으로 켠다
 * (OAUTH/LLM stub 가드와 동형 패턴). 켜는 순간 무인증 노출 위험이 복귀하므로
 * 일시적 디버깅 용도로만 사용한다.
 *
 * @param env 검사할 환경변수 맵 (기본 `process.env`).
 * @returns Swagger 를 노출하면 `true`.
 */
export function isSwaggerEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV !== 'production') return true;
  return isFlagOn(env.ENABLE_SWAGGER_IN_PROD);
}

/**
 * production 에서 켜면 부팅을 거부하는 플래그와 거부 메시지. `isFlagOn` 으로 판정한다(`'true'` · `'1'`).
 *
 * - `MCP_ALLOW_INSECURE_URL`(04 M-7): SSRF 방어(https-only + 호스트 블록리스트)를 통째로 우회한다. spec
 *   (11-mcp-client §본문)이 "운영 환경에서 절대 활성화 금지" 로 명시했으므로 throw 한다. 정당한 self-host 용도가
 *   있는 ALLOW_PRIVATE_HOST_TARGETS 는 별개로 warn 이며 main.ts 가 처리한다.
 * - `ALLOW_HTTP_HOOKS`(CLE-T-VSAXG6): 알림 웹훅 URL 에 http:// 를 허용하는 개발용 플래그다. 켜지면 서명한 알림
 *   본문과 `X-Clemvion-*` 헤더가 평문으로 나간다. 기능은 `'1'` 일 때만 켜지지만(`ssrf-safe-url.util.ts`) 다른
 *   플래그와 같은 `isFlagOn` 으로 `'true'` 도 막는다 — 가드가 막는 값이 켜지는 값을 모두 담으면 된다.
 */
const FORBIDDEN_FLAGS: ReadonlyArray<{ key: string; message: string }> = [
  {
    key: 'OAUTH_STUB_MODE',
    message:
      'OAUTH_STUB_MODE=true 는 NODE_ENV=production 에서 허용되지 않습니다.',
  },
  {
    key: 'LLM_STUB_MODE',
    message:
      'LLM_STUB_MODE=true 는 NODE_ENV=production 에서 허용되지 않습니다.',
  },
  {
    key: 'MCP_ALLOW_INSECURE_URL',
    message:
      'MCP_ALLOW_INSECURE_URL=true 는 NODE_ENV=production 에서 허용되지 않습니다 ' +
      '(SSRF 방어 우회).',
  },
  {
    key: 'ALLOW_HTTP_HOOKS',
    message:
      'ALLOW_HTTP_HOOKS 는 NODE_ENV=production 에서 켤 수 없습니다 ' +
      '(알림 웹훅이 평문 http 로 나감).',
  },
];

/**
 * 서명 비밀(`JWT_SECRET` · `INTERACTION_JWT_SECRET`) 검사 — 미설정 · 공백뿐 · 예시 값이면 `emptyMessage`,
 * 앞뒤 공백을 뗀 길이가 하한 미만이면 길이 메시지로 `fail` 한다. 뗀 값은 검사에만 쓴다.
 */
function checkSigningSecret(opts: {
  name: string;
  raw: string | undefined;
  rejected: ReadonlySet<string>;
  emptyMessage: string;
  shortHint: string;
  fail: (message: string) => never;
}): void {
  const secret = opts.raw?.trim();
  if (!secret || opts.rejected.has(secret)) {
    opts.fail(opts.emptyMessage);
  } else if (secret.length < MIN_JWT_SECRET_LENGTH) {
    opts.fail(
      `${opts.name} 가 너무 짧습니다(앞뒤 공백을 뺀 길이 ${secret.length} < ${MIN_JWT_SECRET_LENGTH}) — ` +
        opts.shortHint,
    );
  }
}

/**
 * production 부팅 가드. 위반 시 `Error` throw (fail-closed). 비-production 은 no-op.
 *
 * @param env 검사할 환경변수 맵 (기본 `process.env`). 테스트에서 주입.
 * @throws {Error} NODE_ENV=production 에서 비보안 stub·미설정/예시 secret·위험 플래그
 *   위반 발견 시 "production fail-closed 가드: <사유>" 메시지와 함께 throw 해 기동을 거부한다.
 */
export function assertProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV !== 'production') return;

  // 첫 위반에서 즉시 throw (fail-fast) — 부팅을 멈추는 게 목적이라 모든 위반을 모을
  // 필요가 없다. 운영자는 한 건씩 고치며 재부팅한다.
  const fail = (message: string): never => {
    throw new Error(`production fail-closed 가드: ${message}`);
  };

  // 켜면 안 되는 플래그. 비보안 stub 은 실 검증/실 LLM 호출을 우회하고, 나머지는 SSRF 방어나 전송 구간 암호화를
  // 끈다. 플래그를 더할 때는 `FORBIDDEN_FLAGS` 에 한 줄을 넣는다.
  for (const { key, message } of FORBIDDEN_FLAGS) {
    if (isFlagOn(env[key])) fail(message);
  }

  // 04 C-1 — JWT_SECRET 미설정/기본 sentinel/예시값이면 기본 secret 으로 서명된
  // 토큰 위조(인증 우회)가 가능하므로 부팅 거부.
  // 앞뒤 공백을 뗀 값으로 검사한다(CLE-T-HD6SJ4) — Secret · `.env` 로 옮기다 붙은 개행이 예시 값 대조와
  // 길이 하한을 빠져나가지 않게 한다. 뗀 값은 검사에만 쓰고 서명에 쓰는 값(`jwt.config.ts`)은 그대로다.
  checkSigningSecret({
    name: 'JWT_SECRET',
    raw: env.JWT_SECRET,
    rejected: INSECURE_JWT_SECRETS,
    emptyMessage:
      'JWT_SECRET 가 미설정이거나 공백뿐이거나 예시/기본값입니다 — 운영용 무작위 secret 을 설정하세요 ' +
      '(기본값 서명은 인증 우회 위험).',
    shortHint:
      '약한 secret 은 무차별 대입에 취약합니다. `openssl rand -hex 32` 등으로 충분히 긴 ' +
      '무작위 값을 설정하세요(CWE-521).',
    fail,
  });

  // CLE-T-0VV3VR — INTERACTION_JWT_SECRET 은 외부 인터랙션 토큰(`iext_*`)을 서명한다. 설정하지 않으면
  // JWT_SECRET 으로 서명하므로(위에서 검사) 설정했을 때만 본다. 빈 문자열은 미설정으로 보지 않고 막는다 —
  // `InteractionTokenService` 는 `??` 로 대체하므로 빈 값을 JWT_SECRET 으로 대신하지 않는다.
  // 앞뒤 공백을 뗀 값으로 예시 대조와 길이 하한을 건다(JWT_SECRET 과 같은 규칙). 거부한 값은 메시지에 넣지 않는다.
  if (env.INTERACTION_JWT_SECRET !== undefined) {
    checkSigningSecret({
      name: 'INTERACTION_JWT_SECRET',
      raw: env.INTERACTION_JWT_SECRET,
      rejected: INSECURE_INTERACTION_JWT_SECRETS,
      emptyMessage:
        'INTERACTION_JWT_SECRET 가 빈 값이거나 공백뿐이거나 예시/기본값입니다 — 운영용 무작위 secret 을 ' +
        '설정하거나, JWT_SECRET 으로 서명하려면 변수를 지우세요(예시 값 서명은 인터랙션 토큰 위조 위험).',
      shortHint:
        '`openssl rand -hex 32` 등으로 충분히 긴 무작위 값을 설정하세요(CWE-521).',
      fail,
    });
  }

  // 04 M-4 — ENCRYPTION_KEY 가 미설정이거나 공개 .env.example 예시 키면 secret store 가
  // 사실상 평문이므로 부팅 거부. (빈 값은 SecretResolver init 에서도 throw 되나, 여기서
  // 예시 키 케이스까지 부팅 초기에 일괄 차단한다.)
  // 시크릿마다 공백 처리가 다른 것은 의도다(스펙 CLE-ACCT-SESSION-GUARD 「운영 환경 가드」). JWT_SECRET 은 앞뒤 공백을 뗀
  // 값으로 예시 대조와 길이 하한을 건다. ENCRYPTION_KEY · INTEGRATION_ENCRYPTION_KEY 는 원문과 `trim()` 한 값을
  // 모두 예시 목록과 대조하고 길이 하한은 없다(이미 그 키로 암호화한 행이 있어 값을 다듬어 쓰지 않는다).
  const encryptionKey = env.ENCRYPTION_KEY;
  if (
    !encryptionKey ||
    encryptionKey.trim() === '' ||
    isListedExample(KNOWN_EXAMPLE_ENCRYPTION_KEYS, encryptionKey)
  ) {
    fail(
      'ENCRYPTION_KEY 가 미설정이거나 공개 예시 키입니다 — `openssl rand -hex 32` 로 ' +
        '운영용 키를 새로 생성하세요 (예시 키는 사실상 평문).',
    );
  }

  // INTEGRATION_ENCRYPTION_KEY 는 통합 자격 증명 · 인증 설정 컬럼 transformer
  // (`credentials-transformer.ts`)의 키다. 키가 없으면 transformer 가 경고만 남기고 평문으로
  // 저장하므로 운영 부팅을 거부한다. 예시값도 공개된 값이라 같이 거부한다. 길이 하한은 두지
  // 않는다 — transformer 가 SHA-256 으로 키를 만들어 길이를 받고, 이미 그 키로 암호화한 행은
  // 키를 바꾸면 복호화되지 않는다. 메시지에는 키 값을 싣지 않는다.
  const integrationKey = env.INTEGRATION_ENCRYPTION_KEY;
  if (
    !integrationKey ||
    integrationKey.trim() === '' ||
    isListedExample(INSECURE_INTEGRATION_ENCRYPTION_KEYS, integrationKey)
  ) {
    fail(
      'INTEGRATION_ENCRYPTION_KEY 가 미설정이거나 공개 예시 값입니다 — 이 키가 없으면 통합 ' +
        '자격 증명과 인증 설정이 평문으로 저장됩니다. `openssl rand -hex 32` 로 운영용 키를 ' +
        '새로 생성하세요.',
    );
  }
}
