"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useT, type TranslationKey } from "@/lib/i18n";

export interface AuthConfigOption {
  id: string;
  name: string;
  type: "api_key" | "bearer_token" | "basic_auth" | "hmac";
}

export const AUTH_CONFIG_TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  api_key: "authentication.typeApiKey",
  bearer_token: "authentication.typeBearerToken",
  basic_auth: "authentication.typeBasicAuth",
  hmac: "authentication.typeHmac",
};

/** 워크스페이스의 AuthConfig 목록. trigger drawer / editor node config 가 공유. */
export function useAuthConfigs() {
  return useQuery<AuthConfigOption[]>({
    queryKey: ["auth-configs"],
    queryFn: async () => {
      const res = await apiClient.get("/auth-configs");
      return (res.data.data ?? res.data) as AuthConfigOption[];
    },
  });
}

/**
 * Webhook 트리거에 binding 할 AuthConfig 셀렉터.
 * "인증 없음"(value=null) + 워크스페이스 AuthConfig 목록 + 새 설정 만들기 링크.
 * 인증 자료(secret/token/password) 자체는 Authentication 메뉴에서만 편집·Reveal·Regenerate.
 */
export function AuthConfigSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  id?: string;
}) {
  const t = useT();
  const { data: configs = [], isLoading, isError } = useAuthConfigs();

  return (
    <div className="space-y-1">
      <select
        id={id}
        className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        value={value ?? ""}
        disabled={disabled || isLoading}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{t("triggers.authConfigNone")}</option>
        {configs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ·{" "}
            {t(AUTH_CONFIG_TYPE_LABEL_KEYS[c.type] ?? "authentication.typeApiKey")}
          </option>
        ))}
      </select>
      {isError && (
        <p className="text-xs text-[hsl(var(--destructive))]">
          {t("triggers.authConfigLoadFailed")}
        </p>
      )}
      <a
        href="/authentication"
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs text-[hsl(var(--primary))] hover:underline"
      >
        {t("triggers.authConfigCreateLink")}
      </a>
    </div>
  );
}
