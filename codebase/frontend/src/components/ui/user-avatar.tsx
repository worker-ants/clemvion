"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * 이름의 단어 첫 글자를 두 자까지 대문자로 쓴다. 이름이 비면 이메일 첫 글자, 그것도 없으면 `?` 다.
 */
export function getInitials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
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

interface UserAvatarProps {
  /** 아바타 이미지 주소. 없으면 이니셜을 보인다. */
  src?: string | null;
  name?: string | null;
  email?: string | null;
  /** 이미지의 대체 텍스트. 옆에 이름이 보이는 자리면 빈 문자열로 둔다. */
  alt: string;
  /** 원의 크기 · 글자 크기. 예: `h-8 w-8 text-xs font-semibold` */
  className?: string;
  imageTestId?: string;
  initialsTestId?: string;
}

/**
 * 사용자 아바타. 이미지가 있으면 이미지를, 없거나 불러오지 못하면 이름 이니셜을 보인다.
 * 사이드바 사용자 영역과 내 프로필 사용자 정보 카드가 같은 규칙을 쓴다(CLE-ACCT-PROFILE).
 * 불러오지 못한 주소는 기억해 두고 `src` 가 바뀌면 다시 시도한다.
 */
export function UserAvatar({
  src,
  name,
  email,
  alt,
  className,
  imageTestId,
  initialsTestId,
}: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
        className,
      )}
    >
      {showImage ? (
        // 외부 URL 도 받아 도메인을 미리 알 수 없어 next/image 대신 <img> 를 쓴다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          // 사용자가 지정한 외부 URL 을 모든 화면에서 요청하므로 Referer 를 보내지 않는다.
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
          data-testid={imageTestId}
        />
      ) : (
        <span data-testid={initialsTestId}>{getInitials(name, email)}</span>
      )}
    </div>
  );
}
