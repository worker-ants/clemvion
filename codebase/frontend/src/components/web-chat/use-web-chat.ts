"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { normalizePagedResponse } from "@/lib/api/paginated";

/**
 * 웹채팅 인스턴스 = `type=webhook` + `config.interaction.enabled` 인 기존 Trigger.
 * 신규 백엔드 엔티티 없이 trigger CRUD 를 재사용한다 (spec 5-admin-console §2).
 */
export interface WebChatInstance {
  id: string;
  name: string;
  workflowId: string;
  workflowName: string;
  endpointPath: string;
  isActive: boolean;
}

interface TriggerListItem {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  isActive: boolean;
  workflowId: string;
  workflowName: string;
  endpointPath?: string;
  config?: {
    interaction?: { enabled?: boolean; tokenStrategy?: "per_execution" | "per_trigger" };
    [key: string]: unknown;
  };
}

export interface WorkflowOption {
  id: string;
  name: string;
}

export interface CreateWebChatInput {
  workflowId: string;
  name: string;
}

export const WEB_CHAT_INSTANCES_KEY = ["web-chat-instances"] as const;

/** interaction 이 켜진 webhook 트리거만 추려 웹채팅 인스턴스로 노출. */
export function useWebChatInstances() {
  const query = useQuery<TriggerListItem[]>({
    queryKey: WEB_CHAT_INSTANCES_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get("/triggers", {
        params: { type: "webhook", limit: 100 },
      });
      return normalizePagedResponse<TriggerListItem>(data).items;
    },
  });

  const instances = useMemo<WebChatInstance[]>(
    () =>
      (query.data ?? [])
        .filter((t) => t.type === "webhook" && t.config?.interaction?.enabled)
        .map((t) => ({
          id: t.id,
          name: t.name,
          workflowId: t.workflowId,
          workflowName: t.workflowName,
          endpointPath: t.endpointPath ?? "",
          isActive: t.isActive,
        })),
    [query.data],
  );

  return { ...query, instances };
}

/** 워크플로우 선택 드롭다운용 목록. */
export function useWorkflowOptions() {
  return useQuery<WorkflowOption[]>({
    queryKey: ["workflows", "options"],
    queryFn: async () => {
      const res = await apiClient.get("/workflows", { params: { limit: 100 } });
      const list = (res.data?.data ?? res.data ?? []) as Array<{ id: string; name: string }>;
      return list.map((w) => ({ id: w.id, name: w.name }));
    },
  });
}

/**
 * 웹채팅 만들기 — 내부적으로 interaction 켜진 webhook 트리거를 생성한다.
 * endpointPath 는 클라이언트가 UUID 로 생성(공개 webhook path, spec 2-trigger-list §2.5).
 */
export function useCreateWebChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWebChatInput) => {
      const { data } = await apiClient.post("/triggers", {
        type: "webhook",
        workflowId: input.workflowId,
        name: input.name,
        endpointPath: crypto.randomUUID(),
        interaction: { enabled: true, tokenStrategy: "per_execution" },
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WEB_CHAT_INSTANCES_KEY });
    },
  });
}
