/**
 * `useMakeshopShopUidPrecheck` 단위 테스트 — SUMMARY#2 (ai-review W2).
 *
 * Mirror of `use-cafe24-mall-id-precheck.test.tsx` adapted for MakeShop:
 *  - enabled=false → fetch skip
 *  - MAKESHOP_SHOP_UID_PATTERN 위반 → fetch skip
 *  - 350ms debounce 후 fetch
 *  - shopUid 변경 시 직전 in-flight fetch abort
 *  - enabled=false 전환 시 conflict/loading 즉시 클리어
 *  - 네트워크 오류 시 silent fail
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const precheckMock = vi.fn();
vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    makeshopPrecheck: (...args: unknown[]) => precheckMock(...args),
  },
}));

import { useMakeshopShopUidPrecheck } from "../use-makeshop-shop-uid-precheck";

/**
 * Production `MAKESHOP_PRECHECK_DEBOUNCE_MS` (350) + buffer.
 */
const DEBOUNCE_ADVANCE_MS = 360;

describe("useMakeshopShopUidPrecheck", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    precheckMock.mockResolvedValue({ conflict: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enabled=false 면 fetch 호출 없이 conflict null, loading false", () => {
    const { result } = renderHook(() =>
      useMakeshopShopUidPrecheck("myshop-uid", false),
    );
    expect(result.current.conflict).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(precheckMock).not.toHaveBeenCalled();
  });

  it("MAKESHOP_SHOP_UID_PATTERN 위반 shop_uid 는 fetch skip + loading false 유지", () => {
    // Pattern: /^[A-Za-z0-9_-]{2,64}$/ — 1자는 위반
    const { result } = renderHook(() =>
      useMakeshopShopUidPrecheck("X", true),
    );
    expect(precheckMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("빈 shop_uid 는 fetch skip (패턴 위반 — 길이 미만)", () => {
    const { result } = renderHook(() =>
      useMakeshopShopUidPrecheck("", true),
    );
    expect(precheckMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.conflict).toBeNull();
  });

  it("특수문자 포함 shop_uid 는 fetch skip (패턴 위반 — 허용 외 문자)", () => {
    const { result } = renderHook(() =>
      useMakeshopShopUidPrecheck("my shop!", true),
    );
    expect(precheckMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("유효 shop_uid + enabled 면 350ms debounce 후 fetch + 결과 반영", async () => {
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-1",
      existingName: "MyStore (MakeShop)",
      status: "connected",
    });
    const { result } = renderHook(() =>
      useMakeshopShopUidPrecheck("my-shop-uid", true),
    );
    // debounce 진입 직후엔 loading=true
    expect(result.current.loading).toBe(true);
    expect(result.current.conflict).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_ADVANCE_MS);
    });
    await waitFor(() => {
      expect(result.current.conflict).toEqual({
        conflict: true,
        existingIntegrationId: "int-1",
        existingName: "MyStore (MakeShop)",
        status: "connected",
      });
      expect(result.current.loading).toBe(false);
    });
    // 두 번째 인자는 AbortSignal
    expect(precheckMock).toHaveBeenCalledWith(
      "my-shop-uid",
      expect.any(AbortSignal),
    );
  });

  it("shopUid 변경 시 직전 in-flight fetch 가 abort", async () => {
    let firstSignal: AbortSignal | undefined;
    precheckMock.mockImplementationOnce(
      (_id: string, signal: AbortSignal) => {
        firstSignal = signal;
        return new Promise(() => {}); // never resolves
      },
    );
    precheckMock.mockResolvedValueOnce({ conflict: false });

    const { rerender } = renderHook(
      ({ shopUid, enabled }) => useMakeshopShopUidPrecheck(shopUid, enabled),
      { initialProps: { shopUid: "shop-a", enabled: true } },
    );
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_ADVANCE_MS);
    });
    await waitFor(() => expect(precheckMock).toHaveBeenCalledTimes(1));
    expect(firstSignal?.aborted).toBe(false);

    // shopUid 변경 → effect cleanup → abort
    rerender({ shopUid: "shop-b", enabled: true });
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
      ({ shopUid, enabled }) => useMakeshopShopUidPrecheck(shopUid, enabled),
      { initialProps: { shopUid: "my-shop-uid", enabled: true } },
    );
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_ADVANCE_MS);
    });
    await waitFor(() => expect(result.current.conflict).not.toBeNull());

    rerender({ shopUid: "my-shop-uid", enabled: false });
    expect(result.current.conflict).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetch 실패 시 silent — conflict null, loading false", async () => {
    precheckMock.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() =>
      useMakeshopShopUidPrecheck("my-shop-uid", true),
    );
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_ADVANCE_MS);
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.conflict).toBeNull();
  });
});
