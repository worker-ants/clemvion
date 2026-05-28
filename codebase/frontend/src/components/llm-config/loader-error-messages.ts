import type { TFunction } from "@/lib/i18n";

/**
 * Backend LLM error codes ({ error: { code } }, http-exception.filter) that map
 * to a specific, user-actionable localized message. Codes not listed here fall
 * back to the loader's generic `fallbackErrorMessage`. Raw server text is never
 * surfaced — provider error strings can leak endpoint / upstream detail
 * (review/code/2026/05/26/12_10_38 SUMMARY #10).
 *
 * When adding a code here, add the matching key to both `i18n/dict/ko/llmConfigs`
 * and `i18n/dict/en/llmConfigs`.
 */
export function buildLoaderErrorMessages(t: TFunction): Record<string, string> {
  return {
    LLM_CREDENTIALS_REQUIRED: t("llmConfigs.errorCredentialsRequired"),
    LLM_CONFIG_INVALID: t("llmConfigs.errorConfigInvalid"),
  };
}
