"use client";

import { useCallback } from "react";
import { toast } from "sonner";

export interface CopyToClipboardMessages {
  /** Toast shown on a successful copy. */
  success: string;
  /** Toast shown when the clipboard write rejects (or is unavailable). */
  error: string;
}

/**
 * Copies text to the clipboard and surfaces a success / error toast.
 *
 * Unifies the `navigator.clipboard.writeText + toast` pattern that was
 * duplicated (with divergent `.then` vs `try/catch` styles) across trigger
 * drawer cards. The hook stays presentation-agnostic — callers pass already
 * translated messages so it carries no feature-specific i18n keys.
 *
 * @returns a stable `copy(text, messages)` function resolving to `true` on
 *   success and `false` on failure (it never rejects).
 */
export function useCopyToClipboard(): (
  text: string,
  messages: CopyToClipboardMessages,
) => Promise<boolean> {
  return useCallback(async (text, messages) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(messages.success);
      return true;
    } catch {
      toast.error(messages.error);
      return false;
    }
  }, []);
}
