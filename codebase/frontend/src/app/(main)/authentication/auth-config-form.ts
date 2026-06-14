/**
 * 인증 설정(AuthConfig) 생성 폼의 순수 로직 — 페이로드 조립·검증·기본값.
 * 프레젠테이션(page.tsx)에서 분리해 단위 테스트 가능하게 한다 (spec/2-navigation/6-config.md §A.2).
 */

export type AuthConfigType = "api_key" | "bearer_token" | "basic_auth" | "hmac";

/** 폼/페이로드 기본값 단일 소스 (이전엔 page.tsx 여러 곳에 하드코딩). */
export const AUTH_CONFIG_DEFAULTS = {
  apiKeyHeader: "X-API-Key",
  hmacHeader: "X-Hub-Signature-256",
  hmacAlgorithm: "sha256",
} as const;

/** "한 줄에 IP/CIDR 하나" textarea → 공백·빈 줄 제거한 배열. */
export function parseIpWhitelist(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * IPv4/IPv4-CIDR 또는 IPv6/IPv6-CIDR 형식인지 (pragmatic). 전체 RFC 검증은 아니나
 * `javascript:alert(1)` 같은 명백한 비-IP 문자열을 거른다. 최종 방어선은 백엔드 DTO.
 */
export function isValidIpOrCidr(entry: string): boolean {
  // IPv4 (옵션 /0–32)
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d|[12]\d|3[0-2]))?$/;
  const m = entry.match(v4);
  if (m) {
    return [m[1], m[2], m[3], m[4]].every((octet) => Number(octet) <= 255);
  }
  // IPv6 (콜론 포함, hex 그룹, 옵션 /0–128). 느슨하지만 비-hex 문자는 배제.
  const v6 = /^[0-9a-fA-F:]+(\/(\d|[1-9]\d|1[01]\d|12[0-8]))?$/;
  return v6.test(entry) && entry.includes(":");
}

/** RFC 7230 token 문자만으로 이뤄진 유효 HTTP 헤더명인지 (개행·콜론·공백 차단). */
export function isValidHeaderName(name: string): boolean {
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name);
}

export interface AuthConfigFormState {
  name: string;
  type: AuthConfigType;
  apiKeyHeader: string;
  hmacHeader: string;
  hmacAlgorithm: "sha256" | "sha512";
  username: string;
  password: string;
  ipWhitelistRaw: string;
}

export interface AuthConfigPayload {
  name: string;
  type: AuthConfigType;
  config: Record<string, unknown>;
  ipWhitelist?: string[];
}

/** 폼 상태 → POST /auth-configs 페이로드 (순수). 빈 ipWhitelist 는 미포함. */
export function buildAuthConfigPayload(
  s: AuthConfigFormState,
): AuthConfigPayload {
  const config: Record<string, unknown> = {};
  if (s.type === "hmac") {
    config.header = s.hmacHeader.trim() || AUTH_CONFIG_DEFAULTS.hmacHeader;
    config.algorithm = s.hmacAlgorithm;
  }
  if (s.type === "api_key") {
    // 비우면 백엔드 기본값(X-API-Key)이 적용되도록 미포함.
    const header = s.apiKeyHeader.trim();
    if (header) config.headerName = header;
  }
  if (s.type === "basic_auth") {
    config.username = s.username.trim();
    config.password = s.password;
  }
  const ipWhitelist = parseIpWhitelist(s.ipWhitelistRaw);
  return {
    name: s.name,
    type: s.type,
    config,
    ...(ipWhitelist.length > 0 ? { ipWhitelist } : {}),
  };
}

export type AuthConfigFormError =
  | { key: "invalidHeaderName" }
  | { key: "invalidIpWhitelist"; invalid: string[] };

/** 제출 전 검증 — 문제 없으면 null. 호출부가 key 로 i18n 토스트를 띄운다. */
export function validateAuthConfigForm(
  s: AuthConfigFormState,
): AuthConfigFormError | null {
  if (s.type === "api_key") {
    const header = s.apiKeyHeader.trim();
    if (header && !isValidHeaderName(header)) {
      return { key: "invalidHeaderName" };
    }
  }
  const invalid = parseIpWhitelist(s.ipWhitelistRaw).filter(
    (entry) => !isValidIpOrCidr(entry),
  );
  if (invalid.length > 0) {
    return { key: "invalidIpWhitelist", invalid };
  }
  return null;
}
