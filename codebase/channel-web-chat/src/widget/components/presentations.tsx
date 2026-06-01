// Rich presentation inline 렌더러 — carousel/table/chart/template. spec/7-channel-web-chat/1-widget-app §2.
// ai_message.presentations[] / waiting_for_input 의 presentation 페이로드를 메시지 타임라인 안에 inline 렌더.
// 차트는 임베드 위젯 번들 경량 유지를 위해 외부 차트 라이브러리 없이 inline SVG 로 그린다.
"use client";

import { useState } from "react";
import {
  classifyPresentation,
  toCarousel,
  toChart,
  toTable,
  toTemplate,
  type ChartData,
  type PresentationButton,
} from "@/lib/presentation";

// SVG chart 크기 상수 — styles.ts 와 동기화 필요 시 이 값을 기준으로 맞출 것(I16).
const CHART_SVG_W = 280;
const CHART_SVG_H = 140;
const CHART_SVG_PAD = 24;

interface PresentationProps {
  payload: unknown;
  /** port 버튼 클릭 — click_button 디스패치. */
  onButton: (buttonId: string) => void;
}

/** 단일 presentation 을 종류별 렌더러로 분기. 모르는 shape 은 렌더 skip(null). */
export function PresentationBlock({ payload, onButton }: PresentationProps) {
  const kind = classifyPresentation(payload);
  switch (kind) {
    case "carousel":
      return <CarouselView payload={payload} onButton={onButton} />;
    case "table":
      return <TableView payload={payload} onButton={onButton} />;
    case "chart":
      return <ChartView payload={payload} onButton={onButton} />;
    case "template":
      return <TemplateView payload={payload} onButton={onButton} />;
    default:
      return null;
  }
}

/** presentation 페이로드 배열 렌더(메시지 1건에 여러 presentation 가능). */
export function PresentationList({
  presentations,
  onButton,
}: {
  presentations: unknown[];
  onButton: (buttonId: string) => void;
}) {
  if (!presentations?.length) return null;
  return (
    <div className="wc-presentations" data-testid="wc-presentations">
      {presentations.map((p, i) => (
        <PresentationBlock key={i} payload={p} onButton={onButton} />
      ))}
    </div>
  );
}

/** 공통 버튼 바 — port 버튼은 onButton, link 버튼은 새 탭 이동. */
function ButtonBar({
  buttons,
  onButton,
}: {
  buttons: PresentationButton[];
  onButton: (id: string) => void;
}) {
  if (!buttons.length) return null;
  return (
    <div className="wc-pres-buttons" role="group">
      {buttons.map((b) =>
        b.type === "link" && b.url ? (
          <a
            key={b.id}
            className="wc-pres-button"
            data-style={b.style}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {b.label}
          </a>
        ) : (
          <button
            key={b.id}
            type="button"
            className="wc-pres-button"
            data-style={b.style}
            onClick={() => onButton(b.id)}
          >
            {b.label}
          </button>
        ),
      )}
    </div>
  );
}

function CarouselView({ payload, onButton }: PresentationProps) {
  const { layout, items, buttons } = toCarousel(payload);
  const [idx, setIdx] = useState(0);
  if (!items.length) return null;
  const safe = Math.min(idx, items.length - 1);
  const item = items[safe];
  return (
    <div className="wc-carousel" data-layout={layout} data-testid="wc-carousel">
      <div className="wc-carousel-slide">
        {item.image && layout !== "minimal" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="wc-carousel-img" src={item.image} alt={item.title ?? ""} />
        )}
        {item.title && <div className="wc-carousel-title">{item.title}</div>}
        {item.description && layout !== "image" && (
          <div className="wc-carousel-desc">{item.description}</div>
        )}
        <ButtonBar buttons={item.buttons ?? []} onButton={onButton} />
      </div>
      {items.length > 1 && (
        <div className="wc-carousel-nav">
          <button
            type="button"
            className="wc-carousel-prev"
            aria-label="이전"
            disabled={safe === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          >
            ‹
          </button>
          <span className="wc-carousel-count">
            {safe + 1} / {items.length}
          </span>
          <button
            type="button"
            className="wc-carousel-next"
            aria-label="다음"
            disabled={safe === items.length - 1}
            onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))}
          >
            ›
          </button>
        </div>
      )}
      <ButtonBar buttons={buttons} onButton={onButton} />
    </div>
  );
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function TableView({ payload, onButton }: PresentationProps) {
  const { columns, rows, buttons, truncated } = toTable(payload);
  if (!columns.length && !rows.length) return null;
  const cols = columns.length
    ? columns
    : Object.keys(rows[0] ?? {}).map((f) => ({ field: f, label: f }));
  return (
    <div className="wc-table-wrap" data-testid="wc-table">
      <table className="wc-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.field}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {cols.map((c) => (
                <td key={c.field}>{cellText(row[c.field])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {truncated && <div className="wc-table-truncated">일부 행만 표시됩니다.</div>}
      <ButtonBar buttons={buttons} onButton={onButton} />
    </div>
  );
}

function numericPoints(data: ChartData["points"]): Array<{ label: string; value: number }> {
  return data.map((d) => ({
    label: cellText(d.x),
    value: typeof d.y === "number" ? d.y : Number(d.y) || 0,
  }));
}

const DEFAULT_CHART_COLORS = ["#5B4FE9", "#22B8CF", "#F59F00", "#E64980", "#37B24D"];

function ChartView({ payload, onButton }: PresentationProps) {
  const chart = toChart(payload);
  const pts = numericPoints(chart.points);
  if (!pts.length) return null;
  const colors = chart.colors.length ? chart.colors : DEFAULT_CHART_COLORS;
  const W = CHART_SVG_W;
  const H = CHART_SVG_H;
  const pad = CHART_SVG_PAD;
  const max = Math.max(...pts.map((p) => p.value), 1);
  const min = Math.min(...pts.map((p) => p.value), 0);
  const range = max - min || 1;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  let body: React.ReactNode;
  if (chart.chartType === "pie" || chart.chartType === "donut") {
    body = <PieSlices pts={pts} colors={colors} donut={chart.chartType === "donut"} />;
  } else if (chart.chartType === "line" || chart.chartType === "area") {
    const stepX = pts.length > 1 ? innerW / (pts.length - 1) : 0;
    const coords = pts.map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + innerH - ((p.value - min) / range) * innerH;
      return `${x},${y}`;
    });
    body = (
      <>
        {chart.chartType === "area" && (
          <polygon
            points={`${pad},${pad + innerH} ${coords.join(" ")} ${pad + innerW},${pad + innerH}`}
            fill={colors[0]}
            fillOpacity={0.2}
          />
        )}
        <polyline points={coords.join(" ")} fill="none" stroke={colors[0]} strokeWidth={2} />
      </>
    );
  } else {
    const barW = innerW / pts.length;
    body = (
      <>
        {pts.map((p, i) => {
          const h = ((p.value - min) / range) * innerH;
          return (
            <rect
              key={i}
              x={pad + i * barW + barW * 0.15}
              y={pad + innerH - h}
              width={barW * 0.7}
              height={Math.max(0, h)}
              fill={colors[i % colors.length]}
            />
          );
        })}
      </>
    );
  }

  return (
    <div className="wc-chart" data-testid="wc-chart" data-chart-type={chart.chartType}>
      {chart.title && <div className="wc-chart-title">{chart.title}</div>}
      <svg
        className="wc-chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={chart.title ?? `${chart.chartType} chart`}
      >
        {body}
      </svg>
      <ButtonBar buttons={chart.buttons} onButton={onButton} />
    </div>
  );
}

function PieSlices({
  pts,
  colors,
  donut,
}: {
  pts: Array<{ label: string; value: number }>;
  colors: string[];
  donut: boolean;
}) {
  const total = pts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  const cx = 70;
  const cy = 70;
  const r = 50;
  // 각 슬라이스 시작 누적 비율(render 중 변수 변이 없이 prefix-sum). n 작아 O(n²) 무해.
  const starts = pts.map((_, i) =>
    pts.slice(0, i).reduce((s, q) => s + Math.max(0, q.value) / total, 0),
  );
  return (
    <g>
      {pts.map((p, i) => {
        const frac = Math.max(0, p.value) / total;
        // I6: 단일 슬라이스(frac ≈ 1.0) 시 arc start=end → SVG 렌더 실패.
        // frac >= 0.999 이면 <circle> 로 대체 렌더.
        if (frac >= 0.999) {
          return <circle key={i} cx={cx} cy={cy} r={r} fill={colors[i % colors.length]} />;
        }
        const start = starts[i] * 2 * Math.PI;
        const end = (starts[i] + frac) * 2 * Math.PI;
        const x1 = cx + r * Math.sin(start);
        const y1 = cy - r * Math.cos(start);
        const x2 = cx + r * Math.sin(end);
        const y2 = cy - r * Math.cos(end);
        const large = end - start > Math.PI ? 1 : 0;
        return (
          <path
            key={i}
            d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`}
            fill={colors[i % colors.length]}
          />
        );
      })}
      {donut && <circle cx={cx} cy={cy} r={r * 0.55} fill="#fff" />}
    </g>
  );
}

function TemplateView({ payload, onButton }: PresentationProps) {
  const { outputFormat, rendered, buttons } = toTemplate(payload);
  if (!rendered) return null;
  // 보안: html 은 워크스페이스 작성 콘텐츠(준-신뢰)지만 위젯에서 임의 HTML 주입은 XSS 위험 →
  // v1 은 html/markdown/text 모두 **plain text 로 안전 렌더**(태그 미해석). 풍부한 마크업은 followup.
  return (
    <div className="wc-template" data-testid="wc-template" data-format={outputFormat}>
      <div className="wc-template-body">{rendered}</div>
      <ButtonBar buttons={buttons} onButton={onButton} />
    </div>
  );
}
