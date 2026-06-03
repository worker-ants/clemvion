import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const apiGetMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// recharts ResponsiveContainer relies on layout measurement unavailable in jsdom;
// stub the chart primitives so the page renders without a real chart canvas.
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
    Legend: () => null,
    PieChart: Passthrough,
    Pie: () => null,
    Cell: () => null,
  };
});

import StatisticsPage from "../page";

const SUMMARY = {
  totalExecutions: 120,
  successCount: 100,
  failedCount: 15,
  cancelledCount: 5,
  successRate: 83.3,
  avgDurationMs: 1200,
  totalExecutionsChangeRate: 20,
};

function mockApi(summary: Record<string, unknown> = SUMMARY) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/workflows") return Promise.resolve({ data: { data: [] } });
    if (url === "/statistics/summary")
      return Promise.resolve({ data: { data: summary } });
    if (url === "/statistics/llm-usage/summary")
      return Promise.resolve({
        data: {
          data: {
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalTokens: 0,
            totalCostUsd: null,
            topProvider: null,
            byModel: [],
          },
        },
      });
    // executions / errors / top-workflows / node-stats
    return Promise.resolve({ data: { data: [] } });
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

async function renderPage() {
  await act(async () => {
    render(<StatisticsPage />, { wrapper: createWrapper() });
  });
}

function summaryCalls() {
  return apiGetMock.mock.calls.filter(
    ([url]) => url === "/statistics/summary",
  );
}

describe("StatisticsPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
  });

  it("renders the Total Runs change indicator when a change rate is present", async () => {
    mockApi();
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("120")).toBeInTheDocument();
    });
    // +20% delta vs previous period.
    expect(screen.getByText(/\+20%/)).toBeInTheDocument();
  });

  it("omits the change indicator when change rate is null", async () => {
    mockApi({ ...SUMMARY, totalExecutionsChangeRate: null });
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("120")).toBeInTheDocument();
    });
    expect(screen.queryByText(/%\s*vs prev period/i)).not.toBeInTheDocument();
  });

  it("sends period=custom with startDate/endDate after applying a custom range", async () => {
    mockApi();
    await renderPage();

    await waitFor(() => {
      expect(summaryCalls().length).toBeGreaterThan(0);
    });

    // Enter custom mode.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^custom$/i }));
    });

    const start = screen.getByLabelText(/start date/i) as HTMLInputElement;
    const end = screen.getByLabelText(/end date/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(start, { target: { value: "2026-05-01" } });
      fireEvent.change(end, { target: { value: "2026-05-15" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    });

    await waitFor(() => {
      const lastCustom = summaryCalls().find(
        ([, cfg]) =>
          (cfg as { params?: Record<string, unknown> })?.params?.period ===
          "custom",
      );
      expect(lastCustom).toBeDefined();
      const params = (lastCustom![1] as { params: Record<string, unknown> })
        .params;
      expect(params.startDate).toBe("2026-05-01");
      expect(params.endDate).toBe("2026-05-15");
    });
  });

  it("does not query before a custom range is applied", async () => {
    mockApi();
    await renderPage();

    await waitFor(() => {
      expect(summaryCalls().length).toBeGreaterThan(0);
    });

    apiGetMock.mockClear();
    mockApi();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^custom$/i }));
    });

    // Entering custom mode (without applying) must not fire a custom-range query.
    const customQueries = summaryCalls().filter(
      ([, cfg]) =>
        (cfg as { params?: Record<string, unknown> })?.params?.period ===
        "custom",
    );
    expect(customQueries).toHaveLength(0);
  });
});
