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

import {
  isPostgresLockNotAvailable,
  isPostgresUniqueViolation,
} from '../db/pg-error';

/** http-errors(body-parser 등)·express 미들웨어 오류가 싣는 숫자 상태 필드. */
type HttpErrorLike = { status?: number; statusCode?: number };

/** 응답 봉투의 `message` · `details`. 두 가림 함수가 이 꼴을 받아 이 꼴로 돌려준다. */
type ErrorText = { message: string; details: unknown };

/** throw 된 값 하나를 해석한 응답 값. `requestId` 는 `catch` 가 붙인다. */
type ResolvedError = ErrorText & { status: number; code: string };

/**
 * `Error` 가 아닌 throw 값을 로그 한 줄로 바꾼다. `String()` 은 프로토타입이 없는 객체에서
 * `TypeError` 를 내므로 그때는 타입만 남긴다. 필터 안에서 다시 throw 하면 응답이 나가지 않는다.
 */
function describeThrown(value: unknown): string {
  try {
    return String(value);
  } catch {
    return `<${typeof value}>`;
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * `INTERNAL_ERROR` 와 5xx 가 싣는 고정 문구 하나. 매핑되지 않은 내부 `Error`, `Error` 가 아닌
   * 값의 throw, 5xx `HttpException` 이 모두 이 문구를 쓴다. 원문은 `requestId` 와 함께
   * `logger.error` 로만 남긴다(CWE-209, CLE-API-ERROR 「`message` 에 내부 원문을 싣지 않는다」).
   * 한국어 화면 문구는 프런트엔드가 `code` 로 고른다(CLE-API-ERRCODES-SYSVAL §6.1).
   */
  private static readonly INTERNAL_ERROR_MESSAGE =
    'An unexpected error occurred. Please try again later.';
  /**
   * 413 의 고정 문구. http-errors(body-parser) 413 과 `code` 를 지정하지 않은 `HttpException`
   * 413(Nest 가 multer `LIMIT_FILE_SIZE` 를 바꾼 `PayloadTooLargeException('File too large')`)이
   * 함께 쓴다. 원문은 `logger.warn` 으로만 남긴다(CWE-209, CLE-API-ERROR).
   */
  private static readonly PAYLOAD_TOO_LARGE_MESSAGE =
    'Request payload too large.';

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = uuidv4();
    const { status, code, message, details } = this.resolveError(
      exception,
      requestId,
    );

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
   * throw 된 값을 응답 봉투의 값으로 바꾼다. 분기 순서는 `HttpException` → Postgres 오류 →
   * 그 밖의 `Error` → `Error` 가 아닌 값이다. 로그는 각 분기가 남긴다.
   */
  private resolveError(exception: unknown, requestId: string): ResolvedError {
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception, requestId);
    }
    const postgres = this.mapPostgresError(exception);
    if (postgres) return postgres;
    if (exception instanceof Error) {
      return this.resolveUnhandledError(exception, requestId);
    }
    // `Error` 가 아닌 값(문자열 · 객체)의 throw. stack 이 없어 값만 남긴다.
    this.logger.error(
      `Unhandled non-Error throw requestId=${requestId}: ${describeThrown(exception)}`,
    );
    return GlobalExceptionFilter.internalError();
  }

  /**
   * `HttpException` 의 상태 · `code` · `message` · `details` 를 읽는다. 응답 객체의 최상위
   * `{ code, message, details }` 와 nested `{ error: { code, message, details } }` 를 모두 읽고
   * 최상위 값을 먼저 쓴다. `code` 가 없으면 상태로 정한다. 그다음 `code` 없는 413 과 5xx 를 가린다.
   */
  private resolveHttpException(
    exception: HttpException,
    requestId: string,
  ): ResolvedError {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    let code: string;
    let text: ErrorText;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      // Nested `{ error: { code, message, details } }` 형태도 인식 — `interaction` 모듈처럼
      // API 컨벤션 §5.3 의 nested error shape 으로 throw 하는 코드를 정상 처리한다
      // (e2e D 시나리오 회귀 fix — PR2 ai-review follow-up).
      const nested =
        typeof resp.error === 'object' && resp.error !== null
          ? (resp.error as Record<string, unknown>)
          : null;
      const explicitCode =
        (resp.code as string) || (nested?.code as string) || undefined;
      code = explicitCode || this.getCodeFromStatus(status);
      text = {
        message:
          (resp.message as string) ||
          (nested?.message as string) ||
          exception.message,
        details: resp.details ?? nested?.details,
      };
      if (!explicitCode) {
        text = this.maskUncodedPayloadTooLarge(status, text);
      }
    } else {
      code = this.getCodeFromStatus(status);
      text = this.maskUncodedPayloadTooLarge(status, {
        message: exception.message,
        details: undefined,
      });
    }
    // `no-unsafe-enum-comparison` 회피 — status 는 number 라 HttpStatus 대신 500 과 견준다.
    if (status >= 500) {
      text = this.maskServerError(
        status,
        code,
        text,
        requestId,
        exception.stack,
      );
    }
    return { status, code, ...text };
  }

  /**
   * 응답 상태를 정할 수 있는 Postgres 오류를 매핑한다. 해당하지 않으면 null 이고 호출부가 다음
   * 분기로 넘긴다. Postgres 오류 코드 매핑을 더할 때 이 메서드에 분기를 더한다.
   */
  private mapPostgresError(exception: unknown): ResolvedError | null {
    if (isPostgresUniqueViolation(exception)) {
      // race window 에서의 unique constraint 위반은 클라이언트에게 409 가 옳다.
      // (애플리케이션 단의 사전 체크 후 동시 두 요청이 모두 통과한 케이스 등)
      return {
        status: HttpStatus.CONFLICT,
        code: 'RESOURCE_CONFLICT',
        message: 'Resource already exists or has been modified concurrently.',
        details: undefined,
      };
    }
    if (isPostgresLockNotAvailable(exception)) {
      // 잠금 대기 상한(`SET LOCAL lock_timeout`)을 넘긴 요청이다. 트랜잭션이 롤백되어 남는 쓰기가 없고,
      // 다시 시도하면 대개 통과하는 일시적 실패라 503 이다. 경로마다 따로 매핑하지 않는다
      // (`CLE-ACCT-DATA` Rationale 「잠금 대기 초과는 503 `SERVICE_UNAVAILABLE` 로 낸다」, NERV Task `CLE-T-1C2JE0`).
      // 드라이버 원문은 응답에 싣지 않고 서버 로그에만 남긴다.
      this.logger.warn(
        `lock wait timeout (55P03): ${exception instanceof Error ? exception.message : describeThrown(exception)}`,
      );
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is temporarily unavailable.',
        details: undefined,
      };
    }
    return null;
  }

  /**
   * `HttpException` 도 Postgres 오류도 아닌 `Error` 를 처리한다. 4xx http-error 는 그 상태로
   * 싣고 원문은 `logger.warn` 으로 남긴다. 나머지는 원문과 stack 을 `requestId` 와 함께
   * `logger.error` 로 남기고 500 `INTERNAL_ERROR` 로 가린다.
   */
  private resolveUnhandledError(
    exception: Error,
    requestId: string,
  ): ResolvedError {
    const mapped = this.mapHttpErrorLike(exception);
    if (mapped) {
      // 4xx http-error 는 클라이언트 오류지만 운영 가시성을 위해 원본 메시지를 로깅한다.
      this.logger.warn(`http-error ${mapped.status}: ${exception.message}`);
      return { ...mapped, details: undefined };
    }
    this.logger.error(
      `Unhandled exception requestId=${requestId}: ${exception.message}`,
      exception.stack,
    );
    return GlobalExceptionFilter.internalError();
  }

  /** 가린 500 `INTERNAL_ERROR` 응답 값. */
  private static internalError(): ResolvedError {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: GlobalExceptionFilter.INTERNAL_ERROR_MESSAGE,
      details: undefined,
    };
  }

  /**
   * NestJS `HttpException` 이 아닌 http-errors(예: body-parser 의 `PayloadTooLargeError`) 를
   * 매핑한다. 숫자 `status`/`statusCode` 가 4xx 면 그 상태로 표준 봉투에 싣어, 클라이언트 오류
   * (예: 본문 초과 → 413 `PAYLOAD_TOO_LARGE`)가 오해의 소지 있는 500 으로 가려지지 않게 한다.
   * 5xx·상태 부재는 null 을 반환해 `resolveUnhandledError` 가 generic 500 으로 가린다(내부 메시지 누출 차단).
   * 반환 `message` 는 CWE-209 방지를 위해 내부 원문을 echo 하지 않고 상태 기반 고정 문구만 쓴다.
   */
  private mapHttpErrorLike(
    exception: Error,
  ): { status: number; code: string; message: string } | null {
    const err = exception as Error & HttpErrorLike;
    const errStatus = err.status ?? err.statusCode;
    if (typeof errStatus === 'number' && errStatus >= 400 && errStatus < 500) {
      // 내부 메시지(경로·스택·라이브러리 힌트)를 클라이언트로 echo 하지 않는다(CWE-209) —
      // 상태 기반 일반 문구만 반환한다. 원본 message 는 `resolveUnhandledError` 의 `logger.warn` 으로만 남긴다.
      // (현재 도달 경로는 body-parser 413 뿐이나, 향후 http-errors 미들웨어 추가에도 안전.)
      return {
        status: errStatus,
        code: this.getCodeFromStatus(errStatus),
        message:
          // 413 (`no-unsafe-enum-comparison` 회피 — errStatus 는 number, getCodeFromStatus 와 동형).
          errStatus === 413
            ? GlobalExceptionFilter.PAYLOAD_TOO_LARGE_MESSAGE
            : 'The request could not be processed.',
      };
    }
    return null;
  }

  /**
   * 5xx `HttpException` 의 `message` 와 `details` 를 가린다. `code` 는 두고 호출부가 그대로 쓴다.
   * 작성자가 쓴 문구와 `details` 에는 환경 변수 이름 같은 구성 정보가 섞일 수 있다
   * (`OAUTH_CONFIG_MISSING`, CWE-209). 원문은 `requestId` 와 함께 `logger.error` 로만 남기고
   * 프런트엔드는 `code` 로 문구를 고른다. 5xx 가 `details` 를 응답에 싣는 사용처는 없다.
   *
   * 로그 한 줄에는 `message` 만 문자열로 보간한다. 배열 `message` 는 쉼표로 이은 문자열로,
   * 객체 `message` 는 `[object Object]` 로 남는다. `details` 는 응답에서 빠지고 로그에도 남지 않는다.
   * 두 번째 인자로 예외의 stack 을 넘긴다.
   */
  private maskServerError(
    status: number,
    code: string,
    text: ErrorText,
    requestId: string,
    stack: string | undefined,
  ): ErrorText {
    this.logger.error(
      `HttpException ${status} ${code} requestId=${requestId}: ${text.message}`,
      stack,
    );
    return {
      message: GlobalExceptionFilter.INTERNAL_ERROR_MESSAGE,
      details: undefined,
    };
  }

  /**
   * `code` 를 지정하지 않은 `HttpException` 413 의 message 를 고정 문구로 바꾼다. multer 원문
   * (`"File too large"`)처럼 라이브러리 힌트가 클라이언트에 가지 않게 한다(CWE-209). 다른 상태는
   * 그대로 둔다. `code` 를 지정한 413(공개 웹훅 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 등)은 호출부가 이
   * 함수를 부르지 않아 도메인 문구를 보존한다. `details` 는 413 에서도 바꾸지 않는다.
   */
  private maskUncodedPayloadTooLarge(
    status: number,
    text: ErrorText,
  ): ErrorText {
    // `no-unsafe-enum-comparison` 회피 — status 는 number 라 mapHttpErrorLike 와 같은 형태로 견준다.
    if (status !== 413) return text;
    this.logger.warn(`http-exception 413: ${text.message}`);
    return {
      message: GlobalExceptionFilter.PAYLOAD_TOO_LARGE_MESSAGE,
      details: text.details,
    };
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
