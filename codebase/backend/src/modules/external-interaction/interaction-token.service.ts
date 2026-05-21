import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import {
  JsonWebTokenError,
  TokenExpiredError,
  sign,
  verify,
} from 'jsonwebtoken';

/**
 * [Spec EIA §3.3 / §R4] — 인터랙션 토큰 두 family.
 *
 * - `iext_*` (per_execution): HS256 JWT, payload `{ sub: executionId, aud: 'interaction', exp, jti }`.
 *   기본 수명 1h. execution 종료 시 jti 가 Redis blacklist 에 등록되어 즉시 invalidate.
 * - `itk_*` (per_trigger): 32 bytes random hex opaque token. Trigger.config.interaction.triggerToken
 *   에 보관. Trigger 삭제 또는 명시 revoke 시까지 유효.
 *
 * Redis 가 down 인 경우 `blacklist` 검사 자체가 fail-open (graceful degrade) — 단명 토큰의 위험은
 * 제한적이지만, 보안 핵심 경로이므로 로그로 명시 경고를 남긴다. 본 정책은 [Spec EIA §8.3] 의
 * "execution 종료 시 즉시 blacklist 등록" 의무가 만족되지 않는 환경에서도 시스템이 멈추지 않도록 함.
 */

export const IEXT_PREFIX = 'iext_';
export const ITK_PREFIX = 'itk_';
export const INTERACTION_TOKEN_AUDIENCE = 'interaction';

/** iext 토큰의 default 수명 (초). [Spec EIA §3.3 EIA-AU-02]. */
const IEXT_DEFAULT_TTL_SEC = 60 * 60; // 1h
/** refresh 가능한 만료 임박 윈도우 (초). [Spec EIA §3.3 EIA-AU-05]. */
const IEXT_REFRESH_WINDOW_SEC = 30 * 60; // 30min
const ITK_BYTES = 32;
const BLACKLIST_KEY_PREFIX = 'iext:blacklist:';

export interface IssuePerExecutionResult {
  /** `iext_<jwt>` 형식의 전체 토큰. */
  token: string;
  /** JWT exp 의 ISO 8601 timestamp. */
  expiresAt: string;
  /** JWT jti — revoke / blacklist 키. */
  jti: string;
}

export interface VerifyResult {
  valid: boolean;
  /** valid=true 일 때만 노출. */
  executionId?: string;
  jti?: string;
  /** valid=false 일 때만. */
  reason?:
    | 'malformed'
    | 'expired'
    | 'blacklisted'
    | 'audience_mismatch'
    | 'scope_mismatch';
}

@Injectable()
export class InteractionTokenService implements OnModuleDestroy {
  private readonly logger = new Logger(InteractionTokenService.name);
  private readonly redis: Redis | null;
  /** HS256 시크릿. `INTERACTION_JWT_SECRET` env (없으면 access-token secret 으로 fallback). */
  private readonly secret: string;

  constructor(
    @Optional() configService?: ConfigService,
    @Optional() @Inject('INTERACTION_TOKEN_REDIS') injectedRedis?: Redis,
  ) {
    if (injectedRedis) {
      // 테스트가 mock redis 주입 — 별도 connection 생성 안 함.
      this.redis = injectedRedis;
    } else if (configService) {
      const host = configService.get<string>('redis.host');
      const port = configService.get<number>('redis.port');
      if (host && port) {
        const password = configService.get<string>('redis.password');
        const tlsEnabled = configService.get<boolean>('redis.tls');
        try {
          this.redis = new Redis({
            host,
            port,
            ...(password ? { password } : {}),
            ...(tlsEnabled ? { tls: {} } : {}),
            lazyConnect: true,
            maxRetriesPerRequest: 2,
            enableReadyCheck: true,
          });
          this.redis.on('error', (err) => {
            this.logger.warn(
              `InteractionTokenService: Redis error — blacklist 검사 일시 비활성: ${err.message}`,
            );
          });
        } catch (err) {
          this.logger.warn(
            `InteractionTokenService: Redis init 실패 — blacklist graceful degrade: ${err instanceof Error ? err.message : String(err)}`,
          );
          this.redis = null;
        }
      } else {
        this.redis = null;
      }
    } else {
      this.redis = null;
    }

    const envSecret =
      configService?.get<string>('interaction.jwtSecret') ??
      process.env.INTERACTION_JWT_SECRET ??
      configService?.get<string>('jwt.secret') ??
      process.env.JWT_SECRET ??
      null;
    if (!envSecret) {
      this.logger.warn(
        'InteractionTokenService: JWT secret 미설정 — fallback "interaction-fallback" 사용. ' +
          '프로덕션에서는 반드시 INTERACTION_JWT_SECRET (또는 JWT_SECRET) 환경변수를 설정해야 함.',
      );
    }
    this.secret = envSecret ?? 'interaction-fallback';
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // ignore — 종료 경로의 redis quit 실패는 무시 (이미 disconnected 일 수 있음)
      }
    }
  }

  // ===========================================================
  // per_execution (iext_*)
  // ===========================================================

  /**
   * 신규 per-execution JWT 발급. terminal 이벤트 발생 전까지 `verifyPerExecution` 에서 valid.
   */
  issuePerExecution(
    executionId: string,
    opts?: { ttlSec?: number },
  ): IssuePerExecutionResult {
    if (!executionId) throw new Error('executionId is required');
    const ttl = opts?.ttlSec ?? IEXT_DEFAULT_TTL_SEC;
    const jti = randomBytes(16).toString('hex');
    const expSec = Math.floor(Date.now() / 1000) + ttl;
    const jwt = sign(
      { sub: executionId, aud: INTERACTION_TOKEN_AUDIENCE, jti },
      this.secret,
      {
        algorithm: 'HS256',
        expiresIn: ttl,
      },
    );
    return {
      token: `${IEXT_PREFIX}${jwt}`,
      expiresAt: new Date(expSec * 1000).toISOString(),
      jti,
    };
  }

  /**
   * iext 토큰 검증. expected executionId 가 명시되면 sub 매칭 검증; 미명시면 sub 만 추출.
   * blacklist 검사는 Redis 가 있을 때만 수행 (없으면 fail-open + warn 로그).
   */
  async verifyPerExecution(
    token: string,
    expectedExecutionId?: string,
  ): Promise<VerifyResult> {
    if (typeof token !== 'string' || !token.startsWith(IEXT_PREFIX)) {
      return { valid: false, reason: 'malformed' };
    }
    const jwtPart = token.slice(IEXT_PREFIX.length);
    let payload: { sub?: unknown; aud?: unknown; jti?: unknown };
    try {
      payload = verify(jwtPart, this.secret, {
        algorithms: ['HS256'],
        audience: INTERACTION_TOKEN_AUDIENCE,
      }) as { sub?: unknown; aud?: unknown; jti?: unknown };
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        return { valid: false, reason: 'expired' };
      }
      if (err instanceof JsonWebTokenError) {
        // audience mismatch / signature 등.
        const msg = err.message.toLowerCase();
        if (msg.includes('audience')) {
          return { valid: false, reason: 'audience_mismatch' };
        }
        return { valid: false, reason: 'malformed' };
      }
      return { valid: false, reason: 'malformed' };
    }
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    const jti = typeof payload.jti === 'string' ? payload.jti : null;
    if (!sub || !jti) return { valid: false, reason: 'malformed' };
    if (expectedExecutionId && sub !== expectedExecutionId) {
      return { valid: false, reason: 'scope_mismatch' };
    }
    if (this.redis) {
      try {
        const blacklisted = await this.redis.get(
          `${BLACKLIST_KEY_PREFIX}${jti}`,
        );
        if (blacklisted) {
          return { valid: false, reason: 'blacklisted' };
        }
      } catch (err) {
        this.logger.warn(
          `InteractionTokenService: blacklist GET 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { valid: true, executionId: sub, jti };
  }

  /**
   * jti 를 blacklist 에 등록 (TTL = 원 exp 까지). execution.completed / failed / cancelled 발송
   * 후 호출.
   *
   * Redis 미가용 시 no-op + warn 로그. blacklist 가 실제로 적용되지 않는 환경임을 시스템 관리자가
   * 인지할 수 있도록 명시.
   */
  async revokePerExecution(jti: string, ttlSec: number): Promise<void> {
    if (!jti) return;
    if (!this.redis) {
      this.logger.warn(
        `InteractionTokenService: Redis 미가용 — jti=${jti} blacklist 등록 skip (fail-open). ` +
          '단명 토큰의 잔여 위험은 ttl 까지.',
      );
      return;
    }
    const ttl = Math.max(1, Math.ceil(ttlSec));
    try {
      await this.redis.set(`${BLACKLIST_KEY_PREFIX}${jti}`, '1', 'EX', ttl);
    } catch (err) {
      this.logger.warn(
        `InteractionTokenService: blacklist SET 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * iext 갱신. 기존 토큰이 valid + 만료 30분 이내 일 때만 신규 발급. 기존 jti 는 blacklist 등록.
   *
   * 호출 측이 execution alive 여부를 별도 검증해야 한다 (본 메서드는 토큰 자체만 검증).
   */
  async refreshPerExecution(
    oldToken: string,
  ): Promise<
    | IssuePerExecutionResult
    | { valid: false; reason: VerifyResult['reason'] | 'not_in_window' }
  > {
    const verifyResult = await this.verifyPerExecution(oldToken);
    if (!verifyResult.valid) {
      return { valid: false, reason: verifyResult.reason };
    }
    // 만료까지 남은 시간 추출
    const jwtPart = oldToken.slice(IEXT_PREFIX.length);
    const decoded = (() => {
      try {
        return verify(jwtPart, this.secret, {
          algorithms: ['HS256'],
          audience: INTERACTION_TOKEN_AUDIENCE,
        }) as { sub: string; exp: number; jti: string };
      } catch {
        return null;
      }
    })();
    if (!decoded) return { valid: false, reason: 'malformed' };
    const remainingSec = decoded.exp - Math.floor(Date.now() / 1000);
    if (remainingSec > IEXT_REFRESH_WINDOW_SEC) {
      return { valid: false, reason: 'not_in_window' };
    }
    // 기존 jti blacklist + 신규 발급
    await this.revokePerExecution(decoded.jti, Math.max(1, remainingSec));
    return this.issuePerExecution(decoded.sub);
  }

  // ===========================================================
  // per_trigger (itk_*)
  // ===========================================================

  /**
   * 신규 per-trigger opaque 토큰 생성. Trigger.config.interaction.triggerToken 에 저장 권장.
   * 토큰 자체에는 trigger id 정보 없음 — 호출 시 expected 토큰과 timing-safe 비교.
   */
  issuePerTrigger(): string {
    const random = randomBytes(ITK_BYTES).toString('hex');
    return `${ITK_PREFIX}${random}`;
  }

  /**
   * per-trigger 토큰 검증. timing-safe compare. 두 토큰의 길이가 다르면 두 hash 의 timing-safe
   * 비교로 통일 (length leak 차단).
   */
  verifyPerTrigger(token: string, expected: string): boolean {
    if (typeof token !== 'string' || typeof expected !== 'string') return false;
    if (!token.startsWith(ITK_PREFIX) || !expected.startsWith(ITK_PREFIX)) {
      return false;
    }
    const hashedToken = createHash('sha256').update(token).digest();
    const hashedExpected = createHash('sha256').update(expected).digest();
    return timingSafeEqual(hashedToken, hashedExpected);
  }
}
