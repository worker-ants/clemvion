import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse } from "axios";

// ─── mock apiClient before importing the module under test ───────────────────
const getMock = vi.fn();

vi.mock("../client", () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

import { statisticsApi } from "../statistics";

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

describe("statisticsApi.getSummary", () => {
  it("GETs /statistics/summary with params and unwraps the { data } envelope", async () => {
    const params = { period: "7d", workflowId: "w1" };
    getMock.mockResolvedValue(fakeAxios({ data: { totalExecutions: 42 } }));
    const r = await statisticsApi.getSummary(params);
    expect(getMock).toHaveBeenCalledWith("/statistics/summary", { params });
    expect(r).toEqual({ totalExecutions: 42 });
  });
});

describe("statisticsApi.getExecutions", () => {
  it("GETs /statistics/executions with params and unwraps to the array", async () => {
    const params = { period: "30d" };
    getMock.mockResolvedValue(fakeAxios({ data: [{ date: "2026-06-01" }] }));
    const r = await statisticsApi.getExecutions(params);
    expect(getMock).toHaveBeenCalledWith("/statistics/executions", { params });
    expect(r).toEqual([{ date: "2026-06-01" }]);
  });
});

describe("statisticsApi.getTopWorkflows", () => {
  it("GETs /statistics/top-workflows with params (no workflowId) and unwraps", async () => {
    const params = { period: "1d", startDate: "2026-05-01", endDate: "2026-05-15" };
    getMock.mockResolvedValue(fakeAxios({ data: [{ workflowId: "w9" }] }));
    const r = await statisticsApi.getTopWorkflows(params);
    expect(getMock).toHaveBeenCalledWith("/statistics/top-workflows", {
      params,
    });
    expect(r).toEqual([{ workflowId: "w9" }]);
  });
});

describe("statisticsApi.getLlmUsageSummary", () => {
  it("GETs /statistics/llm-usage/summary and unwraps the { data } envelope", async () => {
    const params = { period: "7d" };
    getMock.mockResolvedValue(
      fakeAxios({ data: { totalTokens: 0, byModel: [] } }),
    );
    const r = await statisticsApi.getLlmUsageSummary(params);
    expect(getMock).toHaveBeenCalledWith("/statistics/llm-usage/summary", {
      params,
    });
    expect(r).toEqual({ totalTokens: 0, byModel: [] });
  });
});

describe("statisticsApi.exportStats — blob path", () => {
  it("GETs /statistics/export with responseType blob and wraps the body in a Blob", async () => {
    const params = { period: "7d", format: "csv" };
    getMock.mockResolvedValue(fakeAxios("a,b,c\n1,2,3"));
    const blob = await statisticsApi.exportStats(params);
    expect(getMock).toHaveBeenCalledWith("/statistics/export", {
      params,
      responseType: "blob",
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe("a,b,c\n1,2,3");
  });
});
