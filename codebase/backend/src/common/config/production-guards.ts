/**
 * 부팅 시 production fail-closed 가드 (refactor 04 C-1·M-4·M-7).
 *
 * `NODE_ENV=production` 에서 **비보안 stub / 미설정·예시 secret / 위험 플래그**가 켜진 채
 * 부팅하려 하면 즉시 throw 해 기동을 거부한다. 기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE`
 * 인라인 가드(옛 main.ts)를 같은 블록으로 응집하고, 동형 secret(`INTERACTION_JWT_SECRET` 의
 * fail-closed — `InteractionTokenService` 생성자 throw)과 대칭을 맞춘다.
 * SoT: spec/5-system/1-auth.md §Rationale "Production fail-closed 가드",
 * spec/5-system/14-external-interaction-api.md §8.3.
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
 * **의도적 비통합**: `INTERACTION_JWT_SECRET`(EIA) 의 fail-closed 는 `InteractionTokenService`
 * 생성자 throw 로, CORS·`WEBAUTHN_*` 등은 각 모듈에서 유지한다 — 모듈 로컬 컨텍스트(DI·요청
 * 시점)가 필요하거나 정당 용도(WebAuthn 미사용 셀프호스팅 boot 허용)가 달라서다. 본 모듈에는
 * **env 만으로 부팅 직전 판정 가능한 절대-금지 항목**만 넣는다.
 */

/**
 * production 에서 거부되는 JWT_SECRET 값 — 코드 기본 sentinel(`jwt.config.ts`) + `.env.example`
 * placeholder. **동기화 의무**: `jwt.config.ts` 의 dev fallback 이나 `.env.example` 의 JWT_SECRET
 * placeholder 를 바꾸면 그 값을 여기에 추가해야 한다(예측 가능 키가 production 부팅을 통과하지 않도록).
 */
export const INSECURE_JWT_SECRETS: ReadonlySet<string> = new Set([
  'dev-jwt-secret', // jwt.config.ts dev fallback
  'change-me-to-a-long-random-jwt-secret', // .env.example placeholder
]);

/**
 * production 에서 거부되는 ENCRYPTION_KEY 값 — 공개 저장소의 `.env.example` 에 실렸던/실리는
 * 복붙 가능 예시 키. 이 값을 그대로 운영에 쓰면 secret store 전체가 사실상 평문이 된다.
 * **동기화 의무**: `.env.example` 의 ENCRYPTION_KEY placeholder 를 바꾸면 *옛 값을 이 Set 에서
 * 제거하지 말고* 새 placeholder 를 추가한다 — 옛 예시 키로 운영 중인 배포도 계속 차단해야 한다.
 */
export const KNOWN_EXAMPLE_ENCRYPTION_KEYS: ReadonlySet<string> = new Set([
  // 현 `.env.example` placeholder (all-zero). since 2026-06.
  '0000000000000000000000000000000000000000000000000000000000000000',
  // 옛 `.env.example` 예시 키 (~2026-06) — 그 값으로 운영 중인 배포도 차단.
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
]);

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
  } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    fail(
      `JWT_SECRET 가 너무 짧습니다(${jwtSecret.length} < ${MIN_JWT_SECRET_LENGTH}) — ` +
        '약한 secret 은 무차별 대입에 취약합니다. `openssl rand -hex 32` 등으로 충분히 긴 ' +
        '무작위 값을 설정하세요(CWE-521).',
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
