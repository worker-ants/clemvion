# 동시성(Concurrency) Review Payload

본 파일은 orchestrator 가 동시성(Concurrency) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 동시성/병렬 처리 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

> 변경 코드가 본 reviewer 의 영역과 무관하면 "해당 없음" 으로 응답하고
> 위험도를 NONE 으로 설정해 `STATUS=success ISSUES=0` 으로 반환합니다.

## 점검 관점 (동시성(Concurrency))

1. **경쟁 조건(Race Condition)**: 공유 자원 동시 접근으로 인한 경쟁 조건
2. **데드락**: 여러 락 사용 시 데드락 가능성
3. **동기화**: 공유 자원에 대한 적절한 동기화 (mutex/semaphore/lock)
4. **스레드 안전성**: 변수·컬렉션·객체의 스레드 세이프 여부
5. **async/await**: 비동기 코드의 올바른 사용, await 누락
6. **원자성**: 복합 연산의 원자성 보장
7. **이벤트 루프**: 이벤트 루프 블로킹·콜백 지옥·Promise 체인 관리
8. **리소스 풀링**: 스레드 풀·커넥션 풀의 크기·관리

## 리뷰 대상 파일

### 파일 1: frontend/src/components/editor/run-results/__tests__/presentation-renderers.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/components/editor/run-results/__tests__/presentation-renderers.test.tsx b/frontend/src/components/editor/run-results/__tests__/presentation-renderers.test.tsx
index 56f75aad..bffe9b93 100644
--- a/frontend/src/components/editor/run-results/__tests__/presentation-renderers.test.tsx
+++ b/frontend/src/components/editor/run-results/__tests__/presentation-renderers.test.tsx
@@ -1,5 +1,5 @@
-import { describe, it, expect } from "vitest";
-import { render, screen } from "@testing-library/react";
+import { describe, it, expect, vi } from "vitest";
+import { render, screen, fireEvent } from "@testing-library/react";
 import {
   PresentationContent,
   JsonContent,
@@ -113,7 +113,8 @@ describe("PresentationContent", () => {
         />,
       );
 
-      // rendered 가 없으면 TemplateContent 가 JsonContent 로 fallback (data = output)
+      // rendered 가 없으면 TemplateContent 가 null 반환 → 공유 Output Data 섹션의
+      // JsonContent 만 표시 (data = output, "foo": "bar" 포함)
       expect(screen.getByText(/"foo": "bar"/)).toBeDefined();
     });
 
@@ -280,4 +281,166 @@ describe("PresentationContent", () => {
       expect(approve?.className).toContain("bg-[hsl(var(--primary))]");
     });
   });
+
+  describe("Template global buttons", () => {
+    // Spec 4-nodes/6-presentation/0-common.md §1, §6.5 and 5-template.md §1, §5.4 —
+    // Template supports ButtonDef and must render a button bar below its rendered
+    // content while waiting_for_input (and keep the selected button highlighted
+    // after resume).
+    it("renders global buttons from envelope config.buttonConfig", () => {
+      render(
+        <PresentationContent
+          result={makeResult({
+            nodeType: "template",
+            outputData: {
+              config: {
+                outputFormat: "html",
+                template: "<h1>Hello</h1>",
+                buttonConfig: {
+                  buttons: [
+                    { id: "approve", label: "Approve", type: "port" },
+                    { id: "reject", label: "Reject", type: "port" },
+                  ],
+                },
+              },
+              output: { rendered: "<h1>Hello</h1>" },
+              status: "waiting_for_input",
+              meta: { interactionType: "buttons" },
+            },
+          })}
+          onPortButtonClick={() => {}}
+        />,
+      );
+
+      expect(screen.getByText("Approve")).toBeDefined();
+      expect(screen.getByText("Reject")).toBeDefined();
+    });
+
+    it("still renders buttons from legacy flat data.buttonConfig", () => {
+      render(
+        <PresentationContent
+          result={makeResult({
+            nodeType: "template",
+            outputData: {
+              rendered: "Hello plaintext",
+              buttonConfig: {
+                buttons: [{ id: "ok", label: "OK", type: "port" }],
+              },
+            },
+          })}
+          onPortButtonClick={() => {}}
+        />,
+      );
+
+      expect(screen.getByText("OK")).toBeDefined();
+    });
+
+    it("invokes onPortButtonClick for port-type buttons", () => {
+      const handler = vi.fn();
+      render(
+        <PresentationContent
+          result={makeResult({
+            nodeType: "template",
+            outputData: {
+              config: {
+                outputFormat: "text",
+                buttonConfig: {
+                  buttons: [{ id: "approve", label: "Approve", type: "port" }],
+                },
+              },
+              output: { rendered: "ready" },
+              status: "waiting_for_input",
+            },
+          })}
+          onPortButtonClick={handler}
+        />,
+      );
+
+      fireEvent.click(screen.getByText("Approve"));
+      expect(handler).toHaveBeenCalledWith("approve");
+    });
+
+    it("invokes onLinkButtonClick for link-type buttons", () => {
+      const linkHandler = vi.fn();
+      render(
+        <PresentationContent
+          result={makeResult({
+            nodeType: "template",
+            outputData: {
+              config: {
+                outputFormat: "text",
+                buttonConfig: {
+                  buttons: [
+                    {
+                      id: "docs",
+                      label: "Docs",
+                      type: "link",
+                      url: "https://example.com",
+                    },
+                  ],
+                },
+              },
+              output: { rendered: "ready" },
+              status: "waiting_for_input",
+            },
+          })}
+          onLinkButtonClick={linkHandler}
+        />,
+      );
+
+      fireEvent.click(screen.getByText("Docs"));
+      expect(linkHandler).toHaveBeenCalledWith("https://example.com");
+    });
+
+    it("highlights selected button on resumed shape", () => {
+      render(
+        <PresentationContent
+          result={makeResult({
+            nodeType: "template",
+            status: "completed",
+            outputData: {
+              config: {
+                outputFormat: "text",
+                buttonConfig: {
+                  buttons: [
+                    { id: "approve", label: "Approve", type: "port" },
+                    { id: "reject", label: "Reject", type: "port" },
+                  ],
+                },
+              },
+              output: {
+                interaction: {
+                  interactionType: "button_click",
+                  buttonId: "approve",
+                },
+                previousOutput: { rendered: "snapshot" },
+              },
+              status: "button_click",
+            },
+          })}
+        />,
+      );
+
+      const approve = screen.getByText("Approve").closest("button");
+      expect(approve).not.toBeNull();
+      expect(approve?.className).toContain("bg-[hsl(var(--primary))]");
+    });
+
+    it("renders no button bar when buttonConfig is absent", () => {
+      render(
+        <PresentationContent
+          result={makeResult({
+            outputData: {
+              config: { outputFormat: "text" },
+              output: { rendered: "Plain content" },
+            },
+          })}
+        />,
+      );
+
+      // Rendered content stays intact, but no buttons surface.
+      expect(screen.getByText("Plain content")).toBeDefined();
+      expect(screen.queryByRole("button")).toBeNull();
+    });
+  });
 });

```

#### 전체 파일 컨텍스트
```
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PresentationContent,
  JsonContent,
} from "../renderers/presentation-renderers";
import type { NodeResult } from "@/lib/stores/execution-store";

function makeResult(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    nodeId: "n1",
    nodeLabel: "Template Node",
    nodeType: "template",
    nodeCategory: "presentation",
    status: "completed",
    duration: 3,
    outputData: {
      config: { outputFormat: "text" },
      output: { rendered: "Hello World" },
    },
    ...overrides,
  };
}

describe("JsonContent", () => {
  it("renders JSON formatted output", () => {
    render(<JsonContent data={{ key: "value" }} />);
    expect(screen.getByText(/"key": "value"/)).toBeDefined();
  });

  it("renders null gracefully", () => {
    render(<JsonContent data={null} />);
    expect(screen.getByText("null")).toBeDefined();
  });
});

describe("PresentationContent", () => {
  describe("TemplateContent", () => {
    it("renders text preview with resolved content", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "text" },
              output: { rendered: "Score: 95, User: Alice" },
            },
          })}
        />,
      );

      expect(screen.getByText("Preview (text)")).toBeDefined();
      expect(screen.getByText("Score: 95, User: Alice")).toBeDefined();
    });

    it("renders html preview", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "html" },
              output: { rendered: "<h1>Title</h1><p>Paragraph</p>" },
            },
          })}
        />,
      );

      expect(screen.getByText("Preview (html)")).toBeDefined();
      expect(screen.getByText("Title")).toBeDefined();
      expect(screen.getByText("Paragraph")).toBeDefined();
    });

    it("renders markdown preview", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "markdown" },
              output: { rendered: "# Heading" },
            },
          })}
        />,
      );

      expect(screen.getByText("Preview (markdown)")).toBeDefined();
      expect(screen.getByText("Heading")).toBeDefined();
    });

    it("shows Output Data section with raw JSON", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "text" },
              output: { rendered: "Hello" },
            },
          })}
        />,
      );

      expect(screen.getByText("Output Data")).toBeDefined();
      expect(screen.getByText(/"rendered": "Hello"/)).toBeDefined();
    });

    it("falls back to JsonContent when rendered is missing", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "html" },
              output: { foo: "bar" },
            },
          })}
        />,
      );

      // rendered 가 없으면 TemplateContent 가 null 반환 → 공유 Output Data 섹션의
      // JsonContent 만 표시 (data = output, "foo": "bar" 포함)
      expect(screen.getByText(/"foo": "bar"/)).toBeDefined();
    });

    it("defaults to text format when outputFormat is not specified", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: {},
              output: { rendered: "Plain text" },
            },
          })}
        />,
      );

      expect(screen.getByText("Preview (text)")).toBeDefined();
      expect(screen.getByText("Plain text")).toBeDefined();
    });
  });

  describe("routing to correct renderer", () => {
    it("renders TableContent for table node type", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "table",
            outputData: {
              rows: [{ name: "Alice" }],
              columns: ["name"],
            },
          })}
        />,
      );

      expect(screen.getByText("Alice")).toBeDefined();
    });

    it("renders JsonContent for unknown presentation node type", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "unknown_type" as string,
            outputData: { foo: "bar" },
          })}
        />,
      );

      expect(screen.getByText(/"foo": "bar"/)).toBeDefined();
    });

    it("renders FormSubmittedContent for form node type", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "form",
            outputData: {
              submittedData: { approved: "yes" },
            },
          })}
        />,
      );

      expect(screen.getByText("approved:")).toBeDefined();
      expect(screen.getByText("yes")).toBeDefined();
    });
  });

  describe("Carousel global buttons (new NodeHandlerOutput shape)", () => {
    it("renders global buttons from envelope config.buttonConfig", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "carousel",
            outputData: {
              config: {
                layout: "card",
                mode: "static",
                buttonConfig: {
                  buttons: [
                    { id: "approve", label: "Approve", type: "port" },
                    { id: "reject", label: "Reject", type: "port" },
                  ],
                },
              },
              output: {
                type: "carousel",
                layout: "card",
                items: [{ title: "Item 1", description: "desc" }],
                rendered: "<div class=\"carousel\"><div>Item 1</div></div>",
              },
              status: "waiting_for_input",
              meta: { interactionType: "buttons" },
            },
          })}
          onPortButtonClick={() => {}}
        />,
      );

      expect(screen.getByText("Approve")).toBeDefined();
      expect(screen.getByText("Reject")).toBeDefined();
    });

    it("still renders buttons from legacy flat data.buttonConfig", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "carousel",
            outputData: {
              type: "carousel",
              layout: "card",
              items: [{ title: "Item 1" }],
              rendered: "<div class=\"carousel\"><div>Item 1</div></div>",
              buttonConfig: {
                buttons: [{ id: "ok", label: "OK", type: "port" }],
              },
            },
          })}
          onPortButtonClick={() => {}}
        />,
      );

      expect(screen.getByText("OK")).toBeDefined();
    });

    it("renders items and highlights selected button on structured resume shape", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "carousel",
            status: "completed",
            outputData: {
              config: {
                layout: "card",
                buttonConfig: {
                  buttons: [
                    { id: "approve", label: "Approve", type: "port" },
                    { id: "reject", label: "Reject", type: "port" },
                  ],
                },
              },
              output: {
                interaction: {
                  interactionType: "button_click",
                  buttonId: "approve",
                },
                previousOutput: {
                  type: "carousel",
                  layout: "card",
                  items: [{ title: "Item 1", description: "desc" }],
                  rendered:
                    "<div class=\"carousel\"><div>Item 1</div></div>",
                },
              },
              status: "button_click",
            },
          })}
        />,
      );

      expect(screen.getByText("Item 1")).toBeDefined();
      const approve = screen.getByText("Approve").closest("button");
      expect(approve).not.toBeNull();
      // Selected button carries primary-color classes in the renderer's styling.
      expect(approve?.className).toContain("bg-[hsl(var(--primary))]");
    });
  });

  describe("Template global buttons", () => {
    // Spec 4-nodes/6-presentation/0-common.md §1, §6.5 and 5-template.md §1, §5.4 —
    // Template supports ButtonDef and must render a button bar below its rendered
    // content while waiting_for_input (and keep the selected button highlighted
    // after resume).
    it("renders global buttons from envelope config.buttonConfig", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: {
                outputFormat: "html",
                template: "<h1>Hello</h1>",
                buttonConfig: {
                  buttons: [
                    { id: "approve", label: "Approve", type: "port" },
                    { id: "reject", label: "Reject", type: "port" },
                  ],
                },
              },
              output: { rendered: "<h1>Hello</h1>" },
              status: "waiting_for_input",
              meta: { interactionType: "buttons" },
            },
          })}
          onPortButtonClick={() => {}}
        />,
      );

      expect(screen.getByText("Approve")).toBeDefined();
      expect(screen.getByText("Reject")).toBeDefined();
    });

    it("still renders buttons from legacy flat data.buttonConfig", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              rendered: "Hello plaintext",
              buttonConfig: {
                buttons: [{ id: "ok", label: "OK", type: "port" }],
              },
            },
          })}
          onPortButtonClick={() => {}}
        />,
      );

      expect(screen.getByText("OK")).toBeDefined();
    });

    it("invokes onPortButtonClick for port-type buttons", () => {
      const handler = vi.fn();
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: {
                outputFormat: "text",
                buttonConfig: {
                  buttons: [{ id: "approve", label: "Approve", type: "port" }],
                },
              },
              output: { rendered: "ready" },
              status: "waiting_for_input",
            },
          })}
          onPortButtonClick={handler}
        />,
      );

      fireEvent.click(screen.getByText("Approve"));
      expect(handler).toHaveBeenCalledWith("approve");
    });

    it("invokes onLinkButtonClick for link-type buttons", () => {
      const linkHandler = vi.fn();
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: {
                outputFormat: "text",
                buttonConfig: {
                  buttons: [
                    {
                      id: "docs",
                      label: "Docs",
                      type: "link",
                      url: "https://example.com",
                    },
                  ],
                },
              },
              output: { rendered: "ready" },
              status: "waiting_for_input",
            },
          })}
          onLinkButtonClick={linkHandler}
        />,
      );

      fireEvent.click(screen.getByText("Docs"));
      expect(linkHandler).toHaveBeenCalledWith("https://example.com");
    });

    it("highlights selected button on resumed shape", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            status: "completed",
            outputData: {
              config: {
                outputFormat: "text",
                buttonConfig: {
                  buttons: [
                    { id: "approve", label: "Approve", type: "port" },
                    { id: "reject", label: "Reject", type: "port" },
                  ],
                },
              },
              output: {
                interaction: {
                  interactionType: "button_click",
                  buttonId: "approve",
                },
                previousOutput: { rendered: "snapshot" },
              },
              status: "button_click",
            },
          })}
        />,
      );

      const approve = screen.getByText("Approve").closest("button");
      expect(approve).not.toBeNull();
      expect(approve?.className).toContain("bg-[hsl(var(--primary))]");
    });

    it("renders no button bar when buttonConfig is absent", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "text" },
              output: { rendered: "Plain content" },
            },
          })}
        />,
      );

      // Rendered content stays intact, but no buttons surface.
      expect(screen.getByText("Plain content")).toBeDefined();
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});

```

---

### 파일 2: frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx b/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx
index 11a92985..0e33793c 100644
--- a/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx
+++ b/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx
@@ -333,66 +333,46 @@ function ChartContent({
 function TemplateContent({
   data,
   config,
-  previewOnly = false,
 }: {
   data: Record<string, unknown>;
   config?: Record<string, unknown>;
-  previewOnly?: boolean;
 }) {
   // Principle 1.1 직교: outputFormat 은 config 리터럴, rendered 는 expression resolver 평가 결과.
   // 옛 `data.format` / `data.content` 잔재는 폐기됨 (Principle 1.1.4, presentation 0-common §4).
   const outputFormat = config?.outputFormat as string | undefined;
   const content = data.rendered as string | undefined;
 
-  if (!content) return <JsonContent data={data} />;
-
-  let preview: React.ReactNode;
+  // When `rendered` is missing, return null so the shared Output Data section
+  // surfaces the raw payload — and the global button bar still renders
+  // underneath (presentation 0-common §6.5: Template button bar must appear
+  // even on partial content).
+  if (!content) return null;
 
   if (outputFormat === "html") {
-    preview = (
-      <div
-        className="prose prose-sm max-w-none overflow-auto text-xs"
-        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
-      />
+    return (
+      <div className="rounded border border-[hsl(var(--border))] p-3">
+        <div
+          className="prose prose-sm max-w-none overflow-auto text-xs"
+          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
+        />
+      </div>
     );
-  } else if (outputFormat === "markdown") {
-    // Convert basic markdown to HTML for preview
-    preview = (
-      <div
-        className="prose prose-sm max-w-none overflow-auto text-xs"
-        dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(content)) }}
-      />
+  }
+  if (outputFormat === "markdown") {
+    return (
+      <div className="rounded border border-[hsl(var(--border))] p-3">
+        <div
+          className="prose prose-sm max-w-none overflow-auto text-xs"
+          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(content)) }}
+        />
+      </div>
     );
-  } else {
-    preview = (
+  }
+  return (
+    <div className="rounded border border-[hsl(var(--border))] p-3">
       <pre className="overflow-auto whitespace-pre-wrap break-words text-xs font-mono bg-[hsl(var(--muted))] rounded p-2">
         {content}
       </pre>
-    );
-  }
-
-  return (
-    <div className="space-y-3">
-      {/* Rendered preview */}
-      <div>
-        {!previewOnly && (
-          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
-            Preview ({outputFormat ?? "text"})
-          </p>
-        )}
-        <div className="rounded border border-[hsl(var(--border))] p-3">
-          {preview}
-        </div>
-      </div>
-      {/* Debug data */}
-      {!previewOnly && (
-        <div>
-          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
-            Output Data
-          </p>
-          <JsonContent data={data} />
-        </div>
-      )}
     </div>
   );
 }
@@ -489,11 +469,6 @@ export function PresentationContent({
       typeof interaction.buttonId === "string" ? interaction.buttonId : undefined;
   }
 
-  // Template already includes its own debug data section
-  if (result.nodeType === "template") {
-    return <TemplateContent data={data} config={envelopeConfig} previewOnly={previewOnly} />;
-  }
-
   let preview: React.ReactNode;
   switch (result.nodeType) {
     case "table":
@@ -516,6 +491,12 @@ export function PresentationContent({
     case "form":
       preview = <FormSubmittedContent data={data} />;
       break;
+    case "template":
+      // Template joins the shared preview + button bar + Output Data flow so
+      // that ButtonDef (spec 4-nodes/6-presentation/0-common.md §1, §6.5 and
+      // 5-template.md §1, §5.4) renders below the rendered content.
+      preview = <TemplateContent data={data} config={envelopeConfig} />;
+      break;
     default:
       return <JsonContent data={data} />;
   }
@@ -542,13 +523,20 @@ export function PresentationContent({
     : allButtons;
   const isInteractive = !!(onPortButtonClick || onLinkButtonClick);
 
+  // Template gets a format suffix in the Preview header so html/markdown/text
+  // rendering mode is visible at a glance (parity with the pre-refactor UX).
+  const previewHeader =
+    result.nodeType === "template"
+      ? `Preview (${(envelopeConfig?.outputFormat as string) ?? "text"})`
+      : "Preview";
+
   return (
     <div className="space-y-3">
       {/* Preview */}
       <div>
         {!previewOnly && (
           <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
-            Preview
+            {previewHeader}
           </p>
         )}
         {preview}

```

#### 전체 파일 컨텍스트
```
"use client";

import DOMPurify from "dompurify";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NodeResult } from "@/lib/stores/execution-store";
import { cn } from "@/lib/utils/cn";

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function isHttpUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "div", "span", "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
    "strong", "em", "b", "i", "u", "code", "pre", "blockquote",
    "svg", "path", "g", "rect", "circle", "line", "polyline", "polygon", "text",
  ],
  ALLOWED_ATTR: [
    "class", "style", "href", "src", "alt", "width", "height",
    "target", "rel", "colspan", "rowspan",
    "viewBox", "d", "fill", "stroke", "stroke-width", "transform",
    "x", "y", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2",
    "font-size", "text-anchor", "dominant-baseline", "points",
  ],
};

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/** Basic markdown to HTML conversion for template preview */
function markdownToHtml(md: string): string {
  return md
    // Headers
    .replace(/^######\s+(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>")
    .replace(/^####\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr>")
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.+)/, "<p>$1")
    .replace(/(.+)$/, "$1</p>");
}

export function JsonContent({ data }: { data: unknown }) {
  return (
    <pre className="overflow-auto whitespace-pre-wrap break-words text-xs font-mono bg-[hsl(var(--muted))] rounded p-2 max-h-[400px]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

interface ColumnDef {
  field: string;
  label: string;
}

function normalizeColumns(raw: unknown, firstRow: unknown): ColumnDef[] {
  if (Array.isArray(raw) && raw.length > 0) {
    // columns can be objects { field, label } or plain strings
    return raw.map((col) => {
      if (typeof col === "object" && col !== null && "field" in col) {
        const c = col as Record<string, unknown>;
        return { field: String(c.field ?? ""), label: String(c.label ?? c.field ?? "") };
      }
      return { field: String(col), label: String(col) };
    });
  }
  // Fallback: infer from first row keys
  if (firstRow && typeof firstRow === "object") {
    return Object.keys(firstRow as Record<string, unknown>).map((k) => ({ field: k, label: k }));
  }
  return [];
}

function TableContent({ data }: { data: Record<string, unknown> }) {
  const rows = data.rows as unknown[] | undefined;
  if (!rows || !Array.isArray(rows)) {
    return <JsonContent data={data} />;
  }
  const columns = normalizeColumns(data.columns, rows[0]);
  if (columns.length === 0) return <JsonContent data={data} />;

  return (
    <div className="overflow-auto rounded border border-[hsl(var(--border))]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            {columns.map((col) => (
              <th
                key={col.field}
                className="px-3 py-1.5 text-left font-medium"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, i) => (
            <tr
              key={i}
              className="border-b border-[hsl(var(--border))] last:border-b-0"
            >
              {columns.map((col) => (
                <td key={col.field} className="px-3 py-1">
                  {String(
                    (row as Record<string, unknown>)[col.field] ?? "",
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CarouselContentProps {
  data: Record<string, unknown>;
  config?: Record<string, unknown>;
  selectedButtonId?: string;
  onPortButtonClick?: (buttonId: string) => void;
  onLinkButtonClick?: (url: string) => void;
}

function CarouselContent({ data, config, selectedButtonId, onPortButtonClick, onLinkButtonClick }: CarouselContentProps) {
  // dynamic 모드: backend 가 `output.items` 채움.
  // static 모드: backend 가 `output: {}` 반환 — 슬라이드 정의는 `config.items` (Principle 1.1 직교).
  const items = ((data.items as
    | Array<{ title?: string; description?: string; image?: string; buttons?: Array<{ id: string; label: string; type?: string; url?: string; style?: string }> }>
    | undefined) ??
    (config?.items as
      | Array<{ title?: string; description?: string; image?: string; buttons?: Array<{ id: string; label: string; type?: string; url?: string; style?: string }> }>
      | undefined)) as
    | Array<{ title?: string; description?: string; image?: string; buttons?: Array<{ id: string; label: string; type?: string; url?: string; style?: string }> }>
    | undefined;

  if (!items || items.length === 0) {
    return (
      <div className="rounded border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
        No items
      </div>
    );
  }

  const isInteractive = !!(onPortButtonClick || onLinkButtonClick);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item, i) => (
        <div
          key={i}
          className="shrink-0 w-[180px] rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2 flex flex-col"
        >
          {isHttpUrl(item.image) && (
            <div className="h-20 rounded bg-[hsl(var(--accent))] mb-1.5 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={item.title ?? ""}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <p className="text-xs font-medium truncate">{item.title}</p>
          {item.description && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] line-clamp-2 mt-0.5">
              {item.description}
            </p>
          )}
          {item.buttons && item.buttons.length > 0 && (
            <div className="mt-auto pt-1.5 flex flex-col gap-1">
              {item.buttons.map((btn) => {
                const isSelected = selectedButtonId === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={!isInteractive && !isSelected}
                    className={cn(
                      "w-full rounded px-2 py-0.5 text-[10px] transition-colors truncate",
                      isSelected
                        ? "border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : isInteractive
                          ? "border border-[hsl(var(--input))] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80 cursor-pointer"
                          : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
                    )}
                    onClick={() => {
                      if (isSelected) return;
                      if (btn.type === "link" && btn.url) {
                        onLinkButtonClick?.(btn.url);
                      } else {
                        onPortButtonClick?.(btn.id);
                      }
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChartContent({
  data,
  config,
}: {
  data: Record<string, unknown>;
  config?: Record<string, unknown>;
}) {
  // 차트 시각화는 client-side recharts 로 렌더링 (Principle 1.1 직교 — chartType/title 은 config 리터럴).
  // backend `output.rendered` (SVG snapshot) 의존은 폐기됨 — `output.data` (런타임 집계) + `config.{chartType, title}` 로 재구성.
  const chartType = (config?.chartType as string) ?? "bar";
  const title = config?.title as string | undefined;
  const points = Array.isArray(data.data) ? (data.data as Array<Record<string, unknown>>) : [];

  if (points.length === 0) return <JsonContent data={data} />;

  const renderChart = () => {
    switch (chartType) {
      case "line":
        return (
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="y" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="y" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} />
          </AreaChart>
        );
      case "pie":
      case "donut":
        return (
          <PieChart>
            <Tooltip />
            <Pie
              data={points}
              dataKey="y"
              nameKey="x"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={chartType === "donut" ? 50 : 0}
              label={(entry: { x: unknown; y: unknown }) => String(entry.x)}
            >
              {points.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );
      case "bar":
      default:
        return (
          <BarChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="y" fill={CHART_COLORS[0]} />
          </BarChart>
        );
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {title && <div className="text-sm font-medium">{title}</div>}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TemplateContent({
  data,
  config,
}: {
  data: Record<string, unknown>;
  config?: Record<string, unknown>;
}) {
  // Principle 1.1 직교: outputFormat 은 config 리터럴, rendered 는 expression resolver 평가 결과.
  // 옛 `data.format` / `data.content` 잔재는 폐기됨 (Principle 1.1.4, presentation 0-common §4).
  const outputFormat = config?.outputFormat as string | undefined;
  const content = data.rendered as string | undefined;

  // When `rendered` is missing, return null so the shared Output Data section
  // surfaces the raw payload — and the global button bar still renders
  // underneath (presentation 0-common §6.5: Template button bar must appear
  // even on partial content).
  if (!content) return null;

  if (outputFormat === "html") {
    return (
      <div className="rounded border border-[hsl(var(--border))] p-3">
        <div
          className="prose prose-sm max-w-none overflow-auto text-xs"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />
      </div>
    );
  }
  if (outputFormat === "markdown") {
    return (
      <div className="rounded border border-[hsl(var(--border))] p-3">
        <div
          className="prose prose-sm max-w-none overflow-auto text-xs"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(content)) }}
        />
      </div>
    );
  }
  return (
    <div className="rounded border border-[hsl(var(--border))] p-3">
      <pre className="overflow-auto whitespace-pre-wrap break-words text-xs font-mono bg-[hsl(var(--muted))] rounded p-2">
        {content}
      </pre>
    </div>
  );
}

function FormSubmittedContent({ data }: { data: Record<string, unknown> }) {
  // Form submission payload lives at `output.interaction.data` per
  // CONVENTIONS §4.5 (Stage 3 of the node-specs-improvement rollout,
  // completed). Legacy executions may still carry `submittedData`
  // (pre-migration) or `formData` (earliest drafts); fall through those
  // paths so historical run records render without a migration backfill.
  const interaction = data.interaction as
    | { data?: unknown }
    | undefined;
  const interactionData =
    interaction && typeof interaction === "object"
      ? (interaction.data as Record<string, unknown> | undefined)
      : undefined;
  const legacyData = (data.submittedData ?? data.formData) as
    | Record<string, unknown>
    | undefined;
  const submittedData = interactionData ?? legacyData;
  if (!submittedData) return <JsonContent data={data} />;
  return (
    <div className="space-y-1 text-xs">
      {Object.entries(submittedData).map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="font-medium text-[hsl(var(--muted-foreground))]">
            {key}:
          </span>
          <span>{String(value)}</span>
        </div>
      ))}
    </div>
  );
}

interface PresentationContentProps {
  result: NodeResult;
  onPortButtonClick?: (buttonId: string) => void;
  onLinkButtonClick?: (url: string) => void;
  /** When true, only render the visual preview without the raw Output Data JSON section */
  previewOnly?: boolean;
}

export function PresentationContent({
  result,
  onPortButtonClick,
  onLinkButtonClick,
  previewOnly = false,
}: PresentationContentProps) {
  // Accept both the legacy flat output and the new
  // `{ config, output, meta?, port?, status? }` shape — payload lives under
  // `output` in the latter.
  const rawInput = result.outputData as Record<string, unknown>;
  const isStructured =
    rawInput !== null &&
    typeof rawInput === "object" &&
    !Array.isArray(rawInput) &&
    "config" in rawInput &&
    "output" in rawInput;
  const envelopeConfig = isStructured
    ? (rawInput.config as Record<string, unknown> | undefined)
    : undefined;
  const unwrapped = isStructured
    ? (rawInput.output as Record<string, unknown>)
    : rawInput;
  const raw = unwrapped;
  if (!raw || typeof raw !== "object") return <JsonContent data={raw} />;

  // Unwrap interaction wrappers so renderers see the original payload fields.
  // Two cases to handle:
  //   (a) Legacy resume flat shape: `{ type: 'button_click', buttonId, nodeOutput }`
  //   (b) Structured resume shape: `{ interaction: {interactionType, buttonId, ...},
  //       selectedItem?, previousOutput }`
  let data = raw;
  let selectedButtonId: string | undefined;

  if (
    raw.type === "button_click" &&
    raw.nodeOutput &&
    typeof raw.nodeOutput === "object"
  ) {
    data = raw.nodeOutput as Record<string, unknown>;
    selectedButtonId = raw.buttonId as string | undefined;
  } else if (
    raw.interaction &&
    typeof raw.interaction === "object" &&
    raw.previousOutput &&
    typeof raw.previousOutput === "object"
  ) {
    data = raw.previousOutput as Record<string, unknown>;
    const interaction = raw.interaction as Record<string, unknown>;
    selectedButtonId =
      typeof interaction.buttonId === "string" ? interaction.buttonId : undefined;
  }

  let preview: React.ReactNode;
  switch (result.nodeType) {
    case "table":
      preview = <TableContent data={data} />;
      break;
    case "carousel":
      preview = (
        <CarouselContent
          data={data}
          config={envelopeConfig}
          selectedButtonId={selectedButtonId}
          onPortButtonClick={onPortButtonClick}
          onLinkButtonClick={onLinkButtonClick}
        />
      );
      break;
    case "chart":
      preview = <ChartContent data={data} config={envelopeConfig} />;
      break;
    case "form":
      preview = <FormSubmittedContent data={data} />;
      break;
    case "template":
      // Template joins the shared preview + button bar + Output Data flow so
      // that ButtonDef (spec 4-nodes/6-presentation/0-common.md §1, §6.5 and
      // 5-template.md §1, §5.4) renders below the rendered content.
      preview = <TemplateContent data={data} config={envelopeConfig} />;
      break;
    default:
      return <JsonContent data={data} />;
  }

  // Extract global buttons (exclude item-level buttons using buttonItemMap).
  // Prefer the new envelope `config.buttonConfig`; fall back to the legacy
  // flat location `data.buttonConfig` so pre-migration payloads keep working.
  const btnConfig = ((envelopeConfig?.buttonConfig as
    | Record<string, unknown>
    | undefined) ??
    (data.buttonConfig as Record<string, unknown> | undefined)) as
    | Record<string, unknown>
    | undefined;
  const allButtons = (btnConfig?.buttons ?? []) as Array<{
    id: string;
    label: string;
    type?: "link" | "port";
    url?: string;
    style?: string;
  }>;
  const buttonItemMap = btnConfig?.buttonItemMap as Record<string, number> | undefined;
  const buttons = buttonItemMap
    ? allButtons.filter((btn) => !(btn.id in buttonItemMap))
    : allButtons;
  const isInteractive = !!(onPortButtonClick || onLinkButtonClick);

  // Template gets a format suffix in the Preview header so html/markdown/text
  // rendering mode is visible at a glance (parity with the pre-refactor UX).
  const previewHeader =
    result.nodeType === "template"
      ? `Preview (${(envelopeConfig?.outputFormat as string) ?? "text"})`
      : "Preview";

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div>
        {!previewOnly && (
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
            {previewHeader}
          </p>
        )}
        {preview}
        {buttons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {buttons.map((btn) => {
              const isSelected = selectedButtonId === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  disabled={!isInteractive && !isSelected}
                  className={cn(
                    "inline-flex items-center rounded-md px-3 py-1 text-xs transition-colors",
                    isSelected
                      ? "border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : isInteractive
                        ? "border border-[hsl(var(--input))] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80 cursor-pointer"
                        : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
                  )}
                  onClick={() => {
                    if (isSelected) return;
                    if (btn.type === "link" && btn.url) {
                      onLinkButtonClick?.(btn.url);
                    } else {
                      onPortButtonClick?.(btn.id);
                    }
                  }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* Debug data */}
      {!previewOnly && (
        <div>
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
            Output Data
          </p>
          <JsonContent data={data} />
        </div>
      )}
    </div>
  );
}

```

---

### 파일 3: plan/in-progress/template-preview-buttons-fix.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/template-preview-buttons-fix.md b/plan/in-progress/template-preview-buttons-fix.md
new file mode 100644
index 00000000..03d2b94f
--- /dev/null
+++ b/plan/in-progress/template-preview-buttons-fix.md
@@ -0,0 +1,62 @@
+---
+worktree: template-buttons-fix-362d73
+started: 2026-05-16
+owner: developer
+---
+
+# Template Preview 버튼 미표시 버그 수정
+
+## 문제
+
+Presentation 5종 중 **Template** 노드만 Run Results Drawer / Executions 페이지의 Preview 탭에 글로벌 ButtonDef 버튼 바가 표시되지 않는다.
+
+### 원인
+
+`frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx:493-495`
+
+```tsx
+// Template already includes its own debug data section
+if (result.nodeType === "template") {
+  return <TemplateContent data={data} config={envelopeConfig} previewOnly={previewOnly} />;
+}
+```
+
+이 early-return 이 함수 하단(라인 555–586) 의 글로벌 버튼 바 렌더링을 스킵.
+
+### Spec 근거 (Template 도 버튼 지원)
+
+- `spec/4-nodes/6-presentation/0-common.md` §1 — "Carousel / Table / Chart / **Template** 노드가 공통으로 사용하는 버튼 정의"
+- `spec/4-nodes/6-presentation/0-common.md` §6.5 — Template "버튼 대기 중 … 렌더링된 콘텐츠 아래 **버튼 바** 표시"
+- `spec/4-nodes/6-presentation/5-template.md` §1 — `buttons: ButtonDef[]` 필드, 1개 이상 시 Blocking Mode
+- `spec/4-nodes/6-presentation/5-template.md` §5.4 — waiting 시 `config.buttonConfig.buttons` 페이로드
+
+## 접근
+
+Template 도 다른 4종과 동일한 `preview + 글로벌 버튼 바` 합성 구조로 통합한다. 단, Template 의 기존 자체 "Output Data" 디버그 섹션은 보존한다.
+
+### 옵션
+
+1. **(채택)** `TemplateContent` 의 자체 "Output Data" 섹션 분리 — `TemplateContent` 는 콘텐츠 preview 만 반환하게 단순화하고, Template 도 switch 분기에 합류시켜 글로벌 버튼 바와 Output Data 섹션을 공유 경로에서 처리.
+2. 거부 — `TemplateContent` 안에 버튼 바 렌더링 코드를 복제 (DRY 위반, allButtons/buttonItemMap 로직 중복).
+
+## 작업 항목
+
+- [ ] (TDD) 실패하는 테스트 추가: Template + buttonConfig 케이스에서 글로벌 버튼이 표시되어야 함
+- [ ] `presentation-renderers.tsx` 의 Template early-return 제거, switch 분기에 합류
+- [ ] `TemplateContent` 시그니처/책임 조정 (자체 Output Data 섹션 → 공통 경로 사용)
+- [ ] 기존 Template 테스트(`renders text/html/markdown preview`, `shows Output Data section`, `falls back to JsonContent`) 가 여전히 통과하는지 확인
+- [ ] frontend lint + unit test + build
+- [ ] /ai-review + RESOLUTION.md
+
+## 영향 범위
+
+- frontend only (UI 렌더링)
+- backend handler 출력 형식 변경 없음 (Template 핸들러는 이미 `config.buttonConfig.buttons` 를 그대로 출력하고 있음 — spec 5-template.md §5.4 가 그 증거)
+- 기존 Template 테스트와의 호환 유지 필요
+
+## 검증
+
+- Template + buttons 케이스: 버튼 클릭 가능 + onPortButtonClick/onLinkButtonClick 호출
+- Template + buttons + selectedButtonId: resumed 상태에서 선택된 버튼 highlight
+- Template without buttons: 기존 렌더링 그대로 (regression 방지)
+- 다른 Presentation 노드 (carousel/table/chart/form): 영향 없음

```

#### 전체 파일 컨텍스트
```
---
worktree: template-buttons-fix-362d73
started: 2026-05-16
owner: developer
---

# Template Preview 버튼 미표시 버그 수정

## 문제

Presentation 5종 중 **Template** 노드만 Run Results Drawer / Executions 페이지의 Preview 탭에 글로벌 ButtonDef 버튼 바가 표시되지 않는다.

### 원인

`frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx:493-495`

```tsx
// Template already includes its own debug data section
if (result.nodeType === "template") {
  return <TemplateContent data={data} config={envelopeConfig} previewOnly={previewOnly} />;
}
```

이 early-return 이 함수 하단(라인 555–586) 의 글로벌 버튼 바 렌더링을 스킵.

### Spec 근거 (Template 도 버튼 지원)

- `spec/4-nodes/6-presentation/0-common.md` §1 — "Carousel / Table / Chart / **Template** 노드가 공통으로 사용하는 버튼 정의"
- `spec/4-nodes/6-presentation/0-common.md` §6.5 — Template "버튼 대기 중 … 렌더링된 콘텐츠 아래 **버튼 바** 표시"
- `spec/4-nodes/6-presentation/5-template.md` §1 — `buttons: ButtonDef[]` 필드, 1개 이상 시 Blocking Mode
- `spec/4-nodes/6-presentation/5-template.md` §5.4 — waiting 시 `config.buttonConfig.buttons` 페이로드

## 접근

Template 도 다른 4종과 동일한 `preview + 글로벌 버튼 바` 합성 구조로 통합한다. 단, Template 의 기존 자체 "Output Data" 디버그 섹션은 보존한다.

### 옵션

1. **(채택)** `TemplateContent` 의 자체 "Output Data" 섹션 분리 — `TemplateContent` 는 콘텐츠 preview 만 반환하게 단순화하고, Template 도 switch 분기에 합류시켜 글로벌 버튼 바와 Output Data 섹션을 공유 경로에서 처리.
2. 거부 — `TemplateContent` 안에 버튼 바 렌더링 코드를 복제 (DRY 위반, allButtons/buttonItemMap 로직 중복).

## 작업 항목

- [ ] (TDD) 실패하는 테스트 추가: Template + buttonConfig 케이스에서 글로벌 버튼이 표시되어야 함
- [ ] `presentation-renderers.tsx` 의 Template early-return 제거, switch 분기에 합류
- [ ] `TemplateContent` 시그니처/책임 조정 (자체 Output Data 섹션 → 공통 경로 사용)
- [ ] 기존 Template 테스트(`renders text/html/markdown preview`, `shows Output Data section`, `falls back to JsonContent`) 가 여전히 통과하는지 확인
- [ ] frontend lint + unit test + build
- [ ] /ai-review + RESOLUTION.md

## 영향 범위

- frontend only (UI 렌더링)
- backend handler 출력 형식 변경 없음 (Template 핸들러는 이미 `config.buttonConfig.buttons` 를 그대로 출력하고 있음 — spec 5-template.md §5.4 가 그 증거)
- 기존 Template 테스트와의 호환 유지 필요

## 검증

- Template + buttons 케이스: 버튼 클릭 가능 + onPortButtonClick/onLinkButtonClick 호출
- Template + buttons + selectedButtonId: resumed 상태에서 선택된 버튼 highlight
- Template without buttons: 기존 렌더링 그대로 (regression 방지)
- 다른 Presentation 노드 (carousel/table/chart/form): 영향 없음

```
