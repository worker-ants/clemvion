import { describe, it, expect, vi, beforeEach } from "vitest";
import { llmConfigsApi } from "../llm-configs";
import { apiClient } from "../client";

vi.mock("../client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("llmConfigsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listModels", () => {
    it("unwraps the {data: ...} envelope from the transform interceptor", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          data: [
            { id: "gpt-4o", name: "gpt-4o", type: "chat" },
            { id: "gpt-4o-mini", name: "gpt-4o-mini", type: "chat" },
          ],
        },
      });
      const result = await llmConfigsApi.listModels("abc");
      expect(apiClient.get).toHaveBeenCalledWith("/llm-configs/abc/models", {
        params: undefined,
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("gpt-4o");
    });

    it("forwards the type filter when given", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          data: [
            { id: "text-embedding-3-small", name: "Embed", type: "embedding" },
          ],
        },
      });
      const result = await llmConfigsApi.listModels("abc", {
        type: "embedding",
      });
      expect(apiClient.get).toHaveBeenCalledWith("/llm-configs/abc/models", {
        params: { type: "embedding" },
      });
      expect(result[0].type).toBe("embedding");
    });

    // TODO: response envelope 중앙화(axios 인터셉터) 적용 시 이 fallback 계약은 제거한다.
    it("falls back to the body itself when not enveloped (interim dual-shape contract)", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: [{ id: "claude-sonnet-4-20250514", name: "Claude", type: "chat" }],
      });
      const result = await llmConfigsApi.listModels("abc");
      expect(result).toHaveLength(1);
    });

    it("propagates network errors to the caller", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Network Error"));
      await expect(llmConfigsApi.listModels("abc")).rejects.toThrow(
        "Network Error",
      );
    });
  });

  describe("list", () => {
    it("normalizes the {data: LlmConfigData[]} envelope to a flat array", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          data: [
            { id: "c1", isDefault: true },
            { id: "c2", isDefault: false },
          ],
        },
      });
      const result = await llmConfigsApi.list();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("c1");
    });

    it("returns the body itself when not enveloped (dual-shape contract)", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: [{ id: "c1", isDefault: true }],
      });
      const result = await llmConfigsApi.list();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
    });

    it("returns an empty array when the response is neither shape", async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: null });
      const result = await llmConfigsApi.list();
      expect(result).toEqual([]);
    });
  });

  describe("previewModels", () => {
    it("posts provider/apiKey/baseUrl and unwraps the envelope", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: {
          data: [{ id: "gpt-4o", name: "gpt-4o", type: "chat" }],
        },
      });
      const result = await llmConfigsApi.previewModels({
        provider: "openai",
        apiKey: "sk-xxx",
        baseUrl: "https://proxy.example.com/v1",
      });
      expect(apiClient.post).toHaveBeenCalledWith(
        "/llm-configs/preview-models",
        {
          provider: "openai",
          apiKey: "sk-xxx",
          baseUrl: "https://proxy.example.com/v1",
        },
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("gpt-4o");
    });

    it("falls back to the body itself when not enveloped", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: [{ id: "gpt-4o-mini", name: "gpt-4o-mini", type: "chat" }],
      });
      const result = await llmConfigsApi.previewModels({
        provider: "openai",
        apiKey: "sk-xxx",
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("gpt-4o-mini");
    });

    it("propagates 4xx errors from the backend", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(
        Object.assign(new Error("Request failed"), {
          isAxiosError: true,
          response: { status: 400, data: { message: "invalid credentials" } },
        }),
      );
      await expect(
        llmConfigsApi.previewModels({ provider: "openai", apiKey: "bad" }),
      ).rejects.toMatchObject({ isAxiosError: true });
    });
  });
});
