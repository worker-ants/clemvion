import type { ChangeEvent, RefObject } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { AVATAR_ACCEPT, type AvatarDraft } from "./use-avatar-draft";

interface AvatarEditorProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  draft: AvatarDraft;
  urlText: string;
  error: string | null;
  canRemove: boolean;
  disabled: boolean;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onUrlChange: (value: string) => void;
  onRemove: () => void;
}

/** 프로필 편집 모드의 아바타 편집 블록(파일 올리기 · URL 입력 · 제거). */
export function AvatarEditor({
  fileInputRef,
  draft,
  urlText,
  error,
  canRemove,
  disabled,
  onFileChange,
  onUrlChange,
  onRemove,
}: AvatarEditorProps) {
  const t = useT();
  return (
    <div className="space-y-2" data-testid="profile-avatar-editor">
      <Label htmlFor="profile-avatar-url">{t("profile.avatar.label")}</Label>
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={onFileChange}
          data-testid="profile-avatar-file"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          data-testid="profile-avatar-upload"
        >
          <ImageUp className="mr-2 h-4 w-4" />
          {t("profile.avatar.upload")}
        </Button>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            data-testid="profile-avatar-remove"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("profile.avatar.remove")}
          </Button>
        )}
      </div>
      {draft.kind === "file" && (
        <p className="text-xs" data-testid="profile-avatar-selected-file">
          {t("profile.avatar.newFile", { name: draft.file.name })}
        </p>
      )}
      <Input
        id="profile-avatar-url"
        type="url"
        inputMode="url"
        value={draft.kind === "file" ? "" : urlText}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder={t("profile.avatar.urlPlaceholder")}
        aria-describedby="profile-avatar-hint"
        data-testid="profile-avatar-url"
      />
      <p
        id="profile-avatar-hint"
        className="text-xs text-[hsl(var(--muted-foreground))]"
      >
        {t("profile.avatar.hint")}
      </p>
      {error && (
        <p
          role="alert"
          className="text-xs text-[hsl(var(--destructive))]"
          data-testid="profile-avatar-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
