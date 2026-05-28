// Unit tests for the Cafe24 settings panel — covers the Phase 3 rewrite
// (Resource → Operation select → typed dynamic Fields → conditional
// pagination). The Phase 2 `extras` payload (operations / planned catalog)
// is injected directly into the node-definitions store so the test does
// not depend on the real HTTP endpoint.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";

// IntegrationSelector pulls in react-query + the integrations API; stub it
// so the Cafe24Config test stays focused on Resource/Operation/Fields UX.
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
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type {
  NodeDefinition,
  Cafe24NodeExtras,
} from "@/lib/node-definitions/types";

type Cafe24Initial = Parameters<typeof Cafe24Config>[0]["config"];

const PRODUCT_LIST_OP = {
  status: "supported" as const,
  id: "product_list",
  labelKey: "cafe24.product.product_list",
  description: "List products",
  scope: "read" as const,
  paginated: true,
  requiredFields: ["shop_no"],
  fields: [
    {
      name: "shop_no",
      type: "number" as const,
      location: "query" as const,
      required: true,
      description: "Multi-shop number",
      default: 1,
    },
    {
      name: "display",
      type: "enum" as const,
      location: "query" as const,
      required: false,
      enum: ["T", "F"],
    },
    {
      name: "since",
      type: "string" as const,
      location: "query" as const,
      required: false,
    },
  ],
};

const PRODUCT_GET_OP = {
  status: "supported" as const,
  id: "product_get",
  labelKey: "cafe24.product.product_get",
  description: "Get one product",
  scope: "read" as const,
  paginated: false,
  requiredFields: ["product_no"],
  fields: [
    {
      name: "product_no",
      type: "number" as const,
      location: "path" as const,
      required: true,
    },
    {
      name: "shop_no",
      type: "number" as const,
      location: "query" as const,
      required: false,
      default: 1,
    },
  ],
};

const PLANNED_PRODUCT_COUNT = {
  status: "planned" as const,
  id: "product_count",
  labelKey: "cafe24.product.product_count",
  paginated: false,
};

const FIXTURE_EXTRAS: Cafe24NodeExtras = {
  operationsByResource: {
    product: [PRODUCT_LIST_OP, PRODUCT_GET_OP],
  } as unknown as Cafe24NodeExtras["operationsByResource"],
  plannedByResource: {
    product: [PLANNED_PRODUCT_COUNT],
  } as unknown as Cafe24NodeExtras["plannedByResource"],
};

function seedCafe24NodeDefinition(extras: Cafe24NodeExtras | null) {
  const minimal: NodeDefinition = {
    type: "cafe24",
    category: "integration",
    label: "Cafe24",
    description: "",
    icon: "ShoppingBag",
    color: "#F97316",
    inputs: [],
    outputs: [],
    defaultConfig: {},
    configSchema: {},
    extras: extras as unknown as Record<string, unknown> | undefined,
  };
  useNodeDefinitionsStore.setState({
    definitions: { cafe24: minimal },
    order: ["cafe24"],
    status: "ready",
  });
}

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

describe("Cafe24Config", () => {
  const originalLocale = useLocaleStore.getState().locale;
  const originalDefinitions = useNodeDefinitionsStore.getState();

  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    seedCafe24NodeDefinition(FIXTURE_EXTRAS);
  });

  afterEach(() => {
    useLocaleStore.setState({ locale: originalLocale });
    useNodeDefinitionsStore.setState(originalDefinitions);
  });

  describe("Resource → Operation select wiring", () => {
    it("shows 'select resource first' as the only option when no resource is picked", () => {
      const onChange = vi.fn();
      render(<ControlledCafe24 initial={{}} onChange={onChange} />);

      const opSelect = screen.getAllByRole("combobox")[1];
      // The empty-resource path renders a single disabled placeholder.
      expect(opSelect).toBeInTheDocument();
      expect(opSelect.querySelectorAll("option")).toHaveLength(1);
    });

    it("lists supported + planned operations once a resource is picked", () => {
      const onChange = vi.fn();
      render(
        <ControlledCafe24
          initial={{ resource: "product" }}
          onChange={onChange}
        />,
      );

      // placeholder + 2 supported + 1 planned = 4
      const options = Array.from(
        (screen.getAllByRole("combobox")[1] as HTMLSelectElement).options,
      );
      expect(options).toHaveLength(4);
      const labels = options.map((o) => o.textContent);
      expect(labels).toEqual(
        expect.arrayContaining([
          expect.stringContaining("상품 목록 조회"),
          expect.stringContaining("상품 단건 조회"),
          expect.stringContaining("상품 개수 조회"),
        ]),
      );
    });

    it("marks planned operations as disabled and adds the planned-suffix", () => {
      render(
        <ControlledCafe24
          initial={{ resource: "product" }}
          onChange={vi.fn()}
        />,
      );
      const opSelect = screen.getAllByRole("combobox")[1] as HTMLSelectElement;
      const plannedOpt = Array.from(opSelect.options).find(
        (o) => o.value === "product_count",
      );
      expect(plannedOpt?.disabled).toBe(true);
      expect(plannedOpt?.textContent).toMatch(/지원 예정/);
    });

    it("shows a coverage hint with supported / planned counts", () => {
      render(
        <ControlledCafe24
          initial={{ resource: "product" }}
          onChange={vi.fn()}
        />,
      );
      // FIXTURE_EXTRAS.product: 2 supported, 1 planned
      expect(screen.getByText(/지원 2개/)).toBeInTheDocument();
      expect(screen.getByText(/추후 지원 1개/)).toBeInTheDocument();
    });
  });

  describe("Resource change", () => {
    it("resets operation + fields when the resource changes", () => {
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

      const resourceSelect = screen.getAllByRole(
        "combobox",
      )[0] as HTMLSelectElement;
      fireEvent.change(resourceSelect, { target: { value: "order" } });

      const last = onChange.mock.calls.at(-1)?.[0];
      expect(last).toMatchObject({
        resource: "order",
        operation: "",
        fields: {},
      });
    });
  });

  describe("Operation selection", () => {
    it("renders required + optional field groups for the picked operation", () => {
      render(
        <ControlledCafe24
          initial={{ resource: "product", operation: "product_list" }}
          onChange={vi.fn()}
        />,
      );
      // Required: shop_no
      expect(screen.getByText("shop_no")).toBeInTheDocument();
      // Optional: display, since
      expect(screen.getByText("display")).toBeInTheDocument();
      expect(screen.getByText("since")).toBeInTheDocument();
      // The required header surfaces the section split.
      expect(screen.getByText("필수 필드")).toBeInTheDocument();
      expect(screen.getByText("선택 필드")).toBeInTheDocument();
    });

    it("renders the pagination block only when the operation is paginated", () => {
      // product_list → paginated → Pagination block present.
      const { unmount } = render(
        <ControlledCafe24
          initial={{ resource: "product", operation: "product_list" }}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText(/Limit/)).toBeInTheDocument();
      unmount();

      // product_get → not paginated → no Pagination block.
      render(
        <ControlledCafe24
          initial={{ resource: "product", operation: "product_get" }}
          onChange={vi.fn()}
        />,
      );
      expect(screen.queryByText(/Limit/)).toBeNull();
    });

    it("preserves field values whose key still exists on the new operation", () => {
      const onChange = vi.fn();
      render(
        <ControlledCafe24
          initial={{
            resource: "product",
            operation: "product_list",
            fields: { shop_no: "42", display: "T" },
          }}
          onChange={onChange}
        />,
      );

      const opSelect = screen.getAllByRole("combobox")[1] as HTMLSelectElement;
      fireEvent.change(opSelect, { target: { value: "product_get" } });

      // product_get knows `shop_no` but NOT `display` — so display drops.
      const last = onChange.mock.calls.at(-1)?.[0];
      expect(last).toMatchObject({
        operation: "product_get",
        fields: { shop_no: "42" },
      });
      expect((last as { fields: Record<string, string> }).fields.display).toBeUndefined();
    });

    it("shows a 'coming soon' hint when a planned operation is selected", () => {
      // Picking a planned op programmatically (option is disabled in the
      // UI, but legacy configs from before the catalog landed may already
      // point at one) — verify the user gets told why it doesn't render fields.
      render(
        <ControlledCafe24
          initial={{ resource: "product", operation: "product_count" }}
          onChange={vi.fn()}
        />,
      );
      expect(
        screen.getByText(/아직 지원되지 않습니다/),
      ).toBeInTheDocument();
    });

    it("shows an 'unknown operation' warning when the saved id is not in the catalog", () => {
      render(
        <ControlledCafe24
          initial={{ resource: "product", operation: "nonexistent_op" }}
          onChange={vi.fn()}
        />,
      );
      expect(
        screen.getByText(/메타데이터에 없는 작업/),
      ).toBeInTheDocument();
    });
  });

  describe("Field value editing", () => {
    it("writes config.fields[name] = value on each keystroke and preserves siblings", () => {
      const onChange = vi.fn();
      render(
        <ControlledCafe24
          initial={{
            resource: "product",
            operation: "product_list",
            fields: { display: "T" },
          }}
          onChange={onChange}
        />,
      );

      // ExpressionInput renders a contenteditable / textarea / input — find
      // the input that corresponds to the shop_no row by sibling proximity.
      const shopRow = screen.getByText("shop_no").closest("div")!;
      const input = shopRow.querySelector(
        "input, textarea, [contenteditable]",
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "{{ $input.shop }}" } });

      const last = onChange.mock.calls.at(-1)?.[0] as {
        fields: Record<string, string>;
      };
      expect(last.fields.shop_no).toBe("{{ $input.shop }}");
      // Sibling 'display' is not erased.
      expect(last.fields.display).toBe("T");
    });

    it("surfaces enum allowed-values as hint text", () => {
      render(
        <ControlledCafe24
          initial={{ resource: "product", operation: "product_list" }}
          onChange={vi.fn()}
        />,
      );
      // FIXTURE display enum is ['T', 'F'] → "허용 값: T / F"
      expect(screen.getByText(/허용 값: T \/ F/)).toBeInTheDocument();
    });

    it("surfaces default value as hint text", () => {
      render(
        <ControlledCafe24
          initial={{ resource: "product", operation: "product_list" }}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText(/기본값: 1/)).toBeInTheDocument();
    });
  });

  describe("Empty extras", () => {
    it("does not crash when the node-definitions store has no extras", () => {
      seedCafe24NodeDefinition(null);
      render(<ControlledCafe24 initial={{}} onChange={vi.fn()} />);
      // Resource select still renders.
      expect(screen.getAllByRole("combobox")[0]).toBeInTheDocument();
    });
  });
});
