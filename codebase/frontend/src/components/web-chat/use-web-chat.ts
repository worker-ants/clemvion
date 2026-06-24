"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { normalizePagedResponse } from "@/lib/api/paginated";
import type {
  InteractionTokenStrategy,
  TriggerListItem,
  WebChatAppearanceConfig,
} from "@/lib/types/trigger";

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
  /** 마지막 호출 시각(ISO 8601, UTC). 목록 행 메타·상태 가시성용. undefined = 호출 이력 없음. */
  lastTriggeredAt?: string;
  /** interaction 토큰 전략 — 외형 저장(PATCH) 시 interaction 객체 전체를 보존해 보내야 한다. */
  tokenStrategy?: InteractionTokenStrategy;
  /** 서버에 저장된 외형/콘텐츠(`config.interaction.appearance`). 미저장이면 undefined. */
  appearance?: WebChatAppearanceConfig;
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
/** 트리거 화면과 공유하는 캐시 키 prefix — 웹채팅 생성/수정 시 함께 무효화한다. */
const TRIGGERS_KEY = ["triggers"] as const;
const MAX_LIST_LIMIT = 100;

/** interaction 이 켜진 webhook 트리거만 추려 웹채팅 인스턴스로 노출. */
export function useWebChatInstances() {
  const query = useQuery<TriggerListItem[]>({
    queryKey: WEB_CHAT_INSTANCES_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get("/triggers", {
        // interactionEnabled 는 서버측 JSONB 필터(인스턴스 多 시 페이지네이션 정확도).
        // 아래 client 필터는 캐시 오염·응답 변형 방어로 유지(다층).
        params: {
          type: "webhook",
          interactionEnabled: true,
          limit: MAX_LIST_LIMIT,
        },
      });
      return normalizePagedResponse<TriggerListItem>(data).items;
    },
  });

  const instances = useMemo<WebChatInstance[]>(
    () =>
      (query.data ?? [])
        // type·interaction 은 서버 필터와 중복이나, 캐시 오염·응답 변형에 대한 방어로 유지.
        .filter((t) => t.type === "webhook" && t.config?.interaction?.enabled)
        .map((t) => ({
          id: t.id,
          name: t.name,
          workflowId: t.workflowId,
          workflowName: t.workflowName,
          endpointPath: t.endpointPath ?? "",
          isActive: t.isActive,
          lastTriggeredAt: t.lastTriggeredAt,
          tokenStrategy: t.config?.interaction?.tokenStrategy,
          appearance: t.config?.interaction?.appearance,
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

export interface UpdateWebChatAppearanceInput {
  instanceId: string;
  appearance: WebChatAppearanceConfig;
  /** 기존 interaction 토큰 전략 — PATCH 시 interaction 객체 전체를 재전송해 보존한다. */
  tokenStrategy?: InteractionTokenStrategy;
}

/**
 * 외형/콘텐츠를 서버(`config.interaction.appearance`)에 저장한다.
 *
 * **제약**: 이 훅은 `interaction.enabled=true` 인 웹채팅 인스턴스(= 현 콘솔 내부 경로)에만 사용한다.
 * `enabled` 를 `true` 로 하드코딩하므로, interaction 이 비활성인 인스턴스에 사용하면 해당 값이
 * silent mutation 될 수 있다. 내부 경로는 `useWebChatInstances` 의 `interactionEnabled=true` 필터로
 * 보호되지만, 이 훅을 다른 컨텍스트에서 재사용할 때는 이 제약을 명심할 것.
 *
 * 백엔드 `mergeExternalConfig` 는 interaction 키를 통째로 교체하므로, enabled·tokenStrategy 를
 * 함께 보내 기존 값을 보존한다(spec 5-admin-console §4).
 *
 * `tokenStrategy` 파라미터를 생략하면 `"per_execution"` 이 기본값으로 폴백된다. 기존 인스턴스가
 * `"per_trigger"` 전략이었다면 반드시 인스턴스 값을 전달해야 한다.
 */
export function useUpdateWebChatAppearance() {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, UpdateWebChatAppearanceInput>({
    mutationFn: async ({ instanceId, appearance, tokenStrategy }) => {
      const { data } = await apiClient.patch(`/triggers/${instanceId}`, {
        interaction: {
          enabled: true,
          tokenStrategy: tokenStrategy ?? "per_execution",
          appearance,
        },
      });
      return data;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: WEB_CHAT_INSTANCES_KEY }),
        queryClient.invalidateQueries({ queryKey: TRIGGERS_KEY }),
      ]),
  });
}

export interface UpdateWebChatMetaInput {
  instanceId: string;
  name?: string;
  isActive?: boolean;
}

/**
 * 인스턴스의 top-level 메타(이름·활성 상태)를 PATCH 한다.
 *
 * 외형 저장(`useUpdateWebChatAppearance`)과 분리된 경로 — interaction 객체를 보내지 않으므로
 * `enabled`/`tokenStrategy`/`appearance` 가 영향받지 않는다(silent mutation 방지). name·isActive
 * 는 단일 PATCH 경로(R-4, `TriggerUpdateBody`)로 전달된다. undefined 필드는 바디에서 제외해
 * 부분 수정만 보낸다(이름만, 또는 활성 상태만).
 *
 * **onError 미처리**: PATCH 실패 시 서버는 미변경이므로 목록이 stale 되지 않는 것이 올바른
 * 동작이다 — `onError` 에서 `invalidateQueries` 를 하지 않는다. `useUpdateWebChatAppearance`
 * 와 동일 패턴 (onSuccess 만 invalidate).
 */
export function useUpdateWebChatMeta() {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, UpdateWebChatMetaInput>({
    mutationFn: async ({ instanceId, name, isActive }) => {
      const body: { name?: string; isActive?: boolean } = {};
      if (name !== undefined) body.name = name;
      if (isActive !== undefined) body.isActive = isActive;
      const { data } = await apiClient.patch(`/triggers/${instanceId}`, body);
      return data;
    },
    onSuccess: () =>
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
