import type Express from 'express';
import { extractClientIp } from './client-ip';
import type { AuthContext } from '../types/auth-context';

/**
 * Express 요청에서 인증 컨텍스트(client IP · User-Agent)를 추출한다 (refactor 04 후속 C-1 — DRY).
 *
 * `auth.controller` 와 `webauthn.controller` 가 동일 코드를 각각 정의하던 것을 단일 함수로
 * 통합한다. IP 추출은 `extractClientIp`(CF-신뢰 게이트 `TRUST_CF_CONNECTING_IP` 포함, §2.3
 * Rationale 2.3.B)를 쓰고, 결과는 `AuthContext`(service 전달용 단일 타입)로 반환한다.
 */
export function authContextFromRequest(req: Express.Request): AuthContext {
  const headers = req.headers ?? {};
  return {
    ip: extractClientIp(req),
    userAgent: headers['user-agent'] ?? null,
  };
}
