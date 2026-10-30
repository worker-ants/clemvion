/**
 * 통합 상세 보안 탭 — 재인증 연결부. 재인증 mutation 의 응답 분기(`cafe24_private_pending` · 팝업 · 초기화),
 * 비활성 사유마다의 힌트 문구와 버튼 비활성, Cafe24 Private 전용 안내를 고정한다. 순수 판정 함수는
 * `lib/integrations/__tests__/reauthorize.test.ts` 가 따로 본다. 여기는 그 판정이 화면에 어떻게 이어지는지 본다.
 * NERV CLE-INT-MANAGE · CLE-INT-OAUTH, Task CLE-T-NNENG8.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import type { IntegrationDto, OAuthBeginResult } from "@/lib/api/integrations";
import { useT } from "@/lib/i18n";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";
import { seedWorkspaceViewer } from "@/test/seed-workspace-viewer";

const reauthorizeMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastInfoMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}));
vi.mock("@/lib/api/integrations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/integrations")>(
    "@/lib/api/integrations",
  );
  return {
    ...actual,
    integrationsApi: {
      reauthorize: (...args: unknown[]) => reauthorizeMock(...args),
    },
  };
});

import { SecurityTab } from "../security-tab";

const APP_URL = "https://app.example.com/api/3rd-party/cafe24/install/tok";

function buildIntegration(overrides: Partial<IntegrationDto> = {}): IntegrationDto {
  return {
    id: "int-1",
    workspaceId: "ws-1",
    serviceType: "cafe24",
    name: "My Mall",
    authType: "oauth2",
    credentials: { app_type: "private", mall_id: "demoshop" },
    scope: "personal",
    status: "connected",
    statusReason: null,
    credentialsStatus: "ok",
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    lastError: null,
    autoRefresh: true,
    meta: { appType: "private" },
    appUrl: APP_URL,
    createdBy: "user-1",
    createdAt: "2000-01-01T00:00:00Z",
    updatedAt: "2000-01-01T00:00:00Z",
    ...overrides,
  };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderSecurityTab(
  integration: IntegrationDto,
  onChanged: () => void = vi.fn(),
) {
  function Host() {
    const t = useT();
    return (
      <SecurityTab
        integration={integration}
        variant={undefined}
        onChanged={onChanged}
        t={t}
      />
    );
  }
  render(<Host />, { wrapper: Wrapper });
  return { onChanged };
}

const reauthorizeButton = () => screen.getByRole("button", { name: "Reauthorize" });

describe("SecurityTab — 재인증 연결부", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
    seedWorkspaceViewer("owner");
  });
  afterEach(() => cleanup());

  describe("재인증 응답 분기", () => {
    it("cafe24_private_pending 이면 안내 토스트를 띄우고 onChanged 로 상세를 다시 읽는다 — 팝업은 열지 않는다", async () => {
      const response: OAuthBeginResult = {
        mode: "cafe24_private_pending",
        integrationId: "int-1",
        appUrl: APP_URL,
        callbackUrl: "https://app.example.com/api/3rd-party/cafe24/callback",
      };
      reauthorizeMock.mockResolvedValue(response);
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      const { onChanged } = renderSecurityTab(buildIntegration());
      await userEvent.click(reauthorizeButton());

      await waitFor(() => expect(toastInfoMock).toHaveBeenCalledTimes(1));
      expect(reauthorizeMock).toHaveBeenCalledWith("int-1");
      expect(toastInfoMock).toHaveBeenCalledWith(
        'Click "Test run" in Cafe24 Developers',
      );
      // 서버가 재설치 요청 표시를 저장했으므로 다시 읽어 재설치 대기 안내(`ReinstallRequestedNotice`)를 띄운다.
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(openSpy).not.toHaveBeenCalled();
      expect(toastSuccessMock).not.toHaveBeenCalled();
      expect(toastErrorMock).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it("authUrl 이 있으면 OAuth 팝업을 열고 onChanged 는 부르지 않는다", async () => {
      reauthorizeMock.mockResolvedValue({
        authUrl: "https://oauth.example/authorize",
        state: "s",
      } satisfies OAuthBeginResult);
      const openSpy = vi
        .spyOn(window, "open")
        .mockImplementation(() => ({ closed: false }) as Window);

      const { onChanged } = renderSecurityTab(
        buildIntegration({ serviceType: "google", meta: { appType: null }, appUrl: null }),
      );
      await userEvent.click(reauthorizeButton());

      await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
      expect(toastSuccessMock).toHaveBeenCalledWith("Reauthorization window opened");
      expect(onChanged).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it("authUrl 이 비어 있으면(서버가 상태만 초기화) 초기화 토스트와 onChanged 를 부른다", async () => {
      reauthorizeMock.mockResolvedValue({ authUrl: "", state: "" } satisfies OAuthBeginResult);
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      const { onChanged } = renderSecurityTab(
        buildIntegration({ serviceType: "google", meta: { appType: null }, appUrl: null }),
      );
      await userEvent.click(reauthorizeButton());

      await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Integration reset"));
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it("재인증 요청이 실패하면 오류 토스트를 띄우고 onChanged 는 부르지 않는다", async () => {
      reauthorizeMock.mockRejectedValue(new Error("500"));
      const { onChanged } = renderSecurityTab(buildIntegration());
      await userEvent.click(reauthorizeButton());

      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith("Failed to start reauthorization"),
      );
      expect(onChanged).not.toHaveBeenCalled();
    });
  });

  describe("비활성 사유마다 힌트 문구와 버튼 비활성", () => {
    /** 사유별 문구의 식별 구절 — 다른 사유의 문구가 섞이면 이 표가 깨진다(키 매핑이 틀린 경우를 잡는다). */
    const HINTS = {
      pending_install: /hasn't finished installing/,
      // 만료된 설치 대기 행은 상점 자리를 놓으므로 지우지 않아도 다시 등록할 수 있다(CLE-T-395HK2).
      install_timeout:
        /expired because the install timed out.*register the same store again without deleting this one/,
      no_app_url: /has no App URL, so a reinstall can't be requested/,
      makeshop: /MakeShop integrations can't be reauthorized/,
    } as const;

    const CASES: [keyof typeof HINTS, Partial<IntegrationDto>][] = [
      ["pending_install", { status: "pending_install" }],
      [
        "install_timeout",
        { status: "expired", statusReason: "install_timeout", appUrl: null },
      ],
      ["no_app_url", { status: "connected", appUrl: null }],
      [
        "makeshop",
        { serviceType: "makeshop", meta: { appType: null }, appUrl: null },
      ],
    ];

    it.each(CASES)("%s — 버튼이 비활성이고 그 사유의 문구만 보인다", async (reason, overrides) => {
      renderSecurityTab(buildIntegration(overrides));

      const button = reauthorizeButton();
      expect(button).toBeDisabled();
      const hint = screen.getByText(HINTS[reason]);
      expect(hint).toBeInTheDocument();
      // 같은 문구가 버튼 title 로도 간다.
      expect(button).toHaveAttribute("title", hint.textContent ?? "");
      for (const [other, pattern] of Object.entries(HINTS)) {
        if (other !== reason) expect(screen.queryByText(pattern)).toBeNull();
      }

      await userEvent.click(button);
      expect(reauthorizeMock).not.toHaveBeenCalled();
    });

    it("App URL 이 있는 Cafe24 Private 은 활성이고 비활성 힌트가 없다", () => {
      renderSecurityTab(buildIntegration());
      expect(reauthorizeButton()).toBeEnabled();
      for (const pattern of Object.values(HINTS)) {
        expect(screen.queryByText(pattern)).toBeNull();
      }
    });
  });

  describe("재인증 설명 문구", () => {
    it("Cafe24 Private 에서만 재설치 요청 안내를 쓴다", () => {
      renderSecurityTab(buildIntegration());
      expect(
        screen.getByText(/Request a reinstall, then click "Test run" in Cafe24 Developers/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Open the provider in a new window/)).toBeNull();
    });

    it.each([
      ["Cafe24 Public", { meta: { appType: "public" as const }, appUrl: null }],
      ["Google", { serviceType: "google", meta: { appType: null }, appUrl: null }],
    ])("%s 는 일반 재인증 안내를 쓴다", (_name, overrides) => {
      renderSecurityTab(buildIntegration(overrides));
      expect(screen.getByText(/Open the provider in a new window/)).toBeInTheDocument();
      expect(screen.queryByText(/Request a reinstall/)).toBeNull();
    });
  });

  it("OAuth 가 아닌 통합은 재인증 대신 자격 증명 교체를 보여 준다", async () => {
    await act(async () => {
      renderSecurityTab(
        buildIntegration({
          authType: "api_key",
          serviceType: "http",
          meta: { appType: null },
          appUrl: null,
        }),
      );
    });
    expect(screen.queryByRole("button", { name: "Reauthorize" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rotate" })).toBeInTheDocument();
  });
});

/*
 * 재인증 · 자격 증명 교체는 바꿀 수 있는 사람에게만 보인다 — NERV CLE-INT-MANAGE 「권한」 표, Task CLE-T-EDQYGH.
 * 조직 통합은 관리자 이상, 개인 통합은 만든 사람이 편집자 이상일 때다.
 */
describe("SecurityTab — 역할과 통합 소유에 따른 표시", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
  });
  afterEach(() => cleanup());

  const CASES: [string, WorkspaceRole, Partial<IntegrationDto>, boolean][] = [
    ["조직 통합 · 편집자", "editor", { scope: "organization" }, false],
    ["조직 통합 · 관리자", "admin", { scope: "organization" }, true],
    ["자기 개인 통합 · 뷰어", "viewer", { scope: "personal" }, false],
    ["자기 개인 통합 · 편집자", "editor", { scope: "personal" }, true],
    [
      "남의 개인 통합 · 소유자",
      "owner",
      { scope: "personal", createdBy: "user-other" },
      false,
    ],
  ];

  it.each(CASES)("재인증 — %s", (_label, role, overrides, visible) => {
    seedWorkspaceViewer(role);
    renderSecurityTab(buildIntegration(overrides));
    expect(screen.queryByRole("button", { name: "Reauthorize" }) !== null).toBe(
      visible,
    );
  });

  it.each(CASES)("자격 증명 교체 — %s", async (_label, role, overrides, visible) => {
    seedWorkspaceViewer(role);
    await act(async () => {
      renderSecurityTab(
        buildIntegration({
          authType: "api_key",
          serviceType: "http",
          meta: { appType: null },
          appUrl: null,
          ...overrides,
        }),
      );
    });
    expect(screen.queryByRole("button", { name: "Rotate" }) !== null).toBe(
      visible,
    );
  });
});
