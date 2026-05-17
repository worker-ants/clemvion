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

// spec/2-navigation/4-integration.md §2.4 — "Need attention" banner
describe("IntegrationsPage — attention banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
    servicesMock.mockResolvedValue([]);
  });

  function attentionRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "x",
      workspaceId: "w",
      name: "Acme",
      serviceType: "google",
      scope: "personal",
      status: "error",
      authType: "oauth",
      credentials: {},
      statusReason: "auth_failed",
      credentialsStatus: "ok",
      lastError: null,
      meta: { appType: null },
      tokenExpiresAt: null,
      lastUsedAt: null,
      lastRotatedAt: null,
      createdBy: "u",
      createdAt: "",
      updatedAt: "",
      ...overrides,
    };
  }

  it("shows a breakdown (Expired/Expiring/Error counts) when multiple categories are present", async () => {
    listMock.mockResolvedValue({
      data: [
        attentionRow({ id: "a", name: "Acme A", status: "expired" }),
        attentionRow({ id: "b", name: "Acme B", status: "error" }),
        attentionRow({
          id: "c",
          name: "Acme C",
          status: "connected",
          tokenExpiresAt: new Date(
            Date.now() + 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }),
      ],
      pagination: { page: 1, limit: 30, totalItems: 3, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Acme A");
    // Title plural form
    expect(
      screen.getByText(/3 integrations need attention/i),
    ).toBeInTheDocument();
    // Each non-zero category appears with its count
    expect(screen.getByText(/Expired 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Expiring 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Error 1/i)).toBeInTheDocument();
  });

  it("clicking the banner with 2+ rows applies ?status=attention", async () => {
    listMock.mockResolvedValue({
      data: [
        attentionRow({ id: "a", name: "Acme A", status: "expired" }),
        attentionRow({ id: "b", name: "Acme B", status: "error" }),
      ],
      pagination: { page: 1, limit: 30, totalItems: 2, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Acme A");
    const banner = screen.getByRole("button", {
      name: /integrations need attention/i,
    });
    await userEvent.click(banner);
    expect(mockReplace).toHaveBeenCalled();
    const url = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("status=attention");
  });

  it("clicking the banner with exactly 1 row jumps to that integration's detail page", async () => {
    listMock.mockResolvedValue({
      data: [attentionRow({ id: "lonely", status: "error" })],
      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Acme");
    const banner = screen.getByRole("button", {
      name: /integration needs attention/i,
    });
    await userEvent.click(banner);
    // detail jump uses push, not replace, since it's a navigation, not a
    // filter URL update.
    const lastPush = mockPush.mock.calls.at(-1)?.[0] as string | undefined;
    const lastReplace = mockReplace.mock.calls.at(-1)?.[0] as string | undefined;
    const jumpedTo = lastPush ?? lastReplace ?? "";
    expect(jumpedTo).toContain("/integrations/lonely");
  });

  it("uses the red error tone when at least one error row is present", async () => {
    listMock.mockResolvedValue({
      data: [attentionRow({ id: "a", status: "error" })],
      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Acme");
    const banner = screen.getByRole("button", {
      name: /integration needs attention/i,
    });
    expect(banner.className).toMatch(/red/);
  });

  it("uses the amber warn tone when no error rows are present", async () => {
    listMock.mockResolvedValue({
      data: [attentionRow({ id: "a", status: "expired" })],
      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Acme");
    const banner = screen.getByRole("button", {
      name: /integration needs attention/i,
    });
    expect(banner.className).toMatch(/yellow|amber/);
    expect(banner.className).not.toMatch(/red/);
  });

  it("hides the banner when there are no attention rows", async () => {
    listMock.mockResolvedValue({
      data: [attentionRow({ id: "ok", status: "connected" })],
      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Acme");
    expect(
      screen.queryByText(/needs? attention/i),
    ).not.toBeInTheDocument();
  });

  // EXPIRING_SOON_DAYS = 7 — a connected row whose token expires far in the
  // future must not count toward attention even if other rows do.
  it("hides the banner for a connected row whose token expires well past 7 days", async () => {
    listMock.mockResolvedValue({
      data: [
        attentionRow({
          id: "far-out",
          status: "connected",
          tokenExpiresAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }),
      ],
      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Acme");
    expect(
      screen.queryByText(/needs? attention/i),
    ).not.toBeInTheDocument();
  });

  // Single-row case takes the navigation (push) path because the banner
  // jumps straight to detail rather than rewriting the filter URL.
  it("single-row banner click uses router.push, not replace", async () => {
    listMock.mockResolvedValue({
      data: [attentionRow({ id: "lonely", status: "error" })],
      pagination: { page: 1, limit: 30, totalItems: 1, totalPages: 1 },
    });
    await renderPage();
    await screen.findByText("Acme");
    const banner = screen.getByRole("button", {
      name: /integration needs attention/i,
    });
    await userEvent.click(banner);
    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushArg = mockPush.mock.calls.at(-1)?.[0] as string;
    expect(pushArg).toBe("/integrations/lonely");
  });
});
