import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import {
  useWorkspaceStore,
  type WorkspaceRole,
} from "@/lib/stores/workspace-store";
import type { AuthConfigOption } from "../auth-config-select";

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
    patch: (...args: unknown[]) => apiPatchMock(...args),
    delete: vi.fn(),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { TriggerDetailDrawer } from "../trigger-detail-drawer";

/**
 * "Edit" 버튼은 Overview·Webhook·EIA 카드에 각각 존재한다(라벨 모두 "Edit").
 * 타이틀 텍스트로 카드 헤더(타이틀의 부모 = CardHeader)를 찾아 그 안의 Edit
 * 버튼만 집어, DOM 구조 가정을 이 헬퍼 한 곳으로 격리한다.
 */
function cardEditButton(cardTitle: string): HTMLElement {
  const header = screen.getByText(cardTitle).parentElement;
  if (!header) throw new Error(`card header not found for: ${cardTitle}`);
  return within(header).getByRole("button", { name: "Edit" });
}

type TriggerData = Record<string, unknown> & { id: string; type: string };

const WEBHOOK_TRIGGER: TriggerData = {
  id: "t-1",
  name: "order-hook",
  type: "webhook",
  isActive: true,
  workflowId: "wf-1",
  workflowName: "Order flow",
  endpointPath: "order-abc",
  authConfigId: null,
};

const SCHEDULE_TRIGGER: TriggerData = {
  id: "t-2",
  name: "nightly",
  type: "schedule",
  isActive: false,
  workflowId: "wf-2",
  workflowName: "Nightly job",
  cronExpression: "0 0 * * *",
  timezone: "UTC",
};

/**
 * Routes apiClient.get by URL: trigger detail + auth-configs are the only
 * endpoints the drawer reads. A `/history` call would mean the removed Recent
 * Calls card regressed (case 5).
 */
function mockApi(trigger: TriggerData | null, authConfigs: AuthConfigOption[]) {
  apiGetMock.mockImplementation((url: string) => {
    if (typeof url === "string" && url.startsWith("/auth-configs")) {
      return Promise.resolve({ data: { data: authConfigs } });
    }
    if (trigger && url === `/triggers/${trigger.id}`) {
      return Promise.resolve({ data: { data: trigger } });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function renderDrawer(
  override?: Partial<Parameters<typeof TriggerDetailDrawer>[0]>,
) {
  const triggerId = override?.triggerId ?? "t-1";
  const props = {
    triggerId,
    open: true,
    onClose: vi.fn(),
    ...override,
  } as const;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TriggerDetailDrawer {...props} />
    </QueryClientProvider>,
  );
  return props;
}

function setRole(role: WorkspaceRole) {
  useWorkspaceStore.setState({
    workspaces: [
      { id: "ws-1", name: "Test", type: "team", slug: "team-1", role },
    ],
    currentWorkspaceId: "ws-1",
    loaded: true,
  });
}

describe("TriggerDetailDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.getState().reset();
    setRole("editor");
  });

  // Case 1 — query gated by `!!triggerId && open`.
  it("triggerId=null 이면 API 를 호출하지 않는다", () => {
    mockApi(WEBHOOK_TRIGGER, []);
    renderDrawer({ triggerId: null });
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("open=false 이면 API 를 호출하지 않는다", () => {
    mockApi(WEBHOOK_TRIGGER, []);
    renderDrawer({ open: false });
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  // Case 2 — trigger 미발견(조회 실패) 시 notFound 메시지.
  it("trigger 조회 실패 시 notFound 메시지를 렌더링한다", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.startsWith("/auth-configs")) {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.reject(new Error("not found"));
    });
    renderDrawer({ triggerId: "missing" });
    expect(
      await screen.findByText("Trigger not found."),
    ).toBeInTheDocument();
  });

  // Case 3 — webhook: Webhook + External Interaction 렌더, Schedule 미렌더.
  it("type=webhook 이면 Webhook·External Interaction 카드를 렌더하고 Schedule 카드는 미렌더한다", async () => {
    mockApi(WEBHOOK_TRIGGER, []);
    renderDrawer();
    expect(
      await screen.findByText("Webhook Configuration"),
    ).toBeInTheDocument();
    expect(screen.getByText("External Interaction")).toBeInTheDocument();
    expect(
      screen.queryByText("Schedule Configuration"),
    ).not.toBeInTheDocument();
  });

  // Case 4 — schedule: Schedule 카드만, Webhook 미렌더.
  it("type=schedule 이면 Schedule 카드만 렌더하고 Webhook 카드는 미렌더한다", async () => {
    mockApi(SCHEDULE_TRIGGER, []);
    renderDrawer({ triggerId: "t-2" });
    expect(
      await screen.findByText("Schedule Configuration"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Webhook Configuration"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("External Interaction")).not.toBeInTheDocument();
  });

  // Case 5 — Recent Calls 제거 회귀 가드: /history 호출 없음.
  it("Recent Calls 카드가 제거되어 /history 를 호출하지 않는다", async () => {
    mockApi(WEBHOOK_TRIGGER, []);
    renderDrawer();
    await screen.findByText("Webhook Configuration");
    const historyCalls = apiGetMock.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("/history"),
    );
    expect(historyCalls).toHaveLength(0);
  });

  // Case 6 — AuthConfig selector (inline authType 필드 폐지, R-14).
  it("연결된 AuthConfig 가 read 모드에서 이름·type chip 으로 표시된다", async () => {
    const linked: AuthConfigOption = {
      id: "ac-1",
      name: "Partner HMAC",
      type: "hmac",
    };
    mockApi({ ...WEBHOOK_TRIGGER, authConfigId: "ac-1" }, [linked]);
    renderDrawer();
    expect(
      await screen.findByText(/Partner HMAC · HMAC/),
    ).toBeInTheDocument();
  });

  it("authConfigId 가 없으면 '인증 없음' 배지를 표시한다", async () => {
    mockApi({ ...WEBHOOK_TRIGGER, authConfigId: null }, []);
    renderDrawer();
    await screen.findByText("Webhook Configuration");
    expect(screen.getByText("No authentication")).toBeInTheDocument();
  });

  it("Webhook 편집 모드에서 AuthConfig selector (드롭다운 + 새 인증 설정 링크) 가 노출된다", async () => {
    const linked: AuthConfigOption = {
      id: "ac-1",
      name: "Partner HMAC",
      type: "hmac",
    };
    mockApi({ ...WEBHOOK_TRIGGER, authConfigId: null }, [linked]);
    renderDrawer();
    await screen.findByText("Webhook Configuration");

    fireEvent.click(cardEditButton("Webhook Configuration"));

    await waitFor(() => {
      // 드롭다운 option: "인증 없음" + 등록된 AuthConfig.
      expect(
        screen.getByRole("option", { name: "No authentication" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: /Partner HMAC · HMAC/ }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("+ Create a new auth config"),
    ).toBeInTheDocument();
  });

  // Case 7 — Enabled 배지 i18n.
  it("isActive=true 이면 Active 배지를 렌더한다", async () => {
    mockApi({ ...WEBHOOK_TRIGGER, isActive: true }, []);
    renderDrawer();
    expect(await screen.findByText("Active")).toBeInTheDocument();
  });

  it("isActive=false 이면 Inactive 배지를 렌더한다", async () => {
    mockApi(SCHEDULE_TRIGGER, []);
    renderDrawer({ triggerId: "t-2" });
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
  });

  // W3 — ExternalInteractionCard.handleSave 의 useMutation 전환 검증.
  // (저장 → PATCH 발행 → 성공 시 read 모드 복귀 / 실패 시 edit 모드 유지)
  it("External Interaction 저장 성공 시 PATCH 를 발행하고 read 모드로 복귀한다", async () => {
    mockApi(WEBHOOK_TRIGGER, []);
    apiPatchMock.mockResolvedValueOnce({ data: {} });
    renderDrawer();
    await screen.findByText("External Interaction");

    fireEvent.click(cardEditButton("External Interaction"));
    const eiaHeader = screen.getByText("External Interaction").parentElement!;
    fireEvent.click(within(eiaHeader).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith(
        "/triggers/t-1",
        expect.objectContaining({
          interaction: expect.objectContaining({
            enabled: expect.any(Boolean),
            tokenStrategy: expect.any(String),
          }),
        }),
      );
    });
    expect(toastSuccess).toHaveBeenCalled();
    // read 모드 복귀 → Save 버튼 사라지고 Edit 재노출.
    await waitFor(() => {
      expect(
        within(
          screen.getByText("External Interaction").parentElement!,
        ).queryByRole("button", { name: "Save" }),
      ).not.toBeInTheDocument();
    });
  });

  it("External Interaction 저장 실패 시 error toast 를 띄우고 edit 모드를 유지한다", async () => {
    mockApi(WEBHOOK_TRIGGER, []);
    apiPatchMock.mockRejectedValueOnce(new Error("boom"));
    renderDrawer();
    await screen.findByText("External Interaction");

    fireEvent.click(cardEditButton("External Interaction"));
    const eiaHeader = screen.getByText("External Interaction").parentElement!;
    fireEvent.click(within(eiaHeader).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    // edit 모드 유지 → Save 버튼이 그대로 노출.
    expect(
      within(
        screen.getByText("External Interaction").parentElement!,
      ).getByRole("button", { name: "Save" }),
    ).toBeInTheDocument();
  });
});
