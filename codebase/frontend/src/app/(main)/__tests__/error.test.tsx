import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import MainError from "../error";

const mockReplace = vi.fn();
let mockPathname = "/workflows/abc";
// ErrorPage / error.tsx 가 usePathname 으로 loginHref·redirect 대상을 구성하므로 mock 한다.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

function httpError(status: number): Error & { digest?: string } {
  return Object.assign(new Error("boom"), {
    response: { status },
  }) as Error & { digest?: string };
}

beforeEach(() => {
  mockReplace.mockClear();
  mockPathname = "/workflows/abc";
});

describe("(main)/error.tsx", () => {
  it("redirects 401 to /login (사이드바 없는 경로) — spec §1.3", async () => {
    const { container } = render(
      <MainError error={httpError(401)} reset={vi.fn()} />,
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?redirect=" + encodeURIComponent("/workflows/abc"),
      ),
    );
    // redirect 중에는 (main) 사이드바와 함께 렌더하지 않는다.
    expect(container).toBeEmptyDOMElement();
  });

  it("401 redirect 의 redirect 대상은 unsafe pathname 이면 /dashboard 로 폴백 (open-redirect 방지)", async () => {
    mockPathname = "//evil.com";
    render(<MainError error={httpError(401)} reset={vi.fn()} />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?redirect=" + encodeURIComponent("/dashboard"),
      ),
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
