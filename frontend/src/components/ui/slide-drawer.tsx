"use client";

import * as React from "react";
import { X } from "lucide-react";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

interface SlideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * 동시에 열려있는 drawer 개수를 추적해 가장 마지막 drawer 가 닫힐 때만
 * `body.style.overflow` 를 복원한다 — 단일 boolean 정책은 두 drawer 가
 * 중첩 됐다가 하나만 먼저 닫힐 때 다른 drawer 의 body lock 을 무효화하는
 * race 를 일으킴 (review W-14).
 */
let openDrawerCount = 0;

function lockBodyScroll(): void {
  openDrawerCount += 1;
  if (openDrawerCount === 1) {
    document.body.style.overflow = "hidden";
  }
}

function unlockBodyScroll(): void {
  openDrawerCount = Math.max(0, openDrawerCount - 1);
  if (openDrawerCount === 0) {
    document.body.style.overflow = "";
  }
}

export function SlideDrawer({
  open,
  onClose,
  title,
  children,
}: SlideDrawerProps) {
  const t = useT();
  const titleId = React.useId();

  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll while open — 카운터 기반으로 중첩 안전.
  React.useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      {/* Panel — Radix FocusScope 가 Tab 트랩 + 닫힐 때 trigger 로 포커스 복귀
          (`onMountAutoFocus`/`onUnmountAutoFocus` default 동작에 명시적으로
          의존). role="dialog" + aria-modal + aria-labelledby 로 SR 컨텍스트
          격리. 닫혔을 때 inert 를 부여해 hidden 트리에 Tab 이 안 들어가게 한다. */}
      <FocusScope asChild loop trapped={open}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-hidden={!open}
          // React 19+ treats `inert` as a real boolean attribute — passing
          // `""` triggers the "Received an empty string for a boolean
          // attribute" warning. Use `true` to opt the closed-state subtree
          // out of focus/AT, omit (undefined → attribute absent) otherwise.
          inert={!open || undefined}
          className={cn(
            "fixed right-0 top-0 z-50 h-full w-full max-w-lg transform border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl transition-transform duration-300 ease-in-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {/* Content */}
          <div className="h-[calc(100%-65px)] overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </FocusScope>
    </>
  );
}
