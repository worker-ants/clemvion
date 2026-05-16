/**
 * Cafe24 App URL 카드의 상세 페이지 노출 검증. spec/2-navigation/4-integration.md
 * §4.2 + Rationale "Cafe24 App URL 상세 페이지 표시" — Cafe24 admin
 * "앱으로 가기" / Cafe24 Developers "테스트 실행" 의 HMAC 검증 실패 에러
 * 페이지가 안내하는 비교 대상이 본 카드다.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useT } from "@/lib/i18n";
import { Cafe24AppUrlCard } from "../cafe24-app-url-card";

const APP_URL =
  "https://app.example.com/api/3rd-party/cafe24/install/AbCdEfGhIjKlMnOpQrStUv";

function RenderShell({ appUrl }: { appUrl: string }) {
  const t = useT();
  return <Cafe24AppUrlCard appUrl={appUrl} t={t} />;
}

describe("Cafe24AppUrlCard", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.resolve(undefined) },
      configurable: true,
    });
  });

  afterEach(() => cleanup());

  it("renders the title, description, App URL value, and Redirect URI value", () => {
    render(<RenderShell appUrl={APP_URL} />);
    // 카드 제목 (i18n 키 cafe24DetailAppUrlTitle)
    expect(screen.getByText("Cafe24 App URL")).toBeInTheDocument();
    // App URL 본문 노출
    expect(screen.getByText(APP_URL)).toBeInTheDocument();
    // Redirect URI 는 App URL 의 path 끝 install/<token> → callback 치환
    expect(
      screen.getByText("https://app.example.com/api/3rd-party/cafe24/callback"),
    ).toBeInTheDocument();
  });

  it("derives Redirect URI by replacing the install/<token> path segment", () => {
    render(
      <RenderShell appUrl="https://other.example/api/3rd-party/cafe24/install/XYZxyz_____1234567890" />,
    );
    expect(
      screen.getByText("https://other.example/api/3rd-party/cafe24/callback"),
    ).toBeInTheDocument();
  });

  it("copies the App URL when the App URL copy button is clicked", async () => {
    const writes: string[] = [];
    const user = userEvent.setup();
    // userEvent.setup() may install its own clipboard fixture — define
    // our spy AFTER setup so the component sees the spy.
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (s: string) => {
          writes.push(s);
          return Promise.resolve(undefined);
        },
      },
      configurable: true,
    });
    render(<RenderShell appUrl={APP_URL} />);

    await user.click(screen.getByTestId("cafe24-app-url-copy"));
    expect(writes).toContain(APP_URL);
  });

  it("copies the Redirect URI when the Redirect URI copy button is clicked", async () => {
    const writes: string[] = [];
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (s: string) => {
          writes.push(s);
          return Promise.resolve(undefined);
        },
      },
      configurable: true,
    });
    render(<RenderShell appUrl={APP_URL} />);

    await user.click(screen.getByTestId("cafe24-redirect-uri-copy"));
    expect(writes).toContain(
      "https://app.example.com/api/3rd-party/cafe24/callback",
    );
  });

  it("renders English copy when locale is en", () => {
    useLocaleStore.setState({ locale: "en" });
    render(<RenderShell appUrl={APP_URL} />);
    // en 사전의 cafe24DetailAppUrlTitle 도 "Cafe24 App URL" 동일 — 변하지 않음
    expect(screen.getByText("Cafe24 App URL")).toBeInTheDocument();
    // en 의 cafe24DetailAppUrlDesc 의 "Cafe24 admin's" 일부 fragment 검증
    expect(
      screen.getByText(/Register this URL as the App URL/i),
    ).toBeInTheDocument();
  });
});
