"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
// 활성/폴백 워크스페이스 해소 규칙의 단일 진실. `[slug]` layout·catch-all 리다이렉트와 동일
// 규칙을 공유한다. 공용 타입은 `lib/workspace/types` 로 분리했고 resolve-fallback 은 거기서
// 직접 import 하므로 store ↔ resolve-fallback 런타임 순환이 구조적으로 없다.
import { resolveFallbackWorkspace } from "@/lib/workspace/resolve-fallback";
import type { WorkspaceRole, WorkspaceSummary } from "@/lib/workspace/types";

// 하위호환: 종전 `@/lib/stores/workspace-store` 에서 타입을 import 하던 소비처(16곳)를 위해 re-export.
export type { WorkspaceRole, WorkspaceSummary } from "@/lib/workspace/types";

// 연타 시 out-of-order 방지용 최신 전환 대상. switchWorkspace 응답이 도착했을 때 이 값과
// 다르면(그 사이 더 최근 전환이 시작됨) 늦게 도착한 응답의 상태 반영을 버린다.
let latestSwitchTarget: string | null = null;

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
 * 활성 워크스페이스는 access token 의 `activeWorkspaceId` 클레임으로 확정돼요(결정1). 전환은
 * `switchWorkspace` 가 `/auth/workspaces/:id/switch` 로 토큰을 재발급받아 이뤄지고,
 * `currentWorkspaceId`(localStorage 영속)는 UI 표시 + axios 인터셉터의 `X-Workspace-Id` 헤더
 * (전환기 하위호환, 서버가 header-first 로 우선 소비) + reconcile-on-load 힌트로 쓰여요.
 */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      currentWorkspaceId: null,
      loaded: false,
      setWorkspaces: (list) => {
        // 현재 워크스페이스가 목록에 남아있으면 유지, 없으면 첫 워크스페이스로 — 공용 규칙 위임.
        const next =
          resolveFallbackWorkspace(list, get().currentWorkspaceId)?.id ?? null;
        set({ workspaces: list, currentWorkspaceId: next, loaded: true });
      },
      switchWorkspace: async (id) => {
        const state = get();
        if (!state.workspaces.some((w) => w.id === id)) return;
        if (state.currentWorkspaceId === id) return;
        latestSwitchTarget = id;
        try {
          // 토큰 SoT: 먼저 서버에서 activeWorkspaceId=id 로 access token 을 재발급받아 메모리
          // 토큰을 교체한 뒤 currentWorkspaceId 를 갱신한다(providers.tsx 구독이 캐시 클리어·
          // 전환 토스트 발사). 연타로 더 최근 전환이 시작됐으면 늦게 온 응답은 버린다.
          const { switchWorkspaceApi } = await import("../api/auth");
          await switchWorkspaceApi(id);
          if (latestSwitchTarget !== id) return;
          set({ currentWorkspaceId: id });
        } catch {
          // 전환 실패(NOT_A_MEMBER·네트워크) 시 현재 선택을 유지하고(부분 전환 방지) 사용자에게
          // 알린다 — 단, 그 사이 더 최근 전환이 시작됐으면 침묵한다(stale 실패 알림 방지).
          if (latestSwitchTarget !== id) return;
          try {
            const [{ toast }, { translate }, { useLocaleStore }] =
              await Promise.all([
                import("sonner"),
                import("../i18n"),
                import("./locale-store"),
              ]);
            toast.error(
              translate(useLocaleStore.getState().locale, "workspace.switchFailed"),
            );
          } catch {
            // 토스트 표시 실패는 무시(치명적 아님).
          }
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
