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
  /** 축 레이블(config.xAxis.label / config.yAxis.label). */
  xLabel?: string;
  yLabel?: string;
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


/**
 * XSS 방어: `javascript:` / `data:` 스킴을 차단. http:/https:/프로토콜-상대(//) / 상대경로만 허용.
 * (W1 — link 버튼 URL, 카루셀 이미지 src 적용)
 */
export function isSafeUrl(u: string): boolean {
  const lower = u.trimStart().toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return false;
  }
  return true;
}

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
      url: typeof b.url === "string" && isSafeUrl(b.url) ? b.url : undefined,
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

/**
 * presentation envelope → CarouselData. 동적(output.items) 우선, 없으면 정적(config.items) 폴백.
 * layout 이 알 수 없는 값이면 "card" 기본값. 카루셀 이미지 src 는 isSafeUrl() 검증(W1/I4).
 */
export function toCarousel(p: unknown): CarouselData {
  const env = asRecord(p) as Envelope;
  const config = asRecord(env.config);
  const output = asRecord(env.output);
  // dynamic 은 output.items, static 은 config.items.
  const rawItems = Array.isArray(output.items) ? output.items : asArray(config.items);
  const items: CarouselItem[] = asArray<Record<string, unknown>>(rawItems).map((it) => ({
    title: typeof it.title === "string" ? it.title : undefined,
    description: typeof it.description === "string" ? it.description : undefined,
    image: typeof it.image === "string" && isSafeUrl(it.image) ? it.image : undefined,
    buttons: asButtons(it.buttons),
  }));
  const layout = CAROUSEL_LAYOUTS.has(config.layout as string)
    ? (config.layout as CarouselData["layout"])
    : "card";
  return { layout, items, buttons: asButtons(config.buttons) };
}

/**
 * presentation envelope → TableData. 컬럼은 output.columns 우선, 폴백 config.columns.
 * 행은 output.rows 우선, 폴백 config.rows. 미매핑 컬럼의 label 은 field 값으로 fallback.
 */
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

/**
 * presentation envelope → ChartData. output.data[{x,y}] 배열에서 point 목록 추출.
 * chartType 이 알 수 없는 값이면 "bar" 기본값. colors 미설정 시 렌더러가 DEFAULT_CHART_COLORS 사용.
 */
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
  const axisLabel = (axis: unknown): string | undefined => {
    const label = asRecord(axis).label;
    return typeof label === "string" && label ? label : undefined;
  };
  return {
    chartType,
    title: typeof config.title === "string" ? config.title : undefined,
    xLabel: axisLabel(config.xAxis),
    yLabel: axisLabel(config.yAxis),
    points,
    colors: asArray<string>(config.colors).filter((c) => typeof c === "string"),
    buttons: asButtons(config.buttons),
  };
}

/**
 * presentation envelope → TemplateData. output.rendered(string) 를 그대로 반환.
 * outputFormat 은 "markdown"/"text" 이외 모두 "html" 기본값. v1 에서는 plain text 로 안전 렌더.
 */
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
