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
    // Legacy codes: still emitted by the LLM execution path (llm.service.ts).
    // Intentionally NOT renamed in PR4 — keep these mappings.
    LLM_CREDENTIALS_REQUIRED: t("llmConfigs.errorCredentialsRequired"),
    LLM_CONFIG_INVALID: t("llmConfigs.errorConfigInvalid"),
    // Unified model-config service error codes (model-config.service.ts).
    // Added in PR4 resolution: `/api/model-configs` endpoints throw these.
    MODEL_CONFIG_INVALID: t("llmConfigs.errorConfigInvalid"),
    MODEL_CONFIG_NOT_FOUND: t("llmConfigs.errorConfigInvalid"),
  };
}
