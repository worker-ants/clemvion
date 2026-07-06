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
 * the viewport. The toggle button sits just above the minimap and lifts to the
 * corner when it's hidden. State is local — nothing else needs to observe it.
 */
export function CanvasMinimap() {
  const t = useT();
  const [visible, setVisible] = useState(true);

  return (
    <>
      <Panel
        position="bottom-right"
        // When the minimap is shown, lift the toggle above it: the minimap is
        // ~150px tall (@xyflow default) + its ~8px bottom offset + a small gap.
        className={visible ? "mb-[168px]" : ""}
      >
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
      {visible && (
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          ariaLabel={t("common.aria.minimap")}
          className="!bottom-2 !right-2 rounded-md border border-[hsl(var(--border))]"
          data-testid="minimap"
        />
      )}
    </>
  );
}
