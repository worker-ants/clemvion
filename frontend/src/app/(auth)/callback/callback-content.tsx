"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setAccessToken } from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CallbackContentProps {
  success?: string;
  error?: string;
  token?: string;
}

export function CallbackContent({ success, error, token }: CallbackContentProps) {
  const router = useRouter();
  const hasError = !!error || (!success && !token);
  const [status] = useState<"loading" | "error">(
    hasError ? "error" : "loading",
  );

  useEffect(() => {
    if (hasError) return;

    if (token) {
      setAccessToken(token);
    }
    router.push("/dashboard");
  }, [hasError, token, router]);

  if (status === "loading") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Signing in...</CardTitle>
          <CardDescription>Please wait while we complete your sign in.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Authentication Failed</CardTitle>
        <CardDescription>
          {error ?? "An unexpected error occurred during authentication."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild className="w-full">
          <Link href="/login">Try Again</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to Sign In</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
