import { BadRequestException } from '@nestjs/common';

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
