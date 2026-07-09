"use client";

import { useParams } from "next/navigation";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

/**
 * 현재 활성 워크스페이스 slug 를 반환한다.
 *
 * `/w/[slug]/...` 라우트 안에서는 **URL 파라미터가 SoT**(cold-load 시 store 보다 우선).
 * slug 세그먼트가 없는 라우트(`/docs`·catch-all 등)에서는 store 의 `currentWorkspaceId` → slug 로
 * 폴백해 사이드바 네비게이션 등이 활성 워크스페이스 링크를 만들 수 있게 한다. (에디터는 슬러그
 * 라우팅 phase 2 부터 `/w/<slug>/workflows/[id]` 라 URL 파라미터로 slug 를 얻는다.)
 *
 * cf. `useWorkspaceStore`(zustand 상태) · `useWorkspaces`(목록 fetch) 와 역할이 다르다.
 */
export function useWorkspaceSlug(): string | null {
  const params = useParams();
  const fromUrl =
    params && typeof params.slug === "string" ? params.slug : null;
  const fromStore = useWorkspaceStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.currentWorkspaceId);
    return ws?.slug ?? null;
  });
  return fromUrl ?? fromStore;
}
