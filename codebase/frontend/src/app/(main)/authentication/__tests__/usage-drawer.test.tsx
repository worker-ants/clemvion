/**
 * Authentication 사용 내역 드로어 — §A.3 호출 이력.
 * 호출 이력 테이블의 소스 IP·응답 코드 컬럼과 기간별 호출 수 표시를 검증한다.
 * recharts 는 jsdom 레이아웃 측정이 없어 chart primitive 를 passthrough 로 stub 한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const getMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...a: unknown[]) => getMock(...a),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/components/auth/role-gate", () => ({
  useHasRole: () => true,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: Passthrough,
    BarChart: Passthrough,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

import AuthenticationPage from "../page";

const CONFIG = {
  id: "cfg-1",
  name: "Order Webhook Auth",
  type: "hmac",
  config: {},
  ipWhitelist: [],
  isActive: true,
  lastUsedAt: "2026-06-14T10:00:00.000Z",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const USAGE = {
  totalCalls: 7,
  lastUsedAt: "2026-06-14T10:00:00.000Z",
  periodCounts: { last24h: 2, last7d: 5, last30d: 7 },
  recentCalls: [
    {
      id: "e-webhook",
      triggerName: "Order Webhook",
      status: "completed",
      startedAt: "2026-06-14T10:00:00.000Z",
      sourceIp: "203.0.113.7",
      responseCode: "202",
    },
    {
      id: "e-schedule",
      triggerName: "Nightly",
      status: "failed",
      startedAt: "2026-06-13T10:00:00.000Z",
      sourceIp: null,
      responseCode: "failed",
    },
  ],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthenticationPage />
    </QueryClientProvider>,
  );
}

describe("Authentication 사용 내역 드로어 (§A.3 호출 이력)", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    getMock.mockImplementation((url: string) => {
      if (url === "/auth-configs") return Promise.resolve({ data: [CONFIG] });
      if (url === `/auth-configs/${CONFIG.id}/usage`)
        return Promise.resolve({ data: USAGE });
      return Promise.reject(new Error(`unexpected url ${url}`));
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("드로어 호출 이력에 소스 IP·응답 코드 컬럼과 값이 표시된다", async () => {
    renderPage();

    // 목록 행 클릭 → 사용 내역 드로어 오픈.
    fireEvent.click(await screen.findByText(CONFIG.name));

    // 새 컬럼 헤더.
    expect(await screen.findByText("Source IP")).toBeInTheDocument();
    expect(screen.getByText("Response Code")).toBeInTheDocument();

    // webhook 호출: 실제 소스 IP + HTTP 202.
    expect(screen.getByText("203.0.113.7")).toBeInTheDocument();
    expect(screen.getByText("202")).toBeInTheDocument();

    // 비-HTTP 트리거: 소스 IP 없음 → "—" 플레이스홀더.
    expect(screen.getByText("—")).toBeInTheDocument();

    // 비-HTTP 트리거: responseCode 가 status enum 으로 폴백('failed') — §A.3 핵심 동작.
    // 'failed' 는 status 배지 + responseCode 셀 두 곳에 렌더된다.
    expect(screen.getAllByText("failed").length).toBeGreaterThanOrEqual(2);
  });

  it("기간별 호출 수 섹션이 렌더된다", async () => {
    renderPage();
    fireEvent.click(await screen.findByText(CONFIG.name));

    await waitFor(() =>
      expect(screen.getByText("Calls by Period")).toBeInTheDocument(),
    );
  });
});
