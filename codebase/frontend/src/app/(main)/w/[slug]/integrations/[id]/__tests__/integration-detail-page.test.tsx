/**
 * 통합 상세 페이지 — 역할과 통합 소유에 따라 개요 탭의 이름 편집 버튼과 위험 영역 탭을 숨긴다.
 * NERV CLE-INT-MANAGE 「권한」 표, Task CLE-T-EDQYGH. 판정 표는 `_shared/__tests__/integration-permissions.test.ts`
 * 가 따로 본다. 여기는 그 판정이 상세 페이지에 이어지는지 본다.
 */

import { Suspense } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";
import type { IntegrationDto } from "@/lib/api/integrations";
import { seedWorkspaceViewer } from "@/test/seed-workspace-viewer";

const getMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/api/integrations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/integrations")>(
    "@/lib/api/integrations",
  );
  return {
    ...actual,
    integrationsApi: {
      get: (...args: unknown[]) => getMock(...args),
      services: () => Promise.resolve([]),
    },
  };
});

import IntegrationDetailPage from "../page";

function buildIntegration(
  overrides: Partial<IntegrationDto> = {},
): IntegrationDto {
  return {
    id: "int-1",
    workspaceId: "ws-1",
    serviceType: "http",
    name: "My API",
    authType: "api_key",
    credentials: {},
    scope: "personal",
    status: "connected",
    statusReason: null,
    credentialsStatus: "ok",
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    lastError: null,
    autoRefresh: false,
    meta: { appType: null },
    appUrl: null,
    createdBy: "user-1",
    createdAt: "2000-01-01T00:00:00Z",
    updatedAt: "2000-01-01T00:00:00Z",
    ...overrides,
  };
}

async function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
    </QueryClientProvider>
  );
  await act(async () => {
    render(
      <IntegrationDetailPage params={Promise.resolve({ id: "int-1" })} />,
      {
        wrapper,
      },
    );
  });
  await screen.findByRole("heading", { name: "My API" });
}

describe("IntegrationDetailPage — 역할과 통합 소유에 따른 표시", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
  });
  afterEach(() => cleanup());

  it.each([
    // [설명, 역할, 통합, 이름 편집, 위험 영역 탭]
    ["조직 통합 · 편집자", "editor", { scope: "organization" }, false, false],
    ["조직 통합 · 관리자", "admin", { scope: "organization" }, true, true],
    // 뷰어는 자기 개인 통합의 이름을 못 바꾸지만 지울 수는 있어 위험 영역 탭이 남는다.
    ["자기 개인 통합 · 뷰어", "viewer", { scope: "personal" }, false, true],
    ["자기 개인 통합 · 편집자", "editor", { scope: "personal" }, true, true],
    [
      "남의 개인 통합 · 소유자",
      "owner",
      { scope: "personal", createdBy: "user-other" },
      false,
      false,
    ],
  ] as [string, WorkspaceRole, Partial<IntegrationDto>, boolean, boolean][])(
    "%s",
    async (_label, role, overrides, canRename, hasDangerTab) => {
      seedWorkspaceViewer(role);
      getMock.mockResolvedValue(buildIntegration(overrides));
      await renderPage();

      expect(screen.queryByRole("button", { name: "Edit" }) !== null).toBe(
        canRename,
      );
      expect(
        screen.queryByRole("button", { name: "Danger zone" }) !== null,
      ).toBe(hasDangerTab);
      // 연결 테스트는 조회라 누구에게나 보인다.
      expect(
        screen.getByRole("button", { name: "Test connection" }),
      ).toBeInTheDocument();
    },
  );

  it("위험 영역 탭을 보던 중 권한이 사라지면 개요 탭으로 돌아간다", async () => {
    seedWorkspaceViewer("admin");
    getMock.mockResolvedValue(buildIntegration({ scope: "organization" }));
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Danger zone" }));
    expect(
      screen.queryByRole("button", { name: "Test connection" }),
    ).toBeNull();

    // 역할이 편집자로 내려가면 조직 통합의 위험 영역에서 할 수 있는 일이 없다.
    act(() => seedWorkspaceViewer("editor"));

    expect(screen.queryByRole("button", { name: "Danger zone" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Test connection" }),
    ).toBeInTheDocument();
  });
});
