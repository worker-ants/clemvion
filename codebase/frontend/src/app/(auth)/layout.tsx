import { Logo } from "@/components/ui/logo";

/*
 * Auth layout — spec/6-brand.md §8.4.6.
 *
 * The brand image is rendered above the card on a #111e14 surface so the
 * mark's green gradient stays crisp regardless of system theme.
 *
 * The logo is rendered as a NON-link image. The a11y smoke test
 * (`codebase/frontend/e2e/a11y/smoke.spec.ts`) enforces that the first Tab on auth
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
      {/* Brand image on a dark elevated surface — matches the apple-icon look
          and keeps the green mark crisp in both themes. */}
      <div className="mb-6 flex items-center rounded-2xl bg-[#111e14] px-5 py-3">
        <Logo variant="full" theme="dark" size={200} />
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
