import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/triggers",
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

vi.mock("@/components/triggers/trigger-detail-drawer", () => ({
  TriggerDetailDrawer: () => null,
}));

import TriggersPage from "../page";

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
    render(<TriggersPage />, { wrapper: createWrapper() });
  });
}

function mockTriggersResponse(body: unknown) {
  // Two queries: /triggers (list) and /workflows (workflows-list dropdown)
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/workflows") return Promise.resolve({ data: { data: [] } });
    return Promise.resolve({ data: body });
  });
}

describe("TriggersPage — pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  it("sends ?page=&limit= on the list request", async () => {
    mockTriggersResponse({
      data: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
    await renderPage();
    const listCall = apiGetMock.mock.calls.find(
      ([url]) => url === "/triggers",
    );
    expect(listCall).toBeDefined();
    expect(listCall?.[1]?.params).toMatchObject({ page: 1, limit: 20 });
  });

  it("renders Pagination nav when totalPages > 1", async () => {
    mockTriggersResponse({
      data: [
        {
          id: "t1",
          name: "Hook A",
          type: "webhook",
          isActive: true,
          workflowId: "w1",
          workflow: { id: "w1", name: "WF" },
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 50, totalPages: 3 },
    });
    await renderPage();
    await screen.findByText("Hook A");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });
});
