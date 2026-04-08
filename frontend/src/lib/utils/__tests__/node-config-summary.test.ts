import { describe, expect, it } from "vitest";
import {
  getConfigSummary,
  truncateSummary,
} from "../node-config-summary";

const NOT_CONFIGURED = { text: "\u26a0 Not configured", isWarning: true };

// ===== truncateSummary =====
describe("truncateSummary", () => {
  it("returns text as-is when under maxLen", () => {
    expect(truncateSummary("short text")).toEqual({
      display: "short text",
      isTruncated: false,
    });
  });

  it("returns text as-is when exactly maxLen", () => {
    const text = "a".repeat(40);
    expect(truncateSummary(text)).toEqual({
      display: text,
      isTruncated: false,
    });
  });

  it("truncates text over maxLen with ellipsis", () => {
    const text = "a".repeat(50);
    const result = truncateSummary(text);
    expect(result.display).toBe("a".repeat(39) + "\u2026");
    expect(result.isTruncated).toBe(true);
  });

  it("supports custom maxLen", () => {
    const result = truncateSummary("hello world", 5);
    expect(result.display).toBe("hell\u2026");
    expect(result.isTruncated).toBe(true);
  });
});

// ===== getConfigSummary — dispatcher =====
describe("getConfigSummary", () => {
  it("returns null for manual_trigger", () => {
    expect(getConfigSummary("manual_trigger", {})).toBeNull();
  });

  it("returns null for unknown node type", () => {
    expect(getConfigSummary("unknown_type", {})).toBeNull();
  });

  it("returns warning for empty config on each configured node type", () => {
    const types = [
      "if_else", "switch", "loop", "variable_declaration", "variable_modification",
      "split", "map", "foreach", "merge", "filter", "workflow",
      "http_request", "database_query", "slack", "send_email",
      "transform", "code",
      "table", "chart", "form", "template", "pdf",
      "ai_agent", "text_classifier", "information_extractor",
    ];
    for (const type of types) {
      const result = getConfigSummary(type, {});
      expect(result).toEqual(NOT_CONFIGURED);
    }
  });

  it("returns default summary for carousel with empty config (layout defaults to card)", () => {
    const result = getConfigSummary("carousel", {});
    expect(result).toEqual({ text: "card", isWarning: false });
  });
});

// ===== if_else =====
describe("if_else summary", () => {
  it("formats first condition with eq operator", () => {
    const result = getConfigSummary("if_else", {
      conditions: [{ field: "role", operator: "eq", value: '"admin"' }],
    });
    expect(result).toEqual({ text: 'role == "admin"', isWarning: false });
  });

  it("formats with different operators", () => {
    expect(getConfigSummary("if_else", {
      conditions: [{ field: "age", operator: "gt", value: "18" }],
    })).toEqual({ text: "age > 18", isWarning: false });

    expect(getConfigSummary("if_else", {
      conditions: [{ field: "name", operator: "contains", value: "test" }],
    })).toEqual({ text: "name contains test", isWarning: false });
  });

  it("formats is_empty/is_null without value", () => {
    expect(getConfigSummary("if_else", {
      conditions: [{ field: "data", operator: "is_empty", value: "" }],
    })).toEqual({ text: "data is empty", isWarning: false });
  });

  it("shows warning when conditions is empty array", () => {
    expect(getConfigSummary("if_else", { conditions: [] })).toEqual(NOT_CONFIGURED);
  });

  it("shows warning when first condition field is empty", () => {
    expect(getConfigSummary("if_else", {
      conditions: [{ field: "", operator: "eq", value: "" }],
    })).toEqual(NOT_CONFIGURED);
  });
});

// ===== switch =====
describe("switch summary", () => {
  it("formats switch value and case count", () => {
    expect(getConfigSummary("switch", {
      switchValue: "$input.type",
      cases: [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
        { label: "C", value: "c" },
      ],
    })).toEqual({ text: "$input.type \u2192 3 cases", isWarning: false });
  });

  it("shows warning when switchValue is empty", () => {
    expect(getConfigSummary("switch", { switchValue: "" })).toEqual(NOT_CONFIGURED);
  });

  it("shows 0 cases when cases array is empty", () => {
    expect(getConfigSummary("switch", {
      switchValue: "$input.x",
      cases: [],
    })).toEqual({ text: "$input.x \u2192 0 cases", isWarning: false });
  });
});

// ===== loop =====
describe("loop summary", () => {
  it("formats count", () => {
    expect(getConfigSummary("loop", { count: "10" })).toEqual({
      text: "10x",
      isWarning: false,
    });
  });

  it("includes break condition indicator", () => {
    expect(getConfigSummary("loop", {
      count: "10",
      breakCondition: "$loop.result > 100",
    })).toEqual({ text: "10x \u00b7 break condition", isWarning: false });
  });

  it("shows warning when count is empty", () => {
    expect(getConfigSummary("loop", { count: "" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== variable_declaration =====
describe("variable_declaration summary", () => {
  it("shows name, type and default value", () => {
    expect(getConfigSummary("variable_declaration", {
      variables: [
        { name: "counter", type: "number", defaultValue: "0" },
        { name: "total", type: "number", defaultValue: "0" },
      ],
    })).toEqual({ text: "counter: number = 0, total: number = 0", isWarning: false });
  });

  it("shows name and type without default value", () => {
    expect(getConfigSummary("variable_declaration", {
      variables: [
        { name: "flag", type: "boolean" },
      ],
    })).toEqual({ text: "flag: boolean", isWarning: false });
  });

  it("shows +N for more than 2 variables", () => {
    expect(getConfigSummary("variable_declaration", {
      variables: [
        { name: "a", type: "string", defaultValue: "" },
        { name: "b", type: "string", defaultValue: "" },
        { name: "c", type: "string", defaultValue: "" },
      ],
    })).toEqual({ text: "a: string, b: string, +1", isWarning: false });
  });

  it("excludes empty string defaultValue from display", () => {
    expect(getConfigSummary("variable_declaration", {
      variables: [
        { name: "msg", type: "string", defaultValue: "" },
      ],
    })).toEqual({ text: "msg: string", isWarning: false });
  });

  it("shows name only when type and defaultValue are absent", () => {
    expect(getConfigSummary("variable_declaration", {
      variables: [{ name: "x" }],
    })).toEqual({ text: "x", isWarning: false });
  });

  it("shows warning when variables is empty", () => {
    expect(getConfigSummary("variable_declaration", { variables: [] })).toEqual(NOT_CONFIGURED);
  });
});

// ===== variable_modification =====
describe("variable_modification summary", () => {
  it("formats first modification", () => {
    expect(getConfigSummary("variable_modification", {
      modifications: [{ variable: "counter", operation: "increment", value: "1" }],
    })).toEqual({ text: "counter increment", isWarning: false });
  });

  it("shows warning when modifications is empty", () => {
    expect(getConfigSummary("variable_modification", { modifications: [] })).toEqual(NOT_CONFIGURED);
  });
});

// ===== split =====
describe("split summary", () => {
  it("shows field path", () => {
    expect(getConfigSummary("split", { fieldPath: "$input.items" })).toEqual({
      text: "$input.items",
      isWarning: false,
    });
  });

  it("shows warning when fieldPath is empty", () => {
    expect(getConfigSummary("split", { fieldPath: "" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== map =====
describe("map summary", () => {
  it("shows mapping count", () => {
    expect(getConfigSummary("map", {
      mapping: [
        { targetField: "a", expression: "x" },
        { targetField: "b", expression: "y" },
        { targetField: "c", expression: "z" },
      ],
    })).toEqual({ text: "3 mappings", isWarning: false });
  });

  it("shows warning when mapping is empty", () => {
    expect(getConfigSummary("map", { mapping: [] })).toEqual(NOT_CONFIGURED);
  });
});

// ===== foreach =====
describe("foreach summary", () => {
  it("shows array field", () => {
    expect(getConfigSummary("foreach", {
      arrayField: "$input.items",
    })).toEqual({ text: "$input.items", isWarning: false });
  });

  it("includes non-default error policy", () => {
    expect(getConfigSummary("foreach", {
      arrayField: "$input.items",
      errorPolicy: "skip",
    })).toEqual({ text: "$input.items \u00b7 skip errors", isWarning: false });
  });

  it("omits stop error policy (default)", () => {
    expect(getConfigSummary("foreach", {
      arrayField: "$input.items",
      errorPolicy: "stop",
    })).toEqual({ text: "$input.items", isWarning: false });
  });

  it("shows warning when arrayField is empty", () => {
    expect(getConfigSummary("foreach", { arrayField: "" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== merge =====
describe("merge summary", () => {
  it("shows input count and strategy", () => {
    expect(getConfigSummary("merge", {
      inputCount: 3,
      strategy: "wait_all",
    })).toEqual({ text: "3 inputs \u00b7 wait_all", isWarning: false });
  });

  it("uses defaults when partially configured", () => {
    expect(getConfigSummary("merge", {
      inputCount: 2,
      strategy: "first",
    })).toEqual({ text: "2 inputs \u00b7 first", isWarning: false });
  });

  it("shows warning when only inputCount is provided", () => {
    expect(getConfigSummary("merge", { inputCount: 3 })).toEqual(NOT_CONFIGURED);
  });

  it("shows warning when only strategy is provided", () => {
    expect(getConfigSummary("merge", { strategy: "wait_all" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== filter =====
describe("filter summary", () => {
  it("formats inputField, condition count, and combine mode", () => {
    expect(getConfigSummary("filter", {
      inputField: "$input.items",
      conditions: [
        { field: "status", operator: "eq", value: "active" },
        { field: "age", operator: "gt", value: "18" },
      ],
      combineMode: "and",
    })).toEqual({ text: "$input.items \u00b7 2 conditions \u00b7 AND", isWarning: false });
  });

  it("shows singular condition label for 1 condition", () => {
    expect(getConfigSummary("filter", {
      inputField: "$input.users",
      conditions: [{ field: "active", operator: "eq", value: "true" }],
      combineMode: "or",
    })).toEqual({ text: "$input.users \u00b7 1 condition \u00b7 OR", isWarning: false });
  });

  it("defaults combineMode to AND", () => {
    expect(getConfigSummary("filter", {
      inputField: "$input.data",
      conditions: [{ field: "x", operator: "eq", value: "1" }],
    })).toEqual({ text: "$input.data \u00b7 1 condition \u00b7 AND", isWarning: false });
  });

  it("shows warning when inputField is empty", () => {
    expect(getConfigSummary("filter", { inputField: "" })).toEqual(NOT_CONFIGURED);
  });

  it("shows warning when inputField is missing", () => {
    expect(getConfigSummary("filter", {})).toEqual(NOT_CONFIGURED);
  });

  it("shows 0 conditions when conditions array is empty", () => {
    expect(getConfigSummary("filter", {
      inputField: "$input.items",
      conditions: [],
    })).toEqual({ text: "$input.items \u00b7 0 conditions \u00b7 AND", isWarning: false });
  });
});

// ===== workflow =====
describe("workflow summary", () => {
  it("shows workflow id and mode", () => {
    expect(getConfigSummary("workflow", {
      workflowId: "abc-123",
      mode: "sync",
    })).toEqual({ text: "abc-123 \u00b7 sync", isWarning: false });
  });

  it("shows warning when workflowId is empty", () => {
    expect(getConfigSummary("workflow", { workflowId: "" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== http_request =====
describe("http_request summary", () => {
  it("formats method and url", () => {
    expect(getConfigSummary("http_request", {
      method: "GET",
      url: "https://api.example.com/users",
    })).toEqual({ text: "GET https://api.example.com/users", isWarning: false });
  });

  it("uses GET as default method", () => {
    expect(getConfigSummary("http_request", {
      url: "https://api.example.com",
    })).toEqual({ text: "GET https://api.example.com", isWarning: false });
  });

  it("shows warning when url is empty", () => {
    expect(getConfigSummary("http_request", { url: "" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== database_query =====
describe("database_query summary", () => {
  it("formats query type and first line", () => {
    expect(getConfigSummary("database_query", {
      queryType: "select",
      query: "SELECT * FROM users\nWHERE active = true",
    })).toEqual({ text: "SELECT \u00b7 SELECT * FROM users", isWarning: false });
  });

  it("shows warning when query is empty", () => {
    expect(getConfigSummary("database_query", { query: "" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== slack =====
describe("slack summary", () => {
  it("formats action and channel", () => {
    expect(getConfigSummary("slack", {
      action: "send_message",
      channel: "#general",
    })).toEqual({ text: "send_message \u00b7 #general", isWarning: false });
  });

  it("shows action only when no channel", () => {
    expect(getConfigSummary("slack", {
      action: "list_channels",
    })).toEqual({ text: "list_channels", isWarning: false });
  });

  it("shows warning when action is empty", () => {
    expect(getConfigSummary("slack", { action: "" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== send_email =====
describe("send_email summary", () => {
  it("formats single recipient", () => {
    expect(getConfigSummary("send_email", {
      to: "user@example.com",
    })).toEqual({ text: "to: user@example.com", isWarning: false });
  });

  it("formats multiple recipients with count", () => {
    expect(getConfigSummary("send_email", {
      to: "a@test.com, b@test.com, c@test.com",
    })).toEqual({ text: "to: a@test.com, +2", isWarning: false });
  });

  it("shows warning when to is empty", () => {
    expect(getConfigSummary("send_email", { to: "" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== transform =====
describe("transform summary", () => {
  it("shows operation count", () => {
    expect(getConfigSummary("transform", {
      operations: [
        { type: "set_field", field: "a", params: "" },
        { type: "rename_field", field: "b", params: "" },
        { type: "remove_field", field: "c", params: "" },
      ],
    })).toEqual({ text: "3 operations", isWarning: false });
  });

  it("shows warning when operations is empty", () => {
    expect(getConfigSummary("transform", { operations: [] })).toEqual(NOT_CONFIGURED);
  });
});

// ===== code =====
describe("code summary", () => {
  it("formats language and line count", () => {
    expect(getConfigSummary("code", {
      language: "javascript",
      code: "const a = 1;\nconst b = 2;\nreturn a + b;",
    })).toEqual({ text: "JavaScript \u00b7 3 lines", isWarning: false });
  });

  it("handles single line code", () => {
    expect(getConfigSummary("code", {
      language: "javascript",
      code: "return 42;",
    })).toEqual({ text: "JavaScript \u00b7 1 line", isWarning: false });
  });

  it("shows warning when code is empty", () => {
    expect(getConfigSummary("code", { code: "" })).toEqual(NOT_CONFIGURED);
  });

  it("capitalizes known languages correctly", () => {
    expect(getConfigSummary("code", {
      language: "typescript",
      code: "const x = 1;",
    })).toEqual({ text: "TypeScript \u00b7 1 line", isWarning: false });

    expect(getConfigSummary("code", {
      language: "python",
      code: "x = 1\ny = 2",
    })).toEqual({ text: "Python \u00b7 2 lines", isWarning: false });
  });

  it("falls back to capitalized language name for unknown languages", () => {
    expect(getConfigSummary("code", {
      language: "ruby",
      code: "puts 'hello'",
    })).toEqual({ text: "Ruby \u00b7 1 line", isWarning: false });
  });
});

// ===== carousel =====
describe("carousel summary", () => {
  it("formats layout and titleField in dynamic mode", () => {
    expect(getConfigSummary("carousel", {
      layout: "card",
      titleField: "name",
      mode: "dynamic",
    })).toEqual({ text: "card \u00b7 name", isWarning: false });
  });

  it("formats static mode with item count", () => {
    expect(getConfigSummary("carousel", {
      layout: "image",
      mode: "static",
      items: [{ id: 1, title: "a" }, { id: 2, title: "b" }],
    })).toEqual({ text: "image \u00b7 2 items", isWarning: false });
  });

  it("shows layout only when dynamic mode has no titleField", () => {
    expect(getConfigSummary("carousel", {
      layout: "minimal",
      mode: "dynamic",
    })).toEqual({ text: "minimal", isWarning: false });
  });

  it("defaults layout to card when not set", () => {
    expect(getConfigSummary("carousel", {
      mode: "static",
      items: [{ id: 1, title: "a" }],
    })).toEqual({ text: "card \u00b7 1 items", isWarning: false });
  });

  it("defaults layout to card in dynamic mode", () => {
    expect(getConfigSummary("carousel", {
      mode: "dynamic",
      titleField: "name",
    })).toEqual({ text: "card \u00b7 name", isWarning: false });
  });
});

// ===== table =====
describe("table summary", () => {
  it("formats column count with pagination in dynamic mode", () => {
    expect(getConfigSummary("table", {
      columns: [
        { field: "name", label: "Name" },
        { field: "age", label: "Age" },
        { field: "email", label: "Email" },
      ],
      pagination: true,
    })).toEqual({ text: "dynamic \u00b7 3 columns \u00b7 pagination", isWarning: false });
  });

  it("omits pagination when false", () => {
    expect(getConfigSummary("table", {
      columns: [{ field: "name", label: "Name" }],
      pagination: false,
    })).toEqual({ text: "dynamic \u00b7 1 column", isWarning: false });
  });

  it("shows pagination by default when pagination is undefined", () => {
    expect(getConfigSummary("table", {
      columns: [{ field: "name", label: "Name" }],
    })).toEqual({ text: "dynamic \u00b7 1 column \u00b7 pagination", isWarning: false });
  });

  it("shows static mode label", () => {
    expect(getConfigSummary("table", {
      mode: "static",
      columns: [{ field: "col0", label: "Item" }],
    })).toEqual({ text: "static \u00b7 1 column \u00b7 pagination", isWarning: false });
  });

  it("shows warning when columns is empty", () => {
    expect(getConfigSummary("table", { columns: [] })).toEqual(NOT_CONFIGURED);
  });
});

// ===== chart =====
describe("chart summary", () => {
  it("formats chart type and axes", () => {
    expect(getConfigSummary("chart", {
      chartType: "bar",
      xAxisField: "month",
      yAxisField: "revenue",
    })).toEqual({ text: "bar \u00b7 month / revenue", isWarning: false });
  });

  it("shows warning when required fields are missing", () => {
    expect(getConfigSummary("chart", { chartType: "bar" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== form =====
describe("form summary", () => {
  it("formats field count and title", () => {
    expect(getConfigSummary("form", {
      fields: [
        { name: "name", type: "text" },
        { name: "email", type: "email" },
        { name: "message", type: "textarea" },
      ],
      title: "Approval",
    })).toEqual({ text: '3 fields \u00b7 "Approval"', isWarning: false });
  });

  it("omits title when empty", () => {
    expect(getConfigSummary("form", {
      fields: [{ name: "name", type: "text" }],
    })).toEqual({ text: "1 field", isWarning: false });
  });

  it("shows warning when fields is empty", () => {
    expect(getConfigSummary("form", { fields: [] })).toEqual(NOT_CONFIGURED);
  });
});

// ===== template =====
describe("template summary", () => {
  it("formats output format and line count", () => {
    expect(getConfigSummary("template", {
      template: "<h1>Title</h1>\n<p>Body</p>\n<footer>End</footer>",
      outputFormat: "html",
    })).toEqual({ text: "html \u00b7 3 lines", isWarning: false });
  });

  it("shows warning when template is empty", () => {
    expect(getConfigSummary("template", { template: "" })).toEqual(NOT_CONFIGURED);
  });
});

// ===== pdf =====
describe("pdf summary", () => {
  it("formats page size, orientation and filename", () => {
    expect(getConfigSummary("pdf", {
      template: "<html>...</html>",
      pageSize: "A4",
      orientation: "portrait",
      fileName: "report.pdf",
    })).toEqual({ text: "A4 portrait \u00b7 report.pdf", isWarning: false });
  });

  it("shows warning when template is empty", () => {
    expect(getConfigSummary("pdf", { template: "" })).toEqual(NOT_CONFIGURED);
  });

  it("uses default values when optional fields are missing", () => {
    expect(getConfigSummary("pdf", {
      template: "<html>content</html>",
    })).toEqual({ text: "A4 portrait \u00b7 document.pdf", isWarning: false });
  });
});

// ===== ai_agent =====
describe("ai_agent summary", () => {
  it("formats model with tools and KB", () => {
    expect(getConfigSummary("ai_agent", {
      model: "gpt-4o",
      toolNodeIds: ["t1", "t2"],
      knowledgeBases: ["kb1"],
    })).toEqual({ text: "gpt-4o \u00b7 2 tools \u00b7 1 KB", isWarning: false });
  });

  it("formats model only", () => {
    expect(getConfigSummary("ai_agent", {
      model: "claude-sonnet",
    })).toEqual({ text: "claude-sonnet", isWarning: false });
  });

  it("shows configured when llmConfigId set but no model", () => {
    expect(getConfigSummary("ai_agent", {
      llmConfigId: "config-uuid",
    })).toEqual({ text: "Configured", isWarning: false });
  });

  it("shows multi_turn mode prefix", () => {
    expect(getConfigSummary("ai_agent", {
      mode: "multi_turn",
      llmConfigId: "config-uuid",
      model: "gpt-4o",
    })).toEqual({ text: "Multi Turn \u00b7 gpt-4o", isWarning: false });
  });

  it("shows multi_turn without model", () => {
    expect(getConfigSummary("ai_agent", {
      mode: "multi_turn",
      llmConfigId: "config-uuid",
    })).toEqual({ text: "Multi Turn", isWarning: false });
  });

  it("shows warning when neither model nor llmConfigId", () => {
    expect(getConfigSummary("ai_agent", { model: "" })).toEqual(NOT_CONFIGURED);
  });

  it("shows condition count when conditions exist", () => {
    expect(getConfigSummary("ai_agent", {
      model: "gpt-4o",
      conditions: [
        { id: "c1", label: "Refund", prompt: "refund request" },
        { id: "c2", label: "Escalation", prompt: "needs expert" },
      ],
    })).toEqual({ text: "gpt-4o \u00b7 2 cond", isWarning: false });
  });

  it("shows tools, KB, and conditions together", () => {
    expect(getConfigSummary("ai_agent", {
      model: "gpt-4o",
      toolNodeIds: ["t1"],
      knowledgeBases: ["kb1"],
      conditions: [{ id: "c1", label: "Cond", prompt: "test" }],
    })).toEqual({ text: "gpt-4o \u00b7 1 tools \u00b7 1 KB \u00b7 1 cond", isWarning: false });
  });

  it("does not show cond suffix when conditions array is empty", () => {
    expect(getConfigSummary("ai_agent", {
      model: "gpt-4o",
      conditions: [],
    })).toEqual({ text: "gpt-4o", isWarning: false });
  });
});

// ===== text_classifier =====
describe("text_classifier summary", () => {
  it("formats model and category count", () => {
    expect(getConfigSummary("text_classifier", {
      model: "gpt-4o-mini",
      categories: [
        { name: "positive" },
        { name: "negative" },
        { name: "neutral" },
      ],
    })).toEqual({ text: "gpt-4o-mini \u00b7 3 categories", isWarning: false });
  });

  it("shows warning when model or categories are empty", () => {
    expect(getConfigSummary("text_classifier", { model: "gpt-4o" })).toEqual(NOT_CONFIGURED);
    expect(getConfigSummary("text_classifier", { categories: [{ name: "a" }] })).toEqual(NOT_CONFIGURED);
  });
});

// ===== information_extractor =====
describe("information_extractor summary", () => {
  it("formats model and field count", () => {
    expect(getConfigSummary("information_extractor", {
      model: "claude-sonnet",
      outputSchema: [
        { name: "name" },
        { name: "email" },
        { name: "phone" },
        { name: "address" },
      ],
    })).toEqual({ text: "claude-sonnet \u00b7 4 fields", isWarning: false });
  });

  it("shows warning when model or outputSchema are empty", () => {
    expect(getConfigSummary("information_extractor", { model: "gpt-4o" })).toEqual(NOT_CONFIGURED);
    expect(getConfigSummary("information_extractor", { outputSchema: [{ name: "a" }] })).toEqual(NOT_CONFIGURED);
  });
});
