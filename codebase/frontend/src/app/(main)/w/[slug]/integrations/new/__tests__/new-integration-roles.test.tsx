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
import {
  resetWorkspaceViewer,
  seedWorkspaceViewer,
} from "@/test/seed-workspace-viewer";

let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/integrations/new",
  useSearchParams: () => currentSearchParams,
}));

const servicesMock = vi.fn();
const oauthBeginMock = vi.fn();
const cafe24PrecheckMock = vi.fn();
vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    services: () => servicesMock(),
    cafe24Precheck: (...args: unknown[]) => cafe24PrecheckMock(...args),
    oauthBegin: (...args: unknown[]) => oauthBeginMock(...args),
    create: vi.fn(),
  },
}));
vi.mock("@/lib/integrations/use-makeshop-pending-polling", () => ({
  useMakeshopPendingPolling: () => ({ status: "idle" }),
}));
vi.mock("@/lib/integrations/use-cafe24-pending-polling", () => ({
  useCafe24PendingPolling: () => ({ status: "idle" }),
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

// Public 앱을 쓰지 않는 배포라 앱 유형이 Private 으로 고정된다. Private 의 `new` 모드는 설치 대기 행을 쓴다.
const CAFE24_PRIVATE_ONLY_SERVICE = {
  type: "cafe24",
  name: "Cafe24",
  meta: { publicAppAvailable: false },
  scopes: [
    { value: "mall.read_product", label: "Read products", recommended: true },
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
    servicesMock.mockResolvedValue([
      MAKESHOP_SERVICE,
      CAFE24_PRIVATE_ONLY_SERVICE,
    ]);
    cafe24PrecheckMock.mockResolvedValue({ conflict: false });
  });
  afterEach(() => {
    cleanup();
    resetWorkspaceViewer();
  });

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

  type PendingService = "makeshop" | "cafe24";
  type RequestedScope = "Personal" | "Organization";

  /** 다시 쓴 설치 대기 행의 응답. 두 서비스 모두 그 행의 공개 범위 `organization` 을 싣는다. */
  const REUSED_PENDING_RESULT: Record<PendingService, object> = {
    makeshop: {
      mode: "makeshop_pending_install",
      integrationId: "int-mk",
      appUrl: "https://app.example.com/api/3rd-party/makeshop/install/tok",
      callbackUrl: "https://app.example.com/api/3rd-party/makeshop/callback",
      scope: "organization",
    },
    cafe24: {
      mode: "cafe24_private_pending",
      integrationId: "int-c24",
      appUrl: "https://app.example.com/api/3rd-party/cafe24/install/tok",
      callbackUrl: "https://app.example.com/api/3rd-party/cafe24/callback",
      scope: "organization",
    },
  };

  async function beginPendingInstall(
    service: PendingService,
    requestedScope: RequestedScope,
  ) {
    currentSearchParams = new URLSearchParams(`service=${service}`);
    const user = userEvent.setup();
    await renderPage();
    await screen.findByLabelText(/Client ID/);
    await user.type(document.getElementById("int-name")!, "My Shop");
    if (service === "makeshop") {
      await user.type(document.getElementById("makeshop-client-id")!, "cid");
      await user.type(
        document.getElementById("makeshop-client-secret")!,
        "secret",
      );
    } else {
      await user.type(document.getElementById("cafe24-mall-id")!, "myshop");
      await user.type(document.getElementById("cafe24-client-id")!, "cid");
      await user.type(
        document.getElementById("cafe24-client-secret")!,
        "secret",
      );
    }
    await user.click(screen.getByRole("button", { name: requestedScope }));
    // Cafe24 는 상점 사전 확인이 끝날 때까지 연결 버튼이 꺼져 있다.
    const connect = screen.getByRole("button", {
      name: service === "makeshop" ? "Connect with MakeShop" : "Connect with Cafe24",
    });
    await waitFor(() => expect(connect).toBeEnabled());
    await user.click(connect);
  }

  // REQ-INTOAUTH-067 — 다시 쓴 설치 대기 행의 공개 범위(`organization`)가 요청과 다를 때만 안내한다.
  it.each([
    { service: "makeshop", requested: "Personal", notice: true },
    { service: "makeshop", requested: "Organization", notice: false },
    { service: "cafe24", requested: "Personal", notice: true },
    { service: "cafe24", requested: "Organization", notice: false },
  ] as { service: PendingService; requested: RequestedScope; notice: boolean }[])(
    "$service — $requested 로 요청하고 다시 쓴 행이 Organization 이면 안내 여부: $notice",
    async ({ service, requested, notice }) => {
      seedWorkspaceViewer("admin");
      oauthBeginMock.mockResolvedValue(REUSED_PENDING_RESULT[service]);
      await beginPendingInstall(service, requested);

      await waitFor(() => expect(oauthBeginMock).toHaveBeenCalledTimes(1));
      expect(oauthBeginMock.mock.calls[0][0]).toMatchObject({
        service,
        mode: "new",
        scope: requested.toLowerCase(),
      });
      const message =
        "Continuing an integration that was already waiting for install. Its scope stays Organization.";
      if (notice) {
        await waitFor(() =>
          expect(toastInfoMock).toHaveBeenCalledWith(message),
        );
      } else {
        // 안내 여부는 응답을 받은 직후에 정해진다. 설치 대기 안내 화면이 뜬 뒤에도 토스트가 없어야 한다.
        await screen.findByText(
          "https://app.example.com/api/3rd-party/" + service + "/install/tok",
        );
        expect(toastInfoMock).not.toHaveBeenCalled();
      }
    },
  );
});
