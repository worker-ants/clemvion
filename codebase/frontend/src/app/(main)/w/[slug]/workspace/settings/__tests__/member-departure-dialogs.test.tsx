import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  act,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ko } from "@/lib/i18n/dict/ko";
import { useLocaleStore } from "@/lib/stores/locale-store";
import {
  useWorkspaceStore,
  type WorkspaceRole,
} from "@/lib/stores/workspace-store";
import type { WorkspaceMemberSummary } from "@/lib/api/workspaces";

/*
 * 나가기 · 멤버 제거 확인 다이얼로그의 개인 통합 삭제 안내 — REQ-WSPACE-069, NERV Task CLE-T-PS7JQY.
 *
 * 나가거나 제거되면 그 멤버가 이 워크스페이스에 둔 개인 통합도 함께 지워진다. 다이얼로그는 개인 통합이 있는지와 그
 * 개수를 보이지 않고 늘 같은 문장을 보인다. 그래서 다이얼로그는 통합 API 를 부르지 않는다.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
}));

const MEMBERS: WorkspaceMemberSummary[] = [
  {
    id: "m-owner",
    userId: "u-owner",
    email: "owner@example.com",
    name: "Olivia Owner",
    role: "owner",
    joinedAt: null,
  },
  {
    id: "m-admin",
    userId: "u-admin",
    email: "admin@example.com",
    name: "Adam Admin",
    role: "admin",
    joinedAt: null,
  },
  {
    id: "m-editor",
    userId: "u-editor",
    email: "editor@example.com",
    name: "Eddie Editor",
    role: "editor",
    joinedAt: null,
  },
];

const removeMemberMock = vi.fn();
const leaveMock = vi.fn();
vi.mock("@/lib/api/workspaces", () => ({
  workspacesApi: {
    getSettings: vi.fn(() =>
      Promise.resolve({ interactionAllowedOrigins: [], timezone: null }),
    ),
    updateSettings: vi.fn(),
    list: vi.fn(() => Promise.resolve([])),
    listMembers: vi.fn(() => Promise.resolve(MEMBERS)),
    listInvitations: vi.fn(() => Promise.resolve([])),
    invite: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: (...args: unknown[]) => removeMemberMock(...args),
    leave: (...args: unknown[]) => leaveMock(...args),
  },
}));

/** 통합 API 의 어떤 메서드든 부르면 기록한다. 다이얼로그가 개인 통합을 세지 않는지 본다. */
const integrationsApiCalls = vi.fn();
vi.mock("@/lib/api/integrations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/integrations")>(
    "@/lib/api/integrations",
  );
  return {
    ...actual,
    integrationsApi: new Proxy(
      {},
      {
        get:
          (_target, method) =>
          (...args: unknown[]) => {
            integrationsApiCalls(method, ...args);
            return Promise.resolve([]);
          },
      },
    ),
  };
});

import WorkspaceSettingsPage from "../page";

const removeSentence = ko.workspace.removePurgesPersonalIntegrations;
const leaveSentence = ko.workspace.leavePurgesPersonalIntegrations;

afterEach(() => {
  cleanup();
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function setRole(role: WorkspaceRole) {
  useWorkspaceStore.setState({
    workspaces: [{ id: "ws-1", name: "Team", type: "team", slug: "team", role }],
    currentWorkspaceId: "ws-1",
    loaded: true,
  });
}

async function renderPage() {
  await act(async () => {
    render(<WorkspaceSettingsPage />, { wrapper: createWrapper() });
  });
  return userEvent.setup();
}

async function openMembersTab() {
  const user = await renderPage();
  await user.click(screen.getByRole("tab", { name: ko.workspace.tabMembers }));
  await screen.findByText("Adam Admin");
  return user;
}

function removeButtonOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest("tr");
  if (!row) throw new Error(`row for ${name} not found`);
  return within(row).getByTitle(ko.workspace.removeTooltip);
}

describe("멤버 제거 확인 다이얼로그 (REQ-WSPACE-069)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "ko" });
    setRole("owner");
    removeMemberMock.mockResolvedValue(undefined);
  });

  it("휴지통을 누르면 제거 요청 없이 확인 다이얼로그를 띄우고 개인 통합 삭제 문장을 보인다", async () => {
    const user = await openMembersTab();

    await user.click(removeButtonOf("Eddie Editor"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      ko.workspace.removeMemberConfirm.replace("{{name}}", "Eddie Editor"),
    );
    expect(dialog).toHaveTextContent(removeSentence);
    expect(removeMemberMock).not.toHaveBeenCalled();
  });

  it("취소하면 다이얼로그를 닫고 제거하지 않는다", async () => {
    const user = await openMembersTab();
    await user.click(removeButtonOf("Eddie Editor"));
    const dialog = await screen.findByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", { name: ko.common.cancel }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(removeMemberMock).not.toHaveBeenCalled();
  });

  it("확인하면 그 멤버를 제거하고 다이얼로그를 닫는다", async () => {
    const user = await openMembersTab();
    await user.click(removeButtonOf("Eddie Editor"));
    const dialog = await screen.findByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", { name: ko.workspace.removeMemberBtn }),
    );

    await waitFor(() =>
      expect(removeMemberMock).toHaveBeenCalledWith("ws-1", "m-editor"),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("어느 멤버든 같은 문장을 보이고 개인 통합을 조회하지 않는다", async () => {
    const user = await openMembersTab();

    // 다이얼로그 전체 문구에서 멤버 이름만 가려 비교한다. 멤버마다 개수나 목록 같은 문장이 더 붙으면 둘이 달라진다.
    const texts: string[] = [];
    for (const name of ["Adam Admin", "Eddie Editor"]) {
      await user.click(removeButtonOf(name));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(removeSentence)).toBeTruthy();
      texts.push((dialog.textContent ?? "").replace(name, "{{name}}"));
      await user.click(
        within(dialog).getByRole("button", { name: ko.common.cancel }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }

    expect(texts[0]).toContain(removeSentence);
    expect(texts[1]).toBe(texts[0]);
    expect(integrationsApiCalls).not.toHaveBeenCalled();
  });
});

describe("나가기 확인 다이얼로그 (REQ-WSPACE-069)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "ko" });
    setRole("editor");
  });

  it("나가기를 누르면 내 개인 통합도 함께 지워진다는 문장을 보이고 확인 전에는 나가지 않는다", async () => {
    const user = await renderPage();
    await user.click(screen.getByRole("tab", { name: ko.workspace.tabDanger }));

    await user.click(
      screen.getByRole("button", { name: ko.workspace.dangerLeaveBtn }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(ko.workspace.leaveConfirm);
    expect(dialog).toHaveTextContent(leaveSentence);
    expect(leaveMock).not.toHaveBeenCalled();
    expect(integrationsApiCalls).not.toHaveBeenCalled();
  });
});
