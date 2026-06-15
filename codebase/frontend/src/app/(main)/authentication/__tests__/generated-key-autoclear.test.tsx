/**
 * Authentication — 1회 노출되는 평문(create/regenerate 의 generatedKey, reveal 의
 * revealedSecret)은 30초 후 자동으로 비워지고, 언마운트 시 타이머가 정리되는지 검증.
 * 화면 방치 시 평문 노출 시간을 제한 (단일 정책, spec/2-navigation/6-config.md §A.4).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
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

vi.mock("@/components/auth/role-gate", () => ({ useHasRole: () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AuthenticationPage from "../page";

const PLAINTEXT_KEY = "wfk_secretplaintextvalue1234";
const REVEALED_SECRET = "wft_revealedplaintextvalue5678";
// page.tsx 의 SECRET_AUTOCLEAR_MS 와 동일해야 한다 (자동클리어 경계 검증 기준).
const AUTOCLEAR_MS = 30_000;

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthenticationPage />
    </QueryClientProvider>,
  );
}

async function createApiKeyConfig(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.click(screen.getByRole("button", { name: /Add Config/i }));
  await user.type(screen.getByLabelText("Name"), "Test Key");
  await user.selectOptions(screen.getByLabelText("Type"), "api_key");
  await screen.findByLabelText("Header name");
  fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));
}

describe("AuthenticationPage — generatedKey 30초 자동클리어 (create)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMock.mockResolvedValue({ data: { data: [] } });
    // create 응답에 자동 발급된 평문 key 가 포함 → generatedKey 로 1회 표시된다.
    postMock.mockResolvedValue({
      data: {
        data: { id: "c1", type: "api_key", config: { key: PLAINTEXT_KEY } },
      },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
  });

  it("생성 직후 평문 키를 표시하고 30초 뒤 자동으로 비운다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await createApiKeyConfig(user);

    // 평문 키가 1회 노출된다.
    expect(await screen.findByText(PLAINTEXT_KEY)).toBeInTheDocument();

    // 경계 직전엔 아직 노출 유지.
    act(() => vi.advanceTimersByTime(AUTOCLEAR_MS - 1_000));
    expect(screen.queryByText(PLAINTEXT_KEY)).toBeInTheDocument();

    // 30초 경과 → 자동으로 비워진다.
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByText(PLAINTEXT_KEY)).not.toBeInTheDocument();
  });

  it("언마운트 시 타이머를 정리한다 (clearTimeout 호출, stale clear 방지)", async () => {
    const clearSpy = vi.spyOn(window, "clearTimeout");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = renderPage();
    await createApiKeyConfig(user);
    await screen.findByText(PLAINTEXT_KEY);

    clearSpy.mockClear();
    unmount();
    // effect cleanup 이 30초 타이머를 해제한다.
    expect(clearSpy).toHaveBeenCalled();
    // 언마운트 후 타이머가 만료돼도 setState 가 일어나지 않는다 (에러/경고 없음).
    expect(() => act(() => vi.advanceTimersByTime(AUTOCLEAR_MS))).not.toThrow();
  });
});

describe("AuthenticationPage — revealedSecret 30초 자동클리어 (reveal)", () => {
  const existing = {
    id: "c1",
    name: "Prod Key",
    type: "bearer_token",
    isActive: true,
    config: { token: "wft_***5678" },
    ipWhitelist: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getMock.mockResolvedValue({ data: { data: [existing] } });
    // POST /auth-configs/:id/reveal → 평문 config 1회 응답.
    postMock.mockResolvedValue({
      data: { data: { config: { token: REVEALED_SECRET } } },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
  });

  async function revealSecret(user: ReturnType<typeof userEvent.setup>) {
    // 행 단위 Reveal 트리거(아이콘, aria-label "Reveal") — 다이얼로그 열기 전 유일.
    await screen.findByText("Prod Key");
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    // 비밀번호 확인 다이얼로그 → 입력 후 확인.
    const pwInput = await screen.findByPlaceholderText("Current password");
    await user.type(pwInput, "hunter2");
    // 두 "Reveal" 버튼 중 행 트리거는 아이콘(텍스트 없음), 다이얼로그 확인 버튼은
    // 가시 텍스트 "Reveal" 를 가진다 — 텍스트로 확인 버튼을 식별.
    const confirm = screen
      .getAllByRole("button", { name: "Reveal" })
      .find((b) => b.textContent === "Reveal");
    if (!confirm) throw new Error("reveal 확인 버튼을 찾지 못함");
    fireEvent.click(confirm);
  }

  it("reveal 직후 평문을 표시하고 30초 뒤 자동으로 비운다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await revealSecret(user);

    expect(await screen.findByText(REVEALED_SECRET)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(AUTOCLEAR_MS - 1_000));
    expect(screen.queryByText(REVEALED_SECRET)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByText(REVEALED_SECRET)).not.toBeInTheDocument();
  });

  it("언마운트 시 reveal 타이머를 정리한다 (clearTimeout 호출)", async () => {
    const clearSpy = vi.spyOn(window, "clearTimeout");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = renderPage();
    await revealSecret(user);
    await screen.findByText(REVEALED_SECRET);

    clearSpy.mockClear();
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    expect(() => act(() => vi.advanceTimersByTime(AUTOCLEAR_MS))).not.toThrow();
  });
});
