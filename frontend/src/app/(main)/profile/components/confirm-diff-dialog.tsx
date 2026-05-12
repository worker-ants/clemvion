"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

export interface DiffEntry {
  label: string;
  before: string;
  after: string;
}

export interface ConfirmDiffDialogProps {
  open: boolean;
  changes: DiffEntry[];
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDiffDialog({
  open,
  changes,
  onClose,
  onConfirm,
}: ConfirmDiffDialogProps) {
  const t = useT();
  const [isPending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("profile.confirmDiffTitle")}</DialogTitle>
          <DialogDescription>
            {t("profile.confirmDiffDescription")}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {changes.map((entry) => (
            <li
              key={entry.label}
              className="rounded-md border border-[hsl(var(--border))] p-3"
            >
              <p className="text-sm font-medium">{entry.label}</p>
              <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">
                  {t("profile.fieldBefore")}
                </span>
                <span data-testid={`diff-before-${entry.label}`}>
                  {entry.before}
                </span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {t("profile.fieldAfter")}
                </span>
                <span
                  className="font-medium"
                  data-testid={`diff-after-${entry.label}`}
                >
                  {entry.after}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
