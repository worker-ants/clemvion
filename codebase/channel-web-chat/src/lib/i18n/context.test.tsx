import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeTranslate } from "./context";
import { I18nProvider, useTranslation } from "./context";

describe("makeTranslate", () => {
  it("locale 별 문자열 반환", () => {
    expect(makeTranslate("ko")("composer.send")).toBe("전송");
    expect(makeTranslate("en")("composer.send")).toBe("Send");
  });

  it("{{name}} 보간", () => {
    expect(makeTranslate("ko")("launcher.unread", { count: 3 })).toBe("읽지 않은 메시지 3개");
    expect(makeTranslate("en")("launcher.unread", { count: 3 })).toBe("3 unread messages");
    expect(makeTranslate("en")("confirm.yesAria", { label: "New chat" })).toBe("Confirm New chat");
  });

  it("params 미제공 시 placeholder 유지(치환 안 함)", () => {
    expect(makeTranslate("en")("launcher.unread")).toBe("{{count}} unread messages");
  });
});

// Provider 로 주입된 locale 을 컴포넌트가 useTranslation 으로 소비.
function Probe() {
  const t = useTranslation();
  return <span>{t("header.newChat")}</span>;
}

describe("I18nProvider + useTranslation", () => {
  it("en Provider → en 문자열", () => {
    render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("New chat")).toBeInTheDocument();
  });

  it("Provider 없이 렌더 → 기본 ko 폴백", () => {
    render(<Probe />);
    expect(screen.getByText("새 대화")).toBeInTheDocument();
  });
});
