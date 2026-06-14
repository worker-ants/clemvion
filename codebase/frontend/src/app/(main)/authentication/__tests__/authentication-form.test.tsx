/**
 * Authentication 설정 생성 폼 — §A.2 신규 입력(IP Whitelist · API Key Header 이름)의
 * POST 페이로드 매핑 검증. apiClient/role-gate 를 mock 으로 격리한다.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...a: unknown[]) => getMock(...a),
    post: (...a: unknown[]) => postMock(...a),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/components/auth/role-gate", () => ({
  useHasRole: () => true,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import AuthenticationPage from "../page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthenticationPage />
    </QueryClientProvider>,
  );
}

async function openDialogAsApiKey() {
  fireEvent.click(screen.getByRole("button", { name: /Add Config/i }));
  await userEvent.type(screen.getByLabelText("Name"), "Test Key");
  await userEvent.selectOptions(screen.getByLabelText("Type"), "api_key");
}

describe("AuthenticationPage — create form §A.2 fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    getMock.mockResolvedValue({ data: { data: [] } });
    postMock.mockResolvedValue({
      data: { data: { id: "c1", type: "api_key", config: {} } },
    });
  });

  it("sends a custom api_key header name and parses the IP whitelist into an array", async () => {
    renderPage();
    await openDialogAsApiKey();

    const headerInput = screen.getByLabelText("Header name");
    await userEvent.clear(headerInput);
    await userEvent.type(headerInput, "X-Custom-Key");

    // Blank/whitespace lines must be dropped from the parsed array.
    fireEvent.change(screen.getByLabelText(/IP whitelist/i), {
      target: { value: "10.0.0.0/8\n   \n203.0.113.42\n" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    expect(postMock).toHaveBeenCalledWith("/auth-configs", {
      name: "Test Key",
      type: "api_key",
      config: { headerName: "X-Custom-Key" },
      ipWhitelist: ["10.0.0.0/8", "203.0.113.42"],
    });
  });

  it("defaults the header to X-API-Key and omits ipWhitelist when left empty", async () => {
    renderPage();
    await openDialogAsApiKey();

    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    const body = postMock.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(body.config).toEqual({ headerName: "X-API-Key" });
    expect(body).not.toHaveProperty("ipWhitelist");
  });
});
