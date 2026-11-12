import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DynamicForm } from "./dynamic-form";

// DynamicForm 의 검증 실패 문구 표시(REQ-WCWIDGET-041 · 「명령 실패」 표의 Form 검증 행).
// 서버 400 VALIDATION_ERROR 의 details[] 를 필드 칸 아래에 그리고 입력값은 그대로 둔다.

const CONFIG = {
  fields: [
    { name: "email", label: "이메일", type: "email", required: true },
    { name: "plan", label: "요금제", type: "select", options: ["basic", "pro"] },
  ],
};

describe("DynamicForm — 필드 오류 (fieldErrors)", () => {
  it("fieldErrors 없음 → 오류 문구 · aria-invalid 없음", () => {
    render(<DynamicForm config={CONFIG} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("이메일 *")).not.toHaveAttribute("aria-invalid");
  });

  it("필드 오류는 그 칸 아래에 그리고 aria-invalid · aria-describedby 로 잇는다", () => {
    render(
      <DynamicForm
        config={CONFIG}
        fieldErrors={{ email: "이메일 형식이 아닙니다", plan: "요금제를 고르세요" }}
        onSubmit={vi.fn()}
      />,
    );
    const email = screen.getByLabelText("이메일 *");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("이메일 형식이 아닙니다");
    // 문구는 같은 행(.wc-form-row) 안, 입력 칸 뒤에 있다.
    const row = email.closest(".wc-form-row") as HTMLElement;
    expect(within(row).getByRole("alert")).toHaveTextContent("이메일 형식이 아닙니다");

    const plan = screen.getByLabelText("요금제");
    expect(plan.tagName).toBe("SELECT");
    expect(plan).toHaveAttribute("aria-invalid", "true");
    expect(plan).toHaveAccessibleDescription("요금제를 고르세요");
  });

  it("오류가 없는 필드는 aria-invalid 를 달지 않는다", () => {
    render(<DynamicForm config={CONFIG} fieldErrors={{ email: "형식 오류" }} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("요금제")).not.toHaveAttribute("aria-invalid");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("폼에 없는 필드의 문구는 폼 위에 모아 그린다(버리지 않는다)", () => {
    const { container } = render(
      <DynamicForm config={CONFIG} fieldErrors={{ unknown_field: "알 수 없는 입력입니다" }} onSubmit={vi.fn()} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("알 수 없는 입력입니다");
    // 필드 행 밖, 폼의 첫 자식이다.
    expect(alert.closest(".wc-form-row")).toBeNull();
    expect(container.querySelector("form")?.firstElementChild).toBe(alert);
  });

  it("오류가 도착해도 이미 입력한 값은 남고 다시 제출하면 그 값이 나간다", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<DynamicForm config={CONFIG} onSubmit={onSubmit} />);
    const email = screen.getByLabelText("이메일 *");
    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText("요금제"), { target: { value: "pro" } });

    rerender(<DynamicForm config={CONFIG} fieldErrors={{ email: "이메일 형식이 아닙니다" }} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("이메일 *")).toHaveValue("not-an-email");
    expect(screen.getByLabelText("요금제")).toHaveValue("pro");

    fireEvent.submit(email.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith({ email: "not-an-email", plan: "pro" });
  });
});
