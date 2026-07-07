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
  switchWorkspace: (id: string) => Promise<void>;
  reset: () => void;
}

/**
 * 현재 선택된 워크스페이스 ID와 사용자가 속한 목록을 보관해요.
 * 활성 워크스페이스의 단일 진실은 access token 의 `activeWorkspaceId` 클레임이에요(결정1).
 * 전환은 `switchWorkspace` 가 `/auth/workspaces/:id/switch` 로 토큰을 재발급받아 이뤄지고,
 * `currentWorkspaceId`(localStorage 영속)는 UI 표시·reconcile-on-load 힌트예요.
 * axios 인터셉터의 `X-Workspace-Id` 헤더는 이제 하위호환 **fallback** 으로만 첨부돼요.
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
      switchWorkspace: async (id) => {
        const state = get();
        if (!state.workspaces.some((w) => w.id === id)) return;
        if (state.currentWorkspaceId === id) return;
        try {
          // 토큰 SoT: 먼저 서버에서 activeWorkspaceId=id 로 재발급받아 메모리 토큰을 교체한 뒤
          // currentWorkspaceId 를 갱신한다(providers.tsx 구독이 캐시 클리어·전환 토스트 발사).
          const { switchWorkspaceApi } = await import("../api/auth");
          await switchWorkspaceApi(id);
          set({ currentWorkspaceId: id });
        } catch {
          // 전환 실패(NOT_A_MEMBER·네트워크) 시 현재 선택을 유지한다(부분 전환 방지).
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
