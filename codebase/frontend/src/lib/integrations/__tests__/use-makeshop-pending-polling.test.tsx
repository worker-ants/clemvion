/**
 * `useMakeshopPendingPolling` 단위 테스트 — SUMMARY#1 (ai-review W1).
 *
 * Mirror of `use-cafe24-pending-polling.test.tsx` adapted for MakeShop:
 *  - connected 전이 (route + toast + invalidate)
 *  - 10분 timeout
 *  - statusReason → i18n 매핑 (W7: raw 에러 메시지 미노출)
 *  - 알 수 없는 statusReason → generic fallback 메시지
 *  - lastErrorMessage null 조건 (pending_install 아닐 때)
 *  - transitionedRef 중복 방지 (connected 전이는 1회만)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const hoisted = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  getMock: vi.fn(),
}));
const { mockReplace, toastSuccess, getMock } = hoisted;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: hoisted.mockReplace,
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: hoisted.toastSuccess, error: hoisted.toastError },
}));

vi.mock("@/lib/i18n", () => ({
  useT: () => (k: string) => k,
}));

vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: { get: (id: string) => hoisted.getMock(id) },
}));

import { useMakeshopPendingPolling } from "../use-makeshop-pending-polling";

function makeRow(overrides: Record<string, unknown>) {
  return {
    id: "int-ms-1",
    workspaceId: "ws",
    serviceType: "makeshop",
    name: "",
    authType: "oauth2",
    credentials: {},
    scope: "personal",
    status: "pending_install",
    statusReason: null,
    credentialsStatus: "ok",
    lastError: null,
    meta: {},
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    createdBy: "u",
    createdAt: "2026-06-03T00:00:00Z",
    updatedAt: "2026-06-03T00:00:00Z",
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useMakeshopPendingPolling", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    toastSuccess.mockReset();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("exposes the polled integration row once the query resolves", async () => {
    getMock.mockResolvedValue(makeRow({ status: "pending_install" }));
    const { result } = renderHook(() => useMakeshopPendingPolling("int-ms-1"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.poll?.status).toBe("pending_install"),
    );
    expect(result.current.timedOut).toBe(false);
  });

  it("transitions on connected — invalidates list + routes to detail", async () => {
    getMock.mockResolvedValue(makeRow({ status: "connected" }));
    renderHook(() => useMakeshopPendingPolling("int-ms-1"), { wrapper });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/integrations/int-ms-1",
      ),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("encodes integrationId in router.replace (INFO4 path-traversal guard)", async () => {
    getMock.mockResolvedValue(makeRow({ status: "connected" }));
    renderHook(() => useMakeshopPendingPolling("int-ms-1"), { wrapper });
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const url: string = mockReplace.mock.calls[0][0];
    // integrationId "int-ms-1" has no special chars — encoded form is same.
    expect(url).toBe("/integrations/int-ms-1");
  });

  it("does not auto-route on terminal states other than connected", async () => {
    getMock.mockResolvedValue(
      makeRow({ status: "expired", statusReason: "install_timeout" }),
    );
    renderHook(() => useMakeshopPendingPolling("int-ms-1"), { wrapper });
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("transitionedRef dedup — connected transition fires exactly once", async () => {
    getMock.mockResolvedValue(makeRow({ status: "connected" }));
    const { rerender } = renderHook(
      () => useMakeshopPendingPolling("int-ms-1"),
      { wrapper },
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    rerender();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  });

  it("maps known statusReason to i18n key — does NOT expose raw backend message (W7)", async () => {
    getMock.mockResolvedValue(
      makeRow({
        status: "pending_install",
        statusReason: "oauth_token_exchange_failed",
        lastError: { message: "internal: token endpoint returned 400" },
      }),
    );
    const { result } = renderHook(() => useMakeshopPendingPolling("int-ms-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.poll).toBeDefined());
    // useT mock returns the key itself — verify we get the i18n key, not raw backend text.
    expect(result.current.lastErrorMessage).toBe(
      "integrations.makeshopErrorOauthTokenExchangeFailed",
    );
    // Raw backend message must NOT appear.
    expect(result.current.lastErrorMessage).not.toContain("internal:");
  });

  it("maps oauth_state_mismatch to its i18n key", async () => {
    getMock.mockResolvedValue(
      makeRow({
        status: "pending_install",
        statusReason: "oauth_state_mismatch",
      }),
    );
    const { result } = renderHook(() => useMakeshopPendingPolling("int-ms-1"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.lastErrorMessage).toBe(
        "integrations.makeshopErrorOauthStateMismatch",
      ),
    );
  });

  it("maps hmac_verification_failed to its i18n key", async () => {
    getMock.mockResolvedValue(
      makeRow({
        status: "pending_install",
        statusReason: "hmac_verification_failed",
      }),
    );
    const { result } = renderHook(() => useMakeshopPendingPolling("int-ms-1"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.lastErrorMessage).toBe(
        "integrations.makeshopErrorHmacVerificationFailed",
      ),
    );
  });

  it("unknown statusReason falls back to generic safe message (W7)", async () => {
    getMock.mockResolvedValue(
      makeRow({
        status: "pending_install",
        statusReason: "some_future_undocumented_reason",
        lastError: { message: "sensitive internal trace XYZ" },
      }),
    );
    const { result } = renderHook(() => useMakeshopPendingPolling("int-ms-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.poll).toBeDefined());
    expect(result.current.lastErrorMessage).toBe(
      "integrations.makeshopErrorGenericCallback",
    );
    expect(result.current.lastErrorMessage).not.toContain("sensitive");
  });

  it("returns null lastErrorMessage when statusReason is null", async () => {
    getMock.mockResolvedValue(
      makeRow({ status: "pending_install", statusReason: null }),
    );
    const { result } = renderHook(() => useMakeshopPendingPolling("int-ms-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.poll).toBeDefined());
    expect(result.current.lastErrorMessage).toBeNull();
  });

  it("does not surface lastErrorMessage when status is not pending_install", async () => {
    getMock.mockResolvedValue(
      makeRow({
        status: "expired",
        statusReason: "install_timeout",
      }),
    );
    const { result } = renderHook(() => useMakeshopPendingPolling("int-ms-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.poll).toBeDefined());
    expect(result.current.lastErrorMessage).toBeNull();
  });

  it("times out and flips timedOut=true after MAKESHOP_PENDING_TIMEOUT_MS", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMock.mockResolvedValue(makeRow({ status: "pending_install" }));
    const { result } = renderHook(() => useMakeshopPendingPolling("int-ms-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.poll).toBeDefined());
    expect(result.current.timedOut).toBe(false);
    vi.advanceTimersByTime(10 * 60 * 1000 + 100);
    await waitFor(() => expect(result.current.timedOut).toBe(true));
    vi.useRealTimers();
  });
});
