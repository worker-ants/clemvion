import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  act,
  cleanup,
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
    removeMember: vi.fn(),
  },
}));

import WorkspaceSettingsPage from "../page";

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

async function openMembersTab() {
  await act(async () => {
    render(<WorkspaceSettingsPage />, { wrapper: createWrapper() });
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: ko.workspace.tabMembers }));
  await screen.findByText("Adam Admin");
}

function optionValues(select: HTMLElement): string[] {
  return Array.from((select as HTMLSelectElement).options).map((o) => o.value);
}

function memberRow(name: string): HTMLElement {
  const row = screen.getByText(name).closest("tr");
  if (!row) throw new Error(`row for ${name} not found`);
  return row;
}

// 관리자 역할을 주거나 거두는 일은 소유자만 할 수 있다. 관리자는 편집자 · 뷰어 사이만 바꾼다
// (NERV CLE-ACCT-WS, CLE-T-0W7CA7).
describe("WorkspaceSettingsPage 멤버 탭 관리자 역할 권한", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "ko" });
  });

  it("관리자가 보면 초대 역할에 관리자가 없고 기본값은 편집자다", async () => {
    setRole("admin");
    await openMembersTab();
    const select = screen.getByLabelText(ko.workspace.inviteRole);
    expect(optionValues(select)).toEqual(["editor", "viewer"]);
    expect(select).toHaveValue("editor");
    expect(
      screen.getByText(ko.workspace.adminRoleOwnerOnly),
    ).toBeInTheDocument();
  });

  it("관리자가 보면 관리자 멤버의 역할은 바꿀 수 없다", async () => {
    setRole("admin");
    await openMembersTab();
    const adminRow = memberRow("Adam Admin");
    expect(within(adminRow).queryByRole("combobox")).toBeNull();
    expect(within(adminRow).getByText(ko.workspace.roleAdmin)).toBeInTheDocument();
  });

  it("관리자가 보면 다른 멤버의 역할 선택지에 관리자가 없다", async () => {
    setRole("admin");
    await openMembersTab();
    const editorSelect = within(memberRow("Eddie Editor")).getByRole("combobox");
    expect(optionValues(editorSelect)).toEqual(["editor", "viewer"]);
    expect(editorSelect).toHaveValue("editor");
  });

  it("소유자가 보면 초대와 멤버 역할에서 관리자를 고를 수 있다", async () => {
    setRole("owner");
    await openMembersTab();
    expect(optionValues(screen.getByLabelText(ko.workspace.inviteRole))).toEqual(
      ["admin", "editor", "viewer"],
    );
    const adminSelect = within(memberRow("Adam Admin")).getByRole("combobox");
    expect(optionValues(adminSelect)).toEqual(["admin", "editor", "viewer"]);
    expect(adminSelect).toHaveValue("admin");
    expect(
      within(memberRow("Eddie Editor")).getByRole("combobox"),
    ).toBeInTheDocument();
    expect(screen.queryByText(ko.workspace.adminRoleOwnerOnly)).toBeNull();
  });

  it("소유자 행은 누가 보든 역할을 바꿀 수 없다", async () => {
    setRole("owner");
    await openMembersTab();
    expect(
      within(memberRow("Olivia Owner")).queryByRole("combobox"),
    ).toBeNull();
  });
});
