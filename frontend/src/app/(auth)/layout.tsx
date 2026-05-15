import { Logo } from "@/components/ui/logo";

/*
 * Auth layout — spec/6-brand.md §8.4.6 + spec/2-navigation/10-auth-flow.md §1.
 *
 * Background uses --background (soil-50 in light, vine-dark-bg-base in dark) —
 * solid color, no gradient (spec §8.4.4 prohibits gradient backgrounds).
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-4">
      <div className="mb-6 flex items-center">
        <Logo variant="full" theme="auto" size={200} />
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
