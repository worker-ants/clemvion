/**
 * 통합 추가 화면의 역할 반영 — NERV CLE-INT-MANAGE 「권한」, Task CLE-T-EDQYGH.
 *
 * - 뷰어는 추가 화면을 쓰지 못한다. 주소로 직접 들어와도 안내와 목록 링크만 보인다.
 * - 관리자 미만은 «조직» 공개 범위를 고르지 못한다.
 * - 설치 대기 행을 다시 쓰면 공개 범위가 요청과 다를 수 있어(REQ-INTOAUTH-067) 그때 안내한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";
import { seedWorkspaceViewer } from "@/test/seed-workspace-viewer";

let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/integrations/new",
  useSearchParams: () => currentSearchParams,
}));

const servicesMock = vi.fn();
const oauthBeginMock = vi.fn();
vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    services: () => servicesMock(),
    cafe24Precheck: vi.fn().mockResolvedValue({ conflict: false }),
    oauthBegin: (...args: unknown[]) => oauthBeginMock(...args),
    create: vi.fn(),
  },
}));
vi.mock("@/lib/integrations/use-makeshop-pending-polling", () => ({
  useMakeshopPendingPolling: () => ({ status: "idle" }),
}));

const toastInfoMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}));

import NewIntegrationPage from "../page";

const MAKESHOP_SERVICE = {
  type: "makeshop",
  name: "MakeShop",
  scopes: [
    { value: "product.read", label: "Read products", recommended: true },
  ],
  authVariants: [{ authType: "oauth2", label: "OAuth 2.0", fields: [] }],
};

async function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(async () => {
    render(<NewIntegrationPage />, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });
  });
}

describe("/integrations/new — 역할 반영", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams("service=makeshop");
    useLocaleStore.setState({ locale: "en" });
    servicesMock.mockResolvedValue([MAKESHOP_SERVICE]);
  });
  afterEach(() => cleanup());

  it("뷰어에게는 추가 양식 대신 안내와 목록 링크만 보인다", async () => {
    seedWorkspaceViewer("viewer");
    await renderPage();

    expect(
      screen.getByText("Only Editors and above can add integrations."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to integrations/ }),
    ).toHaveAttribute("href", "/w/team-1/integrations");
    expect(document.getElementById("int-name")).toBeNull();
    expect(servicesMock).not.toHaveBeenCalled();
  });

  it.each([
    ["editor", false],
    ["admin", true],
    ["owner", true],
  ] as [WorkspaceRole, boolean][])(
    "%s — «조직» 공개 범위 선택 가능 여부",
    async (role, canPickOrganization) => {
      seedWorkspaceViewer(role);
      await renderPage();
      await screen.findByLabelText(/Client ID/);

      expect(screen.getByRole("button", { name: "Personal" })).toBeEnabled();
      const organization = screen.getByRole("button", { name: "Organization" });
      if (canPickOrganization) expect(organization).toBeEnabled();
      else expect(organization).toBeDisabled();
    },
  );

  async function beginMakeshop(requestedScope: "Personal" | "Organization") {
    const user = userEvent.setup();
    await renderPage();
    await screen.findByLabelText(/Client ID/);
    await user.type(document.getElementById("int-name")!, "My Shop");
    await user.type(document.getElementById("makeshop-client-id")!, "cid");
    await user.type(
      document.getElementById("makeshop-client-secret")!,
      "secret",
    );
    await user.click(screen.getByRole("button", { name: requestedScope }));
    await user.click(
      screen.getByRole("button", { name: "Connect with MakeShop" }),
    );
  }

  it("다시 쓴 설치 대기 행의 공개 범위가 요청과 다르면 안내한다", async () => {
    seedWorkspaceViewer("admin");
    oauthBeginMock.mockResolvedValue({
      mode: "makeshop_pending_install",
      integrationId: "int-mk",
      appUrl: "https://app.example.com/api/3rd-party/makeshop/install/tok",
      callbackUrl: "https://app.example.com/api/3rd-party/makeshop/callback",
      scope: "organization",
    });
    await beginMakeshop("Personal");

    await waitFor(() => expect(oauthBeginMock).toHaveBeenCalledTimes(1));
    expect(oauthBeginMock.mock.calls[0][0]).toMatchObject({
      scope: "personal",
    });
    await waitFor(() =>
      expect(toastInfoMock).toHaveBeenCalledWith(
        "Continuing an integration that was already waiting for install. Its scope stays Organization.",
      ),
    );
  });

  it("공개 범위가 요청과 같으면 안내하지 않는다", async () => {
    seedWorkspaceViewer("admin");
    oauthBeginMock.mockResolvedValue({
      mode: "makeshop_pending_install",
      integrationId: "int-mk",
      appUrl: "https://app.example.com/api/3rd-party/makeshop/install/tok",
      callbackUrl: "https://app.example.com/api/3rd-party/makeshop/callback",
      scope: "organization",
    });
    await beginMakeshop("Organization");

    await waitFor(() => expect(oauthBeginMock).toHaveBeenCalledTimes(1));
    expect(oauthBeginMock.mock.calls[0][0]).toMatchObject({
      scope: "organization",
    });
    expect(toastInfoMock).not.toHaveBeenCalled();
  });
});
