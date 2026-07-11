// Presentation payload 타입 + shape 기반 판별. spec/4-nodes/6-presentation/* (zod schema SoT).
// 위젯이 받는 presentations[i] 는 두 shape 중 하나다:
//  1) standalone 노드: { config, output, meta, port?, status? } flat envelope (명시 type 없어 shape 추론).
//  2) AI render_* 도구: PresentationPayload { type, toolCallId, renderedAt, payload, truncation? }
//     (데이터는 .payload 중첩, cap 메타는 payload 바깥 top-level).
// asEnvelope() 가 둘을 { config, output } 로 통일하고, classifyPresentation 은 (2)의 명시 type 을 우선 사용한다.

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
  /**
   * 잘리기 전 총 행 개수(1MB cap, [공통 §10.4] `output.rowsTotalCount`). `truncated=true` 일 때만
   * 의미 있으며, 잘림 배너에 "총 N개 중 일부만" 으로 노출한다(메인 편집기 run-results parity).
   * 백엔드가 실어 보내지 않으면 `undefined` → 배너는 개수 없는 폴백 문구로 표시.
   */
  totalCount?: number;
}

export interface ChartPoint {
  x: unknown;
  y?: number | string;
}

export interface ChartData {
  chartType: "bar" | "line" | "area" | "pie" | "donut";
  title?: string;
  /** X축 레이블(config.xAxis.label). */
  xLabel?: string;
  /** Y축 레이블(config.yAxis.label). */
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

/**
 * XSS 방어: `javascript:` / `data:` / `vbscript:` / `blob:` / `file:` 스킴을 차단.
 * http:/https:/프로토콜-상대(//) / 상대경로만 허용.
 * (W1 — link 버튼 URL, 카루셀 이미지 src 적용)
 */
export function isSafeUrl(u: string): boolean {
  const lower = u.trimStart().toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("file:")
  ) {
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

// AI render_* 의 PresentationPayload 유효 종류 — classifyPresentation fast-path guard.
// (form 제외: form 은 presentations[] 가 아니라 waiting_for_input(ai_form_render) 경로로 오며 별도 UI 가 렌더.)
const PRESENTATION_KINDS = new Set<PresentationKind>(["carousel", "table", "chart", "template"]);

// PresentationPayload.truncation 의 허용 키 (AI Agent §7.10 의 type block). output 병합은 이 4개로 한정한다 —
// 통째로 spread 하면 장래 truncation shape 확장이 payload 의 동명 렌더 필드를 조용히 덮어쓸 수 있다.
const TRUNCATION_KEYS = [
  "rowsTruncated",
  "itemsTruncated",
  "rowsTotalCount",
  "itemsTotalCount",
] as const;

/** PresentationPayload 의 top-level truncation 에서 알려진 cap 메타만 추린다. 부재/비객체면 `{}`. */
function truncationMeta(v: unknown): Record<string, unknown> {
  const t = asRecord(v);
  const meta: Record<string, unknown> = {};
  for (const k of TRUNCATION_KEYS) {
    if (k in t) meta[k] = t[k];
  }
  return meta;
}

/**
 * 위젯이 받는 presentation 의 두 shape 을 통일된 `{ config, output }` envelope 로 정규화한다:
 * - standalone presentation 노드(`execution.message`/`waiting_for_input`): `{ config, output }` — 그대로.
 * - AI 에이전트 `render_*` 도구(`ai_message.presentations[]` · 복원 thread `turn.presentations[]`):
 *   `PresentationPayload { type, toolCallId, renderedAt, payload, truncation? }`
 *   — 데이터가 `.payload` 에 중첩되므로 payload 를 config·output 양쪽으로 펼친다(to* 가 두 곳을 모두 읽으므로 안전).
 *   config·output 은 **payload 의 별도 shallow 사본** — 한쪽 변이가 다른 쪽을 오염시키지 않게 aliasing 을 끊는다.
 *
 * `truncation` 은 `payload` **바깥** top-level 필드다 (AI Agent §7.10). 노드 경로가 output 안에 직접 싣는
 * `output.{rowsTruncated|itemsTruncated|rowsTotalCount|itemsTotalCount}` 와 **동등한 메타**이므로
 * (Presentation 공통 §10.4 — spec/4-nodes/6-presentation/0-common.md) `output` 으로 흡수한다. 흡수하지 않으면
 * `toTable` 이 잘림을 보지 못해 1MB cap 배너가 영영 뜨지 않는다.
 *
 * 병합 규칙: 흡수는 `output` 에만 적용하고(`config` 는 순수 payload 사본 유지), 같은 키가 payload 에도 있으면
 * **top-level `truncation` 이 우선**한다 — AI shape 에서 cap 메타의 단일 진실이 top-level 이기 때문.
 * 두 출처 모두 위젯이 inline 렌더해야 한다 (spec/7-channel-web-chat/1-widget-app §2 · AI Agent §7.10).
 */
function asEnvelope(p: unknown): {
  config: Record<string, unknown>;
  output: Record<string, unknown>;
} {
  const o = asRecord(p);
  if (typeof o.type === "string" && o.payload && typeof o.payload === "object") {
    const payload = asRecord(o.payload);
    // truncation 부재·비객체면 truncationMeta 가 {} 를 주므로 spread 는 no-op.
    return { config: { ...payload }, output: { ...payload, ...truncationMeta(o.truncation) } };
  }
  return { config: asRecord(o.config), output: asRecord(o.output) };
}

/** shape 으로 presentation 종류 판별. 모르면 null(렌더 skip). */
export function classifyPresentation(p: unknown): PresentationKind | null {
  const o = asRecord(p);
  // AI render_* 도구의 PresentationPayload 는 명시 `type` 을 가진다 — 우선 사용(데이터는 `.payload` 중첩).
  if (typeof o.type === "string" && PRESENTATION_KINDS.has(o.type as PresentationKind) && o.payload) {
    return o.type as PresentationKind;
  }
  const { config, output } = asEnvelope(p);
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
  const { config, output } = asEnvelope(p);
  // dynamic 은 output.items, static 은 config.items.
  const rawItems = Array.isArray(output.items) ? output.items : asArray(config.items);
  // payload-level itemButtons(모든 item 공통 액션 버튼 — 예: AI 카루셀의 "자세히 보기")를 각 item 버튼에 병합.
  const itemButtons = asButtons(config.itemButtons);
  const items: CarouselItem[] = asArray<Record<string, unknown>>(rawItems).map((it) => ({
    title: typeof it.title === "string" ? it.title : undefined,
    description: typeof it.description === "string" ? it.description : undefined,
    image: typeof it.image === "string" && isSafeUrl(it.image) ? it.image : undefined,
    buttons: [...asButtons(it.buttons), ...itemButtons],
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
  const { config, output } = asEnvelope(p);
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
  // 잘리기 전 총 행 개수 — truncationMeta 가 이미 흡수한 output.rowsTotalCount(§10.4).
  // 유한한 비음수 정수만 채택: 부재/이형/NaN/Infinity/음수는 undefined → 배너가 개수 없는
  // 폴백으로 표시(신뢰 못 할 total 로 "총 NaN개…" 같은 문구가 새지 않게).
  const rawTotal = output.rowsTotalCount;
  const totalCount =
    typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal >= 0
      ? rawTotal
      : undefined;
  return {
    columns,
    rows,
    buttons: asButtons(config.buttons),
    truncated: output.rowsTruncated === true,
    totalCount,
  };
}

const CHART_TYPES = new Set(["bar", "line", "area", "pie", "donut"]);

/**
 * presentation envelope → ChartData. output.data[{x,y}] 배열에서 point 목록 추출.
 * chartType 이 알 수 없는 값이면 "bar" 기본값. colors 미설정 시 렌더러가 DEFAULT_CHART_COLORS 사용.
 * xLabel/yLabel 은 config.xAxis.label / config.yAxis.label 에서 추출(빈 문자열이면 undefined).
 */
export function toChart(p: unknown): ChartData {
  const { config, output } = asEnvelope(p);
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
 * presentation envelope → TemplateData. 본문은 `output.rendered`(노드 template) 우선, 없으면
 * `output.content`(AI render_template payload 의 본문 키) fallback. outputFormat 은 "markdown"/"text"
 * 이외 모두 "html" 기본값(렌더는 DOMPurify sanitize 후 — TemplateView).
 */
export function toTemplate(p: unknown): TemplateData {
  const { config, output } = asEnvelope(p);
  const fmt = config.outputFormat;
  // 노드 template 은 `output.rendered`, AI render_template 의 payload 는 `content` 키를 쓴다.
  const rendered =
    typeof output.rendered === "string"
      ? output.rendered
      : typeof output.content === "string"
        ? output.content
        : "";
  return {
    outputFormat: fmt === "markdown" || fmt === "text" ? fmt : "html",
    rendered,
    buttons: asButtons(config.buttons),
  };
}
