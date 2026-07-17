/**
 * Shared setup for the `Sidebar` test files.
 *
 * ## What is here, and what deliberately is not
 *
 * `Sidebar` needs ~13 modules stubbed before it renders, and both `sidebar.test.tsx` and
 * `sidebar-nav-href.test.tsx` carry that list. Only the **non-`vi.mock`** parts of that
 * setup can live here.
 *
 * The `vi.mock` factories cannot: vitest hoists every `vi.mock` call above the file's
 * imports, so a factory imported from this module is not initialised yet when the mock
 * runs (`ReferenceError: Cannot access '__vi_import_1__' before initialization` —
 * measured, not assumed). The documented escape is a dynamic `await import()` **inside
 * each factory**, which trades ~100 duplicated lines for ~50 lines of indirection plus a
 * lazier, subtler init order. Not a good trade, so the factories stay inline per file and
 * this module takes the rest.
 *
 * If `Sidebar` gains a dependency, both test files still need the new `vi.mock` — that
 * cost is imposed by vitest's hoisting, not by a missed refactor.
 */
import { vi } from "vitest";
import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** jsdom has no `matchMedia`; `Sidebar`'s `useMediaQuery` calls it on mount. */
export function stubMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** Render `Sidebar` inside `act` so its mount-time queries settle. */
export async function renderSidebar(Sidebar: React.ComponentType) {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(<Sidebar />, { wrapper: createWrapper() });
  });
  return result!;
}
