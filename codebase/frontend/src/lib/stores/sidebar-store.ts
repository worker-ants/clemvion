"use client";

import { create } from "zustand";

interface SidebarState {
  /** User's explicit preference. null = no override, use auto behavior */
  manualCollapse: boolean | null;
  /** Whether the viewport is below 1280px (sidebar hidden on mobile) */
  isSmall: boolean;
  /** Whether the viewport is 1280-1439px (auto-collapse zone) */
  isMedium: boolean;

  setManualCollapse: (value: boolean | null) => void;
  toggleCollapse: () => void;
  setIsSmall: (value: boolean) => void;
  setIsMedium: (value: boolean) => void;
}

/** Derive the effective collapsed state */
export const selectCollapsed = (s: SidebarState) =>
  s.manualCollapse ?? s.isMedium;

export const useSidebarStore = create<SidebarState>((set, get) => ({
  manualCollapse: null,
  isSmall: false,
  isMedium: false,

  setManualCollapse: (value) => set({ manualCollapse: value }),
  toggleCollapse: () => {
    const { manualCollapse, isMedium } = get();
    const currentCollapsed = manualCollapse ?? isMedium;
    set({ manualCollapse: !currentCollapsed });
  },
  setIsSmall: (isSmall) => set({ isSmall }),
  setIsMedium: (isMedium) => set({ isMedium }),
}));
