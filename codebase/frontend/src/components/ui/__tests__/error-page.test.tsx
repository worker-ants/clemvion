import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorPage, errorToVariant } from "../error-page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workflows/abc",
}));

describe("errorToVariant", () => {
  it("maps HTTP status → variant per spec §1.3", () => {
    expect(errorToVariant({ response: { status: 401 } })).toBe("sessionExpired");
    expect(errorToVariant({ response: { status: 403 } })).toBe("forbidden");
    expect(errorToVariant({ response: { status: 404 } })).toBe("notFound");
    expect(errorToVariant({ response: { status: 500 } })).toBe("server");
    expect(errorToVariant({ response: { status: 503 } })).toBe("server");
  });

  it("maps no-response / network codes → network", () => {
    expect(errorToVariant({ request: {}, response: undefined })).toBe("network");
    expect(errorToVariant({ code: "ERR_NETWORK" })).toBe("network");
    expect(errorToVariant({ code: "ECONNABORTED" })).toBe("network");
  });

  it("falls back to server for unclassifiable errors", () => {
    expect(errorToVariant(new Error("boom"))).toBe("server");
    expect(errorToVariant(undefined)).toBe("server");
  });

  it("reads a bare `status` field when present", () => {
    expect(errorToVariant({ status: 403 })).toBe("forbidden");
  });
});

describe("ErrorPage", () => {
  it("renders session-expired (401) with a re-login link carrying the redirect", () => {
    render(<ErrorPage variant="sessionExpired" />);
    expect(screen.getByText("세션이 만료되었습니다")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "다시 로그인" });
    expect(link).toHaveAttribute(
      "href",
      "/login?redirect=" + encodeURIComponent("/workflows/abc"),
    );
  });

  it("renders forbidden (403) with a dashboard link", () => {
    render(<ErrorPage variant="forbidden" />);
    expect(screen.getByText("접근 권한이 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "대시보드로 이동" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("renders not-found (404)", () => {
    render(<ErrorPage variant="notFound" />);
    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeInTheDocument();
  });

  it("renders server (500) with a working retry button + dashboard link", () => {
    const onRetry = vi.fn();
    render(<ErrorPage variant="server" onRetry={onRetry} />);
    expect(screen.getByText("문제가 발생했습니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "대시보드로 이동" })).toBeInTheDocument();
  });

  it("renders network error with a retry button calling onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorPage variant="network" onRetry={onRetry} />);
    expect(
      screen.getByText("네트워크에 연결할 수 없습니다"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("exposes an alert role for assistive tech", () => {
    render(<ErrorPage variant="notFound" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
