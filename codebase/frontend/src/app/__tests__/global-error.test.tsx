import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GlobalError from "../global-error";

// ErrorPage 내부에서 usePathname 으로 loginHref 를 구성하므로 mock 한다.
vi.mock("next/navigation", () => ({
  usePathname: () => "/x",
}));

function httpError(status: number): Error & { digest?: string } {
  return Object.assign(new Error("boom"), {
    response: { status },
  }) as Error & { digest?: string };
}

describe("global-error.tsx (루트 폴백)", () => {
  it("일반 에러를 서버 에러 페이지로 렌더한다", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByText("문제가 발생했습니다")).toBeInTheDocument();
  });

  it("401 도 자동 redirect 없이 제자리에 렌더한다 (루트 폴백 — router 없음)", () => {
    render(<GlobalError error={httpError(401)} reset={vi.fn()} />);
    expect(screen.getByText("세션이 만료되었습니다")).toBeInTheDocument();
  });
});
