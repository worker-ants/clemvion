/**
 * `(main)/[...rest]/page.tsx` — slug 없는 경로를 활성 워크스페이스 slug 로 흡수하는
 * catch-all 리다이렉트 테스트. 구 북마크·알림 딥링크·로그인후 `/dashboard` 를
 * `/w/<활성slug>/...` 로 forward 하며 query/hash 를 보존한다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

let mockParams: Record<string, unknown> = {};
const mockReplace = vi.fn();
// notFound() 는 실제 Next 에서 render 중 throw 해 가장 가까운 not-found 바운더리
// (`(main)/not-found.tsx`) 가 잡는다. 테스트에서는 호출 여부만 관측한다.
const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  notFound: () => mockNotFound(),
}));

vi.mock("@/lib/workspace/use-workspaces", () => ({
  useWorkspaces: () => ({}),
}));

let storeState: {
  workspaces: Array<{ id: string; slug: string }>;
  loaded: boolean;
  currentWorkspaceId: string | null;
};
vi.mock("@/lib/stores/workspace-store", () => ({
  useWorkspaceStore: (sel: (s: unknown) => unknown) => sel(storeState),
}));

import WorkspaceRedirect from "../[...rest]/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockParams = { rest: ["workflows"] };
  storeState = {
    workspaces: [{ id: "a", slug: "team-a" }],
    loaded: true,
    currentWorkspaceId: "a",
  };
  window.history.replaceState({}, "", "/workflows");
});

describe("WorkspaceRedirect (catch-all)", () => {
  it("forwards a bare path to the active workspace slug", async () => {
    render(<WorkspaceRedirect />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/w/team-a/workflows"),
    );
  });

  it("forwards a nested notification deep-link (e.g. /integrations/<id>)", async () => {
    mockParams = { rest: ["integrations", "abc123"] };
    window.history.replaceState({}, "", "/integrations/abc123");
    render(<WorkspaceRedirect />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/w/team-a/integrations/abc123"),
    );
  });

  it("preserves the query string when forwarding (e.g. invite accept token)", async () => {
    mockParams = { rest: ["invitations", "accept"] };
    window.history.replaceState({}, "", "/invitations/accept?token=xyz");
    render(<WorkspaceRedirect />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/w/team-a/invitations/accept?token=xyz",
      ),
    );
  });

  it("defaults an empty rest to the workspace dashboard", async () => {
    mockParams = { rest: [] };
    window.history.replaceState({}, "", "/");
    render(<WorkspaceRedirect />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/w/team-a/dashboard"),
    );
  });

  it("does not redirect until workspaces are loaded", () => {
    storeState.loaded = false;
    render(<WorkspaceRedirect />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

/**
 * 이미 `/w/…` 인 경로에 slug 를 **재부착하지 않는다** — 무한 중첩 회귀 가드.
 *
 * 회귀 배경(사용자 보고): 사이드바가 워크스페이스 밖 라우트 `/docs` 에도 slug 를 붙여
 * `/w/team-a/docs` 를 만들었고, `w/[slug]` 하위에 `docs` 가 없어 specific route 매칭에
 * 실패해 이 catch-all 로 떨어졌다. 여기서 slug 를 또 붙이자
 * `/w/team-a/w/team-a/docs` → 또 미매칭 → catch-all 재진입 → 사이클마다 세그먼트가
 * 하나씩 늘어나는 무한 리다이렉트가 됐다.
 *
 * 접두를 떼고 재-forward 하는 대안은 채택하지 않았다: `/w/team-a/nope` → `/nope`
 * → 다시 prefix → `/w/team-a/nope` → … ping-pong 무한루프가 되어 증상만 바뀐다.
 * 그래서 `/w/` 접두 경로는 **terminal** 이다 (dashboard forward 또는 notFound).
 */
describe("WorkspaceRedirect — /w/ 접두 경로는 terminal (무한 중첩 방지)", () => {
  it("존재하지 않는 워크스페이스 스코프 경로(/w/<slug>/docs)는 notFound 로 종결한다", () => {
    mockParams = { rest: ["w", "team-a", "docs"] };
    window.history.replaceState({}, "", "/w/team-a/docs");
    // notFound() 가 render 중 throw 하므로 render 자체가 throw 한다.
    expect(() => render(<WorkspaceRedirect />)).toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
    // 핵심: slug 를 재부착해 forward 하지 않는다.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("이미 이중 중첩된 경로(/w/<slug>/w/<slug>/docs)도 더 늘리지 않고 종결한다", () => {
    // 이 버그로 이미 브라우저 히스토리·북마크에 남은 URL 의 착지 지점.
    mockParams = { rest: ["w", "team-a", "w", "team-a", "docs"] };
    window.history.replaceState({}, "", "/w/team-a/w/team-a/docs");
    expect(() => render(<WorkspaceRedirect />)).toThrow("NEXT_NOT_FOUND");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("워크스페이스 루트(/w/<slug>)는 해당 워크스페이스 dashboard 로 forward 한다", () => {
    // `(main)/w/[slug]/page.tsx` 가 없어 이 경로도 catch-all 로 떨어진다 — 재부착 시
    // `/w/team-a/w/team-a` 로 같은 무한 루프에 빠졌다.
    mockParams = { rest: ["w", "team-b"] };
    window.history.replaceState({}, "", "/w/team-b");
    render(<WorkspaceRedirect />);
    // 활성 워크스페이스(team-a)가 아니라 **URL 의 slug** 를 존중한다 (URL = FE 라우팅 SoT).
    expect(mockReplace).toHaveBeenCalledWith("/w/team-b/dashboard");
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("워크스페이스 루트 forward 시 query·hash 를 보존한다", () => {
    mockParams = { rest: ["w", "team-a"] };
    window.history.replaceState({}, "", "/w/team-a?tab=recent#top");
    render(<WorkspaceRedirect />);
    expect(mockReplace).toHaveBeenCalledWith("/w/team-a/dashboard?tab=recent#top");
  });

  it("/w 단독은 slug 가 없으므로 notFound 로 종결한다", () => {
    mockParams = { rest: ["w"] };
    window.history.replaceState({}, "", "/w");
    expect(() => render(<WorkspaceRedirect />)).toThrow("NEXT_NOT_FOUND");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("워크스페이스 루트 forward 는 store 로드를 기다리지 않는다 (slug 가 URL 에 있으므로)", () => {
    storeState.loaded = false;
    mockParams = { rest: ["w", "team-a"] };
    window.history.replaceState({}, "", "/w/team-a");
    render(<WorkspaceRedirect />);
    expect(mockReplace).toHaveBeenCalledWith("/w/team-a/dashboard");
  });

  it("'w' 로 시작하는 일반 경로(/web-chat)는 영향받지 않는다", () => {
    // 세그먼트 단위 비교라 'web-chat' 은 'w' 와 다르다 — prefix 매칭이었다면 오작동했을 케이스.
    mockParams = { rest: ["web-chat"] };
    window.history.replaceState({}, "", "/web-chat");
    render(<WorkspaceRedirect />);
    expect(mockReplace).toHaveBeenCalledWith("/w/team-a/web-chat");
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
