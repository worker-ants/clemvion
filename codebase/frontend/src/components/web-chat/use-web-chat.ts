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
    // tokenStrategy 유니언은 trigger API 응답 형태를 그대로 반영(per_trigger 도 유효한
    // 백엔드 옵션). 단 웹채팅 콘솔은 생성 시 per_execution 만 사용한다(useCreateWebChat).
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
/** 트리거 화면과 공유하는 캐시 키 prefix — 웹채팅 생성 시 함께 무효화한다. */
const TRIGGERS_KEY = ["triggers"] as const;
const MAX_LIST_LIMIT = 100;

/** interaction 이 켜진 webhook 트리거만 추려 웹채팅 인스턴스로 노출. */
export function useWebChatInstances() {
  const query = useQuery<TriggerListItem[]>({
    queryKey: WEB_CHAT_INSTANCES_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get("/triggers", {
        params: { type: "webhook", limit: MAX_LIST_LIMIT },
      });
      return normalizePagedResponse<TriggerListItem>(data).items;
    },
  });

  const instances = useMemo<WebChatInstance[]>(
    () =>
      (query.data ?? [])
        // type 은 서버 필터(?type=webhook)와 중복이나, 캐시 오염·응답 변형에 대한
        // 방어로 유지. 핵심 필터는 interaction.enabled.
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

/** 워크플로우 선택 드롭다운용 목록. dialog 열 때마다 refetch 하지 않도록 staleTime 부여. */
export function useWorkflowOptions() {
  return useQuery<WorkflowOption[]>({
    queryKey: ["workflows", "options"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiClient.get("/workflows", { params: { limit: MAX_LIST_LIMIT } });
      const list = (res.data?.data ?? res.data ?? []) as Array<{ id: string; name: string }>;
      return list.map((w) => ({ id: w.id, name: w.name }));
    },
  });
}

/**
 * 웹채팅 만들기 — 내부적으로 interaction 켜진 webhook 트리거를 생성한다.
 * endpointPath 는 클라이언트가 UUID 로 생성(공개 webhook path, spec 2-trigger-list §2.5).
 */
interface CreatedWebChat {
  /** TransformInterceptor 래핑(`{ data: {...} }`) 또는 평문 응답 모두 수용. */
  id?: string;
  data?: { id?: string };
}

export function useCreateWebChat() {
  const queryClient = useQueryClient();
  return useMutation<CreatedWebChat, unknown, CreateWebChatInput>({
    mutationFn: async (input: CreateWebChatInput) => {
      const { data } = await apiClient.post("/triggers", {
        type: "webhook",
        workflowId: input.workflowId,
        name: input.name,
        // endpointPath 는 클라이언트가 UUID 로 생성한다(공개 webhook path,
        // spec 2-trigger-list §2.5). 이중 제출은 dialog 의 isPending 가드로 차단.
        endpointPath: crypto.randomUUID(),
        interaction: { enabled: true, tokenStrategy: "per_execution" },
      });
      return data as CreatedWebChat;
    },
    onSuccess: () =>
      // 웹채팅 = webhook 트리거이므로 트리거 화면 캐시도 함께 무효화한다.
      // 반환(await)해 invalidation 완료까지 mutation settle 을 지연시킨다.
      Promise.all([
        queryClient.invalidateQueries({ queryKey: WEB_CHAT_INSTANCES_KEY }),
        queryClient.invalidateQueries({ queryKey: TRIGGERS_KEY }),
      ]),
  });
}

/** 생성 응답에서 신규 인스턴스 id 추출 (래핑·평문 모두 방어). */
export function extractCreatedId(created: CreatedWebChat | undefined): string | undefined {
  return created?.data?.id ?? created?.id;
}
