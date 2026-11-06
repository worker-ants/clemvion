import { useEffect, useMemo, useRef, useState } from "react";
import { AVATAR_EXTENSIONS, AVATAR_MAX_BYTES } from "@/lib/api/users";
import { useT } from "@/lib/i18n";
import type { TFunction } from "@/lib/i18n/core";

/**
 * 편집 중인 아바타의 목표 상태. `keep` 은 지금 값을 그대로 두고, `file` 은 이미지를 올리고
 * (`POST /users/me/avatar`), `url` · `remove` 는 `PATCH /users/me` 의 `avatarUrl` 로 바꾼다.
 */
export type AvatarDraft =
  | { kind: "keep" }
  | { kind: "file"; file: File }
  | { kind: "url"; url: string }
  | { kind: "remove" };

export const AVATAR_ACCEPT = [
  ...AVATAR_EXTENSIONS.map((ext) => `.${ext}`),
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
].join(",");

/** 서버 `UpdateMeDto.avatarUrl` 의 `@MaxLength(500)` 과 같은 값. */
const AVATAR_URL_MAX_LENGTH = 500;

/** 고른 파일을 서버와 같은 기준(확장자 · 크기 · 빈 파일)으로 미리 거른다. 통과하면 null. */
function validateAvatarFile(file: File, t: TFunction): string | null {
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "";
  if (!(AVATAR_EXTENSIONS as readonly string[]).includes(ext)) {
    return t("profile.avatar.invalidType");
  }
  if (file.size === 0) return t("profile.avatar.empty");
  if (file.size > AVATAR_MAX_BYTES) return t("profile.avatar.tooLarge");
  return null;
}

/** 외부 이미지 URL 은 http(s) 절대 URL 이고 500자 이하여야 한다. */
export function isValidAvatarUrl(value: string): boolean {
  if (value.length > AVATAR_URL_MAX_LENGTH) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** jsdom 등 `URL.revokeObjectURL` 이 없는 환경에서는 건너뛴다. */
function revokePreview(url: string | null) {
  if (url && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

/**
 * 아바타 편집 상태. 파일을 고르면 `avatarFile` 이, 아니면 URL 입력 칸이 목표를 정한다.
 * 미리보기 objectURL 은 파일을 고를 때 만들고 바꾸거나 버릴 때 · 카드가 사라질 때 해제한다.
 */
export function useAvatarDraft(currentAvatarUrl: string) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrlText, setAvatarUrlText] = useState(currentAvatarUrl);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  function replacePreview(file: File | null) {
    revokePreview(previewRef.current);
    const next =
      file && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file)
        : null;
    previewRef.current = next;
    setFilePreview(next);
  }
  useEffect(() => () => revokePreview(previewRef.current), []);

  const avatarDraft: AvatarDraft = useMemo(() => {
    if (avatarFile) return { kind: "file", file: avatarFile };
    const url = avatarUrlText.trim();
    if (url === currentAvatarUrl) return { kind: "keep" };
    if (url === "") return { kind: "remove" };
    return { kind: "url", url };
  }, [avatarFile, avatarUrlText, currentAvatarUrl]);

  /** 고른 파일 · 미리보기 · 오류를 함께 비운다. */
  function clearPickedFile() {
    setAvatarFile(null);
    replacePreview(null);
    setAvatarError(null);
  }

  function reset() {
    clearPickedFile();
    setAvatarUrlText(currentAvatarUrl);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 change 가 나도록 값을 비운다.
    e.target.value = "";
    if (!file) return;
    const error = validateAvatarFile(file, t);
    if (error) {
      setAvatarError(error);
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    replacePreview(file);
  }

  function handleUrlChange(value: string) {
    clearPickedFile();
    setAvatarUrlText(value);
  }

  function handleRemove() {
    clearPickedFile();
    setAvatarUrlText("");
  }

  return {
    fileInputRef,
    avatarFile,
    avatarUrlText,
    avatarError,
    setAvatarError,
    filePreview,
    avatarDraft,
    reset,
    handleFileChange,
    handleUrlChange,
    handleRemove,
  };
}
