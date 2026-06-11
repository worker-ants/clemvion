import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse } from "axios";

// ─── mock apiClient before importing the module under test ───────────────────
const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("../client", () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import {
  modelConfigsApi,
  type ModelConfigData,
  type ModelConfigKind,
} from "../model-configs";

function fakeAxios<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as unknown as AxiosResponse<T>;
}

function makeConfig(over: Partial<ModelConfigData> = {}): ModelConfigData {
  return {
    id: "cfg-1",
    kind: "chat",
    provider: "openai",
    name: "Test Config",
    apiKey: "sk-***",
    defaultModel: "gpt-4o",
    defaultParams: {},
    isDefault: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("modelConfigsApi.list(kind)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes kind and limit=100 (@Max(100) cap) as query params", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: [] }));

    await modelConfigsApi.list("chat");

    expect(getMock).toHaveBeenCalledWith("/model-configs", {
      params: { kind: "chat", limit: 100 },
    });
  });

  it("passes kind=embedding with limit=100", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: [] }));

    await modelConfigsApi.list("embedding");

    expect(getMock).toHaveBeenCalledWith("/model-configs", {
      params: { kind: "embedding", limit: 100 },
    });
  });

  it("passes kind=rerank with limit=100", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: [] }));

    await modelConfigsApi.list("rerank");

    expect(getMock).toHaveBeenCalledWith("/model-configs", {
      params: { kind: "rerank", limit: 100 },
    });
  });

  it("normalizes TransformInterceptor envelope { data: T[] }", async () => {
    const configs = [
      makeConfig({ id: "a" }),
      makeConfig({ id: "b", isDefault: true }),
    ];
    getMock.mockResolvedValue(fakeAxios({ data: configs }));

    const result = await modelConfigsApi.list("chat");

    expect(result).toEqual(configs);
    expect(result).toHaveLength(2);
  });

  it("handles dual-shape: bare array (legacy response without envelope)", async () => {
    const configs = [makeConfig({ id: "a" }), makeConfig({ id: "b" })];
    getMock.mockResolvedValue(fakeAxios(configs));

    const result = await modelConfigsApi.list("chat");

    expect(result).toEqual(configs);
  });

  it("returns empty array when backend returns empty envelope", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: [] }));

    const result = await modelConfigsApi.list("chat");

    expect(result).toEqual([]);
  });

  it("returns empty array when backend returns unexpected shape", async () => {
    getMock.mockResolvedValue(fakeAxios(null));

    const result = await modelConfigsApi.list("chat");

    expect(result).toEqual([]);
  });

  it("propagates errors from apiClient.get", async () => {
    getMock.mockRejectedValue(new Error("network error"));

    await expect(modelConfigsApi.list("chat")).rejects.toThrow("network error");
  });
});

describe("modelConfigsApi.listModels(id)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /model-configs/:id/models without type filter", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: [] }));

    await modelConfigsApi.listModels("cfg-1");

    expect(getMock).toHaveBeenCalledWith("/model-configs/cfg-1/models", {
      params: undefined,
    });
  });

  it("calls GET /model-configs/:id/models with type=embedding filter", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: [] }));

    await modelConfigsApi.listModels("cfg-1", { type: "embedding" });

    expect(getMock).toHaveBeenCalledWith("/model-configs/cfg-1/models", {
      params: { type: "embedding" },
    });
  });
});

describe("modelConfigsApi.previewModels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls POST /model-configs/preview-models with the provider payload", async () => {
    postMock.mockResolvedValue(fakeAxios({ data: [] }));

    const payload = {
      provider: "openai",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
    };
    await modelConfigsApi.previewModels(payload);

    expect(postMock).toHaveBeenCalledWith(
      "/model-configs/preview-models",
      payload,
    );
  });
});

describe("modelConfigsApi.testConnection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls POST /model-configs/:id/test and returns { success, latencyMs?, message? }", async () => {
    postMock.mockResolvedValue(
      fakeAxios({ data: { success: true, latencyMs: 120 } }),
    );

    const result = await modelConfigsApi.testConnection("cfg-1");

    expect(postMock).toHaveBeenCalledWith("/model-configs/cfg-1/test");
    expect(result).toMatchObject({ success: true, latencyMs: 120 });
  });

  it("returns { success: false, message } on failure response", async () => {
    postMock.mockResolvedValue(
      fakeAxios({ data: { success: false, message: "invalid key" } }),
    );

    const result = await modelConfigsApi.testConnection("cfg-1");

    expect(result).toMatchObject({ success: false, message: "invalid key" });
  });
});
