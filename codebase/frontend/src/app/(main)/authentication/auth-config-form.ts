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

/** "한 줄에 IP/CIDR 하나" textarea → 공백·빈 줄 제거한 배열. CRLF/LF 모두 처리. */
export function parseIpWhitelist(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** IPv6(+CIDR) pragmatic 검증 — `:::`·중복 `::`·비-hex·4 초과 그룹·잘못된 prefix 배제. */
function isValidIpv6OrCidr(entry: string): boolean {
  const parts = entry.split("/");
  if (parts.length > 2) return false;
  const [addr, prefix] = parts;
  if (prefix !== undefined && !/^(\d|[1-9]\d|1[01]\d|12[0-8])$/.test(prefix)) {
    return false; // /0–128 만 허용
  }
  if (!addr.includes(":")) return false;
  if (/:::/.test(addr)) return false; // 3+ 연속 콜론 불가
  if ((addr.match(/::/g) ?? []).length > 1) return false; // '::' 압축 1회 한정
  if (!/^[0-9a-fA-F:]+$/.test(addr)) return false; // hex + 콜론만
  const groups = addr.split(":").filter((g) => g.length > 0);
  if (addr !== "::" && groups.length === 0) return false; // 최소 1 hex 그룹(단 "::" 허용)
  if (groups.some((g) => g.length > 4)) return false; // 그룹당 최대 4 hex
  return true;
}

/**
 * IPv4/IPv4-CIDR 또는 IPv6/IPv6-CIDR 형식인지 (pragmatic). 전체 RFC 검증은 아니나
 * `javascript:alert(1)`·`:::` 같은 명백한 비-IP 를 거른다. 최종 시행은 백엔드의
 * `ip-address` 라이브러리 기반 fail-closed 매칭 — 본 검증은 입력 단계 UX 가드.
 */
export function isValidIpOrCidr(entry: string): boolean {
  // IPv4 (옵션 /0–32)
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d|[12]\d|3[0-2]))?$/;
  const m = entry.match(v4);
  if (m) {
    return [m[1], m[2], m[3], m[4]].every((octet) => Number(octet) <= 255);
  }
  return isValidIpv6OrCidr(entry);
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
  state: AuthConfigFormState,
): AuthConfigPayload {
  const config: Record<string, unknown> = {};
  if (state.type === "hmac") {
    config.header = state.hmacHeader.trim() || AUTH_CONFIG_DEFAULTS.hmacHeader;
    config.algorithm = state.hmacAlgorithm;
  }
  if (state.type === "api_key") {
    // 비우면 백엔드 기본값(X-API-Key)이 적용되도록 미포함.
    const header = state.apiKeyHeader.trim();
    if (header) config.headerName = header;
  }
  if (state.type === "basic_auth") {
    config.username = state.username.trim();
    config.password = state.password;
  }
  const ipWhitelist = parseIpWhitelist(state.ipWhitelistRaw);
  return {
    name: state.name,
    type: state.type,
    config,
    ...(ipWhitelist.length > 0 ? { ipWhitelist } : {}),
  };
}

export type AuthConfigFormError =
  | { key: "invalidHeaderName" }
  | { key: "invalidIpWhitelist"; invalid: string[] };

/** 제출 전 검증 — 문제 없으면 null. 호출부가 key 로 i18n 토스트를 띄운다. */
export function validateAuthConfigForm(
  state: AuthConfigFormState,
): AuthConfigFormError | null {
  // api_key 헤더명·hmac 서명 헤더명 모두 RFC 7230 token 검증(빈 값은 기본값 적용이라 통과).
  if (state.type === "api_key") {
    const header = state.apiKeyHeader.trim();
    if (header && !isValidHeaderName(header)) {
      return { key: "invalidHeaderName" };
    }
  }
  if (state.type === "hmac") {
    const header = state.hmacHeader.trim();
    if (header && !isValidHeaderName(header)) {
      return { key: "invalidHeaderName" };
    }
  }
  const invalid = parseIpWhitelist(state.ipWhitelistRaw).filter(
    (entry) => !isValidIpOrCidr(entry),
  );
  if (invalid.length > 0) {
    return { key: "invalidIpWhitelist", invalid };
  }
  return null;
}
