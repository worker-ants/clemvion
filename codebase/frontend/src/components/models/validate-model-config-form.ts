import type { ModelConfigKind } from "@/lib/api/model-configs";
import type { TranslationKey } from "@/lib/i18n";
import {
  BASE_URL_REQUIRED_PROVIDERS,
  SELF_HOSTED_PROVIDERS,
} from "./provider-registry";

/** baseUrl 입력이 필요한 provider — azure/local/tei. */
export function needsBaseUrl(provider: string): boolean {
  return BASE_URL_REQUIRED_PROVIDERS.has(provider);
}

/** apiKey 가 생성 시 필수인가 — 자가호스팅(local/tei)만 선택. */
export function apiKeyRequiredOnCreate(provider: string): boolean {
  return provider !== "" && !SELF_HOSTED_PROVIDERS.has(provider);
}

export interface ModelConfigFormState {
  provider: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** edit 모드 여부 (생성 시 false). */
  isEdit: boolean;
}

/**
 * 폼 검증을 순수 함수로 분리. 위반 시 toast 할 i18n 키를 반환, 유효하면 null.
 * (kind 인자는 향후 kind 별 규칙 확장 여지를 위해 유지 — 현재 규칙은 provider 기반.)
 */
export function validateModelConfigForm(
  state: ModelConfigFormState,
  _kind: ModelConfigKind,
): TranslationKey | null {
  if (!state.name.trim() || !state.provider || !state.model.trim()) {
    return "models.requiredFields";
  }
  if (
    !state.isEdit &&
    apiKeyRequiredOnCreate(state.provider) &&
    !state.apiKey.trim()
  ) {
    return "models.apiKeyRequired";
  }
  if (needsBaseUrl(state.provider) && !state.baseUrl.trim()) {
    return "models.baseUrlRequired";
  }
  return null;
}
