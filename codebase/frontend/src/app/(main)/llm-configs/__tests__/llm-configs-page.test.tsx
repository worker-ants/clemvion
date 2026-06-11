import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

import LlmConfigsRedirect from "../page";

describe("LlmConfigsRedirect (deprecated → /models)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("redirects to /models?tab=chat", async () => {
    await act(async () => {
      render(<LlmConfigsRedirect />);
    });
    expect(mockReplace).toHaveBeenCalledWith("/models?tab=chat");
  });
});
