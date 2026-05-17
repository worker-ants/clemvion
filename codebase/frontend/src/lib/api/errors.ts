import axios from "axios";

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
