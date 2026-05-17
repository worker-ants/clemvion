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
import { useT, translate } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/stores/locale-store";

type Status = "accepting" | "success" | "error" | "missing";

export function AcceptInvitationContent() {
  const t = useT();
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
      const currentLocale = useLocaleStore.getState().locale;
      try {
        const result = await workspacesApi.acceptInvitation(token!);
        const list = await workspacesApi.list();
        setWorkspaces(list);
        switchWorkspace(result.workspaceId);
        setStatus("success");
        toast.success(translate(currentLocale, "invitations.accept.joined"));
        setTimeout(() => router.push("/dashboard"), 1500);
      } catch (err) {
        const error = err as AxiosError<{ message?: string }>;
        const message =
          error.response?.data?.message ?? translate(currentLocale, "invitations.accept.acceptFailedDefault");
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
          <CardTitle>{t("invitations.accept.title")}</CardTitle>
          <CardDescription>
            {status === "accepting" && t("invitations.accept.statusAccepting")}
            {status === "success" && t("invitations.accept.statusSuccess")}
            {status === "error" && t("invitations.accept.statusError")}
            {status === "missing" && t("invitations.accept.statusMissing")}
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
              {t("invitations.accept.missingHint")}
            </p>
          )}
          {status === "error" && (
            <>
              <p className="text-center text-sm text-[hsl(var(--destructive))]">
                {errorMessage}
              </p>
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => router.push("/dashboard")}>
                  {t("invitations.accept.goDashboard")}
                </Button>
              </div>
            </>
          )}
          {status === "success" && (
            <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
              {t("invitations.accept.redirectingDashboard")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
