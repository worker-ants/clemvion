import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listMock = vi.fn();
vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: { list: (...a: unknown[]) => listMock(...a) },
}));

import {
  McpServerSelector,
  type McpServerRef,
} from "../mcp-server-selector";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type {
  NodeDefinition,
  Cafe24NodeExtras,
  MakeshopNodeExtras,
} from "@/lib/node-definitions/types";

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const CAFE24 = {
  id: "cafe24-1",
  name: "My Shop",
  serviceType: "cafe24",
  status: "connected",
};
const MAKESHOP = {
  id: "makeshop-1",
  name: "MakeShop Store",
  serviceType: "makeshop",
  status: "connected",
};
const MCP = {
  id: "mcp-1",
  name: "Generic MCP",
  serviceType: "mcp",
  status: "connected",
};

function seedCafe24Extras() {
  const def: NodeDefinition = {
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
    extras: {
      operationsByResource: {
        product: [
          {
            status: "supported",
            id: "product_list",
            labelKey: "cafe24.tst.product_list",
            description: "",
            scope: "read",
            paginated: false,
            requiredFields: [],
            fields: [],
          },
        ],
      },
      plannedByResource: {},
    } as unknown as Record<string, unknown>,
  };
  useNodeDefinitionsStore.setState({
    definitions: { cafe24: def },
    order: ["cafe24"],
    status: "ready",
  });
}

function seedMakeshopExtras() {
  const def: NodeDefinition = {
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
    extras: {
      operationsByResource: {
        product: [
          {
            status: "supported",
            id: "get-product",
            labelKey: "makeshop.tst.get-product",
            description: "",
            scope: "read",
            paginated: false,
            requiredFields: [],
            fields: [],
          },
        ],
      },
    } as unknown as MakeshopNodeExtras as unknown as Record<string, unknown>,
  };
  useNodeDefinitionsStore.setState({
    definitions: { makeshop: def },
    order: ["makeshop"],
    status: "ready",
  });
}

describe("McpServerSelector — Cafe24 allowlist section", () => {
  const originalLocale = useLocaleStore.getState().locale;
  const originalDefs = useNodeDefinitionsStore.getState();

  beforeEach(() => {
    listMock.mockReset();
    useLocaleStore.setState({ locale: "ko" });
    seedCafe24Extras();
  });
  afterEach(() => {
    useLocaleStore.setState({ locale: originalLocale });
    useNodeDefinitionsStore.setState(originalDefs);
  });

  function renderWith(value: McpServerRef[]) {
    listMock.mockResolvedValue({ data: [CAFE24, MCP] });
    const onChange = vi.fn();
    render(wrap(<McpServerSelector value={value} onChange={onChange} />));
    return onChange;
  }

  it("cafe24 server 에 'Operations allowlist' 토글이 노출된다", async () => {
    renderWith([{ integrationId: "cafe24-1" }]);
    expect(
      await screen.findByRole("button", { name: /작업 허용 목록/ }),
    ).toBeDefined();
  });

  it("일반 mcp server 에는 allowlist 토글이 없다", async () => {
    renderWith([{ integrationId: "mcp-1" }]);
    await screen.findByText("Generic MCP");
    expect(screen.queryByRole("button", { name: /작업 허용 목록/ })).toBeNull();
  });

  it("토글 클릭 시 편집기(operation 체크박스)가 펼쳐진다", async () => {
    renderWith([{ integrationId: "cafe24-1" }]);
    const toggle = await screen.findByRole("button", {
      name: /작업 허용 목록/,
    });
    // 펼치기 전엔 operation 체크박스 없음 (Expose Resources/Prompts 2개만).
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /cafe24\.tst\.product_list/ }),
      ).toBeDefined(),
    );
  });

  it("enabledTools 가 명시되면 개수 뱃지를 보여준다", async () => {
    renderWith([
      { integrationId: "cafe24-1", enabledTools: ["product_list"] },
    ]);
    const toggle = await screen.findByRole("button", {
      name: /작업 허용 목록/,
    });
    // 뱃지 "1" 이 토글 버튼 안에 포함.
    expect(toggle.textContent).toContain("1");
  });
});

/**
 * SUMMARY#3 (ai-review W3): McpServerSelector MakeShop 분기 회귀 방지.
 *
 * serviceType="makeshop" 선택 시:
 *  (1) allowlist 토글(작업 허용 목록)이 노출돼야 한다.
 *  (2) MakeshopAllowlistEditor 가 렌더돼야 한다 (토글 클릭 후 operation 체크박스).
 *  (3) Cafe24AllowlistEditor 가 렌더되면 안 된다 (serviceType 분기 회귀 감지).
 */
describe("McpServerSelector — MakeShop allowlist section", () => {
  const originalLocale = useLocaleStore.getState().locale;
  const originalDefs = useNodeDefinitionsStore.getState();

  beforeEach(() => {
    listMock.mockReset();
    useLocaleStore.setState({ locale: "ko" });
    seedMakeshopExtras();
  });
  afterEach(() => {
    useLocaleStore.setState({ locale: originalLocale });
    useNodeDefinitionsStore.setState(originalDefs);
  });

  function renderWith(value: McpServerRef[]) {
    listMock.mockResolvedValue({ data: [MAKESHOP, MCP] });
    const onChange = vi.fn();
    render(wrap(<McpServerSelector value={value} onChange={onChange} />));
    return onChange;
  }

  it("makeshop server 에 'Operations allowlist' 토글이 노출된다", async () => {
    renderWith([{ integrationId: "makeshop-1" }]);
    expect(
      await screen.findByRole("button", { name: /작업 허용 목록/ }),
    ).toBeDefined();
  });

  it("일반 mcp server 에는 allowlist 토글이 없다 (MakeShop store 와 공존 시)", async () => {
    renderWith([{ integrationId: "mcp-1" }]);
    await screen.findByText("Generic MCP");
    expect(screen.queryByRole("button", { name: /작업 허용 목록/ })).toBeNull();
  });

  it("토글 클릭 시 MakeshopAllowlistEditor 가 렌더된다 (operation 체크박스 노출)", async () => {
    renderWith([{ integrationId: "makeshop-1" }]);
    const toggle = await screen.findByRole("button", {
      name: /작업 허용 목록/,
    });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /makeshop\.tst\.get-product/ }),
      ).toBeDefined(),
    );
  });

  it("Cafe24AllowlistEditor 가 MakeShop server 에 잘못 렌더되지 않는다 (serviceType 분기 회귀)", async () => {
    renderWith([{ integrationId: "makeshop-1" }]);
    const toggle = await screen.findByRole("button", {
      name: /작업 허용 목록/,
    });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", { name: /cafe24\.tst/ }),
      ).toBeNull(),
    );
  });

  it("enabledTools 가 명시되면 개수 뱃지를 보여준다", async () => {
    renderWith([
      { integrationId: "makeshop-1", enabledTools: ["get-product"] },
    ]);
    const toggle = await screen.findByRole("button", {
      name: /작업 허용 목록/,
    });
    expect(toggle.textContent).toContain("1");
  });
});
