import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { VariablePicker } from "../variable-picker";
import type { ExpressionData } from "../use-expression-context";

function makeData(
  overrides: Partial<ExpressionData> = {},
): ExpressionData {
  return {
    inputFields: [],
    inputSample: {},
    availableNodes: [],
    allNodeKeys: new Set(),
    variables: [],
    functionNames: [],
    isTableContext: false,
    sourceItemSample: null,
    containerScope: { hasLoop: false, hasItem: false },
    ...overrides,
  };
}

function renderPicker(data: ExpressionData) {
  return render(
    <VariablePicker
      expressionData={data}
      onInsert={vi.fn()}
      open={true}
      onOpenChange={vi.fn()}
    />,
  );
}

describe("VariablePicker container scope gating", () => {
  it("hides $loop / $item / $itemIndex when no container scope is active", () => {
    const { getByText, queryByText } = renderPicker(makeData());

    // Expand the Built-in section
    fireEvent.click(getByText("Built-in"));

    expect(queryByText("$loop")).toBeNull();
    expect(queryByText("$item")).toBeNull();
    expect(queryByText("$itemIndex")).toBeNull();
    // Unscoped built-ins stay visible.
    expect(queryByText("$now")).not.toBeNull();
    expect(queryByText("$env")).not.toBeNull();
  });

  it("shows $loop when hasLoop is true", () => {
    const { getByText, queryByText } = renderPicker(
      makeData({ containerScope: { hasLoop: true, hasItem: false } }),
    );
    fireEvent.click(getByText("Built-in"));
    expect(queryByText("$loop")).not.toBeNull();
    expect(queryByText("$item")).toBeNull();
  });

  it("shows $item and $itemIndex when hasItem is true", () => {
    const { getByText, queryByText } = renderPicker(
      makeData({ containerScope: { hasLoop: false, hasItem: true } }),
    );
    fireEvent.click(getByText("Built-in"));
    expect(queryByText("$item")).not.toBeNull();
    expect(queryByText("$itemIndex")).not.toBeNull();
    expect(queryByText("$loop")).toBeNull();
  });

  it("shows all scope variables when both flags are true", () => {
    const { getByText, queryByText } = renderPicker(
      makeData({ containerScope: { hasLoop: true, hasItem: true } }),
    );
    fireEvent.click(getByText("Built-in"));
    expect(queryByText("$loop")).not.toBeNull();
    expect(queryByText("$item")).not.toBeNull();
    expect(queryByText("$itemIndex")).not.toBeNull();
  });
});
