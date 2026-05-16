/**
 * `useCafe24MallIdPrecheck` 단위 테스트 — page.tsx 통합 테스트가 hook 의
 * 사용자 흐름을 검증하나, 본 spec 은 hook 자체의 입력/출력 계약을 격리
 * 검증한다. (ai-review W9 — 2026-05-16)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const precheckMock = vi.fn();
vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    cafe24Precheck: (...args: unknown[]) => precheckMock(...args),
  },
}));

import { useCafe24MallIdPrecheck } from "../use-cafe24-mall-id-precheck";

describe("useCafe24MallIdPrecheck", () => {
  beforeEach(() => {
    // resetAllMocks 는 implementation 까지 클리어 — mockResolvedValueOnce
    // queue 가 테스트 간 leak 되는 것을 막는다.
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    precheckMock.mockResolvedValue({ conflict: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enabled=false 면 fetch 호출 없이 conflict null, loading false", () => {
    const { result } = renderHook(() =>
      useCafe24MallIdPrecheck("myshop", false),
    );
    expect(result.current.conflict).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(precheckMock).not.toHaveBeenCalled();
  });

  it("패턴 위반 mall_id 는 fetch skip + loading false 유지", () => {
    const { result } = renderHook(() => useCafe24MallIdPrecheck("AB", true));
    expect(precheckMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("유효 mall_id + enabled 면 350ms debounce 후 fetch + 결과 반영", async () => {
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-1",
      existingName: "myshop (Cafe24)",
      status: "connected",
    });
    const { result } = renderHook(() =>
      useCafe24MallIdPrecheck("myshop", true),
    );
    // debounce 진입 직후엔 loading=true, conflict 미반영
    expect(result.current.loading).toBe(true);
    expect(result.current.conflict).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => {
      expect(result.current.conflict).toEqual({
        conflict: true,
        existingIntegrationId: "int-1",
        existingName: "myshop (Cafe24)",
        status: "connected",
      });
      expect(result.current.loading).toBe(false);
    });
    // 두 번째 인자는 AbortSignal
    expect(precheckMock).toHaveBeenCalledWith("myshop", expect.any(AbortSignal));
  });

  it("mallId 변경 시 직전 in-flight fetch 가 abort", async () => {
    let firstSignal: AbortSignal | undefined;
    precheckMock.mockImplementationOnce(
      (_id: string, signal: AbortSignal) => {
        firstSignal = signal;
        return new Promise(() => {}); // resolve 안 됨
      },
    );
    precheckMock.mockResolvedValueOnce({ conflict: false });

    const { rerender } = renderHook(
      ({ mallId, enabled }) => useCafe24MallIdPrecheck(mallId, enabled),
      { initialProps: { mallId: "shop-a", enabled: true } },
    );
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => expect(precheckMock).toHaveBeenCalledTimes(1));
    expect(firstSignal?.aborted).toBe(false);

    // mallId 변경 → effect cleanup → abort
    rerender({ mallId: "shop-b", enabled: true });
    expect(firstSignal?.aborted).toBe(true);
  });

  it("enabled=false 로 전환 시 conflict/loading 즉시 클리어", async () => {
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-1",
      existingName: "x",
      status: "connected",
    });
    const { result, rerender } = renderHook(
      ({ mallId, enabled }) => useCafe24MallIdPrecheck(mallId, enabled),
      { initialProps: { mallId: "myshop", enabled: true } },
    );
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => expect(result.current.conflict).not.toBeNull());

    rerender({ mallId: "myshop", enabled: false });
    expect(result.current.conflict).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetch 실패 시 silent — conflict null, loading false", async () => {
    precheckMock.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() =>
      useCafe24MallIdPrecheck("myshop", true),
    );
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.conflict).toBeNull();
  });
});
