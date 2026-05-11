/**
 * 인증 흐름에서 요청 컨텍스트(client IP, User-Agent)를 service 로 전달하는 단일 타입.
 * AuthService 와 SessionsService 가 공유한다.
 */
export interface AuthContext {
  ip?: string | null;
  userAgent?: string | null;
}
