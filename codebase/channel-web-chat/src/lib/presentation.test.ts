import { describe, it, expect } from "vitest";
import {
  classifyPresentation,
  isSafeUrl,
  toCarousel,
  toChart,
  toTable,
  toTemplate,
} from "./presentation";

describe("classifyPresentation", () => {
  it("chart — chartType 또는 output.data", () => {
    expect(classifyPresentation({ config: { chartType: "bar" } })).toBe("chart");
    expect(classifyPresentation({ output: { data: [{ x: 1, y: 2 }] } })).toBe("chart");
  });
  it("template — output.rendered 또는 config.template", () => {
    expect(classifyPresentation({ output: { rendered: "hi" } })).toBe("template");
    expect(classifyPresentation({ config: { template: "{{x}}" } })).toBe("template");
  });
  it("table — output.rows 또는 config.columns", () => {
    expect(classifyPresentation({ output: { rows: [] } })).toBe("table");
    expect(classifyPresentation({ config: { columns: [{ field: "a", label: "A" }] } })).toBe(
      "table",
    );
  });
  it("carousel — items 또는 layout", () => {
    expect(classifyPresentation({ output: { items: [] } })).toBe("carousel");
    expect(classifyPresentation({ config: { layout: "card" } })).toBe("carousel");
  });
  it("모르는 shape → null", () => {
    expect(classifyPresentation({ config: {}, output: {} })).toBeNull();
    expect(classifyPresentation(null)).toBeNull();
    expect(classifyPresentation("x")).toBeNull();
  });
});

describe("converters", () => {
  it("toCarousel — dynamic output.items 우선, layout 기본 card", () => {
    const c = toCarousel({
      config: { layout: "image", buttons: [{ id: "b1", label: "Go", type: "link", url: "u" }] },
      output: { items: [{ title: "T", description: "D", image: "i" }] },
    });
    expect(c.layout).toBe("image");
    expect(c.items).toEqual([{ title: "T", description: "D", image: "i", buttons: [] }]);
    expect(c.buttons[0]).toMatchObject({ id: "b1", type: "link", url: "u" });
  });
  it("toCarousel — static config.items 폴백, 잘못된 layout → card", () => {
    const c = toCarousel({ config: { mode: "static", layout: "weird", items: [{ title: "S" }] } });
    expect(c.layout).toBe("card");
    expect(c.items[0].title).toBe("S");
  });
  it("toTable — output.columns/rows", () => {
    const t = toTable({
      output: {
        columns: [{ field: "name", label: "이름" }],
        rows: [{ name: "kim" }],
        rowsTruncated: true,
      },
    });
    expect(t.columns).toEqual([{ field: "name", label: "이름" }]);
    expect(t.rows).toEqual([{ name: "kim" }]);
    expect(t.truncated).toBe(true);
  });
  it("toChart — points + 기본 bar", () => {
    const c = toChart({ config: { chartType: "weird" }, output: { data: [{ x: "a", y: 3 }] } });
    expect(c.chartType).toBe("bar");
    expect(c.points).toEqual([{ x: "a", y: 3 }]);
  });
  it("toChart — xAxis/yAxis.label 추출", () => {
    const c = toChart({
      config: { chartType: "line", xAxis: { field: "m", label: "월" }, yAxis: { field: "v", label: "매출" } },
      output: { data: [{ x: "1월", y: 5 }] },
    });
    expect(c.xLabel).toBe("월");
    expect(c.yLabel).toBe("매출");
  });
  it("toChart — label 없으면 undefined", () => {
    const c = toChart({ config: { chartType: "bar", xAxis: { field: "m" } }, output: { data: [] } });
    expect(c.xLabel).toBeUndefined();
    expect(c.yLabel).toBeUndefined();
  });
  it("toChart — axisLabel 빈 문자열('') → undefined (I6)", () => {
    const c = toChart({
      config: { chartType: "bar", xAxis: { label: "" }, yAxis: { label: "" } },
      output: { data: [] },
    });
    expect(c.xLabel).toBeUndefined();
    expect(c.yLabel).toBeUndefined();
  });
  it("toTemplate — rendered + 기본 html", () => {
    const t = toTemplate({ config: {}, output: { rendered: "<b>x</b>" } });
    expect(t.outputFormat).toBe("html");
    expect(t.rendered).toBe("<b>x</b>");
  });
  it("버튼 필터 — id/label 없는 항목 제외", () => {
    const c = toCarousel({
      config: { layout: "card", buttons: [{ id: "ok", label: "L" }, { label: "no-id" }, {}] },
    });
    expect(c.buttons).toHaveLength(1);
  });
});

describe("PresentationPayload (AI 에이전트 render_* 도구)", () => {
  // 실 SSE wire 캡처(execution.ai_message.presentations[0]) 축약 — top-level type + .payload 중첩.
  const aiCarousel = {
    type: "carousel",
    toolCallId: "call_test",
    renderedAt: "2026-01-01T00:00:00.000Z",
    payload: {
      mode: "static",
      items: [
        { title: "샘플상품 3", buttons: [{ id: "btn_p10", label: "구매하기", type: "link", style: "primary" }] },
        { title: "샘플상품 1", buttons: [{ id: "btn_p9", label: "구매하기", type: "link", style: "primary" }] },
      ],
      layout: "card",
      itemButtons: [
        { id: "btn_detail_10", label: "자세히 보기", type: "port", style: "outline" },
      ],
      buttons: [{ id: "btn_view_all", label: "전체 상품 보기", type: "link", style: "primary" }],
    },
  };

  it("classifyPresentation — 명시 type 으로 4종 판별(.payload 중첩)", () => {
    expect(classifyPresentation(aiCarousel)).toBe("carousel");
    expect(classifyPresentation({ type: "table", toolCallId: "t", payload: { rows: [] } })).toBe("table");
    expect(classifyPresentation({ type: "chart", toolCallId: "t", payload: { chartType: "bar" } })).toBe("chart");
    expect(classifyPresentation({ type: "template", toolCallId: "t", payload: { content: "hi" } })).toBe(
      "template",
    );
  });

  it("classifyPresentation — payload 없는 type-만 객체는 PresentationPayload 로 보지 않음", () => {
    // payload 누락 → envelope shape 판별로 폴백(여기선 config/output 없어 null)
    expect(classifyPresentation({ type: "carousel" })).toBeNull();
  });

  it("toCarousel — payload.items/layout/global buttons + itemButtons 를 각 item 에 병합", () => {
    const c = toCarousel(aiCarousel);
    expect(c.layout).toBe("card");
    expect(c.items.length).toBe(2);
    expect(c.items[0].title).toBe("샘플상품 3");
    // item.buttons(구매하기) 먼저, itemButtons(자세히 보기) 뒤 — 병합 순서 고정.
    expect(c.items[0].buttons!.map((b) => b.label)).toEqual(["구매하기", "자세히 보기"]);
    // global buttons
    expect(c.buttons.map((b) => b.label)).toEqual(["전체 상품 보기"]);
  });

  it("toTemplate — AI payload 의 content 를 rendered 로 매핑", () => {
    const t = toTemplate({
      type: "template",
      toolCallId: "t",
      payload: { content: "**안내**", outputFormat: "markdown" },
    });
    expect(t.rendered).toBe("**안내**");
    expect(t.outputFormat).toBe("markdown");
  });

  it("toTable — payload.columns/rows + truncated 기본 false", () => {
    const tb = toTable({
      type: "table",
      toolCallId: "t",
      payload: { columns: [{ field: "n", label: "N" }], rows: [{ n: "a" }] },
    });
    expect(tb.rows).toEqual([{ n: "a" }]);
    expect(tb.columns[0].field).toBe("n");
    expect(tb.truncated).toBe(false);
  });

  it("toChart — payload.chartType/data + title/축 라벨", () => {
    const ch = toChart({
      type: "chart",
      toolCallId: "t",
      payload: {
        chartType: "line",
        data: [{ x: "1월", y: 10 }],
        title: "월별",
        xAxis: { label: "월" },
        yAxis: { label: "값" },
      },
    });
    expect(ch.chartType).toBe("line");
    expect(ch.points).toEqual([{ x: "1월", y: 10 }]);
    expect(ch.title).toBe("월별");
    expect(ch.xLabel).toBe("월");
    expect(ch.yLabel).toBe("값");
  });

  it("toTemplate — rendered/content 동시 존재 시 rendered 우선", () => {
    const t = toTemplate({ type: "template", toolCallId: "t", payload: { rendered: "R", content: "C" } });
    expect(t.rendered).toBe("R");
  });

  it("classifyPresentation — payload:null 이면 PresentationPayload 로 보지 않음(null)", () => {
    expect(classifyPresentation({ type: "carousel", payload: null })).toBeNull();
  });

  it("classifyPresentation — form 타입은 fast-path 제외 → null (presentations[] 비대상)", () => {
    expect(classifyPresentation({ type: "form", toolCallId: "t", payload: { fields: [] } })).toBeNull();
  });

  // truncation 은 payload 바깥 top-level 필드(ai-agent §7.10) — payload 만 펼치면 유실된다.
  // 노드 table 은 output.rowsTruncated 를 직접 싣지만(table.handler), AI render_table 은 여기에만 싣는다.
  // spec 6-presentation/0-common §10.4: 두 위치는 "동등한 메타".
  it("toTable — top-level truncation.rowsTruncated 를 truncated 로 흡수", () => {
    const tb = toTable({
      type: "table",
      toolCallId: "t",
      payload: { columns: [{ field: "n", label: "N" }], rows: [{ n: "a" }] },
      truncation: { rowsTruncated: true, rowsTotalCount: 2000 },
    });
    expect(tb.rows).toEqual([{ n: "a" }]);
    expect(tb.truncated).toBe(true);
  });

  // 1MB 초과여도 잘림이 실제로 없었으면 rowsTruncated=false 로 온다(render-tool-provider) — 배너 금지.
  it("toTable — truncation.rowsTruncated=false 면 truncated=false", () => {
    const tb = toTable({
      type: "table",
      toolCallId: "t",
      payload: { rows: [{ n: "a" }] },
      truncation: { rowsTruncated: false, rowsTotalCount: 1 },
    });
    expect(tb.truncated).toBe(false);
  });

  it("toCarousel — top-level truncation 이 있어도 items 파싱은 그대로", () => {
    const c = toCarousel({
      type: "carousel",
      toolCallId: "t",
      payload: { layout: "card", items: [{ title: "A" }] },
      truncation: { itemsTruncated: true, itemsTotalCount: 500 },
    });
    expect(c.items.map((i) => i.title)).toEqual(["A"]);
    expect(c.layout).toBe("card");
  });

  // payload 내부 값이 top-level truncation 에 덮이지 않아야 한다(노드 envelope 의미 보존).
  it("toTable — payload.rowsTruncated=true 는 truncation 부재 시에도 유지", () => {
    const tb = toTable({
      type: "table",
      toolCallId: "t",
      payload: { rows: [{ n: "a" }], rowsTruncated: true },
    });
    expect(tb.truncated).toBe(true);
  });

  // 병합 우선순위 lock-in — spread 순서를 뒤집는 리팩터가 조용히 통과하지 못하게 한다.
  it("toTable — payload 와 truncation 이 같은 키를 가지면 top-level truncation 우선", () => {
    const tb = toTable({
      type: "table",
      toolCallId: "t",
      payload: { rows: [{ n: "a" }], rowsTruncated: true },
      truncation: { rowsTruncated: false },
    });
    expect(tb.truncated).toBe(false);
  });

  // truncation 이 비객체(null/문자열)여도 흡수 로직이 터지지 않아야 한다.
  it("toTable — truncation 이 null/문자열이면 무시(no-op)", () => {
    const base = { type: "table", toolCallId: "t", payload: { rows: [{ n: "a" }] } };
    expect(toTable({ ...base, truncation: null }).truncated).toBe(false);
    expect(toTable({ ...base, truncation: "garbage" }).truncated).toBe(false);
    expect(toTable({ ...base, truncation: null }).rows).toEqual([{ n: "a" }]);
  });

  // 알려진 4개 cap 키만 흡수 — truncation 에 낯선 키가 와도 payload 의 렌더 필드를 덮지 않는다.
  it("toTable — truncation 의 미등록 키는 output 으로 흡수하지 않음", () => {
    const tb = toTable({
      type: "table",
      toolCallId: "t",
      payload: { columns: [{ field: "n", label: "N" }], rows: [{ n: "a" }] },
      // `rows` 는 truncation 예약 키가 아니므로 payload 의 rows 가 살아남아야 한다.
      truncation: { rowsTruncated: true, rows: [] },
    });
    expect(tb.rows).toEqual([{ n: "a" }]);
    expect(tb.truncated).toBe(true);
  });
});

describe("converters — {config,output} envelope 회귀(하위 호환)", () => {
  it("기존 envelope classify/toTemplate 그대로 동작", () => {
    expect(classifyPresentation({ output: { items: [] } })).toBe("carousel");
    expect(toTemplate({ config: {}, output: { rendered: "<b>x</b>" } }).rendered).toBe("<b>x</b>");
  });

  it("노드 카루셀 envelope 의 config.itemButtons 도 각 item 에 병합(AI 경로와 동일)", () => {
    const c = toCarousel({
      config: { layout: "card", itemButtons: [{ id: "d", label: "자세히", type: "port" }] },
      output: { items: [{ title: "X", buttons: [{ id: "b", label: "사기", type: "port" }] }] },
    });
    expect(c.items[0].buttons!.map((b) => b.label)).toEqual(["사기", "자세히"]);
  });
});

describe("isSafeUrl", () => {
  it("http:/https: URL 허용", () => {
    expect(isSafeUrl("https://example.com/img.png")).toBe(true);
    expect(isSafeUrl("http://example.com/page")).toBe(true);
  });
  it("javascript: 스킴 차단 (W1 XSS)", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("  javascript:alert(1)")).toBe(false); // leading whitespace
    expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false); // case-insensitive
  });
  it("data: 스킴 차단 (W1 XSS)", () => {
    expect(isSafeUrl("data:text/html,<h1>hi</h1>")).toBe(false);
  });
  it("vbscript: 스킴 차단", () => {
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
  });
  it("blob: 스킴 차단 (W1 XSS)", () => {
    expect(isSafeUrl("blob:https://example.com/some-uuid")).toBe(false);
  });
  it("file: 스킴 차단 (W1 XSS)", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("FILE:///etc/passwd")).toBe(false); // case-insensitive
  });
  it("프로토콜-상대 URL(//) 허용", () => {
    expect(isSafeUrl("//cdn.example.com/img.png")).toBe(true);
  });
  it("상대 경로 허용", () => {
    expect(isSafeUrl("/images/photo.png")).toBe(true);
    expect(isSafeUrl("images/photo.png")).toBe(true);
  });
});

describe("isSafeUrl in button/carousel", () => {
  it("asButtons: javascript: url → url undefined (W1)", () => {
    const c = toCarousel({
      config: {
        layout: "card",
        buttons: [{ id: "b1", label: "악성", type: "link", url: "javascript:alert(1)" }],
      },
    });
    expect(c.buttons[0].url).toBeUndefined();
  });
  it("toCarousel: javascript: image src → image undefined (I4)", () => {
    const c = toCarousel({
      output: { items: [{ title: "T", image: "javascript:alert(1)" }] },
    });
    expect(c.items[0].image).toBeUndefined();
  });
  it("toCarousel: https: image src → 유지", () => {
    const c = toCarousel({
      output: { items: [{ title: "T", image: "https://cdn.example.com/img.png" }] },
    });
    expect(c.items[0].image).toBe("https://cdn.example.com/img.png");
  });
});

describe("toTable — config 폴백 (I15)", () => {
  it("config.columns 폴백 — output.columns 없을 때", () => {
    const t = toTable({
      config: { columns: [{ field: "id", label: "ID" }] },
      output: { rows: [{ id: 1 }] },
    });
    expect(t.columns).toEqual([{ field: "id", label: "ID" }]);
    expect(t.rows).toEqual([{ id: 1 }]);
  });
  it("config.rows 폴백 — output.rows 없을 때", () => {
    const t = toTable({
      config: { columns: [{ field: "x", label: "X" }], rows: [{ x: "v" }] },
    });
    expect(t.rows).toEqual([{ x: "v" }]);
  });
  it("column label 없으면 field 값으로 fallback", () => {
    const t = toTable({
      config: { columns: [{ field: "name" }] },
    });
    expect(t.columns[0].label).toBe("name");
  });
});
