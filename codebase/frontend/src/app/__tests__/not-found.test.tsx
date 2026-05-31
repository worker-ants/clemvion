import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RootNotFound from "../not-found";
import MainNotFound from "../(main)/not-found";

vi.mock("next/navigation", () => ({
  usePathname: () => "/missing",
}));

describe("not-found route files", () => {
  it("root not-found renders the 404 error page", () => {
    render(<RootNotFound />);
    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeInTheDocument();
  });

  it("(main) not-found renders the 404 error page (사이드바 유지 경로)", () => {
    render(<MainNotFound />);
    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeInTheDocument();
  });
});
