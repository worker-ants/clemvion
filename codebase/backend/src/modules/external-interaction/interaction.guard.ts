import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Trigger } from '../triggers/entities/trigger.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InteractionTokenService,
  IEXT_PREFIX,
  ITK_PREFIX,
} from './interaction-token.service';
import { Execution } from '../executions/entities/execution.entity';

/**
 * 인증 실패 시 응답 헤더 — refresh URL 안내.
 */
export const REFRESH_TOKEN_URL_HEADER = 'X-Refresh-Token-Url';

/**
 * Express request 에 동봉되는 인증 컨텍스트.
 * Controller / Service 가 `req.interaction` 으로 접근.
 *
 * [Spec EIA §3.3 EIA-AU-08 + §3.3.1 EIA-AU-09] — In-process trusted caller 예외.
 * 두 ctx 타입을 union 으로 분리해 컴파일러가 invariant 를 강제한다:
 *
 * - {@link ExternalInteractionRequestContext} — 외부 HTTP 진입점. `InteractionGuard.canActivate`
 *   가 합성. `tokenFamily` 필수, `scope` 필드 없음 (타입 자체에 부재).
 * - {@link InternalInteractionRequestContext} — 서버 내부 trusted caller (Chat Channel 어댑터 등).
 *   `scope: 'in_process_trusted'` literal 필수, `tokenFamily` 없음 (토큰 자체가 없음).
 *
 * **불변식 (컴파일러 강제)**:
 * - `InteractionGuard` 는 항상 `ExternalInteractionRequestContext` 만 반환 — `scope` 필드 부재.
 * - HTTP request body / header 로 들어온 `scope` 값은 reach 할 타입 슬롯이 없어 자동 무시.
 * - `InternalInteractionRequestContext` 는 서버 내부 모듈만 직접 합성 가능
 *   (`grep "scope: 'in_process_trusted'"` 결과로 audit).
 */
export type InteractionScope = 'in_process_trusted';

/** 외부 HTTP 진입점 (Guard 합성) — token 검증 통과 후 합성된 ctx. */
export interface ExternalInteractionRequestContext {
  /** 검증된 execution id. `iext` 는 토큰 sub, `itk` 는 URL 파라미터 :executionId. */
  executionId: string;
  /** 토큰 family. */
  tokenFamily: 'iext' | 'itk';
  /** `itk` family 의 trigger id (`iext` 는 null). */
  triggerId?: string | null;
}

/** 서버 내부 trusted caller (Chat Channel 어댑터 등) — token 검증 우회. */
export interface InternalInteractionRequestContext {
  executionId: string;
  triggerId?: string | null;
  /** literal type — 컴파일러가 'in_process_trusted' 외 값을 거부. */
  scope: 'in_process_trusted';
}

export type InteractionRequestContext =
  | ExternalInteractionRequestContext
  | InternalInteractionRequestContext;

/** Union narrowing helper. */
export function isInternalCtx(
  ctx: InteractionRequestContext,
): ctx is InternalInteractionRequestContext {
  return 'scope' in ctx && ctx.scope === 'in_process_trusted';
}

export interface RequestWithInteraction extends Request {
  /** Guard 가 합성하는 ctx 는 항상 External — Internal 은 in-process 직접 호출 경로에서만 생성. */
  interaction?: ExternalInteractionRequestContext;
}

/**
 * [Spec EIA §3.3 / §5 / §8.3] — External Interaction API endpoint 의 인증 Guard.
 *
 * 두 토큰 family 를 동시에 수용:
 * - `iext_*` (per_execution JWT): `Authorization: Bearer iext_...` 또는 SSE 의 `?token=`.
 *   token.sub 가 URL 파라미터 `:executionId` 와 매칭되어야 한다.
 * - `itk_*` (per_trigger opaque): `Authorization: Bearer itk_...`.
 *   trigger 조회 → 해당 trigger 가 만든 execution 만 허용.
 *
 * 실패 시 401 + `X-Refresh-Token-Url` 헤더로 갱신 경로 안내.
 */
@Injectable()
export class InteractionGuard implements CanActivate {
  constructor(
    private readonly tokenService: InteractionTokenService,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithInteraction>();
    const token = extractToken(req);
    const executionId = String(req.params?.executionId ?? '');
    if (!executionId)
      this.deny(
        req,
        'EXECUTION_ID_MISSING',
        'executionId parameter is required',
      );
    if (!token) {
      this.deny(req, 'TOKEN_MISSING', 'Interaction token is required');
    }
    if (token.startsWith(IEXT_PREFIX)) {
      const result = await this.tokenService.verifyPerExecution(
        token,
        executionId,
      );
      if (!result.valid) {
        this.deny(req, this.mapReason(result.reason), 'Token rejected');
      }
      req.interaction = {
        executionId,
        tokenFamily: 'iext',
      };
      return true;
    }
    if (token.startsWith(ITK_PREFIX)) {
      // itk 는 trigger 단위 — execution 의 trigger_id 매칭 후 expected 토큰과 비교.
      const exec = await this.executionRepository.findOne({
        where: { id: executionId },
        select: ['id', 'triggerId'],
      });
      if (!exec || !exec.triggerId) {
        this.deny(req, 'EXECUTION_NOT_FOUND', 'Execution not found');
      }
      const trigger = await this.triggerRepository.findOne({
        where: { id: exec.triggerId },
        select: ['id', 'config'],
      });
      const expected = readItkFromConfig(trigger?.config);
      if (!expected) {
        this.deny(req, 'TOKEN_INVALID', 'Trigger has no per-trigger token');
      }
      const ok = this.tokenService.verifyPerTrigger(token, expected);
      if (!ok) this.deny(req, 'TOKEN_INVALID', 'Token rejected');
      req.interaction = {
        executionId,
        tokenFamily: 'itk',
        triggerId: exec.triggerId,
      };
      return true;
    }
    this.deny(req, 'TOKEN_INVALID', 'Unknown token family');
  }

  private deny(
    req: RequestWithInteraction,
    code: string,
    message: string,
  ): never {
    // refresh URL 헤더는 응답에 첨부 — `iext` 가 만료된 경우 클라이언트가 갱신 경로를 즉시 안다.
    const executionId = String(req.params?.executionId ?? '');
    const res = req.res;
    if (res && executionId) {
      res.setHeader(
        REFRESH_TOKEN_URL_HEADER,
        `/api/external/executions/${executionId}/refresh-token`,
      );
    }
    throw new UnauthorizedException({
      error: { code, message },
    });
  }

  private mapReason(reason: string | undefined): string {
    switch (reason) {
      case 'expired':
        return 'TOKEN_EXPIRED';
      case 'blacklisted':
        return 'TOKEN_REVOKED';
      case 'scope_mismatch':
        return 'TOKEN_SCOPE_MISMATCH';
      case 'audience_mismatch':
        return 'TOKEN_AUDIENCE_MISMATCH';
      default:
        return 'TOKEN_INVALID';
    }
  }
}

function extractToken(req: RequestWithInteraction): string | null {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    const value = auth.slice('bearer '.length).trim();
    if (value.length > 0) return value;
  }
  // 2) ?token= (SSE 호환 — EventSource 가 헤더 미지원이라 SSE 한정으로 query 토큰 허용)
  const queryToken = (req.query as { token?: unknown } | undefined)?.token;
  if (typeof queryToken === 'string' && queryToken.length > 0)
    return queryToken;
  return null;
}

function readItkFromConfig(config: unknown): string | null {
  if (!config || typeof config !== 'object') return null;
  const interaction = (config as { interaction?: unknown }).interaction;
  if (!interaction || typeof interaction !== 'object') return null;
  const tokenStrategy = (interaction as { tokenStrategy?: unknown })
    .tokenStrategy;
  if (tokenStrategy !== 'per_trigger') return null;
  const triggerToken = (interaction as { triggerToken?: unknown }).triggerToken;
  return typeof triggerToken === 'string' && triggerToken.length > 0
    ? triggerToken
    : null;
}
