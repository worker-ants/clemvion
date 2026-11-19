import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ko } from "@/lib/i18n/dict/ko";

vi.mock("@/lib/i18n", async () => {
  const { ko } = await import("@/lib/i18n/dict/ko");
  const tFromKo = (key: string): string => {
    const parts = key.split(".");
    let cur: unknown = ko;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : key;
  };
  return { useT: () => tFromKo, useLocale: () => "ko" as const };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";
import type { TFunction } from "@/lib/i18n";
import { MIN_ACCOUNT_PASSWORD_LENGTH } from "@/lib/utils/password";
import {
  PasswordConfirmField,
  confirmPasswordOrToast,
} from "../password-confirm-field";

const security = ko.profile.security;

// 계정 비밀번호 재확인 입력 공용화(NERV Task `CLE-T-CJ7HB1`).
describe("PasswordConfirmField", () => {
  it("라벨이 있으면 라벨로 찾을 수 있는 비밀번호 입력을 그린다", () => {
    render(
      <PasswordConfirmField
        id="pw"
        label="계정 비밀번호"
        value=""
        onChange={() => undefined}
      />,
    );

    const input = screen.getByLabelText("계정 비밀번호");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(input).toHaveAttribute(
      "placeholder",
      security.accountPasswordPlaceholder,
    );
  });

  it("라벨이 없으면 입력만 그린다", () => {
    const { container } = render(
      <PasswordConfirmField value="" onChange={() => undefined} />,
    );

    expect(container.querySelector("label")).toBeNull();
    expect(
      screen.getByPlaceholderText(security.accountPasswordPlaceholder),
    ).toHaveAttribute("type", "password");
  });

  it("입력한 값을 문자열로 넘긴다", () => {
    const onChange = vi.fn();
    render(<PasswordConfirmField value="" onChange={onChange} />);

    fireEvent.change(
      screen.getByPlaceholderText(security.accountPasswordPlaceholder),
      { target: { value: "secret-pw" } },
    );

    expect(onChange).toHaveBeenCalledWith("secret-pw");
  });
});

describe("confirmPasswordOrToast", () => {
  const t = ((key: string) => key) as unknown as TFunction;

  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("최소 길이보다 짧으면 안내하고 false 다", () => {
    expect(
      confirmPasswordOrToast("x".repeat(MIN_ACCOUNT_PASSWORD_LENGTH - 1), t),
    ).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "profile.security.passwordRequired",
    );
  });

  it("최소 길이면 안내 없이 true 다", () => {
    expect(
      confirmPasswordOrToast("x".repeat(MIN_ACCOUNT_PASSWORD_LENGTH), t),
    ).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
