/**
 * Shared helper for KB create/update embedding payload construction.
 * Extracted to avoid duplication between create-kb-form-dialog.tsx and [id]/page.tsx
 * (WARNING #8, #9, #10).
 *
 * Since the backend is now authoritative for deriving kb.embeddingModel from the config
 * (WARNING #1/#2 fix), the frontend only needs to send embeddingModelConfigId. The
 * embeddingModel field is omitted from the payload — the server resolves it server-side.
 */

import type { ModelConfigData } from "@/lib/api/model-configs";

/**
 * Returns the embedding portion of a KB create/update payload.
 *
 * @param configId - the selected kind=embedding ModelConfig id (empty string = ws-default)
 * @param configs  - the loaded embedding config list (used for client-side guard; backend
 *                   derives embeddingModel independently so we only send configId)
 *
 * Returns an object to spread into the API payload:
 * - `{ embeddingModelConfigId: configId }` when a config is selected
 * - `{}` when configId is empty (ws-default fallback — omit the field entirely)
 */
export function buildEmbeddingConfigPayload(
  configId: string,
  _configs: ModelConfigData[],
): { embeddingModelConfigId?: string } {
  if (!configId) return {};
  return { embeddingModelConfigId: configId };
}

/**
 * Returns true when the embedding config selection has changed relative to the
 * current KB value.  Centralises the comparison used in two places in [id]/page.tsx
 * (WARNING #10).
 */
export function embeddingConfigChanged(
  formConfigId: string,
  kbConfigId: string | null | undefined,
): boolean {
  return formConfigId !== (kbConfigId ?? "");
}
