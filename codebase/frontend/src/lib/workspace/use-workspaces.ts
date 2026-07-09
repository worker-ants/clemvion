"use client";

import { useQuery } from "@tanstack/react-query";
import { workspacesApi } from "@/lib/api/workspaces";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

/**
 * 사용자 워크스페이스 목록을 fetch 해 `useWorkspaceStore` 에 반영한다.
 *
 * queryKey(`["workspaces","list"]`) 로 dedup 되어 사이드바 · `[slug]` layout · catch-all
 * 리다이렉트가 각기 호출해도 단일 요청이다. slug 해소·리다이렉트가 목록에 의존하므로
 * 사이드바 인라인 쿼리에서 승격해 공유 훅으로 만들었다.
 *
 * cf. `useWorkspaceStore`(상태) · `useWorkspaceSlug`(현 slug) 와 역할이 다르다.
 */
export function useWorkspaces() {
  const user = useAuthStore((s) => s.user);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  return useQuery({
    queryKey: ["workspaces", "list"],
    queryFn: async () => {
      const list = await workspacesApi.list();
      setWorkspaces(list);
      return list;
    },
    staleTime: 60_000,
    enabled: !!user,
  });
}
