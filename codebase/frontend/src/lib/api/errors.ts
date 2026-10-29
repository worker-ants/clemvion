import axios, { type AxiosError } from "axios";

/**
 * 백엔드 응답은 GlobalExceptionFilter 가 `{error: {code, message, ...}}` 로 wrap 한다.
 * 일부 컨트롤러는 평탄한 `{code, message}` 도 반환할 수 있어 양쪽을 모두 탐색한다.
 */
export type ApiErrorBody = {
  code?: string;
  message?: string;
  details?: unknown;
  error?: { code?: string; message?: string; details?: unknown };
};

export function extractApiCode(err: AxiosError<ApiErrorBody>): string | undefined {
  const data = err.response?.data;
  return data?.code ?? data?.error?.code;
}

export function extractApiMessage(err: AxiosError<ApiErrorBody>): string | undefined {
  const data = err.response?.data;
  return data?.message ?? data?.error?.message;
}

/** 코드별로 모양이 다른 부가 정보(`details`). 응답에 없으면 `undefined`. */
export function extractApiDetails(err: AxiosError<ApiErrorBody>): unknown {
  const data = err.response?.data;
  return data?.details ?? data?.error?.details;
}

/**
 * 서버·네트워크 에러를 사용자에게 보여줄 문자열로 변환한다.
 * Axios 응답이면 백엔드의 `message` 필드를 우선 사용하고,
 * 없으면 fallback. 백엔드가 안전한 메시지만 반환한다는 전제.
 */
export function axiosMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
