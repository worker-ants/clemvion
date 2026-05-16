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
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastInfoMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
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
    appUrl: null,
    createdBy: "user-1",
    createdAt: "2000-01-01T00:00:00Z",
    updatedAt: "2000-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildService(overrides: Partial<ServiceDefinition> = {}): ServiceDefinition {
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
    ...overrides,
  };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderScopeTab(props: {
  integration?: IntegrationDto;
  service?: ServiceDefinition | undefined;
  onChanged?: () => void;
}) {
  const integration = props.integration ?? buildIntegration();
  const service = props.service === undefined ? buildService() : props.service;
  const onChanged = props.onChanged ?? vi.fn();

  function Host() {
    const t = useT();
    return (
      <ScopeTab
        integration={integration}
        service={service}
        onChanged={onChanged}
        t={t}
      />
    );
  }

  return { onChanged, render: () => render(<Host />, { wrapper: Wrapper }) };
}

function getCheckbox(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText).closest("label")!;
  return label.querySelector("input[type='checkbox']") as HTMLInputElement;
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

    const onChanged = vi.fn();
    const { render: renderFn } = renderScopeTab({ onChanged });
    await act(async () => {
      renderFn();
    });

    await userEvent.click(getCheckbox("Write product"));
    await userEvent.click(getCheckbox("Read order"));
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
    expect(toastInfoMock).toHaveBeenCalledTimes(1);
    // pending 분기는 onChanged() 호출하지 않는다 — 실제 token 갱신은 cafe24
    // 측 후속 작업 후이므로 refetch 해도 변화 없음
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("renders the alert without the scopes list when scopesAdded is empty", async () => {
    const response: RequestScopesResult = {
      mode: "cafe24_private_pending",
      integrationId: "int-cafe24-1",
      appUrl: "https://example.com/api/3rd-party/cafe24/install/abc",
      callbackUrl: "https://example.com/api/3rd-party/cafe24/callback",
      scopesAdded: [],
    };
    requestScopesMock.mockResolvedValue(response);

    const { render: renderFn } = renderScopeTab({});
    await act(async () => {
      renderFn();
    });

    await userEvent.click(getCheckbox("Write product"));
    await userEvent.click(screen.getByRole("button", { name: "Request scopes" }));

    const alert = await screen.findByRole("status");
    expect(alert).not.toHaveTextContent("mall.write_product");
    expect(alert).not.toHaveTextContent("Scopes added");
  });

  it("clears the pending alert when the user starts another request", async () => {
    requestScopesMock
      .mockResolvedValueOnce({
        mode: "cafe24_private_pending",
        integrationId: "int-cafe24-1",
        appUrl: "https://example.com/install/a",
        callbackUrl: "https://example.com/callback",
        scopesAdded: ["mall.write_product"],
      } satisfies RequestScopesResult)
      .mockImplementationOnce(
        () => new Promise(() => {}), // pending Promise — never resolves so we can observe the in-flight state
      );

    const { render: renderFn } = renderScopeTab({});
    await act(async () => {
      renderFn();
    });

    await userEvent.click(getCheckbox("Write product"));
    await userEvent.click(screen.getByRole("button", { name: "Request scopes" }));
    await screen.findByRole("status");

    await userEvent.click(getCheckbox("Read order"));
    await userEvent.click(screen.getByRole("button", { name: "Request scopes" }));

    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  it("falls back to the existing OAuth popup flow when authUrl is returned and invokes onChanged + success toast", async () => {
    const response: RequestScopesResult = {
      authUrl: "https://oauth.example/authorize?...",
      state: "state-token",
    };
    requestScopesMock.mockResolvedValue(response);

    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => ({ closed: false }) as Window);

    const onChanged = vi.fn();
    const { render: renderFn } = renderScopeTab({ onChanged });
    await act(async () => {
      renderFn();
    });

    await userEvent.click(getCheckbox("Write product"));
    await userEvent.click(screen.getByRole("button", { name: "Request scopes" }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledTimes(1);

    openSpy.mockRestore();
  });

  it("shows an error toast when the API call fails", async () => {
    requestScopesMock.mockRejectedValue(new Error("500 Internal Server Error"));

    const onChanged = vi.fn();
    const { render: renderFn } = renderScopeTab({ onChanged });
    await act(async () => {
      renderFn();
    });

    await userEvent.click(getCheckbox("Write product"));
    await userEvent.click(screen.getByRole("button", { name: "Request scopes" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("renders an empty-state message when the service exposes no scope options", async () => {
    const { render: renderFn } = renderScopeTab({
      service: buildService({ scopes: [] }),
    });
    await act(async () => {
      renderFn();
    });

    expect(
      screen.getByText("No additional scopes are available for this service."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request scopes" }),
    ).toBeDisabled();
  });

  it("renders the non-OAuth fallback when authType is not oauth2", async () => {
    const { render: renderFn } = renderScopeTab({
      integration: buildIntegration({ authType: "api_key" }),
    });
    await act(async () => {
      renderFn();
    });

    expect(
      screen.getByText(/Scope management is only available for OAuth integrations\./i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request scopes" }),
    ).toBeNull();
  });
});
