import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MakeshopAllowlistEditor } from "../makeshop-allowlist-editor";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type {
  NodeDefinition,
  MakeshopNodeExtras,
} from "@/lib/node-definitions/types";

function op(id: string, labelKey: string) {
  return {
    status: "supported" as const,
    id,
    labelKey,
    description: "",
    scope: "read" as const,
    paginated: false,
    requiredFields: [],
    fields: [],
  };
}

// labelKey 는 catalog 에 없는 fake 키 — resolveMakeshopOperationLabel 가 키 자체로
// fallback 하므로 테스트가 접근성 이름으로 op 을 안정적으로 조회할 수 있다.
const EXTRAS = {
  operationsByResource: {
    product: [
      op("get-product", "makeshop.tst.get-product"),
      op("post-product-create", "makeshop.tst.post-product-create"),
    ],
    order: [
      op("get-order-1", "makeshop.tst.get-order-1"),
      op("post-order-done", "makeshop.tst.post-order-done"),
    ],
  },
} as unknown as MakeshopNodeExtras;

const ALL_IDS = [
  "get-product",
  "post-product-create",
  "get-order-1",
  "post-order-done",
];

function seed(extras: MakeshopNodeExtras | undefined) {
  const minimal: NodeDefinition = {
    type: "makeshop",
    category: "integration",
    label: "MakeShop",
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
    definitions: { makeshop: minimal },
    order: ["makeshop"],
    status: "ready",
  });
}

describe("MakeshopAllowlistEditor", () => {
  const originalLocale = useLocaleStore.getState().locale;
  const originalDefs = useNodeDefinitionsStore.getState();

  beforeEach(() => {
    useLocaleStore.setState({ locale: "ko" });
    seed(EXTRAS);
  });
  afterEach(() => {
    useLocaleStore.setState({ locale: originalLocale });
    useNodeDefinitionsStore.setState(originalDefs);
  });

  it("default_true: enabledTools undefined → 모든 체크박스 checked", () => {
    render(
      <MakeshopAllowlistEditor enabledTools={undefined} onChange={vi.fn()} />,
    );
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // 카테고리 2 + operation 4 = 6 체크박스, 전부 checked.
    expect(boxes).toHaveLength(6);
    expect(boxes.every((b) => b.checked)).toBe(true);
  });

  it("승인 배지(⚠) 를 절대 렌더하지 않는다 (MakeShop 은 restricted tier 없음)", () => {
    render(
      <MakeshopAllowlistEditor enabledTools={undefined} onChange={vi.fn()} />,
    );
    // ApprovalRequiredBadge 는 role="img". MakeShop 은 0개여야 한다.
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("operation 토글 off → 전체 materialize 후 해당 id 제거", () => {
    const onChange = vi.fn();
    render(
      <MakeshopAllowlistEditor enabledTools={undefined} onChange={onChange} />,
    );
    const getProduct = screen.getByRole("checkbox", {
      name: /makeshop\.tst\.get-product/,
    });
    fireEvent.click(getProduct);
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as string[];
    expect(next).toHaveLength(ALL_IDS.length - 1);
    expect(next).not.toContain("get-product");
    expect(next).toContain("get-order-1");
  });

  it("카테고리 헤더 토글 off → 그 카테고리 operation 전부 제거", () => {
    const onChange = vi.fn();
    render(
      <MakeshopAllowlistEditor enabledTools={undefined} onChange={onChange} />,
    );
    const headerBoxes = screen
      .getAllByRole("checkbox")
      .filter((b) => b.getAttribute("aria-label")) as HTMLInputElement[];
    // resource 정렬: order < product. 첫 헤더 = order.
    fireEvent.click(headerBoxes[0]);
    const next = onChange.mock.calls[0][0] as string[];
    expect(next).not.toContain("get-order-1");
    expect(next).not.toContain("post-order-done");
    expect(next).toContain("get-product");
  });

  it("명시 배열이 전체 id 와 일치하면 undefined(default_true) 로 복원", () => {
    const onChange = vi.fn();
    // 하나 빠진 상태에서 마지막 하나를 켜면 전체가 되어 undefined 로 복원.
    render(
      <MakeshopAllowlistEditor
        enabledTools={[
          "post-product-create",
          "get-order-1",
          "post-order-done",
        ]}
        onChange={onChange}
      />,
    );
    const getProduct = screen.getByRole("checkbox", {
      name: /makeshop\.tst\.get-product/,
    });
    fireEvent.click(getProduct);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("extras 미로딩 시 loading 안내", () => {
    seed(undefined);
    render(
      <MakeshopAllowlistEditor enabledTools={undefined} onChange={vi.fn()} />,
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
