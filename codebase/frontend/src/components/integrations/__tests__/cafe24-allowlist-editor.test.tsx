import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Cafe24AllowlistEditor } from "../cafe24-allowlist-editor";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type {
  NodeDefinition,
  Cafe24NodeExtras,
  Cafe24RestrictedApproval,
} from "@/lib/node-definitions/types";

function op(
  id: string,
  labelKey: string,
  restricted?: Cafe24RestrictedApproval,
) {
  return {
    status: "supported" as const,
    id,
    labelKey,
    description: "",
    scope: "read" as const,
    paginated: false,
    requiredFields: [],
    fields: [],
    ...(restricted ? { restrictedApproval: restricted } : {}),
  };
}

const SCOPE_R: Cafe24RestrictedApproval = {
  level: "scope",
  approvalGroup: "mileage",
  inquiryUrl: "https://x",
};
const OP_R: Cafe24RestrictedApproval = {
  level: "operation",
  approvalGroup: "pg_settings",
  inquiryUrl: "https://x",
};

// mileage = scope-restricted 카테고리; store = operation-restricted op 1개 포함;
// product = 일반.
// labelKey 는 catalog 에 없는 fake 키 — resolveCafe24OperationLabel 가 키 자체로
// fallback 하므로 테스트가 접근성 이름으로 op 을 안정적으로 조회할 수 있다.
const EXTRAS = {
  operationsByResource: {
    mileage: [
      op("mileage_list", "cafe24.tst.mileage_list", SCOPE_R),
      op("mileage_get", "cafe24.tst.mileage_get", SCOPE_R),
    ],
    store: [
      op("paymentgateway_get", "cafe24.tst.paymentgateway_get", OP_R),
      op("store_get", "cafe24.tst.store_get"),
    ],
    product: [
      op("product_list", "cafe24.tst.product_list"),
      op("product_get", "cafe24.tst.product_get"),
    ],
  },
  plannedByResource: {},
} as unknown as Cafe24NodeExtras;

const ALL_IDS = [
  "mileage_list",
  "mileage_get",
  "paymentgateway_get",
  "store_get",
  "product_list",
  "product_get",
];

function seed(extras: Cafe24NodeExtras | null) {
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

describe("Cafe24AllowlistEditor", () => {
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
    render(<Cafe24AllowlistEditor enabledTools={undefined} onChange={vi.fn()} />);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // 카테고리 3 + operation 6 = 9 체크박스, 전부 checked.
    expect(boxes).toHaveLength(9);
    expect(boxes.every((b) => b.checked)).toBe(true);
  });

  it("scope 카테고리 헤더 + operation 행에만 ⚠ 배지 (총 2개)", () => {
    render(<Cafe24AllowlistEditor enabledTools={undefined} onChange={vi.fn()} />);
    // ApprovalRequiredBadge 는 role="img". mileage(scope) 헤더 1 +
    // paymentgateway_get(operation) 행 1 = 2. scope-level operation 행은 미표기.
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("operation 토글 off → 전체 materialize 후 해당 id 제거", () => {
    const onChange = vi.fn();
    render(
      <Cafe24AllowlistEditor enabledTools={undefined} onChange={onChange} />,
    );
    const productList = screen.getByRole("checkbox", {
      name: /cafe24\.tst\.product_list/,
    });
    fireEvent.click(productList);
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as string[];
    expect(next).toHaveLength(ALL_IDS.length - 1);
    expect(next).not.toContain("product_list");
    expect(next).toContain("mileage_list");
  });

  it("카테고리 헤더 토글 off → 그 카테고리 operation 전부 제거", () => {
    const onChange = vi.fn();
    render(
      <Cafe24AllowlistEditor enabledTools={undefined} onChange={onChange} />,
    );
    // mileage 헤더 체크박스 (aria-label = resource 라벨). 현재 all-on → 클릭 시 off.
    const headerBoxes = screen
      .getAllByRole("checkbox")
      .filter((b) => b.getAttribute("aria-label")) as HTMLInputElement[];
    // 첫 카테고리(mileage) 헤더.
    fireEvent.click(headerBoxes[0]);
    const next = onChange.mock.calls[0][0] as string[];
    expect(next).not.toContain("mileage_list");
    expect(next).not.toContain("mileage_get");
    expect(next).toContain("product_list");
  });

  it("이미 명시된 enabledTools → 그 항목만 checked", () => {
    render(
      <Cafe24AllowlistEditor
        enabledTools={["product_list"]}
        onChange={vi.fn()}
      />,
    );
    const productList = screen.getByRole("checkbox", {
      name: /cafe24\.tst\.product_list/,
    }) as HTMLInputElement;
    const productGet = screen.getByRole("checkbox", {
      name: /cafe24\.tst\.product_get/,
    }) as HTMLInputElement;
    expect(productList.checked).toBe(true);
    expect(productGet.checked).toBe(false);
  });

  it("extras 미로딩 시 loading placeholder", () => {
    seed(null);
    render(<Cafe24AllowlistEditor enabledTools={undefined} onChange={vi.fn()} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("['*'] wildcard → 전부 허용으로 해석(전부 checked), 토글 시 명시 배열로 materialize", () => {
    const onChange = vi.fn();
    render(<Cafe24AllowlistEditor enabledTools={["*"]} onChange={onChange} />);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.every((b) => b.checked)).toBe(true);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /cafe24\.tst\.product_list/ }),
    );
    const next = onChange.mock.calls[0][0] as string[];
    expect(next).not.toContain("*");
    expect(next).not.toContain("product_list");
    expect(next).toHaveLength(ALL_IDS.length - 1);
  });

  it("sameAsAll: 마지막 빠진 op 를 다시 켜면 onChange(undefined) 로 default 복원", () => {
    const onChange = vi.fn();
    const allButProduct = ALL_IDS.filter((id) => id !== "product_list");
    render(
      <Cafe24AllowlistEditor enabledTools={allButProduct} onChange={onChange} />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /cafe24\.tst\.product_list/ }),
    );
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("빈 배열 [] → 명시적 전부 차단(전부 unchecked)", () => {
    render(<Cafe24AllowlistEditor enabledTools={[]} onChange={vi.fn()} />);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.some((b) => b.checked)).toBe(false);
  });

  it("level='program' operation 도 행 ⚠ 배지 (operation 과 동일 취급)", () => {
    const PROGRAM_R: Cafe24RestrictedApproval = {
      level: "program" as Cafe24RestrictedApproval["level"],
      approvalGroup: "analytics",
      inquiryUrl: "https://x",
    };
    seed({
      operationsByResource: {
        analytics: [
          op("analytics_get", "cafe24.tst.analytics_get", PROGRAM_R),
          op("analytics_list", "cafe24.tst.analytics_list"),
        ],
      },
      plannedByResource: {},
    } as unknown as Cafe24NodeExtras);
    render(<Cafe24AllowlistEditor enabledTools={undefined} onChange={vi.fn()} />);
    // program op 1개 → 행 배지 1개 (카테고리 헤더는 scope 아님 → 미표기).
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});
