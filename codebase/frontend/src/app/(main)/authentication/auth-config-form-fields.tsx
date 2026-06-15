"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import type { AuthConfigType } from "./auth-config-form";
import { AUTH_TYPES } from "./auth-config-types";
import type { UseAuthConfigForm } from "./use-auth-config-form";

/**
 * 생성·편집 다이얼로그가 공유하는 입력 필드(name·type·type별 추가입력·IP 화이트리스트).
 * 이전 `dialogMode === "edit"` 분기는 명시적 capability prop 으로 대체했다 —
 * create 는 `showPassword`, edit 는 `typeDisabled`/`showTypeLockedHint` 만 켠다.
 */
interface AuthConfigFormFieldsProps {
  form: UseAuthConfigForm;
  /** 편집 모드는 type 변경 불가(비밀값 재발급 수반). */
  typeDisabled: boolean;
  /** type 잠금 안내 문구 노출(편집 모드). */
  showTypeLockedHint: boolean;
  /** basic_auth password 입력 노출(생성 모드 전용 — 비밀값). */
  showPassword: boolean;
}

export function AuthConfigFormFields({
  form,
  typeDisabled,
  showTypeLockedHint,
  showPassword,
}: AuthConfigFormFieldsProps) {
  const t = useT();
  return (
    <>
      <div>
        <Label htmlFor="auth-name">{t("common.name")}</Label>
        <Input
          id="auth-name"
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          placeholder={t("authentication.namePlaceholderConfig")}
        />
      </div>
      <div>
        <Label htmlFor="auth-type">{t("common.type")}</Label>
        <select
          id="auth-type"
          className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          value={form.type}
          // 편집 시 type 변경 불가 — 타입 전환은 비밀값 재발급을 수반하므로
          // 삭제 후 재생성 경로로 일원화한다.
          disabled={typeDisabled}
          onChange={(e) =>
            form.setType(e.target.value as AuthConfigType | "")
          }
        >
          <option value="">{t("authentication.selectType")}</option>
          {AUTH_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
        {showTypeLockedHint && (
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {t("authentication.editTypeLocked")}
          </p>
        )}
      </div>
      {form.type === "hmac" && (
        <>
          <div>
            <Label htmlFor="auth-hmac-header">
              {t("authentication.hmacHeaderLabel")}
            </Label>
            <Input
              id="auth-hmac-header"
              value={form.hmacHeader}
              onChange={(e) => form.setHmacHeader(e.target.value)}
              placeholder="X-Hub-Signature-256"
            />
          </div>
          <div>
            <Label htmlFor="auth-hmac-algorithm">
              {t("authentication.hmacAlgorithmLabel")}
            </Label>
            <select
              id="auth-hmac-algorithm"
              className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
              value={form.hmacAlgorithm}
              onChange={(e) =>
                form.setHmacAlgorithm(e.target.value as "sha256" | "sha512")
              }
            >
              <option value="sha256">sha256</option>
              <option value="sha512">sha512</option>
            </select>
          </div>
        </>
      )}
      {form.type === "api_key" && (
        <div>
          <Label htmlFor="auth-api-key-header">
            {t("authentication.apiKeyHeaderLabel")}
          </Label>
          <Input
            id="auth-api-key-header"
            value={form.apiKeyHeader}
            onChange={(e) => form.setApiKeyHeader(e.target.value)}
            placeholder="X-API-Key"
          />
        </div>
      )}
      {form.type === "basic_auth" && (
        <>
          <div>
            <Label htmlFor="auth-username">
              {t("authentication.usernameLabel")}
            </Label>
            <Input
              id="auth-username"
              value={form.username}
              onChange={(e) => form.setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>
          {/* 비밀번호는 비밀값이라 편집 폼에서 변경 불가 — 생성 시에만 입력. */}
          {showPassword && (
            <div>
              <Label htmlFor="auth-password">
                {t("authentication.passwordLabel")}
              </Label>
              <Input
                id="auth-password"
                type="password"
                value={form.password}
                onChange={(e) => form.setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}
        </>
      )}
      {/* IP Whitelist — 모든 type 공통(선택). 한 줄에 IP/CIDR 하나. */}
      {form.type !== "" && (
        <div>
          <Label htmlFor="auth-ip-whitelist">
            {t("authentication.ipWhitelistLabel")}
          </Label>
          <textarea
            id="auth-ip-whitelist"
            className="flex min-h-[72px] w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            value={form.ipWhitelist}
            onChange={(e) => form.setIpWhitelist(e.target.value)}
            placeholder={"10.0.0.0/8\n203.0.113.42"}
          />
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {t("authentication.ipWhitelistHint")}
          </p>
        </div>
      )}
    </>
  );
}
