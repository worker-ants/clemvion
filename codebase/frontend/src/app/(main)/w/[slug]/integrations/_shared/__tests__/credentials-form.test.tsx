/**
 * 자격 증명 폼의 필드 설명 — NERV Task CLE-T-JDSC37.
 *
 * 선택형(enum) 필드도 레지스트리의 `description` 을 보여 준다. Email (SMTP) 의 `secure: none`
 * 위험 안내가 이 설명으로 나간다(CLE-INT-AUTH 「Email (SMTP)」).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CredentialsForm } from "../credentials-form";
import type { AuthVariant } from "@/lib/api/integrations";

afterEach(() => {
  cleanup();
});

function variant(description?: string): AuthVariant {
  return {
    authType: "smtp",
    label: "SMTP",
    fields: [
      {
        key: "secure",
        label: "Security",
        type: "enum",
        required: true,
        enum: ["none", "starttls", "tls"],
        default: "starttls",
        description,
      },
    ],
  };
}

describe("CredentialsForm — 선택형 필드 설명", () => {
  it("선택형 필드 아래에 description 을 보여 준다", () => {
    render(
      <CredentialsForm
        variant={variant("none 은 TLS 를 강제하지 않아요.")}
        values={{}}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/Security/)).toBeTruthy();
    expect(screen.getByText("none 은 TLS 를 강제하지 않아요.")).toBeTruthy();
  });

  it("description 이 없으면 설명 줄을 만들지 않는다", () => {
    const { container } = render(
      <CredentialsForm variant={variant()} values={{}} onChange={() => {}} />,
    );
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });
});
