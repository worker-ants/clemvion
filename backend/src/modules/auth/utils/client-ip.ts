import { Request } from 'express';

/**
 * 운영 환경은 Cloudflare 무료 플랜 뒤에 있다.
 * 클라이언트 IP 추출 우선순위:
 *   1) CF-Connecting-IP   — Cloudflare 가 항상 채우는 원본 클라이언트 IP
 *   2) X-Forwarded-For    — 첫 번째 IP (Cloudflare 또는 추가 프록시가 채움)
 *   3) req.ip             — Express 가 trust proxy 활성 시 파싱한 값
 *   4) req.socket.remoteAddress
 *
 * IPv6-mapped IPv4 (::ffff:1.2.3.4) 는 IPv4 표기로 정규화한다.
 *
 * SECURITY: 본 헬퍼는 신뢰 가능한 origin (CF 뒤) 가정에 의존. origin 단에서
 * Cloudflare IP 대역 외부 트래픽을 차단하지 않으면 CF-Connecting-IP 위변조가 가능하다.
 */
export function extractClientIp(req: Request): string | null {
  const headers = req.headers ?? {};

  const cf = pickFirst(headers['cf-connecting-ip']);
  if (cf) return normalize(cf);

  const xff = pickFirst(headers['x-forwarded-for']);
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return normalize(first);
  }

  if (typeof req.ip === 'string' && req.ip.trim()) {
    return normalize(req.ip.trim());
  }

  const remote = req.socket?.remoteAddress;
  if (typeof remote === 'string' && remote.trim()) {
    return normalize(remote.trim());
  }

  return null;
}

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    const found = value.find((v) => typeof v === 'string' && v.trim() !== '');
    return found ? found.trim() : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return undefined;
}

function normalize(ip: string): string {
  // IPv6-mapped IPv4 ("::ffff:1.2.3.4") → "1.2.3.4"
  const match = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  return match ? match[1] : ip;
}
