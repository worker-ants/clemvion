import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  act,
  cleanup,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import type { IntegrationDto, UsageWorkflow } from "@/lib/api/integrations";
import { useT } from "@/lib/i18n";

const usagesMock = vi.fn();
const removeMock = vi.fn();
const updateScopeMock = vi.fn();
const pushMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: vi.fn(),
  },
}));
vi.mock("@/lib/api/integrations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/integrations")>(
    "@/lib/api/integrations",
  );
  return {
    ...actual,
    integrationsApi: {
      usages: (...args: unknown[]) => usagesMock(...args),
      remove: (...args: unknown[]) => removeMock(...args),
      updateScope: (...args: unknown[]) => updateScopeMock(...args),
    },
  };
});

import { DangerTab } from "../danger-tab";

function buildIntegration(
  overrides: Partial<IntegrationDto> = {},
): IntegrationDto {
  return {
    id: "int-1",
    workspaceId: "ws-1",
    serviceType: "google",
    name: "Google - Team Account",
    authType: "oauth2",
    credentials: {},
    scope: "personal",
    status: "connected",
    statusReason: null,
    credentialsStatus: "ok",
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    lastError: null,
    meta: { appType: null },
    appUrl: null,
    autoRefresh: false,
    createdBy: "user-1",
    createdAt: "2000-01-01T00:00:00Z",
    updatedAt: "2000-01-01T00:00:00Z",
    ...overrides,
  };
}

const USAGES: UsageWorkflow[] = [
  {
    workflowId: "wf-a",
    workflowName: "Workflow A",
    isActive: true,
    nodes: [
      { id: "abc", label: "Send Email message", type: "send-email", usageKind: "direct" },
      { id: "mcp1", label: "AI Agent", type: "ai-agent", usageKind: "mcp" },
    ],
  },
];

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderDangerTab() {
  const integration = buildIntegration();
  function Host() {
    const t = useT();
    return (
      <DangerTab integration={integration} onScopeChanged={vi.fn()} t={t} />
    );
  }
  return render(<Host />, { wrapper: Wrapper });
}

// §4.7: 첫 "Delete integration" 클릭이 usages 사전 조회를 트리거한다.
async function clickDelete() {
  await userEvent.click(
    screen.getByRole("button", { name: "Delete integration" }),
  );
}

// 사용처 0건일 때 노출되는 인라인 확인 버튼.
async function clickConfirm() {
  await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
}

describe("DangerTab — delete blocked dialog (§4.7 / §7.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  it("on first Delete click, pre-fetches usages and shows the blocked dialog (MCP badge + open-workflow link) when usages > 0, without entering the confirm step", async () => {
    usagesMock.mockResolvedValue(USAGES);

    await act(async () => {
      renderDangerTab();
    });

    await clickDelete();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/Cannot delete "Google - Team Account"/);
    expect(dialog).toHaveTextContent("Workflow A");
    expect(dialog).toHaveTextContent("Send Email message");
    // MCP node renders the shared badge
    expect(dialog).toHaveTextContent("MCP");
    // open-workflow action link
    expect(
      screen.getByRole("link", { name: /Open workflow/i }),
    ).toHaveAttribute("href", "/workflows/wf-a");

    // usages were pre-fetched; no confirm step shown and no delete happened
    expect(usagesMock).toHaveBeenCalledWith("int-1");
    expect(
      screen.queryByRole("button", { name: "Confirm delete" }),
    ).toBeNull();
    expect(removeMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the inline confirm step when usages is empty, then deletes and navigates away on confirm", async () => {
    usagesMock.mockResolvedValue([]);
    removeMock.mockResolvedValue(undefined);

    await act(async () => {
      renderDangerTab();
    });

    await clickDelete();

    // pre-check found no usages → inline confirm appears, no DELETE yet
    await screen.findByRole("button", { name: "Confirm delete" });
    expect(removeMock).not.toHaveBeenCalled();

    await clickConfirm();

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith("int-1");
    });
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/integrations");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("falls back to the blocked dialog when a 409 INTEGRATION_IN_USE arrives with usages on confirm (pre-check/delete race)", async () => {
    // pre-check returns empty (race), confirm DELETE then 409s with usages body
    usagesMock.mockResolvedValue([]);
    removeMock.mockRejectedValue({
      response: {
        status: 409,
        data: { code: "INTEGRATION_IN_USE", usages: USAGES },
      },
    });

    await act(async () => {
      renderDangerTab();
    });

    await clickDelete();
    await clickConfirm();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Workflow A");
    expect(dialog).toHaveTextContent("MCP");
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("shows a toast fallback on 409 without a usages body", async () => {
    usagesMock.mockResolvedValue([]);
    removeMock.mockRejectedValue({
      response: { status: 409, data: { code: "INTEGRATION_IN_USE" } },
    });

    await act(async () => {
      renderDangerTab();
    });

    await clickDelete();
    await clickConfirm();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
