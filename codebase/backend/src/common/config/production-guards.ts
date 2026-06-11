/**
 * 부팅 시 production fail-closed 가드 (refactor 04 C-1·M-4·M-7).
 *
 * `NODE_ENV=production` 에서 **비보안 stub / 미설정·예시 secret / 위험 플래그**가 켜진 채
 * 부팅하려 하면 즉시 throw 해 기동을 거부한다. 기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE`
 * 인라인 가드(옛 main.ts)를 같은 블록으로 응집하고, 동형 secret 들(`INTERACTION_JWT_SECRET`
 * 의 fail-closed — [EIA §R](../../modules/external-interaction/interaction-token.service.ts))과
 * 대칭을 맞춘다.
 *
 * **dev/test/e2e 영향 없음**: 전부 `NODE_ENV !== 'production'` 에서 early-return.
 * (e2e 는 `NODE_ENV=test` — docker-compose.e2e.yml.)
 *
 * `main.ts` bootstrap 첫 단계에서 `assertProductionConfig(process.env)` 1회 호출한다.
 * 순수 함수로 분리해 전 분기를 단위 테스트로 검증한다.
 */

/** production 에서 거부되는 JWT_SECRET 값 — 코드 기본 sentinel + `.env.example` placeholder. */
export const INSECURE_JWT_SECRETS: ReadonlySet<string> = new Set([
  'dev-jwt-secret',
  'change-me-to-a-long-random-jwt-secret',
]);

/**
 * production 에서 거부되는 ENCRYPTION_KEY 값 — 공개 저장소의 `.env.example` 에 실렸던
 * 복붙 가능 예시 키. 이 값을 그대로 운영에 쓰면 secret store 전체가 사실상 평문이 된다.
 */
export const KNOWN_EXAMPLE_ENCRYPTION_KEYS: ReadonlySet<string> = new Set([
  // 현 `.env.example` placeholder (all-zero).
  '0000000000000000000000000000000000000000000000000000000000000000',
  // 옛 `.env.example` 에 실렸던 복붙 가능 예시 키 — 그 값으로 운영 중인 배포도 차단.
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
]);

function isFlagOn(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

/**
 * production 부팅 가드. 위반 시 `Error` throw (fail-closed). 비-production 은 no-op.
 *
 * @param env 검사할 환경변수 맵 (기본 `process.env`). 테스트에서 주입.
 */
export function assertProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV !== 'production') return;

  const fail = (message: string): never => {
    throw new Error(`production fail-closed 가드: ${message}`);
  };

  // 비보안 stub — 실 검증/실 LLM 호출을 우회하므로 운영 부팅 금지.
  if (isFlagOn(env.OAUTH_STUB_MODE)) {
    fail('OAUTH_STUB_MODE=true 는 NODE_ENV=production 에서 허용되지 않습니다.');
  }
  if (isFlagOn(env.LLM_STUB_MODE)) {
    fail('LLM_STUB_MODE=true 는 NODE_ENV=production 에서 허용되지 않습니다.');
  }

  // 04 C-1 — JWT_SECRET 미설정/기본 sentinel/예시값이면 기본 secret 으로 서명된
  // 토큰 위조(인증 우회)가 가능하므로 부팅 거부. INTERACTION_JWT_SECRET 의 fail-closed 와 동형.
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || INSECURE_JWT_SECRETS.has(jwtSecret)) {
    fail(
      'JWT_SECRET 가 미설정이거나 예시/기본값입니다 — 운영용 무작위 secret 을 설정하세요 ' +
        '(기본값 서명은 인증 우회 위험).',
    );
  }

  // 04 M-4 — ENCRYPTION_KEY 가 미설정이거나 공개 .env.example 예시 키면 secret store 가
  // 사실상 평문이므로 부팅 거부. (빈 값은 SecretResolver init 에서도 throw 되나, 여기서
  // 예시 키 케이스까지 부팅 초기에 일괄 차단한다.)
  const encryptionKey = env.ENCRYPTION_KEY;
  if (!encryptionKey || KNOWN_EXAMPLE_ENCRYPTION_KEYS.has(encryptionKey)) {
    fail(
      'ENCRYPTION_KEY 가 미설정이거나 공개 예시 키입니다 — `openssl rand -hex 32` 로 ' +
        '운영용 키를 새로 생성하세요 (예시 키는 사실상 평문).',
    );
  }

  // 04 M-7 — MCP_ALLOW_INSECURE_URL 은 SSRF 방어(https-only + 호스트 블록리스트)를
  // 통째로 우회한다. spec(11-mcp-client §본문)이 "운영 환경에서 절대 활성화 금지" 로
  // 명시한 플래그이므로 throw. (정당 self-host 용도가 있는 ALLOW_PRIVATE_HOST_TARGETS 는
  // 별개 — throw 가 아닌 warn 으로 분리하며 main.ts 가 처리한다.)
  if (isFlagOn(env.MCP_ALLOW_INSECURE_URL)) {
    fail(
      'MCP_ALLOW_INSECURE_URL=true 는 NODE_ENV=production 에서 허용되지 않습니다 ' +
        '(SSRF 방어 우회).',
    );
  }
}
