// Presentation payload 타입 + shape 기반 판별. spec/4-nodes/6-presentation/* (zod schema SoT).
// 위젯이 받는 presentations[i] 는 { config, output, meta, port?, status? } flat envelope —
// 명시 type 필드가 없을 수 있어 shape 으로 carousel/table/chart/template 을 추론한다.

export type PresentationKind = "carousel" | "table" | "chart" | "template";

/** presentation 공통 버튼 (presentation/_shared/button.types.ts). */
export interface PresentationButton {
  id: string;
  label: string;
  type?: "link" | "port";
  url?: string;
  style?: "primary" | "secondary" | "outline" | "danger";
}

export interface CarouselItem {
  title?: string;
  description?: string;
  image?: string;
  buttons?: PresentationButton[];
}

export interface CarouselData {
  layout: "card" | "image" | "minimal";
  items: CarouselItem[];
  buttons: PresentationButton[];
}

export interface TableColumn {
  field: string;
  label: string;
}

export interface TableData {
  columns: TableColumn[];
  rows: Array<Record<string, unknown>>;
  buttons: PresentationButton[];
  truncated: boolean;
}

export interface ChartPoint {
  x: unknown;
  y?: number | string;
}

export interface ChartData {
  chartType: "bar" | "line" | "area" | "pie" | "donut";
  title?: string;
  points: ChartPoint[];
  colors: string[];
  buttons: PresentationButton[];
}

export interface TemplateData {
  outputFormat: "html" | "markdown" | "text";
  rendered: string;
  buttons: PresentationButton[];
}

type Envelope = {
  config?: Record<string, unknown>;
  output?: Record<string, unknown>;
};

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asButtons(v: unknown): PresentationButton[] {
  return asArray<Record<string, unknown>>(v)
    .filter((b) => typeof b?.id === "string" && typeof b?.label === "string")
    .map((b) => ({
      id: String(b.id),
      label: String(b.label),
      type: b.type === "link" ? "link" : "port",
      url: typeof b.url === "string" ? b.url : undefined,
      style: typeof b.style === "string" ? (b.style as PresentationButton["style"]) : undefined,
    }));
}

/** shape 으로 presentation 종류 판별. 모르면 null(렌더 skip). */
export function classifyPresentation(p: unknown): PresentationKind | null {
  const env = asRecord(p) as Envelope;
  const config = asRecord(env.config);
  const output = asRecord(env.output);
  // chart: chartType 또는 output.data[{x,y}]
  if (typeof config.chartType === "string" || Array.isArray(output.data)) return "chart";
  // template: output.rendered(string) 또는 config.template(string)
  if (typeof output.rendered === "string" || typeof config.template === "string") return "template";
  // table: output.rows 또는 config.columns
  if (Array.isArray(output.rows) || Array.isArray(config.columns)) return "table";
  // carousel: items 또는 layout
  if (
    Array.isArray(output.items) ||
    Array.isArray(config.items) ||
    typeof config.layout === "string"
  )
    return "carousel";
  return null;
}

const CAROUSEL_LAYOUTS = new Set(["card", "image", "minimal"]);

export function toCarousel(p: unknown): CarouselData {
  const env = asRecord(p) as Envelope;
  const config = asRecord(env.config);
  const output = asRecord(env.output);
  // dynamic 은 output.items, static 은 config.items.
  const rawItems = Array.isArray(output.items) ? output.items : asArray(config.items);
  const items: CarouselItem[] = asArray<Record<string, unknown>>(rawItems).map((it) => ({
    title: typeof it.title === "string" ? it.title : undefined,
    description: typeof it.description === "string" ? it.description : undefined,
    image: typeof it.image === "string" ? it.image : undefined,
    buttons: asButtons(it.buttons),
  }));
  const layout = CAROUSEL_LAYOUTS.has(config.layout as string)
    ? (config.layout as CarouselData["layout"])
    : "card";
  return { layout, items, buttons: asButtons(config.buttons) };
}

export function toTable(p: unknown): TableData {
  const env = asRecord(p) as Envelope;
  const config = asRecord(env.config);
  const output = asRecord(env.output);
  const rawCols = Array.isArray(output.columns) ? output.columns : asArray(config.columns);
  const columns: TableColumn[] = asArray<Record<string, unknown>>(rawCols)
    .filter((c) => typeof c.field === "string")
    .map((c) => ({
      field: String(c.field),
      label: typeof c.label === "string" ? c.label : String(c.field),
    }));
  const rows = asArray<Record<string, unknown>>(
    Array.isArray(output.rows) ? output.rows : config.rows,
  );
  return {
    columns,
    rows,
    buttons: asButtons(config.buttons),
    truncated: output.rowsTruncated === true,
  };
}

const CHART_TYPES = new Set(["bar", "line", "area", "pie", "donut"]);

export function toChart(p: unknown): ChartData {
  const env = asRecord(p) as Envelope;
  const config = asRecord(env.config);
  const output = asRecord(env.output);
  const points: ChartPoint[] = asArray<Record<string, unknown>>(output.data).map((d) => ({
    x: d.x,
    y: typeof d.y === "number" || typeof d.y === "string" ? d.y : undefined,
  }));
  const chartType = CHART_TYPES.has(config.chartType as string)
    ? (config.chartType as ChartData["chartType"])
    : "bar";
  return {
    chartType,
    title: typeof config.title === "string" ? config.title : undefined,
    points,
    colors: asArray<string>(config.colors).filter((c) => typeof c === "string"),
    buttons: asButtons(config.buttons),
  };
}

export function toTemplate(p: unknown): TemplateData {
  const env = asRecord(p) as Envelope;
  const config = asRecord(env.config);
  const output = asRecord(env.output);
  const fmt = config.outputFormat;
  return {
    outputFormat: fmt === "markdown" || fmt === "text" ? fmt : "html",
    rendered: typeof output.rendered === "string" ? output.rendered : "",
    buttons: asButtons(config.buttons),
  };
}
