/**
 * Authentication — create/regenerate 로 1회 노출되는 평문 키(generatedKey)는 30초 후
 * 자동으로 비워지고, 언마운트 시 타이머가 정리되는지 검증. 화면 방치 시 평문 노출
 * 시간을 제한 (reveal 경로의 30초 자동 hide 와 동일 정책, spec/2-navigation/6-config.md §A.4).
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

describe("AuthenticationPage — generatedKey 30초 자동클리어", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
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

    // 29초 시점엔 아직 노출 유지.
    act(() => vi.advanceTimersByTime(29_000));
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
    expect(() => act(() => vi.advanceTimersByTime(30_000))).not.toThrow();
  });
});
