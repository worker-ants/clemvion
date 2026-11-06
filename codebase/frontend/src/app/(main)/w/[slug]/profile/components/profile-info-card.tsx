"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  axiosMessage,
  extractApiCode,
  type ApiErrorBody,
} from "@/lib/api/errors";
import { USER_PROFILE_QUERY_KEY, usersApi } from "@/lib/api/users";
import { useT } from "@/lib/i18n";
import type { TFunction } from "@/lib/i18n/core";
import { useWorkspaceSlug } from "@/lib/workspace/use-workspace-slug";
import { buildWorkspaceHref } from "@/lib/workspace/href";
import { AvatarEditor } from "./avatar-editor";
import {
  isValidAvatarUrl,
  useAvatarDraft,
  type AvatarDraft,
} from "./use-avatar-draft";
import { ConfirmDiffDialog, type DiffEntry } from "./confirm-diff-dialog";

interface ProfileInfoCardProps {
  user: {
    name: string;
    email: string;
    pendingEmail?: string | null;
    avatarUrl?: string | null;
  };
}

/** 확인 모달을 연 순간의 저장 내용. 모달이 열린 동안 입력을 바꿔도 모달에 보인 값을 보낸다. */
interface SaveSnapshot {
  name?: string;
  avatar: AvatarDraft;
}

/** 이미지 업로드 단계의 실패. `PATCH` 실패와 문구를 다르게 고르려고 감싼다. */
class AvatarUploadError extends Error {
  constructor(readonly original: unknown) {
    super("avatar upload failed");
  }
}

function getInitials(name: string, email: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) {
    return trimmed
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email ?? "").charAt(0).toUpperCase() || "?";
}

/** 업로드 실패를 서버 에러 코드별 문구로 바꾼다. 모르는 코드는 서버 문구, 그것도 없으면 기본 문구다. */
function avatarUploadErrorMessage(err: unknown, t: TFunction): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const code = extractApiCode(err);
    if (code === "INVALID_FILE_TYPE") return t("profile.avatar.invalidType");
    if (code === "FILE_REQUIRED") return t("profile.avatar.empty");
    if (code === "PAYLOAD_TOO_LARGE" || err.response?.status === 413) {
      return t("profile.avatar.tooLarge");
    }
  }
  return axiosMessage(err, t("profile.avatar.uploadFailed"));
}

export function ProfileInfoCard({ user }: ProfileInfoCardProps) {
  const t = useT();
  const slug = useWorkspaceSlug();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [name, setName] = useState(user.name ?? "");
  const [showDiff, setShowDiff] = useState(false);
  // diff 모달이 열린 시점에 확정될 payload 를 스냅샷으로 캡처해, 모달 열린 사이
  // 사용자가 input 을 추가로 만지더라도 모달이 보여준 값과 요청이 일치하도록 한다.
  const confirmedRef = useRef<SaveSnapshot>({ avatar: { kind: "keep" } });

  const currentAvatarUrl = user.avatarUrl ?? "";
  const avatar = useAvatarDraft(currentAvatarUrl);
  const { avatarDraft } = avatar;
  // 깨진 이미지 URL 은 이니셜로 대신 보인다. src 가 바뀌면 다시 시도한다.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const nameDirty = (name ?? "").trim() !== (user.name ?? "").trim();
  const dirty = nameDirty || avatarDraft.kind !== "keep";

  const mutation = useMutation({
    mutationFn: async (snapshot: SaveSnapshot) => {
      // 이미지를 먼저 올린다. 실패하면 이름도 저장하지 않아 사용자가 한 번에 다시 시도할 수 있다.
      if (snapshot.avatar.kind === "file") {
        try {
          await usersApi.uploadAvatar(snapshot.avatar.file);
        } catch (err) {
          throw new AvatarUploadError(err);
        }
      }
      const patch: { name?: string; avatarUrl?: string | null } = {};
      if (snapshot.name !== undefined) patch.name = snapshot.name;
      if (snapshot.avatar.kind === "url") patch.avatarUrl = snapshot.avatar.url;
      // 빈 문자열은 서버 URL 검증에 걸리므로 지울 때는 null 을 보낸다.
      if (snapshot.avatar.kind === "remove") patch.avatarUrl = null;
      if (Object.keys(patch).length > 0) {
        await apiClient.patch("/users/me", patch);
      }
    },
    onSuccess: () => {
      // 업로드 · PATCH 응답에는 `pendingEmail` 이 없어 캐시를 덮지 않고 GET 으로 다시 읽는다.
      queryClient.invalidateQueries({ queryKey: USER_PROFILE_QUERY_KEY });
      toast.success(t("profile.saved"));
      setShowDiff(false);
      avatar.reset();
      setMode("view");
    },
    onError: (err) => {
      // 에러 시 diff 모달을 닫고 편집 모드를 유지해 사용자가 재시도하기 좋게 한다.
      setShowDiff(false);
      if (err instanceof AvatarUploadError) {
        toast.error(avatarUploadErrorMessage(err.original, t));
        return;
      }
      // 업로드는 성공하고 PATCH 만 실패했을 수 있어 화면 값을 서버와 다시 맞춘다.
      queryClient.invalidateQueries({ queryKey: USER_PROFILE_QUERY_KEY });
      toast.error(axiosMessage(err, t("profile.saveFailed")));
    },
  });

  function handleEdit() {
    setName(user.name ?? "");
    avatar.reset();
    setMode("edit");
  }

  function handleCancel() {
    setName(user.name ?? "");
    avatar.reset();
    setMode("view");
  }

  function handleSaveClick() {
    if (!dirty) {
      toast.info(t("profile.noChanges"));
      setMode("view");
      return;
    }
    if (avatarDraft.kind === "url" && !isValidAvatarUrl(avatarDraft.url)) {
      avatar.setAvatarError(t("profile.avatar.invalidUrl"));
      return;
    }
    confirmedRef.current = {
      name: nameDirty ? name.trim() : undefined,
      avatar: avatarDraft,
    };
    setShowDiff(true);
  }

  const diff: DiffEntry[] = useMemo(() => {
    const entries: DiffEntry[] = [];
    if (nameDirty) {
      entries.push({
        label: t("profile.name"),
        before: user.name ?? "",
        after: name.trim(),
      });
    }
    if (avatarDraft.kind !== "keep") {
      const none = t("profile.avatar.none");
      let after = none;
      if (avatarDraft.kind === "file") {
        after = t("profile.avatar.newFile", { name: avatarDraft.file.name });
      } else if (avatarDraft.kind === "url") {
        after = avatarDraft.url;
      }
      entries.push({
        label: t("profile.avatar.label"),
        before: currentAvatarUrl || none,
        after,
      });
    }
    return entries;
  }, [nameDirty, user.name, name, avatarDraft, currentAvatarUrl, t]);

  // 보이는 아바타: 편집 중이면 목표 상태, 아니면 저장된 값.
  let shownAvatarSrc: string | null = currentAvatarUrl || null;
  if (mode === "edit") {
    if (avatarDraft.kind === "file") shownAvatarSrc = avatar.filePreview;
    else if (avatarDraft.kind === "url") shownAvatarSrc = avatarDraft.url;
    else if (avatarDraft.kind === "remove") shownAvatarSrc = null;
  }
  const showImage = !!shownAvatarSrc && failedSrc !== shownAvatarSrc;
  const canRemove =
    avatarDraft.kind === "file" ||
    avatarDraft.kind === "url" ||
    (avatarDraft.kind === "keep" && !!currentAvatarUrl);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg">
            {t("profile.userInformation")}
          </CardTitle>
          {mode === "view" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              data-testid="profile-info-edit"
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t("profile.edit")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={mutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveClick}
                disabled={mutation.isPending}
                data-testid="profile-info-save"
              >
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--primary))] text-lg font-bold text-[hsl(var(--primary-foreground))]">
              {showImage ? (
                // 외부 URL 도 받아 도메인을 미리 알 수 없어 next/image 대신 <img> 를 쓴다.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shownAvatarSrc!}
                  alt={t("profile.avatar.alt")}
                  className="h-full w-full object-cover"
                  onError={() => setFailedSrc(shownAvatarSrc)}
                  data-testid="profile-avatar-image"
                />
              ) : (
                <span data-testid="profile-avatar-initials">
                  {getInitials(mode === "edit" ? name : user.name, user.email)}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-4">
              {mode === "edit" && (
                <AvatarEditor
                  fileInputRef={avatar.fileInputRef}
                  draft={avatarDraft}
                  urlText={avatar.avatarUrlText}
                  error={avatar.avatarError}
                  canRemove={canRemove}
                  disabled={mutation.isPending}
                  onFileChange={avatar.handleFileChange}
                  onUrlChange={avatar.handleUrlChange}
                  onRemove={avatar.handleRemove}
                />
              )}
              <div>
                <Label htmlFor="profile-name">{t("profile.name")}</Label>
                {mode === "view" ? (
                  <p
                    id="profile-name"
                    className="mt-1 text-sm"
                    data-testid="profile-name-readonly"
                  >
                    {user.name || "—"}
                  </p>
                ) : (
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("profile.namePlaceholder")}
                    autoFocus
                    data-testid="profile-name-input"
                  />
                )}
              </div>
              <div>
                <Label htmlFor="profile-email">{t("profile.email")}</Label>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p id="profile-email" className="text-sm">
                    {user.email}
                  </p>
                  <Link
                    href={buildWorkspaceHref(slug, "/profile/change-email")}
                    className="shrink-0 text-sm text-[hsl(var(--primary))] hover:underline"
                    data-testid="profile-change-email-link"
                  >
                    {t("profile.changeEmailCta")}
                  </Link>
                </div>
                {user.pendingEmail ? (
                  <p
                    className="mt-1 text-xs text-[hsl(var(--muted-foreground))]"
                    data-testid="profile-email-pending"
                  >
                    {t("profile.emailPendingLabel")}{" "}
                    <strong>{user.pendingEmail}</strong>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {t("profile.emailReadonlyHint")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDiffDialog
        open={showDiff}
        changes={diff}
        onClose={() => setShowDiff(false)}
        onConfirm={async () => {
          await mutation.mutateAsync(confirmedRef.current);
        }}
      />
    </>
  );
}
