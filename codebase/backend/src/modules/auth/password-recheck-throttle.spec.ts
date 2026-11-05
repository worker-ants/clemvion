import { PATH_METADATA } from '@nestjs/common/constants';
// 패키지 루트는 이 상수를 export 하지 않아서 내부 상수를 쓴다(auth.controller.spec.ts 와 같다).
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';

import { SENSITIVE_ACTION_THROTTLE } from '../../common/constants/throttle';
import { AuthController } from './auth.controller';
import { WebAuthnController } from './webauthn/webauthn.controller';

/**
 * 계정 비밀번호를 다시 확인하는(`AuthService.verifyPasswordForUser`) 라우트는 모두 민감 tier(분당 10회)를 건다.
 * 탈취한 액세스 토큰만 가진 사람이 `PASSWORD_INVALID` 응답을 보고 비밀번호를 추측하는 속도를 늦추기 위해서다.
 *
 * 비밀번호 확인을 `AuthService` 안(설정 시작 · 끄기)과 컨트롤러(Passkey 등록 옵션 · 복구 코드 재발급)에서 부르므로
 * 호출 위치로 라우트를 찾아낼 수 없다. 그래서 목록을 고정한다. 비밀번호를 다시 확인하는 라우트를 더하면 이 목록에도 더한다.
 * 근거: NERV CLE-API-CONV §7, CLE-ACCT-SIGNIN (CLE-T-FRCRF7)
 */
const PASSWORD_RECHECK_ROUTES = [
  {
    controller: AuthController,
    basePath: 'auth',
    handler: AuthController.prototype.setup2fa,
    path: '2fa/setup',
  },
  {
    controller: AuthController,
    basePath: 'auth',
    handler: AuthController.prototype.disable2fa,
    path: '2fa/disable',
  },
  {
    controller: WebAuthnController,
    basePath: 'auth/2fa/webauthn',
    handler: WebAuthnController.prototype.webauthnRegisterOptions,
    path: 'register/options',
  },
  {
    controller: WebAuthnController,
    basePath: 'auth/2fa/webauthn',
    handler: WebAuthnController.prototype.webauthnRegenerateRecovery,
    path: 'recovery-codes/regenerate',
  },
] as const;

describe('비밀번호 재확인 라우트의 요청 빈도 제한', () => {
  it.each(PASSWORD_RECHECK_ROUTES)(
    'POST $path 는 SENSITIVE_ACTION_THROTTLE 을 건다',
    ({ controller, basePath, handler, path }) => {
      // 목록의 경로가 실제 핸들러와 맞는지 먼저 본다. 핸들러 이름이 바뀌어도 목록이 엉뚱한 라우트를 가리키지 않게 한다.
      expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe(basePath);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(
        SENSITIVE_ACTION_THROTTLE.default.limit,
      );
      expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(
        SENSITIVE_ACTION_THROTTLE.default.ttl,
      );
    },
  );
});
