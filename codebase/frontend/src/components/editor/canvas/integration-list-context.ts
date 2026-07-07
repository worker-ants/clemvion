"use client";

import { createContext, useContext } from "react";

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
