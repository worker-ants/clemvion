import { describe, it, expect } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { of } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';

import { AppModule } from '../../app.module';
import {
  collectTsFiles,
  stripComments,
} from '../../common/__test-utils__/source-scan';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';
import { WebsocketGateway } from '../../modules/websocket/websocket.gateway';

/**
 * 전역 `APP_GUARD` · `APP_PIPE` · `APP_INTERCEPTOR` 가 **WebSocket 게이트웨이 핸들러에서 어떻게 동작하는지**
 * 하나씩 분류해 두게 한다.
 *
 * ## 왜 이 가드인가 — 같은 사고가 enhancer 마다 따로 났다
 *
 * NestJS 12 부터 전역 guards · pipes · interceptors 가 게이트웨이 핸들러에도 걸린다(전역 필터만
 * `ExceptionFiltersContext.getGlobalMetadata() => []` 로 제외된다). 이 사실을 몰라서
 * `LoggingInterceptor`(`url.split` TypeError) · `CustomValidationPipe`(`@ConnectedSocket()` 소켓을 DTO
 * 로 변환) · `UserThrottlerGuard`(모든 사용자가 `'unknown'` 버킷 하나를 공유)가 차례로 깨졌고,
 * 단위 테스트는 핸들러를 직접 불러 이 파이프라인을 지나지 않아서 e2e 에서야 드러났다(CLE-T-A3W8B8).
 *
 * 나머지 전역 enhancer 는 우연히 안전했다. `TransformInterceptor` 는 ack 가 `{ event, data }` 라서
 * `'data' in data` 분기로 통과했고, `RolesGuard` 는 소켓에 `user` 가 없어 `!userId` 로 통과하고,
 * `JwtAuthGuard` 는 게이트웨이의 `@Public()` 으로 통과한다. 다음 전역 enhancer 가 같은 함정에 빠지는 것을
 * 막는 것이 이 가드다.
 *
 * ## 무엇을 센다
 *
 * 1. `app.module.ts` 가 등록한 전역 `APP_GUARD | APP_PIPE | APP_INTERCEPTOR` 가 아래 `POLICY` 에 전부
 *    있다(없는 것 → 실패, 등록이 사라진 항목 → 실패). 새 전역 enhancer 를 더하면 이 표에 분류를 적어야 한다.
 * 2. 그 등록이 `app.module.ts` 한 곳뿐이다 — 다른 모듈이 더하면 1번이 못 본다.
 * 3. 표의 분류가 사실이다. `skips-non-http` 는 WS 컨텍스트에서 실제로 건너뛰는지, `ws-safe-by-design` 은
 *    게이트웨이 핸들러 모양에서 실제로 통과하는지 호출해서 본다. 표만 믿지 않는다.
 *
 * ## 한계
 *
 * `useClass` 가 아닌 등록(`useExisting` · `useFactory` · `useValue`)은 분류할 클래스를 알 수 없어
 * 실패로 본다. `APP_FILTER` 는 WS 에 걸리지 않으므로 대상이 아니다. `POLICY` 의 `ws-safe-by-design` 은
 * 게이트웨이 핸들러의 **현재 모양**에 기대는 분류라서, 핸들러가 바뀌어 그 전제가 깨지면 3번 호출 단언이
 * 먼저 실패한다.
 */

type Policy = 'skips-non-http' | 'ws-safe-by-design';

interface PolicyEntry {
  readonly enhancer: Type<unknown>;
  readonly policy: Policy;
  readonly why: string;
}

const POLICY: readonly PolicyEntry[] = [
  {
    enhancer: CustomValidationPipe,
    policy: 'skips-non-http',
    why: "`ArgumentMetadata.type === 'custom'`(`@ConnectedSocket()`)이면 검증하지 않는다",
  },
  {
    enhancer: TransformInterceptor,
    policy: 'skips-non-http',
    why: 'HTTP 가 아니면 `{ data }` 로 감싸지 않는다(ack 의 wire 모양을 지킨다)',
  },
  {
    enhancer: LoggingInterceptor,
    policy: 'skips-non-http',
    why: '소켓에는 `url` 이 없어 HTTP 가 아니면 로그하지 않는다',
  },
  {
    enhancer: JwtAuthGuard,
    policy: 'ws-safe-by-design',
    why: '게이트웨이 클래스의 `@Public()` 으로 통과한다. 인증은 `handleConnection` 의 JWT 검증이 맡는다',
  },
  {
    enhancer: UserThrottlerGuard,
    policy: 'skips-non-http',
    why: '`shouldSkip` 이 HTTP 가 아니면 세지 않는다. WS 빈도 제한은 소켓당 `WsRateLimitGuard`(CLE-API-WS 「에러 코드」)',
  },
  {
    enhancer: RolesGuard,
    policy: 'ws-safe-by-design',
    why: '소켓에 `user` 가 없어 `@Roles()` 가 없는 핸들러는 `!userId` 분기로 통과한다',
  },
];

const ENHANCER_TOKENS: readonly unknown[] = [
  APP_GUARD,
  APP_PIPE,
  APP_INTERCEPTOR,
];

/** 전역 enhancer 등록 중 `POLICY` 에 분류가 없는 것과, 등록이 사라진 `POLICY` 항목을 돌려준다. */
function findPolicyDrift(
  providers: readonly unknown[],
  policy: readonly PolicyEntry[],
): { unclassified: string[]; stale: string[]; notUseClass: number } {
  const registered: unknown[] = [];
  let notUseClass = 0;
  for (const p of providers) {
    if (typeof p !== 'object' || p === null) continue;
    const { provide, useClass } = p as {
      provide?: unknown;
      useClass?: unknown;
    };
    if (!ENHANCER_TOKENS.includes(provide)) continue;
    if (typeof useClass === 'function') registered.push(useClass);
    else notUseClass += 1;
  }
  const classified = new Set<unknown>(policy.map((e) => e.enhancer));
  return {
    unclassified: registered
      .filter((cls) => !classified.has(cls))
      .map((cls) => (cls as Type<unknown>).name),
    stale: policy
      .filter((e) => !registered.includes(e.enhancer))
      .map((e) => e.enhancer.name),
    notUseClass,
  };
}

describe('전역 enhancer 의 WebSocket 안전성 가드', () => {
  const SRC_ROOT = path.resolve(__dirname, '..', '..');
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    AppModule,
  ) as unknown[];

  it('AppModule providers 를 읽었다 (vacuous 방지)', () => {
    expect(Array.isArray(providers)).toBe(true);
    const enhancers = providers.filter(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        ENHANCER_TOKENS.includes((p as { provide?: unknown }).provide),
    );
    expect(enhancers.length).toBeGreaterThanOrEqual(POLICY.length);
  });

  it('등록된 전역 guard · pipe · interceptor 가 전부 POLICY 에 분류돼 있다', () => {
    const { unclassified, stale, notUseClass } = findPolicyDrift(
      providers,
      POLICY,
    );
    // 새 전역 enhancer 를 더했다면: HTTP 가 아니면 건너뛰게 만들고(`isHttpContext`) POLICY 에
    // `skips-non-http` 로 적는다. HTTP 전용이 아니라 WS 에서도 의미가 있다면 `ws-safe-by-design` 으로
    // 적고 WS 핸들러에서 통과하는 근거를 아래 호출 단언에 더한다.
    expect({ unclassified, stale, notUseClass }).toEqual({
      unclassified: [],
      stale: [],
      notUseClass: 0,
    });
  });

  it('대조군: POLICY 에 없는 enhancer 를 등록하면 미분류로 잡는다', () => {
    class NewGlobalInterceptor {}
    const drift = findPolicyDrift(
      [
        ...providers,
        { provide: APP_INTERCEPTOR, useClass: NewGlobalInterceptor },
        { provide: APP_GUARD, useExisting: JwtAuthGuard },
      ],
      POLICY,
    );
    expect(drift.unclassified).toEqual(['NewGlobalInterceptor']);
    expect(drift.notUseClass).toBe(1);
  });

  it('대조군: 등록이 사라진 POLICY 항목을 잡는다', () => {
    const withoutLogging = providers.filter(
      (p) => (p as { useClass?: unknown }).useClass !== LoggingInterceptor,
    );
    expect(findPolicyDrift(withoutLogging, POLICY).stale).toEqual([
      'LoggingInterceptor',
    ]);
  });

  it('전역 enhancer 등록은 app.module.ts 한 곳뿐이다', () => {
    const REGISTRATION = /provide:\s*APP_(GUARD|PIPE|INTERCEPTOR)\b/;
    const offenders = collectTsFiles(SRC_ROOT)
      .filter((f) => !f.includes(`${path.sep}repo-guards${path.sep}`))
      .filter((f) =>
        REGISTRATION.test(stripComments(fs.readFileSync(f, 'utf8'))),
      )
      .map((f) => path.relative(SRC_ROOT, f));
    expect(offenders).toEqual(['app.module.ts']);
  });

  describe('분류가 사실이다 — WS 컨텍스트로 직접 호출한다', () => {
    const socket = { id: 'socket-1', handshake: {} };
    const wsContext = {
      getType: () => 'ws',
      getClass: () => WebsocketGateway,
      getHandler: () => WebsocketGateway.prototype.handleSubscribe,
      switchToHttp: () => ({
        getRequest: () => socket,
        getResponse: () => ({ channel: 'execution:e-1' }),
      }),
    } as unknown as ExecutionContext;

    const run = (
      interceptor: TransformInterceptor<unknown> | LoggingInterceptor,
      value: unknown,
    ) =>
      new Promise<unknown>((resolve, reject) => {
        interceptor
          .intercept(wsContext, { handle: () => of(value) })
          .subscribe({ next: resolve, error: reject });
      });

    it('POLICY 는 두 분류만 쓴다', () => {
      expect(new Set(POLICY.map((e) => e.policy))).toEqual(
        new Set<Policy>(['skips-non-http', 'ws-safe-by-design']),
      );
      for (const entry of POLICY) expect(entry.why.length).toBeGreaterThan(0);
    });

    it('CustomValidationPipe — custom 인자(소켓)는 변환 없이 그대로 돌려준다', async () => {
      class Dto {}
      await expect(
        new CustomValidationPipe().transform(socket, {
          type: 'custom',
          metatype: Dto,
        }),
      ).resolves.toBe(socket);
    });

    it('TransformInterceptor — data 키가 없는 ack 도 감싸지 않는다', async () => {
      const ack = { event: 'pong', timestamp: 1 };
      await expect(run(new TransformInterceptor(), ack)).resolves.toBe(ack);
      await expect(run(new TransformInterceptor(), undefined)).resolves.toBe(
        undefined,
      );
    });

    it('LoggingInterceptor — url 이 없는 소켓 요청에도 던지지 않는다', async () => {
      const config = { get: () => undefined } as unknown as ConfigService;
      const ack = { event: 'subscribed', data: { success: true } };
      await expect(run(new LoggingInterceptor(config), ack)).resolves.toBe(ack);
    });

    it('UserThrottlerGuard — shouldSkip 이 true 다', async () => {
      const guard = Object.create(UserThrottlerGuard.prototype) as {
        shouldSkip(context: ExecutionContext): Promise<boolean>;
      };
      await expect(guard.shouldSkip(wsContext)).resolves.toBe(true);
    });

    it('JwtAuthGuard — 게이트웨이 클래스의 @Public() 으로 통과한다', () => {
      const guard = new JwtAuthGuard(new Reflector());
      expect(guard.canActivate(wsContext)).toBe(true);
    });

    it('RolesGuard — user 가 없는 소켓 요청은 @Roles() 없는 핸들러를 통과한다', async () => {
      const guard = new RolesGuard(new Reflector(), {} as WorkspacesService);
      await expect(guard.canActivate(wsContext)).resolves.toBe(true);
    });
  });
});
