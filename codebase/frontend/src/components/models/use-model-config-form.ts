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

/** Payload shape for model config update mutations. */
export interface ModelConfigUpdatePayload {
  provider: string;
  name: string;
  defaultModel: string;
  baseUrl?: string;
  apiKey?: string;
  defaultParams?: { temperature: number; max_tokens: number };
  dimension?: number;
}

/** Public return type of useModelConfigForm. */
export interface UseModelConfigFormReturn {
  /** id of the config being edited, or null for create mode. */
  editId: string | null;
  // field values
  provider: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: string;
  maxTokens: string;
  dimension: string;
  // setters
  /** Set the provider value. */
  setProvider: (v: string) => void;
  /** Set the config name. */
  setName: (v: string) => void;
  /** Set the API key (empty string on edit = keep existing). */
  setApiKey: (v: string) => void;
  /** Set the base URL. */
  setBaseUrl: (v: string) => void;
  /** Set the default model identifier. */
  setModel: (v: string) => void;
  /** Set temperature as a string (parseFloat on save). */
  setTemperature: (v: string) => void;
  /** Set max_tokens as a string (parseInt on save). */
  setMaxTokens: (v: string) => void;
  /** Set embedding dimension as a string (parseInt on save). */
  setDimension: (v: string) => void;
  // derived flags
  /** True when kind === "chat". */
  showParams: boolean;
  /** True when kind === "embedding". */
  showDimension: boolean;
  // actions
  /** Seed the form from an existing config, or reset to defaults when null. */
  openFor: (config: import("@/lib/api/model-configs").ModelConfigData | null) => void;
  /** Validate and submit (create or update). */
  handleSave: () => void;
  /** True while a mutation is in-flight. */
  isPending: boolean;
}

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
}: UseModelConfigFormArgs): UseModelConfigFormReturn {
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

  /** Shared helper: parse temperature + maxTokens strings into a defaultParams object. */
  function buildParams(
    temp: string,
    tokens: string,
  ): { temperature: number; max_tokens: number } {
    return {
      temperature: parseFloat(temp) || DEFAULT_TEMPERATURE,
      max_tokens: parseInt(tokens) || DEFAULT_MAX_TOKENS,
    };
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
        defaultParams: showParams ? buildParams(temperature, maxTokens) : undefined,
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
    mutationFn: (payload: { id: string; data: ModelConfigUpdatePayload }) =>
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
    setProvider(config?.provider ?? "");
    setName(config?.name ?? "");
    setApiKey("");
    setBaseUrl(config?.baseUrl ?? "");
    setModel(config?.defaultModel ?? "");
    setTemperature(
      String((config?.defaultParams?.temperature as number | undefined) ?? DEFAULT_TEMPERATURE),
    );
    setMaxTokens(
      String((config?.defaultParams?.max_tokens as number | undefined) ?? DEFAULT_MAX_TOKENS),
    );
    setDimension(config?.dimension != null ? String(config.dimension) : "");
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
      const payload: ModelConfigUpdatePayload = {
        provider,
        name,
        defaultModel: model,
        baseUrl: baseUrl || undefined,
      };
      if (showParams) {
        payload.defaultParams = buildParams(temperature, maxTokens);
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
