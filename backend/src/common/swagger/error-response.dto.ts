import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `GlobalExceptionFilter`가 반환하는 에러 본문의 `error` 객체.
 */
export class ErrorResponseBodyDto {
  /** 애플리케이션 에러 코드 (e.g. `VALIDATION_ERROR`, `AUTH_REQUIRED`, `RESOURCE_NOT_FOUND`) */
  @ApiProperty({
    description:
      '애플리케이션 에러 코드. 상태 코드별 기본값: 400=VALIDATION_ERROR, 401=AUTH_REQUIRED, 403=FORBIDDEN, 404=RESOURCE_NOT_FOUND, 409=RESOURCE_CONFLICT, 422=INVALID_STATE, 429=RATE_LIMITED, 5xx=INTERNAL_ERROR.',
    example: 'RESOURCE_NOT_FOUND',
  })
  code: string;

  /** 사용자에게 표시 가능한 에러 메시지 */
  @ApiProperty({
    description: '사용자에게 표시 가능한 에러 메시지',
    example: '요청한 리소스를 찾을 수 없습니다.',
  })
  message: string;

  /** 요청 추적용 UUID (로그 상관관계) */
  @ApiProperty({
    description: '요청 추적용 UUID. 서버 로그와의 상관관계 분석에 사용합니다.',
    format: 'uuid',
    example: 'f3b6d2e0-9d4a-4b77-9d19-7a0f8f4c1e2b',
  })
  requestId: string;

  /** 추가 컨텍스트 (검증 오류 필드 정보 등) */
  @ApiPropertyOptional({
    description:
      '추가 컨텍스트. 검증 오류 필드나 도메인별 상세 정보가 담깁니다.',
    type: 'object',
    additionalProperties: true,
  })
  details?: unknown;
}

/**
 * 프로젝트 공통 에러 응답 래퍼.
 *
 * Example:
 * ```json
 * { "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "...", "details": { ... } } }
 * ```
 */
export class ErrorResponseDto {
  /** 에러 본문 */
  @ApiProperty({ type: () => ErrorResponseBodyDto })
  error: ErrorResponseBodyDto;
}
