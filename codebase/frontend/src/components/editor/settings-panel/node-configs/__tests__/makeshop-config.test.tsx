// MakeShop 설정 패널의 페이지네이션 저장 규칙. MakeShop 은 페이지 번호로 조회하므로
// 서버가 offset 을 page = offset / limit + 1 로 바꾸고, limit 없이 offset 만 오면
// 거절한다. 화면은 limit 기본값 50 을 보여 주므로 offset 을 바꿀 때 그 값을 함께
// 저장해야 사용자가 본 대로 실행된다. NERV CLE-NODE-MAKESHOP · CLE-T-XVS8H7.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";

vi.mock("../integration-selector", () => ({
  IntegrationSelector: ({ label }: { label: string }) => (
    <div data-testid="integration-selector">{label}</div>
  ),
}));

import { MakeshopConfig } from "../integration-configs";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type {
  NodeDefinition,
  MakeshopNodeExtras,
} from "@/lib/node-definitions/types";

type MakeshopInitial = Parameters<typeof MakeshopConfig>[0]["config"];

const BRAND_LIST_OP = {
  status: "supported" as const,
  id: "get-brand",
  labelKey: "makeshop.product.get-brand",
  description: "List brands",
  scope: "read" as const,
  paginated: true,
  requiredFields: [],
  fields: [
    {
      name: "brand_name",
      type: "string" as const,
      location: "query" as const,
      required: false,
    },
  ],
};

const FIXTURE_EXTRAS: MakeshopNodeExtras = {
  operationsByResource: { product: [BRAND_LIST_OP] },
};

function seedMakeshopNodeDefinition() {
  const minimal: NodeDefinition = {
    type: "makeshop",
    category: "integration",
    label: "MakeShop",
    description: "",
    icon: "ShoppingBag",
    color: "#2563EB",
    inputs: [],
    outputs: [],
    defaultConfig: {},
    configSchema: {},
    extras: FIXTURE_EXTRAS as unknown as Record<string, unknown>,
  };
  useNodeDefinitionsStore.setState({
    definitions: { makeshop: minimal },
    order: ["makeshop"],
    status: "ready",
  });
}

function ControlledMakeshop({
  initial,
  onChange,
}: {
  initial: MakeshopInitial;
  onChange: (next: MakeshopInitial) => void;
}) {
  const [config, setConfig] = useState<MakeshopInitial>(initial);
  return (
    <MakeshopConfig
      config={config}
      onChange={(next) => {
        setConfig(next);
        onChange(next);
      }}
    />
  );
}

function paginationInputs() {
  const [limit, offset] = screen.getAllByRole("spinbutton");
  return { limit, offset };
}

describe("MakeshopConfig — pagination", () => {
  const originalLocale = useLocaleStore.getState().locale;
  const originalDefinitions = useNodeDefinitionsStore.getState();

  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    seedMakeshopNodeDefinition();
  });

  afterEach(() => {
    useLocaleStore.setState({ locale: originalLocale });
    useNodeDefinitionsStore.setState(originalDefinitions);
  });

  it("saves the displayed default limit together with an edited offset", () => {
    const onChange = vi.fn();
    render(
      <ControlledMakeshop
        initial={{ resource: "product", operation: "get-brand" }}
        onChange={onChange}
      />,
    );

    fireEvent.change(paginationInputs().offset, { target: { value: "100" } });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ pagination: { limit: 50, offset: 100 } }),
    );
  });

  it("keeps a stored limit when the offset changes", () => {
    const onChange = vi.fn();
    render(
      <ControlledMakeshop
        initial={{
          resource: "product",
          operation: "get-brand",
          pagination: { limit: 20 },
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(paginationInputs().offset, { target: { value: "40" } });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ pagination: { limit: 20, offset: 40 } }),
    );
  });

  it("explains that the offset must be a multiple of the limit", () => {
    render(
      <ControlledMakeshop
        initial={{ resource: "product", operation: "get-brand" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/multiple of Limit/)).toBeInTheDocument();
  });
});
