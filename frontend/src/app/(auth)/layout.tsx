import { Logo } from "@/components/ui/logo";

/*
 * Auth layout — spec/6-brand.md §8.4.6.
 *
 * The brand-refresh theme rollback (2026-05-15) restored the original
 * gradient background. The new brand SVG assets are still rendered above
 * the card, but the page surface keeps Shadcn's neutral palette until
 * spec/code re-alignment in a future iteration.
 *
 * The logo is rendered as a NON-link image. The a11y smoke test
 * (`frontend/e2e/a11y/smoke.spec.ts`) enforces that the first Tab on auth
 * screens lands on the form's first input (no skip-to-main, no logo home
 * link). Auth flows prioritize authentication intent over global nav, so
 * the logo is purely decorative/brand here. See sidebar.tsx for the
 * keyboard-navigable home link variant.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))] p-4">
      <div className="mb-6 flex items-center">
        <Logo variant="full" theme="auto" size={200} />
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
