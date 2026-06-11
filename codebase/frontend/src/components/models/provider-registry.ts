/**
 * Provider metadata registry — single source of truth for all provider-related
 * constants used across model-config-form-dialog, model-config-manager, and
 * validate-model-config-form.
 *
 * When adding a new provider:
 *  1. Add it to PROVIDERS_BY_KIND for the relevant kind(s).
 *  2. Add it to PROVIDER_LABELS.
 *  3. If it requires a baseUrl, add it to BASE_URL_REQUIRED_PROVIDERS.
 *  4. If it is self-hosted (no apiKey on create), add it to SELF_HOSTED_PROVIDERS.
 */

import type { ModelConfigKind } from "@/lib/api/model-configs";

/** Per-kind ordered provider lists shown in the form dialog select. */
export const PROVIDERS_BY_KIND: Record<
  ModelConfigKind,
  { value: string; label: string }[]
> = {
  chat: [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "google", label: "Google AI" },
    { value: "azure", label: "Azure OpenAI" },
    { value: "local", label: "Local (Ollama/vLLM)" },
  ],
  embedding: [
    { value: "openai", label: "OpenAI" },
    { value: "azure", label: "Azure OpenAI" },
    { value: "google", label: "Google AI" },
    { value: "local", label: "Local (Ollama/vLLM/TEI)" },
  ],
  rerank: [
    { value: "tei", label: "TEI (self-hosted)" },
    { value: "cohere", label: "Cohere" },
  ],
};

/** Human-readable label for each provider — used in the manager table badges. */
export const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
  azure: "Azure OpenAI",
  local: "Local",
  tei: "TEI",
  cohere: "Cohere",
};

/**
 * Providers that require a baseUrl input.
 * Changing this set must be reflected in PROVIDERS_BY_KIND labels and the
 * needsBaseUrl helper in validate-model-config-form.ts.
 */
export const BASE_URL_REQUIRED_PROVIDERS: ReadonlySet<string> = new Set([
  "azure",
  "local",
  "tei",
]);

/**
 * Self-hosted providers that do NOT require an apiKey on create.
 * Matches the apiKeyRequiredOnCreate logic in validate-model-config-form.ts.
 */
export const SELF_HOSTED_PROVIDERS: ReadonlySet<string> = new Set([
  "local",
  "tei",
]);
