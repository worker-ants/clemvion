import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import MainError from "../error";
import { buildLoginHref } from "@/lib/auth/post-login-redirect";

const mockReplace = vi.fn();
let mockPathname = "/workflows/abc";
let mockSearch = "";
// error.tsx 가 지금 화면의 경로와 쿼리로 로그인 화면 경로를 만들므로 mock 한다.
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

function httpError(status: number): Error & { digest?: string } {
  return Object.assign(new Error("boom"), {
    response: { status },
  }) as Error & { digest?: string };
}

beforeEach(() => {
  mockReplace.mockClear();
  mockPathname = "/workflows/abc";
  mockSearch = "";
});

describe("(main)/error.tsx", () => {
  it("redirects 401 to /login (사이드바 없는 경로) — REQ-ERRPAGE-005", async () => {
    const { container } = render(
      <MainError error={httpError(401)} reset={vi.fn()} />,
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(buildLoginHref("/workflows/abc")),
    );
    // redirect 중에는 (main) 사이드바와 함께 렌더하지 않는다.
    expect(container).toBeEmptyDOMElement();
  });

  // 쿼리가 화면을 정하는 경로(초대 수락 페이지의 `?token=`)는 쿼리가 빠지면 로그인 뒤 다른 화면이 된다.
  it("401 redirect 는 경로와 쿼리를 함께 복귀 경로로 담는다", async () => {
    mockPathname = "/invitations/accept";
    mockSearch = "token=abc%2B1";
    render(<MainError error={httpError(401)} reset={vi.fn()} />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        buildLoginHref("/invitations/accept?token=abc%2B1"),
      ),
    );
  });

  it("401 redirect 의 redirect 대상은 unsafe pathname 이면 /dashboard 로 폴백 (open-redirect 방지)", async () => {
    mockPathname = "//evil.com";
    mockSearch = "q=1";
    render(<MainError error={httpError(401)} reset={vi.fn()} />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(buildLoginHref("/dashboard")),
    );
  });

  it("renders the forbidden page in place for 403 (no redirect)", () => {
    const { getByText } = render(
      <MainError error={httpError(403)} reset={vi.fn()} />,
    );
    expect(mockReplace).not.toHaveBeenCalled();
    expect(getByText("접근 권한이 없습니다")).toBeInTheDocument();
  });

  it("maps a generic throw to the server error page", () => {
    const { getByText } = render(
      <MainError error={new Error("unexpected")} reset={vi.fn()} />,
    );
    expect(mockReplace).not.toHaveBeenCalled();
    expect(getByText("문제가 발생했습니다")).toBeInTheDocument();
  });
});
