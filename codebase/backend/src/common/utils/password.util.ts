import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * bcrypt cost factor. 비밀번호 해시의 단일 SoT — auth.service·users.service 등
 * 모든 해시 경로가 `hashPassword` 를 통해 동일 rounds 를 쓴다 (refactor 04 후속 B-3).
 */
export const BCRYPT_ROUNDS = 12;

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
