"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

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

  // Workspace는 권한 경계이므로 전환 시 이전 workspace의 쿼리 캐시가 섞이지 않도록
  // in-flight 요청을 취소하고, 활성 observer의 data를 초기 상태로 되돌린 뒤 refetch한다.
  // clear() 대신 resetQueries()를 쓰는 이유: clear()는 캐시만 지울 뿐 active observer의
  // state.data는 그대로 유지되어, 새 데이터가 도착할 때까지 이전 workspace의 목록이 보임.
  useEffect(() => {
    let prev = useWorkspaceStore.getState().currentWorkspaceId;
    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      const next = state.currentWorkspaceId;
      if (next !== prev && prev !== null && next !== null) {
        void queryClient.cancelQueries();
        void queryClient.resetQueries();
      }
      prev = next;
    });
    return unsubscribe;
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors duration={5000} />
    </QueryClientProvider>
  );
}
