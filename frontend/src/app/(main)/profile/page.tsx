"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { useThemeStore } from "@/lib/stores/theme-store";

type Locale = "ko" | "en";
type ServerTheme = "light" | "dark";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  locale: Locale;
  theme: ServerTheme;
}

function axiosMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export default function ProfilePage() {
  const { theme, setTheme } = useThemeStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [language, setLanguage] = useState<Locale>("ko");
  const [isSaving, setIsSaving] = useState(false);

  const { data: user, isLoading, isError } = useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await apiClient.get("/users/me");
      return res.data.data ?? res.data;
    },
  });

  // Seed editable state from fetched profile when it arrives.
  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    if (user.locale === "ko" || user.locale === "en") {
      setLanguage(user.locale);
    }
    if (user.theme === "light" || user.theme === "dark") {
      setTheme(user.theme);
    }
  }, [user, setTheme]);

  const effectiveTheme: ServerTheme = theme === "dark" ? "dark" : "light";

  const dirtyProfile = useMemo(() => {
    if (!user) return {} as Partial<Pick<UserProfile, "name" | "locale" | "theme">>;
    const patch: Partial<Pick<UserProfile, "name" | "locale" | "theme">> = {};
    if (name !== user.name) patch.name = name;
    if (language !== user.locale) patch.locale = language;
    if (effectiveTheme !== user.theme) patch.theme = effectiveTheme;
    return patch;
  }, [user, name, language, effectiveTheme]);

  function getInitials(nameStr: string, email: string): string {
    if (nameStr.trim()) {
      return nameStr
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() ?? "?";
  }

  async function handleSave() {
    if (!user) return;

    if (newPassword || confirmPassword || currentPassword) {
      if (!newPassword) {
        toast.error("Please enter a new password");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (!currentPassword) {
        toast.error("Please enter your current password");
        return;
      }
    }

    const hasProfileChanges = Object.keys(dirtyProfile).length > 0;
    const hasPasswordChange = Boolean(newPassword);

    if (!hasProfileChanges && !hasPasswordChange) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);
    try {
      if (hasProfileChanges) {
        await apiClient.patch("/users/me", dirtyProfile);
      }
      if (hasPasswordChange) {
        await apiClient.post("/users/me/change-password", {
          currentPassword,
          newPassword,
        });
      }
      toast.success("Profile updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    } catch (err) {
      toast.error(axiosMessage(err, "Failed to update profile"));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-sm text-[hsl(var(--destructive))]">
          Failed to load profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Profile</h1>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-lg font-bold text-[hsl(var(--primary-foreground))]">
              {getInitials(name, user?.email ?? "")}
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  value={user?.email ?? ""}
                  readOnly
                  className="opacity-60"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-pw">Current Password</Label>
            <Input
              id="current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div>
            <Label htmlFor="new-pw">New Password</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <div>
            <Label htmlFor="confirm-pw">Confirm Password</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Theme</Label>
            <div className="mt-1 flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                Dark
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="language-select">Language</Label>
            <select
              id="language-select"
              className="flex h-10 w-full max-w-xs rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Locale)}
            >
              <option value="ko">Korean</option>
              <option value="en">English</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}
