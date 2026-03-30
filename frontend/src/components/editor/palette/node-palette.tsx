"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  getNodesByCategory,
} from "@/lib/node-definitions";
import type { NodeDefinition } from "@/lib/node-definitions";
import { NodeIcon } from "../canvas/node-icon";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

export function NodePalette() {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCategory = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData("application/reactflow-type", nodeType);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const lowerSearch = search.toLowerCase();

  return (
    <div className="flex h-full w-[220px] shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Search */}
      <div className="border-b border-[hsl(var(--border))] p-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
          />
          <Input
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2">
        {CATEGORIES.map((cat) => {
          const nodes = getNodesByCategory(cat.id);
          const filtered = lowerSearch
            ? nodes.filter((n) => n.label.toLowerCase().includes(lowerSearch))
            : nodes;

          if (filtered.length === 0) return null;

          const isCollapsed = collapsed[cat.id] ?? false;

          return (
            <div key={cat.id} className="mb-2">
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]"
              >
                {isCollapsed ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat.id] }}
                />
                {cat.label}
                <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
                  {filtered.length}
                </span>
              </button>

              {/* Node items */}
              {!isCollapsed && (
                <div className="mt-0.5 flex flex-col gap-0.5 pl-3">
                  {filtered.map((node) => (
                    <PaletteItem
                      key={node.type}
                      node={node}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaletteItem({
  node,
  onDragStart,
}: {
  node: NodeDefinition;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, node.type)}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded px-2 py-1.5 text-xs",
        "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]",
        "active:cursor-grabbing",
      )}
      title={node.description}
    >
      <NodeIcon name={node.icon} size={14} style={{ color: node.color }} />
      <span className="truncate">{node.label}</span>
    </div>
  );
}
