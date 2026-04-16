"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { workspacesApi } from "@/lib/api/workspaces";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Status = "accepting" | "success" | "error" | "missing";

export function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  const [status, setStatus] = useState<Status>(token ? "accepting" : "missing");
  const [errorMessage, setErrorMessage] = useState("");
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    async function accept() {
      try {
        const result = await workspacesApi.acceptInvitation(token!);
        // Refresh the workspace list and switch to the newly-joined one so
        // the user lands inside the right context immediately.
        const list = await workspacesApi.list();
        setWorkspaces(list);
        switchWorkspace(result.workspaceId);
        setStatus("success");
        toast.success("워크스페이스에 합류했어요.");
        setTimeout(() => router.push("/dashboard"), 1500);
      } catch (err) {
        const error = err as AxiosError<{ message?: string }>;
        const message =
          error.response?.data?.message ?? "초대 수락에 실패했어요.";
        setErrorMessage(message);
        setStatus("error");
      }
    }

    void accept();
  }, [token, router, setWorkspaces, switchWorkspace]);

  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>워크스페이스 초대</CardTitle>
          <CardDescription>
            {status === "accepting" && "초대를 확인하고 있어요…"}
            {status === "success" && "워크스페이스에 합류했어요!"}
            {status === "error" && "초대 수락에 실패했어요"}
            {status === "missing" && "초대 토큰이 없어요"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "accepting" && (
            <div className="flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
            </div>
          )}
          {status === "missing" && (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              초대 메일에 포함된 링크를 그대로 사용해 주세요.
            </p>
          )}
          {status === "error" && (
            <>
              <p className="text-center text-sm text-[hsl(var(--destructive))]">
                {errorMessage}
              </p>
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => router.push("/dashboard")}>
                  대시보드로 이동
                </Button>
              </div>
            </>
          )}
          {status === "success" && (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              잠시 후 대시보드로 이동해요.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
