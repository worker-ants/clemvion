import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * bcrypt cost factor. 비밀번호 해시의 단일 SoT — auth.service·users.service 등
 * 모든 해시 경로가 `hashPassword` 를 통해 동일 rounds 를 쓴다 (refactor 04 후속 B-3).
 */
export const BCRYPT_ROUNDS = 12;

/**
 * 비밀번호 재확인 실패 코드 — **두 조건의 단일 SoT**.
 *
 * `AuthService.verifyPasswordForUser`(2FA 비활성화·WebAuthn 관리 등 민감 동작 재확인)와
 * `UsersService.changePassword`(비밀번호 변경) 가 같은 값을 발행하고,
 * `SessionsService.verifyReauth`(세션 재인증)가 `.INVALID` 만 발행한다 — 그쪽의 미입력은
 * `REAUTH_REQUIRED`(400)로 갈려 status 부터 다르다. 두 곳이 각자
 * 문자열 리터럴을 들고 있던 것이 `INVALID_PASSWORD` drift 의 원인이었다 — 변경 경로만
 * 두 조건을 한 코드로 합쳐 OAuth-only 사용자에게 "현재 비밀번호가 틀렸다" 고 말했다.
 * (은퇴 이력: `spec/conventions/error-codes.md` §5, 등급 B)
 *
 * 헬퍼 자체를 공유하지 않는 이유는 `UsersService` 가 `AuthService` 를 주입할 수 없기
 * 때문이다(역방향 의존 = 순환). 그래서 **코드만** 공유한다. 메시지는 흐름마다 안내가
 * 달라 각 호출부가 소유한다.
 */
export const PASSWORD_VERIFY_CODES = {
  /** 비밀번호 미설정(OAuth-only) 또는 미입력 — 재확인할 대상이 없다. */
  REQUIRED: 'PASSWORD_REQUIRED',
  /** 비밀번호는 있으나 입력이 일치하지 않는다. */
  INVALID: 'PASSWORD_INVALID',
} as const;

/**
 * 평문 비밀번호를 `BCRYPT_ROUNDS` cost 로 해시한다. bcrypt rounds 의 중복 정의를
 * 막기 위한 단일 진입점.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * 평문 비밀번호가 주어진 bcrypt 해시와 일치하는지 검증한다. `hashPassword` 와
 * 짝을 이루는 단일 진입점으로, 해시 알고리즘 교체 시 변경 범위를 본 모듈로 한정한다.
 */
export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * 비밀번호 정책: 최소 8자, 영문 대/소문자·숫자·특수문자 중 3종 이상 포함.
 * 정책에 위배되면 `BadRequestException`(VALIDATION_ERROR)을 던진다.
 */
export function validatePasswordStrength(password: string): void {
  if (password.length < 8) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Password must be at least 8 characters',
      details: [
        { field: 'password', message: 'Minimum 8 characters required' },
      ],
    });
  }

  let typesCount = 0;
  if (/[a-z]/.test(password)) typesCount++;
  if (/[A-Z]/.test(password)) typesCount++;
  if (/[0-9]/.test(password)) typesCount++;
  if (/[^a-zA-Z0-9]/.test(password)) typesCount++;

  if (typesCount < 3) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message:
        'Password must contain at least 3 of: lowercase, uppercase, numbers, special characters',
      details: [{ field: 'password', message: 'Requires 3+ character types' }],
    });
  }
}
