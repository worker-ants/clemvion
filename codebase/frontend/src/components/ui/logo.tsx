/* eslint-disable @next/next/no-img-element --
 * Brand SVG assets are tiny static vectors that gain nothing from next/image
 * optimization (next/image passes SVG through unoptimized anyway). Using
 * plain <img> keeps the markup synchronous and SSR-friendly for the auto-theme
 * dual-render pattern below.
 */
import * as React from "react";
import { cn } from "@/lib/utils/cn";

/*
 * Logo component — renders the Clemvion brand mark per spec/6-brand.md §8.4.
 *
 * variant:
 *   - "full"     : icon mark + wordmark + AGENTIC WORKFLOW sub-copy (spec §8.4.3)
 *   - "mark"     : icon mark only (spec §8.4.1)
 *   - "wordmark" : wordmark only, no sub-copy (spec §8.4.1)
 *
 * theme:
 *   - "light" / "dark" : render exactly one asset
 *   - "auto" (default) : render both light and dark, toggled by Tailwind `dark:` variant
 *
 * size: optional pixel width. If omitted, the underlying SVG renders at its
 *       natural viewBox size.
 */
export type LogoVariant = "full" | "mark" | "wordmark";
export type LogoTheme = "light" | "dark" | "auto";

export interface LogoProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: number;
  alt?: string;
}

const ASSET_PATHS: Record<LogoVariant, { light: string; dark: string }> = {
  full: { light: "/logo.svg", dark: "/logo-dark.svg" },
  // Wordmark splits into light/dark variants — black text on light
  // surface, white text on dark surface (spec §8.4.4 R-16).
  wordmark: { light: "/logo-wordmark.svg", dark: "/logo-wordmark-dark.svg" },
  // Mark has no light/dark distinction — the SVG container is transparent
  // and the gradient (teal→lime) reads on both surfaces (spec §8.4.1
  // R-16). Both keys point at the same file; the auto-theme renderer
  // still emits the dual-img pair for Tailwind `dark:` toggle symmetry
  // with `full`, so a future split (e.g. tinted mark for high-contrast
  // mode) is a one-line change here.
  mark: { light: "/logo-mark.svg", dark: "/logo-mark.svg" },
};

const DEFAULT_ALT: Record<LogoVariant, string> = {
  full: "Clemvion — Agentic Workflow",
  wordmark: "Clemvion",
  mark: "Clemvion",
};

export function Logo({
  variant = "full",
  theme = "auto",
  size,
  alt,
  className,
  ...rest
}: LogoProps) {
  const paths = ASSET_PATHS[variant];
  const resolvedAlt = alt ?? DEFAULT_ALT[variant];
  const style = size != null ? { width: `${size}px`, height: "auto" } : undefined;

  if (theme === "light" || theme === "dark") {
    const src = paths[theme];
    return (
      <span className={cn("inline-block", className)} {...rest}>
        <img src={src} alt={resolvedAlt} style={style} draggable={false} />
      </span>
    );
  }

  /*
   * theme === "auto" — render both light and dark assets and let
   * Tailwind's `dark:` variant toggle visibility via CSS `display`.
   *
   * Tradeoff: the browser fetches both SVG assets up front. Acceptable
   * because brand SVGs are <2KB each and ship from the same origin
   * (`/public`). For pages where only one mode is reachable (e.g.
   * always-light marketing pages), prefer `theme="light"` to skip the
   * dark fetch. We keep both `alt` attributes; the inactive `<img>` is
   * `display:none`, which removes it from the accessibility tree, so
   * screen readers announce the visible variant only.
   */
  return (
    <span className={cn("inline-block", className)} {...rest}>
      <img
        src={paths.light}
        alt={resolvedAlt}
        style={style}
        draggable={false}
        className="block dark:hidden"
      />
      <img
        src={paths.dark}
        alt={resolvedAlt}
        style={style}
        draggable={false}
        className="hidden dark:block"
      />
    </span>
  );
}

export type LogoMarkProps = Omit<LogoProps, "variant">;

export function LogoMark(props: LogoMarkProps) {
  return <Logo variant="mark" {...props} />;
}
