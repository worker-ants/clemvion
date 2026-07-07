"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import {
  getCategories,
  getNodesByCategory,
  getNodeDefinition,
} from "@/lib/node-definitions";
import type { NodeDefinition } from "@/lib/node-definitions";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import { useRecentNodesStore } from "@/lib/stores/recent-nodes-store";
import { addNodeFromPalette } from "@/lib/stores/palette-canvas-bridge";
import { NodeIcon } from "../canvas/node-icon";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useT, useLocale } from "@/lib/i18n";
import {
  translateNodeCategory,
  translateNodeLabel,
  translateNodeDescription,
} from "@/lib/i18n/backend-labels";

export function NodePalette() {
  const t = useT();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  // 카테고리별 접기 상태 (팔레트 전체 접기와 구분).
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});
  // §4.2 팔레트 패널 전체 접기 (아이콘 레일).
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  // Subscribe so the palette re-renders once definitions/categories finish loading.
  useNodeDefinitionsStore((s) => s.categories);
  const recentNodeTypes = useRecentNodesStore((s) => s.recentNodeTypes);
  const categories = getCategories();

  const toggleCategory = useCallback((id: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData("application/reactflow-type", nodeType);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const lowerSearch = search.toLowerCase();

  // §4.1 Recent — 최근 사용 노드 타입을 정의로 해석. manual_trigger(진입점) 및 정의가
  // 사라진 타입은 제외. 검색 중에는 카테고리 평면 필터와 중복되므로 숨긴다.
  const recentDefs = recentNodeTypes
    .map((type) => getNodeDefinition(type))
    .filter(
      (d): d is NodeDefinition => !!d && d.type !== "manual_trigger",
    );

  // §4.2 접힌 상태 — 아이콘 레일만 표시 (펼치기 토글).
  if (isPaletteCollapsed) {
    return (
      <div className="flex h-full w-10 shrink-0 flex-col items-center border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
        <button
          type="button"
          onClick={() => setIsPaletteCollapsed(false)}
          aria-label={t("editor.expandPalette")}
          aria-expanded={false}
          className="flex h-7 w-7 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
        >
          <PanelLeftOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[220px] shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Search + collapse toggle */}
      <div className="border-b border-[hsl(var(--border))] p-3">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
            />
            <Input
              placeholder={t("editor.searchNodes")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsPaletteCollapsed(true)}
            aria-label={t("editor.collapsePalette")}
            aria-expanded={true}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* §4.1 Recent (검색 중 아님 + 항목 있음) */}
        {!lowerSearch && recentDefs.length > 0 && (
          <div className="mb-2">
            <div className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-[hsl(var(--foreground))]">
              <Clock size={12} />
              {t("editor.recentSection")}
            </div>
            <div className="mt-0.5 flex flex-col gap-0.5 pl-3">
              {recentDefs.map((node) => (
                <PaletteItem
                  key={`recent-${node.type}`}
                  node={node}
                  onDragStart={onDragStart}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        )}
        {categories.map((cat) => {
          const nodes = getNodesByCategory(cat.id);
          const filtered = lowerSearch
            ? nodes.filter((n) => {
                const localizedLabel =
                  translateNodeLabel(n.label, locale) ?? n.label;
                return (
                  localizedLabel.toLowerCase().includes(lowerSearch) ||
                  n.label.toLowerCase().includes(lowerSearch)
                );
              })
            : nodes;

          if (filtered.length === 0) return null;

          const isCollapsed = collapsedCategories[cat.id] ?? false;
          const categoryLabel =
            translateNodeCategory(cat.label, locale) ?? cat.label;

          return (
            <div key={cat.id} className="mb-2">
              {/* Category header */}
              <button
                type="button"
                data-testid="palette-category-header"
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
                  style={{ backgroundColor: cat.color }}
                />
                {categoryLabel}
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
                      locale={locale}
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
  locale,
}: {
  node: NodeDefinition;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  locale: Parameters<typeof translateNodeLabel>[1];
}) {
  const label = translateNodeLabel(node.label, locale) ?? node.label;
  const description =
    translateNodeDescription(node.description, locale) ?? node.description;
  // §4.2 — 클릭(또는 Enter/Space)으로 캔버스 중앙에 노드 추가. 드래그도 그대로 유지.
  const handleAdd = () => addNodeFromPalette(node.type);
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, node.type)}
      onClick={handleAdd}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleAdd();
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded px-2 py-1.5 text-xs",
        "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]",
        "focus:bg-[hsl(var(--accent))] focus:outline-none active:cursor-grabbing",
      )}
      title={description}
    >
      <NodeIcon name={node.icon} size={14} style={{ color: node.color }} />
      <span className="truncate">{label}</span>
    </div>
  );
}
