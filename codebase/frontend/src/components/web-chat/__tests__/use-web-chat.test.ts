// SUMMARY#6 — useUpdateWebChatAppearance mutation 단위 테스트
// PATCH body 구성(enabled/tokenStrategy/appearance) + query invalidation 검증

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const patchMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    patch: (...args: unknown[]) => patchMock(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

// 직접 import — mock 이 먼저 등록된 후에.
import {
  useUpdateWebChatAppearance,
  WEB_CHAT_INSTANCES_KEY,
} from "../use-web-chat";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useUpdateWebChatAppearance (SUMMARY#6)", () => {
  beforeEach(() => {
    patchMock.mockReset();
  });

  it("PATCH body 에 enabled=true / tokenStrategy / appearance 가 포함된다 (per_execution)", async () => {
    patchMock.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useUpdateWebChatAppearance(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        instanceId: "t-1",
        appearance: { primaryColor: "#5B4FE9" },
        tokenStrategy: "per_execution",
      });
    });

    expect(patchMock).toHaveBeenCalledWith("/triggers/t-1", {
      interaction: {
        enabled: true,
        tokenStrategy: "per_execution",
        appearance: { primaryColor: "#5B4FE9" },
      },
    });
  });

  it("tokenStrategy=per_trigger 도 그대로 전달된다", async () => {
    patchMock.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useUpdateWebChatAppearance(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        instanceId: "t-2",
        appearance: { primaryColor: "#ff0000", position: "bottom-left" },
        tokenStrategy: "per_trigger",
      });
    });

    expect(patchMock).toHaveBeenCalledWith("/triggers/t-2", {
      interaction: {
        enabled: true,
        tokenStrategy: "per_trigger",
        appearance: { primaryColor: "#ff0000", position: "bottom-left" },
      },
    });
  });

  it("tokenStrategy 미전달 시 per_execution 으로 폴백", async () => {
    patchMock.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useUpdateWebChatAppearance(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        instanceId: "t-3",
        appearance: {},
      });
    });

    expect(patchMock).toHaveBeenCalledWith("/triggers/t-3", {
      interaction: {
        enabled: true,
        tokenStrategy: "per_execution",
        appearance: {},
      },
    });
  });

  it("성공 시 WEB_CHAT_INSTANCES_KEY 쿼리를 invalidate 한다", async () => {
    patchMock.mockResolvedValue({ data: {} });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const customWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useUpdateWebChatAppearance(), {
      wrapper: customWrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        instanceId: "t-1",
        appearance: {},
        tokenStrategy: "per_execution",
      });
    });

    // WEB_CHAT_INSTANCES_KEY 와 TRIGGERS_KEY 양쪽 invalidate 확인
    const calls = invalidateSpy.mock.calls;
    const invalidatedKeys = calls.map((c) => JSON.stringify(c[0]));
    expect(
      invalidatedKeys.some((k) =>
        k.includes(JSON.stringify(WEB_CHAT_INSTANCES_KEY[0])),
      ),
    ).toBe(true);
    expect(invalidatedKeys.some((k) => k.includes('"triggers"'))).toBe(true);
  });

  it("PATCH 실패 시 mutation 이 reject 된다", async () => {
    patchMock.mockRejectedValue(new Error("server error"));

    const { result } = renderHook(() => useUpdateWebChatAppearance(), {
      wrapper,
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          instanceId: "t-fail",
          appearance: {},
        }),
      ).rejects.toThrow("server error");
    });
  });
});
