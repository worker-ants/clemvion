import { create } from "zustand";

/** 팔레트 "⏱ Recent" 섹션에 표시할 최근 사용 노드 타입 최대 개수 (§4.1). */
export const RECENT_NODES_MAX = 5;

/**
 * 최근 사용 노드 타입 목록에 `type` 을 밀어넣는 순수 리듀서. 가장 최근이 맨 앞,
 * 중복은 앞으로 끌어올리며 제거, 최대 `max` 개로 자른다. (§4.1)
 */
export function pushRecentNodeType(
  list: string[],
  type: string,
  max: number = RECENT_NODES_MAX,
): string[] {
  return [type, ...list.filter((t) => t !== type)].slice(0, max);
}

interface RecentNodesState {
  /** 최근 사용 노드 타입 (most-recent-first, dedup, 최대 RECENT_NODES_MAX). */
  recentNodeTypes: string[];
  /** 노드 추가 시(모든 경로: 드롭·팔레트 클릭·빠른추가·복제·assistant) 호출. */
  recordRecentNodeType: (type: string) => void;
}

/**
 * 최근 사용 노드 타입 store. 세션 한정(비영속) — 다른 워크플로/세션의 최근 항목이
 * 새 편집기에 새어나오지 않도록 localStorage 영속화는 하지 않는다 (§4.1 Rationale).
 * editor-store `addNode` 가 유일 기록 지점이라 모든 추가 경로가 균일하게 반영된다.
 */
export const useRecentNodesStore = create<RecentNodesState>((set) => ({
  recentNodeTypes: [],
  recordRecentNodeType: (type) =>
    set((state) => ({
      recentNodeTypes: pushRecentNodeType(state.recentNodeTypes, type),
    })),
}));
