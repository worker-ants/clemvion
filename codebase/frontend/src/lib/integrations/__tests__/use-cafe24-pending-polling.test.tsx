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

import { useCafe24PendingPolling } from "../use-cafe24-pending-polling";

function makeRow(overrides: Record<string, unknown>) {
  return {
    id: "int-1",
    workspaceId: "ws",
    serviceType: "cafe24",
    name: "",
    authType: "oauth2",
    credentials: {},
    scope: "personal",
    status: "pending_install",
    statusReason: null,
    credentialsStatus: "ok",
    lastError: null,
    meta: { appType: "private" },
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    createdBy: "u",
    createdAt: "2026-05-14T00:00:00Z",
    updatedAt: "2026-05-14T00:00:00Z",
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useCafe24PendingPolling", () => {
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
    const { result } = renderHook(() => useCafe24PendingPolling("int-1"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.poll?.status).toBe("pending_install"),
    );
    expect(result.current.timedOut).toBe(false);
  });

  it("transitions on connected — invalidates list + routes to detail", async () => {
    getMock.mockResolvedValue(makeRow({ status: "connected" }));
    renderHook(() => useCafe24PendingPolling("int-1"), { wrapper });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/integrations/int-1"),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("surfaces lastError.message as the diagnostic when callback recorded a failure", async () => {
    getMock.mockResolvedValue(
      makeRow({
        status: "pending_install",
        statusReason: "oauth_token_exchange_failed",
        lastError: { message: "Failed: invalid_grant" },
      }),
    );
    const { result } = renderHook(() => useCafe24PendingPolling("int-1"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.lastErrorMessage).toBe("Failed: invalid_grant"),
    );
  });

  it("falls back to statusReason when lastError.message missing", async () => {
    getMock.mockResolvedValue(
      makeRow({
        status: "pending_install",
        statusReason: "oauth_token_exchange_failed",
        lastError: null,
      }),
    );
    const { result } = renderHook(() => useCafe24PendingPolling("int-1"), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.lastErrorMessage).toBe(
        "oauth_token_exchange_failed",
      ),
    );
  });

  it("does not surface lastErrorMessage when status is not pending_install", async () => {
    getMock.mockResolvedValue(
      makeRow({
        status: "expired",
        statusReason: "install_timeout",
      }),
    );
    const { result } = renderHook(() => useCafe24PendingPolling("int-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.poll).toBeDefined());
    expect(result.current.lastErrorMessage).toBeNull();
  });

  it("does not auto-route on terminal states other than connected", async () => {
    getMock.mockResolvedValue(
      makeRow({ status: "expired", statusReason: "install_timeout" }),
    );
    renderHook(() => useCafe24PendingPolling("int-1"), { wrapper });
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("times out and flips timedOut=true after PRIVATE_PENDING_TIMEOUT_MS", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMock.mockResolvedValue(makeRow({ status: "pending_install" }));
    const { result } = renderHook(() => useCafe24PendingPolling("int-1"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.poll).toBeDefined());
    expect(result.current.timedOut).toBe(false);
    vi.advanceTimersByTime(10 * 60 * 1000 + 100);
    await waitFor(() => expect(result.current.timedOut).toBe(true));
    vi.useRealTimers();
  });
});
