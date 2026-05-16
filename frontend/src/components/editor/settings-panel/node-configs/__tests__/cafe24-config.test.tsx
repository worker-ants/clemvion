// Unit tests for the Cafe24 settings panel — exercises the local editing
// buffer that backs the `Fields` key-value editor, plus the pure helpers
// that translate between the buffer (`{key, value}[]`) and the persisted
// `Record<string, unknown>` shape the backend handler reads.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

import {
  Cafe24Config,
  fieldRowsToObject,
  normalizeCafe24Fields,
} from "../integration-configs";
import { useLocaleStore } from "@/lib/stores/locale-store";

type Cafe24Initial = Parameters<typeof Cafe24Config>[0]["config"];

function ControlledCafe24({
  initial,
  onChange,
}: {
  initial: Cafe24Initial;
  onChange: (next: Cafe24Initial) => void;
}) {
  const [config, setConfig] = useState<Cafe24Initial>(initial);
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
  const originalLocale = useLocaleStore.getState().locale;
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
  });
  afterEach(() => {
    useLocaleStore.setState({ locale: originalLocale });
  });

  it("adds a new empty row when the Add button is clicked", () => {
    const onChange = vi.fn();
    render(
      <ControlledCafe24
        initial={{ resource: "product", operation: "product_list" }}
        onChange={onChange}
      />,
    );

    expect(screen.queryByPlaceholderText(/shop_no/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
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

    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    const keyInput = screen.getByPlaceholderText(/shop_no/);
    fireEvent.change(keyInput, { target: { value: "shop_no" } });

    const lastCall = onChange.mock.calls.at(-1)?.[0] as
      | { fields?: Record<string, unknown> }
      | undefined;
    expect(lastCall?.fields).toEqual({ shop_no: "" });
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

    expect(screen.getByDisplayValue("shop_no")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    const keyInputs = screen.getAllByPlaceholderText(/shop_no/);
    expect(keyInputs).toHaveLength(2);
    expect(keyInputs[0]).toHaveValue("shop_no");
    expect(keyInputs[1]).toHaveValue("");
  });

  it("removes a row when its Remove row button is clicked", () => {
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

    expect(screen.getAllByPlaceholderText(/shop_no/)).toHaveLength(2);
    const removeButtons = screen.getAllByRole("button", {
      name: /remove row/i,
    });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]);

    expect(screen.getAllByPlaceholderText(/shop_no/)).toHaveLength(1);
    const lastCall = onChange.mock.calls.at(-1)?.[0] as
      | { fields?: Record<string, unknown> }
      | undefined;
    expect(Object.keys(lastCall?.fields ?? {})).toHaveLength(1);
  });

  it("keeps empty rows visible until a key is typed (regression: Add button no-op)", () => {
    const onChange = vi.fn();
    render(
      <ControlledCafe24
        initial={{ resource: "product", operation: "product_list" }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getAllByPlaceholderText(/shop_no/)).toHaveLength(3);
  });

  it("re-syncs the editing buffer when config.fields changes externally (undo/redo)", () => {
    // Stand-alone parent that swaps `config.fields` via a separate control —
    // simulates undo/redo or any programmatic reset.
    function Harness({ external }: { external: Record<string, unknown> }) {
      return (
        <Cafe24Config
          config={{
            resource: "product",
            operation: "product_list",
            fields: external,
          }}
          onChange={vi.fn()}
        />
      );
    }

    const { rerender } = render(
      <Harness external={{ shop_no: "1" }} />,
    );
    expect(screen.getByDisplayValue("shop_no")).toBeInTheDocument();

    // Parent swaps in a different object (different reference, different
    // content) — the editor must re-derive its rows.
    rerender(<Harness external={{ category_no: "42" }} />);
    expect(screen.queryByDisplayValue("shop_no")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("category_no")).toBeInTheDocument();
  });

  it("accepts an array-shaped initial fields value (legacy/migration tolerance)", () => {
    render(
      <ControlledCafe24
        initial={{
          resource: "product",
          operation: "product_list",
          // Older serializations may have stored the editor list directly.
          // `normalizeCafe24Fields` accepts both shapes.
          fields: [
            { key: "shop_no", value: "1" },
            { key: "display", value: "T" },
          ] as unknown as Record<string, unknown>,
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("shop_no")).toBeInTheDocument();
    expect(screen.getByDisplayValue("display")).toBeInTheDocument();
  });
});

describe("normalizeCafe24Fields", () => {
  it("returns an empty list for null / undefined / primitives", () => {
    expect(normalizeCafe24Fields(null)).toEqual([]);
    expect(normalizeCafe24Fields(undefined)).toEqual([]);
    expect(normalizeCafe24Fields("hello")).toEqual([]);
    expect(normalizeCafe24Fields(42)).toEqual([]);
    expect(normalizeCafe24Fields(true)).toEqual([]);
  });

  it("entries an object preserving insertion order", () => {
    expect(
      normalizeCafe24Fields({ shop_no: 1, display: "T", since: null }),
    ).toEqual([
      { key: "shop_no", value: "1" },
      { key: "display", value: "T" },
      { key: "since", value: "" },
    ]);
  });

  it("accepts a list of {key, value} pairs and coerces to strings", () => {
    expect(
      normalizeCafe24Fields([
        { key: "shop_no", value: 1 as unknown as string },
        { key: "display", value: null as unknown as string },
        { key: "since", value: undefined as unknown as string },
      ]),
    ).toEqual([
      { key: "shop_no", value: "1" },
      { key: "display", value: "" },
      { key: "since", value: "" },
    ]);
  });

  it("filters out non-object entries inside an array", () => {
    expect(
      normalizeCafe24Fields([
        { key: "ok", value: "yes" },
        null,
        "garbage",
        { wrong: "shape" },
      ] as unknown[]),
    ).toEqual([{ key: "ok", value: "yes" }]);
  });
});

describe("fieldRowsToObject", () => {
  it("drops empty-key rows (they have no object representation)", () => {
    expect(
      fieldRowsToObject([
        { key: "shop_no", value: "1" },
        { key: "", value: "stray" },
        { key: "display", value: "T" },
      ]),
    ).toEqual({ shop_no: "1", display: "T" });
  });

  it("returns an empty object for an empty list", () => {
    expect(fieldRowsToObject([])).toEqual({});
  });

  it("on duplicate keys the later row wins (last-write-wins)", () => {
    expect(
      fieldRowsToObject([
        { key: "shop_no", value: "1" },
        { key: "shop_no", value: "2" },
      ]),
    ).toEqual({ shop_no: "2" });
  });
});
