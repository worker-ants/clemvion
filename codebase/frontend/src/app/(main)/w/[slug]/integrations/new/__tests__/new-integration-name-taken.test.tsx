/**
 * 통합 추가 화면의 이름 충돌 — NERV CLE-INT-OAUTH 「만료된 설치 대기 행」 · CLE-INT-MANAGE 「에러 코드」,
 * Task CLE-T-PS7JQY.
 *
 * Cafe24 Private · MakeShop begin 이 설치 대기 행을 만들다 이름이 겹치면 409 `INTEGRATION_NAME_TAKEN` 이다. 만료 행은
 * 상점 자리를 놓아도 이름은 그대로라 같은 이름으로 다시 등록하면 흔히 난다. 화면은 이름 칸에 알리고 사용자가 이름을
 * 고치면 지운다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { seedWorkspaceViewer } from "@/test/seed-workspace-viewer";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/integrations/new",
  useSearchParams: () => new URLSearchParams("service=makeshop"),
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

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: vi.fn(),
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

const NAME_TAKEN_SENTENCE =
  "An integration with this name already exists. Enter a different name.";

/** 전역 예외 필터가 감싼 409 응답. */
function conflict(code: string, message: string) {
  return Object.assign(new Error("Request failed with status code 409"), {
    response: { status: 409, data: { error: { code, message } } },
  });
}

async function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

async function beginMakeshop() {
  const user = userEvent.setup();
  await renderPage();
  await screen.findByLabelText(/Client ID/);
  await user.type(document.getElementById("int-name")!, "My Shop");
  await user.type(document.getElementById("makeshop-client-id")!, "cid");
  await user.type(document.getElementById("makeshop-client-secret")!, "secret");
  await user.click(screen.getByRole("button", { name: "Connect with MakeShop" }));
  return user;
}

describe("/integrations/new — begin 의 이름 충돌", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    seedWorkspaceViewer("editor");
    servicesMock.mockResolvedValue([MAKESHOP_SERVICE]);
  });
  afterEach(() => cleanup());

  it("409 INTEGRATION_NAME_TAKEN 이면 이름 칸에 알리고 설치 단계로 넘어가지 않는다", async () => {
    oauthBeginMock.mockRejectedValue(
      conflict("INTEGRATION_NAME_TAKEN", "Integration name already exists"),
    );
    await beginMakeshop();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(NAME_TAKEN_SENTENCE);
    const nameInput = document.getElementById("int-name")!;
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAttribute("aria-describedby", alert.id);
    expect(toastErrorMock).toHaveBeenCalledWith(
      `${NAME_TAKEN_SENTENCE} (Integration name already exists)`,
    );
    // 설치 단계(App URL 안내)로 넘어가지 않고 추가 양식이 남는다.
    expect(nameInput).toHaveValue("My Shop");
  });

  it("이름을 고치면 이름 칸의 오류를 지운다", async () => {
    oauthBeginMock.mockRejectedValue(
      conflict("INTEGRATION_NAME_TAKEN", "Integration name already exists"),
    );
    const user = await beginMakeshop();
    await screen.findByRole("alert");

    await user.type(document.getElementById("int-name")!, " 2");

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(document.getElementById("int-name")).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("이름 충돌이 아닌 409 는 이름 칸에 알리지 않는다", async () => {
    oauthBeginMock.mockRejectedValue(
      conflict("MAKESHOP_INSTALL_PENDING", "Install pending"),
    );
    await beginMakeshop();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
    expect(screen.queryByText(NAME_TAKEN_SENTENCE)).toBeNull();
    expect(document.getElementById("int-name")).not.toHaveAttribute(
      "aria-invalid",
    );
  });
});
