import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Composer } from "./composer";

// Composer 단독 단위 테스트 — loading(§R6 AI 응답 중) prop 의 라벨/aria-busy/스피너 + 전송 가드.
// Panel 통합 게이팅은 panel.test.tsx 에서 별도 검증.

describe("Composer — loading 상태 (§R6 AI 응답 중)", () => {
  it("loading=true → 'AI 응답 중' 라벨·aria-busy·스피너, 버튼 비활성", () => {
    render(<Composer loading onSend={vi.fn()} />);
    const btn = screen.getByLabelText("AI 응답 중");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    expect(btn.querySelector(".wc-composer-spinner")).not.toBeNull();
  });

  it("loading=true 시 텍스트가 있어도 전송 차단(onSend 미호출)", () => {
    const onSend = vi.fn();
    render(<Composer loading onSend={onSend} />);
    const input = screen.getByLabelText("메시지 입력");
    fireEvent.change(input, { target: { value: "안녕" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("loading 아님 + 텍스트 → '전송' 라벨·aria-busy 없음·onSend 호출", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const btn = screen.getByLabelText("전송");
    expect(btn).not.toHaveAttribute("aria-busy");
    expect(screen.queryByLabelText("AI 응답 중")).toBeNull();
    const input = screen.getByLabelText("메시지 입력");
    fireEvent.change(input, { target: { value: "보낼말" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSend).toHaveBeenCalledWith("보낼말");
  });

  it("loading 생략(undefined) → '전송' 라벨(하위호환)", () => {
    render(<Composer onSend={vi.fn()} />);
    expect(screen.getByLabelText("전송")).toBeInTheDocument();
    expect(screen.queryByLabelText("AI 응답 중")).toBeNull();
  });

  it("disabled=true → 버튼·입력 비활성('전송' 라벨 유지, 스피너 없음)", () => {
    render(<Composer disabled onSend={vi.fn()} />);
    expect(screen.getByLabelText("메시지 입력")).toBeDisabled();
    const btn = screen.getByLabelText("전송");
    expect(btn).toBeDisabled();
    expect(btn).not.toHaveAttribute("aria-busy");
  });
});
