import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse } from "axios";

const postMock = vi.fn();

vi.mock("../client", () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import { executionsApi } from "../executions";

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

describe("executionsApi.continueExecution", () => {
  it("폼 값을 formData 로 감싸 POST /executions/:id/continue 로 보낸다", async () => {
    postMock.mockResolvedValue(fakeAxios({ data: { success: true } }));

    await executionsApi.continueExecution("exec-1", { name: "John" });

    expect(postMock).toHaveBeenCalledWith("/executions/exec-1/continue", {
      formData: { name: "John" },
    });
  });

  it("서버 오류는 호출자에게 그대로 넘긴다", async () => {
    const error = new Error("422");
    postMock.mockRejectedValue(error);

    await expect(
      executionsApi.continueExecution("exec-1", {}),
    ).rejects.toBe(error);
  });
});
