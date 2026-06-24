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
  useUpdateWebChatMeta,
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

describe("useUpdateWebChatMeta (이름·활성 부분 PATCH)", () => {
  beforeEach(() => {
    patchMock.mockReset();
  });

  it("name 만 전달하면 PATCH body 에 name 만 포함된다 (isActive 제외)", async () => {
    patchMock.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateWebChatMeta(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ instanceId: "t-1", name: "새 이름" });
    });

    expect(patchMock).toHaveBeenCalledWith("/triggers/t-1", { name: "새 이름" });
  });

  it("isActive 만 전달하면 PATCH body 에 isActive 만 포함된다 (name 제외)", async () => {
    patchMock.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateWebChatMeta(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ instanceId: "t-2", isActive: false });
    });

    expect(patchMock).toHaveBeenCalledWith("/triggers/t-2", { isActive: false });
  });

  it("name·isActive 동시 전달도 그대로 보낸다", async () => {
    patchMock.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateWebChatMeta(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        instanceId: "t-3",
        name: "A",
        isActive: true,
      });
    });

    expect(patchMock).toHaveBeenCalledWith("/triggers/t-3", {
      name: "A",
      isActive: true,
    });
  });

  it("interaction 객체를 보내지 않는다 (외형/토큰 silent mutation 방지)", async () => {
    patchMock.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateWebChatMeta(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ instanceId: "t-4", isActive: true });
    });

    const body = patchMock.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("interaction");
    expect(body).not.toHaveProperty("appearance");
  });

  it("성공 시 WEB_CHAT_INSTANCES_KEY·triggers 쿼리를 invalidate 한다", async () => {
    patchMock.mockResolvedValue({ data: {} });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const customWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useUpdateWebChatMeta(), {
      wrapper: customWrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ instanceId: "t-1", name: "X" });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) =>
      JSON.stringify(c[0]),
    );
    expect(
      invalidatedKeys.some((k) =>
        k.includes(JSON.stringify(WEB_CHAT_INSTANCES_KEY[0])),
      ),
    ).toBe(true);
    expect(invalidatedKeys.some((k) => k.includes('"triggers"'))).toBe(true);
  });
});
