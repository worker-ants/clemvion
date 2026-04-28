import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/integrations",
  useSearchParams: () => currentSearchParams,
}));

const listMock = vi.fn();
const servicesMock = vi.fn();
vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    list: (...args: unknown[]) => listMock(...args),
    services: () => servicesMock(),
  },
}));

import IntegrationsPage from "../page";

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
    render(<IntegrationsPage />, { wrapper: createWrapper() });
  });
}

describe("IntegrationsPage — pagination (post-component-migration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
    servicesMock.mockResolvedValue([]);
  });

  it("renders Pagination nav when totalPages > 1", async () => {
    listMock.mockResolvedValue({
      data: [
        {
          id: "i1",
          name: "Slack",
          serviceType: "slack",
          scope: "personal",
          status: "connected",
          authType: "oauth",
          createdAt: "",
          updatedAt: "",
        },
      ],
      pagination: { page: 1, limit: 30, totalItems: 100, totalPages: 4 },
    });
    await renderPage();
    await screen.findByText("Slack");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4" })).toBeInTheDocument();
  });

  it("hides Pagination when totalPages <= 1", async () => {
    listMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 30, totalItems: 0, totalPages: 0 },
    });
    await renderPage();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("clicking page 2 calls router.replace with ?page=2", async () => {
    listMock.mockResolvedValue({
      data: [
        {
          id: "i1",
          name: "Slack",
          serviceType: "slack",
          scope: "personal",
          status: "connected",
          authType: "oauth",
          createdAt: "",
          updatedAt: "",
        },
      ],
      pagination: { page: 1, limit: 30, totalItems: 100, totalPages: 4 },
    });
    await renderPage();
    await screen.findByText("Slack");
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect(mockReplace).toHaveBeenCalled();
    const url = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("page=2");
  });
});
