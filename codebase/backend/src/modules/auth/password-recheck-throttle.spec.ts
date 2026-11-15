import { readdirSync } from 'fs';
import { join } from 'path';
import { PATH_METADATA } from '@nestjs/common/constants';
// 패키지 루트는 이 상수를 export 하지 않아서 내부 상수를 쓴다(auth.controller.spec.ts 와 같다).
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';

import { SENSITIVE_ACTION_THROTTLE } from '../../common/constants/throttle';
import { PASSWORD_RECHECK_METADATA } from './decorators/require-password-recheck.decorator';
import { PasswordRecheckDto } from './dto/password-recheck.dto';

/**
 * 계정 비밀번호를 다시 확인하는(`AuthService.verifyPasswordForUser`) 라우트는 모두 `@RequirePasswordRecheck()` 로 선언하고
 * 민감 tier(분당 10회)를 건다. 탈취한 액세스 토큰만 가진 사람이 `PASSWORD_INVALID` 응답을 보고 비밀번호를 추측하는 속도를
 * 늦추기 위해서다. 근거: [HTTP API 규약 — 요청 빈도 제한](CLE-API-CONV-RATE), NERV Task `CLE-T-CJ7HB1`.
 *
 * 라우트 목록을 손으로 적지 않는다. 이 모듈의 컨트롤러 파일을 모두 읽어 두 방향에서 찾고 둘이 같은지 본다.
 * - 선언: `@RequirePasswordRecheck()` 메타데이터가 있는 핸들러
 * - 본문: 인자 타입이 `PasswordRecheckDto` 를 상속한 DTO 인 핸들러
 * 비밀번호를 본문으로 받는 재확인 라우트를 더하면서 선언을 빠뜨리면(또는 그 반대면) 여기서 걸린다.
 */

type Route = { name: string; handler: object; controller: object };

function loadAuthControllers(): object[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.controller.ts')) files.push(full);
    }
  };
  walk(__dirname);
  return files.flatMap((file) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Object.values(require(file) as Record<string, unknown>).filter(
      (value): value is object =>
        typeof value === 'function' &&
        Reflect.getMetadata(PATH_METADATA, value) !== undefined,
    ),
  );
}

function routesOf(controllers: object[]): Route[] {
  return controllers.flatMap((controller) => {
    const proto = (controller as { prototype: Record<string, unknown> })
      .prototype;
    return Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor')
      .map((name) => ({
        name: `${(controller as { name: string }).name}.${name}`,
        handler: proto[name] as object,
        controller,
      }))
      .filter(
        ({ handler }) =>
          typeof handler === 'function' &&
          Reflect.getMetadata(PATH_METADATA, handler) !== undefined,
      );
  });
}

const takesRecheckBody = (route: Route): boolean => {
  const paramTypes =
    (Reflect.getMetadata(
      'design:paramtypes',
      (route.controller as { prototype: object }).prototype,
      route.name.split('.')[1],
    ) as unknown[] | undefined) ?? [];
  return paramTypes.some(
    (type) =>
      typeof type === 'function' &&
      (type as { prototype: unknown }).prototype instanceof PasswordRecheckDto,
  );
};

const isDeclared = (route: Route): boolean =>
  Reflect.getMetadata(PASSWORD_RECHECK_METADATA, route.handler) === true;

describe('비밀번호 재확인 라우트의 요청 빈도 제한', () => {
  const routes = routesOf(loadAuthControllers());
  const declared = routes.filter(isDeclared);

  it('재확인 라우트를 찾는다', () => {
    // 열거가 깨져 빈 목록이면 아래 검사가 모두 헛돈다.
    expect(declared.length).toBeGreaterThan(0);
  });

  it('선언한 라우트와 재확인 본문을 받는 라우트가 같다', () => {
    expect(declared.map((r) => r.name).sort()).toEqual(
      routes
        .filter(takesRecheckBody)
        .map((r) => r.name)
        .sort(),
    );
  });

  it.each(declared.map((r) => [r.name, r] as const))(
    '%s 는 SENSITIVE_ACTION_THROTTLE 을 건다',
    (_name, { handler }) => {
      expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(
        SENSITIVE_ACTION_THROTTLE.default.limit,
      );
      expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(
        SENSITIVE_ACTION_THROTTLE.default.ttl,
      );
    },
  );
});
