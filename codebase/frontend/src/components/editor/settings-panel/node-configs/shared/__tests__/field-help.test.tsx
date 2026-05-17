import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldHelp, LabelWithHelp } from "../field-help";

describe("FieldHelp", () => {
  it("도움말 트리거에 aria-label이 붙어있어요", () => {
    render(<FieldHelp summary="필드 설명이에요" />);
    expect(screen.getByLabelText("도움말")).toBeInTheDocument();
  });

  it("클릭하면 summary가 노출돼요", async () => {
    const user = userEvent.setup();
    render(<FieldHelp summary="테스트 설명" />);
    await user.click(screen.getByLabelText("도움말"));
    expect(await screen.findByText("테스트 설명")).toBeInTheDocument();
  });

  it("docsHref가 주어지면 새 탭으로 여는 링크를 표시해요", async () => {
    const user = userEvent.setup();
    render(<FieldHelp summary="설명" docsHref="/docs/02-nodes/ai" />);
    await user.click(screen.getByLabelText("도움말"));
    const link = await screen.findByRole("link", { name: /자세히 보기/ });
    expect(link).toHaveAttribute("href", "/docs/02-nodes/ai");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("docsHref가 없으면 링크를 렌더하지 않아요", async () => {
    const user = userEvent.setup();
    render(<FieldHelp summary="설명" />);
    await user.click(screen.getByLabelText("도움말"));
    await screen.findByText("설명");
    expect(screen.queryByRole("link", { name: /자세히 보기/ })).toBeNull();
  });
});

describe("LabelWithHelp", () => {
  it("텍스트와 도움말 트리거를 함께 렌더해요", () => {
    render(<LabelWithHelp text="프롬프트" help={{ summary: "LLM에 보낼 문장이에요" }} />);
    expect(screen.getByText("프롬프트")).toBeInTheDocument();
    expect(screen.getByLabelText("도움말")).toBeInTheDocument();
  });
});
