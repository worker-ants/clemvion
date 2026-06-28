import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { QueryFailedError } from 'typeorm';

/** http-errors(body-parser 등)·express 미들웨어 오류가 싣는 숫자 상태 필드. */
type HttpErrorLike = { status?: number; statusCode?: number };

/** Postgres SQLSTATE 23505 = unique_violation. */
function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const driverError = (
    err as QueryFailedError & { driverError?: { code?: string } }
  ).driverError;
  return driverError?.code === '23505';
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * 비-`Error` 값이 throw 된 경우(문자열·객체 등 어떤 분기에도 안 걸린 fallthrough)의 기본 메시지.
   * `UNHANDLED_ERROR_MESSAGE` 와 **의도적으로 다름** — 이쪽은 `Error` 조차 아닌 값이라 stack 도 없다.
   */
  private static readonly UNKNOWN_ERROR_MESSAGE =
    'An unexpected error occurred';
  /**
   * 매핑되지 않은 내부 `Error` 의 마스킹 메시지 — 원문은 `logger.error` 로만 남기고
   * 클라이언트엔 일반 문구만 반환한다(CWE-209).
   */
  private static readonly UNHANDLED_ERROR_MESSAGE =
    'An unexpected error occurred. Please try again later.';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = uuidv4();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = GlobalExceptionFilter.UNKNOWN_ERROR_MESSAGE;
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        // Nested `{ error: { code, message, details } }` 형태도 인식 — `interaction` 모듈처럼
        // API 컨벤션 §5.3 의 nested error shape 으로 throw 하는 코드를 정상 처리한다
        // (e2e D 시나리오 회귀 fix — PR2 ai-review follow-up).
        const nested =
          typeof resp.error === 'object' && resp.error !== null
            ? (resp.error as Record<string, unknown>)
            : null;
        code =
          (resp.code as string) ||
          (nested?.code as string) ||
          this.getCodeFromStatus(status);
        message =
          (resp.message as string) ||
          (nested?.message as string) ||
          exception.message;
        details = resp.details ?? nested?.details;
      } else {
        code = this.getCodeFromStatus(status);
        message = exception.message;
      }
    } else if (isUniqueViolation(exception)) {
      // race window 에서의 unique constraint 위반은 클라이언트에게 409 가 옳다.
      // (애플리케이션 단의 사전 체크 후 동시 두 요청이 모두 통과한 케이스 등)
      status = HttpStatus.CONFLICT;
      code = 'RESOURCE_CONFLICT';
      message = 'Resource already exists or has been modified concurrently.';
    } else if (exception instanceof Error) {
      const mapped = this.mapHttpErrorLike(exception);
      if (mapped) {
        ({ status, code, message } = mapped);
        // 4xx http-error 는 클라이언트 오류지만 운영 가시성을 위해 원본 메시지를 로깅한다.
        this.logger.warn(`http-error ${status}: ${exception.message}`);
      } else {
        this.logger.error(
          `Unhandled exception: ${exception.message}`,
          exception.stack,
        );
        message = GlobalExceptionFilter.UNHANDLED_ERROR_MESSAGE;
      }
    }

    const errorResponse: Record<string, unknown> = {
      error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
      },
    };

    response.status(status).json(errorResponse);
  }

  /**
   * NestJS `HttpException` 이 아닌 http-errors(예: body-parser 의 `PayloadTooLargeError`) 를
   * 매핑한다. 숫자 `status`/`statusCode` 가 4xx 면 그 상태로 표준 봉투에 싣어, 클라이언트 오류
   * (예: 본문 초과 → 413 `PAYLOAD_TOO_LARGE`)가 오해의 소지 있는 500 으로 가려지지 않게 한다.
   * 5xx·상태 부재는 null 을 반환해 호출부가 generic 500 으로 마스킹(내부 메시지 누출 차단)한다.
   * 반환 `message` 는 CWE-209 방지를 위해 내부 원문을 echo 하지 않고 상태 기반 고정 문구만 쓴다.
   */
  private mapHttpErrorLike(
    exception: Error,
  ): { status: number; code: string; message: string } | null {
    const err = exception as Error & HttpErrorLike;
    const errStatus = err.status ?? err.statusCode;
    if (typeof errStatus === 'number' && errStatus >= 400 && errStatus < 500) {
      // 내부 메시지(경로·스택·라이브러리 힌트)를 클라이언트로 echo 하지 않는다(CWE-209) —
      // 상태 기반 일반 문구만 반환한다. 원본 message 는 `catch` 의 `logger.warn` 으로만 남긴다.
      // (현재 도달 경로는 body-parser 413 뿐이나, 향후 http-errors 미들웨어 추가에도 안전.)
      return {
        status: errStatus,
        code: this.getCodeFromStatus(errStatus),
        message:
          // 413 (`no-unsafe-enum-comparison` 회피 — errStatus 는 number, getCodeFromStatus 와 동형).
          errStatus === 413
            ? 'Request payload too large.'
            : 'The request could not be processed.',
      };
    }
    return null;
  }

  private getCodeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
        return 'AUTH_REQUIRED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'RESOURCE_NOT_FOUND';
      case 409:
        return 'RESOURCE_CONFLICT';
      case 413:
        return 'PAYLOAD_TOO_LARGE';
      case 422:
        return 'INVALID_STATE';
      case 429:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
