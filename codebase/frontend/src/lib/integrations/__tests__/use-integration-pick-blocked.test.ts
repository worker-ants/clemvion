import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIntegrationPickBlocked } from "../use-integration-pick-blocked";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useEditorStore } from "@/lib/stores/editor-store";

const org = { scope: "organization", createdBy: "bob" } as const;
const mine = { scope: "personal", createdBy: "alice" } as const;
const others = { scope: "personal", createdBy: "bob" } as const;

function blocked(integration: typeof org | typeof mine | typeof others) {
  const { result } = renderHook(() => useIntegrationPickBlocked());
  return result.current(integration);
}

describe("useIntegrationPickBlocked (REQ-INTMGMT-056)", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: "alice" } as never });
    useEditorStore.setState({ workflowCreatedBy: "alice" });
  });

  it("조직 통합은 작성자가 누구든 막지 않는다", () => {
    useEditorStore.setState({ workflowCreatedBy: "bob" });
    expect(blocked(org)).toBe(false);
  });

  it("지금 사용자가 작성자이면 자기 개인 통합을 막지 않는다", () => {
    expect(blocked(mine)).toBe(false);
  });

  it("지금 사용자가 작성자가 아니면 자기 개인 통합을 막는다", () => {
    useEditorStore.setState({ workflowCreatedBy: "bob" });
    expect(blocked(mine)).toBe(true);
  });

  it("작성자가 지금 사용자여도 남의 개인 통합이면 막는다 (통합 소유자 조건)", () => {
    expect(blocked(others)).toBe(true);
  });

  it("작성자나 지금 사용자를 모르면 거르지 않는다 (권위는 저장 검사)", () => {
    useEditorStore.setState({ workflowCreatedBy: null });
    expect(blocked(mine)).toBe(false);
    useEditorStore.setState({ workflowCreatedBy: "bob" });
    useAuthStore.setState({ user: null });
    expect(blocked(mine)).toBe(false);
  });
});
