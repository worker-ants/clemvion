import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  HasDefaultLlmConfigProvider,
  useHasDefaultLlmConfig,
} from "../has-default-llm-config-context";

describe("useHasDefaultLlmConfig", () => {
  it("defaults to false with no provider", () => {
    const { result } = renderHook(() => useHasDefaultLlmConfig());
    expect(result.current).toBe(false);
  });

  it("reads the provided value", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <HasDefaultLlmConfigProvider value={true}>
        {children}
      </HasDefaultLlmConfigProvider>
    );
    const { result } = renderHook(() => useHasDefaultLlmConfig(), { wrapper });
    expect(result.current).toBe(true);
  });
});
