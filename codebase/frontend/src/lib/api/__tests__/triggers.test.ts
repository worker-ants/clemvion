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

import { triggersApi, type TriggerListParams } from "../triggers";

function fakeAxios<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as unknown as AxiosResponse<T>;
}

beforeEach(() => vi.clearAllMocks());

describe("triggersApi.list", () => {
  const params: TriggerListParams = { page: 2, limit: 20, type: "webhook" };

  it("calls GET /triggers with params and normalizes the paged response", async () => {
    getMock.mockResolvedValue(
      fakeAxios({
        data: [{ id: "t1", name: "T1" }],
        pagination: { page: 2, totalPages: 5 },
      }),
    );
    const result = await triggersApi.list(params);
    expect(getMock).toHaveBeenCalledWith("/triggers", { params });
    expect(result.items).toHaveLength(1);
    expect(result.totalPages).toBe(5);
  });

  it("falls back to params.page when pagination meta is absent (bare array)", async () => {
    getMock.mockResolvedValue(fakeAxios([{ id: "t1" }]));
    const result = await triggersApi.list(params);
    expect(result.page).toBe(2); // params.page used as fallback
  });
});

describe("triggersApi.getById — workflow flattening (4-way)", () => {
  it("uses top-level workflowId when present", async () => {
    getMock.mockResolvedValue(
      fakeAxios({ data: { id: "t1", workflowId: "wf-top" } }),
    );
    const r = await triggersApi.getById("t1");
    expect(getMock).toHaveBeenCalledWith("/triggers/t1");
    expect(r.workflowId).toBe("wf-top");
    expect(r.workflowName).toBe("");
  });

  it("falls back to nested workflow.{id,name}", async () => {
    getMock.mockResolvedValue(
      fakeAxios({
        data: { id: "t1", workflow: { id: "wf-nested", name: "Nested WF" } },
      }),
    );
    const r = await triggersApi.getById("t1");
    expect(r.workflowId).toBe("wf-nested");
    expect(r.workflowName).toBe("Nested WF");
  });

  it("prefers top-level workflowId but takes name from nested workflow", async () => {
    getMock.mockResolvedValue(
      fakeAxios({
        data: {
          id: "t1",
          workflowId: "wf-top",
          workflow: { id: "wf-nested", name: "Nested WF" },
        },
      }),
    );
    const r = await triggersApi.getById("t1");
    expect(r.workflowId).toBe("wf-top");
    expect(r.workflowName).toBe("Nested WF");
  });

  it("defaults both to empty string when neither is present", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: { id: "t1" } }));
    const r = await triggersApi.getById("t1");
    expect(r.workflowId).toBe("");
    expect(r.workflowName).toBe("");
  });

  it("handles an un-enveloped response body (no .data wrapper)", async () => {
    getMock.mockResolvedValue(fakeAxios({ id: "t1", workflowId: "wf-raw" }));
    const r = await triggersApi.getById("t1");
    expect(r.workflowId).toBe("wf-raw");
  });
});

describe("triggersApi mutations — single PATCH path (R-4)", () => {
  it("update PATCHes /triggers/:id with the partial body", async () => {
    patchMock.mockResolvedValue(fakeAxios({}));
    await triggersApi.update("t1", { isActive: false });
    expect(patchMock).toHaveBeenCalledWith("/triggers/t1", {
      isActive: false,
    });
  });

  it("create POSTs /triggers with the body", async () => {
    postMock.mockResolvedValue(fakeAxios({}));
    await triggersApi.create({
      workflowId: "wf1",
      type: "webhook",
      name: "T",
      endpointPath: "abc",
    });
    expect(postMock).toHaveBeenCalledWith("/triggers", {
      workflowId: "wf1",
      type: "webhook",
      name: "T",
      endpointPath: "abc",
    });
  });

  it("delete DELETEs /triggers/:id", async () => {
    deleteMock.mockResolvedValue(fakeAxios({}));
    await triggersApi.delete("t1");
    expect(deleteMock).toHaveBeenCalledWith("/triggers/t1");
  });
});

describe("triggersApi.getHistory — array/envelope normalization", () => {
  it("passes limit param and returns a bare array body as-is", async () => {
    getMock.mockResolvedValue(fakeAxios([{ id: "h1" }, { id: "h2" }]));
    const r = await triggersApi.getHistory("t1", { limit: 10 });
    expect(getMock).toHaveBeenCalledWith("/triggers/t1/history", {
      params: { limit: 10 },
    });
    expect(r).toHaveLength(2);
  });

  it("unwraps the { data: { items } } envelope to the items array", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: { items: [{ id: "h1" }] } }));
    const r = await triggersApi.getHistory("t1");
    expect(r).toEqual([{ id: "h1" }]);
  });

  it("returns [] when neither array nor items is present", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: {} }));
    const r = await triggersApi.getHistory("t1");
    expect(r).toEqual([]);
  });
});

describe("triggersApi rotate/revoke — double-envelope unwrap", () => {
  it("rotateNotificationSecret unwraps res.data.data → { secret, rotatedAt }", async () => {
    postMock.mockResolvedValue(
      fakeAxios({ data: { secret: "sek", rotatedAt: "2026-06-23T00:00:00Z" } }),
    );
    const r = await triggersApi.rotateNotificationSecret("t1");
    expect(postMock).toHaveBeenCalledWith(
      "/triggers/t1/notification/rotate-secret",
      {},
    );
    expect(r).toEqual({ secret: "sek", rotatedAt: "2026-06-23T00:00:00Z" });
  });

  it("revokeInteractionToken unwraps res.data.data → { token }", async () => {
    postMock.mockResolvedValue(fakeAxios({ data: { token: "itk_xyz" } }));
    const r = await triggersApi.revokeInteractionToken("t1");
    expect(postMock).toHaveBeenCalledWith(
      "/triggers/t1/interaction/revoke-token",
      {},
    );
    expect(r).toEqual({ token: "itk_xyz" });
  });

  it("rotateBotToken POSTs the dedicated endpoint with { newBotToken }", async () => {
    postMock.mockResolvedValue(fakeAxios({}));
    await triggersApi.rotateBotToken("t1", "123456:ABCDEF");
    expect(postMock).toHaveBeenCalledWith(
      "/triggers/t1/chat-channel/rotate-bot-token",
      { newBotToken: "123456:ABCDEF" },
    );
  });
});
