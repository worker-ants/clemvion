"use client";

import { Panel, useReactFlow, useStore } from "@xyflow/react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

/**
 * Canvas zoom bounds (spec 3-workflow-editor/0-canvas.md §3.1 "줌 범위 최소 25% ~
 * 최대 200%"). Exported so `workflow-canvas.tsx` can pass the same values to
 * ReactFlow's `minZoom`/`maxZoom`, keeping the slider range and the wheel/pinch
 * clamp in sync from one source.
 */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
const MIN_ZOOM_PERCENT = Math.round(MIN_ZOOM * 100);
const MAX_ZOOM_PERCENT = Math.round(MAX_ZOOM * 100);

/** Slider granularity in percentage points. */
const ZOOM_STEP = 5;

/**
 * Shared `fitView` options so every Fit affordance (this overlay's Fit button,
 * the canvas's `onInit`, and the `fit-view` context-menu action) frames the
 * graph identically. Exported alongside the zoom bounds as the single source.
 */
export const FIT_VIEW_OPTIONS = { padding: 0.2 } as const;

/**
 * Bottom-left overlay: zoom out/in buttons, a zoom-level slider + live percent
 * readout, and Fit. Spec §6 / §3.1 — the slider and percent were previously
 * Planned; the three buttons were already implemented.
 *
 * Subscribes to `transform[2]` (zoom) only via `useStore` so panning doesn't
 * re-render this overlay — only zoom changes do.
 */
export function ZoomControls() {
  const t = useT();
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);

  const rawPercent = Math.round(zoom * 100);
  // Clamp only what the range input renders — the thumb must stay within
  // [min,max]. `minZoom`/`maxZoom` on ReactFlow already keep `zoom` in range in
  // practice, so this is a defensive guard, not an expected branch.
  const sliderPercent = Math.min(
    MAX_ZOOM_PERCENT,
    Math.max(MIN_ZOOM_PERCENT, rawPercent),
  );

  return (
    <Panel position="bottom-left" className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => zoomOut()}
        aria-label={t("common.aria.zoomOut")}
      >
        <ZoomOut size={14} aria-hidden="true" />
      </Button>
      <input
        type="range"
        min={MIN_ZOOM_PERCENT}
        max={MAX_ZOOM_PERCENT}
        step={ZOOM_STEP}
        value={sliderPercent}
        onChange={(e) => zoomTo(Number(e.target.value) / 100, { duration: 0 })}
        aria-label={t("common.aria.zoomLevel")}
        data-testid="zoom-slider"
        className="h-1 w-24 cursor-pointer accent-[hsl(var(--primary))]"
      />
      <span
        data-testid="zoom-percent"
        className="w-10 text-center text-xs tabular-nums text-[hsl(var(--muted-foreground))]"
      >
        {rawPercent}%
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => zoomIn()}
        aria-label={t("common.aria.zoomIn")}
      >
        <ZoomIn size={14} aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => fitView(FIT_VIEW_OPTIONS)}
        aria-label={t("common.aria.fitToView")}
      >
        <Maximize size={14} aria-hidden="true" />
      </Button>
    </Panel>
  );
}
