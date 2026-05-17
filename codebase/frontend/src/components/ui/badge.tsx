import { cn } from "@/lib/utils/cn";

const badgeVariants = {
  default:
    "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  warning:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  destructive:
    "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
  outline:
    "border border-[hsl(var(--border))] text-[hsl(var(--foreground))] bg-transparent",
} as const;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof badgeVariants;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
