import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SENSITIVE_ACTION_THROTTLE } from '../../../common/constants/throttle';

/** `@RequirePasswordRecheck()` 가 핸들러에 남기는 메타데이터 키. 테스트가 이 키로 재확인 라우트를 찾는다. */
export const PASSWORD_RECHECK_METADATA = 'auth:password-recheck';

/**
 * 계정 비밀번호를 다시 확인하는(`AuthService.verifyPasswordForUser`) 라우트라고 선언한다
 * ([HTTP API 규약 — 요청 빈도 제한](CLE-API-CONV-RATE), NERV Task `CLE-T-CJ7HB1`).
 *
 * 민감 tier(`SENSITIVE_ACTION_THROTTLE`, 분당 10회)를 걸고 재확인 라우트라는 표시를 남긴다. 본문은 `PasswordRecheckDto` 를
 * 상속한 DTO 로 받는다. `password-recheck-throttle.spec.ts` 가 이 표시와 본문 DTO 를 양쪽에서 열거해 맞춰 보므로
 * 재확인 라우트를 더할 때 손으로 늘리는 목록이 없다.
 *
 * 라우트별 한도와 별개로 틀린 비밀번호는 `PasswordRecheckFailureLimiterService` 가 사용자 단위로 센다.
 */
export const RequirePasswordRecheck = (): MethodDecorator =>
  applyDecorators(
    SetMetadata(PASSWORD_RECHECK_METADATA, true),
    Throttle(SENSITIVE_ACTION_THROTTLE),
    ApiTooManyRequestsResponse({
      description:
        '요청 빈도 초과(RATE_LIMITED). 라우트별 분당 10회 한도를 넘었거나, 이 사용자가 최근 1분 안에 비밀번호를 10번 틀려 창이 끝날 때까지 비밀번호를 대조하지 않는 경우',
    }),
  );
