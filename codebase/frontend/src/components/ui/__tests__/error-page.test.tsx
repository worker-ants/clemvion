import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorPage, errorToVariant, isSafeRedirectPath } from "../error-page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workflows/abc",
}));

describe("isSafeRedirectPath", () => {
  it("accepts in-app absolute paths", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
    expect(isSafeRedirectPath("/workflows/abc")).toBe(true);
  });
  it("rejects protocol-relative / external / empty / null paths (open-redirect)", () => {
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
    expect(isSafeRedirectPath("https://evil.com")).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
    expect(isSafeRedirectPath(null)).toBe(false);
  });
});

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

  it("renders forbidden (403) with a dashboard link (spec §1.2)", () => {
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

  it("network retry without onRetry falls back to window.location.reload", () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, reload },
    });
    try {
      render(<ErrorPage variant="network" />);
      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      });
    }
  });

  it("server without onRetry renders only the dashboard link (no retry button)", () => {
    render(<ErrorPage variant="server" />);
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "대시보드로 이동" }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("exposes an alert role for assistive tech", () => {
    render(<ErrorPage variant="notFound" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
