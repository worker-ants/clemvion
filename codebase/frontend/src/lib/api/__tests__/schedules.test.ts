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

import { schedulesApi } from "../schedules";

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

describe("schedulesApi.list", () => {
  it("GETs /schedules with params and normalizes the paged response", async () => {
    const params = { page: 2, limit: 20 };
    getMock.mockResolvedValue(
      fakeAxios({
        data: [{ id: "s1", cronExpression: "0 9 * * *" }],
        pagination: { page: 2, totalPages: 5 },
      }),
    );
    const result = await schedulesApi.list(params);
    expect(getMock).toHaveBeenCalledWith("/schedules", { params });
    expect(result.items).toHaveLength(1);
    expect(result.totalPages).toBe(5);
    expect(result.page).toBe(2);
  });

  it("falls back to params.page when pagination meta is absent (bare array)", async () => {
    getMock.mockResolvedValue(fakeAxios([{ id: "s1" }]));
    const result = await schedulesApi.list({ page: 3, limit: 200 });
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(1);
  });
});

describe("schedulesApi mutations", () => {
  it("create POSTs /schedules with the body", async () => {
    postMock.mockResolvedValue(fakeAxios({}));
    const body = {
      name: "Daily",
      workflowId: "w1",
      cronExpression: "0 9 * * *",
      timezone: "UTC",
      parameterValues: { region: "kr" },
    };
    await schedulesApi.create(body);
    expect(postMock).toHaveBeenCalledWith("/schedules", body);
  });

  it("update PATCHes /schedules/:id with the partial body", async () => {
    patchMock.mockResolvedValue(fakeAxios({}));
    const body = {
      name: "Daily",
      cronExpression: "0 9 * * *",
      timezone: "UTC",
      parameterValues: {},
    };
    await schedulesApi.update("s1", body);
    expect(patchMock).toHaveBeenCalledWith("/schedules/s1", body);
  });

  it("update PATCHes the toggle body { isActive } verbatim", async () => {
    patchMock.mockResolvedValue(fakeAxios({}));
    await schedulesApi.update("s1", { isActive: false });
    expect(patchMock).toHaveBeenCalledWith("/schedules/s1", {
      isActive: false,
    });
  });

  it("delete DELETEs /schedules/:id", async () => {
    deleteMock.mockResolvedValue(fakeAxios({}));
    await schedulesApi.delete("s1");
    expect(deleteMock).toHaveBeenCalledWith("/schedules/s1");
  });

  it("runNow POSTs /schedules/:id/run-now", async () => {
    postMock.mockResolvedValue(fakeAxios({}));
    await schedulesApi.runNow("s1");
    expect(postMock).toHaveBeenCalledWith("/schedules/s1/run-now");
  });
});
