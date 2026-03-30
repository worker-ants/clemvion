"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { setAccessToken } from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface VerifyEmailContentProps {
  token?: string;
}

export function VerifyEmailContent({ token }: VerifyEmailContentProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "success" | "error" | "check-email">(
    token ? "verifying" : "check-email",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) return;

    async function verify() {
      try {
        const response = await authApi.verifyEmail(token!);
        const accessToken = response.data.data?.accessToken;
        if (accessToken) {
          setAccessToken(accessToken);
        }
        setStatus("success");
        toast.success("Email verified successfully!");
        setTimeout(() => router.push("/dashboard"), 2000);
      } catch (err) {
        const error = err as AxiosError<{ message?: string }>;
        const message = error.response?.data?.message ?? "Verification failed. Please try again.";
        setErrorMessage(message);
        setStatus("error");
        toast.error(message);
      }
    }

    verify();
  }, [token, router]);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Email Verification</CardTitle>
        <CardDescription>
          {status === "verifying" && "Verifying your email address..."}
          {status === "check-email" && "Please check your email"}
          {status === "success" && "Your email has been verified!"}
          {status === "error" && "Verification failed"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "verifying" && (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
          </div>
        )}

        {status === "check-email" && (
          <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
            <p>We have sent a verification link to your email address.</p>
            <p className="mt-2">Please click the link in the email to verify your account.</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
            <p>Redirecting to dashboard...</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[hsl(var(--destructive))]">{errorMessage}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to Sign In</Link>
            </Button>
          </div>
        )}

        {status === "check-email" && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to Sign In</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
