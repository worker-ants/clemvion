import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import MainError from "../error";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/workflows/abc",
}));

function httpError(status: number): Error & { digest?: string } {
  return Object.assign(new Error("boom"), {
    response: { status },
  }) as Error & { digest?: string };
}

beforeEach(() => mockReplace.mockClear());

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
