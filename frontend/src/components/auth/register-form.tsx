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

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").min(2, "Name must be at least 2 characters"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api";

function startOauth(provider: OAuthProvider) {
  window.location.href = `${API_BASE_URL}/auth/oauth/${provider}?mode=register`;
}

interface RegisterFormProps {
  enabledProviders?: OAuthProvider[];
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-500" };
  if (score <= 4) return { score, label: "Strong", color: "bg-green-400" };
  return { score, label: "Very Strong", color: "bg-green-600" };
}

export function RegisterForm({ enabledProviders = [] }: RegisterFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const showGoogle = enabledProviders.includes("google");
  const showGithub = enabledProviders.includes("github");
  const showOauth = showGoogle || showGithub;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      termsAccepted: false,
    },
  });

  const password = watch("password");
  const strength = getPasswordStrength(password);

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true);
    try {
      await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        termsAccepted: data.termsAccepted,
      });
      toast.success("Account created! Please check your email to verify.");
      router.push("/verify-email");
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>;
      const message =
        error.response?.data?.message ?? "Failed to create account. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Get started with your new account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-[hsl(var(--destructive))]">{errors.name.message}</p>
            )}
          </div>

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
              placeholder="Create a password"
              autoComplete="new-password"
              {...register("password")}
            />
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex h-2 gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 rounded-full transition-colors ${
                        i < strength.score ? strength.color : "bg-[hsl(var(--muted))]"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{strength.label}</p>
              </div>
            )}
            {errors.password && (
              <p className="text-sm text-[hsl(var(--destructive))]">{errors.password.message}</p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-[hsl(var(--input))]"
              {...register("termsAccepted")}
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="text-[hsl(var(--primary))] hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-[hsl(var(--primary))] hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="text-sm text-[hsl(var(--destructive))]">{errors.termsAccepted.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
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
          Already have an account?{" "}
          <Link href="/login" className="text-[hsl(var(--primary))] hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
