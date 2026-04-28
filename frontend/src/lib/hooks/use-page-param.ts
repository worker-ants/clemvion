"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface UsePageParamResult {
  page: number;
  setPage: (next: number) => void;
}

function parsePage(raw: string | null): number {
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/**
 * Reads/writes the `?page=` query parameter for list views. Returning to page 1
 * removes the param to keep canonical URLs clean. All other search params are
 * preserved on update.
 */
export function usePageParam(): UsePageParamResult {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parsePage(searchParams.get("page"));

  const setPage = useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(next));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  return { page, setPage };
}
