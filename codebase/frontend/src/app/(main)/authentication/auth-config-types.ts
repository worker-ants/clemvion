/**
 * 인증 설정(AuthConfig) 화면의 공유 타입·상수·표시 헬퍼.
 * page.tsx 의 God Component 분리 시 create/edit 폼·목록·usage 드로어 컴포넌트가
 * 공통으로 참조하도록 추출했다 (프레젠테이션 로직만 — 순수 페이로드/검증은 auth-config-form.ts).
 */
import type { TranslationKey } from "@/lib/i18n";
import type { AuthConfigType } from "./auth-config-form";

export interface AuthConfig {
  id: string;
  name: string;
  type: AuthConfigType;
  isActive: boolean;
  lastUsedAt?: string;
  /** 마스킹된 config (목록/상세 응답). 평문은 create/regenerate/reveal 만. */
  config?: Record<string, unknown>;
  /** top-level IP 화이트리스트 (선택). 편집 폼 초기값에 사용. */
  ipWhitelist?: string[];
}

export interface UsageRecentCall {
  id: string;
  triggerName: string;
  status: string;
  startedAt: string;
  /** webhook 소스 IP. 캡처되지 않은 호출(비-HTTP 트리거)은 null. */
  sourceIp: string | null;
  /** 응답 코드 — webhook 은 HTTP 코드('202'), 비-HTTP 는 status enum 폴백. */
  responseCode: string;
}

export interface UsagePeriodCounts {
  last24h: number;
  last7d: number;
  last30d: number;
}

export interface AuthConfigUsage {
  totalCalls: number;
  lastUsedAt: string | null;
  /** §A.3 기간별 호출 수 — 롤링 윈도(24h/7d/30d). */
  periodCounts: UsagePeriodCounts;
  recentCalls: UsageRecentCall[];
}

/**
 * 인증 type 셀렉트 옵션 — create/edit 폼(AuthConfigFormFields)이 공유한다.
 * type→labelKey 단일 SoT(목록 화면의 type 배지 라벨도 여기서 파생).
 */
export const AUTH_TYPES: { value: AuthConfigType; labelKey: TranslationKey }[] = [
  { value: "api_key", labelKey: "authentication.typeApiKey" },
  { value: "bearer_token", labelKey: "authentication.typeBearerToken" },
  { value: "basic_auth", labelKey: "authentication.typeBasicAuth" },
  { value: "hmac", labelKey: "authentication.typeHmac" },
];

/** create/regenerate/reveal 응답에서 평문 비밀값 1개를 추출 (표시용). */
export function pickPlaintextSecret(
  config: Record<string, unknown> | undefined,
): string | null {
  if (!config) return null;
  const v = config.key ?? config.token ?? config.secret ?? config.password;
  return typeof v === "string" ? v : null;
}
