"use client";

import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { integrationsApi, type IntegrationDto } from "@/lib/api/integrations";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useEditorStore } from "@/lib/stores/editor-store";
import type {
  IntegrationRefFilterContext,
  VisibleIntegration,
} from "@/lib/integrations/node-integration-refs";

/**
 * 워크스페이스 integration id 집합 — `WorkflowCanvas` 가 한 번 조회해 Context 로
 * 내려주고, 각 `CustomNode` 의 §5 ⚠ Missing integration 배지가 자신의
 * `config.integrationId` 실재 여부를 대조하는 데 쓴다. per-node
 * `useQuery(["integrations","list"])` 구독(= N개 integration 노드 = N개 구독,
 * 쿼리 상태 변화 시 N회 리렌더)을 피하려고 canvas 레벨 단일 조회로 승격한 것으로,
 * `has-default-llm-config-context` 와 동일한 패턴이다.
 *
 * 값이 `null` 이면 "실재 여부를 단정할 수 없음"(로딩 중이거나, 목록이
 * 페이지네이션 한도로 잘려 전체를 확보하지 못함) 을 뜻하며 이때 배지는
 * 억제된다(위양성 방지). provider 밖에서 렌더된 `CustomNode`(격리 테스트 등)는
 * 기본값 `null` 로 graceful degrade 한다.
 *
 * 캔버스 전용 무필터 목록 키 — 설정 패널 셀렉터의 serviceType 필터 포함 키
 * (`["integrations","list",{serviceTypes}]`) 와 구분되며, 통합 노드 전반이 같은
 * 키를 공유(React Query dedupe)한다.
 */
export const INTEGRATIONS_LIST_QUERY_KEY = ["integrations", "list"] as const;

interface IntegrationListContextValue {
  integrationIds: ReadonlySet<string> | null;
}

const IntegrationListContext = createContext<IntegrationListContextValue>({
  integrationIds: null,
});

export const IntegrationListProvider = IntegrationListContext.Provider;

export function useIntegrationIds(): ReadonlySet<string> | null {
  return useContext(IntegrationListContext).integrationIds;
}

/**
 * integration 목록 조회 결과에서 배지 대조용 id 집합을 도출한다. 로딩 중이거나
 * 목록이 `undefined` 면 `null`. 목록이 페이지네이션 한도(`limit`)로 잘려
 * `data.length < pagination.totalItems` 이면 전체를 확보하지 못한 것이므로 실재
 * 여부를 단정할 수 없어 `null` 을 반환한다(존재하는 integration 을 "삭제됨" 으로
 * 오판하는 위양성 방지).
 */
export function deriveIntegrationIds(
  listData:
    | { data: { id: string }[]; pagination: { totalItems: number } }
    | undefined,
  isLoading: boolean,
): ReadonlySet<string> | null {
  if (isLoading || listData === undefined) return null;
  if (listData.data.length < listData.pagination.totalItems) return null;
  return new Set(listData.data.map((i) => i.id));
}

/**
 * 캔버스 전용 무필터 통합 목록 조회. 캔버스의 배지와 붙여넣기 필터가 같은 키 · 같은 조회로 한 번만 받는다.
 */
export function useCanvasIntegrationList() {
  return useQuery({
    queryKey: INTEGRATIONS_LIST_QUERY_KEY,
    queryFn: () => integrationsApi.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 붙여넣기 필터가 쓸 통합 목록(id 별 공개 범위 · 통합 소유자)을 도출한다. 확정되지 않은 목록은 `deriveIntegrationIds` 와 같은
 * 규칙으로 `null` 이다. 모르는 참조를 비우면 쓸 수 있는 참조까지 잃는다(REQ-EDITOR-059).
 */
export function deriveVisibleIntegrations(
  listData:
    | {
        data: Pick<IntegrationDto, "id" | "scope" | "createdBy">[];
        pagination: { totalItems: number };
      }
    | undefined,
  isLoading: boolean,
): ReadonlyMap<string, VisibleIntegration> | null {
  if (isLoading || listData === undefined) return null;
  if (listData.data.length < listData.pagination.totalItems) return null;
  return new Map(
    listData.data.map((i) => [i.id, { scope: i.scope, createdBy: i.createdBy }]),
  );
}

/** 붙여넣기 · 복제가 `editor-store` 에 넘길 필터 문맥(REQ-EDITOR-059). */
export function useIntegrationRefFilterContext(): IntegrationRefFilterContext {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const workflowAuthorId = useEditorStore((s) => s.workflowCreatedBy);
  const { data, isLoading } = useCanvasIntegrationList();
  const integrations = useMemo(
    () => deriveVisibleIntegrations(data, isLoading),
    [data, isLoading],
  );
  return useMemo(
    () => ({ currentUserId, workflowAuthorId, integrations }),
    [currentUserId, workflowAuthorId, integrations],
  );
}
