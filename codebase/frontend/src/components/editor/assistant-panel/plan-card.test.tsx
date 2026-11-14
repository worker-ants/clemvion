import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PlanCard } from "./plan-card";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { ko } from "@/lib/i18n/dict/ko";
import type { AssistantPlanCard } from "@/lib/stores/assistant-store";

function makePlan(title: string): AssistantPlanCard {
  return {
    messageId: "m-1",
    planId: "p-1",
    title,
    summary: "",
    steps: [{ id: "s-1", description: "노드 추가", status: "pending" }],
    approved: false,
  } as AssistantPlanCard;
}

describe("PlanCard title", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
  });
  afterEach(() => cleanup());

  it("shows only the card title when plan.title is empty", () => {
    const { container } = render(
      <PlanCard plan={makePlan("")} onApprove={vi.fn()} canApprove />,
    );
    expect(screen.getByText(ko.assistant.planCardTitle)).toBeDefined();
    expect(container.querySelector(".text-sm.font-semibold")).toBeNull();
  });

  it("shows plan.title together with the card title when present", () => {
    render(
      <PlanCard plan={makePlan("메일 발송 흐름")} onApprove={vi.fn()} canApprove />,
    );
    expect(screen.getByText(ko.assistant.planCardTitle)).toBeDefined();
    expect(screen.getByText("메일 발송 흐름")).toBeDefined();
  });
});
