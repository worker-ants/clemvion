"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useLocale } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/types";

// `/docs/<locale>` 또는 `/docs/<locale>/...` 형태인지 한 번에 판정하는 정규식.
// LOCALES 길이가 늘어나면 `|` 분리자가 늘어나요.
const ALREADY_LOCALIZED_DOCS_RE = new RegExp(
  `^/docs/(?:${LOCALES.join("|")})(?:/|$)`,
);

/** `/docs/<locale>/...` 프리픽스가 붙은 경로인지 판정해요. */
function isAlreadyLocalized(href: string): boolean {
  return ALREADY_LOCALIZED_DOCS_RE.test(href);
}

function isSafeHref(href: string): boolean {
  return (
    href.startsWith("/") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("#") ||
    href.startsWith("mailto:")
  );
}

/**
 * MDX 본문의 `<a>`에 대한 공통 래퍼예요.
 * - `javascript:`·`data:` 등 잠재 XSS 스킴은 링크를 떼고 텍스트로만 렌더링.
 * - `/docs/...` 로 시작하지만 locale 프리픽스가 없는 내부 링크는 현재 locale을 자동 주입.
 * - 외부 링크는 `target="_blank" rel="noopener noreferrer"`.
 */
export function DocsLink({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) {
  const locale = useLocale();
  if (typeof href !== "string" || !isSafeHref(href)) {
    return <span {...rest}>{children}</span>;
  }
  const isInternal = href.startsWith("/") || href.startsWith("#");
  if (isInternal) {
    let resolved = href;
    if (href.startsWith("/docs/") && !isAlreadyLocalized(href)) {
      const pathSuffix = href.slice("/docs/".length);
      resolved = `/docs/${locale}/${pathSuffix}`;
    }
    return (
      <Link href={resolved} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
