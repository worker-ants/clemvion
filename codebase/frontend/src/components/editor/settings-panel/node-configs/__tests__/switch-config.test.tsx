import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SwitchConfig } from "../logic-configs";
import { useLocaleStore } from "@/lib/stores/locale-store";

// spec/4-nodes/1-logic/2-switch.md §8.1 — switchValue 는 mode=value 시 필수이며
// UI 는 `ui.requiredWhen: { field: 'mode', equals: ['value'] }` 로 asterisk 를 노출한다.
// bespoke SwitchConfig override 가 이 whitelist 를 mode 비교로 재현하는지 검증.
// asterisk 는 ExpressionInput 이 `required` 시 렌더하는 `<span class="text-red-500">*</span>`.
describe("SwitchConfig — switchValue required asterisk (§8.1)", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  it("mode=value 이면 switchValue 에 required asterisk 를 노출한다", () => {
    const { container } = render(
      <SwitchConfig config={{ mode: "value" }} onChange={vi.fn()} />,
    );
    const asterisk = container.querySelector("span.text-red-500");
    expect(asterisk).not.toBeNull();
    expect(asterisk?.textContent).toBe("*");
  });

  it("mode 미지정 시 기본 value 로 간주해 asterisk 를 노출한다", () => {
    const { container } = render(
      <SwitchConfig config={{}} onChange={vi.fn()} />,
    );
    expect(container.querySelector("span.text-red-500")).not.toBeNull();
  });

  it("mode=expression 이면 switchValue asterisk 를 숨긴다", () => {
    const { container } = render(
      <SwitchConfig config={{ mode: "expression" }} onChange={vi.fn()} />,
    );
    expect(container.querySelector("span.text-red-500")).toBeNull();
  });
});
