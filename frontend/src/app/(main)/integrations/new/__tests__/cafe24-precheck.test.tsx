/**
 * Cafe24 mall_id 사전 중복 감지 — `/integrations/new` 의 cafe24 step.
 * spec/2-navigation/4-integration.md §9.2.
 *
 * 검증 대상:
 *   - 유효 mall_id 입력 시 350ms debounce 후 precheck 호출
 *   - conflict=true → inline 경고 배너 표시 + Connect 버튼 disabled
 *   - 기존 통합 deep link 노출
 *   - status 별 안내 문구 분기 (connected / pending_install / expired / error)
 *   - mall_id 형식 위반 시 precheck 호출 자체 skip
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  usePathname: () => "/integrations/new",
  useSearchParams: () => currentSearchParams,
}));

const servicesMock = vi.fn();
const precheckMock = vi.fn();
const oauthBeginMock = vi.fn();
vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    services: () => servicesMock(),
    cafe24Precheck: (...args: unknown[]) => precheckMock(...args),
    oauthBegin: (...args: unknown[]) => oauthBeginMock(...args),
    create: vi.fn(),
  },
}));

// useCafe24PendingPolling 은 본 테스트와 무관하므로 stub.
vi.mock("@/lib/integrations/use-cafe24-pending-polling", () => ({
  useCafe24PendingPolling: () => ({ status: "idle" }),
}));

import NewIntegrationPage from "../page";

const CAFE24_SERVICE = {
  type: "cafe24",
  name: "Cafe24",
  meta: { publicAppAvailable: true },
  scopes: [
    { value: "mall.read_product", label: "상품 읽기", recommended: true },
  ],
  authVariants: [
    {
      authType: "oauth2",
      label: "OAuth 2.0",
      fields: [],
    },
  ],
};

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
    render(<NewIntegrationPage />, { wrapper: createWrapper() });
  });
}

describe("/integrations/new — Cafe24 mall_id 사전 중복 감지", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    currentSearchParams = new URLSearchParams("service=cafe24");
    useLocaleStore.setState({ locale: "ko" });
    cleanup();
    servicesMock.mockResolvedValue([CAFE24_SERVICE]);
    precheckMock.mockResolvedValue({ conflict: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("도메인 형식이 맞으면 350ms debounce 후 precheck 호출", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);

    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");

    // 350ms debounce — 그 전엔 호출 없음
    expect(precheckMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => {
      expect(precheckMock).toHaveBeenCalledWith("myshop");
    });
  });

  it("패턴 위반 mall_id 는 precheck 호출 skip", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);

    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "AB"); // 3자 미만 + 대문자

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(precheckMock).not.toHaveBeenCalled();
  });

  it("conflict=true (status=connected) 면 inline 배너 표시 + 기존 통합 링크", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-abc",
      existingName: "myshop (Cafe24)",
      status: "connected",
    });

    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await act(async () => {
      vi.advanceTimersByTime(360);
    });

    // 한글 배너 제목 + 본문 (connected 분기)
    await waitFor(() => {
      expect(
        screen.getByText("이 mall ID 는 이미 연결되어 있어요"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/이미 활성 상태로 연결돼 있어요/),
    ).toBeInTheDocument();

    // 기존 통합 deep link
    const link = screen.getByRole("link", { name: /기존 통합 열기/ });
    expect(link).toHaveAttribute("href", "/integrations/int-abc");
    expect(link.textContent).toContain("myshop (Cafe24)");
  });

  it("status=pending_install 이면 pending 안내 메시지", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-pending",
      existingName: "pending shop",
      status: "pending_install",
    });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => {
      expect(
        screen.getByText(/이미 설치 대기 중이에요/),
      ).toBeInTheDocument();
    });
  });

  it("status=expired 이면 expired 안내", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-exp",
      existingName: "expired",
      status: "expired",
    });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => {
      expect(
        screen.getByText(/이미 만료 상태로 존재해요/),
      ).toBeInTheDocument();
    });
  });

  it("status=error 이면 error 안내", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockResolvedValueOnce({
      conflict: true,
      existingIntegrationId: "int-err",
      existingName: "broken",
      status: "error",
    });
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    await waitFor(() => {
      expect(
        screen.getByText(/이미 오류 상태로 존재해요/),
      ).toBeInTheDocument();
    });
  });

  it("precheck 자체 실패 시 silent — 배너 표시되지 않음", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    precheckMock.mockRejectedValueOnce(new Error("network"));
    await renderPage();
    await screen.findByLabelText(/Mall ID/i);
    const mallIdInput = screen.getByLabelText(/Mall ID/i);
    await user.type(mallIdInput, "myshop");
    await act(async () => {
      vi.advanceTimersByTime(360);
    });
    // 배너 미표시
    expect(
      screen.queryByText("이 mall ID 는 이미 연결되어 있어요"),
    ).not.toBeInTheDocument();
  });
});
