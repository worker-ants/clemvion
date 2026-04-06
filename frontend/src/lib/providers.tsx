"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const toastEl = (e.target as HTMLElement).closest(
        "[data-sonner-toast]",
      ) as HTMLElement | null;
      if (!toastEl) return;
      if (toastEl.dataset.dismissible === "false") return;
      toast.dismiss();
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors duration={5000} />
    </QueryClientProvider>
  );
}
