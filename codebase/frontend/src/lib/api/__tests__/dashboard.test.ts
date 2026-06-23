import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse } from "axios";

// ─── mock apiClient before importing the module under test ───────────────────
const getMock = vi.fn();

vi.mock("../client", () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

import { dashboardApi } from "../dashboard";

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

describe("dashboardApi.getSummary", () => {
  it("GETs /dashboard/summary and unwraps the { data } envelope", async () => {
    getMock.mockResolvedValue(
      fakeAxios({ data: { totalWorkflows: 7, activeWorkflows: 3 } }),
    );
    const r = await dashboardApi.getSummary();
    expect(getMock).toHaveBeenCalledWith("/dashboard/summary");
    expect(r).toEqual({ totalWorkflows: 7, activeWorkflows: 3 });
  });
});

describe("dashboardApi.getRecentWorkflows", () => {
  it("GETs /dashboard/recent-workflows and unwraps to the array", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: [{ id: "w1", name: "WF" }] }));
    const r = await dashboardApi.getRecentWorkflows();
    expect(getMock).toHaveBeenCalledWith("/dashboard/recent-workflows");
    expect(r).toEqual([{ id: "w1", name: "WF" }]);
  });
});

describe("dashboardApi.getRecentExecutions", () => {
  it("GETs /dashboard/recent-executions and unwraps to the array", async () => {
    getMock.mockResolvedValue(fakeAxios({ data: [{ id: "e1" }] }));
    const r = await dashboardApi.getRecentExecutions();
    expect(getMock).toHaveBeenCalledWith("/dashboard/recent-executions");
    expect(r).toEqual([{ id: "e1" }]);
  });

  it("returns a bare (un-enveloped) array body as-is", async () => {
    getMock.mockResolvedValue(fakeAxios([{ id: "e2" }]));
    const r = await dashboardApi.getRecentExecutions();
    expect(r).toEqual([{ id: "e2" }]);
  });
});
