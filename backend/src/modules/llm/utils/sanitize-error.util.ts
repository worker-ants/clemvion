/**
 * Provider 원본 에러 메시지를 사용자 친화적·민감정보 미포함 형태로 정규화.
 * HTTP 상태 코드 / 전형적인 네트워크 에러 문구를 패턴 매치해 표준 문구로 치환.
 * 매치되지 않는 에러는 "Connection test failed..." 폴백으로 통일.
 */
export function sanitizeLlmErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (
    message.includes('401') ||
    m.includes('unauthorized') ||
    m.includes('authentication')
  ) {
    return 'Authentication failed. Please check your API key.';
  }
  if (message.includes('403') || m.includes('forbidden')) {
    return 'Access denied. Please check your API key permissions.';
  }
  if (message.includes('404') || m.includes('not found')) {
    return 'Model or endpoint not found. Please check your configuration.';
  }
  if (message.includes('429') || m.includes('rate limit')) {
    return 'Rate limit exceeded. Please try again later.';
  }
  if (m.includes('timeout') || m.includes('timed out')) {
    return 'Connection timed out. Please check your network or endpoint URL.';
  }
  if (m.includes('econnrefused') || m.includes('connection refused')) {
    return 'Connection refused. Please check your endpoint URL.';
  }
  if (m.includes('enotfound') || m.includes('getaddrinfo')) {
    return 'Could not resolve hostname. Please check your endpoint URL.';
  }
  return 'Connection test failed. Please check your configuration.';
}
