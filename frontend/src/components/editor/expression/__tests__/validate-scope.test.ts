import { describe, it, expect } from "vitest";
import {
  validateExpressionScope,
  type ScopeValidationContext,
} from "../validate-scope";

function ctx(
  overrides: Partial<ScopeValidationContext> = {},
): ScopeValidationContext {
  return {
    availableKeys: new Set<string>(),
    allNodeKeys: new Set<string>(),
    variables: [],
    containerScope: { hasLoop: false, hasItem: false },
    ...overrides,
  };
}

describe("validateExpressionScope", () => {
  it("returns no errors for plain text without expression blocks", () => {
    expect(validateExpressionScope("hello world", ctx())).toEqual([]);
  });

  it("ignores content outside of {{ }} blocks", () => {
    // $node and $var references outside {{ }} are literal text, not expressions.
    const errors = validateExpressionScope(
      'prefix $node["X"] $var.y suffix',
      ctx(),
    );
    expect(errors).toEqual([]);
  });

  it("allows accessible node references", () => {
    const errors = validateExpressionScope(
      '{{ $node["HTTP Request"].output.id }}',
      ctx({
        availableKeys: new Set(["HTTP Request"]),
        allNodeKeys: new Set(["HTTP Request"]),
      }),
    );
    expect(errors).toEqual([]);
  });

  it("reports unreachable-node for nodes that exist but are not ancestors", () => {
    const errors = validateExpressionScope(
      '{{ $node["Other"].output.x }}',
      ctx({
        availableKeys: new Set(["HTTP Request"]),
        allNodeKeys: new Set(["HTTP Request", "Other"]),
      }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe("unreachable-node");
    expect(errors[0].token).toBe("Other");
  });

  it("reports unknown-node for node keys that do not exist at all", () => {
    const errors = validateExpressionScope(
      '{{ $node["Ghost"].output.x }}',
      ctx({
        availableKeys: new Set(["HTTP Request"]),
        allNodeKeys: new Set(["HTTP Request"]),
      }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe("unknown-node");
    expect(errors[0].token).toBe("Ghost");
  });

  it("handles escaped quotes inside node keys", () => {
    // A node literally named She said "hi" must be referenced with \" inside
    // the expression. The validator must unescape to compare against the key
    // stored in allNodeKeys.
    const errors = validateExpressionScope(
      '{{ $node["She said \\"hi\\""].output }}',
      ctx({
        availableKeys: new Set(['She said "hi"']),
        allNodeKeys: new Set(['She said "hi"']),
      }),
    );
    expect(errors).toEqual([]);
  });

  it("reports unknown-variable for undeclared $var references", () => {
    const errors = validateExpressionScope(
      "{{ $var.missing }}",
      ctx({ variables: [{ name: "counter", type: "number" }] }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe("unknown-variable");
    expect(errors[0].token).toBe("missing");
  });

  it("allows declared variables", () => {
    const errors = validateExpressionScope(
      "{{ $var.counter + 1 }}",
      ctx({ variables: [{ name: "counter", type: "number" }] }),
    );
    expect(errors).toEqual([]);
  });

  it("reports out-of-scope-loop when $loop is used outside a loop container", () => {
    const errors = validateExpressionScope("{{ $loop.index }}", ctx());
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe("out-of-scope-loop");
  });

  it("allows $loop references inside a loop container", () => {
    const errors = validateExpressionScope(
      "{{ $loop.index }}",
      ctx({ containerScope: { hasLoop: true, hasItem: false } }),
    );
    expect(errors).toEqual([]);
  });

  it("reports out-of-scope-item when $item is used outside a foreach container", () => {
    const errors = validateExpressionScope("{{ $item.name }}", ctx());
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe("out-of-scope-item");
    expect(errors[0].token).toBe("$item");
  });

  it("reports out-of-scope-item for $itemIndex outside a foreach container", () => {
    const errors = validateExpressionScope("{{ $itemIndex }}", ctx());
    expect(errors).toHaveLength(1);
    expect(errors[0].kind).toBe("out-of-scope-item");
    expect(errors[0].token).toBe("$itemIndex");
  });

  it("allows $item and $itemIndex inside a foreach container", () => {
    const errors = validateExpressionScope(
      "{{ $item.name + $itemIndex }}",
      ctx({ containerScope: { hasLoop: false, hasItem: true } }),
    );
    expect(errors).toEqual([]);
  });

  it("reports errors from every {{ }} block independently", () => {
    const errors = validateExpressionScope(
      '{{ $node["A"] }} and {{ $node["B"] }}',
      ctx({
        availableKeys: new Set(["A"]),
        allNodeKeys: new Set(["A"]),
      }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].token).toBe("B");
    expect(errors[0].kind).toBe("unknown-node");
  });

  it("deduplicates repeated identical errors within one block", () => {
    const errors = validateExpressionScope(
      '{{ $node["Ghost"].a + $node["Ghost"].b }}',
      ctx({ allNodeKeys: new Set() }),
    );
    // Two textual references but the same (kind, token) pair — collapse to one.
    expect(errors).toHaveLength(1);
    expect(errors[0].token).toBe("Ghost");
  });

  it("does not flag expressions that never use scoped variables", () => {
    const errors = validateExpressionScope(
      "{{ 1 + 2 }} and {{ $now }}",
      ctx(),
    );
    expect(errors).toEqual([]);
  });

  it("returns no errors for null, undefined, or empty input", () => {
    // Callers may wire this up before a value is set; guard against crashes.
    const nullish = [null, undefined, ""] as const;
    for (const v of nullish) {
      expect(validateExpressionScope(v as unknown as string, ctx())).toEqual([]);
    }
  });

  it("reports both unknown-node and unknown-variable in a single block", () => {
    const errors = validateExpressionScope(
      '{{ $node["Ghost"].x + $var.missing }}',
      ctx({
        availableKeys: new Set(),
        allNodeKeys: new Set(),
        variables: [],
      }),
    );
    expect(errors).toHaveLength(2);
    const kinds = errors.map((e) => e.kind);
    expect(kinds).toContain("unknown-node");
    expect(kinds).toContain("unknown-variable");
  });

  it("dedupes the same (kind, token) across multiple blocks", () => {
    // Documented behaviour: identical errors in different blocks collapse to
    // a single entry so the warning list stays readable on long templates.
    const errors = validateExpressionScope(
      '{{ $node["Ghost"] }} then {{ $node["Ghost"].x }}',
      ctx({ allNodeKeys: new Set() }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].token).toBe("Ghost");
  });
});
