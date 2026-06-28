import { json, urlencoded, type RequestHandler } from 'express';
import type { IncomingMessage } from 'http';

/**
 * `/api/hooks/*` 라우트 전용 본문 크기 임계 (기본 1 MiB).
 *
 * Spec [5-system/12-webhook.md WH-NF-02] 옵션 C — **분리 임계**: 인증 webhook 은 1MB 까지
 * 수용하고, 공개(`auth_config_id IS NULL`) webhook 은 그 위에서 `PublicWebhookThrottleGuard`
 * 가 32KB 로 추가 제한한다. 전역 body-parser 기본값(100KB)은 non-webhook 라우트 방어선으로
 * 그대로 두고, 이 임계는 `/api/hooks/*` 라우트에만 스코프된다.
 *
 * `HOOKS_MAX_BODY_BYTES` env 로 override 가능.
 */
export const HOOKS_MAX_BODY_BYTES = 1024 * 1024;

/**
 * 전역(non-hooks 라우트) 본문 크기 기본 — express/body-parser 기본값 100KB 와 동일.
 * `bodyParser: false` 로 Nest 기본 파서를 끄고 직접 등록하므로 이 값으로 기존 방어선을
 * 보존한다. (Nest 기본 파서가 `app.use(json())` 같은 수동 파서를 감지하면 자기 전역 파서를
 * 등록하지 않아 non-hooks 본문이 미파싱되는 함정을 회피 — 전역도 명시 등록한다.)
 */
export const GLOBAL_MAX_BODY_BYTES = 100 * 1024;

/**
 * env override 해석 — 양의 유한 정수만 채택, 그 외엔 기본값. (잘못된 env 가 0/NaN 으로
 * 본문을 전부 거부하거나 무제한으로 여는 것을 방지.)
 */
export function resolveHooksMaxBodyBytes(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.HOOKS_MAX_BODY_BYTES;
  const n = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : HOOKS_MAX_BODY_BYTES;
}

/**
 * 파싱 전 원본 바이트를 `req.rawBody` 에 보존 — HMAC 서명 검증
 * (`AuthConfigsService.verifyWebhookRequest`, Slack/Discord inbound) 이 rawBody 를
 * 요구하므로, 라우트 스코프 파서가 전역 파서를 대신 처리할 때도 동일하게 채워야 한다.
 * NestJS `rawBody: true` 가 채우는 필드와 동일 (`RawBodyRequest.rawBody: Buffer`).
 */
function captureRawBody(
  req: IncomingMessage,
  _res: unknown,
  buf: Buffer,
): void {
  if (buf && buf.length) {
    (req as IncomingMessage & { rawBody?: Buffer }).rawBody = buf;
  }
}

/**
 * `/api/hooks/*` 에 먼저 등록할 본문 파서들 (json + form-urlencoded, WH-EP-04).
 *
 * 전역(Nest 기본) 파서보다 **먼저** 등록되어 hooks 요청을 1MB 한도로 파싱하고
 * `req._body` 를 세팅한다 → body-parser 의 idempotency 가드 덕분에 후행 전역 파서는
 * hooks 경로를 재파싱하지 않는다(전역 100KB 한도가 hooks 에 적용되지 않음). 한도 초과 시
 * body-parser 가 `PayloadTooLargeError`(HTTP 413)를 throw → `GlobalExceptionFilter` 가
 * `PAYLOAD_TOO_LARGE` 봉투로 표준화한다.
 */
export function createHooksBodyParsers(
  maxBytes: number = resolveHooksMaxBodyBytes(),
): RequestHandler[] {
  return [
    json({ limit: maxBytes, verify: captureRawBody }),
    urlencoded({ extended: true, limit: maxBytes, verify: captureRawBody }),
  ];
}

/**
 * 전역 본문 파서 (json + form-urlencoded, 기본 100KB) — Nest 기본 파서 대체.
 *
 * `main.ts` 가 `NestFactory.create(AppModule, { bodyParser: false })` 로 Nest 기본 파서를
 * 끄므로, **모든 라우트**의 본문 파싱을 직접 책임진다. hooks 파서를 먼저 등록해 `/api/hooks/*`
 * 를 1MB 로 처리한 뒤(`req._body` 세팅), 이 전역 파서가 그 외 라우트를 100KB 로 처리한다
 * (hooks 는 `req._body` 가드로 재파싱 skip). rawBody 보존은 두 파서 공통.
 */
export function createGlobalBodyParsers(
  maxBytes: number = GLOBAL_MAX_BODY_BYTES,
): RequestHandler[] {
  return [
    json({ limit: maxBytes, verify: captureRawBody }),
    urlencoded({ extended: true, limit: maxBytes, verify: captureRawBody }),
  ];
}
