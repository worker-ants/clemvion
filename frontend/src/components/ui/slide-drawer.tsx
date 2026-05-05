"use client";

import * as React from "react";
import { X } from "lucide-react";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

interface SlideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function SlideDrawer({
  open,
  onClose,
  title,
  children,
}: SlideDrawerProps) {
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

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
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

      {/* Panel — Radix FocusScope 가 Tab 트랩 + 닫힐 때 trigger 로 포커스 복귀.
          role="dialog" + aria-modal="true" 로 SR 컨텍스트 격리, aria-labelledby
          으로 헤더 제목과 연결 (Stage 10 NF-A11Y). */}
      <FocusScope asChild loop trapped={open}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-hidden={!open}
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
              aria-label="Close"
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
