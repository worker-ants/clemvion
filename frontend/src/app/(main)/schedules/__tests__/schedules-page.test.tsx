import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/schedules",
  useSearchParams: () => currentSearchParams,
}));

const apiGetMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import SchedulesPage from "../page";

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
    render(<SchedulesPage />, { wrapper: createWrapper() });
  });
}

function mockSchedulesResponse(body: unknown) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/workflows") return Promise.resolve({ data: { data: [] } });
    return Promise.resolve({ data: body });
  });
}

describe("SchedulesPage — pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  it("sends ?page=&limit= on the list request", async () => {
    mockSchedulesResponse({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();
    const listCall = apiGetMock.mock.calls.find(
      ([url]) => url === "/schedules",
    );
    expect(listCall).toBeDefined();
    expect(listCall?.[1]?.params).toMatchObject({ page: 1, limit: 20 });
  });

  it("renders Pagination nav (list view) when totalPages > 1", async () => {
    mockSchedulesResponse({
      data: [
        {
          id: "s1",
          cronExpression: "0 9 * * *",
          timezone: "UTC",
          isActive: true,
          trigger: {
            name: "Daily",
            workflowId: "w1",
            workflow: { name: "WF" },
          },
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 50, totalPages: 3 },
    });
    await renderPage();
    await screen.findByText("Daily");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });
});
