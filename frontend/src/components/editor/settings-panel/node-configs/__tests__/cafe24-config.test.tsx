import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";

// IntegrationSelector pulls in react-query + the integrations API; stub it
// so the Cafe24Config test stays focused on the local fields editor.
vi.mock("../integration-selector", () => ({
  IntegrationSelector: ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => (
    <div data-testid="integration-selector" data-value={value}>
      {label}
    </div>
  ),
}));

import { Cafe24Config } from "../integration-configs";
import { useLocaleStore } from "@/lib/stores/locale-store";

function ControlledCafe24({
  initial,
  onChange,
}: {
  initial: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const [config, setConfig] = useState(initial);
  return (
    <Cafe24Config
      config={config}
      onChange={(next) => {
        setConfig(next);
        onChange(next);
      }}
    />
  );
}

describe("Cafe24Config — Fields key-value editor", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
  });

  it("adds a new empty row when the Add button is clicked", () => {
    const onChange = vi.fn();
    render(
      <ControlledCafe24
        initial={{ resource: "product", operation: "product_list" }}
        onChange={onChange}
      />,
    );

    // Initially no field rows — only the "Add" button (placeholder shows on row).
    expect(screen.queryByPlaceholderText(/shop_no/)).not.toBeInTheDocument();

    // Click the editor's Add button. KeyValueEditor renders an "Add" button
    // labeled by the `editor.sharedAdd` i18n key; in the en locale the label
    // is "Add". Restrict the query to the button role to avoid matching
    // other locale strings.
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    // After click, a new editable row appears (key input with the
    // Cafe24-specific placeholder).
    expect(screen.getByPlaceholderText(/shop_no/)).toBeInTheDocument();
  });

  it("persists each row independently and survives a key edit", () => {
    const onChange = vi.fn();
    render(
      <ControlledCafe24
        initial={{ resource: "product", operation: "product_list" }}
        onChange={onChange}
      />,
    );

    // Add a row.
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    const keyInput = screen.getByPlaceholderText(/shop_no/);

    // Type a key — config.fields should now contain that key.
    fireEvent.change(keyInput, { target: { value: "shop_no" } });
    const lastCall = onChange.mock.calls.at(-1)?.[0] as
      | { fields?: Record<string, unknown> }
      | undefined;
    expect(lastCall?.fields).toEqual({ shop_no: "" });

    // Row should still be rendered after the round trip.
    expect(screen.getByDisplayValue("shop_no")).toBeInTheDocument();
  });

  it("adds a second row without clobbering the first one with a typed key", () => {
    const onChange = vi.fn();
    render(
      <ControlledCafe24
        initial={{
          resource: "product",
          operation: "product_list",
          fields: { shop_no: "1" },
        }}
        onChange={onChange}
      />,
    );

    // Existing row is rendered.
    expect(screen.getByDisplayValue("shop_no")).toBeInTheDocument();

    // Click Add — a NEW empty row must appear without losing the first row.
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    // Two key inputs total: one with "shop_no", one empty.
    const keyInputs = screen.getAllByPlaceholderText(/shop_no/);
    expect(keyInputs).toHaveLength(2);
    expect(keyInputs[0]).toHaveValue("shop_no");
    expect(keyInputs[1]).toHaveValue("");
  });

  it("removes a row when the trash button is clicked", () => {
    const onChange = vi.fn();
    render(
      <ControlledCafe24
        initial={{
          resource: "product",
          operation: "product_list",
          fields: { shop_no: "1", display: "T" },
        }}
        onChange={onChange}
      />,
    );

    // Two rows rendered initially.
    expect(screen.getAllByPlaceholderText(/shop_no/)).toHaveLength(2);

    // Locate the first row by its key input, then click the row's own
    // remove button (the icon-only ghost button at the right end of the
    // same horizontal flex container). Filtering buttons by text doesn't
    // work — ExpressionInput cells also render icon-only buttons.
    const firstRowKeyInput = screen.getAllByDisplayValue("shop_no")[0];
    const row = firstRowKeyInput.parentElement!;
    const removeButton = row.querySelector(
      "button:not([data-state])",
    ) as HTMLButtonElement | null;
    // The row layout is [key input, value cell, remove button]; the
    // remove button is the trailing icon button without state attrs.
    const candidateButtons = Array.from(row.querySelectorAll("button"));
    const targetButton = candidateButtons[candidateButtons.length - 1]!;
    expect(targetButton).toBeTruthy();
    fireEvent.click(removeButton ?? targetButton);

    // After removing the first row, only one row remains.
    expect(screen.getAllByPlaceholderText(/shop_no/)).toHaveLength(1);
    const lastCall = onChange.mock.calls.at(-1)?.[0] as
      | { fields?: Record<string, unknown> }
      | undefined;
    expect(Object.keys(lastCall?.fields ?? {})).toHaveLength(1);
  });

  it("keeps the empty row visible until a key is typed (not lost in object conversion)", () => {
    const onChange = vi.fn();
    render(
      <ControlledCafe24
        initial={{ resource: "product", operation: "product_list" }}
        onChange={onChange}
      />,
    );

    // Click Add three times — each click should add one row, regardless of
    // empty-key entries being absent from the persisted object form.
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getAllByPlaceholderText(/shop_no/)).toHaveLength(3);
  });
});
