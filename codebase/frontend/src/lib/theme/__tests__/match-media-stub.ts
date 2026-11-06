import { vi } from "vitest";
import { DARK_MEDIA_QUERY } from "../theme-constants";

/**
 * jsdom 에는 `window.matchMedia` 가 없다. OS 색상 모드를 테스트에서 바꿀 수 있는 가짜를 단다.
 * `setDark` 는 값을 바꾸고 붙어 있는 `change` 리스너를 부른다.
 */
export function installMatchMedia(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const matchMedia = vi.fn((query: string) => {
    const isDarkQuery = query === DARK_MEDIA_QUERY;
    return {
      media: query,
      get matches() {
        return isDarkQuery ? dark : false;
      },
      onchange: null,
      addEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === "change" && isDarkQuery) listeners.add(listener);
      },
      removeEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === "change") listeners.delete(listener);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    matchMedia,
    setDark(next: boolean) {
      dark = next;
      for (const listener of [...listeners]) {
        listener({ matches: next, media: DARK_MEDIA_QUERY } as MediaQueryListEvent);
      }
    },
    listenerCount: () => listeners.size,
  };
}

export function removeMatchMedia() {
  Reflect.deleteProperty(window, "matchMedia");
}

export function htmlThemeClasses(): string[] {
  const { classList } = document.documentElement;
  return ["light", "dark"].filter((name) => classList.contains(name));
}
