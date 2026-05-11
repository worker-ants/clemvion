/**
 * 사용자에게 보여줄 디바이스 라벨을 User-Agent 에서 파생한다.
 *
 * 외부 의존성 없이 순수 정규식으로만 동작 — geoip / parser 라이브러리는 추가하지 않는다.
 * 식별 실패 시에는 UA 원문을 64자 이하로 축약한다.
 */
const MAX_LABEL_LENGTH = 64;

export function deriveDeviceLabel(
  userAgent: string | null | undefined,
): string {
  if (!userAgent || !userAgent.trim()) return 'Unknown device';
  const ua = userAgent.trim();

  const os = detectOs(ua);
  const browser = detectBrowser(ua);

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return `Unknown browser on ${os}`;

  // 잘 알려진 CLI 도구만 이름으로 축약 (그 외 봇/UA 는 원문 유지)
  if (/^curl\//i.test(ua)) return 'curl';
  if (/^Wget\//i.test(ua)) return 'wget';
  if (/^HTTPie\//i.test(ua)) return 'HTTPie';
  if (/^PostmanRuntime\//i.test(ua)) return 'Postman';

  return truncate(ua);
}

function detectBrowser(ua: string): string | null {
  // 순서가 중요: Edg/Opera/Chromium 변종이 Chrome 보다 먼저 검사되어야 한다
  if (/\bEdg\//.test(ua)) return 'Edge';
  if (/\bOPR\/|Opera\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  return null;
}

function detectOs(ua: string): string | null {
  if (/iPhone|iPad|iPod|iOS/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return null;
}

function truncate(text: string): string {
  if (text.length <= MAX_LABEL_LENGTH) return text;
  return text.slice(0, MAX_LABEL_LENGTH - 1) + '…';
}
