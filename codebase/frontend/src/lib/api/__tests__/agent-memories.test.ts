import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse } from "axios";

// ─── mock apiClient before importing the module under test ───────────────────
const getMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("../client", () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import { agentMemoriesApi } from "../agent-memories";

function fakeAxios<T>(
  data: T,
  headers: Record<string, unknown> = {},
): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers,
    config: {},
  } as unknown as AxiosResponse<T>;
}

beforeEach(() => vi.clearAllMocks());

describe("agentMemoriesApi.clearScope (X-Deleted-Count)", () => {
  it("DELETE /agent-memories?scopeKey= 후 X-Deleted-Count 헤더의 삭제 행 수를 반환한다", async () => {
    deleteMock.mockResolvedValue(
      fakeAxios(undefined, { "x-deleted-count": "3" }),
    );

    const deleted = await agentMemoriesApi.clearScope("cust-1");

    expect(deleteMock).toHaveBeenCalledWith("/agent-memories", {
      params: { scopeKey: "cust-1" },
    });
    expect(deleted).toBe(3);
  });

  it("0건 삭제(X-Deleted-Count: 0)도 숫자 0 으로 반환한다 (멱등 — 중립 토스트 근거)", async () => {
    deleteMock.mockResolvedValue(
      fakeAxios(undefined, { "x-deleted-count": "0" }),
    );
    expect(await agentMemoriesApi.clearScope("empty")).toBe(0);
  });

  it("헤더 부재 시 0 으로 폴백한다", async () => {
    deleteMock.mockResolvedValue(fakeAxios(undefined, {}));
    expect(await agentMemoriesApi.clearScope("cust-1")).toBe(0);
  });

  it("헤더가 비숫자면 0 으로 폴백한다 (방어)", async () => {
    deleteMock.mockResolvedValue(
      fakeAxios(undefined, { "x-deleted-count": "not-a-number" }),
    );
    expect(await agentMemoriesApi.clearScope("cust-1")).toBe(0);
  });
});
