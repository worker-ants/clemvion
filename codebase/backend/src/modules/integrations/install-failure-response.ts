import { HttpException, HttpStatus } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

// 근거: [OAuth 연결과 토큰 갱신 「설치 엔드포인트 (App URL)」](CLE-INT-OAUTH#설치-엔드포인트-app-url)
/**
 * 설치 엔드포인트(App URL)의 실패 응답 조립.
 *
 * 설치 엔드포인트는 `@Res` 로 응답을 직접 써서 `GlobalExceptionFilter` 를 거치지 않는다.
 * 그래서 에러 응답 봉투(`{ error: { code, message, requestId } }`)와 5xx 가림을
 * 여기서 따로 맞춘다. 판정 규칙은 필터와 같다.
 */

/**
 * 원문을 가린 실패의 고정 문구 — `HttpException` 이 아닌 예외와 5xx `HttpException` 이 쓴다.
 * 예외 원문은 응답에 싣지 않는다(CWE-209).
 */
export const INSTALL_UNEXPECTED_ERROR_MESSAGE =
  'Install failed due to an unexpected server error. Please try again later.';

export interface InstallFailure {
  status: number;
  code: string;
  message: string;
  /**
   * 원문을 가렸다(`HttpException` 이 아닌 예외, 또는 5xx `HttpException`). 호출부가 원문을
   * `requestId` 와 함께 서버 로그에 남긴다.
   */
  unexpected: boolean;
}

export interface InstallErrorBody {
  error: { code: string; message: string; requestId: string };
}

/** 응답마다 새로 발급하는 요청 ID — 전역 예외 필터와 같은 uuid v4. */
export function newInstallRequestId(): string {
  return uuidv4();
}

export function installErrorBody(
  code: string,
  message: string,
  requestId: string,
): InstallErrorBody {
  return { error: { code, message, requestId } };
}

/**
 * 예외를 가림 판정과 4xx 문구 추출로 나눈다. 설치 엔드포인트와 OAuth 콜백이 함께 쓴다.
 *
 * - `HttpException` 이 아니거나 5xx 면 `masked` 다. 호출부가 자기 고정 문구로 바꾼다.
 * - 4xx `HttpException` 이면 `masked` 가 아니고 `message` 는 응답 객체의 `message`(없으면 예외 메시지)다.
 * - `fields` 는 응답 객체이고 문자열 응답이면 빈 객체다.
 */
export interface HttpFailureShape {
  masked: boolean;
  status: number;
  fields: Record<string, unknown>;
  message: string;
}

export function classifyHttpFailure(err: unknown): HttpFailureShape {
  if (!(err instanceof HttpException)) {
    return {
      masked: true,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      fields: {},
      message: '',
    };
  }
  const status = err.getStatus();
  const body = err.getResponse();
  const fields =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const message =
    typeof fields.message === 'string' && fields.message.length > 0
      ? fields.message
      : err.message;
  return { masked: status >= 500, status, fields, message };
}

/**
 * 설치 서비스가 던진 예외를 응답 값으로 바꾼다.
 *
 * - 4xx `HttpException`: 그 상태를 쓴다. 응답 객체의 `code` · `message` 가 있으면 싣고
 *   없으면 `fallbackCode` 와 예외 메시지를 쓴다. 작성자가 정한 문구라 그대로 싣는다.
 * - 5xx `HttpException`: 상태와 `code`(없으면 `fallbackCode`)는 두고 `message` 를 고정 문구로
 *   가린다. 작성자가 쓴 문구라도 환경 변수 이름 같은 구성 정보가 섞인다(`OAUTH_CONFIG_MISSING`).
 * - 그 밖의 예외(DB · 런타임 오류 등): 500 `fallbackCode` 와 고정 문구로 가린다.
 */
export function resolveInstallFailure(
  err: unknown,
  fallbackCode: string,
): InstallFailure {
  const shape = classifyHttpFailure(err);
  const code =
    typeof shape.fields.code === 'string' && shape.fields.code.length > 0
      ? shape.fields.code
      : fallbackCode;
  if (shape.masked) {
    return {
      status: shape.status,
      code,
      message: INSTALL_UNEXPECTED_ERROR_MESSAGE,
      unexpected: true,
    };
  }
  return {
    status: shape.status,
    code,
    message: shape.message,
    unexpected: false,
  };
}
