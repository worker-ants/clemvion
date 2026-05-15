import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import type {
  IntegrationDto,
  RequestScopesResult,
  ServiceDefinition,
} from "@/lib/api/integrations";
import { useT } from "@/lib/i18n";

const requestScopesMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/lib/api/integrations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/integrations")>(
    "@/lib/api/integrations",
  );
  return {
    ...actual,
    integrationsApi: {
      requestScopes: (...args: unknown[]) => requestScopesMock(...args),
    },
  };
});

import { ScopeTab } from "../scope-tab";

function buildIntegration(overrides: Partial<IntegrationDto> = {}): IntegrationDto {
  return {
    id: "int-cafe24-1",
    workspaceId: "ws-1",
    serviceType: "cafe24",
    name: "My Mall",
    authType: "oauth2",
    credentials: {
      app_type: "private",
      mall_id: "demoshop",
      scopes: ["mall.read_product"],
    },
    scope: "personal",
    status: "connected",
    statusReason: null,
    credentialsStatus: "ok",
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    lastError: null,
    meta: { appType: "private" },
    createdBy: "user-1",
    createdAt: "2026-05-16T00:00:00Z",
    updatedAt: "2026-05-16T00:00:00Z",
    ...overrides,
  };
}

function buildService(): ServiceDefinition {
  return {
    type: "cafe24",
    name: "Cafe24",
    oauthProvider: null,
    authTypes: ["oauth2"],
    authVariants: [],
    scopes: [
      { value: "mall.read_product", label: "Read product" },
      { value: "mall.write_product", label: "Write product" },
      { value: "mall.read_order", label: "Read order" },
    ],
  };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function HostedScopeTab() {
  const t = useT();
  return (
    <ScopeTab
      integration={buildIntegration()}
      service={buildService()}
      onChanged={() => {}}
      t={t}
    />
  );
}

describe("ScopeTab — Cafe24 Private request-scopes UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  it("renders the Cafe24 pending alert with scopesAdded when the server signals cafe24_private_pending", async () => {
    const response: RequestScopesResult = {
      mode: "cafe24_private_pending",
      integrationId: "int-cafe24-1",
      appUrl: "https://example.com/api/3rd-party/cafe24/install/abc",
      callbackUrl: "https://example.com/api/3rd-party/cafe24/callback",
      scopesAdded: ["mall.write_product", "mall.read_order"],
    };
    requestScopesMock.mockResolvedValue(response);

    await act(async () => {
      render(<HostedScopeTab />, { wrapper: Wrapper });
    });

    const writeProductLabel = await screen.findByText("Write product");
    const writeProductCheckbox = writeProductLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;
    const readOrderLabel = screen.getByText("Read order");
    const readOrderCheckbox = readOrderLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;

    await userEvent.click(writeProductCheckbox);
    await userEvent.click(readOrderCheckbox);
    await userEvent.click(screen.getByRole("button", { name: "Request scopes" }));

    await waitFor(() => {
      expect(requestScopesMock).toHaveBeenCalledWith("int-cafe24-1", [
        "mall.write_product",
        "mall.read_order",
      ]);
    });

    const alert = await screen.findByRole("status");
    expect(alert).toHaveTextContent(
      /Grant the additional scopes in Cafe24 Developers/i,
    );
    expect(alert).toHaveTextContent(/Test run/i);
    expect(alert).toHaveTextContent("mall.write_product");
    expect(alert).toHaveTextContent("mall.read_order");
  });

  it("falls back to the existing OAuth popup flow when authUrl is returned", async () => {
    const response: RequestScopesResult = {
      authUrl: "https://oauth.example/authorize?...",
      state: "state-token",
    };
    requestScopesMock.mockResolvedValue(response);

    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => ({ closed: false }) as Window);

    await act(async () => {
      render(<HostedScopeTab />, { wrapper: Wrapper });
    });

    const writeProductLabel = await screen.findByText("Write product");
    const writeProductCheckbox = writeProductLabel
      .closest("label")!
      .querySelector("input[type='checkbox']") as HTMLInputElement;
    await userEvent.click(writeProductCheckbox);
    await userEvent.click(screen.getByRole("button", { name: "Request scopes" }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });

    expect(screen.queryByRole("status")).toBeNull();

    openSpy.mockRestore();
  });
});
