/**
 * Authentication 설정 생성 폼 — §A.2 신규 입력(IP Whitelist · API Key Header 이름)의
 * POST 페이로드 매핑 검증. apiClient/role-gate 를 mock 으로 격리한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
const patchMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...a: unknown[]) => getMock(...a),
    post: (...a: unknown[]) => postMock(...a),
    patch: (...a: unknown[]) => patchMock(...a),
    delete: vi.fn(),
  },
}));

// 기본 admin=true. 일부 테스트가 비-admin 가드를 검증하려고 토글한다.
const roleState = vi.hoisted(() => ({ isAdmin: true }));
vi.mock("@/components/auth/role-gate", () => ({
  useHasRole: () => roleState.isAdmin,
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (m: string) => toastError(m) },
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
  // Wait for the api_key-conditional header field to render before proceeding.
  await waitFor(() =>
    expect(screen.getByLabelText("Header name")).toBeInTheDocument(),
  );
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

  afterEach(() => {
    cleanup();
    // 전역 Zustand locale store 를 기본값으로 되돌려 타 테스트 파일 오염 방지.
    useLocaleStore.setState({ locale: "en" });
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

  it("blocks submission and shows an error when the IP whitelist has an invalid entry", async () => {
    renderPage();
    await openDialogAsApiKey();

    fireEvent.change(screen.getByLabelText(/IP whitelist/i), {
      target: { value: "10.0.0.0/8\nnot-an-ip" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // The error names the offending entry (regression guard for the i18n message).
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining("not-an-ip"),
    );
    // Validation runs before the request — nothing is sent to the backend.
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe("AuthenticationPage — edit form §A.2", () => {
  const existing = {
    id: "c1",
    name: "Prod Key",
    type: "api_key",
    isActive: true,
    // 마스킹된 목록 응답: headerName 평문, key 는 `***last4`.
    config: { headerName: "X-Old", key: "wfk_***1234" },
    ipWhitelist: ["10.0.0.0/8"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    getMock.mockResolvedValue({ data: { data: [existing] } });
    patchMock.mockResolvedValue({ data: { data: {} } });
  });

  afterEach(() => {
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    roleState.isAdmin = true;
  });

  it("hides the Edit button for non-admins (backend @Roles('admin') parity)", async () => {
    roleState.isAdmin = false;
    renderPage();
    // Row renders, but admin-only actions (Edit/Reveal) are gated out.
    await waitFor(() => expect(screen.getByText("Prod Key")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: /^Edit$/ }),
    ).not.toBeInTheDocument();
  });

  async function openEditDialog() {
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Edit$/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));
    await waitFor(() =>
      expect(screen.getByText("Edit Auth Config")).toBeInTheDocument(),
    );
  }

  it("pre-populates the form from the masked config (header + IP whitelist)", async () => {
    renderPage();
    await openEditDialog();

    expect(screen.getByLabelText("Header name")).toHaveValue("X-Old");
    expect(screen.getByLabelText(/IP whitelist/i)).toHaveValue("10.0.0.0/8");
    // Type is locked in edit mode.
    expect(screen.getByLabelText("Type")).toBeDisabled();
  });

  it("PATCHes only name + non-secret config + ipWhitelist (no secret, no type)", async () => {
    renderPage();
    await openEditDialog();

    const headerInput = screen.getByLabelText("Header name");
    await userEvent.clear(headerInput);
    await userEvent.type(headerInput, "X-New");
    fireEvent.change(screen.getByLabelText(/IP whitelist/i), {
      target: { value: "192.168.0.0/16" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    expect(patchMock).toHaveBeenCalledWith("/auth-configs/c1", {
      name: "Prod Key",
      config: { headerName: "X-New" },
      ipWhitelist: ["192.168.0.0/16"],
    });
  });

  it("sends an empty ipWhitelist array to clear all entries", async () => {
    renderPage();
    await openEditDialog();

    fireEvent.change(screen.getByLabelText(/IP whitelist/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() => expect(patchMock).toHaveBeenCalled());
    const body = patchMock.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(body.ipWhitelist).toEqual([]);
  });
});
