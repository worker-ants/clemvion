import { isPrivateHost, resolvesToPrivate } from './ssrf.util';

/**
 * SMTP SSRF 가드 — http_request / database_query integration 노드와 **동일한
 * 정책**으로 동작한다: 기본적으로 사설(RFC1918)·loopback·link-local·IPv6 사설
 * 대역 host 를 차단하고, self-host 환경은 `ALLOW_PRIVATE_HOST_TARGETS=true` 로
 * opt-out 한다 (내부 SMTP relay 사용 사례 보존). 동일 플래그를 공유해 통합
 * 노드 전반의 SSRF posture 가 일관되게 유지된다.
 *
 * connection test (`IntegrationsService.testEmailTransport`) 와 실제 발송
 * (`SendEmailHandler`) 양쪽에서 호출해, 테스트만 막고 발송은 뚫리는 비대칭을
 * 방지한다.
 *
 * DNS rebinding 2차 공격(연결 시점 재해석)은 `ssrf.util` 과 동일한 한계가 있으며
 * egress 방화벽으로 보완한다.
 */
function isPrivateHostsAllowed(): boolean {
  return process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true';
}

export async function isSmtpHostBlocked(host: string): Promise<boolean> {
  if (isPrivateHostsAllowed()) return false;
  const trimmed = host?.trim();
  if (!trimmed) return false;
  // `ssrf.util` 은 URL 을 받으므로 SMTP host 를 http URL 로 감싼다. IPv6 리터럴은
  // URL 파서를 위해 대괄호로 감싼다. (SMTP host 필드에는 포트가 없다.)
  const probeUrl =
    trimmed.includes(':') && !trimmed.startsWith('[')
      ? `http://[${trimmed}]`
      : `http://${trimmed}`;
  if (isPrivateHost(probeUrl)) return true;
  return resolvesToPrivate(probeUrl);
}
