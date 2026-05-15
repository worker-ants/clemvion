import Link from "next/link";
import { Logo } from "@/components/ui/logo";

/*
 * Auth layout — spec/6-brand.md §8.4.6 + spec/2-navigation/10-auth-flow.md §1.
 * Background uses --background (soil-50 in light, vine-dark-bg-base in dark) —
 * solid color, no gradient (spec §8.4.4 prohibits gradient backgrounds).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-4">
      <Link
        href="/"
        aria-label="Clemvion"
        className="mb-6 flex items-center"
      >
        <Logo variant="full" theme="auto" size={200} />
      </Link>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
