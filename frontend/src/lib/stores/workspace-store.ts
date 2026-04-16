"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export interface WorkspaceSummary {
  id: string;
  name: string;
  type: "personal" | "team";
  slug: string;
  role: WorkspaceRole;
}

interface WorkspaceState {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string | null;
  loaded: boolean;
  setWorkspaces: (list: WorkspaceSummary[]) => void;
  switchWorkspace: (id: string) => void;
  reset: () => void;
}

/**
 * 현재 선택된 워크스페이스 ID와 사용자가 속한 목록을 보관해요.
 * `currentWorkspaceId`는 localStorage에 영속화되고, axios 인터셉터가 모든 API 요청에
 * `X-Workspace-Id` 헤더로 자동 첨부해요.
 */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: false,
      setWorkspaces: (list) => {
        const current = get().currentWorkspaceId;
        const stillExists = current && list.some((w) => w.id === current);
        const next = stillExists ? current : list[0]?.id ?? null;
        set({ workspaces: list, currentWorkspaceId: next, loaded: true });
      },
      switchWorkspace: (id) => {
        if (get().workspaces.some((w) => w.id === id)) {
          set({ currentWorkspaceId: id });
        }
      },
      reset: () => set({ workspaces: [], currentWorkspaceId: null, loaded: false }),
    }),
    {
      name: "workspace-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ currentWorkspaceId: state.currentWorkspaceId }),
    },
  ),
);

/** 현재 워크스페이스 ID를 동기적으로 반환 (axios 인터셉터에서 사용). */
export function getCurrentWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return useWorkspaceStore.getState().currentWorkspaceId;
}

/** 현재 워크스페이스의 내 역할 (없으면 null). */
export function selectCurrentRole(state: WorkspaceState): WorkspaceRole | null {
  const ws = state.workspaces.find((w) => w.id === state.currentWorkspaceId);
  return ws?.role ?? null;
}
