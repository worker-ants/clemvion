"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import { setAccessToken } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { OAuthProvider } from "@/lib/api/auth-providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api";

interface LoginFormProps {
  enabledProviders?: OAuthProvider[];
}

export function LoginForm({ enabledProviders = [] }: LoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  function startOauth(provider: OAuthProvider) {
    const rememberMe = getValues("rememberMe") ? "&rememberMe=true" : "";
    window.location.href = `${API_BASE_URL}/auth/oauth/${provider}?mode=login${rememberMe}`;
  }

  const showGoogle = enabledProviders.includes("google");
  const showGithub = enabledProviders.includes("github");
  const showOauth = showGoogle || showGithub;

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      const response = await authApi.login({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });
      const accessToken = response.data.data?.accessToken;
      if (accessToken) {
        setAccessToken(accessToken);
        // Fetch user profile and set auth state
        try {
          const userRes = await usersApi.getMe();
          const user = userRes.data.data;
          if (user) {
            setAuthenticated(accessToken, user);
          }
        } catch {
          // Auth state will be restored by AuthProvider on next page load
        }
      }
      toast.success("Signed in successfully!");
      router.push("/dashboard");
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>;
      const message = error.response?.data?.message ?? "Failed to sign in. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Welcome back! Sign in to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-[hsl(var(--destructive))]">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-[hsl(var(--destructive))]">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[hsl(var(--input))]"
                {...register("rememberMe")}
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-[hsl(var(--primary))] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {showOauth && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[hsl(var(--border))]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[hsl(var(--card))] px-2 text-[hsl(var(--muted-foreground))]">
                  Or continue with
                </span>
              </div>
            </div>

            <div
              className={
                showGoogle && showGithub
                  ? "grid grid-cols-2 gap-3"
                  : "grid grid-cols-1 gap-3"
              }
            >
              {showGoogle && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => startOauth("google")}
                >
                  Google
                </Button>
              )}
              {showGithub && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => startOauth("github")}
                >
                  GitHub
                </Button>
              )}
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[hsl(var(--primary))] hover:underline">
            Create account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
