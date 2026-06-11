"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  modelConfigsApi,
  type ModelConfigData,
  type ModelConfigKind,
} from "@/lib/api/model-configs";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { validateModelConfigForm } from "./validate-model-config-form";

export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 4096;

interface UseModelConfigFormArgs {
  kind: ModelConfigKind;
  /** 편집 대상 config (null = 신규 생성). */
  editConfig: ModelConfigData | null;
  /** create/update 성공 시 호출 — 보통 dialog 를 닫는다. */
  onClose: () => void;
}

/**
 * ModelConfig 생성/편집 폼의 모든 상태·create/update mutation·검증·payload 조립을 소유한다.
 * row-level 작업(setDefault/test/delete)은 매니저에 남고, 여기엔 form CRUD 만 둔다.
 */
export function useModelConfigForm({
  kind,
  editConfig,
  onClose,
}: UseModelConfigFormArgs) {
  const t = useT();
  const queryClient = useQueryClient();

  const editId = editConfig?.id ?? null;

  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(String(DEFAULT_TEMPERATURE));
  const [maxTokens, setMaxTokens] = useState(String(DEFAULT_MAX_TOKENS));
  const [dimension, setDimension] = useState("");

  const showParams = kind === "chat";
  const showDimension = kind === "embedding";

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["model-configs", kind] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      modelConfigsApi.create({
        kind,
        provider,
        name,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        defaultModel: model,
        defaultParams: showParams
          ? {
              temperature: parseFloat(temperature) || DEFAULT_TEMPERATURE,
              max_tokens: parseInt(maxTokens) || DEFAULT_MAX_TOKENS,
            }
          : undefined,
        dimension:
          showDimension && dimension.trim()
            ? parseInt(dimension) || undefined
            : undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t("models.providerAdded"));
      onClose();
    },
    onError: () => toast.error(t("models.providerAddFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      modelConfigsApi.update(payload.id, payload.data),
    onSuccess: () => {
      invalidate();
      toast.success(t("models.providerUpdated"));
      onClose();
    },
    onError: () => toast.error(t("models.providerUpdateFailed")),
  });

  /** config 로 폼을 채운다 (null = 신규 빈 폼). */
  function openFor(config: ModelConfigData | null) {
    if (config) {
      setProvider(config.provider);
      setName(config.name);
      setApiKey("");
      setBaseUrl(config.baseUrl || "");
      setModel(config.defaultModel);
      setTemperature(
        String(
          (config.defaultParams?.temperature as number) ?? DEFAULT_TEMPERATURE,
        ),
      );
      setMaxTokens(
        String(
          (config.defaultParams?.max_tokens as number) ?? DEFAULT_MAX_TOKENS,
        ),
      );
      setDimension(config.dimension != null ? String(config.dimension) : "");
    } else {
      setProvider("");
      setName("");
      setApiKey("");
      setBaseUrl("");
      setModel("");
      setTemperature(String(DEFAULT_TEMPERATURE));
      setMaxTokens(String(DEFAULT_MAX_TOKENS));
      setDimension("");
    }
  }

  function handleSave() {
    const error = validateModelConfigForm(
      { provider, name, apiKey, baseUrl, model, isEdit: !!editId },
      kind,
    );
    if (error) {
      toast.error(t(error));
      return;
    }

    if (editId) {
      const payload: Record<string, unknown> = {
        provider,
        name,
        defaultModel: model,
        baseUrl: baseUrl || undefined,
      };
      if (showParams) {
        payload.defaultParams = {
          temperature: parseFloat(temperature) || DEFAULT_TEMPERATURE,
          max_tokens: parseInt(maxTokens) || DEFAULT_MAX_TOKENS,
        };
      }
      if (showDimension && dimension.trim()) {
        payload.dimension = parseInt(dimension) || undefined;
      }
      if (apiKey.trim()) payload.apiKey = apiKey;
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate();
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return {
    editId,
    // field values + setters
    provider,
    setProvider,
    name,
    setName,
    apiKey,
    setApiKey,
    baseUrl,
    setBaseUrl,
    model,
    setModel,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    dimension,
    setDimension,
    // derived flags
    showParams,
    showDimension,
    // actions
    openFor,
    handleSave,
    isPending,
  };
}
