import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

import RerankConfigsRedirect from "../page";

describe("RerankConfigsRedirect (deprecated → /models)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("redirects to /models?tab=rerank", async () => {
    await act(async () => {
      render(<RerankConfigsRedirect />);
    });
    expect(mockReplace).toHaveBeenCalledWith("/models?tab=rerank");
  });
});
