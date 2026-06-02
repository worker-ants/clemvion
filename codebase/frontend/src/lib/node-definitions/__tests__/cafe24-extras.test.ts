import { describe, it, expect, afterEach } from "vitest";
import {
  readCafe24Extras,
  resolveCafe24OperationLabel,
} from "../cafe24-extras";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type { NodeDefinition, Cafe24NodeExtras } from "../types";

const VALID_EXTRAS = {
  operationsByResource: { product: [] },
  plannedByResource: { product: [] },
} as unknown as Cafe24NodeExtras;

function seedDef(extras: unknown | undefined) {
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
    extras: extras as Record<string, unknown> | undefined,
  };
  useNodeDefinitionsStore.setState({
    definitions: { cafe24: def },
    order: ["cafe24"],
    status: "ready",
  });
}

describe("readCafe24Extras", () => {
  const original = useNodeDefinitionsStore.getState();
  afterEach(() => useNodeDefinitionsStore.setState(original));

  it("valid extras → 그대로 반환", () => {
    seedDef(VALID_EXTRAS);
    expect(readCafe24Extras()).toEqual(VALID_EXTRAS);
  });

  it("cafe24 정의 없음 → null", () => {
    useNodeDefinitionsStore.setState({
      definitions: {},
      order: [],
      status: "ready",
    });
    expect(readCafe24Extras()).toBeNull();
  });

  it("extras 없음(older backend) → null", () => {
    seedDef(undefined);
    expect(readCafe24Extras()).toBeNull();
  });

  it("operationsByResource/plannedByResource 누락 → null (structural narrowing)", () => {
    seedDef({ operationsByResource: { product: [] } }); // plannedByResource 없음
    expect(readCafe24Extras()).toBeNull();
  });
});

describe("resolveCafe24OperationLabel", () => {
  it("dict miss → key 자체 fallback", () => {
    const key = "cafe24.__nonexistent__.op";
    expect(resolveCafe24OperationLabel("ko", key)).toBe(key);
    expect(resolveCafe24OperationLabel("en", key)).toBe(key);
  });

  it("실재 키 → locale 별 라벨 (ko ≠ en 또는 최소 키 자체 아님)", () => {
    const key = "cafe24.product.product_list";
    const ko = resolveCafe24OperationLabel("ko", key);
    const en = resolveCafe24OperationLabel("en", key);
    expect(ko).not.toBe(key);
    expect(en).not.toBe(key);
  });
});
