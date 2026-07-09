"use client";

import { useState } from "react";
import { MiniMap, Panel } from "@xyflow/react";
import { Map as MapIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

/**
 * Bottom-right minimap overlay + show/hide toggle (spec §7, previously Planned).
 *
 * The `<MiniMap>` renders the whole-graph bird's-eye view with a viewport
 * rectangle; `pannable`/`zoomable` let the user drag/scroll inside it to move
 * the viewport. The toggle button is pinned at the bottom-right corner and the
 * minimap floats just above it, so the map never covers the button. State is
 * local — nothing else needs to observe it.
 */
export function CanvasMinimap() {
  const t = useT();
  const [visible, setVisible] = useState(true);

  return (
    <>
      {visible && (
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          ariaLabel={t("common.aria.minimap")}
          // Float the minimap above the toggle button so it never covers it:
          // the button is h-8 (32px) pinned at the 8px corner offset, so a 48px
          // bottom offset leaves the minimap's bottom edge ~8px above the
          // button's top. Both live in a `<Panel>` with the same default
          // margin, so that margin cancels out and the 8px gap is exact.
          className="!bottom-12 !right-2 rounded-md border border-[hsl(var(--border))]"
          data-testid="minimap"
        />
      )}
      <Panel position="bottom-right" className="!bottom-2 !right-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setVisible((v) => !v)}
          aria-label={t("common.aria.toggleMinimap")}
          aria-pressed={visible}
          data-testid="minimap-toggle"
        >
          <MapIcon size={14} aria-hidden="true" />
        </Button>
      </Panel>
    </>
  );
}
